/* ============================================================================
 *  ATOM-SIM.JS  —  per-element atom simulator + beam experiment (real-time)
 *  ----------------------------------------------------------------------------
 *  Pick any element → watch its nucleus + electron shells. Fire a beam that is
 *  either LIGHT (a photon of chosen wavelength) or MATERIAL (a projectile atom
 *  such as silver/copper, of chosen kinetic energy). Choose the angle and which
 *  shell to hit. Your browser computes the interaction and stores it; this
 *  view animates the beam, the change in the atom's energy levels, and reveals
 *  the calculation steps in real time.
 * ========================================================================== */
(function () {
  "use strict";

  // API base (empty over http/https so the fetch shim in api-shim.js answers same-origin).
  // API; only fall back to the absolute localhost URL when opened directly from a file://.
  const API = (location.protocol === "http:" || location.protocol === "https:") ? "" : "http://localhost:8080";
  const SHELL_LETTERS = "KLMNOPQ";
  const LADDER_W = 96;

  const CAT_COLOR = {
    "Alkali metal": "#f87171", "Alkaline earth metal": "#fb923c", "Transition metal": "#fbbf24",
    "Post-transition metal": "#4ade80", "Metalloid": "#2dd4bf", "Reactive nonmetal": "#38bdf8",
    "Noble gas": "#a78bfa", "Lanthanide": "#f472b6", "Actinide": "#e879f9", "Unknown": "#94a3b8"
  };

  let canvas, ctx, dpr = 1;
  let elements = [];
  let current = null;        // target profile
  let beamType = "light";
  let raf = null, t0 = 0;
  let beam = null;           // active beam animation state
  let stepTimer = null;

  /* ---------- helpers ---------- */
  function shellText(n, count) {
    const L = (n >= 1 && n <= SHELL_LETTERS.length) ? SHELL_LETTERS[n - 1] : ("n" + n);
    return L + " (n=" + n + ") · " + count + " e⁻";
  }
  function neutrons(el) { return Math.max(0, Math.round(el.atomicMass) - el.atomicNumber); }
  function catColor(p) { return CAT_COLOR[p.element.category] || "#94a3b8"; }

  function wavelengthColor(nm) {
    if (nm >= 380 && nm <= 750) {
      let r = 0, g = 0, b = 0;
      if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
      else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
      else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
      else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
      else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
      else { r = 1; }
      const f = nm > 700 ? 0.3 + 0.7 * (750 - nm) / 50 : (nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : 1);
      const c = v => Math.round(255 * Math.min(1, Math.max(0, v * f)));
      return "rgb(" + c(r) + "," + c(g) + "," + c(b) + ")";
    }
    if (nm < 0.01) return "#f0abfc";
    if (nm < 10) return "#a5f3fc";
    if (nm < 380) return "#8b5cf6";
    if (nm < 1e6) return "#ef4444";
    return "#6b7280";
  }

  /* ---------- controls ---------- */
  function buildSelect(id, def) {
    const sel = document.getElementById(id);
    sel.innerHTML = elements.map(p =>
      '<option value="' + p.element.atomicNumber + '">' +
      p.element.atomicNumber + " — " + esc(p.element.symbol) + " " + esc(p.element.name) + "</option>"
    ).join("");
    sel.value = String(def);
  }
  function buildShellSelect() {
    const sel = document.getElementById("simShell");
    const shells = current.shellOccupancy || [];
    sel.innerHTML = shells.map((cnt, i) =>
      '<option value="' + (i + 1) + '">' + esc(shellText(i + 1, cnt)) + "</option>"
    ).join("");
    sel.value = "1";
  }
  function selectTarget(z) {
    current = elements.find(p => p.element.atomicNumber === z) || elements[0];
    buildShellSelect();
    beam = null;
  }
  function toggleType() {
    beamType = document.getElementById("simType").value;
    document.getElementById("simLightCtl").style.display = beamType === "light" ? "" : "none";
    document.getElementById("simMaterialCtl").style.display = beamType === "material" ? "" : "none";
    beam = null;
  }

  /* ---------- geometry ---------- */
  function geom() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const ax0 = LADDER_W;
    const cx = ax0 + (w - ax0) / 2, cy = h / 2;
    const shells = current ? (current.shellOccupancy || []) : [];
    const nShells = Math.max(1, shells.length);
    const maxR = Math.min(w - ax0, h) * 0.42;
    const nucleusR = Math.max(9, maxR * 0.12);
    const r0 = nucleusR + 16;
    const step = (maxR - r0) / nShells;
    return { w, h, cx, cy, shells, nShells, maxR, nucleusR, shellR: i => r0 + step * (i + 1) };
  }

  /* ---------- render loop ---------- */
  function render(ts) {
    if (!canvas) return;
    // self-healing size: the canvas is 0×0 while the tab is hidden; re-size the moment it shows
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (cw > 0 && ch > 0 && (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr))) applySize(cw, ch);
    if (ctx && current && canvas.width > 0) { try { draw(ts); } catch (e) { /* keep the loop alive */ } }
    raf = requestAnimationFrame(render);
  }

  function draw(ts) {
    if (!t0) t0 = ts;
    const time = (ts - t0) / 1000;
    const g = geom();
    ctx.clearRect(0, 0, g.w, g.h);

    const targetShell = parseInt(document.getElementById("simShell").value, 10) || 1;
    drawLevels(g, ts);

    // once the outcome has played out, show the atom's *after* state (electron removed / moved)
    const aft = (beam && beam.result && beam.result.afterState && beam.start && ((ts - beam.start) / 1000 > 0.85))
      ? beam.result.afterState : null;

    for (let i = 0; i < g.shells.length; i++) {
      const R = g.shellR(i), isT = (i + 1) === targetShell;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = isT ? "rgba(56,189,248,.9)" : "rgba(147,162,189,.2)";
      ctx.lineWidth = isT ? 2 : 1; ctx.stroke();
      let count = g.shells[i];
      const dir = i % 2 === 0 ? 1 : -1, speed = 0.5 / (i + 1);
      if (aft) {
        if (aft.ejected && (i + 1) === beam.result.fromShell) count = Math.max(0, count - 1);
        else if (beam.result.toShell && (i + 1) === beam.result.fromShell) count = Math.max(0, count - 1);
        else if (beam.result.toShell && (i + 1) === beam.result.toShell) count = count + 1;
      }
      const dc = Math.min(count, 32);
      for (let e = 0; e < dc; e++) {
        const a = dir * time * speed + (e / dc) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(g.cx + R * Math.cos(a), g.cy + R * Math.sin(a), isT ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isT ? "#38bdf8" : "#93c5fd"; ctx.fill();
      }
      ctx.fillStyle = isT ? "rgba(56,189,248,.9)" : "rgba(147,162,189,.4)";
      ctx.font = "10px Inter, sans-serif"; ctx.fillText(SHELL_LETTERS[i] || ("n" + (i + 1)), g.cx + R + 4, g.cy - 2);
    }

    const ng = ctx.createRadialGradient(g.cx - 4, g.cy - 4, 2, g.cx, g.cy, g.nucleusR);
    ng.addColorStop(0, "#fde68a"); ng.addColorStop(0.5, "#fb923c"); ng.addColorStop(1, "#b45309");
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nucleusR, 0, Math.PI * 2); ctx.fillStyle = ng; ctx.fill();
    const el = current.element;
    ctx.fillStyle = "#1a1206"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold " + Math.round(g.nucleusR * 0.7) + "px Inter, sans-serif";
    ctx.fillText(el.symbol, g.cx, g.cy);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(147,162,189,.7)"; ctx.font = "11px Inter, sans-serif";
    ctx.fillText(el.atomicNumber + " p⁺ · " + neutrons(el) + " n⁰", g.cx - g.nucleusR, g.cy + g.nucleusR + 16);

    if (beam) drawBeam(g, ts);
  }

  /* ---------- energy-level ladder ---------- */
  function levelY(g, E, E1, yTop, yBot) {
    const f = E1 === 0 ? 0 : (E - E1) / (0 - E1);  // 0 at E1 (deep), 1 at continuum
    return yBot - Math.max(0, Math.min(1, f)) * (yBot - yTop);
  }
  function drawLevels(g, ts) {
    const levels = current.quantum && current.quantum.energyLevels_eV;
    if (!levels || !levels.length) return;
    const x1 = 10, x2 = LADDER_W - 12, yTop = 46, yBot = g.h - 26;
    const E1 = levels[0];
    const targetShell = parseInt(document.getElementById("simShell").value, 10) || 1;

    ctx.fillStyle = "rgba(147,162,189,.7)"; ctx.font = "10px Inter, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("E (eV)", x1, 18);
    // continuum line (E = 0 = ionized)
    ctx.strokeStyle = "rgba(248,113,113,.5)"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, yTop); ctx.lineTo(x2, yTop); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(248,113,113,.8)"; ctx.fillText("0 ⟶ free", x1, yTop - 4);

    for (let i = 0; i < levels.length; i++) {
      const y = levelY(g, levels[i], E1, yTop, yBot), isT = (i + 1) === targetShell;
      ctx.strokeStyle = isT ? "rgba(56,189,248,.9)" : "rgba(147,162,189,.35)";
      ctx.lineWidth = isT ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      ctx.fillStyle = isT ? "rgba(56,189,248,.9)" : "rgba(147,162,189,.55)";
      ctx.fillText("n" + (i + 1), x2 + 2, y + 3);
    }

    // electron marker on the ladder (animates during the outcome phase)
    let eY = levelY(g, levels[Math.min(levels.length, targetShell) - 1], E1, yTop, yBot);
    let eX = (x1 + x2) / 2, alpha = 1;
    if (beam && beam.result && beam.start) {
      const te = (ts - beam.start) / 1000 - 0.7;
      if (te > 0) {
        const r = beam.result, f = Math.min(1, te / 1.2);
        const from = (r.fromShell || targetShell);
        const yFrom = levelY(g, levels[Math.min(levels.length, from) - 1], E1, yTop, yBot);
        if (r.ejected) { eY = yFrom + (yTop - 24 - yFrom) * f; alpha = 1 - f * 0.7; }
        else if (r.toShell) {
          const to = Math.min(levels.length, r.toShell);
          const yTo = levelY(g, levels[to - 1], E1, yTop, yBot);
          eY = yFrom + (yTo - yFrom) * f;
        } else { eY = yFrom; }
      }
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(eX, eY, 4, 0, Math.PI * 2); ctx.fillStyle = "#38bdf8"; ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ---------- beam drawing ---------- */
  function drawBeam(g, ts) {
    if (!beam.start) beam.start = ts;
    const elapsed = (ts - beam.start) / 1000;
    const ang = beam.angleDeg * Math.PI / 180;
    const u = { x: Math.cos(ang), y: Math.sin(ang) };
    const targetR = g.shellR((beam.targetShell || 1) - 1);
    const deep = (beam.result && (beam.result.outcome === "ionization" || beam.result.outcome === "nuclear-contact" || beam.result.ejected));
    const hitR = deep ? g.nucleusR + 4 : targetR;
    const hit = { x: g.cx + u.x * hitR, y: g.cy + u.y * hitR };
    const far = { x: g.cx + u.x * (g.maxR + 70), y: g.cy + u.y * (g.maxR + 70) };
    const color = beam.color;

    ctx.save();
    ctx.strokeStyle = color; ctx.globalAlpha = 0.45; ctx.lineWidth = beam.kind === "material" ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(far.x, far.y); ctx.lineTo(hit.x, hit.y); ctx.stroke();
    ctx.globalAlpha = 1;

    const inDur = 0.7;
    if (elapsed < inDur || !beam.result) {
      const f = Math.min(1, elapsed / inDur);
      const px = far.x + (hit.x - far.x) * f, py = far.y + (hit.y - far.y) * f;
      if (beam.kind === "material") solidSphere(px, py, color, beam.projLabel); else photon(px, py, color);
    } else {
      if (beam.kind === "material") solidSphere(hit.x, hit.y, color, "", 0.7); else photon(hit.x, hit.y, color, 0.4);
      outcomeEffect(g, hit, u, elapsed - inDur, color);
    }
    ctx.restore();
  }

  function photon(x, y, color, scale) {
    scale = scale || 1; const r = 6 * scale;
    const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
    gl.addColorStop(0, color); gl.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  function solidSphere(x, y, color, label, scale) {
    scale = scale || 1; const r = 9 * scale;
    const gl = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    gl.addColorStop(0, "#fff"); gl.addColorStop(0.3, color); gl.addColorStop(1, "rgba(0,0,0,.5)");
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = gl; ctx.fill();
    if (label) { ctx.fillStyle = "#fff"; ctx.font = "bold 9px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x, y); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; }
  }

  function outcomeEffect(g, hit, u, te, color) {
    const o = beam.result.outcome, ang = beam.angleDeg * Math.PI / 180, f = Math.min(1, te / 1.4);
    if (o === "photoionization" || o === "ionization") {
      const dir = { x: Math.cos(ang + 0.7), y: Math.sin(ang + 0.7) };
      const ex = hit.x + dir.x * (30 + f * g.maxR), ey = hit.y + dir.y * (30 + f * g.maxR);
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fillStyle = "#f87171"; ctx.fill();
      ctx.fillStyle = "#f87171"; ctx.font = "11px Inter"; ctx.fillText("e⁻", ex + 8, ey);
      if (beam.kind === "material") { // projectile continues through
        const px = hit.x - u.x * f * 40, py = hit.y - u.y * f * 40;
        solidSphere(px + u.x * f * 80, py + u.y * f * 80, color, "", 0.7);
      }
    } else if (o === "excitation") {
      const m = beam.result.toShell || (beam.targetShell + 1);
      const fromR = g.shellR(beam.targetShell - 1), toR = g.shellR(Math.min(g.shells.length, m) - 1);
      const R = fromR + (toR - fromR) * Math.min(1, te / 1.2), a = ang;
      ctx.beginPath(); ctx.arc(g.cx + R * Math.cos(a), g.cy + R * Math.sin(a), 5, 0, Math.PI * 2);
      ctx.fillStyle = "#a78bfa"; ctx.fill();
    } else if (o === "nuclear-contact") {
      const rr = (1 + Math.sin(te * 12)) * 10 + 6;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nucleusR + rr, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(248,113,113," + Math.max(0, 1 - f) + ")"; ctx.lineWidth = 3; ctx.stroke();
    } else {
      // rutherford / compton / elastic: a scattered beam leaves at the chosen angle
      const scatColor = (o === "compton-scattering") ? "#ef4444" : color;
      const dir = { x: Math.cos(ang - Math.PI + beam.angleDeg * Math.PI / 180), y: Math.sin(ang - Math.PI + beam.angleDeg * Math.PI / 180) };
      const dist = f * (g.maxR + 50), sx = hit.x + dir.x * dist, sy = hit.y + dir.y * dist;
      if (beam.kind === "material") solidSphere(sx, sy, color, "", 0.8); else photon(sx, sy, scatColor, 0.9);
    }
  }

  /* ---------- fire ---------- */
  async function fire() {
    if (!current) return;
    const z = current.element.atomicNumber;
    const angle = parseFloat(document.getElementById("simAngle").value);
    const shell = parseInt(document.getElementById("simShell").value, 10) || 1;
    let url, color, kind, projLabel = "";

    if (beamType === "material") {
      const proj = parseInt(document.getElementById("simProjectile").value, 10);
      const energy = parseFloat(document.getElementById("simEnergy").value);
      const eu = document.getElementById("simEnergyUnit").value;
      if (!(energy > 0)) { setDetail('<p class="placeholder">Enter an energy &gt; 0.</p>'); return; }
      const projProfile = elements.find(p => p.element.atomicNumber === proj);
      color = projProfile ? catColor(projProfile) : "#fbbf24";
      projLabel = projProfile ? projProfile.element.symbol : "";
      kind = "material";
      url = API + "/api/beam?type=material&z=" + z + "&projectile=" + proj +
        "&energy_" + eu + "=" + energy + "&angle=" + angle + "&shell=" + shell;
    } else {
      const wl = parseFloat(document.getElementById("simWavelength").value);
      const unit = document.getElementById("simUnit").value;
      if (!(wl > 0)) { setDetail('<p class="placeholder">Enter a wavelength &gt; 0.</p>'); return; }
      const nm = unit === "pm" ? wl / 1000 : wl;
      color = wavelengthColor(nm); kind = "light";
      url = API + "/api/beam?type=light&z=" + z + "&wavelength_" + unit + "=" + wl + "&angle=" + angle + "&shell=" + shell;
    }

    setDetail('<p class="placeholder">Firing… computing the interaction live.</p>');
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || ("HTTP " + r.status)); }
      const result = await r.json();
      beam = { angleDeg: angle, targetShell: shell, color: color, kind: kind, projLabel: projLabel, result: result, start: 0 };
      showResult(result, color);
      revealSteps(result.steps || []);
      loadHistory();
    } catch (e) {
      beam = null;
      const fileMode = location.protocol === "file:";
      setDetail('<div class="sim-warn"><b>Couldn\'t compute this shot.</b><br><br>' +
        'Try reloading the page.<br>' +
        '' +
        '' +
        '' +
        '<br><br><span style="color:var(--text-faint)">(' + esc(String(e.message || e)) + ')</span></div>');
    }
  }

  /* ---------- result + steps + history ---------- */
  function badge(o) {
    const m = {
      "photoionization": ["#f87171", "Photoionization"], "ionization": ["#f87171", "Ionization"],
      "excitation": ["#a78bfa", "Excitation"], "compton-scattering": ["#fbbf24", "Compton"],
      "elastic-scattering": ["#38bdf8", "Elastic"], "rutherford-scattering": ["#22d3ee", "Rutherford"],
      "nuclear-contact": ["#fb7185", "Nuclear contact"]
    }[o] || ["#93a2bd", o];
    return '<span class="sim-badge" style="--b:' + m[0] + '">' + esc(m[1]) + "</span>";
  }

  function showResult(r, color) {
    const add = (k, v) => '<div class="pt-row"><span class="pt-k">' + esc(k) + '</span><span class="pt-v">' + esc(v) + "</span></div>";
    let head;
    if (r.beamType === "material") {
      head = add("Beam", r.projectileSymbol + " (Z=" + r.projectileZ + ") · " + num(r.projectileEnergy_eV) + " eV");
    } else {
      head = add("Beam", num(r.wavelengthNm) + " nm · " + num(r.photonEnergy_eV) + " eV · " + r.band);
    }
    let rows = add("Target", r.symbol + " (Z=" + r.atomicNumber + ")") + head +
      add("Angle", num(r.angleDeg) + "°") +
      add("Shell", r.shellLabel + " · binding " + num(r.targetBinding_eV) + " eV");
    if (r.details) for (const k in r.details) rows += add(prettyKey(k), fmtVal(r.details[k]));

    setDetail(
      '<div class="sim-res-head"><span class="sim-swatch" style="background:' + color + '"></span>' + badge(r.outcome) + "</div>" +
      '<div class="sim-verdict">' + esc(r.verdict) + "</div>" +
      '<h4 class="sim-steps-title">Calculation (real time)</h4><div class="sim-steps" id="simSteps"></div>' +
      '<div class="sim-rows">' + rows + "</div>" +
      afterStateHTML(r) +
      '<div class="sim-history" id="simHistory"></div>'
    );
  }

  function afterStateHTML(r) {
    const a = r.afterState;
    if (!a) return "";
    const chargeTxt = a.chargeAfter > 0 ? ("+" + a.chargeAfter + " (cation)") : (a.chargeAfter < 0 ? String(a.chargeAfter) : "0 (neutral)");
    const add = (k, v) => '<div class="pt-row"><span class="pt-k">' + esc(k) + '</span><span class="pt-v">' + esc(v) + "</span></div>";
    let rows = add("State", a.stateLabel) + add("Charge", chargeTxt) +
      add("Electrons", a.electronsBefore + " → " + a.electronsAfter) +
      add("Shells", "[" + (a.shellOccupancyBefore || []).join(",") + "] → [" + (a.shellOccupancyAfter || []).join(",") + "]");
    if (a.energyAbsorbed_eV) rows += add("Energy absorbed", num(a.energyAbsorbed_eV) + " eV");
    return '<h4 class="sim-after-title' + (a.changed ? " changed" : "") + '">Atom after the shot' +
      (a.changed ? " ⚡" : "") + "</h4>" +
      '<div class="sim-rows">' + rows + "</div>" +
      '<div class="sim-after-note">' + esc(a.note) + "</div>";
  }

  function revealSteps(steps) {
    if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
    const host = document.getElementById("simSteps");
    if (!host) return;
    host.innerHTML = "";
    let i = 0;
    const show = () => {
      if (i >= steps.length) { clearInterval(stepTimer); stepTimer = null; return; }
      const s = steps[i++];
      const div = document.createElement("div");
      div.className = "sim-step";
      div.innerHTML = '<span class="sim-step-k">' + esc(s.label) + '</span><span class="sim-step-v">' + esc(s.value) + "</span>";
      host.appendChild(div);
    };
    show();
    stepTimer = setInterval(show, 650);
  }

  async function loadHistory() {
    const host = document.getElementById("simHistory");
    if (!host) return;
    try {
      const r = await fetch(API + "/api/beam/history");
      if (!r.ok) return;
      const list = await r.json();
      host.innerHTML = '<h4 class="sim-hist-title">Shots this session · ' + list.length + "</h4>" +
        list.slice(-12).reverse().map(b => {
          const beamTxt = b.beamType === "material"
            ? (b.projectileSymbol + "→" + b.symbol + " " + num(b.projectileEnergy_eV) + "eV")
            : (b.symbol + " " + num(b.wavelengthNm) + "nm");
          return '<div class="sim-hist-row">#' + b.id + " " + esc(beamTxt) + " · " + num(b.angleDeg) + "° · " + esc(b.shellLabel) + " " + badge(b.outcome) + "</div>";
        }).join("");
    } catch (e) { /* server gone */ }
  }

  function setDetail(html) { const d = document.getElementById("simDetail"); if (d) d.innerHTML = html; }

  /* ---------- formatting ---------- */
  const SUPER = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  function sup(n) { const neg = n < 0; return (neg ? "⁻" : "") + String(Math.abs(n)).split("").map(d => SUPER[+d]).join(""); }
  function num(v) {
    if (typeof v !== "number") return String(v);
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a >= 1e-3 && a < 1e5) return String(Number(v.toPrecision(5)));
    let exp = Math.floor(Math.log10(a)), mant = v / Math.pow(10, exp);
    mant = Math.round(mant * 1000) / 1000;
    if (Math.abs(mant) >= 10) { mant /= 10; exp++; }
    return String(mant) + "×10" + sup(exp);
  }
  function fmtVal(v) { if (typeof v === "number") return num(v); if (typeof v === "boolean") return v ? "yes" : "no"; return String(v); }
  function prettyKey(k) {
    let unit = ""; const m = k.match(/_(eV|pm|nm|fm|Hz|barn_per_sr)$/);
    if (m) { unit = " (" + m[1].replace("barn_per_sr", "barn/sr") + ")"; k = k.slice(0, -(m[1].length + 1)); }
    let l = k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
    return l.charAt(0).toUpperCase() + l.slice(1) + unit;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  /* ---------- sizing + boot ---------- */
  function applySize(cw, ch) {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function resize() {
    if (!canvas) return;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (cw > 0 && ch > 0) applySize(cw, ch);
  }

  function init() {
    canvas = document.getElementById("simCanvas");
    elements = window.PERIODIC_DATA || [];
    if (!canvas || !elements.length) return;

    buildSelect("simElement", 79);     // gold target by default (dramatic)
    buildSelect("simProjectile", 47);  // silver projectile by default
    selectTarget(79);

    document.getElementById("simElement").addEventListener("change", e => selectTarget(parseInt(e.target.value, 10)));
    document.getElementById("simShell").addEventListener("change", () => { beam = null; });
    document.getElementById("simType").addEventListener("change", toggleType);
    const angleEl = document.getElementById("simAngle");
    angleEl.addEventListener("input", () => { document.getElementById("simAngleVal").textContent = angleEl.value + "°"; });
    document.getElementById("simFire").addEventListener("click", fire);

    resize();
    if (!raf) { t0 = 0; raf = requestAnimationFrame(render); }
    loadHistory();
  }

  window.AtomSim = { init: init, activate: function () { resize(); if (!raf) { t0 = 0; raf = requestAnimationFrame(render); } } };
  window.addEventListener("resize", resize);
  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
})();
