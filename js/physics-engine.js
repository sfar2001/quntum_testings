/* ============================================================================
 *  PHYSICS-ENGINE.JS  —  the browser-side physics engine
 *  ----------------------------------------------------------------------------
 *  A faithful JavaScript port of the Java physics that the original project
 *  originally computed on a separate compute backend. Everything here is
 *  REAL numerical physics computed live in your browser — no server, no WASM:
 *
 *    schrodinger  finite-difference radial l=0 Coulomb eigensolve (QL / tql2)
 *    circuit      1–3 qubit state-vector simulator (gates, Bloch, entanglement)
 *    molecule     H₂ STO-3G integrals + 2-configuration full-CI
 *    wavepacket   time-dependent Schrödinger, split-step Fourier (radix-2 FFT)
 *    qec          repetition + surface-code logical-error / threshold model
 *    beam         photon– and particle–atom interaction (photoelectric, Compton,
 *                 excitation, Rutherford, nuclear contact)
 *    interaction  two-atom bonding (ionic / covalent / metallic / vdW)
 *    brain*       knowledge-graph analytics (hubs, bridges, shortest path)
 *
 *  Exposed as window.QuantumEngine and called by js/api-shim.js.
 *  Real numerical physics — field names kept stable across the whole app.
 * ========================================================================== */
window.QuantumEngine = (function () {
  "use strict";

  /* ===================== 0. constants & shared helpers ===================== */
  const C_LIGHT = 2.99792458e8;
  const M_E = 9.1093837015e-31;
  const E_CHG = 1.602176634e-19;
  const K_E = 8.9875517873681764e9;
  const H_PLANCK = 6.62607015e-34;
  const A0 = 5.29177210903e-11;         // Bohr radius (m)
  const RY_EV = 13.605693122994;        // Rydberg (eV)
  const J_PER_EV = 1.602176634e-19;
  const U_TO_KG = 1.66053906660e-27;
  const HARTREE_EV = 27.211386245988;
  const A0_PM = 52.9177210903;
  const BOHR_ANG = 0.52917721067;

  // significant-figure rounding — applied to (almost) every numeric field
  function sig(x, figs) {
    if (x === 0 || Number.isNaN(x) || !Number.isFinite(x)) return x;
    const d = Math.ceil(Math.log10(Math.abs(x)));
    const mag = Math.pow(10, figs - d);
    return Math.round(x * mag) / mag;
  }
  function sigSmall(x) { return x <= 0 ? 0 : sig(x, 4); }

  // compact human string used in verdict/steps text
  const SUP = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
  function supStr(n) { const neg = n < 0; let b = neg ? "⁻" : ""; for (const c of String(Math.abs(n))) b += SUP[c.charCodeAt(0) - 48]; return b; }
  function trimZeros(s) { if (s.indexOf(".") < 0) return s; let e = s.length; while (e > 0 && s[e - 1] === "0") e--; if (e > 0 && s[e - 1] === ".") e--; return s.slice(0, e); }
  function num(x) {
    if (typeof x !== "number") return String(x);
    if (x === 0) return "0";
    const a = Math.abs(x);
    if (a >= 1e-3 && a < 1e5) {
      const r = sig(x, 5);
      return Number.isInteger(r) ? String(Math.trunc(r)) : trimZeros(String(r));
    }
    let exp = Math.floor(Math.log10(a));
    let mant = x / Math.pow(10, exp);
    mant = Math.round(mant * 1000) / 1000;
    if (Math.abs(mant) >= 10) { mant /= 10; exp++; }
    return trimZeros(String(mant)) + "×10" + supStr(exp);
  }

  /* ---------- element metadata + Aufbau (hydrogen-like idealization) ---------- */
  const SUBSHELLS = ["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p", "5s", "4d", "5p", "6s",
    "4f", "5d", "6p", "7s", "5f", "6d", "7p", "8s", "5g", "6f", "7d", "8p"];
  function capacityOf(sub) { return { s: 2, p: 6, d: 10, f: 14, g: 18 }[sub[sub.length - 1]] || 0; }
  function aufbau(z) {
    const occ = new Array(SUBSHELLS.length).fill(0);
    let rem = z;
    for (let i = 0; i < SUBSHELLS.length && rem > 0; i++) { const put = Math.min(capacityOf(SUBSHELLS[i]), rem); occ[i] = put; rem -= put; }
    return occ;
  }
  function shellsOf(z) {
    const occ = aufbau(z), byN = {}; let maxN = 0;
    for (let i = 0; i < SUBSHELLS.length; i++) { if (!occ[i]) continue; const n = +SUBSHELLS[i][0]; byN[n] = (byN[n] || 0) + occ[i]; maxN = Math.max(maxN, n); }
    const shells = []; for (let n = 1; n <= maxN; n++) shells.push(byN[n] || 0); return shells;
  }
  function valenceElectrons(z) { const s = shellsOf(z); return s.length ? s[s.length - 1] : 0; }

  let _byZ = null;
  function elem(z) {
    if (!_byZ) { _byZ = {}; (window.PERIODIC_DATA || []).forEach(p => { _byZ[p.element.atomicNumber] = p.element; }); }
    return _byZ[z] || null;
  }
  function symbolOf(z) { const e = elem(z); return e ? e.symbol : ("Z" + z); }
  function categoryOf(z) { const e = elem(z); return e ? e.category : "Unknown"; }
  function massOf(z) { const e = elem(z); return e ? e.atomicMass : (2 * z); }
  const SHELL_LETTERS = "KLMNOPQ";
  function shellLetter(n) { return (n >= 1 && n <= 7) ? SHELL_LETTERS[n - 1] : ("n=" + n); }
  function energyLevels(z, nMax) { const out = []; for (let n = 1; n <= nMax; n++) out.push(sig(-RY_EV * z * z / (n * n), 5)); return out; }

  /* ===================== 1. Schrödinger (radial l=0) ===================== */
  // JAMA symmetric-tridiagonal QL (tql2) — eigenvalues in d[], eigenvectors in V.
  function tql2(d, e, V) {
    const n = d.length;
    for (let i = 1; i < n; i++) e[i - 1] = e[i];
    e[n - 1] = 0;
    let f = 0, tst1 = 0; const eps = Math.pow(2, -52);
    for (let l = 0; l < n; l++) {
      tst1 = Math.max(tst1, Math.abs(d[l]) + Math.abs(e[l]));
      let m = l;
      while (m < n) { if (Math.abs(e[m]) <= eps * tst1) break; m++; }
      if (m > l) {
        let iter = 0;
        do {
          iter++;
          let g = d[l];
          let p = (d[l + 1] - g) / (2 * e[l]);
          let r = Math.hypot(p, 1);
          if (p < 0) r = -r;
          d[l] = e[l] / (p + r);
          d[l + 1] = e[l] * (p + r);
          const dl1 = d[l + 1];
          let h = g - d[l];
          for (let i = l + 2; i < n; i++) d[i] -= h;
          f += h;
          p = d[m];
          let c = 1, c2 = c, c3 = c;
          const el1 = e[l + 1];
          let s = 0, s2 = 0;
          for (let i = m - 1; i >= l; i--) {
            c3 = c2; c2 = c; s2 = s;
            g = c * e[i];
            h = c * p;
            r = Math.hypot(p, e[i]);
            e[i + 1] = s * r;
            s = e[i] / r;
            c = p / r;
            p = c * d[i] - s * g;
            d[i + 1] = h + s * (c * g + s * d[i]);
            for (let k = 0; k < n; k++) {
              h = V[k][i + 1];
              V[k][i + 1] = s * V[k][i] + c * h;
              V[k][i] = c * V[k][i] - s * h;
            }
          }
          p = -s * s2 * c3 * el1 * e[l] / dl1;
          e[l] = s * p;
          d[l] = c * p;
        } while (Math.abs(e[l]) > eps * tst1 && iter < 50);
      }
      d[l] = d[l] + f;
      e[l] = 0;
    }
  }

  const _schCache = {};
  function schrodinger(z) {
    z = Math.max(1, Math.min(119, z | 0));
    if (_schCache[z]) return _schCache[z];
    const N = 500, SAMPLES = 64, numStates = 4;
    const rMax = 45.0 / z, dr = rMax / N;
    const kin = 1 / (dr * dr), off = -1 / (2 * dr * dr);
    const d = new Float64Array(N), e = new Float64Array(N);
    for (let i = 0; i < N; i++) { const r = (i + 1) * dr; d[i] = kin - z / r; e[i] = (i === 0) ? 0 : off; }
    // eigenvectors start as identity
    const V = new Array(N);
    for (let i = 0; i < N; i++) { const row = new Float64Array(N); row[i] = 1; V[i] = row; }
    tql2(d, e, V);
    // sort eigenvalue indices ascending
    const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => d[a] - d[b]);
    const stride = Math.max(1, Math.floor(N / SAMPLES));
    const states = [];
    for (let k = 0; k < numStates; k++) {
      const col = order[k], eH = d[col];
      if (eH >= 0) break; // bound states only
      const n = k + 1;
      const eNum = eH * HARTREE_EV;
      const eAna = -RY_EV * z * z / (n * n);
      const err = Math.abs((eNum - eAna) / eAna) * 100;
      const radialDensity = [];
      for (let i = 0; i < N; i += stride) {
        const u = V[i][col];
        radialDensity.push([sig((i + 1) * dr * A0_PM, 5), sig(u * u / dr, 4)]);
      }
      states.push({ n: n, l: 0, orbital: n + "s", energyNumeric_eV: sig(eNum, 6), energyAnalytic_eV: sig(eAna, 6), errorPercent: sig(err, 3), radialDensity: radialDensity });
    }
    const out = {
      atomicNumber: z,
      method: "finite-difference radial l=0 Coulomb, QL (tql2), 500 grid points, atomic units",
      radialMaxPm: sig(rMax * A0_PM, 5),
      gridPoints: N,
      states: states
    };
    _schCache[z] = out;
    return out;
  }

  /* ===================== 2. quantum circuit (1–3 qubits) ===================== */
  function circuit(n, ops, shots) {
    n = Math.max(1, Math.min(3, n | 0));
    shots = Math.max(0, Math.min(1000000, shots | 0));
    const dim = 1 << n;
    const re = new Float64Array(dim), im = new Float64Array(dim);
    re[0] = 1;
    const rawOps = String(ops || "");
    const tokens = rawOps.split(/[;,\s]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
    const normalized = [];
    const R2 = Math.sqrt(0.5);
    // complex 2x2 gates as [m00,m01,m10,m11], each [reIm]
    const cx = (a, b) => [a, b];
    const GATES = {
      H: [cx(R2, 0), cx(R2, 0), cx(R2, 0), cx(-R2, 0)],
      X: [cx(0, 0), cx(1, 0), cx(1, 0), cx(0, 0)],
      Y: [cx(0, 0), cx(0, -1), cx(0, 1), cx(0, 0)],
      Z: [cx(1, 0), cx(0, 0), cx(0, 0), cx(-1, 0)],
      S: [cx(1, 0), cx(0, 0), cx(0, 0), cx(0, 1)],
      T: [cx(1, 0), cx(0, 0), cx(0, 0), cx(R2, R2)]
    };
    function apply1(gate, q) {
      const bit = 1 << q;
      const m00 = gate[0], m01 = gate[1], m10 = gate[2], m11 = gate[3];
      for (let i = 0; i < dim; i++) {
        if (i & bit) continue;
        const i1 = i | bit;
        const a0r = re[i], a0i = im[i], a1r = re[i1], a1i = im[i1];
        re[i] = m00[0] * a0r - m00[1] * a0i + m01[0] * a1r - m01[1] * a1i;
        im[i] = m00[0] * a0i + m00[1] * a0r + m01[0] * a1i + m01[1] * a1r;
        re[i1] = m10[0] * a0r - m10[1] * a0i + m11[0] * a1r - m11[1] * a1i;
        im[i1] = m10[0] * a0i + m10[1] * a0r + m11[0] * a1i + m11[1] * a1r;
      }
    }
    function swapAmp(i, j) { const tr = re[i], ti = im[i]; re[i] = re[j]; im[i] = im[j]; re[j] = tr; im[j] = ti; }
    function probs() { const p = new Array(dim); for (let i = 0; i < dim; i++) p[i] = re[i] * re[i] + im[i] * im[i]; return p; }
    function ket(i) { let s = "|"; for (let q = n - 1; q >= 0; q--) s += ((i >> q) & 1); return s + "⟩"; }

    const trajectory = [{ step: 0, gate: "init", probs: probs().map(x => sig(x, 4)) }];
    tokens.forEach((tok, ti) => {
      const mm = tok.match(/^([A-Z]+)([\d-]*)$/);
      if (!mm) return;
      const g = mm[1], idx = (mm[2] || "").split("-").filter(x => x !== "").map(Number);
      let ok = false;
      if (GATES[g] && idx.length >= 1 && idx[0] < n) { apply1(GATES[g], idx[0]); ok = true; }
      else if ((g === "CX" || g === "CNOT") && idx.length >= 2 && idx[0] < n && idx[1] < n && idx[0] !== idx[1]) {
        const bc = 1 << idx[0], bt = 1 << idx[1];
        for (let i = 0; i < dim; i++) if ((i & bc) && !(i & bt)) swapAmp(i, i | bt); ok = true;
      }
      else if (g === "CZ" && idx.length >= 2 && idx[0] < n && idx[1] < n) {
        const bc = 1 << idx[0], bt = 1 << idx[1];
        for (let i = 0; i < dim; i++) if ((i & bc) && (i & bt)) { re[i] = -re[i]; im[i] = -im[i]; } ok = true;
      }
      else if ((g === "SW" || g === "SWAP") && idx.length >= 2 && idx[0] < n && idx[1] < n && idx[0] !== idx[1]) {
        const ba = 1 << idx[0], bb = 1 << idx[1];
        for (let i = 0; i < dim; i++) if ((i & ba) && !(i & bb)) swapAmp(i, i ^ ba ^ bb); ok = true;
      }
      else if ((g === "CCX" || g === "TOFF" || g === "CCNOT") && idx.length >= 3 && idx.every(x => x < n)) {
        const b1 = 1 << idx[0], b2 = 1 << idx[1], bt = 1 << idx[2];
        for (let i = 0; i < dim; i++) if ((i & b1) && (i & b2) && !(i & bt)) swapAmp(i, i | bt); ok = true;
      }
      if (ok) { normalized.push(tok); trajectory.push({ step: normalized.length, gate: tok, probs: probs().map(x => sig(x, 4)) }); }
    });

    const stateVector = [];
    for (let i = 0; i < dim; i++) stateVector.push({ basis: ket(i), re: sig(re[i], 4), im: sig(im[i], 4), prob: sig(re[i] * re[i] + im[i] * im[i], 4) });

    const qubits = [];
    let anyEnt = false;
    for (let q = 0; q < n; q++) {
      const bit = 1 << q;
      let r00 = 0, r11 = 0, r01re = 0, r01im = 0;
      for (let i = 0; i < dim; i++) {
        if (i & bit) continue;
        const i1 = i | bit;
        const a0r = re[i], a0i = im[i], a1r = re[i1], a1i = im[i1];
        r00 += a0r * a0r + a0i * a0i;
        r11 += a1r * a1r + a1i * a1i;
        r01re += a0r * a1r + a0i * a1i;
        r01im += a0i * a1r - a0r * a1i;
      }
      const sx = 2 * r01re, sy = -2 * r01im, sz = r00 - r11;
      const purity = r00 * r00 + r11 * r11 + 2 * (r01re * r01re + r01im * r01im);
      const ent = purity < 0.999;
      if (ent) anyEnt = true;
      qubits.push({ index: q, p0: sig(r00, 4), p1: sig(r11, 4), sx: sig(sx, 4), sy: sig(sy, 4), sz: sig(sz, 4), purity: sig(purity, 4), entangled: ent });
    }

    // measurement histogram — sampled (Born rule)
    let histogram = [];
    if (shots > 0) {
      const p = probs();
      const cum = new Array(dim); let acc = 0;
      for (let i = 0; i < dim; i++) { acc += p[i]; cum[i] = acc; }
      const counts = new Array(dim).fill(0);
      for (let s = 0; s < shots; s++) {
        const u = Math.random() * (acc || 1);
        let pick = dim - 1;
        for (let i = 0; i < dim; i++) if (cum[i] >= u) { pick = i; break; }
        counts[pick]++;
      }
      for (let i = 0; i < dim; i++) if (counts[i] > 0) histogram.push({ basis: ket(i), count: counts[i], freq: sig(counts[i] / shots, 4) });
    }

    const note = anyEnt
      ? "measuring one qubit instantly conditions the others — this is a genuine non-product (entangled) state, purity Tr(ρ²) < 1."
      : "each qubit is in a definite pure state; the joint state factorizes as a product |a⟩⊗|b⟩…";

    return {
      numQubits: n, gates: normalized.join(" "), shots: shots,
      stateVector: stateVector, qubits: qubits, entangled: anyEnt,
      histogram: histogram, trajectory: trajectory, note: note
    };
  }

  /* ===================== 3. H₂ molecule (STO-3G + 2-config CI) ===================== */
  const H2 = (function () {
    const D = [0.15432897, 0.53532814, 0.44463454];
    const A0exp = [3.42525091, 0.62391373, 0.16885540];
    const ZETA2 = 1.0;
    const ALPHA = A0exp.map(a => a * ZETA2);
    const cprim = ALPHA.map((a, i) => D[i] * Math.pow(2 * a / Math.PI, 0.75));
    let s = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += cprim[i] * cprim[j] * sPrim(ALPHA[i], ALPHA[j], 0);
    const COEF = cprim.map(c => c / Math.sqrt(s));

    function erf(x) {
      const t = 1 / (1 + 0.3275911 * Math.abs(x));
      const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
      return x < 0 ? -y : y;
    }
    function boysF0(t) { return t < 1e-12 ? 1.0 : 0.5 * Math.sqrt(Math.PI / t) * erf(Math.sqrt(t)); }
    function sPrim(a, b, R2) { const p = a + b; return Math.pow(Math.PI / p, 1.5) * Math.exp(-a * b / p * R2); }
    function kPrim(a, b, R2) { const p = a + b, mu = a * b / p; return mu * (3 - 2 * mu * R2) * sPrim(a, b, R2); }
    function vPrim(a, b, zA, zB, zC) { const p = a + b, Pz = (a * zA + b * zB) / p, R2 = (zA - zB) * (zA - zB), PC2 = (Pz - zC) * (Pz - zC); return -2 * Math.PI / p * Math.exp(-a * b / p * R2) * boysF0(p * PC2); }
    function eriPrim(a, b, c, dd, zA, zB, zC, zD) {
      const p = a + b, q = c + dd, Pz = (a * zA + b * zB) / p, Qz = (c * zC + dd * zD) / q;
      const Rab2 = (zA - zB) * (zA - zB), Rcd2 = (zC - zD) * (zC - zD), PQ2 = (Pz - Qz) * (Pz - Qz);
      return 2 * Math.pow(Math.PI, 2.5) / (p * q * Math.sqrt(p + q)) * Math.exp(-a * b / p * Rab2) * Math.exp(-c * dd / q * Rcd2) * boysF0(p * q / (p + q) * PQ2);
    }
    function aoS(zI, zJ) { let v = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += COEF[i] * COEF[j] * sPrim(ALPHA[i], ALPHA[j], (zI - zJ) * (zI - zJ)); return v; }
    function aoH(zI, zJ, R) { let v = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const R2 = (zI - zJ) * (zI - zJ); v += COEF[i] * COEF[j] * (kPrim(ALPHA[i], ALPHA[j], R2) + vPrim(ALPHA[i], ALPHA[j], zI, zJ, 0) + vPrim(ALPHA[i], ALPHA[j], zI, zJ, R)); } return v; }
    function aoERI(zI, zJ, zK, zL) { let v = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) v += COEF[i] * COEF[j] * COEF[k] * COEF[l] * eriPrim(ALPHA[i], ALPHA[j], ALPHA[k], ALPHA[l], zI, zJ, zK, zL); return v; }

    function ciAt(R) {
      const zc = [0, R];
      const Sab = aoS(0, R), hAA = aoH(0, 0, R), hAB = aoH(0, R, R);
      const eri = [[[[0, 0], [0, 0]], [[0, 0], [0, 0]]], [[[0, 0], [0, 0]], [[0, 0], [0, 0]]]];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) for (let l = 0; l < 2; l++) eri[i][j][k][l] = aoERI(zc[i], zc[j], zc[k], zc[l]);
      const Ng = Math.sqrt(2 * (1 + Sab)), Nu = Math.sqrt(2 * (1 - Sab));
      const Cc = [[1 / Ng, 1 / Nu], [1 / Ng, -1 / Nu]];
      const hao = [[hAA, hAB], [hAB, hAA]];
      let hgg = 0, huu = 0;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { hgg += Cc[i][0] * Cc[j][0] * hao[i][j]; huu += Cc[i][1] * Cc[j][1] * hao[i][j]; }
      let gggg = 0, uuuu = 0, gugu = 0;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) for (let l = 0; l < 2; l++) {
        gggg += Cc[i][0] * Cc[j][0] * Cc[k][0] * Cc[l][0] * eri[i][j][k][l];
        uuuu += Cc[i][1] * Cc[j][1] * Cc[k][1] * Cc[l][1] * eri[i][j][k][l];
        gugu += Cc[i][0] * Cc[j][1] * Cc[k][0] * Cc[l][1] * eri[i][j][k][l];
      }
      const Egg = 2 * hgg + gggg, Euu = 2 * huu + uuuu, K = gugu;
      return { Sab, Egg, Euu, K };
    }
    function totalEnergy(R) { const { Egg, Euu, K } = ciAt(R); const avg = (Egg + Euu) / 2, dif = (Egg - Euu) / 2; return avg - Math.sqrt(dif * dif + K * K) + 1 / R; }
    function hAtomEnergy() { let v = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += COEF[i] * COEF[j] * (kPrim(ALPHA[i], ALPHA[j], 0) + vPrim(ALPHA[i], ALPHA[j], 0, 0, 0)); return v; }
    return { ciAt, totalEnergy, hAtomEnergy };
  })();

  let _molCache = null;
  function molecule() {
    if (_molCache) return _molCache;
    const curve = []; let bestR = 0.4, bestE = Infinity, dissoc = 0;
    for (let k = 0; k <= 90; k++) {
      const R = 0.4 + k * (8.0 - 0.4) / 90;
      const E = H2.totalEnergy(R);
      curve.push([sig(R * BOHR_ANG, 4), sig(E, 6)]);
      if (E < bestE) { bestE = E; bestR = R; }
      dissoc = E;
    }
    const dissocEv = (dissoc - bestE) * HARTREE_EV;
    const { Sab, Egg, Euu, K } = H2.ciAt(bestR);
    const avg = (Egg + Euu) / 2, dif = (Egg - Euu) / 2, root = Math.sqrt(dif * dif + K * K);
    const eG = avg - root, eE = avg + root;
    const x = K, y = eG - Egg, nrm = Math.hypot(x, y);
    const cg = nrm ? x / nrm : 1, cu = nrm ? y / nrm : 0;
    _molCache = {
      molecule: "H₂",
      basis: "STO-3G, 2-configuration full-CI in σ_g/σ_u",
      curve: curve,
      equilibrium: {
        bondLength_angstrom: sig(bestR * BOHR_ANG, 4),
        bondLength_bohr: sig(bestR, 4),
        energy_hartree: sig(bestE, 6),
        energy_eV: sig(bestE * HARTREE_EV, 6),
        dissociationEnergy_eV: sig(dissocEv, 4)
      },
      detail: {
        bondLength_angstrom: sig(bestR * BOHR_ANG, 4),
        overlap_S_AB: sig(Sab, 4),
        ciMatrix_hartree: [[sig(Egg, 6), sig(K, 6)], [sig(K, 6), sig(Euu, 6)]],
        groundElectronic_hartree: sig(eG, 6),
        excitedSinglet_hartree: sig(eE, 6),
        groundTotal_hartree: sig(eG + 1 / bestR, 6),
        bondingConfigWeightPercent: sig(cg * cg * 100, 4),
        antibondingConfigWeightPercent: sig(cu * cu * 100, 4),
        effectiveQubitHamiltonian: { cI: sig(avg, 6), cZ: sig(dif, 6), cX: sig(K, 6) },
        isolatedHAtom_hartree: sig(H2.hAtomEnergy(), 6)
      }
    };
    return _molCache;
  }

  /* ===================== 4. wave packet (split-step Fourier) ===================== */
  // iterative radix-2 FFT; sign=-1 forward, +1 inverse (caller divides by N)
  function fft(re, im, sign) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = sign * 2 * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  function wavepacket(potential, k0, x0, sigma) {
    potential = String(potential || "free").toLowerCase();
    k0 = (k0 === undefined || Number.isNaN(k0)) ? 3 : k0;
    x0 = (x0 === undefined || Number.isNaN(x0)) ? -8 : x0;
    sigma = (sigma === undefined || Number.isNaN(sigma)) ? 1 : sigma;
    const N = 256, L = 20.0, DT = 0.01, STEPS = 400, FRAMES = 40, XSAMPLES = 96;
    const dx = 2 * L / N;
    const soliton = potential === "soliton";
    const omega = 1, barrierV = 8, barrierW = 1, g = soliton ? -1 : 0;
    const x = new Float64Array(N), V = new Float64Array(N), kk = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      x[j] = -L + j * dx;
      if (potential === "harmonic") V[j] = 0.5 * omega * omega * x[j] * x[j];
      else if (potential === "barrier") V[j] = Math.abs(x[j]) < barrierW ? barrierV : 0;
      else V[j] = 0;
      const mm = j < N / 2 ? j : j - N;
      kk[j] = 2 * Math.PI * mm / (N * dx);
    }
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      const env = soliton ? 1 / Math.cosh(x[j] - x0) : Math.exp(-(x[j] - x0) * (x[j] - x0) / (2 * sigma * sigma));
      const ph = k0 * (x[j] - x0);
      re[j] = env * Math.cos(ph); im[j] = env * Math.sin(ph);
    }
    function norm() { let s = 0; for (let j = 0; j < N; j++) s += (re[j] * re[j] + im[j] * im[j]) * dx; return s; }
    if (!soliton) { const s = Math.sqrt(norm()); for (let j = 0; j < N; j++) { re[j] /= s; im[j] /= s; } }
    const normInitial = norm();

    const stride = Math.max(1, Math.floor(N / XSAMPLES));
    const xs = []; for (let j = 0; j < N; j += stride) xs.push(sig(x[j], 4));
    const frames = [], times = [];
    function snap(t) { const f = []; for (let j = 0; j < N; j += stride) f.push(sig(re[j] * re[j] + im[j] * im[j], 4)); frames.push(f); times.push(sig(t, 4)); }
    const every = Math.max(1, Math.floor(STEPS / FRAMES));
    snap(0);
    function halfPot() {
      for (let j = 0; j < N; j++) {
        const ph = -(V[j] + g * (re[j] * re[j] + im[j] * im[j])) * DT / 2;
        const cs = Math.cos(ph), sn = Math.sin(ph);
        const nr = re[j] * cs - im[j] * sn, ni = re[j] * sn + im[j] * cs;
        re[j] = nr; im[j] = ni;
      }
    }
    for (let s = 1; s <= STEPS; s++) {
      halfPot();
      fft(re, im, -1);
      for (let j = 0; j < N; j++) {
        const ph = -0.5 * kk[j] * kk[j] * DT;
        const cs = Math.cos(ph), sn = Math.sin(ph);
        const nr = re[j] * cs - im[j] * sn, ni = re[j] * sn + im[j] * cs;
        re[j] = nr; im[j] = ni;
      }
      fft(re, im, 1);
      for (let j = 0; j < N; j++) { re[j] /= N; im[j] /= N; }
      halfPot();
      if (s % every === 0) snap(s * DT);
    }
    const normFinal = norm();
    const NOTE = {
      free: "Free particle: the packet drifts at group velocity k₀ and spreads over time.",
      harmonic: "Harmonic trap ½ω²x²: the packet oscillates and breathes (coherent state).",
      barrier: "Potential barrier: watch partial reflection and quantum tunnelling.",
      soliton: "Bright soliton (focusing nonlinearity g<0, sech profile): translates without spreading."
    };
    const params = { gridPoints: N, domain: "[-20, 20]", dt: DT, steps: STEPS, k0: k0, x0: x0, sigma: sigma };
    if (soliton) params.nonlinearity_g = -1;
    return { potential: potential, x: xs, times: times, frames: frames, normInitial: sig(normInitial, 5), normFinal: sig(normFinal, 5), params: params, note: NOTE[potential] || NOTE.free };
  }

  /* ===================== 5. quantum error correction ===================== */
  function binom(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    k = Math.min(k, n - k);
    let c = 1;
    for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1);
    return c;
  }
  function repExact(d, p) { const fail = Math.floor(d / 2) + 1; let s = 0; for (let k = fail; k <= d; k++) s += binom(d, k) * Math.pow(p, k) * Math.pow(1 - p, d - k); return s; }
  function repMonteCarlo(d, p, shots) {
    shots = Math.min(shots, 200000);
    if (shots <= 0) return null;
    const majority = Math.floor(d / 2); let fails = 0;
    for (let t = 0; t < shots; t++) { let flips = 0; for (let q = 0; q < d; q++) if (Math.random() < p) flips++; if (flips > majority) fails++; }
    return fails / shots;
  }
  function surfaceScaling(d, p) { const t = Math.floor((d + 1) / 2); return Math.min(0.75, 0.5 * Math.pow(p / 0.11, t)); }

  function qec(code, p, distances, shots) {
    const surface = code === "surface";
    const pth = surface ? 0.11 : 0.5;
    p = Math.max(0, Math.min(1, p));
    shots = Math.max(0, Math.min(2000000, shots | 0));
    let dists = String(distances || "3,5,7").split(/[,\s]+/).map(Number).filter(x => Number.isInteger(x) && x >= 1 && x <= 25);
    if (!dists.length) dists = [3, 5, 7];
    const plByDist = [];
    const perDistance = dists.map(d => {
      const exact = surface ? surfaceScaling(d, p) : repExact(d, p);
      plByDist.push(exact);
      const rec = { distance: d, physicalQubits: surface ? d * d : d, logicalErrorExact: sigSmall(exact) };
      if (!surface && shots > 0) rec.logicalErrorMonteCarlo = sigSmall(repMonteCarlo(d, p, shots));
      rec.method = surface
        ? "sub-threshold scaling model (a·(p/p_th)^⌈d/2⌉, p_th≈0.11)"
        : "exact binomial + Monte-Carlo majority vote";
      return rec;
    });
    const lambda = [];
    for (let i = 0; i < dists.length - 1; i++) {
      const lam = plByDist[i + 1] > 0 ? plByDist[i] / plByDist[i + 1] : Infinity;
      lambda.push({ fromDistance: dists[i], toDistance: dists[i + 1], suppressionFactor: Number.isFinite(lam) ? sig(lam, 4) : null });
    }
    const pMax = Math.min(0.99, pth * 1.4);
    const curve = [];
    for (let k = 0; k <= 60; k++) {
      const pp = 1e-4 + k * (pMax - 1e-4) / 60;
      const logical = dists.map(d => sigSmall(surface ? surfaceScaling(d, pp) : repExact(d, pp)));
      curve.push({ p: sig(pp, 4), logical: logical });
    }
    const below = p < pth;
    const verdict = below
      ? "p = " + num(p) + " is BELOW the threshold " + num(pth) + " → adding qubits (larger distance) SUPPRESSES the logical error (Λ > 1). This is the regime fault tolerance needs."
      : "p = " + num(p) + " is ABOVE the threshold " + num(pth) + " → larger codes make things WORSE (Λ < 1). Error correction cannot help here.";
    const note = surface
      ? "Surface-code curve uses the standard sub-threshold SCALING model (not a full matching-decoder simulation)."
      : "Repetition (bit-flip) code: logical error computed EXACTLY (binomial) and cross-checked by Monte-Carlo majority-vote decoding.";
    return {
      code: surface ? "surface" : "repetition",
      physicalErrorRate: sig(p, 4), threshold: pth, belowThreshold: below,
      shots: surface ? 0 : shots, perDistance: perDistance, lambda: lambda, curve: curve,
      verdict: verdict, note: note
    };
  }

  /* ===================== 6+7. beam (photon & particle) ===================== */
  function afterStateOf(z, n, ejected, toShell, energyAbsorbedEv) {
    const before = shellsOf(z), after = before.slice();
    const electronsBefore = before.reduce((a, b) => a + b, 0);
    let charge = 0, changed = false, willRelax = false, stateLabel, note;
    const sym = symbolOf(z), sl = shellLetter(n);
    if (ejected) {
      const idx = Math.min(n, after.length) - 1;
      if (after[idx] > 0) after[idx]--;
      charge = 1; changed = true; willRelax = true;
      stateLabel = sym + "⁺ (ionized)";
      note = "Lost one electron from the " + sl + " shell → cation. It relaxes by X-ray fluorescence or Auger emission.";
    } else if (toShell != null) {
      const fromIdx = Math.min(n, after.length) - 1;
      if (after[fromIdx] > 0) after[fromIdx]--;
      while (after.length < toShell) after.push(0);
      after[toShell - 1]++;
      changed = true; willRelax = true;
      stateLabel = sym + "* (excited)";
      note = "Electron promoted n=" + n + "→" + toShell + "; the atom will relax and re-emit a photon.";
    } else {
      stateLabel = sym + " (unchanged)";
      note = "No net change — the interaction was elastic.";
    }
    const electronsAfter = after.reduce((a, b) => a + b, 0);
    return {
      changed: changed, chargeAfter: charge, stateLabel: stateLabel,
      electronsBefore: electronsBefore, electronsAfter: electronsAfter,
      shellOccupancyBefore: before, shellOccupancyAfter: after,
      energyAbsorbed_eV: sig(energyAbsorbedEv || 0, 5), willRelax: willRelax, note: note
    };
  }

  function band(nm) {
    return nm < 0.01 ? "gamma" : nm < 10 ? "X-ray" : nm < 380 ? "ultraviolet" : nm < 750 ? "visible" : nm < 1e6 ? "infrared" : nm < 1e9 ? "microwave" : "radio";
  }

  function beamLight(z, shell, angle, wavelengthPm) {
    const COMPTON_M = H_PLANCK / (M_E * C_LIGHT);
    const shells = shellsOf(z), nMax = Math.max(1, shells.length), n = Math.max(1, Math.min(nMax, shell | 0));
    const lambdaM = Math.max(1e-18, wavelengthPm * 1e-12);
    const photonJ = H_PLANCK * C_LIGHT / lambdaM, photonEv = photonJ / J_PER_EV, lambdaNm = wavelengthPm * 1e-3;
    const bnd = band(lambdaNm), sl = shellLetter(n), sym = symbolOf(z);
    const binding = RY_EV * z * z / (n * n);
    const theta = angle * Math.PI / 180;
    const shiftM = COMPTON_M * (1 - Math.cos(theta)), shiftPm = shiftM * 1e12;
    const lambdaPrimeM = lambdaM + shiftM, ePrimeEv = (H_PLANCK * C_LIGHT / lambdaPrimeM) / J_PER_EV;
    const recoilEv = photonEv - ePrimeEv, thomson = (1 + Math.cos(theta) * Math.cos(theta)) / 2;
    let matchedM = 0, matchedDe = 0;
    for (let m = n + 1; m <= n + 8; m++) { const de = RY_EV * z * z * (1 / (n * n) - 1 / (m * m)); if (de > 0 && Math.abs(photonEv - de) / de < 0.02) { matchedM = m; matchedDe = de; break; } }

    const details = { comptonShift_pm: sig(shiftPm, 4), thomsonAngularFactor: sig(thomson, 4) };
    const steps = [
      { label: "Photon energy  E = hc/λ", value: num(photonEv) + " eV  (" + bnd + ")" },
      { label: "Target binding  Bₙ = 13.6·Z²/n²", value: num(binding) + " eV  (" + sl + " shell, Z=" + z + ")" }
    ];
    let outcome, verdict, toShell = null, ejected = false, energyAbsorbed = 0;
    if (photonEv >= binding) {
      outcome = "photoionization"; ejected = true; energyAbsorbed = binding;
      const ke = photonEv - binding;
      details.photoelectronKE_eV = sig(ke, 5); details.ejectedFromShell = n; details.bindingEnergy_eV = sig(binding, 5);
      steps.push({ label: "E ≥ Bₙ → photoionization", value: "photoelectron KE = E − Bₙ = " + num(ke) + " eV" });
      verdict = sym + ": the photon (" + num(photonEv) + " eV) exceeds the " + sl + "-shell binding (" + num(binding) + " eV) → electron ejected (photoionization).";
    } else if (matchedM > 0) {
      outcome = "excitation"; toShell = matchedM; energyAbsorbed = matchedDe;
      details.transition = "n=" + n + "→" + matchedM; details.transitionEnergy_eV = sig(matchedDe, 5); details.toShell = matchedM;
      steps.push({ label: "Resonant match n=" + n + "→" + matchedM, value: "ΔE = " + num(matchedDe) + " eV absorbed" });
      verdict = sym + ": the photon resonantly matches the n=" + n + "→" + matchedM + " transition (" + num(matchedDe) + " eV) → electron excited.";
    } else if (shiftPm / wavelengthPm > 1e-3) {
      outcome = "compton-scattering";
      if (recoilEv >= binding) { ejected = true; energyAbsorbed = binding; }
      details.scatteredWavelength_pm = sig(wavelengthPm + shiftPm, 5); details.scatteredEnergy_eV = sig(ePrimeEv, 5); details.electronRecoilKE_eV = sig(recoilEv, 5);
      steps.push({ label: "Compton shift  Δλ = (h/mₑc)(1−cosθ)", value: num(shiftPm) + " pm" });
      steps.push({ label: "Scattered photon", value: num(ePrimeEv) + " eV, electron recoil " + num(recoilEv) + " eV" });
      verdict = sym + ": high-energy photon Compton-scatters off the " + sl + " electron (Δλ=" + num(shiftPm) + " pm)" + (ejected ? " and knocks it free." : ".");
    } else {
      outcome = "elastic-scattering";
      details.scatteredWavelength_pm = sig(wavelengthPm, 5); details.energyTransfer_eV = 0;
      steps.push({ label: "E < Bₙ, Δλ negligible", value: "elastic (Thomson / Rayleigh) scattering" });
      verdict = sym + ": the photon energy (" + num(photonEv) + " eV) is below the " + sl + " binding → elastic scattering, atom unchanged.";
    }
    return {
      beamType: "light", atomicNumber: z, symbol: sym, angleDeg: sig(angle, 4),
      targetShell: n, shellLabel: sl, targetBinding_eV: sig(binding, 5),
      wavelengthPm: sig(wavelengthPm, 6), wavelengthNm: sig(lambdaNm, 6),
      photonEnergy_eV: sig(photonEv, 5), band: bnd,
      projectileZ: null, projectileSymbol: null, projectileEnergy_eV: null,
      outcome: outcome, verdict: verdict, details: details,
      energyLevels_eV: energyLevels(z, nMax),
      fromShell: n, toShell: toShell, ejected: ejected,
      steps: steps, afterState: afterStateOf(z, n, ejected, toShell, energyAbsorbed)
    };
  }

  function beamMaterial(z, projZ, keEv, angle, shell) {
    const R_NUCLEON_M = 1.2e-15, BARN_M2 = 1e-28;
    const shells = shellsOf(z), nMax = Math.max(1, shells.length), n = Math.max(1, Math.min(nMax, shell | 0));
    const sl = shellLetter(n), sym = symbolOf(z), projSym = symbolOf(projZ);
    const eJ = Math.max(1e-30, keEv * J_PER_EV);
    const m1 = massOf(projZ) * U_TO_KG, m2 = massOf(z) * U_TO_KG;
    const d0 = K_E * projZ * z * E_CHG * E_CHG / eJ;
    const rn = n * n * A0 / z;
    const rNuc = R_NUCLEON_M * (Math.cbrt(Math.max(1, Math.round(massOf(projZ)))) + Math.cbrt(Math.max(1, Math.round(massOf(z)))));
    const theta = Math.max(0.1, Math.min(179.9, angle)) * Math.PI / 180, half = theta / 2;
    const b = (d0 / 2) / Math.tan(half);
    const rMin = (d0 / 2) * (1 + 1 / Math.sin(half));
    const dSigma = Math.pow(d0 / 4, 2) / Math.pow(Math.sin(half), 4);
    const tMax = 4 * m1 * m2 / Math.pow(m1 + m2, 2) * keEv;
    const binding = RY_EV * z * z / (n * n);

    let outcome, verdict, ejected = false, absorbed = 0;
    if (d0 <= rNuc) { outcome = "nuclear-contact"; verdict = projSym + "→" + sym + ": at " + num(keEv) + " eV the projectile reaches the nucleus (d₀ ≤ nuclear radius) → nuclear contact."; }
    else if (d0 < rn) { outcome = "ionization"; ejected = true; absorbed = binding; verdict = projSym + "→" + sym + ": closest approach penetrates the " + sl + " (n=" + n + ") shell → electron ejected (ionization)."; }
    else { outcome = "rutherford-scattering"; verdict = projSym + "→" + sym + ": Coulomb repulsion deflects the projectile by " + num(angle) + "° (Rutherford scattering)."; }

    const details = {
      closestApproachHeadOn_pm: sig(d0 * 1e12, 4),
      targetShellRadius_pm: sig(rn * 1e12, 4),
      impactParameter_pm: sig(b * 1e12, 4),
      closestApproachAtAngle_pm: sig(rMin * 1e12, 4),
      rutherfordCrossSection_barn_per_sr: sig(dSigma / BARN_M2, 4),
      maxRecoilEnergy_eV: sig(tMax, 5),
      nuclearContactDistance_fm: sig(rNuc * 1e15, 4)
    };
    const steps = [
      { label: "Beam", value: projSym + " (" + num(keEv) + " eV) → " + sym },
      { label: "Closest approach  d₀ = kZ₁Z₂e²/E", value: num(d0 * 1e12) + " pm" },
      { label: "Target shell radius  rₙ = n²a₀/Z", value: num(rn * 1e12) + " pm" }
    ];
    if (outcome === "nuclear-contact") steps.push({ label: "d₀ ≤ nuclear radius", value: num(rNuc * 1e15) + " fm → contact" });
    else if (outcome === "ionization") steps.push({ label: "d₀ < rₙ", value: "penetrates the shell → ionization" });
    else steps.push({ label: "Rutherford dσ/dΩ = (d₀/4)²/sin⁴(θ/2)", value: num(dSigma / BARN_M2) + " barn/sr at " + num(angle) + "°" });

    return {
      beamType: "material", atomicNumber: z, symbol: sym, angleDeg: sig(angle, 4),
      targetShell: n, shellLabel: sl, targetBinding_eV: sig(binding, 5),
      wavelengthPm: null, wavelengthNm: null, photonEnergy_eV: null, band: null,
      projectileZ: projZ, projectileSymbol: projSym, projectileEnergy_eV: sig(keEv, 6),
      outcome: outcome, verdict: verdict, details: details,
      energyLevels_eV: energyLevels(z, nMax),
      fromShell: n, toShell: null, ejected: ejected,
      steps: steps, afterState: afterStateOf(z, n, ejected, null, absorbed)
    };
  }

  function beam(q) {
    const type = (q.type || "light").toLowerCase();
    const z = q.z | 0;
    if (!(z >= 1 && z <= 119)) return { error: "need target z (1-119)" };
    const angle = q.angle !== undefined ? parseFloat(q.angle) : (type === "material" ? 30 : 90);
    const shell = q.shell !== undefined ? (parseFloat(q.shell) | 0) : 1;
    if (type === "material") {
      const projZ = q.projectile | 0;
      if (!(projZ >= 1 && projZ <= 119)) return { error: "unknown target or projectile element" };
      let keEv = null;
      if (q.energy_eV !== undefined) keEv = parseFloat(q.energy_eV);
      else if (q.energy_keV !== undefined) keEv = parseFloat(q.energy_keV) * 1e3;
      else if (q.energy_MeV !== undefined) keEv = parseFloat(q.energy_MeV) * 1e6;
      if (!(keEv > 0)) return { error: "need energy > 0" };
      return beamMaterial(z, projZ, keEv, angle, shell);
    }
    let wavelengthPm = null;
    if (q.wavelength_pm !== undefined) wavelengthPm = parseFloat(q.wavelength_pm);
    else if (q.wavelength_nm !== undefined) wavelengthPm = parseFloat(q.wavelength_nm) * 1000;
    if (!(wavelengthPm > 0)) return { error: "need wavelength > 0" };
    return beamLight(z, shell, angle, wavelengthPm);
  }

  /* ===================== 8. two-atom interaction ===================== */
  function interaction(z1, z2, distancePm) {
    const s1 = symbolOf(z1), s2 = symbolOf(z2), c1 = categoryOf(z1), c2 = categoryOf(z2);
    const val1 = valenceElectrons(z1), val2 = valenceElectrons(z2);
    const r = Math.max(1e-13, distancePm * 1e-12);
    const coulombJ = K_E * z1 * z2 * E_CHG * E_CHG / r, coulombEv = coulombJ / J_PER_EV;
    const forceN = K_E * z1 * z2 * E_CHG * E_CHG / (r * r);
    const classical = {
      separation_pm: sig(distancePm, 4),
      nuclearCoulombRepulsion_eV: sig(coulombEv, 4),
      force_nN: sig(forceN * 1e9, 4),
      note: "bare-nucleus Coulomb repulsion (screened by the electron clouds in real neutral atoms)"
    };
    const METALS = ["Alkali metal", "Alkaline earth metal", "Transition metal", "Post-transition metal", "Lanthanide", "Actinide"];
    const isMetal = c => METALS.indexOf(c) >= 0, isNonmetal = c => c === "Reactive nonmetal", isNoble = c => c === "Noble gas";
    const m1 = isMetal(c1), m2 = isMetal(c2), n1 = isNonmetal(c1), n2 = isNonmetal(c2);
    const quantum = { valence1: val1, valence2: val2 };
    let bondType, reason;
    if (isNoble(c1) || isNoble(c2)) {
      bondType = "van der Waals";
      reason = "a noble gas keeps its full shell, so only weak van der Waals attraction — no chemical bond.";
    } else if ((m1 && n2) || (m2 && n1)) {
      bondType = "ionic";
      const transferred = m1 ? val1 : val2;
      quantum.electronsTransferred = transferred;
      quantum.predictedSpecies = s1 + s2;
      reason = "a metal donates " + transferred + " electron(s) to the nonmetal → oppositely charged ions attract (ionic bond).";
    } else if (n1 && n2) {
      bondType = "covalent";
      quantum.electronsShared = Math.min(8 - val1, val2) + Math.min(8 - val2, val1);
      if (z1 === z2) quantum.predictedSpecies = s1 + "₂";
      reason = "two nonmetals share electron pairs → covalent bond.";
    } else if (m1 && m2) {
      bondType = "metallic";
      reason = "two metals pool their valence electrons into a shared sea → metallic bonding.";
    } else {
      bondType = "polar / covalent";
      reason = "a metalloid pairing → intermediate polar-covalent character.";
    }
    quantum.bondReason = reason;
    if (z1 === 1 && z2 === 1) quantum.reference = "H₂: equilibrium bond length ≈ 0.74 Å, binding ≈ 4.5 eV — see Quantum solver → H₂ curve.";
    return {
      z1: z1, symbol1: s1, z2: z2, symbol2: s2, distancePm: sig(distancePm, 4),
      classical: classical, quantum: quantum, bondType: bondType,
      verdict: s1 + " + " + s2 + " → " + bondType + " — " + reason
    };
  }

  /* ===================== knowledge-graph analytics ===================== */
  function graph() {
    const KN = window.KNOWLEDGE;
    if (!KN || !KN.nodes) return null;
    const adj = {};
    KN.nodes.forEach(nd => { adj[nd.id] = adj[nd.id] || new Set(); (nd.related || []).forEach(t => { if (KN.byId[t]) { adj[nd.id].add(t); adj[t] = adj[t] || new Set(); adj[t].add(nd.id); } }); });
    let edges = 0; for (const id in adj) edges += adj[id].size; edges /= 2;
    const domains = {}; KN.nodes.forEach(nd => { domains[nd.domain] = true; });
    return { KN: KN, adj: adj, edgeCount: Math.round(edges), domainCount: Object.keys(domains).length };
  }
  function brainStatus() {
    const G = graph(); if (!G) return { nodeCount: 0, edgeCount: 0, domainCount: 0, workers: 0 };
    return { nodeCount: G.KN.nodes.length, edgeCount: G.edgeCount, domainCount: G.domainCount, workers: (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 8 };
  }
  function brainStats() {
    const G = graph(); if (!G) return { nodeCount: 0, edgeCount: 0, domainCount: 0, avgDegree: 0, bridgeCount: 0, topHubs: [] };
    const KN = G.KN;
    const degree = id => (G.adj[id] ? G.adj[id].size : 0);
    const hubs = KN.nodes.map(nd => ({ id: nd.id, name: nd.name, domain: nd.domain, degree: degree(nd.id) })).sort((a, b) => b.degree - a.degree);
    let bridges = 0;
    KN.nodes.forEach(nd => { const doms = new Set(); (G.adj[nd.id] || []).forEach(t => { if (KN.byId[t]) doms.add(KN.byId[t].domain); }); if (doms.size >= 2) bridges++; });
    return {
      nodeCount: KN.nodes.length, edgeCount: G.edgeCount, domainCount: G.domainCount,
      avgDegree: sig(2 * G.edgeCount / Math.max(1, KN.nodes.length), 3),
      bridgeCount: bridges, topHubs: hubs.slice(0, 8)
    };
  }
  function brainPath(fromId, toId) {
    const G = graph(); if (!G) return { found: false, path: [], hops: -1 };
    const KN = G.KN;
    if (!KN.byId[fromId] || !KN.byId[toId]) return { found: false, path: [], hops: -1 };
    const mk = id => { const nd = KN.byId[id]; return { id: id, name: nd ? nd.name : id, domain: nd ? nd.domain : "" }; };
    if (fromId === toId) return { found: true, path: [mk(fromId)], hops: 0 };
    const prev = {}, seen = new Set([fromId]), q = [fromId];
    while (q.length) {
      const cur = q.shift();
      for (const nb of (G.adj[cur] || [])) {
        if (!seen.has(nb)) {
          seen.add(nb); prev[nb] = cur;
          if (nb === toId) {
            const ids = []; let at = toId;
            while (at != null) { ids.unshift(at); if (at === fromId) break; at = prev[at]; }
            return { found: true, path: ids.map(mk), hops: ids.length - 1 };
          }
          q.push(nb);
        }
      }
    }
    return { found: false, path: [], hops: -1 };
  }

  return {
    schrodinger, circuit, molecule, wavepacket, qec, beam, interaction,
    brainStatus, brainStats, brainPath,
    // exposed for tests
    _sig: sig, _num: num, _shellsOf: shellsOf, _valence: valenceElectrons
  };
})();
