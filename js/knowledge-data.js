/* ============================================================================
 *  KNOWLEDGE-DATA.JS  —  "The Brain"
 *  ----------------------------------------------------------------------------
 *  A single source of truth distilled from the source physics papers.
 *  Every view in this app (the Atom Lab figure, the Knowledge Neural Network,
 *  and the Equation Library) reads from the global  window.KNOWLEDGE  object.
 *
 *  Each NODE is one equation / concept and carries:
 *    id         unique slug
 *    name       human label
 *    latex      the equation (KaTeX syntax) — "" if it is a pure concept
 *    domain     one of the DOMAINS keys (drives colour + grouping)
 *    category   finer grouping label
 *    behaviour  plain-English: what does it make the atom / electron / spin DO?
 *    variables  [[symbol, meaning], ...]
 *    source     primary PDF id (see SOURCES)
 *    related    [nodeId, ...]  edges of the knowledge network
 *    drawable   true if it corresponds to an arrow you can hover in the figure
 *    provenance "in-text"            = equation appears verbatim in the PDF
 *               "in-text-prose"      = stated in words in the PDF, standard form shown
 *               "standard-supplied"  = NOT in any PDF; canonical physics added so the
 *                                      figure is complete (clearly flagged everywhere)
 * ========================================================================== */

(function () {
  "use strict";

  /* ----- the 8 source documents (the "lobes" of the brain) ----------------- */
  const SOURCES = {
    "src-schrodinger": {
      title: "The Schrödinger Equation",
      file: "TheSchrodingerEquation.pdf",
      blurb: "Dan Dill, Boston University. Derives the master equation of quantum mechanics, the meaning of the wavefunction, quantization, and the probability cloud.",
      domainHint: "quantum"
    },
    "src-logic": {
      title: "The Logic of Behavior of Atoms",
      file: "The_Logic_of_Behavior_of_Atoms.pdf",
      blurb: "Eshaghi Gordji et al. (arXiv 1802.07225). Game-theory model of chemical bonding: atoms as players, bonds as Nash equilibria, electrostatic attraction vs repulsion.",
      domainHint: "molecular"
    },
    "src-dynamics": {
      title: "Quantum & Classical Dynamics of Atoms",
      file: "Quantum And Classical Dynamics Of Atoms In.pdf",
      blurb: "Ghose, Jessen et al. A single Cs-133 atom in an optical lattice: spin–motion coupling gives chaos classically and entanglement / tunnelling quantum-mechanically.",
      domainHint: "spin"
    },
    "src-gates": {
      title: "Quantum Computing — Quantum Gates (Module 3)",
      file: "module-3-quantum-computing-quantum-gates.pdf",
      blurb: "Engineering-physics module: the qubit, the Bloch sphere parametrization, and the standard single- and multi-qubit gates with their matrices.",
      domainHint: "quantum-info"
    },
    "src-qubit": {
      title: "Introduction to Quantum Information Science",
      file: "qubit_guide.pdf",
      blurb: "Ekert, Hosgood, Kay, Macchiavello. The qubit state vector, Bloch ball, Pauli operators, every single-qubit unitary as a rotation, and Schrödinger time-evolution.",
      domainHint: "quantum-info"
    },
    "src-relativity": {
      title: "Relativity: The Special & General Theory",
      file: "relativity.pdf",
      blurb: "Albert Einstein (1916). Mass–energy equivalence, the Lorentz transformation, time dilation, length contraction, and the Minkowski spacetime interval.",
      domainHint: "relativistic"
    },
    "src-toe": {
      title: "The Theory of Everything",
      file: "The Theory of Everything PDF.pdf",
      blurb: "Summary of Hawking's lectures. The four fundamental forces and the dream of unifying them; wave–particle duality, uncertainty, and the exclusion principle (prose only).",
      domainHint: "forces"
    },
    "src-molecules": {
      title: "Programmable Simulations of Molecules",
      file: "Programmable simulations of molecules.pdf",
      blurb: "Maskara, Lukin, Yelin et al. (Nature Physics 2025). Molecules as localized spins coupled by Heisenberg exchange, simulated on reconfigurable Rydberg-atom arrays.",
      domainHint: "molecular"
    },
    "src-library": {
      title: "Research Library (curated arXiv papers)",
      file: "RESEARCH-LIBRARY.md",
      blurb: "≈731 curated open-access arXiv preprints spanning ~30 topics — quantum COMPUTING & the proven ALGORITHMS (Shor, Grover, QFT, phase estimation, HHL, VQE, QAOA, QSP/QSVT…), qubit/circuit BUILDERS & VISUALIZATION, fault-tolerance & ERROR CORRECTION (surface/qLDPC codes, magic-state cultivation), superconducting / trapped-ion / neutral-atom / photonic HARDWARE, machine learning, simulation of materials & chemistry, lattice gauge theory, METROLOGY & sensing (optical clocks, spin squeezing), thermodynamics, open systems, TOPOLOGICAL matter & anyons, condensed matter, cold atoms & quantum optics, ENTANGLEMENT, networks/crypto, foundations/Bell tests — plus the PARTICLE-physics/QCD, NUCLEAR, and quantum-gravity/holography papers added in 2026-07.",
      domainHint: "quantum-info"
    },
    "src-web": {
      title: "Live web references (2025–2026)",
      file: "(curated web sources)",
      blurb: "Authoritative sources consulted live on the internet (Nature, Science, IBM/Microsoft Quantum, encyclopedic & review references) to feed the brain with quantum-computing ALGORITHMS, qubit HARDWARE, and VISUALIZATION concepts — figures like 2025 transmon coherence (T₁≈0.4 ms, T₂≈1 ms) and algorithm complexities are web-verified.",
      domainHint: "algorithms"
    },

    /* ---- particle-physics expansion (fetched from arXiv, 2025–2026) ---- */
    "src-sm-lectures": {
      title: "Lectures on Field Theory & the Standard Model",
      file: "2306.08097__lectures-on-field-theory-and-the-standard-model.pdf",
      blurb: "Álvarez-Gaumé & Vázquez-Mozo. Symmetry-oriented derivation of the whole Standard Model: the Dirac equation, the QED/QCD/Yang–Mills Lagrangians, the electroweak SU(2)×U(1) structure, the Higgs mechanism, Yukawa couplings and the running of the couplings.",
      domainHint: "particle"
    },
    "src-qed-primer": {
      title: "Primer of Strong-Field QED",
      file: "2511.10315__primer-of-strong-field-quantum-electrodynamics.pdf",
      blurb: "Kropf & Schulthess (2026). QED as a perturbation series in the fine-structure constant α; the Schwinger critical field where the vacuum sparks e⁺e⁻ pairs, and the strong-field parameters ξ (a₀) and χ.",
      domainHint: "particle"
    },
    "src-wmass": {
      title: "Status of the W Boson Mass",
      file: "2506.01887__status-of-the-w-boson-mass.pdf",
      blurb: "Bozzi & Schott (2025). The preliminary world-average W-boson mass M_W = 80.361 ± 0.008 GeV and the α–G_F–M_W–M_Z master relation that ties the electroweak sector together via loop corrections Δr.",
      domainHint: "particle"
    },
    "src-ewk-angle": {
      title: "Precision Electroweak Mixing Angle at the Z Pole",
      file: "2508.18022__precision-electroweak-mixing-angle-z-pole.pdf",
      blurb: "Bodek, Seo & Yang (2025). The most precise single measurement of the weak mixing angle sin²θ_eff = 0.23156 ± 0.00024, and its on-shell definition sin²θ_W = 1 − M_W²/M_Z².",
      domainHint: "particle"
    },
    "src-qgp": {
      title: "What is the Quark–Gluon Plasma Made Of?",
      file: "2506.07181__what-is-the-quark-gluon-plasma-made-of.pdf",
      blurb: "B. Müller (2025). The deconfined state of QCD: asymptotic freedom, color confinement & Debye screening, and constituent-quark-number scaling that reveals hadrons coalescing from free-flowing quarks.",
      domainHint: "particle"
    },
    "src-lqcd-eic": {
      title: "Hadron Structure from Lattice QCD (EIC)",
      file: "2603.28604__hadron-structure-from-lattice-qcd-eic.pdf",
      blurb: "C. Alexandrou (Lattice 2025). Parton distributions and the quark/gluon momentum & spin decomposition of the proton from the lattice — gluons carry ≈45% of the proton's momentum, evidence that most of its mass is QCD field energy.",
      domainHint: "particle"
    },
    "src-higgs": {
      title: "Prospects for Higgs Boson Research at the LHC",
      file: "2509.22455__prospects-for-higgs-boson-research-at-the-lhc.pdf",
      blurb: "Sopczak for ATLAS & CMS (2025). The Higgs potential V(h), the vacuum expectation value v ≈ 246 GeV, the self-coupling λ₃ = m_H²/2v², and how every particle's mass tracks its coupling to the Higgs.",
      domainHint: "particle"
    },
    "src-nuclear": {
      title: "Ab initio Nuclear Structure (²⁰⁸Pb, ²⁶⁶Pb)",
      file: "2508.14217__structure-of-doubly-magic-nuclei-208pb-266pb.pdf",
      blurb: "Hu, Hagen et al. (2025). The nucleus solved from nucleon-level chiral forces: the intrinsic many-body Hamiltonian (NN + 3N), shell-closure 'magic numbers', binding energy per nucleon, and a predicted new doubly-magic ²⁶⁶Pb.",
      domainHint: "nuclear"
    },
    "src-tesla-wpt": {
      title: "Magnetoquasistatic Wireless Power Transfer (Tesla)",
      file: "2603.27305__magnetoquasistatic-wireless-power-transfer-tesla.pdf",
      blurb: "Room-scale resonant wireless power (2026) — the modern descendant of Tesla's coils. Efficiency is set by the kQ figure of merit η_max = k²Q₁Q₂/(1+√(1+k²Q₁Q₂))²; transmitter & receiver must be tuned to the same resonant frequency ω₀ = 1/√(LC).",
      domainHint: "em"
    }
  };

  /* ----- domains: colour + label ------------------------------------------- */
  const DOMAINS = {
    classical:      { label: "Classical mechanics",      color: "#f5a623" },
    quantum:        { label: "Quantum (Schrödinger)",    color: "#22d3ee" },
    "quantum-info": { label: "Qubit / Bloch sphere",     color: "#a78bfa" },
    spin:           { label: "Spin & magnetism",         color: "#f472b6" },
    relativistic:   { label: "Relativity",               color: "#34d399" },
    molecular:      { label: "Molecules & clusters",     color: "#60a5fa" },
    forces:         { label: "Forces & big picture",     color: "#fb7185" },
    acoustics:      { label: "Sound, vibrations & phonons", color: "#eab308" },
    bonding:        { label: "Forces & bonding",         color: "#fb923c" },
    entanglement:   { label: "Entanglement & nonlocality", color: "#e879f9" },
    algorithms:     { label: "Quantum algorithms & protocols", color: "#2dd4bf" },
    hardware:       { label: "Qubit hardware & control",  color: "#94a3b8" },
    optics:         { label: "Light–matter & slow light", color: "#fcd34d" },
    thermal:        { label: "Radiation & states of matter", color: "#a3e635" },
    particle:       { label: "Particles, quarks & bosons", color: "#ef4444" },
    nuclear:        { label: "Nucleus & nucleons",         color: "#0ea5e9" },
    em:             { label: "Electromagnetism & Tesla",   color: "#3b82f6" }
  };

  /* ====================================================================== *
   *  NODES                                                                  *
   * ====================================================================== */
  const NODES = [

    /* ---------------------- CLASSICAL MECHANICS ------------------------- */
    {
      id: "coulomb-force", name: "Coulomb force (electron ↔ nucleus)",
      latex: "\\vec{F} = \\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1 q_2}{r^2}\\,\\hat{r}",
      domain: "classical", category: "Electrostatics", drawable: true,
      behaviour: "The negative electron is pulled radially inward toward the positive nucleus. This electrostatic attraction is the leash that keeps the electron bound — it is the centripetal force of the planetary atom.",
      variables: [["F","electrostatic force (N)"],["q_1,q_2","the two charges (electron −e, nucleus +Ze)"],["r","separation"],["\\varepsilon_0","vacuum permittivity"],["\\hat r","unit vector along the line joining them"]],
      source: "src-logic", related: ["em-force","centripetal","position-vec","ionic-bond","four-forces"],
      provenance: "standard-supplied"
    },
    {
      id: "gravity", name: "Newton's law of gravitation",
      latex: "\\vec F = -G\\frac{m_1 m_2}{r^2}\\,\\hat r",
      domain: "classical", category: "Forces", drawable: false,
      behaviour: "Every mass attracts every other with an inverse-square pull — identical in FORM to Coulomb's law. Between two atoms it is ~10³⁶ times weaker than the electric force, so it is utterly negligible for atomic binding (yet it rules planets and stars).",
      variables: [["G","gravitational constant"],["m_1,m_2","the two masses"],["r","separation"]],
      source: "src-toe", related: ["coulomb-force","centripetal","four-forces","em-force","position-vec"],
      provenance: "standard-supplied"
    },
    {
      id: "centripetal", name: "Newton's 2nd law / centripetal force",
      latex: "\\vec{F} = m\\vec{a} = \\frac{m v^2}{r}\\,(-\\hat{r})",
      domain: "classical", category: "Newtonian dynamics", drawable: true,
      behaviour: "For the electron to stay on a circular orbit, the Coulomb pull must exactly supply the inward (centripetal) acceleration. Balance this against Coulomb's law and you get the orbit radius and speed.",
      variables: [["m","electron mass"],["a","acceleration"],["v","orbital speed"],["r","orbit radius"]],
      source: "src-schrodinger", related: ["coulomb-force","velocity-vec","energy-classical"],
      provenance: "standard-supplied"
    },
    {
      id: "velocity-vec", name: "Speed from kinetic energy",
      latex: "v(x) = \\sqrt{\\frac{2\\,T(x)}{m}}",
      domain: "classical", category: "Newtonian dynamics", drawable: true,
      behaviour: "The electron moves fastest where its kinetic energy is largest (deepest in the potential well) and slows to a stop at the classical turning points. The velocity arrow is tangent to the orbit.",
      variables: [["v","speed at position x"],["T(x)","kinetic energy at x"],["m","mass"]],
      source: "src-schrodinger", related: ["momentum-vec","energy-classical","centripetal"],
      provenance: "in-text"
    },
    {
      id: "momentum-vec", name: "Momentum",
      latex: "\\vec{p} = m\\vec{v}",
      domain: "classical", category: "Newtonian dynamics", drawable: true,
      behaviour: "The momentum vector points along the direction of motion. Its magnitude sets the de Broglie wavelength of the electron's matter wave — the bridge from the classical to the quantum picture.",
      variables: [["p","momentum"],["m","mass"],["v","velocity"]],
      source: "src-schrodinger", related: ["velocity-vec","de-broglie","momentum-op","rel-momentum","angular-momentum"],
      provenance: "in-text-prose"
    },
    {
      id: "angular-momentum", name: "Orbital angular momentum",
      latex: "\\vec{L} = \\vec{r}\\times\\vec{p}",
      domain: "classical", category: "Newtonian dynamics", drawable: true,
      behaviour: "The angular-momentum vector points perpendicular to the orbital plane (right-hand rule). It is conserved for a central force, which is why the orbit stays in a fixed plane.",
      variables: [["L","angular momentum"],["r","position vector from nucleus"],["p","momentum"]],
      source: "src-schrodinger", related: ["bohr-quant","position-vec","momentum-vec","spin-moment"],
      provenance: "standard-supplied"
    },
    {
      id: "position-vec", name: "Position vector",
      latex: "\\vec{r} = (x,\\,y,\\,z)",
      domain: "classical", category: "Kinematics", drawable: true,
      behaviour: "Points from the nucleus (the origin) to the electron. Everything else — the force, the potential, the field — is a function of where this arrow points.",
      variables: [["r","displacement of the electron from the nucleus"]],
      source: "src-schrodinger", related: ["coulomb-force","angular-momentum","spacetime-interval","born-rule"],
      provenance: "in-text"
    },
    {
      id: "bohr-quant", name: "Bohr quantization of angular momentum",
      latex: "L = n\\hbar,\\qquad n = 1,2,3,\\dots",
      domain: "classical", category: "Old quantum theory", drawable: false,
      behaviour: "Bohr's rule that only orbits whose angular momentum is a whole number of ℏ are allowed. It explains the hydrogen spectrum and is the historical seed of quantization that Schrödinger later replaced with the wave equation.",
      variables: [["L","angular momentum"],["n","principal quantum number"],["\\hbar","reduced Planck constant"]],
      source: "src-schrodinger", related: ["angular-momentum","schrodinger-compact","energy-quant"],
      provenance: "standard-supplied"
    },
    {
      id: "energy-classical", name: "Total energy (classical)",
      latex: "\\frac{p^2}{2m} + V(x) = E",
      domain: "classical", category: "Energy", drawable: false,
      behaviour: "Kinetic plus potential energy is conserved. Schrödinger took exactly this statement and promoted x and p to operators to obtain his wave equation — so this classical line literally becomes the quantum Hamiltonian.",
      variables: [["p","momentum"],["m","mass"],["V(x)","potential energy"],["E","total (conserved) energy"]],
      source: "src-schrodinger", related: ["hamiltonian-op","velocity-vec","rel-energy"],
      provenance: "in-text"
    },

    /* ---------------------- QUANTUM (SCHRÖDINGER) ----------------------- */
    {
      id: "schrodinger-tdse", name: "Time-dependent Schrödinger equation",
      latex: "i\\hbar\\,\\frac{\\partial}{\\partial t}\\,\\Psi = \\hat{H}\\,\\Psi",
      domain: "quantum", category: "Master equation", drawable: false,
      behaviour: "The master equation of quantum mechanics — the quantum analogue of Newton's 2nd law. The Hamiltonian continuously drives the wavefunction forward in time, generating all motion of the electron's matter wave.",
      variables: [["\\Psi","wavefunction"],["\\hat H","Hamiltonian (total-energy operator)"],["\\hbar","reduced Planck constant"],["t","time"]],
      source: "src-schrodinger", sources: ["src-schrodinger","src-qubit"],
      related: ["schrodinger-compact","hamiltonian-op","time-evolution","wave-duality"],
      provenance: "in-text"
    },
    {
      id: "schrodinger-compact", name: "Time-independent Schrödinger (eigenvalue form)",
      latex: "\\hat{H}\\,\\psi = E\\,\\psi",
      domain: "quantum", category: "Master equation", drawable: false,
      behaviour: "The allowed states of an atom are exactly the wavefunctions that the energy operator returns unchanged except for a number E. Only those special states are physically real — which is why an atom's energies are discrete.",
      variables: [["\\hat H","Hamiltonian operator"],["\\psi","wavefunction (stationary state)"],["E","allowed / quantized energy"]],
      source: "src-schrodinger", related: ["schrodinger-tdse","schrodinger-1d","energy-quant","bohr-quant"],
      provenance: "in-text"
    },
    {
      id: "schrodinger-1d", name: "Time-independent Schrödinger (1-D explicit)",
      latex: "-\\frac{\\hbar^2}{2m}\\frac{\\partial^2\\psi}{\\partial x^2} + V(x)\\,\\psi = E\\,\\psi",
      domain: "quantum", category: "Master equation", drawable: false,
      behaviour: "Fixes the shape of the wavefunction: where the electron has lots of kinetic energy the wave oscillates fast (short wavelength); where kinetic energy goes negative the wave decays. Demanding it not blow up is what quantizes the energy.",
      variables: [["\\psi","wavefunction"],["V(x)","potential energy"],["E","total energy"],["m","mass"],["\\hbar","reduced Planck constant"]],
      source: "src-schrodinger", related: ["schrodinger-compact","hamiltonian-op","free-particle","energy-quant","born-rule"],
      provenance: "in-text"
    },
    {
      id: "hamiltonian-op", name: "Hamiltonian operator",
      latex: "\\hat{H} = -\\frac{\\hbar^2}{2m}\\frac{\\partial^2}{\\partial x^2} + V(x)",
      domain: "quantum", category: "Operators", drawable: false,
      behaviour: "Encodes the electron's total energy as an operator: the first term is kinetic energy (curvature of the wave), the second is potential energy. Acting on ψ it reports the energy content of that state.",
      variables: [["\\hat H","total-energy operator"],["V(x)","potential energy term"],["m","mass"],["\\hbar","reduced Planck constant"]],
      source: "src-schrodinger", related: ["schrodinger-compact","energy-classical","momentum-op","qubit-hamiltonian"],
      provenance: "in-text"
    },
    {
      id: "momentum-op", name: "Momentum operator",
      latex: "\\hat{p}_x = -i\\hbar\\,\\frac{\\partial}{\\partial x}",
      domain: "quantum", category: "Operators", drawable: false,
      behaviour: "In quantum mechanics momentum becomes 'minus iℏ times the slope of the wavefunction'. A rapidly varying wave carries large momentum — exactly the de Broglie idea written as an operator.",
      variables: [["\\hat p_x","momentum operator along x"],["\\hbar","reduced Planck constant"],["i","imaginary unit"]],
      source: "src-schrodinger", related: ["commutator","de-broglie","momentum-vec","hamiltonian-op"],
      provenance: "in-text"
    },
    {
      id: "commutator", name: "Position–momentum commutator",
      latex: "[\\hat{x},\\hat{p}] = \\hat{x}\\hat{p} - \\hat{p}\\hat{x} = i\\hbar",
      domain: "quantum", category: "Foundations", drawable: false,
      behaviour: "Measuring position then momentum is NOT the same as momentum then position — they differ by iℏ. Called 'the foundation on which all of quantum mechanics rests'; it is the root of the uncertainty principle.",
      variables: [["\\hat x","position operator"],["\\hat p","momentum operator"],["\\hbar","reduced Planck constant"],["i","imaginary unit"]],
      source: "src-schrodinger", related: ["momentum-op","uncertainty","pauli-x"],
      provenance: "in-text"
    },
    {
      id: "de-broglie", name: "de Broglie wavelength",
      latex: "\\lambda = \\frac{h}{p}",
      domain: "quantum", category: "Wave–particle duality", drawable: false,
      behaviour: "Every particle is also a wave whose wavelength shrinks as its momentum grows. This is why a faster electron's wavefunction wiggles more rapidly, and why electrons in atoms form standing waves.",
      variables: [["\\lambda","matter wavelength"],["h","Planck constant"],["p","momentum"]],
      source: "src-schrodinger", related: ["momentum-vec","momentum-op","wave-duality","free-particle"],
      provenance: "in-text"
    },
    {
      id: "born-rule", name: "Born rule (probability cloud)",
      latex: "P(x)\\,dx = |\\psi(x)|^2\\,dx",
      domain: "quantum", category: "Measurement", drawable: true,
      behaviour: "The square of the wavefunction's magnitude gives the probability of finding the electron at each point. This is the 'electron cloud' — the quantum replacement for a sharp classical orbit.",
      variables: [["|\\psi|^2","probability density"],["dx","small interval at x"]],
      source: "src-schrodinger", related: ["normalization","schrodinger-1d","wave-duality","uncertainty","bloch-measure"],
      provenance: "in-text"
    },
    {
      id: "normalization", name: "Normalization of the wavefunction",
      latex: "\\int_{-\\infty}^{\\infty} |\\psi(x)|^2\\,dx = 1",
      domain: "quantum", category: "Measurement", drawable: false,
      behaviour: "The electron must be found somewhere, so the total probability is exactly 1. This single requirement forbids run-away wavefunctions and is what forces the energies to come in discrete steps.",
      variables: [["\\psi","wavefunction"]],
      source: "src-schrodinger", related: ["born-rule","energy-quant","schrodinger-1d"],
      provenance: "in-text"
    },
    {
      id: "free-particle", name: "Free-particle wavefunction",
      latex: "\\psi(x) = \\sin\\!\\left(\\frac{2\\pi x}{\\lambda}\\right),\\quad E = \\frac{p^2}{2m}",
      domain: "quantum", category: "Solutions", drawable: false,
      behaviour: "With no potential, the electron's wavefunction is a pure sine wave and its energy is purely kinetic — the simplest exact solution of the Schrödinger equation.",
      variables: [["\\lambda","wavelength"],["p","momentum"],["m","mass"],["E","energy"]],
      source: "src-schrodinger", related: ["de-broglie","schrodinger-1d"],
      provenance: "in-text"
    },
    {
      id: "energy-quant", name: "Energy quantization",
      latex: "E_1 < E_2 < E_3 < \\dots\\;(\\text{discrete})",
      domain: "quantum", category: "Atomic structure", drawable: false,
      behaviour: "Confining a particle between classically forbidden regions lets only special energies give a non-diverging wavefunction. The result: an atom's electrons can sit only on discrete energy levels — its spectral fingerprint.",
      variables: [["E_n","allowed energy levels"]],
      source: "src-schrodinger", related: ["schrodinger-compact","normalization","bohr-quant","pauli-exclusion"],
      provenance: "in-text-prose"
    },
    {
      id: "time-evolution", name: "Time-evolution operator",
      latex: "|\\psi(t)\\rangle = e^{-\\frac{i}{\\hbar}\\hat{H}t}\\,|\\psi(0)\\rangle",
      domain: "quantum", category: "Dynamics", drawable: false,
      behaviour: "Solving the Schrödinger equation for a constant Hamiltonian: the state is rotated in time by a unitary. Energy eigenstates only pick up a phase, so their probability cloud is stationary (a standing wave).",
      variables: [["\\hat H","Hamiltonian"],["t","time"],["\\hbar","reduced Planck constant"]],
      source: "src-qubit", related: ["schrodinger-tdse","unitary-rotation","qubit-hamiltonian"],
      provenance: "in-text"
    },

    /* ---------------------- QUBIT / BLOCH SPHERE ------------------------ */
    {
      id: "qubit-state", name: "Qubit state (superposition)",
      latex: "|\\psi\\rangle = \\alpha\\,|0\\rangle + \\beta\\,|1\\rangle",
      domain: "quantum-info", category: "State vector", drawable: false,
      behaviour: "A qubit is a blend of both basis states at once. The complex amplitudes α, β decide how much of |0⟩ and |1⟩ are present; measurement collapses it to one of them.",
      variables: [["\\alpha,\\beta","complex probability amplitudes"],["|0\\rangle,|1\\rangle","basis states (e.g. spin down / up)"]],
      source: "src-gates", sources: ["src-gates","src-qubit"],
      related: ["qubit-norm","bloch-param","bloch-measure","spin-basis"],
      provenance: "in-text"
    },
    {
      id: "qubit-norm", name: "Normalization of a qubit",
      latex: "|\\alpha|^2 + |\\beta|^2 = 1",
      domain: "quantum-info", category: "State vector", drawable: false,
      behaviour: "The probabilities of the two outcomes must add to 1. Geometrically this is exactly why the Bloch vector always has unit length and lives on the surface of a sphere.",
      variables: [["|\\alpha|^2","probability of measuring 0"],["|\\beta|^2","probability of measuring 1"]],
      source: "src-gates", related: ["qubit-state","bloch-param","bloch-vector"],
      provenance: "in-text"
    },
    {
      id: "bloch-param", name: "Bloch-sphere parametrization",
      latex: "|\\psi\\rangle = \\cos\\tfrac{\\theta}{2}\\,|0\\rangle + e^{i\\phi}\\sin\\tfrac{\\theta}{2}\\,|1\\rangle",
      domain: "quantum-info", category: "Bloch sphere", drawable: true,
      behaviour: "Maps any pure qubit state to a point on a unit sphere. The polar angle θ tips the arrow between the poles (|0⟩ at top, |1⟩ at bottom); the azimuth φ spins it around — the relative phase.",
      variables: [["\\theta","polar angle from +z, 0…π"],["\\phi","azimuthal angle in x-y plane, 0…2π"],["|0\\rangle,|1\\rangle","north / south pole states"]],
      source: "src-qubit", sources: ["src-gates","src-qubit"],
      related: ["qubit-state","bloch-vector","bloch-measure","unitary-rotation","spin-basis"],
      provenance: "in-text"
    },
    {
      id: "bloch-vector", name: "Bloch vector ↔ density operator",
      latex: "\\rho = \\tfrac{1}{2}\\left(\\mathbb{I} + \\vec{s}\\cdot\\vec{\\sigma}\\right)",
      domain: "quantum-info", category: "Bloch sphere", drawable: true,
      behaviour: "The state is summed up by a real 3-D arrow s. Length 1 → a pure state on the sphere's surface; length < 1 → a mixed state inside the ball; zero → maximally mixed at the centre.",
      variables: [["\\vec s","Bloch vector (s_x,s_y,s_z)"],["\\vec\\sigma","Pauli vector (X,Y,Z)"],["\\mathbb{1}","identity"]],
      source: "src-qubit", related: ["bloch-param","expectation","pauli-x","pauli-y","pauli-z"],
      provenance: "in-text"
    },
    {
      id: "pauli-x", name: "Pauli-X gate (bit flip / NOT)",
      latex: "X = \\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}",
      domain: "quantum-info", category: "Gates", drawable: true,
      behaviour: "Swaps |0⟩ and |1⟩ — the quantum NOT. On the Bloch sphere it rotates the state vector 180° about the x-axis.",
      variables: [["X","Pauli-X matrix"]],
      source: "src-gates", sources: ["src-gates","src-qubit"],
      related: ["pauli-y","pauli-z","unitary-rotation","bloch-vector","commutator"],
      provenance: "in-text"
    },
    {
      id: "pauli-y", name: "Pauli-Y gate",
      latex: "Y = \\begin{pmatrix}0&-i\\\\ i&0\\end{pmatrix}",
      domain: "quantum-info", category: "Gates", drawable: true,
      behaviour: "A combined bit-and-phase flip; a 180° rotation of the Bloch vector about the y-axis. A qubit in a magnetic field along y evolves exactly under this generator.",
      variables: [["Y","Pauli-Y matrix"],["i","imaginary unit"]],
      source: "src-gates", sources: ["src-gates","src-qubit"],
      related: ["pauli-x","pauli-z","unitary-rotation","qubit-hamiltonian"],
      provenance: "in-text"
    },
    {
      id: "pauli-z", name: "Pauli-Z gate (phase flip)",
      latex: "Z = \\begin{pmatrix}1&0\\\\0&-1\\end{pmatrix}",
      domain: "quantum-info", category: "Gates", drawable: true,
      behaviour: "Leaves |0⟩ alone and flips the sign of |1⟩. On the Bloch sphere it rotates the vector 180° about the vertical z-axis — it changes the phase φ, not the poles.",
      variables: [["Z","Pauli-Z matrix"]],
      source: "src-gates", sources: ["src-gates","src-qubit"],
      related: ["pauli-x","pauli-y","phase-gate","unitary-rotation"],
      provenance: "in-text"
    },
    {
      id: "hadamard", name: "Hadamard gate",
      latex: "H = \\frac{1}{\\sqrt{2}}\\begin{pmatrix}1&1\\\\1&-1\\end{pmatrix}",
      domain: "quantum-info", category: "Gates", drawable: true,
      behaviour: "Turns a definite pole into an equal superposition: |0⟩ → |+⟩ on the equator. It is the gate that creates quantum superposition, a 180° rotation about the diagonal (x+z)/√2 axis.",
      variables: [["H","Hadamard matrix"]],
      source: "src-gates", sources: ["src-gates","src-qubit"],
      related: ["pauli-z","bloch-param","qubit-state"],
      provenance: "in-text"
    },
    {
      id: "phase-gate", name: "Phase gate (S / T / general P)",
      latex: "P(\\varphi) = \\begin{pmatrix}1&0\\\\0&e^{i\\varphi}\\end{pmatrix}\\;\\;(S:\\varphi=\\tfrac{\\pi}{2},\\;T:\\varphi=\\tfrac{\\pi}{4})",
      domain: "quantum-info", category: "Gates", drawable: true,
      behaviour: "Adds a phase to |1⟩ only, spinning the Bloch vector around the z-axis by angle φ without tipping it. S is a quarter turn, T an eighth turn.",
      variables: [["\\varphi","phase added to |1⟩"]],
      source: "src-gates", sources: ["src-gates","src-qubit"],
      related: ["pauli-z","bloch-param","unitary-rotation"],
      provenance: "in-text"
    },
    {
      id: "unitary-rotation", name: "Every single-qubit gate is a rotation",
      latex: "U = e^{\\,i\\alpha\\,\\vec{n}\\cdot\\vec{\\sigma}}\\;\\Rightarrow\\;\\text{rotation by }2\\alpha\\text{ about }\\vec n",
      domain: "quantum-info", category: "Bloch sphere", drawable: true,
      behaviour: "Any gate is a rigid rotation of the Bloch sphere: pick an axis n and an angle, and the state vector spins around it. This is the unifying geometric picture of all quantum logic.",
      variables: [["\\vec n","rotation axis (unit vector)"],["\\alpha","half the rotation angle"],["\\vec\\sigma","Pauli vector"]],
      source: "src-qubit", related: ["bloch-precession","pauli-x","pauli-y","pauli-z","qubit-hamiltonian","time-evolution"],
      provenance: "in-text"
    },
    {
      id: "bloch-precession", name: "Bloch-vector precession (infinitesimal)",
      latex: "\\vec{s}^{\\,\\prime} = \\vec{s} + 2\\alpha\\,(\\vec{n}\\times\\vec{s})",
      domain: "quantum-info", category: "Bloch sphere", drawable: true,
      behaviour: "The tip of the Bloch vector moves perpendicular to both itself and the axis — i.e. it sweeps a circle around n. This cross-product is the qubit version of magnetic precession.",
      variables: [["\\vec s","Bloch vector"],["\\vec n","axis"],["\\alpha","small angle"],["\\times","cross product"]],
      source: "src-qubit", related: ["unitary-rotation","larmor","qubit-hamiltonian"],
      provenance: "in-text"
    },
    {
      id: "bloch-measure", name: "Measurement probability",
      latex: "\\Pr(0) = \\cos^2\\tfrac{\\theta}{2} = \\tfrac{1+s_z}{2}",
      domain: "quantum-info", category: "Measurement", drawable: false,
      behaviour: "How high the Bloch vector points (its z-component) sets the odds of measuring 0 versus 1. Pointing straight up is a guaranteed 0; on the equator it is a perfect 50/50.",
      variables: [["\\theta","polar angle"],["s_z","vertical component of the Bloch vector"]],
      source: "src-qubit", related: ["bloch-param","born-rule","expectation"],
      provenance: "in-text"
    },
    {
      id: "expectation", name: "Expectation value = Bloch component",
      latex: "\\langle X\\rangle = s_x,\\quad \\langle Y\\rangle = s_y,\\quad \\langle Z\\rangle = s_z",
      domain: "quantum-info", category: "Measurement", drawable: false,
      behaviour: "Projecting the Bloch arrow onto the x, y, z axes gives the average outcome of measuring that Pauli observable. The geometry of the arrow IS the measurable physics.",
      variables: [["\\langle X\\rangle","mean of an X-measurement"],["s_x,s_y,s_z","components of the Bloch vector"]],
      source: "src-qubit", related: ["bloch-vector","bloch-measure"],
      provenance: "in-text"
    },
    {
      id: "cnot", name: "CNOT (controlled-NOT)",
      latex: "\\text{CNOT} = \\begin{pmatrix}1&0&0&0\\\\0&1&0&0\\\\0&0&0&1\\\\0&0&1&0\\end{pmatrix}",
      domain: "quantum-info", category: "Gates", drawable: false,
      behaviour: "Flips a target qubit only when the control qubit is |1⟩: |A,B⟩ → |A, A⊕B⟩. The basic two-qubit gate that creates entanglement between atoms.",
      variables: [["\\oplus","addition modulo 2 (XOR)"]],
      source: "src-gates", related: ["pauli-x","exchange","rydberg"],
      provenance: "in-text"
    },
    {
      id: "spin-basis", name: "Spin / energy encoding of |0⟩,|1⟩",
      latex: "|0\\rangle \\equiv \\text{spin-down / ground},\\quad |1\\rangle \\equiv \\text{spin-up / excited}",
      domain: "quantum-info", category: "Physical realization", drawable: false,
      behaviour: "The abstract qubit basis is physically an electron's spin (down/up) or an atom's energy level (ground/excited). This is what ties the Bloch sphere to a real atom.",
      variables: [["|0\\rangle","north pole / ground"],["|1\\rangle","south pole / excited"]],
      source: "src-gates", related: ["bloch-param","spin-moment","qubit-hamiltonian"],
      provenance: "in-text"
    },

    /* ---------------------- SPIN & MAGNETISM ---------------------------- */
    {
      id: "spin-moment", name: "Magnetic moment of a spin",
      latex: "\\vec{\\mu} = \\gamma\\,\\vec{F}",
      domain: "spin", category: "Magnetism", drawable: true,
      behaviour: "An atom acts as a tiny bar magnet whose magnetic-moment arrow is locked to its spin / angular-momentum arrow. Reorient the spin and you reorient the magnet.",
      variables: [["\\vec\\mu","magnetic moment"],["\\gamma","gyromagnetic ratio = −μ_B g_F / ℏ"],["\\vec F","total angular momentum (spin)"]],
      source: "src-dynamics", related: ["larmor","zeeman-energy","angular-momentum","spin-basis"],
      provenance: "in-text"
    },
    {
      id: "larmor", name: "Larmor precession of the moment",
      latex: "\\dot{\\vec{\\mu}} = \\gamma\\,\\vec{\\mu}\\times\\vec{B}_{\\text{eff}}",
      domain: "spin", category: "Magnetism", drawable: true,
      behaviour: "A magnetic moment in a field feels a torque that makes it sweep a cone around the field direction — it precesses rather than simply aligning. This is the classical twin of Bloch-vector rotation.",
      variables: [["\\vec\\mu","magnetic moment"],["\\gamma","gyromagnetic ratio"],["\\vec B_{\\text{eff}}","effective magnetic field"]],
      source: "src-dynamics", related: ["spin-moment","b-eff","bloch-precession","eom-z","zeeman-energy"],
      provenance: "in-text"
    },
    {
      id: "zeeman-energy", name: "Energy of a moment in a field (−μ·B)",
      latex: "U(z,\\vec\\mu) = U_J(z) - \\vec{\\mu}\\cdot\\vec{B}_{\\text{eff}}(z)",
      domain: "spin", category: "Magnetism", drawable: false,
      behaviour: "The atom's energy is lowest when its magnetic moment lines up with the field. Because the field here depends on where the atom sits, its internal spin and its motion become coupled.",
      variables: [["U","potential energy"],["\\vec\\mu","magnetic moment"],["\\vec B_{\\text{eff}}","effective field"],["U_J(z)","spin-independent trap"]],
      source: "src-dynamics", related: ["larmor","b-eff","eom-z","spin-moment"],
      provenance: "in-text"
    },
    {
      id: "b-eff", name: "Effective magnetic field",
      latex: "\\vec{B}_{\\text{eff}}(z) = B_x\\,\\hat{e}_x + B_{\\text{fict}}(z)\\,\\hat{e}_z",
      domain: "spin", category: "Magnetism", drawable: true,
      behaviour: "The field the spin actually feels has a fixed transverse part plus a part that depends on the atom's position. As the atom moves the field tilts, which re-steers the spin — the engine of spin–motion coupling.",
      variables: [["B_x","fixed transverse field"],["B_{\\text{fict}}(z)","position-dependent (fictitious) field"],["\\hat e_x,\\hat e_z","unit axes"]],
      source: "src-dynamics", related: ["larmor","zeeman-energy","qubit-hamiltonian"],
      provenance: "in-text"
    },
    {
      id: "eom-z", name: "Coupled equations of motion",
      latex: "\\dot{z} = \\frac{p}{m},\\qquad \\dot{p} = -\\frac{d}{dz}\\!\\left(U_J - \\vec\\mu\\cdot\\vec B_{\\text{eff}}\\right)",
      domain: "spin", category: "Dynamics", drawable: true,
      behaviour: "The atom drifts at velocity p/m and is pushed by the slope of its potential. Because that potential depends on the precessing spin, position and spin feed back on each other — giving chaos classically, entanglement quantumly.",
      variables: [["z","position"],["p","momentum"],["m","mass"],["U_J","scalar trap"],["\\vec\\mu\\cdot\\vec B","spin energy"]],
      source: "src-dynamics", related: ["larmor","zeeman-energy","velocity-vec","born-rule"],
      provenance: "in-text"
    },
    {
      id: "qubit-hamiltonian", name: "Qubit-in-a-field Hamiltonian (precession)",
      latex: "\\hat{H} = E_0\\,\\mathbb{I} + \\hbar\\Omega\\,(\\vec{n}\\cdot\\vec{\\sigma})",
      domain: "spin", category: "Dynamics", drawable: true,
      behaviour: "A two-level spin in a field precesses about the field axis n at angular frequency Ω — the quantum-information form of Larmor precession. It also defines the atom's two energy levels, split by 2ℏΩ.",
      variables: [["E_0","energy offset"],["\\Omega","precession / Larmor frequency"],["\\vec n","field axis"],["\\vec\\sigma","Pauli vector"]],
      source: "src-qubit", related: ["unitary-rotation","bloch-precession","larmor","time-evolution","pauli-y"],
      provenance: "in-text"
    },

    /* ---------------------- RELATIVITY ---------------------------------- */
    {
      id: "mass-energy", name: "Mass–energy equivalence",
      latex: "E = mc^2",
      domain: "relativistic", category: "Mass & energy", drawable: false,
      behaviour: "Mass is concentrated energy. An atom's nucleus weighs slightly less than its separate protons and neutrons — that 'mass defect' is the binding energy, and releasing it is the basis of nuclear energy.",
      variables: [["E","energy"],["m","rest mass"],["c","speed of light"]],
      source: "src-relativity", related: ["rel-energy","strong-force","four-forces"],
      provenance: "in-text"
    },
    {
      id: "rel-energy", name: "Relativistic energy",
      latex: "E = \\frac{mc^2}{\\sqrt{1-\\dfrac{v^2}{c^2}}}",
      domain: "relativistic", category: "Mass & energy", drawable: false,
      behaviour: "As an electron approaches light speed its energy diverges, so c is an unreachable limit. Expanded for small v it gives mc² (rest energy) plus the familiar ½mv², plus relativistic corrections that matter for inner-shell electrons.",
      variables: [["m","rest mass"],["v","speed"],["c","speed of light"]],
      source: "src-relativity", related: ["mass-energy","rel-momentum","velocity-vec","energy-classical"],
      provenance: "in-text"
    },
    {
      id: "rel-momentum", name: "Relativistic momentum",
      latex: "\\vec{p} = \\frac{m\\vec{v}}{\\sqrt{1-\\dfrac{v^2}{c^2}}}",
      domain: "relativistic", category: "Mass & energy", drawable: true,
      behaviour: "At high speed momentum grows faster than mv; this corrects the motion of fast atomic electrons. (Einstein's text discusses fast electrons in fields but does not print this formula — it is the standard companion to his energy law.)",
      variables: [["m","rest mass"],["v","velocity"],["c","speed of light"]],
      source: "src-relativity", related: ["rel-energy","momentum-vec","lorentz-force"],
      provenance: "standard-supplied"
    },
    {
      id: "lorentz-transform", name: "Lorentz transformation",
      latex: "x' = \\frac{x-vt}{\\sqrt{1-\\frac{v^2}{c^2}}},\\quad t' = \\frac{t-\\frac{v}{c^2}x}{\\sqrt{1-\\frac{v^2}{c^2}}}",
      domain: "relativistic", category: "Spacetime", drawable: false,
      behaviour: "Relates the space and time coordinates of two observers in relative motion — space and time mix. It reduces to ordinary Galilean addition when c → ∞.",
      variables: [["x,t","coordinates in one frame"],["x',t'","coordinates in a frame moving at v"],["c","speed of light"]],
      source: "src-relativity", related: ["spacetime-interval","velocity-addition","time-dilation"],
      provenance: "in-text"
    },
    {
      id: "time-dilation", name: "Time dilation & length contraction",
      latex: "\\Delta t' = \\frac{\\Delta t}{\\sqrt{1-\\frac{v^2}{c^2}}},\\quad L' = L\\sqrt{1-\\tfrac{v^2}{c^2}}",
      domain: "relativistic", category: "Spacetime", drawable: false,
      behaviour: "A moving clock runs slow and a moving rod shortens along its motion. Einstein notes this is exactly the contraction Lorentz had to postulate for the fast-moving electron.",
      variables: [["\\Delta t","proper time interval"],["L","rest length"],["v","speed"],["c","speed of light"]],
      source: "src-relativity", related: ["lorentz-transform","spacetime-interval"],
      provenance: "in-text"
    },
    {
      id: "velocity-addition", name: "Relativistic velocity addition",
      latex: "W = \\frac{v+w}{1+\\dfrac{vw}{c^2}}",
      domain: "relativistic", category: "Spacetime", drawable: false,
      behaviour: "Velocities don't simply add; the denominator keeps the result below c no matter how large v and w are. Two sub-light speeds can never combine past light speed.",
      variables: [["v,w","the two velocities"],["W","resultant velocity"],["c","speed of light"]],
      source: "src-relativity", related: ["lorentz-transform"],
      provenance: "in-text"
    },
    {
      id: "spacetime-interval", name: "Spacetime interval (Minkowski)",
      latex: "ds^2 = dx^2+dy^2+dz^2 - c^2\\,dt^2",
      domain: "relativistic", category: "Spacetime", drawable: false,
      behaviour: "This combination of space and time separations is the same for every observer even though space and time separately are not. It is the true 'distance' in 4-D spacetime.",
      variables: [["dx,dy,dz","spatial separation"],["dt","time separation"],["c","speed of light"],["ds","invariant interval"]],
      source: "src-relativity", related: ["lorentz-transform","position-vec","time-dilation"],
      provenance: "in-text"
    },
    {
      id: "lorentz-force", name: "Lorentz force on a charge",
      latex: "\\vec{F} = q\\,(\\vec{E} + \\vec{v}\\times\\vec{B})",
      domain: "relativistic", category: "Electromagnetism", drawable: true,
      behaviour: "The force on a moving charge from electric and magnetic fields — what deflects atomic electrons in fields. (Einstein's text discusses this 'Maxwell–Lorentz' deflection in words; the formula itself is the standard companion supplied here.)",
      variables: [["q","charge"],["\\vec E","electric field"],["\\vec B","magnetic field"],["\\vec v","velocity"]],
      source: "src-relativity", related: ["rel-momentum","coulomb-force","em-force","b-eff"],
      provenance: "standard-supplied"
    },

    /* ---------------------- MOLECULES & CLUSTERS ------------------------ */
    {
      id: "exchange", name: "Heisenberg exchange interaction",
      latex: "H = -\\sum_{ij} J_{ij}\\,\\vec{S}_i\\cdot\\vec{S}_j",
      domain: "molecular", category: "Spin Hamiltonian", drawable: true,
      behaviour: "The dominant interaction between magnetic atoms in a molecule. J > 0 lines neighbouring spins up (ferromagnetic); J < 0 makes them anti-align (antiferromagnetic). It sets the molecule's ground-state spin.",
      variables: [["J_{ij}","exchange coupling between atoms i and j"],["\\vec S_i","spin vector on atom i"]],
      source: "src-molecules", related: ["spin-hamiltonian","dm-interaction","rydberg","cnot","ionic-bond"],
      provenance: "in-text"
    },
    {
      id: "spin-hamiltonian", name: "Model spin Hamiltonian",
      latex: "H = \\sum_{i,\\alpha} B_i^{\\alpha} \\hat{S}_i^{\\alpha} + \\sum_{ij,\\alpha\\beta} J_{ij}^{\\alpha\\beta}\\hat{S}_i^{\\alpha}\\hat{S}_j^{\\beta} + \\dots",
      domain: "molecular", category: "Spin Hamiltonian", drawable: false,
      behaviour: "The general magnetic description of a molecule: a local field tilts each spin, two-body terms couple pairs, and higher terms add many-body effects. Diagonalizing it gives the molecule's 'spin ladder' of states.",
      variables: [["B_i^\\alpha","local field on atom i"],["J_{ij}","two-body coupling"],["\\hat S_i^\\alpha","spin component on atom i"]],
      source: "src-molecules", related: ["exchange","dm-interaction","spin-cluster"],
      provenance: "in-text"
    },
    {
      id: "dm-interaction", name: "Dzyaloshinskii–Moriya interaction",
      latex: "H_{DM} = \\vec{D}_{ij}\\cdot(\\vec{S}_i\\times\\vec{S}_j)",
      domain: "molecular", category: "Spin Hamiltonian", drawable: true,
      behaviour: "An antisymmetric coupling that tilts neighbouring spins out of line, twisting them and producing canting or chirality in a magnetic molecule.",
      variables: [["\\vec D_{ij}","DM vector (perpendicular to the bond)"],["\\vec S_i\\times\\vec S_j","cross product of the two spins"]],
      source: "src-molecules", related: ["exchange","spin-hamiltonian"],
      provenance: "in-text-prose"
    },
    {
      id: "rydberg", name: "Rydberg interaction & blockade",
      latex: "H_{\\text{cluster}} = \\sum_i \\tfrac{\\Omega_r(t)}{2}\\,|r\\rangle_i\\langle 1| + \\text{h.c.} + \\sum_{i<j} V_{ij}\\,|r\\rangle_i\\langle r|\\,|r\\rangle_j\\langle r|",
      domain: "molecular", category: "Hardware", drawable: true,
      behaviour: "Lasers drive atoms to a highly excited Rydberg state; two nearby Rydberg atoms repel so strongly that only one can be excited at a time (the 'blockade'). That blockade is what entangles the atoms and runs the quantum simulation.",
      variables: [["\\Omega_r(t)","laser drive to the Rydberg state"],["V_{ij}","Rydberg interaction energy"],["|r\\rangle","Rydberg state"]],
      source: "src-molecules", related: ["exchange","cnot","spin-cluster"],
      provenance: "in-text"
    },
    {
      id: "spin-cluster", name: "Cluster encoding of a spin-S",
      latex: "\\hat{S}_i^{\\alpha} = \\sum_{a=1}^{2S_i}\\hat{s}_{i,a}^{\\alpha}",
      domain: "molecular", category: "Encoding", drawable: true,
      behaviour: "A big spin-S atom is built from 2S little qubit spins that add up. Hovering the big spin arrow 'decomposes' it into its constituent qubit arrows.",
      variables: [["\\hat S_i","total spin on atom i"],["\\hat s_{i,a}","constituent qubit spins"],["S_i","spin magnitude"]],
      source: "src-molecules", related: ["spin-hamiltonian","rydberg","exchange"],
      provenance: "in-text"
    },
    {
      id: "ionic-bond", name: "Ionic bond (electron transfer)",
      latex: "\\text{Na}^{+} + \\text{Cl}^{-} \\rightarrow \\text{NaCl}",
      domain: "molecular", category: "Bonding", drawable: true,
      behaviour: "Sodium hands an electron to chlorine; the resulting + and − ions snap together by electrostatic attraction into a crystal. Modelled in the source as a game where the bonded state is a Nash equilibrium.",
      variables: [["\\text{Na}^+","sodium cation (lost an electron)"],["\\text{Cl}^-","chloride anion (gained an electron)"]],
      source: "src-logic", related: ["coulomb-force","exchange","em-force","pauli-exclusion"],
      provenance: "in-text"
    },

    /* ---------------------- FORCES & BIG PICTURE ------------------------ */
    {
      id: "four-forces", name: "The four fundamental forces",
      latex: "\\text{strong} \\;\\gg\\; \\text{electromagnetic} \\;\\gg\\; \\text{weak} \\;\\gg\\; \\text{gravity}",
      domain: "forces", category: "Unification", drawable: false,
      behaviour: "Everything an atom does is one of four forces: the strong force binds the nucleus, electromagnetism binds electrons and makes chemistry, the weak force drives radioactive decay, and gravity is negligible at atomic scale. Unifying them is the 'theory of everything'.",
      variables: [],
      source: "src-toe", related: ["strong-force","em-force","mass-energy","coulomb-force"],
      provenance: "in-text-prose"
    },
    {
      id: "strong-force", name: "Strong nuclear force",
      latex: "\\text{binds protons + neutrons } (r \\lesssim 10^{-15}\\,\\text{m})",
      domain: "forces", category: "Nuclear", drawable: true,
      behaviour: "A very short-range attraction that glues protons and neutrons together, overpowering the electrostatic repulsion of the like-charged protons. Without it no nucleus could exist.",
      variables: [["r","range of the force (~1 femtometre)"]],
      source: "src-toe", related: ["four-forces","mass-energy","em-force"],
      provenance: "in-text-prose"
    },
    {
      id: "em-force", name: "Electromagnetic force (binds electrons)",
      latex: "\\vec{F}_{\\text{EM}} \\propto \\frac{1}{r^2}\\;(\\text{attractive, } e^- \\to \\text{nucleus})",
      domain: "forces", category: "Atomic binding", drawable: true,
      behaviour: "The force that holds electrons to the nucleus and bonds atoms into molecules — i.e. all of chemistry. It is Coulomb's law seen as one of the four fundamental interactions.",
      variables: [["r","electron–nucleus distance"]],
      source: "src-toe", related: ["coulomb-force","four-forces","lorentz-force","ionic-bond"],
      provenance: "in-text-prose"
    },
    {
      id: "wave-duality", name: "Wave–particle duality",
      latex: "\\text{particle} \\;\\Longleftrightarrow\\; \\text{wave}\\;(\\lambda = h/p)",
      domain: "forces", category: "Quantum principles", drawable: false,
      behaviour: "Electrons and light are both particle and wave. This is why a sharp orbit gives way to a probability cloud and why the Schrödinger equation is a wave equation.",
      variables: [["\\lambda","wavelength"],["h","Planck constant"],["p","momentum"]],
      source: "src-toe", related: ["de-broglie","born-rule","schrodinger-tdse"],
      provenance: "in-text-prose"
    },
    {
      id: "uncertainty", name: "Heisenberg uncertainty principle",
      latex: "\\Delta x\\,\\Delta p \\;\\geq\\; \\frac{\\hbar}{2}",
      domain: "forces", category: "Quantum principles", drawable: false,
      behaviour: "You cannot pin down both an electron's position and its momentum at once. Sharpen one and the other blurs — this fuzziness is why electrons smear into clouds rather than sit on orbits. (Named in prose in the Hawking summary; the standard inequality is shown, and it follows directly from the commutator.)",
      variables: [["\\Delta x","spread in position"],["\\Delta p","spread in momentum"],["\\hbar","reduced Planck constant"]],
      source: "src-toe", related: ["commutator","born-rule","wave-duality"],
      provenance: "standard-supplied"
    },
    {
      id: "pauli-exclusion", name: "Pauli exclusion principle",
      latex: "\\text{no two electrons share all quantum numbers}",
      domain: "forces", category: "Quantum principles", drawable: false,
      behaviour: "Electrons refuse to occupy the same quantum state, so they stack into successive shells. This is why atoms have structure, why the periodic table works, and what holds white-dwarf stars up against gravity.",
      variables: [],
      source: "src-toe", related: ["energy-quant","ionic-bond","spin-basis"],
      provenance: "in-text-prose"
    },

    /* ---------------- SOUND, VIBRATIONS & PHONONS ---------------------- */
    { id: "harmonic-oscillator", name: "Quantum harmonic oscillator", latex: "E_n = \\hbar\\omega\\left(n+\\tfrac12\\right)", domain: "acoustics", category: "Vibrations", drawable: false,
      behaviour: "A bond or trapped atom vibrates with evenly-spaced energy rungs; even in its lowest state it keeps an irreducible zero-point wiggle ½ħω.",
      variables: [["n", "vibrational quantum number 0,1,2…"], ["\\omega", "angular frequency"], ["\\hbar", "reduced Planck constant"]],
      source: "src-schrodinger", related: ["zero-point","bond-vibration","phonon","morse-potential"], provenance: "standard-supplied" },
    { id: "bond-vibration", name: "Molecular bond vibration (Hooke's law)", latex: "\\omega = \\sqrt{\\dfrac{k}{\\mu}},\\quad \\mu=\\dfrac{m_1 m_2}{m_1+m_2}", domain: "acoustics", category: "Vibrations", drawable: false,
      behaviour: "Two bonded atoms oscillate like masses on a spring — a stiffer bond or lighter atoms vibrate faster. This is what sound shakes.",
      variables: [["k", "bond stiffness"], ["\\mu", "reduced mass"]],
      source: "src-dynamics", related: ["harmonic-oscillator","ir-spectroscopy","morse-potential","resonance"], provenance: "standard-supplied" },
    { id: "phonon", name: "Phonon (quantum of sound)", latex: "E = \\hbar\\omega,\\quad p = \\hbar q", domain: "acoustics", category: "Lattice waves", drawable: false,
      behaviour: "Collective vibrations of a crystal lattice are quantized into phonons — the particle of sound, carrying energy and momentum through the atoms.",
      variables: [["\\omega", "mode frequency"], ["q", "wavevector"]],
      source: "src-dynamics", sources: ["src-dynamics","src-library"], related: ["dispersion-relation","speed-of-sound","debye-model","harmonic-oscillator","motional-modes"], provenance: "standard-supplied" },
    { id: "dispersion-relation", name: "Phonon dispersion (1-D chain)", latex: "\\omega(q) = 2\\sqrt{\\dfrac{K}{m}}\\,\\left|\\sin\\dfrac{qa}{2}\\right|", domain: "acoustics", category: "Lattice waves", drawable: false,
      behaviour: "How a lattice vibration's frequency depends on its wavelength: long waves are ordinary sound, the shortest waves hit a maximum cut-off frequency.",
      variables: [["K", "spring constant"], ["m", "atom mass"], ["a", "lattice spacing"], ["q", "wavevector"]],
      source: "src-dynamics", related: ["phonon","speed-of-sound","optical-phonon"], provenance: "standard-supplied" },
    { id: "speed-of-sound", name: "Speed of sound in a solid", latex: "v = \\sqrt{\\dfrac{B}{\\rho}}", domain: "acoustics", category: "Lattice waves", drawable: false,
      behaviour: "Sound is a pressure wave passed atom-to-atom; stiffer (higher bulk modulus) and lighter (lower density) materials carry it faster.",
      variables: [["B", "bulk modulus"], ["\\rho", "density"]],
      source: "src-dynamics", related: ["phonon","dispersion-relation"], provenance: "standard-supplied" },
    { id: "optical-phonon", name: "Acoustic vs optical phonons", latex: "\\text{2-atom basis} \\Rightarrow \\text{acoustic + optical branches}", domain: "acoustics", category: "Lattice waves", drawable: false,
      behaviour: "With two atoms per cell, neighbours can swing together (acoustic, sound-like) or against each other (optical, which couples to infrared light).",
      variables: [],
      source: "src-dynamics", related: ["phonon","dispersion-relation","ir-spectroscopy"], provenance: "standard-supplied" },
    { id: "debye-model", name: "Debye model & heat capacity", latex: "C_V \\propto T^3\\ (T\\ll\\Theta_D)", domain: "acoustics", category: "Thermal", drawable: false,
      behaviour: "Treating a solid as a gas of phonons explains why heat capacity collapses as T³ at low temperature — the atoms' vibrations freeze out mode by mode.",
      variables: [["\\omega_D", "Debye (cut-off) frequency"], ["\\Theta_D", "Debye temperature"]],
      source: "src-dynamics", related: ["phonon","harmonic-oscillator"], provenance: "standard-supplied" },
    { id: "ir-spectroscopy", name: "Infrared / vibrational spectroscopy", latex: "\\Delta E = \\hbar\\omega_{vib}", domain: "acoustics", category: "Spectroscopy", drawable: false,
      behaviour: "Molecules absorb infrared light exactly at their bond-vibration frequencies — a fingerprint that reveals which bonds are present.",
      variables: [["\\omega_{vib}", "vibrational frequency"]],
      source: "src-dynamics", related: ["bond-vibration","raman","resonance","optical-phonon"], provenance: "standard-supplied" },
    { id: "raman", name: "Raman scattering", latex: "\\omega_{out} = \\omega_{in} \\pm \\omega_{vib}", domain: "acoustics", category: "Spectroscopy", drawable: false,
      behaviour: "Light scatters off a vibration and emerges shifted up or down by the vibrational quantum — an optical probe of phonons and molecular bonds.",
      variables: [["\\omega_{in}", "incident light"], ["\\omega_{vib}", "vibration quantum"]],
      source: "src-dynamics", related: ["ir-spectroscopy","phonon","bond-vibration"], provenance: "standard-supplied" },
    { id: "resonance", name: "Resonance", latex: "A(\\omega)\\ \\text{peaks at}\\ \\omega \\approx \\omega_0", domain: "acoustics", category: "Driven motion", drawable: false,
      behaviour: "Drive any oscillator at its natural frequency and the response blows up — why a sound or field at just the right pitch shakes atoms and bonds hardest.",
      variables: [["\\omega_0", "natural frequency"], ["A", "amplitude"]],
      source: "src-dynamics", related: ["bond-vibration","larmor","ir-spectroscopy"], provenance: "standard-supplied" },
    { id: "morse-potential", name: "Morse potential (anharmonic bond)", latex: "V(r) = D_e\\left(1 - e^{-a(r-r_e)}\\right)^2", domain: "acoustics", category: "Vibrations", drawable: false,
      behaviour: "A real bond's energy well: nearly harmonic near the bottom but flattening to a dissociation energy, so its vibrational rungs bunch up near the top.",
      variables: [["D_e", "well depth / dissociation energy"], ["r_e", "equilibrium length"], ["a", "well width"]],
      source: "src-dynamics", related: ["bond-vibration","lennard-jones","bond-energy","harmonic-oscillator"], provenance: "standard-supplied" },
    { id: "motional-modes", name: "Trapped-ion motional modes (phonon bus)", latex: "\\hat H = \\hbar\\nu\\,\\hat a^\\dagger \\hat a", domain: "acoustics", category: "Quantum hardware", drawable: false,
      behaviour: "Ions in a trap share collective vibrations; lasers use those phonons as a bus to entangle distant ions — sound literally wiring a quantum computer.",
      variables: [["\\nu", "trap frequency"], ["\\hat a", "phonon annihilation operator"]],
      source: "src-dynamics", sources: ["src-dynamics","src-library"], related: ["phonon","sideband-cooling","entanglement-state","qubit-hamiltonian"], provenance: "standard-supplied" },
    { id: "sideband-cooling", name: "Resolved-sideband cooling", latex: "\\omega_L = \\omega_0 - \\nu\\ (\\text{red sideband})", domain: "acoustics", category: "Quantum hardware", drawable: false,
      behaviour: "Tuning a laser just below an atom's transition removes one phonon per absorbed photon, cooling the atom toward its motional ground state.",
      variables: [["\\omega_L", "laser frequency"], ["\\nu", "trap frequency"], ["\\omega_0", "atomic transition"]],
      source: "src-dynamics", related: ["motional-modes","zero-point"], provenance: "standard-supplied" },
    { id: "zero-point", name: "Zero-point energy", latex: "E_0 = \\tfrac12\\hbar\\omega", domain: "acoustics", category: "Vibrations", drawable: false,
      behaviour: "Quantum atoms never stop moving — even at absolute zero they keep an irreducible ½ħω of vibration, a direct consequence of the uncertainty principle.",
      variables: [["\\omega", "frequency"]],
      source: "src-schrodinger", related: ["harmonic-oscillator","uncertainty"], provenance: "standard-supplied" },
    { id: "sonoluminescence", name: "Sonoluminescence (sound to light)", latex: "\\text{sound} \\rightarrow \\text{bubble collapse} \\rightarrow \\text{light}", domain: "acoustics", category: "Phenomena", drawable: false,
      behaviour: "Intense sound collapses a tiny bubble so violently it flashes light — acoustic energy concentrated by ~12 orders of magnitude into photons.",
      variables: [],
      source: "src-toe", related: ["resonance","speed-of-sound"], provenance: "standard-supplied" },

    /* ---------------- FORCES & BONDING --------------------------------- */
    { id: "covalent-bond", name: "Covalent bond (shared electrons)", latex: "\\text{H}\\!\\cdot + \\cdot\\text{H} \\rightarrow \\text{H:H}", domain: "bonding", category: "Chemical bonds", drawable: false,
      behaviour: "Two atoms share a pair of electrons that feel both nuclei; the shared cloud lowers the energy and glues the atoms together (the H₂ bond).",
      variables: [],
      source: "src-molecules", sources: ["src-molecules","src-library"], related: ["exchange","bond-energy","born-oppenheimer","electronegativity"], provenance: "in-text-prose" },
    { id: "metallic-bond", name: "Metallic bond (electron sea)", latex: "\\text{ion cores} + \\text{delocalized } e^-\\text{ sea}", domain: "bonding", category: "Chemical bonds", drawable: false,
      behaviour: "Metal atoms pool their valence electrons into a shared mobile sea — explaining conductivity, shine and malleability.",
      variables: [],
      source: "src-toe", related: ["covalent-bond","ionic-bond","em-force"], provenance: "standard-supplied" },
    { id: "van-der-waals", name: "Van der Waals / London dispersion", latex: "V(r) \\approx -\\dfrac{C_6}{r^6}", domain: "bonding", category: "Weak forces", drawable: false,
      behaviour: "Even neutral atoms attract weakly: a fleeting dipole induces one in a neighbour. The glue behind gecko feet and the liquefaction of noble gases.",
      variables: [["C_6", "dispersion coefficient"], ["r", "separation"]],
      source: "src-toe", sources: ["src-toe","src-library"], related: ["lennard-jones","hydrogen-bond","coulomb-force"], provenance: "standard-supplied" },
    { id: "hydrogen-bond", name: "Hydrogen bond", latex: "\\text{X--H} \\cdots \\text{Y}", domain: "bonding", category: "Weak forces", drawable: false,
      behaviour: "A hydrogen shared between two electronegative atoms — weak (~0.1–0.4 eV) yet it holds water together and zips the two strands of DNA.",
      variables: [],
      source: "src-toe", related: ["van-der-waals","electronegativity","coulomb-force"], provenance: "standard-supplied" },
    { id: "lennard-jones", name: "Lennard-Jones potential", latex: "V(r) = 4\\varepsilon\\left[\\left(\\dfrac{\\sigma}{r}\\right)^{12} - \\left(\\dfrac{\\sigma}{r}\\right)^{6}\\right]", domain: "bonding", category: "Potentials", drawable: false,
      behaviour: "The classic atom–atom potential: a steep repulsive wall (Pauli) plus a soft van der Waals attraction, with a minimum at the equilibrium spacing.",
      variables: [["\\varepsilon", "well depth"], ["\\sigma", "contact distance"]],
      source: "src-toe", related: ["van-der-waals","pauli-repulsion","morse-potential","bond-energy"], provenance: "standard-supplied" },
    { id: "pauli-repulsion", name: "Pauli repulsion (the 1/r¹² wall)", latex: "V_{rep} \\propto r^{-12}", domain: "bonding", category: "Quantum forces", drawable: false,
      behaviour: "When electron clouds overlap, the exclusion principle forces electrons into costly higher states — a steep repulsion that gives atoms their effective size.",
      variables: [],
      source: "src-toe", related: ["pauli-exclusion","lennard-jones"], provenance: "standard-supplied" },
    { id: "born-oppenheimer", name: "Born–Oppenheimer approximation", latex: "\\Psi \\approx \\psi_e(\\mathbf r;\\mathbf R)\\,\\chi_n(\\mathbf R)", domain: "bonding", category: "Method", drawable: false,
      behaviour: "Nuclei are ~2000× heavier than electrons, so freeze the nuclei, solve the electrons, then move the nuclei on the resulting potential-energy surface.",
      variables: [["\\mathbf r", "electron coordinates"], ["\\mathbf R", "nuclear coordinates"]],
      source: "src-molecules", related: ["bond-energy","covalent-bond","schrodinger-compact"], provenance: "standard-supplied" },
    { id: "bond-energy", name: "Potential-energy curve & dissociation", latex: "D_e = E(\\infty) - E(R_e)", domain: "bonding", category: "Chemical bonds", drawable: false,
      behaviour: "Energy vs bond length: a minimum at the equilibrium distance rising to the dissociation energy as atoms separate — exactly the computed H₂ curve.",
      variables: [["R_e", "equilibrium bond length"], ["D_e", "dissociation energy"]],
      source: "src-molecules", related: ["morse-potential","covalent-bond","born-oppenheimer","lennard-jones"], provenance: "standard-supplied" },
    { id: "electronegativity", name: "Electronegativity & bond polarity", latex: "\\Delta\\chi\\ \\text{large} \\Rightarrow \\text{ionic};\\ \\Delta\\chi\\approx 0 \\Rightarrow \\text{covalent}", domain: "bonding", category: "Chemical bonds", drawable: false,
      behaviour: "How strongly an atom pulls shared electrons; a big difference makes a bond ionic, a small one covalent — the dial between the two extremes.",
      variables: [["\\chi", "electronegativity"]],
      source: "src-logic", related: ["ionic-bond","covalent-bond","hydrogen-bond"], provenance: "standard-supplied" },
    { id: "screening", name: "Electron screening & effective charge", latex: "Z_{eff} = Z - \\sigma", domain: "bonding", category: "Atomic structure", drawable: false,
      behaviour: "Inner electrons shield the nucleus, so an outer electron feels a reduced effective charge — setting atomic size, ionization energy and bonding.",
      variables: [["Z", "nuclear charge"], ["\\sigma", "screening constant"]],
      source: "src-schrodinger", related: ["coulomb-force","em-force","energy-quant"], provenance: "standard-supplied" },

    /* ---------------- ENTANGLEMENT & NONLOCALITY ----------------------- */
    { id: "entanglement-state", name: "Entanglement", latex: "|\\psi\\rangle \\neq |a\\rangle \\otimes |b\\rangle", domain: "entanglement", category: "Core", drawable: false,
      behaviour: "Two particles can share one joint state with no separate states of their own — measuring one instantly fixes the other, however far apart they are.",
      variables: [],
      source: "src-qubit", related: ["bell-state","epr","reduced-density","teleportation"], provenance: "in-text" },
    { id: "bell-state", name: "Bell state (maximally entangled pair)", latex: "|\\Phi^+\\rangle = \\dfrac{|00\\rangle + |11\\rangle}{\\sqrt2}", domain: "entanglement", category: "Core", drawable: false,
      behaviour: "The prototypical entangled pair: perfectly correlated, yet each qubit alone is completely random — the fuel for teleportation and quantum networks.",
      variables: [],
      source: "src-gates", related: ["entanglement-state","cnot","teleportation","chsh"], provenance: "in-text" },
    { id: "epr", name: "EPR paradox", latex: "\\text{spooky action at a distance}", domain: "entanglement", category: "Foundations", drawable: false,
      behaviour: "Einstein–Podolsky–Rosen argued entanglement implied hidden variables or nonlocality; Bell later turned the disagreement into a testable inequality.",
      variables: [],
      source: "src-qubit", related: ["chsh","entanglement-state","no-signaling"], provenance: "in-text-prose" },
    { id: "chsh", name: "Bell / CHSH inequality", latex: "|S| \\le 2\\ (\\text{classical}),\\quad |S| \\le 2\\sqrt2\\ (\\text{quantum})", domain: "entanglement", category: "Foundations", drawable: false,
      behaviour: "Local hidden-variable theories obey |S|≤2; quantum mechanics reaches 2√2. Experiments violate the bound — nature is genuinely nonlocal (confirmed by the 2022 Aspect–Clauser–Zeilinger experiments).",
      variables: [["S", "CHSH correlation value"]],
      source: "src-qubit", sources: ["src-qubit","src-library"], related: ["epr","bell-state","entanglement-state"], provenance: "standard-supplied" },
    { id: "reduced-density", name: "Reduced density matrix", latex: "\\rho_A = \\mathrm{Tr}_B\\,|\\psi\\rangle\\langle\\psi|", domain: "entanglement", category: "Formalism", drawable: false,
      behaviour: "Ignore one half of an entangled pair and the other half looks mixed; tracing out the partner is how a subsystem forgets the whole.",
      variables: [["\\rho_A", "reduced state of A"]],
      source: "src-qubit", related: ["bloch-vector","entanglement-entropy","purity","decoherence"], provenance: "in-text" },
    { id: "entanglement-entropy", name: "Entanglement entropy", latex: "S = -\\mathrm{Tr}(\\rho_A \\log \\rho_A)", domain: "entanglement", category: "Measures", drawable: false,
      behaviour: "The von Neumann entropy of half a pure state measures how entangled the halves are — zero for a product state, maximal for a Bell state.",
      variables: [["\\rho_A", "reduced state"]],
      source: "src-library", related: ["reduced-density","schmidt","area-law","purity"], provenance: "standard-supplied" },
    { id: "schmidt", name: "Schmidt decomposition", latex: "|\\psi\\rangle = \\sum_i \\lambda_i\\,|a_i\\rangle|b_i\\rangle", domain: "entanglement", category: "Formalism", drawable: false,
      behaviour: "Any bipartite pure state has this diagonal form; the count of nonzero coefficients (the Schmidt rank) tells you whether — and how much — it is entangled.",
      variables: [["\\lambda_i", "Schmidt coefficients"]],
      source: "src-qubit", related: ["entanglement-entropy","reduced-density"], provenance: "standard-supplied" },
    { id: "concurrence", name: "Concurrence (2-qubit measure)", latex: "C(\\rho) \\in [0,1]", domain: "entanglement", category: "Measures", drawable: false,
      behaviour: "A computable number for two qubits: 0 = separable, 1 = a Bell state — quantifying exactly how entangled a pair is.",
      variables: [["C", "concurrence"]],
      source: "src-library", related: ["entanglement-entropy","bell-state","monogamy"], provenance: "standard-supplied" },
    { id: "monogamy", name: "Monogamy of entanglement", latex: "C_{AB}^2 + C_{AC}^2 \\le C_{A(BC)}^2", domain: "entanglement", category: "Measures", drawable: false,
      behaviour: "Entanglement can't be freely shared: if A is maximally entangled with B it has none left for C — the property that makes quantum key distribution secure.",
      variables: [],
      source: "src-library", related: ["concurrence","entanglement-state"], provenance: "standard-supplied" },
    { id: "no-cloning", name: "No-cloning theorem", latex: "\\nexists\\,U:\\ U|\\psi\\rangle|0\\rangle = |\\psi\\rangle|\\psi\\rangle\\ \\forall|\\psi\\rangle", domain: "entanglement", category: "No-go", drawable: false,
      behaviour: "An unknown quantum state cannot be copied. This secures quantum cryptography and forces teleportation to destroy the original.",
      variables: [],
      source: "src-qubit", related: ["teleportation","no-signaling","qubit-state"], provenance: "in-text" },
    { id: "no-signaling", name: "No-signaling", latex: "\\rho_B\\ \\text{independent of A's measurement}", domain: "entanglement", category: "No-go", drawable: false,
      behaviour: "Measuring your half of an entangled pair tells the partner nothing on its own — so entanglement cannot transmit information faster than light.",
      variables: [],
      source: "src-qubit", related: ["entanglement-state","teleportation","no-cloning"], provenance: "in-text-prose" },
    { id: "teleportation", name: "Quantum teleportation", latex: "|\\psi\\rangle + |\\Phi^+\\rangle + 2\\,\\text{cbits} \\rightarrow |\\psi\\rangle", domain: "entanglement", category: "Protocols", drawable: false,
      behaviour: "Send an unknown qubit using a shared Bell pair plus two classical bits; the original is destroyed and no matter travels — only the state.",
      variables: [],
      source: "src-qubit", related: ["bell-state","no-cloning","entanglement-swapping","cnot"], provenance: "in-text" },
    { id: "entanglement-swapping", name: "Entanglement swapping", latex: "\\text{Bell measurement entangles parties that never met}", domain: "entanglement", category: "Protocols", drawable: false,
      behaviour: "Teleport one half of a Bell pair and two particles that never interacted become entangled — the principle behind quantum repeaters and the quantum internet.",
      variables: [],
      source: "src-library", related: ["teleportation","bell-state","rydberg"], provenance: "standard-supplied" },
    { id: "ghz", name: "GHZ state (multipartite)", latex: "|\\text{GHZ}\\rangle = \\dfrac{|000\\rangle + |111\\rangle}{\\sqrt2}", domain: "entanglement", category: "Core", drawable: false,
      behaviour: "Three or more qubits in an all-or-nothing superposition: maximally entangled and extremely fragile — a sensitive stress-test of quantum hardware.",
      variables: [],
      source: "src-gates", related: ["bell-state","entanglement-state","decoherence"], provenance: "standard-supplied" },
    { id: "purity", name: "Purity & mixedness", latex: "\\mathrm{Tr}(\\rho^2) \\le 1", domain: "entanglement", category: "Measures", drawable: false,
      behaviour: "Tr(ρ²)=1 for a pure state, <1 for a mixed one. A subsystem of an entangled pair is mixed, so purity below 1 is a witness of entanglement.",
      variables: [["\\rho", "density matrix"]],
      source: "src-qubit", related: ["reduced-density","entanglement-entropy","decoherence"], provenance: "in-text" },
    { id: "decoherence", name: "Decoherence", latex: "\\rho \\rightarrow \\sum_k p_k\\,|k\\rangle\\langle k|", domain: "entanglement", category: "Open systems", drawable: false,
      behaviour: "Entangling with the environment leaks quantum information away, turning crisp superpositions into ordinary probabilities — why the world looks classical and why qubits must be protected.",
      variables: [["\\rho", "density matrix"]],
      source: "src-qubit", related: ["reduced-density","purity","entanglement-state"], provenance: "standard-supplied" },
    { id: "area-law", name: "Area law of entanglement", latex: "S \\propto \\partial(\\text{region})\\ \\text{(boundary, not volume)}", domain: "entanglement", category: "Many-body", drawable: false,
      behaviour: "Ground states of local Hamiltonians entangle mostly across their boundary, not their bulk — the reason tensor networks can simulate quantum matter efficiently.",
      variables: [["S", "entanglement entropy"]],
      source: "src-library", related: ["entanglement-entropy","exchange","spin-hamiltonian"], provenance: "standard-supplied" },

    /* ---------------- QUANTUM ALGORITHMS & PROTOCOLS (web-sourced) ------ */
    { id: "universal-gates", name: "Universal gate set (Clifford + T)", latex: "\\{H,S,\\text{CNOT}\\}+T \\Rightarrow \\text{any unitary}", domain: "algorithms", category: "Foundations", drawable: false,
      behaviour: "Any quantum computation compiles down to a small fixed set of gates: the Clifford group (H, S, CNOT) plus the non-Clifford T gate makes the set universal — every other operation is built from these.",
      variables: [["H", "Hadamard"], ["S", "phase gate"], ["T", "π/8 gate"]],
      source: "src-web", related: ["unitary-rotation", "cnot", "magic-state", "divincenzo"], provenance: "web-sourced" },
    { id: "oracle", name: "Oracle & quantum parallelism", latex: "U_f|x\\rangle|y\\rangle=|x\\rangle|y\\oplus f(x)\\rangle", domain: "algorithms", category: "Foundations", drawable: false,
      behaviour: "A black-box unitary evaluates f on a superposition of ALL inputs at once; a quantum algorithm's art is extracting one global property of f from that parallelism in few queries.",
      variables: [["U_f", "oracle for f"], ["x", "input register"], ["y", "answer qubit"]],
      source: "src-web", related: ["deutsch-jozsa", "grover", "amplitude-amplification"], provenance: "web-sourced" },
    { id: "deutsch-jozsa", name: "Deutsch–Jozsa algorithm", latex: "1\\ \\text{query vs}\\ 2^{n-1}+1\\ \\text{classical}", domain: "algorithms", category: "Algorithms", drawable: false,
      behaviour: "Decides whether a function is constant or balanced in a SINGLE query — the first clean proof that a quantum computer can be exponentially faster than deterministic classical computation.",
      variables: [["n", "input bits"]],
      source: "src-web", related: ["oracle", "qft", "grover"], provenance: "web-sourced" },
    { id: "grover", name: "Grover's search", latex: "O(\\sqrt{N})\\ \\text{vs classical } O(N)", domain: "algorithms", category: "Algorithms", drawable: false,
      behaviour: "Finds a marked item in an unstructured database of N entries in ~√N steps — a quadratic speedup — by rotating the state toward the answer via amplitude amplification.",
      variables: [["N", "database size"]],
      source: "src-web", related: ["amplitude-amplification", "oracle", "quantum-walk"], provenance: "web-sourced" },
    { id: "amplitude-amplification", name: "Amplitude amplification", latex: "P=\\sin^2\\!\\big((2k+1)\\theta\\big),\\ \\sin^2\\theta=\\tfrac{M}{N}", domain: "algorithms", category: "Techniques", drawable: false,
      behaviour: "The engine inside Grover: each iteration reflects the state about its mean, boosting the amplitude of the marked states so a measurement is likely to return one after ~√(N/M) steps.",
      variables: [["k", "iterations"], ["M", "# marked"], ["N", "total"]],
      source: "src-web", related: ["grover", "born-rule"], provenance: "web-sourced" },
    { id: "qft", name: "Quantum Fourier transform", latex: "|j\\rangle\\mapsto\\tfrac{1}{\\sqrt N}\\sum_k e^{2\\pi i jk/N}|k\\rangle", domain: "algorithms", category: "Subroutines", drawable: false,
      behaviour: "The quantum discrete Fourier transform, done in O(n²) gates instead of O(N log N); it turns periodicity into measurable phases — the heart of Shor's algorithm and phase estimation.",
      variables: [["N", "= 2ⁿ dimension"], ["j,k", "basis indices"]],
      source: "src-web", related: ["shor", "phase-estimation", "deutsch-jozsa"], provenance: "web-sourced" },
    { id: "phase-estimation", name: "Quantum phase estimation", latex: "U|\\psi\\rangle=e^{2\\pi i\\varphi}|\\psi\\rangle \\Rightarrow \\text{read }\\varphi", domain: "algorithms", category: "Subroutines", drawable: false,
      behaviour: "Extracts the eigenphase φ of a unitary acting on its eigenstate using the inverse QFT — the key subroutine behind Shor's factoring, the HHL solver and quantum-chemistry energies.",
      variables: [["U", "unitary"], ["\\varphi", "eigenphase"]],
      source: "src-web", related: ["qft", "shor", "hhl", "hamiltonian-op"], provenance: "web-sourced" },
    { id: "shor", name: "Shor's factoring algorithm", latex: "\\text{factor } N\\ \\text{in } O((\\log N)^3)", domain: "algorithms", category: "Algorithms", drawable: false,
      behaviour: "Factors large integers in polynomial time by reducing factoring to period-finding solved with the QFT — an exponential speedup that breaks RSA and drives the move to post-quantum cryptography.",
      variables: [["N", "integer to factor"]],
      source: "src-web", related: ["qft", "phase-estimation", "entanglement-state"], provenance: "web-sourced" },
    { id: "hhl", name: "HHL — quantum linear systems", latex: "A\\vec x=\\vec b,\\quad O(\\log N\\,\\kappa^2)", domain: "algorithms", category: "Algorithms", drawable: false,
      behaviour: "Solves a sparse, well-conditioned linear system exponentially faster than classical (O(log N·κ²) vs O(Nκ)) — but delivers the solution as a quantum state, not a directly readable vector.",
      variables: [["A", "matrix"], ["\\kappa", "condition number"], ["N", "size"]],
      source: "src-web", related: ["phase-estimation", "qft"], provenance: "web-sourced" },
    { id: "vqe", name: "Variational quantum eigensolver", latex: "E_0=\\min_{\\vec\\theta}\\langle\\psi(\\vec\\theta)|\\hat H|\\psi(\\vec\\theta)\\rangle", domain: "algorithms", category: "Hybrid (NISQ)", drawable: false,
      behaviour: "A hybrid quantum–classical loop that variationally lowers a trial state's energy to estimate a molecule's ground-state energy on noisy near-term hardware — the workhorse of quantum chemistry.",
      variables: [["\\vec\\theta", "circuit parameters"], ["\\hat H", "Hamiltonian"]],
      source: "src-web", related: ["qaoa", "hamiltonian-op", "schrodinger-compact", "exchange"], provenance: "web-sourced" },
    { id: "qaoa", name: "QAOA — approximate optimization", latex: "|\\vec\\gamma,\\vec\\beta\\rangle=\\prod_l e^{-i\\beta_l H_M}e^{-i\\gamma_l H_C}|+\\rangle^{\\otimes n}", domain: "algorithms", category: "Hybrid (NISQ)", drawable: false,
      behaviour: "Alternates a cost Hamiltonian and a mixer to approximately solve combinatorial optimization problems; noise-tolerant by design and a leading candidate for near-term quantum advantage.",
      variables: [["H_C", "cost"], ["H_M", "mixer"], ["\\gamma,\\beta", "angles"]],
      source: "src-web", related: ["vqe", "hamiltonian-op"], provenance: "web-sourced" },
    { id: "quantum-walk", name: "Quantum walk", latex: "\\sigma\\sim t\\ \\text{(ballistic) vs }\\sqrt{t}\\ \\text{classical}", domain: "algorithms", category: "Techniques", drawable: false,
      behaviour: "The quantum version of a random walk spreads ballistically (∝t) instead of diffusively (∝√t), giving algorithmic speedups for search and graph problems.",
      variables: [["\\sigma", "spread"], ["t", "steps"]],
      source: "src-web", related: ["grover", "amplitude-amplification"], provenance: "web-sourced" },
    { id: "magic-state", name: "Magic-state distillation", latex: "\\text{many noisy }|T\\rangle \\rightarrow \\text{few clean }|T\\rangle", domain: "algorithms", category: "Fault tolerance", drawable: false,
      behaviour: "Clifford gates alone aren't universal and the T gate can't be made transversal (Eastin–Knill theorem); distilling high-fidelity 'magic' states injects the missing non-Clifford gate fault-tolerantly.",
      variables: [["|T\\rangle", "magic state"]],
      source: "src-web", related: ["universal-gates", "gate-fidelity", "decoherence"], provenance: "web-sourced" },

    /* ---------------- QUBIT HARDWARE & CONTROL (web-sourced) ------------ */
    { id: "transmon", name: "Transmon — superconducting qubit", latex: "T_1\\!\\sim\\!0.4\\,\\text{ms},\\ T_2\\!\\sim\\!1\\,\\text{ms (2025)}", domain: "hardware", category: "Platforms", drawable: false,
      behaviour: "A superconducting LC circuit made anharmonic by a Josephson junction so its lowest two levels form a qubit; 2025 devices reach T₁≈0.4 ms and T₂≈1 ms, enough for thousands of gates.",
      variables: [["T_1", "energy-relaxation time"], ["T_2", "dephasing time"]],
      source: "src-web", related: ["qubit-hamiltonian", "coherence-times", "gate-fidelity", "decoherence"], provenance: "web-sourced" },
    { id: "trapped-ion-qubit", name: "Trapped-ion qubit", latex: "|0\\rangle,|1\\rangle=\\text{hyperfine/electronic levels}", domain: "hardware", category: "Platforms", drawable: false,
      behaviour: "Single ions held in electromagnetic traps store qubits in long-lived internal states; shared motional modes (phonons) mediate entangling gates with the highest fidelities yet demonstrated.",
      variables: [],
      source: "src-web", related: ["motional-modes", "sideband-cooling", "gate-fidelity", "spin-basis"], provenance: "web-sourced" },
    { id: "photonic-qubit", name: "Photonic qubit", latex: "|0\\rangle=|H\\rangle,\\ |1\\rangle=|V\\rangle", domain: "hardware", category: "Platforms", drawable: false,
      behaviour: "Encodes a qubit in a photon's polarization or path; photons barely decohere and travel through fibre — ideal for quantum communication — but two-photon gates are probabilistic.",
      variables: [],
      source: "src-web", related: ["entanglement-state", "teleportation", "gate-fidelity"], provenance: "web-sourced" },
    { id: "spin-qubit", name: "Semiconductor spin qubit", latex: "|0\\rangle=|\\!\\uparrow\\rangle,\\ |1\\rangle=|\\!\\downarrow\\rangle", domain: "hardware", category: "Platforms", drawable: false,
      behaviour: "A single electron or nuclear spin in a quantum dot or donor atom; tiny and CMOS-compatible, controlled by magnetic resonance and exchange coupling to its neighbours.",
      variables: [],
      source: "src-web", related: ["spin-basis", "larmor", "exchange", "coherence-times"], provenance: "web-sourced" },
    { id: "coherence-times", name: "Coherence times T₁ & T₂", latex: "\\rho_{01}(t)=\\rho_{01}(0)\\,e^{-t/T_2}", domain: "hardware", category: "Control", drawable: false,
      behaviour: "T₁ is how long a qubit keeps its energy (|1⟩→|0⟩), T₂ how long it keeps its phase; together they cap how many gates run before decoherence erases the quantum information.",
      variables: [["T_1", "relaxation time"], ["T_2", "dephasing time"]],
      source: "src-web", related: ["decoherence", "transmon", "purity", "gate-fidelity"], provenance: "web-sourced" },
    { id: "gate-fidelity", name: "Gate fidelity & error rate", latex: "F=\\langle\\psi_{\\text{ideal}}|\\rho|\\psi_{\\text{ideal}}\\rangle,\\ \\varepsilon=1-F", domain: "hardware", category: "Control", drawable: false,
      behaviour: "How close a real gate is to the ideal unitary; the error rate ε=1−F must fall below the error-correction threshold (~1%) for fault tolerance to kick in.",
      variables: [["F", "fidelity"], ["\\varepsilon", "error rate"]],
      source: "src-web", related: ["coherence-times", "divincenzo", "quantum-volume", "decoherence"], provenance: "web-sourced" },
    { id: "divincenzo", name: "DiVincenzo criteria", latex: "5\\ \\text{requirements for a quantum computer}", domain: "hardware", category: "Foundations", drawable: false,
      behaviour: "DiVincenzo's five conditions (2000): scalable well-defined qubits, reliable initialization, long coherence, a universal gate set, and qubit-specific measurement (+2 more for quantum communication).",
      variables: [],
      source: "src-web", related: ["universal-gates", "coherence-times", "born-rule", "qubit-hamiltonian"], provenance: "web-sourced" },
    { id: "quantum-volume", name: "Quantum volume", latex: "V_Q=2^{\\min(n,\\,d)}", domain: "hardware", category: "Benchmarks", drawable: false,
      behaviour: "A single hardware benchmark combining qubit count and achievable circuit depth d; it rises only when more qubits AND lower error come together, so it tracks usable quantum power.",
      variables: [["n", "qubits"], ["d", "circuit depth"]],
      source: "src-web", related: ["gate-fidelity", "divincenzo"], provenance: "web-sourced" },

    /* ---------------- LIGHT–MATTER & SLOW LIGHT (web-sourced) ----------- */
    { id: "refractive-index", name: "Refractive index & phase velocity", latex: "v=\\dfrac{c}{n},\\quad n_1\\sin\\theta_1=n_2\\sin\\theta_2", domain: "optics", category: "Light in matter", drawable: false,
      behaviour: "Light slows to c/n inside a medium and bends at a boundary (Snell's law); the atoms' polarizability sets n, the first step toward dramatically slowing light.",
      variables: [["n", "refractive index"], ["c", "speed of light"], ["\\theta", "ray angle"]],
      source: "src-web", related: ["group-velocity", "slow-light", "de-broglie"], provenance: "web-sourced" },
    { id: "group-velocity", name: "Group velocity & dispersion", latex: "v_g=\\dfrac{d\\omega}{dk}=\\dfrac{c}{n_g},\\ n_g=n+\\omega\\dfrac{dn}{d\\omega}", domain: "optics", category: "Light in matter", drawable: false,
      behaviour: "A light pulse (wave packet) travels at the group velocity, not c; a steep change of refractive index with frequency makes the group index n_g enormous — the route to ultra-slow light.",
      variables: [["v_g", "group velocity"], ["n_g", "group index"], ["\\omega", "frequency"]],
      source: "src-web", related: ["refractive-index", "slow-light", "wave-duality", "dispersion-relation"], provenance: "web-sourced" },
    { id: "slow-light", name: "Slow & stopped light (EIT)", latex: "v_g=\\dfrac{c}{n_g},\\quad n_g\\sim 10^{7}", domain: "optics", category: "Quantum optics", drawable: false,
      behaviour: "Electromagnetically induced transparency opens a transparency window with razor-steep dispersion; Lene Hau slowed light to 17 m/s in a sodium BEC (1999) and STOPPED it in 2001, storing the pulse in the atoms and reading it back out.",
      variables: [["v_g", "group velocity"], ["n_g", "group index (≈2×10⁷)"]],
      source: "src-web", related: ["group-velocity", "refractive-index", "rydberg", "entanglement-state"], provenance: "web-sourced" },
    { id: "radiation-pressure", name: "Radiation pressure & photon momentum", latex: "p=\\hbar k=\\dfrac{h}{\\lambda},\\quad F=\\dfrac{P}{c}", domain: "optics", category: "Light forces", drawable: false,
      behaviour: "Photons carry momentum ħk, so absorbing or scattering them pushes matter — the force behind laser cooling, optical tweezers and solar sails.",
      variables: [["p", "photon momentum"], ["k", "wavenumber"], ["P", "optical power"]],
      source: "src-web", related: ["momentum-vec", "laser-cooling", "optical-tweezers", "de-broglie"], provenance: "web-sourced" },
    { id: "laser-cooling", name: "Laser cooling (Doppler)", latex: "T_D=\\dfrac{\\hbar\\Gamma}{2k_B},\\quad v_r=\\dfrac{\\hbar k}{m}", domain: "optics", category: "Light forces", drawable: false,
      behaviour: "Red-detuned lasers preferentially slow atoms moving toward them (Doppler shift) one photon recoil at a time; the Doppler limit is ~240 µK for sodium, and sub-Doppler tricks reach ~40 µK — the gateway to BECs.",
      variables: [["T_D", "Doppler limit"], ["\\Gamma", "transition linewidth"], ["v_r", "recoil velocity"]],
      source: "src-web", related: ["radiation-pressure", "sideband-cooling", "resonance", "larmor"], provenance: "web-sourced" },
    { id: "optical-tweezers", name: "Optical tweezers", latex: "U(\\vec r)=-\\tfrac12\\,\\alpha\\,|E(\\vec r)|^2", domain: "optics", category: "Light forces", drawable: false,
      behaviour: "A tightly focused laser traps a neutral atom or particle at its intensity peak via the dipole force; the tool that builds reconfigurable neutral-atom qubit arrays (optical tweezers).",
      variables: [["U", "dipole potential"], ["\\alpha", "polarizability"], ["E", "field"]],
      source: "src-web", related: ["radiation-pressure", "rydberg", "trapped-ion-qubit"], provenance: "web-sourced" },

    /* ---------------- RADIATION, QUANTA & STATES OF MATTER -------------- */
    { id: "photoelectric-effect", name: "Photoelectric effect", latex: "K_{\\max}=h f-\\phi", domain: "quantum", category: "Old quantum theory", drawable: false,
      behaviour: "Light ejects electrons from a metal only if each photon's energy hf beats the work function φ — Einstein's 1905 proof that light is quantized into photons.",
      variables: [["K_{\\max}", "max electron energy"], ["f", "light frequency"], ["\\phi", "work function"]],
      source: "src-web", related: ["work-function", "energy-quant", "de-broglie", "radiation-pressure"], provenance: "web-sourced" },
    { id: "work-function", name: "Work function", latex: "\\phi:\\ \\text{Cs }2.1 \\rightarrow \\text{Pt }6.4\\,\\text{eV}", domain: "quantum", category: "Surfaces", drawable: false,
      behaviour: "The minimum energy to free an electron from a metal surface; low-φ metals (Cs, Na, K) emit under visible light, high-φ metals (Cu, Pt) need ultraviolet.",
      variables: [["\\phi", "work function (eV)"]],
      source: "src-web", related: ["photoelectric-effect", "metallic-bond", "screening"], provenance: "web-sourced" },
    { id: "zeeman-effect", name: "Zeeman effect", latex: "\\Delta E=g\\,\\mu_B\\,m_j\\,B", domain: "spin", category: "Magnetism", drawable: false,
      behaviour: "A magnetic field splits a spectral line into components spaced by gμ_B B — direct evidence of the electron's quantized magnetic moment and spin.",
      variables: [["g", "Landé factor"], ["\\mu_B", "Bohr magneton"], ["m_j", "magnetic quantum number"], ["B", "field"]],
      source: "src-web", related: ["spin-moment", "larmor", "energy-quant", "born-rule"], provenance: "web-sourced" },
    { id: "planck-law", name: "Blackbody radiation (Planck, Wien, Stefan)", latex: "\\lambda_{\\max}=\\dfrac{b}{T},\\quad M=\\sigma T^4", domain: "thermal", category: "Radiation", drawable: false,
      behaviour: "Every warm body glows; Planck quantizing light fixed the spectrum (ending the 'ultraviolet catastrophe'), Wien's law gives the peak colour, Stefan–Boltzmann the total power.",
      variables: [["\\lambda_{\\max}", "peak wavelength"], ["b", "Wien constant"], ["\\sigma", "Stefan–Boltzmann constant"], ["T", "temperature"]],
      source: "src-web", related: ["energy-quant", "photoelectric-effect", "wave-duality", "de-broglie"], provenance: "web-sourced" },
    { id: "bec", name: "Bose–Einstein condensate", latex: "T_c=\\dfrac{2\\pi\\hbar^2}{m k_B}\\left(\\dfrac{n}{2.612}\\right)^{2/3}", domain: "thermal", category: "States of matter", drawable: false,
      behaviour: "Cool bosonic atoms until their matter waves overlap and merge into a single quantum state — first made in 1995 with rubidium-87 at 170 nK (Cornell, Wieman, Ketterle).",
      variables: [["T_c", "critical temperature"], ["m", "atom mass"], ["n", "number density"]],
      source: "src-web", related: ["de-broglie", "bose-einstein-stats", "laser-cooling", "slow-light"], provenance: "web-sourced" },
    { id: "bose-einstein-stats", name: "Bose–Einstein statistics", latex: "\\langle n\\rangle=\\dfrac{1}{e^{(\\varepsilon-\\mu)/k_BT}-1}", domain: "thermal", category: "Statistics", drawable: false,
      behaviour: "Identical bosons love to pile into the same state (the −1 in the denominator); below T_c a macroscopic fraction crashes into the ground state — that's the condensate.",
      variables: [["\\langle n\\rangle", "mean occupation"], ["\\varepsilon", "level energy"], ["\\mu", "chemical potential"]],
      source: "src-web", related: ["bec", "pauli-exclusion", "energy-quant"], provenance: "web-sourced" },

    /* ================= PARTICLE PHYSICS — the Standard Model ============ *
     * Fetched from arXiv 2025–2026 (see src-sm-lectures, src-qed-primer,   *
     * src-qgp, src-lqcd-eic, src-higgs, src-wmass, src-ewk-angle).         */
    { id: "dirac-eq", name: "Dirac equation", latex: "\\left(i\\gamma^\\mu\\partial_\\mu - m\\right)\\psi = 0", domain: "particle", category: "Relativistic fields", drawable: true,
      behaviour: "The relativistic wave equation for every spin-½ matter particle (electron, quark, neutrino). It bakes in E²=p²+m², automatically packages a particle with its antiparticle, and its mass term links the left- and right-handed halves of the field.",
      variables: [["\\psi", "Dirac spinor (4 components)"], ["\\gamma^\\mu", "Dirac matrices"], ["m", "particle mass"], ["\\partial_\\mu", "spacetime derivative"]],
      source: "src-sm-lectures", related: ["schrodinger-tdse", "rel-energy", "qed-lagrangian", "spin-moment", "quark-model"], provenance: "web-sourced" },

    { id: "qed-lagrangian", name: "QED Lagrangian (electron ↔ photon)", latex: "\\mathcal{L}_{\\text{QED}}=-\\tfrac{1}{4}F_{\\mu\\nu}F^{\\mu\\nu}+\\bar\\psi\\left(i\\gamma^\\mu D_\\mu-m\\right)\\psi,\\;\\; D_\\mu=\\partial_\\mu-ieA_\\mu", domain: "particle", category: "Quantum electrodynamics", drawable: true,
      behaviour: "The full quantum theory of light and charge. The covariant derivative D_μ makes electrons emit and absorb photons at a single vertex of strength e — and that one vertex generates all of electromagnetism (Coulomb force, scattering, radiation).",
      variables: [["A_\\mu", "photon field"], ["F_{\\mu\\nu}", "EM field-strength tensor"], ["\\psi", "electron field"], ["e", "electric charge"], ["D_\\mu", "gauge-covariant derivative"]],
      source: "src-sm-lectures", related: ["maxwell-tensor", "coulomb-force", "em-force", "fine-structure", "photon", "dirac-eq"], provenance: "web-sourced" },

    { id: "fine-structure", name: "Fine-structure constant", latex: "\\alpha=\\dfrac{e^2}{4\\pi\\varepsilon_0\\hbar c}\\approx\\dfrac{1}{137}", domain: "particle", category: "Quantum electrodynamics", drawable: false,
      behaviour: "The dimensionless strength of the electromagnetic force — the probability amplitude for an electron to emit a photon at each vertex. Because α≈1/137 ≪ 1, QED can be computed order-by-order (perturbatively). (The papers use α as the coupling; the value 1/137 is standard.)",
      variables: [["\\alpha", "coupling strength"], ["e", "electric charge"], ["\\varepsilon_0", "vacuum permittivity"], ["\\hbar", "reduced Planck constant"], ["c", "speed of light"]],
      source: "src-qed-primer", related: ["qed-lagrangian", "bohr-quant", "photon", "coulomb-force"], provenance: "standard-supplied" },

    { id: "schwinger-field", name: "Schwinger critical field", latex: "E_{\\text{crit}}=\\dfrac{m_e^2 c^3}{e\\hbar}\\approx1.32\\times10^{18}\\ \\text{V/m}", domain: "particle", category: "Strong-field QED", drawable: false,
      behaviour: "The electric-field scale at which the vacuum itself becomes unstable and pulls real electron–positron pairs out of nothing. Below it, pair creation is exponentially suppressed; approaching it, empty space 'sparks'.",
      variables: [["m_e", "electron mass"], ["e", "elementary charge"], ["\\hbar", "reduced Planck constant"], ["c", "speed of light"]],
      source: "src-qed-primer", related: ["qed-lagrangian", "mass-energy", "fine-structure"], provenance: "web-sourced" },

    { id: "strong-field-param", name: "Strong-field parameter & dressed mass", latex: "\\xi=\\dfrac{|e|E}{m_e c\\,\\omega_L},\\qquad m_e^{\\text{eff}}=m_e\\sqrt{1+\\xi^2}", domain: "particle", category: "Strong-field QED", drawable: false,
      behaviour: "Measures how violently a laser shakes an electron. Above ξ≈1 the electron couples to the field to all orders and behaves as if it were heavier (a 'dressed' mass) — shifting the Compton scattering edge, a measurable signature.",
      variables: [["\\xi", "classical nonlinearity (a₀)"], ["E", "field strength"], ["\\omega_L", "laser frequency"], ["m_e^{\\text{eff}}", "effective electron mass"]],
      source: "src-qed-primer", related: ["schwinger-field", "qed-lagrangian", "rel-energy"], provenance: "web-sourced" },

    { id: "yang-mills", name: "Yang–Mills field strength (self-interaction)", latex: "F^a_{\\mu\\nu}=\\partial_\\mu A^a_\\nu-\\partial_\\nu A^a_\\mu+f^{abc}A^b_\\mu A^c_\\nu", domain: "particle", category: "Gauge theory", drawable: true,
      behaviour: "The template for the strong and weak forces. Unlike the neutral photon, the extra f^{abc}A^bA^c term means the force-carriers themselves carry charge and interact with each other — the origin of gluon self-coupling, confinement and asymptotic freedom.",
      variables: [["A^a_\\mu", "gauge (boson) fields"], ["f^{abc}", "structure constants"], ["a", "generator index"]],
      source: "src-sm-lectures", related: ["qcd-lagrangian", "electroweak", "asymptotic-freedom", "maxwell-tensor"], provenance: "web-sourced" },

    { id: "qcd-lagrangian", name: "QCD Lagrangian (quarks + gluons)", latex: "\\mathcal{L}_{\\text{QCD}}=-\\tfrac{1}{4}F^a_{\\mu\\nu}F^{a\\,\\mu\\nu}+\\bar\\psi\\left(i\\gamma^\\mu D_\\mu-m\\right)\\psi", domain: "particle", category: "Quantum chromodynamics", drawable: true,
      behaviour: "The theory of the strong force (gauge group SU(3), 8 gluons). It binds quarks into protons, neutrons and every hadron; because F^aF^a contains cubic and quartic gluon terms, gluons scatter off one another — so they are never free.",
      variables: [["A^a_\\mu", "8 gluon fields"], ["\\psi", "quark field (color triplet)"], ["F^a_{\\mu\\nu}", "gluon field strength"], ["m", "quark mass"]],
      source: "src-sm-lectures", related: ["yang-mills", "confinement", "asymptotic-freedom", "strong-force", "quark-model", "residual-strong"], provenance: "web-sourced" },

    { id: "asymptotic-freedom", name: "Asymptotic freedom (running of α_s)", latex: "\\alpha_s(Q^2)=\\dfrac{12\\pi}{(33-2n_f)\\ln\\!\\big(Q^2/\\Lambda_{\\text{QCD}}^2\\big)}", domain: "particle", category: "Quantum chromodynamics", drawable: false,
      behaviour: "The strong coupling shrinks at high energy / short distance, so quarks act almost free inside a proton — but grows at low energy, trapping them (confinement). The beta function β(g)=μ dg/dμ is negative for QCD. (Formula is the standard LO result; the concept is in the papers.)",
      variables: [["\\alpha_s", "strong coupling"], ["Q^2", "energy scale"], ["n_f", "number of quark flavors"], ["\\Lambda_{\\text{QCD}}", "QCD scale ≈0.2 GeV"]],
      source: "src-qgp", related: ["qcd-lagrangian", "confinement", "proton-mass", "yang-mills"], provenance: "standard-supplied" },

    { id: "confinement", name: "Color confinement (quark potential)", latex: "V(r)=-\\dfrac{4}{3}\\dfrac{\\alpha_s}{r}+\\sigma r", domain: "particle", category: "Quantum chromodynamics", drawable: true,
      behaviour: "The energy to separate two quarks grows without bound (the linear σr term), so pulling one out eventually snaps the color 'string' into new quark–antiquark pairs. That is why an isolated quark is never seen. (Cornell form is standard; screening/confinement discussed in the QGP paper.)",
      variables: [["r", "quark separation"], ["\\alpha_s", "strong coupling"], ["\\sigma", "string tension ≈0.19 GeV²"], ["4/3", "SU(3) color factor"]],
      source: "src-qgp", related: ["qcd-lagrangian", "quark-model", "proton-mass", "strong-force"], provenance: "standard-supplied" },

    { id: "quark-model", name: "Quark content of the nucleon", latex: "p=(uud),\\qquad n=(udd)", domain: "particle", category: "Hadrons", drawable: true,
      behaviour: "A proton is two up quarks + one down; a neutron is one up + two down. The valence quarks fix the charge and identity; in a quark–gluon plasma the number of valence quarks (2 for mesons, 3 for baryons) shows up in how the fluid flows.",
      variables: [["u", "up quark (charge +2/3)"], ["d", "down quark (charge −1/3)"], ["p", "proton"], ["n", "neutron"]],
      source: "src-qgp", related: ["qcd-lagrangian", "confinement", "proton-mass", "nuclear-hamiltonian"], provenance: "standard-supplied" },

    { id: "proton-mass", name: "Proton mass = QCD field energy", latex: "\\textstyle\\sum_q\\langle x\\rangle_q+\\langle x\\rangle_g=1,\\quad \\langle x\\rangle_g\\approx0.45", domain: "particle", category: "Hadron structure", drawable: true,
      behaviour: "The three valence quarks weigh ~1% of the proton; the other ~99% of its 938 MeV is the energy of the gluon field and quark motion (E=mc²). Lattice QCD shows gluons carry about 45% of the proton's momentum and much of its spin.",
      variables: [["\\langle x\\rangle_q", "quark momentum fraction"], ["\\langle x\\rangle_g", "gluon momentum fraction ≈0.45"]],
      source: "src-lqcd-eic", related: ["mass-energy", "quark-model", "confinement", "pdf"], provenance: "web-sourced" },

    { id: "pdf", name: "Parton distribution function", latex: "\\langle x\\rangle_q=\\int_0^1 x\\,f_q(x)\\,dx,\\qquad f(x)=N\\,x^{a}(1-x)^{b}", domain: "particle", category: "Hadron structure", drawable: false,
      behaviour: "f(x) gives the probability of finding a quark or gluon carrying fraction x of the proton's momentum. Their momentum fractions must sum to 1 — which is why the ~45% gluon share matters. Extracted from LHC data and from the lattice.",
      variables: [["x", "Bjorken momentum fraction"], ["f_q(x)", "quark PDF"], ["N,a,b", "fit parameters"]],
      source: "src-lqcd-eic", related: ["proton-mass", "quark-model", "qcd-lagrangian"], provenance: "web-sourced" },

    { id: "electroweak", name: "Electroweak unification (γ, W, Z)", latex: "A_\\mu=B_\\mu\\cos\\theta_W+W^3_\\mu\\sin\\theta_W,\\qquad g\\sin\\theta_W=g'\\cos\\theta_W=e", domain: "particle", category: "Electroweak", drawable: true,
      behaviour: "Above the electroweak scale the weak and electromagnetic forces are one. The physical photon (massless) and Z boson (massive) are rotated mixtures of the raw SU(2) and U(1) fields, the rotation set by the weak mixing angle θ_W.",
      variables: [["A_\\mu", "photon"], ["Z_\\mu", "Z boson"], ["W^3_\\mu,B_\\mu", "raw SU(2)/U(1) fields"], ["\\theta_W", "weak mixing angle"], ["g,g'", "SU(2), U(1) couplings"]],
      source: "src-ewk-angle", related: ["weak-mixing", "w-boson-mass", "higgs-mechanism", "four-forces", "sm-gauge-group", "yang-mills"], provenance: "web-sourced" },

    { id: "weak-mixing", name: "Weak mixing angle", latex: "\\sin^2\\theta_W=1-\\dfrac{M_W^2}{M_Z^2}\\approx0.2316", domain: "particle", category: "Electroweak", drawable: false,
      behaviour: "Fixes the relative strengths of the weak neutral current and electromagnetism, and how the Z couples differently to left- vs right-handed particles. The 2025 best single measurement is sin²θ_eff = 0.23156 ± 0.00024 — bang on the Standard-Model prediction.",
      variables: [["\\theta_W", "weak (Weinberg) mixing angle"], ["M_W,M_Z", "W and Z masses"]],
      source: "src-ewk-angle", related: ["electroweak", "w-boson-mass", "z-boson"], provenance: "web-sourced" },

    { id: "w-boson-mass", name: "W boson mass & the EW master relation", latex: "M_W^2\\Big(1-\\tfrac{M_W^2}{M_Z^2}\\Big)=\\dfrac{\\pi\\alpha}{\\sqrt2\\,G_F}(1+\\Delta r),\\quad M_W\\approx80.36\\ \\text{GeV}", domain: "particle", category: "Electroweak", drawable: false,
      behaviour: "Given three ultra-precise inputs (α, G_F, M_Z) this predicts the W mass; the loop-correction term Δr packages top-quark and Higgs quantum effects. Any mismatch with the measured M_W = 80.361 ± 0.008 GeV (2025) would signal new physics.",
      variables: [["M_W", "W boson mass"], ["M_Z", "Z boson mass"], ["\\alpha", "fine-structure constant"], ["G_F", "Fermi constant"], ["\\Delta r", "radiative corrections"]],
      source: "src-wmass", related: ["weak-mixing", "z-boson", "electroweak", "higgs-mechanism"], provenance: "web-sourced" },

    { id: "z-boson", name: "Z boson mass", latex: "M_Z\\approx91.19\\ \\text{GeV},\\qquad M_W=M_Z\\cos\\theta_W", domain: "particle", category: "Electroweak", drawable: false,
      behaviour: "The neutral weak-force carrier, measured to 2 parts in 10⁵ at LEP (M_Z = 91.1875 ± 0.0021 GeV). Its mass and the W mass are locked together by the weak mixing angle — a precision test of the whole electroweak theory.",
      variables: [["M_Z", "Z boson mass"], ["M_W", "W boson mass"], ["\\theta_W", "weak mixing angle"]],
      source: "src-wmass", related: ["w-boson-mass", "weak-mixing", "electroweak"], provenance: "web-sourced" },

    { id: "higgs-mechanism", name: "Higgs mechanism (mass from the vacuum)", latex: "\\langle H\\rangle=\\tfrac{1}{\\sqrt2}\\begin{pmatrix}0\\\\ v\\end{pmatrix},\\qquad m_W=\\dfrac{ev}{2\\sin\\theta_W}", domain: "particle", category: "Higgs sector", drawable: true,
      behaviour: "The Higgs field settles to a nonzero value v everywhere in empty space, hiding the electroweak symmetry. As the W and Z plow through this background they act massive, while the photon stays massless — that's why the weak force is short-range.",
      variables: [["\\langle H\\rangle", "Higgs vacuum value"], ["v", "≈246 GeV"], ["m_W", "W mass"], ["\\theta_W", "weak mixing angle"]],
      source: "src-sm-lectures", related: ["higgs-potential", "w-boson-mass", "electroweak", "yukawa", "higgs-mass"], provenance: "web-sourced" },

    { id: "higgs-potential", name: "Higgs potential (Mexican hat)", latex: "V(\\phi)=-\\mu^2\\,\\phi^\\dagger\\phi+\\lambda\\,(\\phi^\\dagger\\phi)^2,\\qquad v\\approx246\\ \\text{GeV}", domain: "particle", category: "Higgs sector", drawable: true,
      behaviour: "The potential's minimum sits on a circle away from zero, so the Higgs field spontaneously picks a nonzero vacuum value v — the seed of all mass in the Standard Model. The shape (self-coupling) decides whether our vacuum is truly stable.",
      variables: [["V(\\phi)", "Higgs potential"], ["\\phi", "Higgs field"], ["\\mu^2,\\lambda", "potential parameters"], ["v", "vacuum expectation value ≈246 GeV"]],
      source: "src-higgs", related: ["higgs-mechanism", "higgs-selfcoupling", "higgs-mass", "yukawa"], provenance: "web-sourced" },

    { id: "higgs-mass", name: "Higgs boson mass", latex: "M_H\\approx125.2\\ \\text{GeV}", domain: "particle", category: "Higgs sector", drawable: false,
      behaviour: "Discovered at the LHC in 2012 at ~125 GeV; a free parameter of the Standard Model. Together with the top-quark mass it decides whether the electroweak vacuum is stable, metastable, or unstable. HL-LHC aims to pin it to ±21 MeV.",
      variables: [["M_H", "Higgs boson mass"]],
      source: "src-higgs", related: ["higgs-potential", "higgs-mechanism", "higgs-selfcoupling"], provenance: "web-sourced" },

    { id: "higgs-selfcoupling", name: "Higgs self-coupling", latex: "\\lambda_3=\\dfrac{m_H^2}{2v^2}", domain: "particle", category: "Higgs sector", drawable: false,
      behaviour: "How strongly the Higgs interacts with itself — it fixes the shape of the Higgs potential and is probed by making two Higgs bosons at once. Measuring it tests whether the vacuum sits at the true minimum of the potential.",
      variables: [["\\lambda_3", "trilinear self-coupling"], ["m_H", "Higgs mass"], ["v", "vacuum value ≈246 GeV"]],
      source: "src-higgs", related: ["higgs-potential", "higgs-mass", "higgs-mechanism"], provenance: "web-sourced" },

    { id: "yukawa", name: "Yukawa coupling (fermion mass)", latex: "m_f=\\dfrac{y_f\\,v}{\\sqrt2}", domain: "particle", category: "Higgs sector", drawable: true,
      behaviour: "A fermion's mass is not fundamental — it is how strongly that fermion talks to the Higgs field (its Yukawa coupling y_f) times the vacuum value v. The top quark is heavy because y_t≈1; the electron is light because its coupling is tiny.",
      variables: [["m_f", "fermion mass"], ["y_f", "Yukawa coupling"], ["v", "Higgs vacuum value ≈246 GeV"]],
      source: "src-sm-lectures", related: ["higgs-mechanism", "higgs-potential", "dirac-eq", "quark-model"], provenance: "web-sourced" },

    { id: "sm-gauge-group", name: "Standard Model gauge group", latex: "G_{\\text{SM}}=SU(3)_c\\times SU(2)_L\\times U(1)_Y", domain: "particle", category: "Symmetry", drawable: false,
      behaviour: "The complete symmetry that dictates every force: SU(3) is the strong force (8 gluons), SU(2)×U(1) is the electroweak force (W, Z, photon). Specifying how a particle transforms under this group fixes all of its interactions and charges.",
      variables: [["SU(3)_c", "color / strong force"], ["SU(2)_L", "weak isospin"], ["U(1)_Y", "hypercharge"]],
      source: "src-sm-lectures", related: ["qcd-lagrangian", "electroweak", "four-forces", "yang-mills"], provenance: "web-sourced" },

    { id: "photon", name: "Photon (gauge boson of light)", latex: "E=hf=\\hbar\\omega,\\qquad m_\\gamma=0", domain: "particle", category: "Gauge bosons", drawable: true,
      behaviour: "The massless, spin-1 carrier of the electromagnetic force. It has no charge, so it does not self-interact (unlike gluons), which is why light passes through light. Its energy is set purely by its frequency.",
      variables: [["E", "photon energy"], ["f", "frequency"], ["\\omega", "angular frequency"], ["m_\\gamma", "photon mass = 0"]],
      source: "src-sm-lectures", related: ["qed-lagrangian", "wave-duality", "de-broglie", "planck-law", "photoelectric-effect", "maxwell-tensor"], provenance: "standard-supplied" },

    /* ===================== NUCLEUS & NUCLEONS =========================== */
    { id: "nuclear-hamiltonian", name: "Nuclear many-body Hamiltonian", latex: "\\hat H=\\sum_{i<j}\\dfrac{(\\vec p_i-\\vec p_j)^2}{2mA}+\\sum_{i<j}\\hat V^{NN}_{ij}+\\sum_{i<j<k}\\hat V^{3N}_{ijk}", domain: "nuclear", category: "Ab initio structure", drawable: true,
      behaviour: "This operator IS the nucleus. Diagonalizing it gives the ground-state energy and shape. Kinetic energy wants nucleons to spread out; the two-nucleon and three-nucleon forces (from chiral effective field theory, rooted in QCD) pull them together.",
      variables: [["\\vec p_i", "nucleon momentum"], ["m", "nucleon mass"], ["A", "mass number"], ["\\hat V^{NN}", "two-nucleon force"], ["\\hat V^{3N}", "three-nucleon force"]],
      source: "src-nuclear", related: ["strong-force", "residual-strong", "binding-energy", "magic-numbers", "schrodinger-compact", "quark-model"], provenance: "web-sourced" },

    { id: "residual-strong", name: "Nuclear force = residual strong force", latex: "V_\\pi(r)=-\\,g^2\\,\\dfrac{e^{-m_\\pi r}}{r}", domain: "nuclear", category: "Forces", drawable: true,
      behaviour: "Protons and neutrons are color-neutral, so what binds them is the leftover of the strong force leaking out as pion (meson) exchange — a short-range Yukawa attraction. It is the nuclear echo of the quark-level QCD force.",
      variables: [["g", "coupling"], ["m_\\pi", "pion mass"], ["r", "nucleon separation"]],
      source: "src-nuclear", related: ["nuclear-hamiltonian", "qcd-lagrangian", "strong-force", "quark-model"], provenance: "standard-supplied" },

    { id: "binding-energy", name: "Nuclear binding energy & mass defect", latex: "B=\\big[Z m_p+N m_n-m(Z,N)\\big]c^2,\\qquad \\tfrac{B}{A}\\approx7.9\\ \\text{MeV}", domain: "nuclear", category: "Ab initio structure", drawable: false,
      behaviour: "A bound nucleus weighs LESS than its separate protons and neutrons; that missing mass (× c²) is the binding energy holding it together. For ²⁰⁸Pb the ab initio value is B/A = 7.867 MeV per nucleon — the currency of nuclear stability and nuclear energy.",
      variables: [["B", "binding energy"], ["Z,N", "proton, neutron number"], ["m_p,m_n", "proton, neutron mass"], ["A", "mass number"]],
      source: "src-nuclear", related: ["mass-energy", "nuclear-hamiltonian", "strong-force", "magic-numbers"], provenance: "web-sourced" },

    { id: "magic-numbers", name: "Magic numbers & doubly-magic nuclei", latex: "\\{2,\\,8,\\,20,\\,28,\\,50,\\,82,\\,126\\}", domain: "nuclear", category: "Shell structure", drawable: false,
      behaviour: "When a proton or neutron shell is exactly filled, the nucleus is unusually stable, compact and hard to excite — the nuclear analogue of a noble gas. A doubly-magic nucleus (both Z and N magic, e.g. ²⁰⁸Pb) is the most tightly bound of all.",
      variables: [["Z", "proton number"], ["N", "neutron number"]],
      source: "src-nuclear", related: ["nuclear-hamiltonian", "binding-energy", "pauli-exclusion", "energy-quant"], provenance: "web-sourced" },

    { id: "ab-initio", name: "Ab initio nuclear solve (imaginary time)", latex: "-\\dfrac{d}{d\\tau}\\lvert\\Psi(\\tau)\\rangle=(\\hat H-E_0)\\lvert\\Psi(\\tau)\\rangle", domain: "nuclear", category: "Methods", drawable: false,
      behaviour: "Propagating a trial state in imaginary time damps every excited component faster than the ground state, so it collapses onto the exact nuclear ground state — solving the nucleus 'from scratch' with only nucleon-level forces and no fudge factors.",
      variables: [["\\tau", "imaginary time"], ["\\hat H", "nuclear Hamiltonian"], ["E_0", "ground-state energy"], ["\\Psi", "many-body wavefunction"]],
      source: "src-nuclear", related: ["nuclear-hamiltonian", "schrodinger-tdse", "time-evolution"], provenance: "web-sourced" },

    /* ============= ELECTROMAGNETISM & TESLA (fields → wireless power) === */
    { id: "maxwell-tensor", name: "Maxwell equations (covariant)", latex: "F_{\\mu\\nu}=\\partial_\\mu A_\\nu-\\partial_\\nu A_\\mu,\\qquad \\partial_\\mu F^{\\mu\\nu}=j^\\nu", domain: "em", category: "Field theory", drawable: true,
      behaviour: "Bundles the electric and magnetic fields into one relativistic object F_{μν} so the laws look identical to every observer. Charges and currents (j^ν) are the source of the field; the companion Bianchi identity encodes Faraday's law and 'no magnetic monopoles'.",
      variables: [["F_{\\mu\\nu}", "field-strength tensor"], ["A_\\mu", "4-potential (φ, A)"], ["j^\\nu", "4-current"], ["\\partial_\\mu", "spacetime derivative"]],
      source: "src-sm-lectures", related: ["qed-lagrangian", "lorentz-force", "em-force", "faraday-law", "photon"], provenance: "web-sourced" },

    { id: "faraday-law", name: "Faraday's law of induction", latex: "\\oint \\vec E\\cdot d\\vec l=-\\dfrac{d\\Phi_B}{dt}", domain: "em", category: "Induction", drawable: true,
      behaviour: "A changing magnetic flux through a loop induces a voltage around it. This is the principle behind the transformer, the electric generator, and Tesla's coils — a coil can drive current in a distant coil with no wires between them.",
      variables: [["\\vec E", "induced electric field"], ["\\Phi_B", "magnetic flux"], ["t", "time"]],
      source: "src-tesla-wpt", related: ["maxwell-tensor", "resonant-coupling", "em-force", "larmor"], provenance: "standard-supplied" },

    { id: "resonant-coupling", name: "Resonant coupling (Tesla coil)", latex: "\\omega_0=\\dfrac{1}{\\sqrt{LC}},\\quad k=\\dfrac{M}{\\sqrt{L_1 L_2}},\\quad Q=\\dfrac{\\omega_0 L}{R}", domain: "em", category: "Wireless power", drawable: true,
      behaviour: "Two coil-and-capacitor circuits tuned to the SAME resonant frequency ω₀ trade energy efficiently even far apart — Tesla's discovery. The coupling k says how much flux links them; the quality factor Q says how little energy they waste per cycle.",
      variables: [["\\omega_0", "resonant frequency"], ["L,C", "inductance, capacitance"], ["k", "coupling coefficient"], ["M", "mutual inductance"], ["Q", "quality factor"]],
      source: "src-tesla-wpt", related: ["faraday-law", "wpt-efficiency", "larmor"], provenance: "standard-supplied" },

    { id: "wpt-efficiency", name: "Wireless-power efficiency (kQ figure of merit)", latex: "\\eta_{\\max}=\\dfrac{k^2 Q_1 Q_2}{\\big(1+\\sqrt{1+k^2 Q_1 Q_2}\\big)^2}", domain: "em", category: "Wireless power", drawable: false,
      behaviour: "The master equation of near-field wireless power: efficiency is governed entirely by the product k²Q₁Q₂. You don't need the coils close — you need that product large, which is why high-Q resonators transfer power efficiently even when weakly coupled.",
      variables: [["\\eta_{\\max}", "max efficiency"], ["k", "coupling coefficient"], ["Q_1,Q_2", "transmitter, receiver quality factors"]],
      source: "src-tesla-wpt", related: ["resonant-coupling", "faraday-law"], provenance: "web-sourced" }
  ];

  /* ====================================================================== *
   *  ATOM-LAB SCENES                                                        *
   *  Each scene = a figure with hoverable vectors. Every "vector" references *
   *  node ids so the hover panel can show the exact equations/behaviour.    *
   * ====================================================================== */
  const SCENES = {
    classical: {
      label: "Classical atom",
      tagline: "The planetary / Bohr picture: a point electron on a definite orbit.",
      vectors: [
        { key: "r",  label: "r — position",          color: "#f5a623", nodes: ["position-vec","spacetime-interval"] },
        { key: "v",  label: "v — velocity",          color: "#fbbf24", nodes: ["velocity-vec","centripetal","time-dilation"] },
        { key: "p",  label: "p — momentum",          color: "#fb923c", nodes: ["momentum-vec","de-broglie","rel-momentum"] },
        { key: "F",  label: "F — Coulomb force",     color: "#f87171", nodes: ["coulomb-force","centripetal","em-force"] },
        { key: "L",  label: "L — angular momentum",  color: "#a3e635", nodes: ["angular-momentum","bohr-quant"] }
      ]
    },
    quantum: {
      label: "Quantum atom",
      tagline: "Schrödinger's picture: the electron is a wavefunction; |ψ|² is a probability cloud.",
      vectors: [
        { key: "cloud", label: "|ψ|² — probability cloud", color: "#22d3ee", nodes: ["born-rule","normalization","wave-duality"] },
        { key: "psi",   label: "ψ(x) — wavefunction",      color: "#67e8f9", nodes: ["schrodinger-1d","free-particle","de-broglie"] },
        { key: "p",     label: "p̂ — momentum operator",   color: "#fb923c", nodes: ["momentum-op","de-broglie","commutator"] },
        { key: "H",     label: "Ĥ — the Schrödinger eq.",  color: "#a5f3fc", nodes: ["schrodinger-tdse","schrodinger-compact","hamiltonian-op"] },
        { key: "levels",label: "E — energy levels",        color: "#38bdf8", nodes: ["energy-quant","schrodinger-compact","normalization"] },
        { key: "unc",   label: "Δx·Δp — uncertainty",      color: "#818cf8", nodes: ["commutator","uncertainty"] }
      ]
    },
    bloch: {
      label: "Spin / Bloch sphere",
      tagline: "The qubit picture: an electron's spin as an arrow on a sphere. Click gates to rotate it.",
      vectors: [
        { key: "s",   label: "|ψ⟩ — Bloch / spin vector",  color: "#a78bfa", nodes: ["bloch-param","qubit-state","bloch-vector"] },
        { key: "axes",label: "x,y,z — Pauli axes",         color: "#c4b5fd", nodes: ["pauli-x","pauli-y","pauli-z","expectation"] },
        { key: "n",   label: "n / B — field & rotation axis",color: "#f472b6", nodes: ["qubit-hamiltonian","unitary-rotation","b-eff"] },
        { key: "prec",label: "precession (n × s)",          color: "#f9a8d4", nodes: ["bloch-precession","larmor"] },
        { key: "mu",  label: "μ — magnetic moment",         color: "#fb7185", nodes: ["spin-moment","zeeman-energy"] }
      ],
      gates: ["X","Y","Z","H","S","T"]
    },
    molecule: {
      label: "Molecule / spin cluster",
      tagline: "Atoms as coupled spins: Heisenberg exchange, Rydberg blockade, ionic bonding.",
      vectors: [
        { key: "S",   label: "Sᵢ — atomic spins",        color: "#60a5fa", nodes: ["spin-cluster","spin-hamiltonian","exchange"] },
        { key: "J",   label: "J — exchange bond",        color: "#93c5fd", nodes: ["exchange","spin-hamiltonian"] },
        { key: "D",   label: "D — DM twist",             color: "#38bdf8", nodes: ["dm-interaction"] },
        { key: "V",   label: "Vᵢⱼ — Rydberg interaction",color: "#a78bfa", nodes: ["rydberg","cnot"] },
        { key: "ionic",label:"electron transfer (ionic)", color: "#f87171", nodes: ["ionic-bond","coulomb-force","em-force"] }
      ]
    },
    nucleus: {
      label: "Nucleus / quarks",
      tagline: "Inside the atom's core: a proton = 3 quarks (uud) glued by gluons. Strong force, mass from QCD energy, the QED photon, and the Higgs.",
      vectors: [
        { key: "quarks", label: "u,u,d — valence quarks",   color: "#ef4444", nodes: ["quark-model","dirac-eq","sm-gauge-group"] },
        { key: "gluon",  label: "g — gluon / color force",  color: "#f59e0b", nodes: ["qcd-lagrangian","yang-mills","asymptotic-freedom","confinement"] },
        { key: "mass",   label: "m — proton mass (E=mc²)",  color: "#a3e635", nodes: ["proton-mass","mass-energy","pdf"] },
        { key: "strong", label: "strong binding (π exchange)",color: "#0ea5e9", nodes: ["nuclear-hamiltonian","residual-strong","binding-energy","strong-force"] },
        { key: "photon", label: "γ — photon (QED charge)",  color: "#22d3ee", nodes: ["qed-lagrangian","fine-structure","maxwell-tensor","photon"] },
        { key: "higgs",  label: "H — Higgs (gives mass)",   color: "#e879f9", nodes: ["higgs-mechanism","yukawa","higgs-mass"] }
      ]
    }
  };

  /* expose */
  window.KNOWLEDGE = {
    sources: SOURCES,
    domains: DOMAINS,
    nodes: NODES,
    scenes: SCENES,
    byId: NODES.reduce((m, n) => { m[n.id] = n; return m; }, {})
  };
})();
