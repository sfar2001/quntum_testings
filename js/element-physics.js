/* ============================================================================
 *  ELEMENT-PHYSICS.JS  —  per-element numeric engine
 *  Pure functions the Periodic-Table inspector uses to APPLY the library
 *  equations to a concrete atom: phase at a temperature, heat to melt/boil a
 *  sample, kinetic-theory speeds, thermal de Broglie wavelength, blackbody
 *  peak, and radioactive-decay maths.  No DOM here.
 *  Exposes: window.ElementPhysics
 * ========================================================================== */
(function () {
  "use strict";

  const C = {
    NA: 6.02214076e23,        // Avogadro   (1/mol)
    kB: 1.380649e-23,         // Boltzmann  (J/K)
    u:  1.66053906660e-27,    // atomic mass unit (kg)
    h:  6.62607015e-34,       // Planck (J·s)
    hbar: 1.054571817e-34,
    eV: 1.602176634e-19,      // J per eV
    c:  2.99792458e8,         // m/s
    wienB: 2.897771955e-3,    // m·K
    sigma: 5.670374419e-8,    // W/m²K⁴
    T0: 298.15                // room temperature (K)
  };

  /* phase of the element at temperature T (K) given its extras record */
  function phaseAt(x, T) {
    if (!x) return "unknown";
    const m = x.meltK, b = x.boilK;
    if (x.sublimes && b == null && m != null) return T < m ? "solid" : "gas";
    if (m == null && b == null) return x.phaseSTP || "unknown";
    if (b != null && T >= b) return "gas";
    if (m != null && T >= m) return "liquid";
    if (m == null && b != null) return T >= b ? "gas" : "liquid";
    return "solid";
  }

  /* kinetic-theory speeds of ONE atom of mass A(u) at temperature T(K) */
  function speeds(A, T) {
    const m = A * C.u;
    const kT = C.kB * T;
    return {
      m_kg: m,
      vrms: Math.sqrt(3 * kT / m),                 // √(3kT/m)
      vmean: Math.sqrt(8 * kT / (Math.PI * m)),    // √(8kT/πm)
      vmp: Math.sqrt(2 * kT / m),                  // √(2kT/m)
      meanKE_eV: (1.5 * kT) / C.eV,                // (3/2)kT
      // Maxwell–Boltzmann speed pdf value at speed v (for plotting)
      pdf: function (v) {
        const a = m / (2 * kT);
        return 4 * Math.PI * v * v * Math.pow(a / Math.PI, 1.5) * Math.exp(-a * v * v);
      }
    };
  }

  /* thermal de Broglie wavelength Λ = h/√(2π m kT), returned in pm */
  function thermalDeBroglie_pm(A, T) {
    const m = A * C.u;
    return C.h / Math.sqrt(2 * Math.PI * m * C.kB * T) * 1e12;
  }

  /* Wien peak wavelength (nm) of blackbody glow at temperature T */
  function wienPeak_nm(T) { return (C.wienB / T) * 1e9; }
  /* Stefan–Boltzmann radiant exitance (W/m²) */
  function stefan_W_m2(T) { return C.sigma * T * T * T * T; }

  /* Heat needed to warm a sample and drive it through phase changes.
     x = extras record, molarMassGmol = atomic mass (g/mol), moles = sample size.
     Uses molar heat capacity C_m (J/mol·K) for the sensible-heat legs and the
     molar enthalpies of fusion/vaporisation for the latent legs.  Approximation:
     one C_m is used for all phases (noted in the UI). Returns kJ figures +
     a piecewise heating curve (T vs cumulative Q) for plotting. */
  function heating(x, moles) {
    const Cm = (x && x.molarHeat_J_molK) || 25;   // J/mol·K fallback (Dulong–Petit ~25)
    const m = x ? x.meltK : null, b = x ? x.boilK : null;
    const dHf = (x && x.dHfus_kJmol) || 0;         // kJ/mol
    const dHv = (x && x.dHvap_kJmol) || 0;
    const phase = (x && x.phaseSTP) || "solid";
    const sublimes = !!(x && x.sublimes);
    const start = C.T0;                            // begin at room temperature
    const curve = [];                              // [{Q_kJ, T, phase, event}]
    let Q = 0;                                     // kJ
    const sensible = (dT) => moles * Cm * dT / 1000; // J→kJ

    function seg(fromT, toT, phase) {
      if (fromT == null || toT == null || toT <= fromT) return;
      curve.push({ Q, T: fromT, phase });
      Q += sensible(toT - fromT);
      curve.push({ Q, T: toT, phase });
    }
    function latent(atT, kjPerMol, label, phaseAfter) {
      if (atT == null || kjPerMol == null) return;
      curve.push({ Q, T: atT, phase: label, event: label + " start" });
      Q += moles * kjPerMol;
      curve.push({ Q, T: atT, phase: phaseAfter, event: label + " done" });
    }

    const res = { Cm, moles, milestones: {}, sublimes };
    // Route by the element's real behaviour, not just by whether boilK exists.
    if (sublimes && m != null && b == null) {
      // subliming solid (C, As): warm solid → sublime straight to gas (latent = ΔH_sub ≈ ΔH_vap)
      seg(start, m, "solid");   res.milestones.reachMelt_kJ = Q;
      latent(m, dHv || dHf, "subliming", "gas"); res.milestones.fullyGas_kJ = Q;
      seg(m, m + 250, "gas");
    } else if (phase === "solid" && m != null && b != null) {
      // solid at STP with melt & boil: solid → melt → liquid → boil → gas
      seg(start, m, "solid");   res.milestones.reachMelt_kJ = Q;
      latent(m, dHf, "melting", "liquid"); res.milestones.fullyLiquid_kJ = Q;
      seg(m, b, "liquid");      res.milestones.reachBoil_kJ = Q;
      latent(b, dHv, "boiling", "gas"); res.milestones.fullyGas_kJ = Q;
      seg(b, b + (b - m) * 0.4 + 50, "gas");
    } else if (phase === "liquid" && b != null) {
      // liquid at STP (Hg, Br): warm liquid → boil → gas
      seg(start, b, "liquid");  res.milestones.reachBoil_kJ = Q;
      latent(b, dHv, "boiling", "gas"); res.milestones.fullyGas_kJ = Q;
      seg(b, b + 80, "gas");
    } else if (phase === "gas") {
      // gas at STP (H, N, O, F, noble gases, Cl…): melt/boil are below room T — just warms as a gas
      seg(start, start + 300, "gas");
    } else if (m != null && b == null) {
      // solid with a melt point but unknown boil point (e.g. Fm, Md, No, Lr): warm solid → melt → liquid
      seg(start, m, "solid");   res.milestones.reachMelt_kJ = Q;
      latent(m, dHf, "melting", "liquid"); res.milestones.fullyLiquid_kJ = Q;
      seg(m, m + 250, "liquid");
    } else if (m != null && b != null) {
      // fallback with both points (e.g. data-quirk low-melting solid): solid → melt → boil → gas
      seg(start, m, "solid");   res.milestones.reachMelt_kJ = Q;
      latent(m, dHf, "melting", "liquid"); res.milestones.fullyLiquid_kJ = Q;
      seg(m, b, "liquid");      res.milestones.reachBoil_kJ = Q;
      latent(b, dHv, "boiling", "gas"); res.milestones.fullyGas_kJ = Q;
      seg(b, b + 60, "gas");
    } else {
      // gas at STP (H, N, O, noble gases…): warms as a gas
      seg(start, start + 300, "gas");
    }
    res.curve = curve;
    res.total_kJ = Q;
    return res;
  }

  /* parse a human half-life string → seconds (best effort; null if unknown) */
  const MULT = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12, quadrillion: 1e15 };
  const UNIT = {
    ys: 1e-24, zs: 1e-21, as: 1e-18, fs: 1e-15, ps: 1e-12, ns: 1e-9, "µs": 1e-6, us: 1e-6,
    ms: 1e-3, s: 1, sec: 1, second: 1, seconds: 1,
    min: 60, minute: 60, minutes: 60, h: 3600, hr: 3600, hour: 3600, hours: 3600,
    d: 86400, day: 86400, days: 86400, y: 3.15576e7, yr: 3.15576e7, year: 3.15576e7, years: 3.15576e7
  };
  function parseHalfLifeSeconds(text) {
    if (!text || /stable/i.test(text)) return null;
    const t = String(text).toLowerCase();
    const num = parseFloat(t.replace(/,/g, ""));
    if (!isFinite(num)) return null;
    let mult = 1;
    for (const k in MULT) if (t.includes(k)) { mult = MULT[k]; break; }
    let unit = 1, best = "";
    for (const k in UNIT) {
      const re = new RegExp("(^|[\\s\\d.])" + k.replace("µ", "\\u00b5") + "($|[\\s.])");
      if (re.test(t) && k.length > best.length) { unit = UNIT[k]; best = k; }
    }
    return num * mult * unit;
  }

  /* decay: N(t) = N0·e^(−λt), λ = ln2 / t½ */
  function decayConstant(halfLifeSeconds) {
    if (!halfLifeSeconds || halfLifeSeconds <= 0) return null;
    return Math.LN2 / halfLifeSeconds;
  }
  function fractionRemaining(halfLives) { return Math.pow(0.5, halfLives); }

  const DECAY_LABEL = {
    "alpha": "α decay — emits a helium-4 nucleus (Z−2, A−4)",
    "beta-": "β⁻ decay — a neutron → proton + e⁻ + ν̄ (Z+1)",
    "beta+": "β⁺ decay — a proton → neutron + e⁺ + ν (Z−1)",
    "EC": "electron capture — a proton + e⁻ → neutron + ν (Z−1)",
    "SF": "spontaneous fission — the nucleus splits in two",
    "gamma": "γ emission — the nucleus sheds energy as a photon"
  };

  window.ElementPhysics = {
    C, phaseAt, speeds, thermalDeBroglie_pm, wienPeak_nm, stefan_W_m2,
    heating, parseHalfLifeSeconds, decayConstant, fractionRemaining, DECAY_LABEL
  };
})();
