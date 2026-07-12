/* AUTO-ASSEMBLED from the equation-worked-examples workflow (write + independent recheck).
   Worked numeric examples keyed by knowledge-base node id; rendered in the Equation Library. */
window.WORKED_EXAMPLES = {
 "coulomb-force": {
  "given": "Proton and electron in a hydrogen atom: q1 = q2 = e = 1.602×10^-19 C; separation r = Bohr radius = 5.29×10^-11 m; Coulomb constant k = 1/4πε₀ = 8.988×10^9 N·m²/C²",
  "steps": [
   "F = k × q1 × q2 ÷ r^2 = 8.988×10^9 × (1.602×10^-19)^2 ÷ (5.29×10^-11)^2",
   "Numerator: 8.988×10^9 × (2.566×10^-38) = 2.307×10^-28 N·m²",
   "Denominator: (5.29×10^-11)^2 = 2.798×10^-21 m²",
   "F = 2.307×10^-28 ÷ 2.798×10^-21 = 8.24×10^-8 N"
  ],
  "result": "F ≈ 8.2×10^-8 N (attractive)",
  "insight": "This tiny ~82 nanonewton attraction is the electrostatic pull binding the electron to the proton in a hydrogen atom, supplying exactly the centripetal force that keeps the electron in its ground-state orbit."
 },
 "velocity-vec": {
  "given": "An electron (m = 9.109×10⁻³¹ kg) with kinetic energy T = 100 eV = 100 × 1.602×10⁻¹⁹ J = 1.602×10⁻¹⁷ J",
  "steps": [
   "v = √(2T ÷ m) = √(2 × 1.602×10⁻¹⁷ J ÷ 9.109×10⁻³¹ kg)",
   "Numerator: 2 × 1.602×10⁻¹⁷ = 3.204×10⁻¹⁷ J",
   "Divide: 3.204×10⁻¹⁷ ÷ 9.109×10⁻³¹ = 3.517×10¹³ m²/s²",
   "Square root: v = √(3.517×10¹³) = 5.93×10⁶ m/s"
  ],
  "result": "v ≈ 5.93×10⁶ m/s",
  "insight": "A 100 eV electron zips along at about 5.9 million m/s (roughly 2% of light speed), fast enough to resolve atomic-scale features yet slow enough that non-relativistic mechanics still applies."
 },
 "momentum-vec": {
  "given": "A hydrogen atom (m = 1.674 × 10^-27 kg) moving at v = 2.00 × 10^3 m/s (a typical thermal speed at room temperature).",
  "steps": [
   "p = m × v",
   "p = (1.674 × 10^-27 kg) × (2.00 × 10^3 m/s)",
   "p = 1.674 × 2.00 × 10^(-27+3) kg·m/s",
   "p = 3.348 × 10^-24 kg·m/s"
  ],
  "result": "p = 3.35 × 10^-24 kg·m/s",
  "insight": "This tiny momentum is the \"quantity of motion\" carried by one hydrogen atom, and it is what the atom would transfer to a wall in a collision."
 },
 "de-broglie": {
  "given": "An electron (mass m = 9.109×10^-31 kg) accelerated through 100 V, giving kinetic energy E = 100 eV = 1.602×10^-17 J; Planck constant h = 6.626×10^-34 J·s",
  "steps": [
   "Find momentum from kinetic energy: p = √(2 × m × E)",
   "p = √(2 × 9.109×10^-31 kg × 1.602×10^-17 J) = √(2.919×10^-47) = 5.40×10^-24 kg·m/s",
   "Apply de Broglie: λ = h ÷ p = (6.626×10^-34 J·s) ÷ (5.40×10^-24 kg·m/s)",
   "λ = 1.227×10^-10 m ≈ 0.123 nm"
  ],
  "result": "λ ≈ 1.23×10^-10 m = 0.123 nm",
  "insight": "This wavelength is comparable to atomic spacings in a crystal, which is exactly why 100 eV electrons diffract off solids and make electron microscopes able to resolve atomic-scale structure."
 },
 "bohr-quant": {
  "given": "He⁺ ion (Z = 2), electron in level n = 2; Bohr radius a₀ = 0.529 Å, ℏ = 1.055×10⁻³⁴ J·s",
  "steps": [
   "r_n = n²·a₀ ÷ Z = 2²×0.529 Å ÷ 2 = 4×0.529 ÷ 2 = 1.058 Å",
   "E_n = −13.6×Z² ÷ n² eV = −13.6×2² ÷ 2² = −13.6×4 ÷ 4 = −13.6 eV",
   "L = n·ℏ = 2×1.055×10⁻³⁴ = 2.11×10⁻³⁴ J·s"
  ],
  "result": "r₂ = 1.058 Å, E₂ = −13.6 eV, L = 2.11×10⁻³⁴ J·s",
  "insight": "In He⁺ the doubled nuclear charge binds the n=2 electron with the same energy as hydrogen's ground state (−13.6 eV); its orbit radius is 1.058 Å = 2a₀, twice hydrogen's ground-state radius rather than equal to it."
 },
 "energy-classical": {
  "given": "Electron in the hydrogen ground state (Bohr model): mass m = 9.109×10^-31 kg, speed v = 2.19×10^6 m/s, and Coulomb potential energy V = -27.2 eV = -4.36×10^-18 J.",
  "steps": [
   "Momentum: p = m×v = 9.109×10^-31 kg × 2.19×10^6 m/s = 1.995×10^-24 kg·m/s",
   "Kinetic term: p^2 ÷ 2m = (1.995×10^-24)^2 ÷ (2 × 9.109×10^-31) = 2.18×10^-18 J = +13.6 eV",
   "Add potential energy: E = 13.6 eV + (-27.2 eV)",
   "E = -13.6 eV"
  ],
  "result": "E = -13.6 eV (= -2.18×10^-18 J)",
  "insight": "The negative total energy means the electron is bound to the proton: it would take +13.6 eV of energy to ionize the hydrogen atom."
 },
 "schrodinger-1d": {
  "given": "Hydrogen atom, principal quantum number n = 2; Rydberg energy constant = 13.6 eV",
  "steps": [
   "E_n = −13.6 ÷ n^2 eV",
   "E_2 = −13.6 ÷ (2)^2 eV",
   "E_2 = −13.6 ÷ 4 eV",
   "E_2 = −3.4 eV"
  ],
  "result": "E_2 = −3.4 eV",
  "insight": "This is the binding energy of an electron in hydrogen's first excited state; it takes 3.4 eV of energy to ionize the atom from that level."
 },
 "uncertainty": {
  "given": "Electron confined in a hydrogen atom, position uncertainty Δx = Bohr radius = 5.29×10^-11 m; ℏ = 1.055×10^-34 J·s",
  "steps": [
   "Δx·Δp ≥ ℏ/2, so Δp ≥ ℏ ÷ (2·Δx)",
   "ℏ/2 = 1.055×10^-34 ÷ 2 = 5.27×10^-35 J·s",
   "Δp ≥ 5.27×10^-35 ÷ 5.29×10^-11 m",
   "Δp ≥ 9.97×10^-25 kg·m/s"
  ],
  "result": "Δp ≥ 9.97×10^-25 kg·m/s",
  "insight": "Confining an electron to the size of a hydrogen atom forces its momentum to be uncertain by ~10^-24 kg·m/s, comparable to the electron's actual orbital momentum — which is why the electron cannot simply sit still at the nucleus and instead occupies a spread-out orbital."
 },
 "mass-energy": {
  "given": "Rest mass of one electron m = 9.109 × 10^-31 kg; speed of light c = 2.998 × 10^8 m/s",
  "steps": [
   "E = m × c^2 = (9.109 × 10^-31 kg) × (2.998 × 10^8 m/s)^2",
   "c^2 = (2.998 × 10^8)^2 = 8.988 × 10^16 m^2/s^2",
   "E = 9.109 × 10^-31 × 8.988 × 10^16 = 8.187 × 10^-14 J",
   "Convert to eV: 8.187 × 10^-14 J ÷ 1.602 × 10^-19 J/eV = 5.11 × 10^5 eV"
  ],
  "result": "E ≈ 8.19 × 10^-14 J ≈ 0.511 MeV",
  "insight": "This is the rest energy locked inside a single electron's mass, and it equals the well-known 0.511 MeV released when an electron and positron annihilate."
 },
 "rel-energy": {
  "given": "Electron rest energy mc² = 0.511 MeV; speed v = 0.8c (so v²/c² = 0.64); c = 3.00×10^8 m/s",
  "steps": [
   "E = mc² ÷ √(1 − v²/c²) = 0.511 MeV ÷ √(1 − 0.8²)",
   "1 − 0.64 = 0.36, and √0.36 = 0.6",
   "E = 0.511 MeV ÷ 0.6 = 0.8517 MeV"
  ],
  "result": "E ≈ 0.852 MeV",
  "insight": "A moving electron carries more total energy than its 0.511 MeV rest energy — the extra ~0.34 MeV is its relativistic kinetic energy at 80% the speed of light."
 },
 "planck-law": {
  "given": "Sun's surface temperature T = 5778 K; Wien's displacement constant b = 2.898×10⁻³ m·K; Stefan–Boltzmann constant σ = 5.670×10⁻⁸ W·m⁻²·K⁻⁴",
  "steps": [
   "Wien: λ_max = b ÷ T = (2.898×10⁻³ m·K) ÷ (5778 K)",
   "λ_max = 5.016×10⁻⁷ m = 502 nm (green-blue visible light)",
   "Stefan–Boltzmann: M = σ × T^4 = (5.670×10⁻⁸) × (5778)^4",
   "(5778)^4 = 1.115×10¹⁵, so M = 5.670×10⁻⁸ × 1.115×10¹⁵",
   "M = 6.32×10⁷ W/m²"
  ],
  "result": "λ_max ≈ 502 nm; M ≈ 6.32×10⁷ W/m²",
  "insight": "The Sun's spectrum peaks in visible green-blue light and each square meter of its surface radiates about 63 megawatts, which is why hotter stars appear bluer and glow far more intensely."
 },
 "photoelectric-effect": {
  "given": "Sodium metal (work function φ = 2.28 eV) illuminated by ultraviolet light of wavelength λ = 300 nm; h = 4.1357×10^-15 eV·s, c = 3.00×10^8 m/s.",
  "steps": [
   "f = c ÷ λ = (3.00×10^8 m/s) ÷ (300×10^-9 m) = 1.00×10^15 Hz",
   "h·f = (4.1357×10^-15 eV·s) × (1.00×10^15 Hz) = 4.14 eV",
   "KE_max = h·f − φ = 4.14 eV − 2.28 eV = 1.86 eV"
  ],
  "result": "KE_max ≈ 1.86 eV (≈ 2.97×10^-19 J)",
  "insight": "Each 300 nm photon ejects an electron from sodium with up to 1.86 eV of kinetic energy — the leftover after paying the 2.28 eV energy cost to escape the metal's surface."
 },
 "larmor": {
  "given": "Proton (hydrogen nucleus) in an MRI field. Gyromagnetic ratio γ = 2.675 × 10^8 rad·s^-1·T^-1; magnetic field B = 1.5 T.",
  "steps": [
   "ω = γ × B",
   "ω = (2.675 × 10^8 rad·s^-1·T^-1) × (1.5 T)",
   "ω = 4.013 × 10^8 rad·s^-1",
   "Convert to ordinary frequency: f = ω ÷ (2π) = 4.013 × 10^8 ÷ 6.283 = 6.39 × 10^7 Hz"
  ],
  "result": "ω = 4.01 × 10^8 rad·s^-1 (equivalently f ≈ 63.9 MHz)",
  "insight": "This is the rate at which the proton's spin magnetic moment precesses about the field, and its 63.9 MHz frequency is exactly the radio-wave frequency an MRI scanner must broadcast to flip those protons."
 },
 "spin-moment": {
  "given": "Single electron (e.g. the electron in a hydrogen atom): spin quantum number s = 1/2, electron g-factor g = 2.0023, Bohr magneton μ_B = 9.274×10^-24 J/T",
  "steps": [
   "√(s(s+1)) = √(0.5 × (0.5+1)) = √0.75 = 0.8660",
   "μ = 0.8660 × g × μ_B = 0.8660 × 2.0023 × (9.274×10^-24 J/T)",
   "μ = 0.8660 × 1.857×10^-23 J/T",
   "μ = 1.608×10^-23 J/T"
  ],
  "result": "μ ≈ 1.61×10^-23 J/T (about 1.73 μ_B)",
  "insight": "This is the intrinsic magnetic strength of a single electron's spin, which is why an unpaired electron (as in hydrogen) makes an atom respond to magnetic fields."
 },
 "exchange": {
  "given": "Two neighboring spin-1/2 electrons (e.g. in iron); exchange constant J = 0.015 eV (ferromagnetic, J > 0). Spins aligned (parallel), so the dot product of the spin operators S_i·S_j = +1/4 (triplet state, in units of ħ²).",
  "steps": [
   "H = −J × (S_i·S_j), summed over the one neighboring pair",
   "Parallel spins: S_i·S_j = +1/4",
   "H = −(0.015 eV) × (1/4) = −(0.015 ÷ 4) eV",
   "H = −0.00375 eV = −3.75 meV"
  ],
  "result": "H = −0.00375 eV (−3.75 meV)",
  "insight": "The negative energy means aligning the two spins is favorable, which is exactly why ferromagnets like iron spontaneously magnetize; ~3.75 meV per bond also explains why thermal energy (kT ≈ 25 meV at room temperature) can start to disrupt this order near the Curie point."
 },
 "rydberg": {
  "given": "Hydrogen H-alpha transition: R_H = 1.097×10^7 m^-1 (Rydberg constant), n1 = 2 (lower level), n2 = 3 (upper level)",
  "steps": [
   "1/λ = R_H × (1/n1^2 − 1/n2^2) = 1.097×10^7 × (1/2^2 − 1/3^2)",
   "= 1.097×10^7 × (0.2500 − 0.1111) = 1.097×10^7 × 0.1389 m^-1",
   "1/λ = 1.524×10^6 m^-1",
   "λ = 1 ÷ (1.524×10^6 m^-1) = 6.563×10^-7 m = 656.3 nm"
  ],
  "result": "λ = 656.3 nm (656.3×10^-9 m)",
  "insight": "This is the H-alpha line, the bright red glow of hydrogen emitted when an electron falls from n=3 to n=2, visible in nebulae and red neon-style hydrogen lamps."
 },
 "fine-structure": {
  "given": "e = 1.602×10^-19 C (elementary charge); ε₀ = 8.854×10^-12 F/m; ℏ = 1.055×10^-34 J·s; c = 2.998×10^8 m/s",
  "steps": [
   "Numerator: e² = (1.602×10^-19)^2 = 2.566×10^-38 C²",
   "Denominator: 4π × ε₀ × ℏ × c = 4π × 8.854×10^-12 × 1.055×10^-34 × 2.998×10^8 = 3.519×10^-36",
   "α = 2.566×10^-38 ÷ 3.519×10^-36 = 7.293×10^-3",
   "Reciprocal: 1 ÷ 7.293×10^-3 = 137.1"
  ],
  "result": "α ≈ 0.007293 ≈ 1/137.1 (dimensionless)",
  "insight": "This dimensionless number sets the strength of the electromagnetic force — e.g. it fixes how tightly the electron is bound in hydrogen, giving the ground-state electron a speed of about α·c ≈ 1/137 of light speed."
 },
 "confinement": {
  "given": "Charmonium (c c-bar) quark pair at separation r = 0.5 fm; strong coupling α_s = 0.3; string tension σ = 0.18 GeV²; conversion ħc = 0.1973 GeV·fm (needed to convert both α_s/r AND σ·r into an energy, since σ in GeV² uses natural-unit lengths in GeV⁻¹).",
  "steps": [
   "Coulomb term = −(4÷3) × α_s × (ħc ÷ r) = −(4÷3) × 0.3 × (0.1973 GeV·fm ÷ 0.5 fm)",
   "= −(1.333) × 0.3 × 0.3946 GeV = −0.158 GeV",
   "Linear (confining) term = σ × r, but σ = 0.18 GeV² is in natural units, so r must be converted from fm to GeV⁻¹ via r/ħc = 0.5 fm ÷ 0.1973 GeV·fm = 2.534 GeV⁻¹",
   "= 0.18 GeV² × 2.534 GeV⁻¹ = 0.456 GeV (equivalently σ = 0.18 GeV² = 0.912 GeV/fm, times 0.5 fm = 0.456 GeV)",
   "V(r) = −0.158 GeV + 0.456 GeV = +0.298 GeV"
  ],
  "result": "V(0.5 fm) ≈ +0.298 GeV (about +298 MeV)",
  "insight": "The original example dropped the ħc unit conversion on the linear term (it used 0.18 GeV/fm instead of the correct 0.18 GeV² = 0.912 GeV/fm), underestimating σ·r by a factor of ħc. Done correctly, even at 0.5 fm the linear confining term (+0.456 GeV) already outweighs the short-range Coulomb attraction (−0.158 GeV), so the net potential is positive and rising. The linear σ·r term grows without limit, so pulling the quarks apart costs ever-more energy and they can never be freed (confinement). The Coulomb term only dominates at much smaller r (below ~0.2 fm), where V becomes negative."
 },
 "proton-mass": {
  "given": "Proton rest mass m = 1.6726 × 10^-27 kg; speed of light c = 2.9979 × 10^8 m/s; gluon momentum fraction ≈ 45%; 1 MeV = 1.6022 × 10^-13 J",
  "steps": [
   "E = m × c^2 = (1.6726 × 10^-27 kg) × (2.9979 × 10^8 m/s)^2",
   "= (1.6726 × 10^-27) × (8.988 × 10^16) = 1.5033 × 10^-10 J",
   "Convert: 1.5033 × 10^-10 J ÷ (1.6022 × 10^-13 J/MeV) = 938.3 MeV",
   "Gluon share: 0.45 × 938.3 MeV ≈ 422 MeV carried by gluons"
  ],
  "result": "E ≈ 1.503 × 10^-10 J ≈ 938.3 MeV (of which ~422 MeV is gluon field energy)",
  "insight": "Almost all of the proton's 938 MeV mass comes from the kinetic and gluon-field energy of nearly-massless quarks and gluons (via E = mc²), not from the tiny intrinsic quark masses — mass is mostly bound QCD energy."
 },
 "binding-energy": {
  "given": "Helium-4 nucleus (alpha particle): Z = 2 protons, N = 2 neutrons; m_p = 1.007276 u, m_n = 1.008665 u; nuclear mass m = 4.001504 u (He-4 atomic mass 4.002602 u minus 2 electrons); 1 u = 931.494 MeV/c^2",
  "steps": [
   "Sum of free nucleon masses = 2 × 1.007276 u + 2 × 1.008665 u = 4.031882 u",
   "Mass defect Δm = 4.031882 u − 4.001504 u = 0.030378 u",
   "B = Δm × c^2 = 0.030378 u × 931.494 MeV/u",
   "B ≈ 28.30 MeV (about 7.07 MeV per nucleon)"
  ],
  "result": "B ≈ 28.30 MeV",
  "insight": "This is the energy released when 2 protons and 2 neutrons fuse into a helium-4 nucleus (and the energy you'd need to supply to pull it back apart), and its unusually high value per nucleon is why helium-4 is so tightly bound and central to stellar fusion."
 },
 "yukawa": {
  "given": "Top quark: Yukawa coupling y_t = 0.994 (dimensionless); Higgs vacuum expectation value v = 246 GeV; √2 = 1.41421",
  "steps": [
   "m_f = y_f × v ÷ √2",
   "m_t = 0.994 × 246 GeV ÷ 1.41421",
   "= 0.994 × 173.95 GeV",
   "= 172.9 GeV"
  ],
  "result": "m_t ≈ 172.9 GeV (≈ 173 GeV/c^2)",
  "insight": "The top quark's Yukawa coupling is almost exactly 1, so its mass essentially equals v/√2 — it couples to the Higgs field more strongly than any other known fermion."
 },
 "w-boson-mass": {
  "given": "M_Z = 91.1876 GeV/c² (measured Z boson mass); weak mixing angle sin²θ_W = 0.2312, so cos²θ_W = 1 − 0.2312 = 0.7688",
  "steps": [
   "cosθ_W = √cos²θ_W = √0.7688 = 0.8768",
   "M_W = M_Z × cosθ_W = 91.1876 GeV/c² × 0.8768",
   "M_W = 79.95 GeV/c²"
  ],
  "result": "M_W ≈ 79.95 GeV/c²",
  "insight": "The tree-level relation predicts the W boson to be about 12% lighter than the Z, matching the measured M_W ≈ 80.4 GeV/c² to within a percent and confirming electroweak unification of the photon and weak force."
 },
 "faraday-law": {
  "given": "N = 100 turns; loop area A = 0.01 m^2 (perpendicular to field); magnetic field ramps uniformly from B_i = 0 T to B_f = 0.5 T over Δt = 0.2 s",
  "steps": [
   "Flux per turn: Φ_B = B × A, so dΦ_B/dt = A × (dB/dt) = A × (B_f − B_i) ÷ Δt",
   "dB/dt = (0.5 − 0) T ÷ 0.2 s = 2.5 T/s",
   "dΦ_B/dt = 0.01 m^2 × 2.5 T/s = 0.025 Wb/s (per turn)",
   "EMF = −N × dΦ_B/dt = −100 × 0.025 Wb/s = −2.5 V (magnitude 2.5 V)"
  ],
  "result": "EMF = −2.5 V (magnitude 2.5 V)",
  "insight": "The changing field drives a 2.5 V push around the coil, and the minus sign (Lenz's law) means the induced current flows so as to oppose the rising flux."
 },
 "resonant-coupling": {
  "given": "L = 1 µH = 1×10⁻⁶ H (inductor); C = 100 pF = 100×10⁻¹² F = 1×10⁻¹⁰ F (capacitor). A classic LC tank circuit, like the tuning stage of a shortwave radio.",
  "steps": [
   "LC = (1×10⁻⁶ H) × (1×10⁻¹⁰ F) = 1×10⁻¹⁶ s²",
   "√(LC) = √(1×10⁻¹⁶) = 1×10⁻⁸ s",
   "ω₀ = 1 ÷ √(LC) = 1 ÷ (1×10⁻⁸) = 1×10⁸ rad/s",
   "f₀ = 1 ÷ (2π × √(LC)) = 1 ÷ (2π × 1×10⁻⁸) = 1 ÷ (6.283×10⁻⁸) ≈ 1.59×10⁷ Hz"
  ],
  "result": "f₀ ≈ 15.9 MHz (ω₀ = 1.0×10⁸ rad/s)",
  "insight": "This is the natural frequency at which energy sloshes back and forth between the inductor's magnetic field and the capacitor's electric field, so a radio built with these components would resonate with and pick out 15.9 MHz shortwave signals."
 },
 "wpt-efficiency": {
  "given": "Two resonant coils in a Qi-style wireless charger: coupling coefficient k = 0.5 (dimensionless), transmitter quality factor Q1 = 100, receiver quality factor Q2 = 100 (both dimensionless, typical of copper coils at ~100 kHz)",
  "steps": [
   "Figure of merit: k²·Q1·Q2 = (0.5)^2 × 100 × 100 = 0.25 × 10000 = 2500",
   "Inner root: √(1 + k²Q1Q2) = √(1 + 2500) = √2501 ≈ 50.01",
   "Denominator: (1 + 50.01)^2 = (51.01)^2 ≈ 2602.0",
   "η = 2500 ÷ 2602.0 ≈ 0.9608"
  ],
  "result": "η ≈ 0.961 = 96.1% (dimensionless efficiency)",
  "insight": "A strong figure of merit (k²Q1Q2 = 2500) means about 96% of the transmitted energy reaches the load, showing that high-Q resonant coils can deliver power efficiently even across a loose (k = 0.5) air gap."
 },
 "bloch-measure": {
  "given": "A single qubit (e.g. the electron-spin qubit of a hydrogen atom in a magnetic field) prepared in state |ψ⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩ at Bloch-sphere polar angle θ = 60° (measured in the standard computational basis).",
  "steps": [
   "Half-angle: θ ÷ 2 = 60° ÷ 2 = 30°",
   "cos(30°) = √3 ÷ 2 = 0.8660",
   "P(0) = cos²(θ/2) = (0.8660)^2 = 0.750",
   "Check: P(1) = sin²(30°) = (0.5)^2 = 0.250, and 0.750 + 0.250 = 1.000"
  ],
  "result": "P(0) = 0.75 (75%, dimensionless probability)",
  "insight": "Tilting the qubit 60° from the north pole means each measurement yields outcome 0 about 75% of the time and outcome 1 the remaining 25%, so repeated measurements on identical copies give roughly three 0s for every one 1."
 },
 "time-dilation": {
  "given": "Δt = 1.00 s (proper time measured on a spaceship's own clock); v = 0.800c (ship speed); c = 3.00×10^8 m/s",
  "steps": [
   "v²/c² = (0.800c)² ÷ c² = 0.640",
   "1 − v²/c² = 1 − 0.640 = 0.360",
   "√(0.360) = 0.600",
   "Δt' = Δt ÷ 0.600 = 1.00 s ÷ 0.600 = 1.67 s"
  ],
  "result": "Δt' ≈ 1.67 s",
  "insight": "A 1-second tick on a clock moving at 80% of light speed is stretched to about 1.67 seconds as measured by a stationary observer, so the moving clock runs slow."
 },
 "angular-momentum": {
  "given": "Bohr-model hydrogen ground state (n=1): electron mass m = 9.109×10^-31 kg, orbit radius r = a0 = 5.29×10^-11 m, orbital speed v = 2.19×10^6 m/s, with r perpendicular to p.",
  "steps": [
   "Momentum: p = m×v = 9.109×10^-31 kg × 2.19×10^6 m/s = 1.995×10^-24 kg·m/s",
   "Since r is perpendicular to p, the cross product magnitude is |L| = r×p = r·p·sin(90°) = r·p",
   "|L| = 5.29×10^-11 m × 1.995×10^-24 kg·m/s",
   "|L| = 1.055×10^-34 kg·m^2/s = 1.055×10^-34 J·s"
  ],
  "result": "|L| = 1.06×10^-34 J·s (equal to the reduced Planck constant ℏ)",
  "insight": "The electron's orbital angular momentum comes out to exactly one unit of ℏ, showing that angular momentum in the atom is quantized rather than continuous."
 },
 "zeeman-effect": {
  "given": "Hydrogen ground-state electron (spin state), Landé g-factor g = 2.0, Bohr magneton μ_B = 9.274 × 10^-24 J/T, magnetic quantum number m_j = +1/2, external field B = 1.0 T",
  "steps": [
   "ΔE = g × μ_B × m_j × B",
   "ΔE = 2.0 × (9.274 × 10^-24 J/T) × (1/2) × (1.0 T)",
   "ΔE = 2.0 × 9.274 × 10^-24 × 0.5 × 1.0 J",
   "ΔE = 9.274 × 10^-24 J  (= 5.79 × 10^-5 eV)"
  ],
  "result": "ΔE = 9.274 × 10^-24 J (≈ 57.9 µeV)",
  "insight": "In a 1-tesla field the electron's spin-up energy level shifts by about 9.3 × 10^-24 J, so the up and down spin states split apart, lifting their degeneracy and producing separate spectral lines."
 },
 "bec": {
  "given": "Atom: rubidium-87, m = 1.443×10⁻²⁵ kg; number density n = 2.5×10¹⁹ m⁻³; ℏ = 1.055×10⁻³⁴ J·s; k_B = 1.381×10⁻²³ J/K",
  "steps": [
   "Prefactor: 2π × ℏ² ÷ (m × k_B) = 2π × (1.055×10⁻³⁴)² ÷ (1.443×10⁻²⁵ × 1.381×10⁻²³) = 3.51×10⁻²⁰ K·m²",
   "Density term: (n ÷ 2.612) = (2.5×10¹⁹ ÷ 2.612) = 9.57×10¹⁸ m⁻³",
   "Raise to 2/3 power: (9.57×10¹⁸)^(2/3) = 4.51×10¹² m⁻²",
   "Multiply: T_c = 3.51×10⁻²⁰ K·m² × 4.51×10¹² m⁻² = 1.58×10⁻⁷ K"
  ],
  "result": "T_c ≈ 1.58×10⁻⁷ K ≈ 158 nK",
  "insight": "Below about 158 billionths of a kelvin, this rubidium gas condenses so that a macroscopic fraction of atoms collapse into the single lowest quantum state, forming a Bose–Einstein condensate."
 }
};
