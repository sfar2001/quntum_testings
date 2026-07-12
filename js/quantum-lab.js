/* ============================================================================
 *  QUANTUM-LAB.JS  —  numerical Schrödinger solver + qubit/Bloch simulator
 *  ----------------------------------------------------------------------------
 *  Both are REAL numerical computations done live in your browser:
 *    /api/schrodinger?z=   → finite-difference radial Coulomb eigensolve (Eₙ + |u(r)|²)
 *    /api/qubit?gates=&init= → apply a gate sequence to a Bloch vector (trajectory)
 *  This tab fetches them and draws the wavefunctions and the Bloch trajectory.
 * ========================================================================== */
(function () {
  "use strict";

  const API = (location.protocol === "http:" || location.protocol === "https:") ? "" : "http://localhost:8080";
  const COLORS = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24"];

  let elements = [];

  /* ---------- Schrödinger ---------- */
  async function solveSchrodinger() {
    const z = parseInt(document.getElementById("qsElement").value, 10);
    const out = document.getElementById("qsOut");
    out.innerHTML = '<p class="placeholder">Solving the Schrödinger equation…</p>';
    try {
      const r = await fetch(API + "/api/schrodinger?z=" + z);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const sol = await r.json();
      renderSchrodinger(out, sol);
    } catch (e) {
      out.innerHTML = serverWarn(e);
    }
  }

  function renderSchrodinger(out, sol) {
    const states = sol.states || [];
    let rows = '<table class="q-table"><tr><th>orbital</th><th>numeric Eₙ (eV)</th><th>analytic −13.6·Z²/n² (eV)</th><th>error</th></tr>';
    states.forEach((s, i) => {
      rows += '<tr><td style="color:' + COLORS[i % 4] + '">' + esc(s.orbital) + '</td><td>' +
        num(s.energyNumeric_eV) + "</td><td>" + num(s.energyAnalytic_eV) + "</td><td>" + num(s.errorPercent) + "%</td></tr>";
    });
    rows += "</table>";
    out.innerHTML =
      "<h4>Numerical eigenvalues vs. the closed form</h4>" + rows +
      "<h4>Radial probability density |u(r)|² (r = r·R)</h4>" + chart(states) +
      '<p class="q-note">' + esc(sol.method) + " · rMax = " + num(sol.radialMaxPm) + " pm</p>";
  }

  function chart(states) {
    let xMax = 0, yMax = 0;
    states.forEach(s => (s.radialDensity || []).forEach(p => { xMax = Math.max(xMax, p[0]); yMax = Math.max(yMax, p[1]); }));
    if (xMax <= 0 || yMax <= 0) return "";
    const W = 480, H = 240, pL = 50, pB = 30, pT = 12, pR = 12;
    const X = r => pL + (r / xMax) * (W - pL - pR);
    const Y = d => H - pB - (d / yMax) * (H - pT - pB);
    let svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="q-chart" preserveAspectRatio="xMidYMid meet">';
    svg += ln(pL, H - pB, W - pR, H - pB) + ln(pL, pT, pL, H - pB);
    for (let g = 1; g <= 4; g++) { const gx = pL + (g / 4) * (W - pL - pR); svg += '<text x="' + gx + '" y="' + (H - pB + 14) + '" class="q-ax">' + Math.round(xMax * g / 4) + "</text>"; }
    svg += '<text x="' + ((W + pL) / 2) + '" y="' + (H - 2) + '" class="q-ax" text-anchor="middle">r (pm)</text>';
    svg += '<text x="6" y="' + (pT + 6) + '" class="q-ax">|u|²</text>';
    states.forEach((s, i) => {
      const pts = (s.radialDensity || []).map(p => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ");
      svg += '<polyline points="' + pts + '" fill="none" stroke="' + COLORS[i % 4] + '" stroke-width="2"/>';
    });
    svg += "</svg>";
    const legend = '<div class="q-legend">' + states.map((s, i) =>
      '<span><i style="background:' + COLORS[i % 4] + '"></i>' + esc(s.orbital) + "</span>").join("") + "</div>";
    return svg + legend;
  }

  /* ---------- Quantum circuit (1–3 qubits) ---------- */
  let qcOps = [];
  function qcN() { return parseInt(document.getElementById("qcN").value, 10) || 2; }
  function buildQubitSelects() {
    const n = qcN();
    ["qcQ1", "qcC1", "qcC2", "qcT"].forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      const cur = parseInt(el.value, 10);
      el.innerHTML = "";
      for (let q = 0; q < n; q++) el.insertAdjacentHTML("beforeend", "<option value='" + q + "'>q" + q + "</option>");
      if (cur >= 0 && cur < n) el.value = String(cur);
    });
    if (n >= 2) { document.getElementById("qcC1").value = "0"; document.getElementById("qcT").value = "1"; if (n >= 3) document.getElementById("qcC2").value = "2"; }
    // drop ops referencing qubits beyond n
    qcOps = qcOps.filter(o => maxIdx(o) < n);
    renderOps();
  }
  function maxIdx(op) { const m = op.match(/\d+/g) || ["0"]; return Math.max.apply(null, m.map(Number)); }
  function renderOps() {
    const v = document.getElementById("qcOpsView"); if (!v) return;
    v.innerHTML = qcOps.length ? qcOps.map(o => '<span class="qc-chip">' + esc(o) + "</span>").join("") : '<span class="nb-faint">no gates yet — add some, or pick a preset</span>';
  }
  function addGate(g) {
    const n = qcN();
    if ("HXYZST".indexOf(g) >= 0) { qcOps.push(g + document.getElementById("qcQ1").value); }
    else {
      const c1 = document.getElementById("qcC1").value, c2 = document.getElementById("qcC2").value, t = document.getElementById("qcT").value;
      if (g === "CCX") { if (n < 3 || new Set([c1, c2, t]).size < 3) return; qcOps.push("CCX" + c1 + "-" + c2 + "-" + t); }
      else { if (c1 === t) return; qcOps.push(g + c1 + "-" + t); }
    }
    renderOps();
  }
  function preset(name) {
    if (name === "bell") { document.getElementById("qcN").value = "2"; qcOps = ["H0", "CX0-1"]; }
    else if (name === "ghz") { document.getElementById("qcN").value = "3"; qcOps = ["H0", "CX0-1", "CX1-2"]; }
    buildQubitSelects(); runCircuit();
  }
  async function runCircuit() {
    const out = document.getElementById("qcOut");
    const shots = parseInt(document.getElementById("qcShots").value, 10) || 0;
    out.innerHTML = '<p class="placeholder">Simulating the circuit…</p>';
    try {
      const r = await fetch(API + "/api/circuit?n=" + qcN() + "&ops=" + encodeURIComponent(qcOps.join(" ")) + "&shots=" + shots);
      if (!r.ok) throw new Error("HTTP " + r.status);
      renderCircuit(out, await r.json());
    } catch (e) { out.innerHTML = serverWarn(e); }
  }
  function renderCircuit(out, res) {
    let h = qcDiagram(res.numQubits, (res.gates || "").split(/\s+/).filter(Boolean));
    h += '<h4>State vector |ψ⟩</h4><div class="qc-sv">';
    res.stateVector.forEach(s => {
      const amp = num(s.re) + (s.im >= 0 ? "+" : "") + num(s.im) + "i";
      h += '<div class="qc-svrow"><span class="qc-ket">' + esc(s.basis) + '</span>' +
        '<span class="qc-bar"><span style="width:' + Math.round(s.prob * 100) + '%"></span></span>' +
        '<span class="qc-amp">' + num(s.prob) + ' <span class="nb-faint">' + esc(amp) + "</span></span></div>";
    });
    h += "</div>";
    h += '<p class="q-note">' + (res.entangled ? '<b style="color:#f472b6">Entangled</b> — ' : '<b style="color:#4ade80">Separable</b> — ') + esc(res.note) + "</p>";
    h += '<h4>Per-qubit measurement (reduced state)</h4><div class="qc-qubits">';
    res.qubits.forEach(q => {
      h += '<div class="qc-qcard"><div class="qc-qt">q' + q.index + (q.entangled ? ' · <span style="color:#f472b6">entangled</span>' : "") + "</div>" +
        '<div class="q-bloch-row">' + blochSVG("x–z", q.sx, q.sz, "x", "z") + blochSVG("x–y", q.sx, q.sy, "x", "y") + "</div>" +
        '<div class="qc-qstats">P0=' + num(q.p0) + " P1=" + num(q.p1) + " · ⟨X⟩=" + num(q.sx) + " ⟨Y⟩=" + num(q.sy) + " ⟨Z⟩=" + num(q.sz) + " · purity=" + num(q.purity) + "</div></div>";
    });
    h += "</div>";
    if (res.histogram && res.histogram.length) {
      const mx = Math.max.apply(null, res.histogram.map(x => x.count));
      h += "<h4>Measurement — " + res.shots + " shots</h4><div class='qc-hist'>";
      res.histogram.forEach(b => { h += '<div class="qc-hbar"><span class="qc-hk">' + esc(b.basis) + '</span><span class="qc-hb"><span style="width:' + Math.round(b.count / mx * 100) + '%"></span></span><span class="qc-hc">' + b.count + " (" + num(b.freq) + ")</span></div>"; });
      h += "</div>";
    }
    h += qcEquations(res);
    out.innerHTML = h;
  }
  function qcDiagram(n, ops) {
    const x0 = 34, dx = 46, y0 = 24, dy = 40, W = x0 + Math.max(1, ops.length) * dx + 20, H = y0 + (n - 1) * dy + 24;
    const Y = q => y0 + (n - 1 - q) * dy; // q0 at bottom
    let s = '<svg viewBox="0 0 ' + W + " " + H + '" class="qc-diagram">';
    for (let q = 0; q < n; q++) { s += '<text x="6" y="' + (Y(q) + 4) + '" class="q-ax">q' + q + "</text>"; s += '<line x1="' + x0 + '" y1="' + Y(q) + '" x2="' + (W - 6) + '" y2="' + Y(q) + '" stroke="#23304f"/>'; }
    ops.forEach((op, col) => {
      const cx = x0 + (col + 0.5) * dx;
      const m = op.match(/^([A-Za-z]+)([\d-]*)$/); if (!m) return;
      const g = m[1].toUpperCase(), idx = (m[2] || "").split("-").filter(x => x !== "").map(Number);
      const box = (q, label, col2) => '<rect x="' + (cx - 12) + '" y="' + (Y(q) - 12) + '" width="24" height="24" rx="4" fill="' + (col2 || "#16203a") + '" stroke="#38bdf8"/><text x="' + cx + '" y="' + (Y(q) + 4) + '" text-anchor="middle" class="qc-glab">' + label + "</text>";
      const dot = q => '<circle cx="' + cx + '" cy="' + Y(q) + '" r="4" fill="#38bdf8"/>';
      const oplus = q => '<circle cx="' + cx + '" cy="' + Y(q) + '" r="10" fill="none" stroke="#38bdf8"/><line x1="' + cx + '" y1="' + (Y(q) - 10) + '" x2="' + cx + '" y2="' + (Y(q) + 10) + '" stroke="#38bdf8"/><line x1="' + (cx - 10) + '" y1="' + Y(q) + '" x2="' + (cx + 10) + '" y2="' + Y(q) + '" stroke="#38bdf8"/>';
      const vline = (a, b) => '<line x1="' + cx + '" y1="' + Y(a) + '" x2="' + cx + '" y2="' + Y(b) + '" stroke="#38bdf8"/>';
      if ("HXYZST".indexOf(g) >= 0 && idx.length) s += box(idx[0], g);
      else if ((g === "CX" || g === "CNOT") && idx.length >= 2) s += vline(idx[0], idx[1]) + dot(idx[0]) + oplus(idx[1]);
      else if (g === "CZ" && idx.length >= 2) s += vline(idx[0], idx[1]) + dot(idx[0]) + dot(idx[1]);
      else if ((g === "SW" || g === "SWAP") && idx.length >= 2) s += vline(idx[0], idx[1]) + xmark(cx, Y(idx[0])) + xmark(cx, Y(idx[1]));
      else if ((g === "CCX" || g === "TOFF") && idx.length >= 3) s += vline(Math.min(idx[0], idx[2]), Math.max(idx[1], idx[2])) + dot(idx[0]) + dot(idx[1]) + oplus(idx[2]);
    });
    return s + "</svg>";
    function xmark(cx, cy) { return '<line x1="' + (cx - 7) + '" y1="' + (cy - 7) + '" x2="' + (cx + 7) + '" y2="' + (cy + 7) + '" stroke="#38bdf8"/><line x1="' + (cx - 7) + '" y1="' + (cy + 7) + '" x2="' + (cx + 7) + '" y2="' + (cy - 7) + '" stroke="#38bdf8"/>'; }
  }
  function qcEquations(res) {
    const KN = window.KNOWLEDGE;
    const terms = res.stateVector.filter(s => s.prob > 1e-6).map(s => "(" + num(s.re) + (s.im >= 0 ? "+" : "") + num(s.im) + "i)" + esc(s.basis)).join("  +  ");
    const normSum = res.stateVector.reduce((a, s) => a + s.prob, 0);
    const row = (k, v) => '<div class="pt-row"><span class="pt-k">' + esc(k) + '</span><span class="pt-v">' + v + "</span></div>";
    let computed = row("|ψ⟩ = Σ cᵢ|i⟩", esc(terms || "—")) +
      row("Σ|cᵢ|² (normalization)", num(normSum)) +
      row("Born rule", "P(i) = |cᵢ|² (bars above)") +
      res.qubits.map(q => row("q" + q.index + ": ⟨Z⟩, purity Tr(ρ²)", num(q.sz) + ", " + num(q.purity))).join("");
    let refs = "";
    if (KN && KN.nodes) {
      KN.nodes.filter(nd => nd.domain === "quantum-info" || nd.id === "born-rule" || nd.id === "normalization").forEach(nd => {
        const tex = (nd.latex && window.TeX) ? window.TeX.renderToString(nd.latex, false) : esc(nd.latex || "");
        refs += '<div class="qc-eq"><span class="qc-eqn">' + esc(nd.name) + "</span>" + tex + "</div>";
      });
    }
    [["Tensor product (composite system)", "|\\psi\\rangle = |a\\rangle \\otimes |b\\rangle"],
     ["Reduced density matrix", "\\rho_q = \\mathrm{Tr}_{\\mathrm{rest}}\\,|\\psi\\rangle\\langle\\psi| = \\tfrac12(\\mathbb{I} + \\vec s\\cdot\\vec\\sigma)"],
     ["Purity / entanglement witness", "\\mathrm{Tr}(\\rho_q^2) < 1 \\;\\Leftrightarrow\\; \\text{entangled}"],
     ["Toffoli (CCNOT)", "|a,b,c\\rangle \\to |a,b,\\,c\\oplus(a\\wedge b)\\rangle"]].forEach(e => {
      const tex = window.TeX ? window.TeX.renderToString(e[1], false) : e[1];
      refs += '<div class="qc-eq"><span class="qc-eqn">' + esc(e[0]) + "</span>" + tex + "</div>";
    });
    return "<h4>Equations — this circuit (live values)</h4><div class='sim-rows'>" + computed + "</div>" +
      "<h4>Equations — qubit &amp; multi-qubit algebra</h4><div class='qc-eqs'>" + refs + "</div>";
  }

  function blochSVG(title, h, v, hl, vl) {
    h = h || 0; v = v || 0;
    const S = 150, c = S / 2, R = S / 2 - 16;
    let svg = '<div class="q-bloch"><div class="q-bloch-t">' + esc(title) + "</div>";
    svg += '<svg viewBox="0 0 ' + S + " " + S + '" class="q-bloch-svg">';
    svg += '<circle cx="' + c + '" cy="' + c + '" r="' + R + '" fill="none" stroke="#23304f"/>';
    svg += ln(c - R, c, c + R, c) + ln(c, c - R, c, c + R);
    svg += '<text x="' + (c + R - 6) + '" y="' + (c - 4) + '" class="q-ax">+' + hl + "</text>";
    svg += '<text x="' + (c + 4) + '" y="' + (c - R + 10) + '" class="q-ax">+' + vl + "</text>";
    const tx = c + h * R, ty = c - v * R;
    svg += '<line x1="' + c + '" y1="' + c + '" x2="' + tx.toFixed(1) + '" y2="' + ty.toFixed(1) + '" stroke="#38bdf8" stroke-width="2.5"/>';
    svg += '<circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="4" fill="#38bdf8"/>';
    svg += "</svg></div>";
    return svg;
  }


  /* ---------- H₂ molecule ---------- */
  async function solveH2() {
    const out = document.getElementById("h2Out");
    out.innerHTML = '<p class="placeholder">Computing H₂ (STO-3G integrals + CI)…</p>';
    try {
      const r = await fetch(API + "/api/molecule");
      if (!r.ok) throw new Error("HTTP " + r.status);
      renderH2(out, await r.json());
    } catch (e) { out.innerHTML = serverWarn(e); }
  }
  function renderH2(out, sol) {
    const eq = sol.equilibrium || {}, d = sol.detail || {};
    const add = (k, v) => '<div class="pt-row"><span class="pt-k">' + esc(k) + '</span><span class="pt-v">' + esc(v) + "</span></div>";
    let rows = add("Equilibrium bond length", num(eq.bondLength_angstrom) + " Å (" + num(eq.bondLength_bohr) + " bohr)") +
      add("Ground-state energy", num(eq.energy_hartree) + " Ha (" + num(eq.energy_eV) + " eV)") +
      add("Dissociation energy", num(eq.dissociationEnergy_eV) + " eV") +
      add("Isolated H atom", num(d.isolatedHAtom_hartree) + " Ha") +
      add("Ground state", num(d.bondingConfigWeightPercent) + "% |σ_g²⟩ + " + num(d.antibondingConfigWeightPercent) + "% |σ_u²⟩") +
      add("Excited ¹Σg⁺", num(d.excitedSinglet_hartree) + " Ha");
    const p = d.effectiveQubitHamiltonian || {};
    rows += add("Effective qubit H", "cI=" + num(p.cI) + ", cZ=" + num(p.cZ) + ", cX=" + num(p.cX) + " Ha");
    out.innerHTML = "<h4>Dissociation curve E(R)</h4>" + curveH2(sol.curve, eq) +
      '<div class="sim-rows">' + rows + "</div>" +
      '<p class="q-note">' + esc(sol.basis) + "</p>";
  }
  function curveH2(curve, eq) {
    if (!curve || !curve.length) return "";
    let xn = Infinity, xx = -Infinity, yn = Infinity, yx = -Infinity;
    curve.forEach(p => { xn = Math.min(xn, p[0]); xx = Math.max(xx, p[0]); yn = Math.min(yn, p[1]); yx = Math.max(yx, p[1]); });
    const W = 480, H = 240, pL = 58, pB = 30, pT = 12, pR = 12;
    const X = r => pL + ((r - xn) / (xx - xn)) * (W - pL - pR);
    const Y = e => H - pB - ((e - yn) / (yx - yn)) * (H - pT - pB);
    let svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="q-chart" preserveAspectRatio="xMidYMid meet">';
    svg += ln(pL, H - pB, W - pR, H - pB) + ln(pL, pT, pL, H - pB);
    for (let g = 0; g <= 4; g++) { const gx = pL + g / 4 * (W - pL - pR); svg += '<text x="' + gx + '" y="' + (H - pB + 14) + '" class="q-ax" text-anchor="middle">' + (xn + (xx - xn) * g / 4).toFixed(1) + "</text>"; }
    svg += '<text x="' + ((W + pL) / 2) + '" y="' + (H - 1) + '" class="q-ax" text-anchor="middle">R (Å)</text>';
    svg += '<text x="6" y="' + (pT + 8) + '" class="q-ax">E (Ha)</text>';
    svg += '<polyline points="' + curve.map(p => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ") + '" fill="none" stroke="#22d3ee" stroke-width="2"/>';
    if (eq.bondLength_angstrom != null) {
      const ex = X(eq.bondLength_angstrom), ey = Y(eq.energy_hartree);
      svg += '<line x1="' + ex.toFixed(1) + '" y1="' + pT + '" x2="' + ex.toFixed(1) + '" y2="' + (H - pB) + '" stroke="#f5a623" stroke-dasharray="3 3"/>';
      svg += '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="4" fill="#f5a623"/>';
      svg += '<text x="' + (ex + 5) + '" y="' + (ey - 6) + '" class="q-ax" fill="#f5a623">eq ' + num(eq.bondLength_angstrom) + 'Å</text>';
    }
    return svg + "</svg>";
  }

  /* ---------- wave packet ---------- */
  let wpFrames = [], wpX = [], wpTimes = [], wpMax = 1, wpIdx = 0, wpTimer = null, wpCanvas = null, wpCtx = null;
  async function runWavePacket() {
    const out = document.getElementById("wpOut");
    const pot = document.getElementById("wpPot").value;
    const k0 = parseFloat(document.getElementById("wpK0").value) || 0;
    out.innerHTML = '<p class="placeholder">Evolving (split-step Fourier)…</p>';
    try {
      const r = await fetch(API + "/api/wavepacket?potential=" + encodeURIComponent(pot) + "&k0=" + k0);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const ev = await r.json();
      wpFrames = ev.frames || []; wpX = ev.x || []; wpTimes = ev.times || []; wpIdx = 0;
      wpMax = 1e-9; wpFrames.forEach(f => f.forEach(v => { if (v > wpMax) wpMax = v; }));
      out.innerHTML = '<canvas id="wpCanvas" class="wp-canvas"></canvas>' +
        '<p class="q-note" id="wpInfo"></p><p class="q-note">' + esc(ev.note) +
        " · norm " + num(ev.normInitial) + " → " + num(ev.normFinal) + " (conserved)</p>";
      wpCanvas = document.getElementById("wpCanvas");
      wpCanvas.width = wpCanvas.clientWidth * (window.devicePixelRatio || 1);
      wpCanvas.height = wpCanvas.clientHeight * (window.devicePixelRatio || 1);
      wpCtx = wpCanvas.getContext("2d");
      wpCtx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      drawWave(0); startWave();
    } catch (e) { out.innerHTML = serverWarn(e); }
  }
  function drawWave(i) {
    if (!wpCtx || !wpFrames.length) return;
    const W = wpCanvas.clientWidth, H = wpCanvas.clientHeight, pad = 26;
    wpCtx.clearRect(0, 0, W, H);
    const f = wpFrames[i], xn = wpX[0], xx = wpX[wpX.length - 1];
    const X = x => pad + ((x - xn) / (xx - xn)) * (W - 2 * pad);
    const Y = d => H - pad - (d / wpMax) * (H - 2 * pad);
    wpCtx.strokeStyle = "#23304f"; wpCtx.beginPath(); wpCtx.moveTo(pad, H - pad); wpCtx.lineTo(W - pad, H - pad); wpCtx.stroke();
    wpCtx.beginPath(); wpCtx.moveTo(X(wpX[0]), Y(0));
    for (let j = 0; j < f.length; j++) wpCtx.lineTo(X(wpX[j]), Y(f[j]));
    wpCtx.lineTo(X(wpX[f.length - 1]), Y(0)); wpCtx.closePath();
    wpCtx.fillStyle = "rgba(56,189,248,.25)"; wpCtx.fill();
    wpCtx.strokeStyle = "#38bdf8"; wpCtx.lineWidth = 2; wpCtx.beginPath();
    for (let j = 0; j < f.length; j++) { const px = X(wpX[j]), py = Y(f[j]); j ? wpCtx.lineTo(px, py) : wpCtx.moveTo(px, py); }
    wpCtx.stroke();
    const info = document.getElementById("wpInfo");
    if (info) info.textContent = "t = " + num(wpTimes[i]) + "   (|ψ(x,t)|², frame " + (i + 1) + "/" + wpFrames.length + ")";
  }
  function startWave() {
    if (wpTimer) clearInterval(wpTimer);
    wpTimer = setInterval(() => { wpIdx = (wpIdx + 1) % wpFrames.length; drawWave(wpIdx); }, 90);
  }
  function toggleWave() {
    if (wpTimer) { clearInterval(wpTimer); wpTimer = null; }
    else if (wpFrames.length) startWave();
  }

  /* ---------- quantum error correction (the Willow below-threshold story) ---------- */
  async function runQEC() {
    const out = document.getElementById("qecOut");
    const code = document.getElementById("qecCode").value;
    const p = parseFloat(document.getElementById("qecP").value) || 0;
    const dists = document.getElementById("qecDist").value;
    const shots = parseInt(document.getElementById("qecShots").value, 10) || 0;
    out.innerHTML = '<p class="placeholder">Simulating error correction…</p>';
    try {
      const r = await fetch(API + "/api/qec?code=" + code + "&p=" + p + "&distances=" + encodeURIComponent(dists) + "&shots=" + shots);
      if (!r.ok) throw new Error("HTTP " + r.status);
      renderQEC(out, await r.json());
    } catch (e) { out.innerHTML = serverWarn(e); }
  }
  function renderQEC(out, r) {
    const add = (k, v) => '<div class="pt-row"><span class="pt-k">' + esc(k) + '</span><span class="pt-v">' + v + "</span></div>";
    let rows = '<table class="q-table"><tr><th>distance d</th><th>physical qubits</th><th>logical error (exact)</th><th>Monte-Carlo</th></tr>';
    r.perDistance.forEach(d => {
      rows += "<tr><td>" + d.distance + "</td><td>" + d.physicalQubits + "</td><td>" + num(d.logicalErrorExact) +
        "</td><td>" + (d.logicalErrorMonteCarlo != null ? num(d.logicalErrorMonteCarlo) : "—") + "</td></tr>";
    });
    rows += "</table>";
    let lam = r.lambda.map(l => "Λ(" + l.fromDistance + "→" + l.toDistance + ") = " + (l.suppressionFactor != null ? num(l.suppressionFactor) : "∞")).join(" · ");
    const cls = r.belowThreshold ? "ok" : "warn";
    out.innerHTML =
      '<div class="qec-verdict ' + cls + '">' + esc(r.verdict) + "</div>" +
      "<h4>Logical error vs physical error rate (log scale) — curves cross at the threshold</h4>" + qecChart(r) +
      "<h4>At p = " + num(r.physicalErrorRate) + "</h4>" +
      add("Suppression factor", lam || "—") + "<div class='sim-rows'></div>" + rows +
      '<p class="q-note">' + esc(r.note) + " Google's <b>Willow</b> chip (2024) measured Λ ≈ 2.14 per distance step — the first time adding qubits made a logical qubit <i>better</i>.</p>";
  }
  function qecChart(r) {
    const curve = r.curve || []; if (!curve.length) return "";
    const dists = r.perDistance.map(d => d.distance);
    const W = 500, H = 260, pL = 56, pB = 34, pT = 14, pR = 12;
    const xMax = curve[curve.length - 1].p;
    const X = p => pL + (p / xMax) * (W - pL - pR);
    const lo = -4; // log10 floor
    const Y = pl => { const L = Math.max(lo, Math.log10(Math.max(1e-9, pl))); return (H - pB) - ((L - lo) / (0 - lo)) * (H - pT - pB); };
    let svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="q-chart" preserveAspectRatio="xMidYMid meet">';
    for (let e = 0; e >= lo; e--) { const gy = Y(Math.pow(10, e)); svg += '<line x1="' + pL + '" y1="' + gy + '" x2="' + (W - pR) + '" y2="' + gy + '" stroke="#16203a"/><text x="' + (pL - 4) + '" y="' + (gy + 3) + '" class="q-ax" text-anchor="end">10' + supExp(e) + "</text>"; }
    for (let g = 0; g <= 4; g++) { const gx = pL + g / 4 * (W - pL - pR); svg += '<text x="' + gx + '" y="' + (H - pB + 14) + '" class="q-ax" text-anchor="middle">' + num(xMax * g / 4) + "</text>"; }
    svg += '<text x="' + ((W + pL) / 2) + '" y="' + (H - 1) + '" class="q-ax" text-anchor="middle">physical error rate p</text>';
    svg += '<text x="6" y="' + (pT + 8) + '" class="q-ax">P_L</text>';
    // threshold line
    const tx = X(r.threshold);
    svg += '<line x1="' + tx.toFixed(1) + '" y1="' + pT + '" x2="' + tx.toFixed(1) + '" y2="' + (H - pB) + '" stroke="#f5a623" stroke-dasharray="4 3"/><text x="' + (tx + 3) + '" y="' + (pT + 10) + '" class="q-ax" fill="#f5a623">threshold ' + num(r.threshold) + "</text>";
    // current-p marker
    const cxp = X(r.physicalErrorRate);
    svg += '<line x1="' + cxp.toFixed(1) + '" y1="' + pT + '" x2="' + cxp.toFixed(1) + '" y2="' + (H - pB) + '" stroke="rgba(56,189,248,.4)"/>';
    dists.forEach((d, i) => {
      const pts = curve.map(c => X(c.p).toFixed(1) + "," + Y(c.logical[i]).toFixed(1)).join(" ");
      svg += '<polyline points="' + pts + '" fill="none" stroke="' + COLORS[i % 4] + '" stroke-width="2"/>';
    });
    svg += "</svg>";
    const legend = '<div class="q-legend">' + dists.map((d, i) => '<span><i style="background:' + COLORS[i % 4] + '"></i>d=' + d + "</span>").join("") + "</div>";
    return svg + legend;
  }
  function supExp(e) { return e === 0 ? "⁰" : ("⁻" + String(Math.abs(e)).split("").map(c => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c]).join("")); }

  /* ---------- helpers ---------- */
  function ln(x1, y1, x2, y2) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#5e6e8c" stroke-width="1"/>'; }
  function serverWarn(e) {
    return '<div class="sim-warn"><b>Couldn\'t compute this.</b><br>Try reloading the page. ' +
      '(' + esc(String(e.message || e)) + ")</div>";
  }
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  function sup(n) { const neg = n < 0; return (neg ? "⁻" : "") + String(Math.abs(n)).split("").map(d => SUP[+d]).join(""); }
  function num(v) {
    if (typeof v !== "number") return String(v);
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a >= 1e-3 && a < 1e5) return String(Number(v.toPrecision(5)));
    let exp = Math.floor(Math.log10(a)), m = v / Math.pow(10, exp);
    m = Math.round(m * 1000) / 1000; if (Math.abs(m) >= 10) { m /= 10; exp++; }
    return String(m) + "×10" + sup(exp);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  /* ---------- boot ---------- */
  function init() {
    elements = window.PERIODIC_DATA || [];
    const sel = document.getElementById("qsElement");
    if (!sel) return;
    sel.innerHTML = elements.map(p => '<option value="' + p.element.atomicNumber + '">' +
      p.element.atomicNumber + " — " + esc(p.element.symbol) + " " + esc(p.element.name) + "</option>").join("");
    sel.value = "1"; // hydrogen — exact benchmark
    document.getElementById("qsSolve").addEventListener("click", solveSchrodinger);
    document.getElementById("qcN").addEventListener("change", buildQubitSelects);
    document.getElementById("qcRun").addEventListener("click", runCircuit);
    document.querySelectorAll("[data-g]").forEach(b => b.addEventListener("click", () => addGate(b.dataset.g)));
    document.querySelectorAll("[data-preset]").forEach(b => b.addEventListener("click", () => preset(b.dataset.preset)));
    document.getElementById("qcUndo").addEventListener("click", () => { qcOps.pop(); renderOps(); });
    document.getElementById("qcClear").addEventListener("click", () => { qcOps = []; renderOps(); });
    buildQubitSelects();
    document.getElementById("h2Solve").addEventListener("click", solveH2);
    document.getElementById("wpRun").addEventListener("click", runWavePacket);
    document.getElementById("wpPlay").addEventListener("click", toggleWave);
    document.getElementById("qecRun").addEventListener("click", runQEC);
    document.getElementById("qecCode").addEventListener("change", () => {
      const surf = document.getElementById("qecCode").value === "surface";
      document.getElementById("qecP").value = surf ? "0.05" : "0.1";
    });
  }

  window.QuantumLab = { init: init, activate: function () {} };
  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
})();
