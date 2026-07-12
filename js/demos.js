/* ============================================================================
 *  DEMOS.JS  —  the animated "Demonstrations" gallery
 *  ----------------------------------------------------------------------------
 *  Every card is a TITLED, EQUATION-DRIVEN animation that runs the *real* math
 *  behind a concept in the brain: orbits, oscillators, phonons, standing waves,
 *  Larmor precession, Bloch rotations, entanglement, teleportation, bonding...
 *  Each demo draws straight from its formula (shown via KaTeX) so the motion you
 *  see IS the equation. Click any card to expand it.
 *
 *  Exposes: window.Demos = { init, activate, deactivate }
 * ========================================================================== */
(function () {
  "use strict";
  const KN = window.KNOWLEDGE;
  const TAU = Math.PI * 2;
  const col = (d) => (KN.domains[d] && KN.domains[d].color) || "#7dd3fc";

  /* --------------------------- drawing helpers ------------------------- */
  function arrow(ctx, x1, y1, x2, y2, color, w) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w || 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1), h = 7;
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(a - 0.4), y2 - h * Math.sin(a - 0.4));
    ctx.lineTo(x2 - h * Math.cos(a + 0.4), y2 - h * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  }
  function ball(ctx, x, y, r, color, label) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, color); g.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (label) { ctx.fillStyle = "#04121f"; ctx.font = "bold " + Math.round(r * 1.1) + "px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x, y + 0.5); }
  }
  function spring(ctx, x1, y1, x2, y2, coils, amp, color) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, px = -uy, py = ux;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1);
    const n = coils * 2;
    for (let i = 1; i < n; i++) { const f = i / n, s = (i % 2 ? 1 : -1) * amp; ctx.lineTo(x1 + dx * f + px * s, y1 + dy * f + py * s); }
    ctx.lineTo(x2, y2); ctx.stroke();
  }
  function label(ctx, txt, x, y, color, size, align) {
    ctx.fillStyle = color || "rgba(214,225,240,.85)"; ctx.font = (size || 11) + "px Inter, system-ui, sans-serif";
    ctx.textAlign = align || "left"; ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 3; ctx.fillText(txt, x, y); ctx.shadowBlur = 0;
  }
  function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  /* ------------------------------- DEMOS ------------------------------- */
  const DEMOS = [
    /* ---------- classical / atomic ---------- */
    { id: "orbit", title: "Coulomb orbit", node: "coulomb-force", domain: "classical",
      latex: "\\vec F=\\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1q_2}{r^2}\\hat r",
      caption: "The electron is held in orbit by the inward Coulomb pull balancing its centripetal need.",
      draw(ctx, t, W, H) {
        const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.3, a = t * 1.4;
        ctx.strokeStyle = "rgba(120,140,180,.25)"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        ball(ctx, cx, cy, 12, "#fb7185", "+");
        const ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
        arrow(ctx, ex, ey, cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26), "#f5a623", 2); // force inward
        arrow(ctx, ex, ey, ex - Math.sin(a) * 30, ey + Math.cos(a) * 30, "#22d3ee", 2);            // velocity tangent
        ball(ctx, ex, ey, 7, "#22d3ee", "−");
        label(ctx, "F", cx + Math.cos(a) * (R - 32), cy + Math.sin(a) * (R - 32), "#f5a623");
        label(ctx, "v", ex - Math.sin(a) * 38, ey + Math.cos(a) * 38, "#22d3ee");
      } },
    { id: "sho", title: "Harmonic oscillator", node: "harmonic-oscillator", domain: "acoustics",
      latex: "x(t)=A\\cos\\omega t",
      caption: "A mass on a spring: its position is a pure cosine — the heartbeat of every vibration.",
      draw(ctx, t, W, H) {
        const wx = 30, cy = H * 0.42, A = W * 0.22, w = 2.2, x = wx + W * 0.4 + A * Math.cos(w * t);
        ctx.strokeStyle = "rgba(120,140,180,.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx, cy - 26); ctx.lineTo(wx, cy + 26); ctx.stroke();
        spring(ctx, wx, cy, x - 16, cy, 9, 8, "#9bb0d6"); ball(ctx, x, cy, 16, col("acoustics"));
        // x(t) trace
        const ty = H * 0.8; ctx.strokeStyle = "rgba(234,179,8,.8)"; ctx.lineWidth = 1.6; ctx.beginPath();
        for (let i = 0; i <= 120; i++) { const tt = t - (120 - i) * 0.02, xx = 30 + i * (W - 50) / 120, yy = ty - (A * 0.32) * Math.cos(w * tt); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
        ctx.stroke(); label(ctx, "x(t)", 30, ty - A * 0.32 - 6, "rgba(234,179,8,.9)");
      } },

    /* ---------- sound / vibrations / phonons ---------- */
    { id: "bondvib", title: "Diatomic bond vibration", node: "bond-vibration", domain: "acoustics",
      latex: "\\omega=\\sqrt{k/\\mu}",
      caption: "Two bonded atoms breathe in and out about their centre of mass on the bond 'spring'.",
      draw(ctx, t, W, H) {
        const cx = W / 2, cy = H / 2, d0 = W * 0.2, A = W * 0.07, d = d0 + A * Math.cos(2.6 * t);
        spring(ctx, cx - d + 18, cy, cx + d - 18, cy, 7, 7, "#9bb0d6");
        ball(ctx, cx - d, cy, 18, col("acoustics")); ball(ctx, cx + d, cy, 14, "#fb923c");
        ctx.strokeStyle = "rgba(120,140,180,.3)"; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(cx, cy - 36); ctx.lineTo(cx, cy + 36); ctx.stroke(); ctx.setLineDash([]);
        label(ctx, "center of mass", cx, cy + 52, "rgba(155,176,214,.7)", 10, "center");
      } },
    { id: "phonon", title: "Phonon — a wave of sound through atoms", node: "phonon", domain: "acoustics",
      latex: "u_n=A\\cos(qna-\\omega t)",
      caption: "Sound is a longitudinal lattice wave: atoms bunch into moving zones of compression & rarefaction.",
      draw(ctx, t, W, H) {
        const N = 16, a = W / (N + 1), cy = H / 2, A = a * 0.42, q = 0.55, w = 2.4;
        for (let n = 1; n <= N; n++) {
          const x = n * a + A * Math.cos(q * n - w * t);
          const compress = Math.cos(q * n - w * t);
          ball(ctx, x, cy, 8, compress > 0.4 ? "#facc15" : col("acoustics"));
        }
        label(ctx, "compression →", 8, H - 12, "rgba(234,179,8,.8)", 10);
      } },
    { id: "standing", title: "Standing wave & resonance", node: "resonance", domain: "acoustics",
      latex: "y(x,t)=A\\sin(k x)\\cos(\\omega t)",
      caption: "On a bounded string only resonant modes survive; the nodes never move.",
      draw(ctx, t, W, H) {
        const x0 = 24, x1 = W - 24, L = x1 - x0, cy = H / 2, mode = 1 + (Math.floor(t / 3) % 3), w = 2 + mode * 0.5, A = H * 0.28;
        ctx.strokeStyle = col("acoustics"); ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= 160; i++) { const x = x0 + L * i / 160, y = cy - A * Math.sin(mode * Math.PI * i / 160) * Math.cos(w * t); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
        // nodes
        ctx.fillStyle = "#fb7185"; for (let k = 0; k <= mode; k++) { const x = x0 + L * k / mode; ctx.beginPath(); ctx.arc(x, cy, 3, 0, TAU); ctx.fill(); }
        label(ctx, "mode n = " + mode, W / 2, H - 12, "rgba(214,225,240,.8)", 11, "center");
      } },
    { id: "optical", title: "Acoustic vs optical phonon", node: "optical-phonon", domain: "acoustics",
      latex: "\\text{2-atom basis} \\Rightarrow \\text{acoustic + optical}",
      caption: "With two atoms per cell, neighbours can swing together (acoustic) or against each other (optical).",
      draw(ctx, t, W, H) {
        const N = 8, a = W / (N + 1), A = a * 0.3, w = 2.4, q = 0.5;
        const rowA = H * 0.32, rowO = H * 0.72;
        label(ctx, "acoustic — in phase", 8, rowA - 26, "rgba(214,225,240,.75)", 10);
        label(ctx, "optical — out of phase", 8, rowO - 26, "rgba(214,225,240,.75)", 10);
        for (let n = 1; n <= N; n++) {
          const base = n * a, ph = q * n - w * t;
          ball(ctx, base + A * Math.cos(ph), rowA, 7, col("acoustics"));
          const sign = (n % 2) ? 1 : -1;
          ball(ctx, base + A * Math.cos(ph) * sign, rowO, 7, sign > 0 ? "#fb923c" : "#22d3ee");
        }
      } },

    /* ---------- quantum ---------- */
    { id: "wavepacket", title: "Free wave packet", node: "wave-duality", domain: "quantum",
      latex: "\\Psi(x,t)=\\!\\int\\!\\phi(k)e^{i(kx-\\omega t)}dk",
      caption: "A Gaussian matter-wave glides and spreads — the envelope (group) outruns the ripples (phase).",
      draw(ctx, t, W, H) {
        const cy = H / 2, k0 = 0.32, v = 36, sig0 = 26, sig = sig0 * Math.sqrt(1 + (t * 0.25) ** 2);
        const x0 = ((t * v) % (W + 120)) - 60;
        ctx.strokeStyle = col("quantum"); ctx.lineWidth = 1.8; ctx.beginPath();
        for (let x = 0; x <= W; x += 2) { const env = Math.exp(-((x - x0) ** 2) / (2 * sig * sig)); const y = cy - H * 0.34 * env * Math.cos(k0 * (x - x0) - 3 * t); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
        ctx.strokeStyle = "rgba(34,211,238,.3)"; ctx.beginPath();
        for (let x = 0; x <= W; x += 2) { const env = Math.exp(-((x - x0) ** 2) / (2 * sig * sig)); const y = cy - H * 0.34 * env; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
        label(ctx, "|envelope|", 8, 16, "rgba(34,211,238,.6)", 10);
      } },
    { id: "box", title: "Particle in a box", node: "born-rule", domain: "quantum",
      latex: "\\psi_n=\\sqrt{2/L}\\,\\sin\\frac{n\\pi x}{L},\\;E_n\\propto n^2",
      caption: "Confinement quantizes the matter-wave into standing modes; |ψ|² is the probability cloud.",
      draw(ctx, t, W, H) {
        const x0 = 24, x1 = W - 24, L = x1 - x0, cy = H * 0.5, n = 1 + (Math.floor(t / 2.6) % 3), w = 1.4 * n * n, A = H * 0.3;
        ctx.strokeStyle = "rgba(120,140,180,.4)"; ctx.lineWidth = 2; ctx.strokeRect(x0, cy - A - 8, L, 2 * A + 16);
        // |psi|^2 fill
        ctx.fillStyle = "rgba(167,139,250,.18)"; ctx.beginPath(); ctx.moveTo(x0, cy);
        for (let i = 0; i <= 160; i++) { const x = x0 + L * i / 160, s = Math.sin(n * Math.PI * i / 160); ctx.lineTo(x, cy + A * 0.8 * s * s); } ctx.lineTo(x1, cy); ctx.fill();
        ctx.strokeStyle = col("quantum"); ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= 160; i++) { const x = x0 + L * i / 160, y = cy - A * Math.sin(n * Math.PI * i / 160) * Math.cos(w * t); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
        label(ctx, "n = " + n + " ,  E ∝ " + (n * n), W / 2, H - 10, "rgba(214,225,240,.8)", 11, "center");
      } },
    { id: "levels", title: "Quantum jumps & photons", node: "energy-quant", domain: "quantum",
      latex: "E_n=-\\frac{13.6\\,Z^2}{n^2}\\,\\text{eV},\\;\\Delta E=h\\nu",
      caption: "An electron drops between levels and emits a photon whose colour is fixed by ΔE.",
      draw(ctx, t, W, H) {
        const left = 30, right = W - 30, levels = 4; const yOf = (n) => H * 0.86 - (H * 0.7) * (1 - 1 / (n * n)) / (1 - 1 / 16);
        ctx.lineWidth = 2;
        for (let n = 1; n <= levels; n++) { const y = yOf(n); ctx.strokeStyle = "rgba(120,140,180,.5)"; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right - 70, y); ctx.stroke(); label(ctx, "n=" + n, right - 64, y + 4, "rgba(214,225,240,.7)", 10); }
        const phase = (t % 3) / 3, from = 3, to = 1; const y = yOf(from) + (yOf(to) - yOf(from)) * Math.min(1, phase * 1.4); const ex = (left + right - 70) / 2;
        ball(ctx, ex, y, 7, "#22d3ee", "−");
        if (phase > 0.72) { const pr = (phase - 0.72) / 0.28; const px = ex + pr * 90; ctx.strokeStyle = "#f472b6"; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 40; i++) { const xx = ex + (px - ex) * i / 40, yy = yOf(to) + 8 * Math.sin(i * 0.9); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); label(ctx, "photon hν", ex + 30, yOf(to) - 12, "#f472b6", 10); }
      } },
    { id: "tunnel", title: "Quantum tunnelling", node: "wave-duality", domain: "quantum",
      latex: "T\\approx e^{-2\\kappa L}",
      caption: "Part of a wave packet leaks through a barrier it classically could never cross.",
      draw(ctx, t, W, H) {
        const cy = H / 2, bx = W * 0.55, bw = 26; const phase = (t % 4) / 4; const x0 = W * 0.12 + phase * (W * 0.7);
        ctx.fillStyle = "rgba(248,113,113,.18)"; ctx.fillRect(bx, 14, bw, H - 28); ctx.strokeStyle = "rgba(248,113,113,.6)"; ctx.strokeRect(bx, 14, bw, H - 28); label(ctx, "barrier", bx + bw / 2, H - 6, "rgba(248,113,113,.7)", 10, "center");
        const past = x0 > bx; const sig = 22, amp = past ? 0.12 : 0.34;
        ctx.strokeStyle = col("quantum"); ctx.lineWidth = 1.8; ctx.beginPath();
        for (let x = 0; x <= W; x += 2) { const env = Math.exp(-((x - x0) ** 2) / (2 * sig * sig)); const y = cy - H * amp * env * Math.cos(0.4 * (x - x0)); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      } },

    /* ---------- spin ---------- */
    { id: "larmor", title: "Larmor precession", node: "larmor", domain: "spin",
      latex: "\\frac{d\\vec\\mu}{dt}=\\gamma\\,\\vec\\mu\\times\\vec B,\\;\\omega_L=\\gamma B",
      caption: "In a magnetic field a magnetic moment precesses around B like a spinning top.",
      draw(ctx, t, W, H) {
        const cx = W / 2, cy = H * 0.58, R = Math.min(W, H) * 0.28, a = t * 3;
        arrow(ctx, cx, cy + R + 10, cx, cy - R - 24, "#34d399", 2.5); label(ctx, "B", cx + 8, cy - R - 20, "#34d399", 12);
        ctx.strokeStyle = "rgba(244,114,182,.3)"; ctx.beginPath(); ctx.ellipse(cx, cy - R * 0.7, R, R * 0.32, 0, 0, TAU); ctx.stroke();
        const tx = cx + Math.cos(a) * R, ty = cy - R * 0.7 + Math.sin(a) * R * 0.32;
        arrow(ctx, cx, cy, tx, ty, "#f472b6", 2.5); label(ctx, "μ", tx + 6, ty, "#f472b6", 12);
        ball(ctx, cx, cy, 5, "#f472b6");
      } },

    /* ---------- quantum info / entanglement ---------- */
    { id: "bloch", title: "Bloch-sphere rotation", node: "bloch-param", domain: "quantum-info",
      latex: "|\\psi\\rangle=\\cos\\tfrac\\theta2|0\\rangle+e^{i\\phi}\\sin\\tfrac\\theta2|1\\rangle",
      caption: "Every single-qubit gate is just a rotation of the Bloch vector on the sphere.",
      draw(ctx, t, W, H) {
        const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
        ctx.strokeStyle = "rgba(167,139,250,.4)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.32, 0, 0, TAU); ctx.stroke();
        label(ctx, "|0⟩", cx, cy - R - 6, "rgba(214,225,240,.8)", 11, "center"); label(ctx, "|1⟩", cx, cy + R + 14, "rgba(214,225,240,.8)", 11, "center");
        const th = 0.9 + 0.5 * Math.sin(t * 0.8), ph = t * 1.6;
        const vx = cx + R * Math.sin(th) * Math.cos(ph), vy = cy - R * Math.cos(th) + R * 0.32 * Math.sin(th) * Math.sin(ph);
        arrow(ctx, cx, cy, vx, vy, col("quantum-info"), 2.5); ball(ctx, vx, vy, 4, col("quantum-info"));
      } },
    { id: "rabi", title: "Rabi oscillation", node: "qubit-hamiltonian", domain: "quantum-info",
      latex: "P_1(t)=\\sin^2(\\Omega t/2)",
      caption: "A driven qubit sloshes its population back and forth between |0⟩ and |1⟩.",
      draw(ctx, t, W, H) {
        const p1 = Math.sin(1.6 * t / 1) ** 2, p0 = 1 - p1, bw = W * 0.22, gap = W * 0.14, base = H * 0.8, maxh = H * 0.55;
        const x0 = W / 2 - gap / 2 - bw, x1 = W / 2 + gap / 2;
        ctx.fillStyle = "rgba(167,139,250,.7)"; ctx.fillRect(x0, base - maxh * p0, bw, maxh * p0);
        ctx.fillStyle = "rgba(244,114,182,.8)"; ctx.fillRect(x1, base - maxh * p1, bw, maxh * p1);
        ctx.strokeStyle = "rgba(120,140,180,.4)"; ctx.beginPath(); ctx.moveTo(20, base); ctx.lineTo(W - 20, base); ctx.stroke();
        label(ctx, "|0⟩  " + (p0 * 100 | 0) + "%", x0 + bw / 2, base + 16, "rgba(214,225,240,.85)", 11, "center");
        label(ctx, "|1⟩  " + (p1 * 100 | 0) + "%", x1 + bw / 2, base + 16, "rgba(214,225,240,.85)", 11, "center");
      } },
    { id: "bell", title: "Entangled pair — perfect correlation", node: "bell-state", domain: "entanglement",
      latex: "|\\Phi^+\\rangle=\\tfrac{1}{\\sqrt2}(|00\\rangle+|11\\rangle)",
      caption: "Each qubit is random on its own, yet the two measured outcomes ALWAYS agree.",
      draw(ctx, t, W, H) {
        const cycle = 2.4, phase = (t % cycle) / cycle, idx = Math.floor(t / cycle); const r = rng(idx + 1); const bit = r() > 0.5 ? 1 : 0;
        const ay = H / 2, ax = W * 0.26, bx = W * 0.74; const measured = phase > 0.45;
        ctx.strokeStyle = "rgba(232,121,249,.5)"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(ax + 26, ay); ctx.lineTo(bx - 26, ay); ctx.stroke(); ctx.setLineDash([]);
        const drawBox = (x, who) => { ctx.strokeStyle = col("entanglement"); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, ay, 24, 0, TAU); ctx.stroke();
          ctx.fillStyle = "#fff"; ctx.font = "bold 20px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(measured ? String(bit) : "?", x, ay + 1); label(ctx, who, x, ay + 44, "rgba(214,225,240,.8)", 11, "center"); };
        drawBox(ax, "Alice"); drawBox(bx, "Bob");
        label(ctx, measured ? "outcomes match: " + bit + bit : "entangled — undetermined", W / 2, H - 12, measured ? "#34d399" : "rgba(232,121,249,.8)", 11, "center");
      } },
    { id: "teleport", title: "Quantum teleportation", node: "teleportation", domain: "entanglement",
      latex: "|\\psi\\rangle+|\\Phi^+\\rangle+2\\text{cbits}\\to|\\psi\\rangle",
      caption: "An unknown state moves via a shared Bell pair + 2 classical bits; the original is destroyed.",
      draw(ctx, t, W, H) {
        const ay = H * 0.32, by = H * 0.72, ax = W * 0.2, bx = W * 0.8, ph = (t % 5) / 5;
        ctx.strokeStyle = "rgba(232,121,249,.4)"; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(ax, by); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]); label(ctx, "shared Bell pair", W / 2, by + 18, "rgba(232,121,249,.6)", 10, "center");
        label(ctx, "Alice", ax, 16, "rgba(214,225,240,.8)", 11, "center"); label(ctx, "Bob", bx, 16, "rgba(214,225,240,.8)", 11, "center");
        const aliveA = ph < 0.55; ball(ctx, ax, ay, 12, aliveA ? col("quantum-info") : "rgba(80,90,110,.5)", "ψ");
        if (ph > 0.3 && ph < 0.55) label(ctx, "Bell measure ⚡", ax, ay - 22, "#facc15", 10, "center");
        if (ph > 0.45) { const pr = Math.min(1, (ph - 0.45) / 0.4); for (let k = 0; k < 2; k++) { const cx = ax + (bx - ax) * pr, cyk = ay + 16 + k * 12; ctx.fillStyle = "#34d399"; ctx.beginPath(); ctx.arc(cx, cyk, 4, 0, TAU); ctx.fill(); } if (pr < 1) label(ctx, "2 classical bits →", W / 2, ay + 4, "#34d399", 10, "center"); }
        const arrived = ph > 0.82; ball(ctx, bx, by, 12, arrived ? col("quantum-info") : "rgba(80,90,110,.5)", arrived ? "ψ" : "");
        if (arrived) label(ctx, "state reconstructed", bx, by - 22, "#34d399", 10, "center");
      } },

    /* ---------- bonding / forces ---------- */
    { id: "lj", title: "Lennard-Jones bond", node: "lennard-jones", domain: "bonding",
      latex: "V(r)=4\\varepsilon[(\\sigma/r)^{12}-(\\sigma/r)^6]",
      caption: "A ball oscillating in the energy well: the well minimum sets the equilibrium bond length.",
      draw(ctx, t, W, H) {
        const x0 = 30, x1 = W - 16, sig = 0.9, eps = 1; const rmin = 0.95, rmax = 2.6;
        const Vof = (r) => 4 * eps * (Math.pow(sig / r, 12) - Math.pow(sig / r, 6));
        const Xof = (r) => x0 + (r - rmin) / (rmax - rmin) * (x1 - x0); const re = sig * Math.pow(2, 1 / 6);
        const yBase = H * 0.42, yscale = H * 0.16;
        ctx.strokeStyle = col("bonding"); ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= 160; i++) { const r = rmin + (rmax - rmin) * i / 160, y = yBase + Vof(r) * yscale; const yy = Math.max(8, Math.min(H * 0.6, y)); i ? ctx.lineTo(Xof(r), yy) : ctx.moveTo(Xof(r), yy); } ctx.stroke();
        const r = re + 0.32 * Math.cos(2.2 * t); const by = yBase + Vof(r) * yscale; ball(ctx, Xof(r), Math.max(8, by), 7, "#facc15");
        // the two atoms at separation r below
        const cy2 = H * 0.84, mid = W / 2, px = (r / rmax) * W * 0.22; ball(ctx, mid - px, cy2, 13, col("bonding")); ball(ctx, mid + px, cy2, 13, "#fb923c");
        label(ctx, "r", Xof(re), H * 0.6 + 4, "rgba(214,225,240,.7)", 10, "center");
      } },
    { id: "covalent", title: "Covalent bond — shared electron", node: "covalent-bond", domain: "bonding",
      latex: "\\text{H}\\!\\cdot+\\cdot\\text{H}\\to\\text{H:H}",
      caption: "A shared electron weaves around both nuclei in a figure-eight — the glue of the H₂ bond.",
      draw(ctx, t, W, H) {
        const cy = H / 2, sep = W * 0.16, lx = W / 2 - sep, rx = W / 2 + sep;
        ball(ctx, lx, cy, 14, col("bonding"), "+"); ball(ctx, rx, cy, 14, "#fb923c", "+");
        // figure-eight (lemniscate-ish) shared electron
        const a = t * 2.4, ex = W / 2 + (sep + 18) * Math.cos(a), ey = cy + 16 * Math.sin(2 * a);
        ctx.strokeStyle = "rgba(96,165,250,.25)"; ctx.lineWidth = 1.4; ctx.beginPath();
        for (let i = 0; i <= 80; i++) { const aa = i / 80 * TAU, xx = W / 2 + (sep + 18) * Math.cos(aa), yy = cy + 16 * Math.sin(2 * aa); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
        ball(ctx, ex, ey, 6, "#22d3ee", "−");
      } },
    { id: "ionic", title: "Ionic bond — electron transfer", node: "ionic-bond", domain: "molecular",
      latex: "\\text{Na}^{+}+\\text{Cl}^{-}\\to\\text{NaCl}",
      caption: "A big electronegativity gap pulls the electron clean across: one atom becomes +, the other −.",
      draw(ctx, t, W, H) {
        const cy = H / 2, lx = W * 0.32, rx = W * 0.68, ph = (t % 3.4) / 3.4;
        const transferred = ph > 0.5; const ex = lx + (rx - lx) * Math.min(1, ph * 2);
        ball(ctx, lx, cy, 18, col("molecular"), transferred ? "+" : ""); ball(ctx, rx, cy, 22, "#fb7185", transferred ? "−" : "");
        if (ph < 0.5) ball(ctx, ex, cy - 2, 6, "#22d3ee", "−");
        label(ctx, "Na", lx, cy + 38, "rgba(214,225,240,.8)", 11, "center"); label(ctx, "Cl", rx, cy + 42, "rgba(214,225,240,.8)", 11, "center");
        if (transferred) label(ctx, "ionic attraction", W / 2, H - 12, "#fb7185", 11, "center");
      } },

    /* ---------- relativity ---------- */
    { id: "lightclock", title: "Time dilation — the light clock", node: "time-dilation", domain: "relativistic",
      latex: "\\Delta t'=\\gamma\\,\\Delta t,\\;\\gamma=1/\\sqrt{1-v^2/c^2}",
      caption: "A moving light-clock ticks slower: its photon must travel a longer, diagonal path.",
      draw(ctx, t, W, H) {
        const v = 40, x = ((t * v) % (W + 80)) - 40, top = H * 0.2, bot = H * 0.8, bounce = (t * 2) % 2, ph = bounce < 1 ? bounce : 2 - bounce;
        const py = top + (bot - top) * ph; ctx.strokeStyle = "rgba(52,211,153,.5)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - 18, top); ctx.lineTo(x + 18, top); ctx.moveTo(x - 18, bot); ctx.lineTo(x + 18, bot); ctx.stroke();
        ctx.strokeStyle = "rgba(250,204,21,.4)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
        ball(ctx, x, py, 5, "#facc15"); label(ctx, "γ ≈ " + (1 / Math.sqrt(1 - 0.6 * 0.6)).toFixed(2) + "  (v=0.6c)", W / 2, H - 10, "rgba(214,225,240,.8)", 11, "center");
      } },

    /* ---------- 2025-26 research demos (double-slit, Grover, squeezing, magic state, barren plateaus) ---------- */
    { id: "doubleslit", title: "Double-slit interference", node: "wave-duality", domain: "quantum",
      latex: "I(y)\\propto\\cos^2\\!\\Big(\\tfrac{\\pi d\\,y}{\\lambda L}\\Big)",
      caption: "Electrons fired one at a time through two slits each land as a dot — yet a fringe pattern builds. A which-path detector (toggles every ~5 s) collapses the interference to two bands.",
      draw(ctx, t, W, H) {
        const sx = W * 0.08, bx = W * 0.36, scr = W * 0.88, cy = H / 2, gap = H * 0.22;
        const s1 = cy - gap / 2, s2 = cy + gap / 2, det = Math.floor(t / 5) % 2 === 1;
        ball(ctx, sx, cy, 6, "#22d3ee");
        ctx.strokeStyle = "rgba(120,140,180,.6)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(bx, 8); ctx.lineTo(bx, s1 - 6); ctx.moveTo(bx, s1 + 6); ctx.lineTo(bx, s2 - 6); ctx.moveTo(bx, s2 + 6); ctx.lineTo(bx, H - 8); ctx.stroke();
        if (!det) { ctx.lineWidth = 1; for (let k = 0; k < 6; k++) { const rr = ((t * 100) + k * 34) % (scr - bx); ctx.strokeStyle = "rgba(34,211,238," + (0.22 * (1 - rr / (scr - bx))).toFixed(2) + ")"; ctx.beginPath(); ctx.arc(bx, s1, rr, -1.1, 1.1); ctx.stroke(); ctx.beginPath(); ctx.arc(bx, s2, rr, -1.1, 1.1); ctx.stroke(); } }
        ctx.strokeStyle = "rgba(120,140,180,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(scr, 8); ctx.lineTo(scr, H - 8); ctx.stroke();
        ctx.strokeStyle = det ? "#fb7185" : "#67e8f9"; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= 120; i++) { const y = 10 + (H - 20) * i / 120, dy = y - cy; let I; if (det) I = Math.exp(-Math.pow((dy - gap / 2) / 22, 2)) + Math.exp(-Math.pow((dy + gap / 2) / 22, 2)); else I = Math.pow(Math.cos(dy * 0.06), 2) * Math.exp(-Math.pow(dy / (H * 0.36), 2)); const xx = scr + I * 46; i ? ctx.lineTo(xx, y) : ctx.moveTo(xx, y); }
        ctx.stroke();
        const trip = (t * 0.7) % 1, slit = (Math.floor(t * 0.7) % 2) ? s1 : s2; let ex, ey;
        if (trip < 0.5) { const f = trip * 2; ex = sx + (bx - sx) * f; ey = cy + (slit - cy) * f; } else { const f = (trip - 0.5) * 2; ex = bx + (scr - bx) * f; ey = slit + (cy - slit) * f * 0.4; }
        ball(ctx, ex, ey, 4, "#fff");
        label(ctx, det ? "which-path detector ON → no interference" : "no detector → interference builds", W / 2, H - 8, det ? "#fb7185" : "#67e8f9", 11, "center");
      } },

    { id: "grover", title: "Grover search — amplitude amplification", node: "grover", domain: "algorithms",
      latex: "P=\\sin^2\\!\\big((2k{+}1)\\theta\\big),\\ \\sin\\theta=\\tfrac{1}{\\sqrt N}",
      caption: "Searching N items: each Grover iteration rotates the amplitude toward the marked answer by 2θ. After about (π/4)√N steps the marked item is almost certainly found.",
      draw(ctx, t, W, H) {
        const N = 16, m = 11, theta = Math.asin(1 / Math.sqrt(N)), kmax = Math.round(Math.PI / 4 * Math.sqrt(N));
        const k = Math.floor(t / 0.9) % (kmax + 2);
        const aM = Math.sin((2 * k + 1) * theta), aO = Math.cos((2 * k + 1) * theta) / Math.sqrt(N - 1);
        const bw = (W - 40) / N, base = H * 0.82, maxh = H * 0.6;
        for (let i = 0; i < N; i++) { const amp = (i === m) ? Math.abs(aM) : Math.abs(aO), h = amp * maxh; ctx.fillStyle = (i === m) ? "#2dd4bf" : "rgba(120,140,180,.6)"; ctx.fillRect(20 + i * bw + 1, base - h, bw - 2, h); }
        ctx.strokeStyle = "rgba(120,140,180,.4)"; ctx.beginPath(); ctx.moveTo(20, base); ctx.lineTo(W - 20, base); ctx.stroke();
        label(ctx, "marked", 20 + m * bw + bw / 2, base - Math.abs(aM) * maxh - 6, "#2dd4bf", 10, "center");
        label(ctx, "iteration k = " + k + " / " + kmax + "     P(found) = " + (aM * aM * 100).toFixed(0) + "%", W / 2, 18, "rgba(214,225,240,.9)", 12, "center");
      } },

    { id: "squeeze", title: "Spin squeezing — beating the standard limit", node: "uncertainty", domain: "spin",
      latex: "\\Delta\\phi\\,\\Delta J_z\\ge\\tfrac12\\ \\Rightarrow\\ \\Delta\\phi<\\tfrac{1}{\\sqrt N}",
      caption: "Redistribute a collective spin's quantum noise so phase uncertainty Δφ drops below the standard quantum limit (area stays constant) — the trick behind 2025's record optical-lattice clocks.",
      draw(ctx, t, W, H) {
        const cx = W / 2, cy = H * 0.56, R = Math.min(W, H) * 0.3;
        ctx.strokeStyle = "rgba(120,140,180,.35)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        const tipx = cx, tipy = cy - R; arrow(ctx, cx, cy, tipx, tipy, "#f472b6", 2);
        const s = 0.4 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.9)), rt = 18, along = rt * s, radial = rt / s;
        ctx.save(); ctx.translate(tipx, tipy);
        ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(148,163,184,.5)"; ctx.beginPath(); ctx.arc(0, 0, rt, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = "#f472b6"; ctx.fillStyle = "rgba(244,114,182,.18)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, along, radial, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
        label(ctx, "SQL", tipx + rt + 8, tipy - 6, "rgba(148,163,184,.8)", 10);
        label(ctx, "phase noise Δφ ≈ " + s.toFixed(2) + " × SQL", W / 2, 18, "rgba(214,225,240,.9)", 12, "center");
        label(ctx, s < 0.7 ? "squeezed → more precise clock" : "coherent (at the limit)", W / 2, H - 10, s < 0.7 ? "#f472b6" : "rgba(214,225,240,.7)", 11, "center");
      } },

    { id: "magic", title: "Magic state — fuel for a T-gate", node: "magic-state", domain: "quantum-info",
      latex: "|T\\rangle=\\tfrac{1}{\\sqrt2}\\big(|0\\rangle+e^{i\\pi/4}|1\\rangle\\big)",
      caption: "Clifford gates are cheap but not universal — you also need the magic state |T⟩, which lies outside the 'free' stabilizer octahedron. Cultivation/distillation purifies noisy copies into one clean |T⟩.",
      draw(ctx, t, W, H) {
        const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.33;
        ctx.strokeStyle = "rgba(167,139,250,.4)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = "rgba(196,181,253,.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy - R * 0.9); ctx.lineTo(cx + R * 0.9, cy); ctx.lineTo(cx, cy + R * 0.9); ctx.lineTo(cx - R * 0.9, cy); ctx.closePath(); ctx.stroke();
        const ang = -Math.PI / 4, tx = cx + Math.cos(ang) * R, ty = cy + Math.sin(ang) * R;
        arrow(ctx, cx, cy, tx, ty, "#e879f9", 2.5); ball(ctx, tx, ty, 6, "#e879f9"); label(ctx, "|T⟩", tx + 8, ty - 6, "#e879f9", 12);
        const rnd = rng(7), phase = (t * 0.5) % 1;
        for (let i = 0; i < 12; i++) { const jx = (rnd() - 0.5) * R * 0.75, jy = (rnd() - 0.5) * R * 0.75, f = 1 - ((phase + i / 12) % 1); const px = tx + jx * f, py = ty + jy * f; ctx.fillStyle = "rgba(232,121,249," + (0.3 + 0.5 * (1 - f)).toFixed(2) + ")"; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, TAU); ctx.fill(); }
        label(ctx, "noisy copies → distilled |T⟩", W / 2, H - 10, "rgba(214,225,240,.85)", 11, "center");
        label(ctx, "stabilizer 'free' octahedron", cx, cy + R * 0.9 + 15, "rgba(196,181,253,.7)", 10, "center");
      } },

    { id: "barren", title: "Barren plateau — why big VQE stalls", node: "vqe", domain: "algorithms",
      latex: "\\mathrm{Var}[\\partial_\\theta C]\\sim 2^{-n}\\to 0",
      caption: "For many random variational circuits the cost landscape flattens exponentially with qubit number n — gradients vanish and training grinds to a halt. The central obstacle to scaling VQE/QAOA.",
      draw(ctx, t, W, H) {
        const n = 2 + Math.floor((t / 2.2) % 7), amp = Math.pow(2, -(n - 2) / 2.2), y0 = H * 0.55, sc = H * 0.32;
        ctx.strokeStyle = "#2dd4bf"; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= 140; i++) { const x = 20 + (W - 40) * i / 140, th = i / 140 * TAU * 1.5, C = amp * (Math.sin(th * 1.3) * 0.6 + Math.sin(th * 2.1 + 1) * 0.4), y = y0 - C * sc; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
        ctx.strokeStyle = "rgba(120,140,180,.3)"; ctx.beginPath(); ctx.moveTo(20, y0); ctx.lineTo(W - 20, y0); ctx.stroke();
        const px = W * 0.5, th = (px - 20) / (W - 40) * TAU * 1.5;
        const slope = amp * (Math.cos(th * 1.3) * 1.3 * 0.6 + Math.cos(th * 2.1 + 1) * 2.1 * 0.4);
        const gy = y0 - amp * (Math.sin(th * 1.3) * 0.6 + Math.sin(th * 2.1 + 1) * 0.4) * sc;
        arrow(ctx, px, gy, px + 40, gy - slope * sc * 0.3, "#fbbf24", 2);
        label(ctx, "n = " + n + " qubits    Var[∂C] ~ 2^−" + n, W / 2, 18, "rgba(214,225,240,.9)", 12, "center");
        label(ctx, amp < 0.35 ? "landscape flat → gradient ≈ 0 (barren)" : "trainable landscape", W / 2, H - 10, amp < 0.35 ? "#fb7185" : "#2dd4bf", 11, "center");
      } },
  ];

  /* ----------------------------- gallery ------------------------------ */
  let started = false, running = false, speed = 1, t0 = 0, lastFilter = "all", raf = null;
  const cards = []; // {demo, canvas, ctx, dpr}
  let modal = null; // {demo, canvas, ctx}

  function buildControls() {
    const filt = document.getElementById("demoFilters"); if (!filt) return; filt.innerHTML = "";
    const doms = ["all"].concat([...new Set(DEMOS.map(d => d.domain))]);
    doms.forEach(d => {
      const b = document.createElement("button"); b.textContent = d === "all" ? "All (" + DEMOS.length + ")" : (KN.domains[d] ? KN.domains[d].label : d) + " (" + DEMOS.filter(x => x.domain === d).length + ")";
      if (d !== "all" && KN.domains[d]) b.style.borderColor = KN.domains[d].color + "88";
      if (d === lastFilter) b.classList.add("active");
      b.onclick = () => { lastFilter = d; [...filt.children].forEach(c => c.classList.remove("active")); b.classList.add("active"); renderGrid(); };
      filt.appendChild(b);
    });
  }

  function renderGrid() {
    const grid = document.getElementById("demoGrid"); if (!grid) return;
    cards.length = 0; grid.innerHTML = "";
    const list = lastFilter === "all" ? DEMOS : DEMOS.filter(d => d.domain === lastFilter);
    list.forEach(demo => {
      const card = document.createElement("div"); card.className = "demo-card"; card.style.borderTopColor = col(demo.domain);
      const eq = window.TeX ? window.TeX.renderToString(demo.latex, false) : demo.latex;
      card.innerHTML =
        '<div class="dc-head"><span class="dc-title">' + esc(demo.title) + '</span>' +
        '<span class="dc-dom" style="color:' + col(demo.domain) + '">' + esc(KN.domains[demo.domain] ? KN.domains[demo.domain].label : demo.domain) + '</span></div>' +
        '<div class="dc-eq">' + eq + '</div>' +
        '<canvas class="dc-canvas"></canvas>' +
        '<div class="dc-cap">' + esc(demo.caption) + '</div>' +
        '<div class="dc-links"><span class="dc-expand">⤢ expand</span>' +
        (KN.byId[demo.node] ? '<span class="dc-concept" data-id="' + demo.node + '">↳ in the brain</span>' : '') + '</div>';
      grid.appendChild(card);
      const canvas = card.querySelector(".dc-canvas"); const ctx = canvas.getContext("2d");
      cards.push({ demo, canvas, ctx, dpr: 1 });
      card.querySelector(".dc-expand").onclick = () => openModal(demo);
      const cc = card.querySelector(".dc-concept"); if (cc) cc.onclick = () => { window.switchView("net"); if (window.Network) window.Network.focusNode(cc.dataset.id); };
    });
    sizeCanvases();
  }

  function sizeCanvases() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cards.forEach(c => {
      const w = c.canvas.clientWidth || 300, h = c.canvas.clientHeight || 190;
      c.canvas.width = w * dpr; c.canvas.height = h * dpr; c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); c.dpr = dpr; c.w = w; c.h = h;
    });
    if (modal) { const dpr2 = Math.min(window.devicePixelRatio || 1, 2); const w = modal.canvas.clientWidth, h = modal.canvas.clientHeight; modal.canvas.width = w * dpr2; modal.canvas.height = h * dpr2; modal.ctx.setTransform(dpr2, 0, 0, dpr2, 0, 0); modal.w = w; modal.h = h; }
  }

  function frame(now) {
    if (!running) return;
    const t = (now / 1000 - t0) * speed;
    cards.forEach(c => { if (!c.w) return; c.ctx.clearRect(0, 0, c.w, c.h); try { c.demo.draw(c.ctx, t, c.w, c.h); } catch (e) { } });
    if (modal && modal.w) { modal.ctx.clearRect(0, 0, modal.w, modal.h); try { modal.demo.draw(modal.ctx, t, modal.w, modal.h); } catch (e) { } }
    raf = requestAnimationFrame(frame);
  }

  function play() { if (running) return; running = true; t0 = performance.now() / 1000; raf = requestAnimationFrame(frame); setPlayLabel(); }
  function pause() { running = false; if (raf) cancelAnimationFrame(raf); setPlayLabel(); }
  function setPlayLabel() { const b = document.getElementById("demoPlay"); if (b) b.textContent = running ? "⏸ Pause" : "▶ Play"; }

  function openModal(demo) {
    closeModal();
    const ov = document.createElement("div"); ov.className = "demo-modal"; ov.id = "demoModal";
    const eq = window.TeX ? window.TeX.renderToString(demo.latex, true) : demo.latex;
    ov.innerHTML = '<div class="dm-box" style="border-top-color:' + col(demo.domain) + '">' +
      '<span class="dm-close">×</span>' +
      '<h2>' + esc(demo.title) + '</h2><div class="dm-eq">' + eq + '</div>' +
      '<canvas class="dm-canvas"></canvas><p class="dm-cap">' + esc(demo.caption) + '</p></div>';
    document.body.appendChild(ov);
    ov.onclick = (e) => { if (e.target === ov || e.target.className === "dm-close") closeModal(); };
    const canvas = ov.querySelector(".dm-canvas"); modal = { demo, canvas, ctx: canvas.getContext("2d") };
    sizeCanvases();
  }
  function closeModal() { const ov = document.getElementById("demoModal"); if (ov) ov.remove(); modal = null; }

  function init() {
    buildControls();
    const p = document.getElementById("demoPlay"); if (p) p.onclick = () => running ? pause() : play();
    const s = document.getElementById("demoSpeed"); if (s) s.oninput = () => { speed = parseFloat(s.value); const lab = document.getElementById("demoSpeedLab"); if (lab) lab.textContent = speed.toFixed(1) + "×"; };
    window.addEventListener("resize", () => { if (started) sizeCanvases(); });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  }

  function activate() {
    if (!started) { started = true; renderGrid(); }
    sizeCanvases();
    if (!running) { t0 = performance.now() / 1000; running = true; raf = requestAnimationFrame(frame); }
    setPlayLabel();
  }
  function deactivate() { pause(); }

  function esc(s) { return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

  window.Demos = { init, activate, deactivate };
})();
