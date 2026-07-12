/* ============================================================================
 *  NOTEBOOK.JS  —  your personal lab notebook
 *  ----------------------------------------------------------------------------
 *  Free-form blocks: notes, equations (live KaTeX), comparison tables, ideas.
 *  Stored in your browser via localStorage (mirrored through /api/notebook), survives
 *  restarts) with an immediate localStorage mirror so nothing is ever lost.
 *  Other views can drop equations in via window.Notebook.addEquation(latex,name).
 * ========================================================================== */
(function () {
  "use strict";

  const API = (location.protocol === "http:" || location.protocol === "https:") ? "" : "http://localhost:8080";
  const LS_KEY = "quantumAtomLab.notebook";

  let nb = { title: "My lab notebook", blocks: [], view: null };
  let nbId = 1;
  let loaded = false;
  let saveTimer = null;
  let elements = [], byZ = {};
  let board = null;                       // freeform canvas controller
  const bscale = () => (board ? board.getView().scale : 1);
  const DEFAULT_W = { note: 320, idea: 320, equation: 380, table: 520, comparison: 560, reaction: 620, experiment: 660 };
  function defaultW(t) { return DEFAULT_W[t] || 360; }

  /* ---------- load / save ---------- */
  async function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    // prefer the server; fall back to localStorage
    try {
      const r = await fetch(API + "/api/notebook");
      if (r.ok) {
        const data = await r.json();
        if (data && Array.isArray(data.blocks) && (data.blocks.length || data.title)) nb = normalize(data);
        else useLocal();
      } else useLocal();
    } catch (e) { useLocal(); }
    reseedIds();
  }
  function useLocal() {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (s) { const d = JSON.parse(s); if (d && Array.isArray(d.blocks)) nb = normalize(d); }
    } catch (e) { /* ignore */ }
  }
  function normalize(d) {
    return { title: d.title || "My lab notebook", blocks: Array.isArray(d.blocks) ? d.blocks : [], view: d.view || null };
  }
  function reseedIds() { nb.blocks.forEach(b => { if (!b.id) b.id = nbId++; else nbId = Math.max(nbId, b.id + 1); }); }

  function scheduleSave() {
    // immediate local mirror
    try { localStorage.setItem(LS_KEY, JSON.stringify(nb)); } catch (e) { /* ignore */ }
    status("saving…", "");
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 700);
  }
  async function saveNow() {
    try {
      const r = await fetch(API + "/api/notebook", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nb)
      });
      status(r.ok ? "saved ✓" : "saved locally", r.ok ? "ok" : "warn");
    } catch (e) {
      status("saved locally", "warn");
    }
  }
  function status(text, cls) {
    const el = document.getElementById("nbStatus");
    if (el) { el.textContent = text; el.className = "nb-status " + (cls || ""); }
  }

  /* ---------- block operations ---------- */
  function addBlock(type, seed) {
    const b = { id: nbId++, type: type };
    if (type === "note" || type === "idea") b.text = (seed && seed.text) || "";
    else if (type === "equation") { b.latex = (seed && seed.latex) || ""; b.caption = (seed && seed.caption) || ""; }
    else if (type === "table") {
      b.title = (seed && seed.title) || "Data table";
      b.headers = (seed && seed.headers) || ["quantity", "value", "unit", "note"];
      b.rows = (seed && seed.rows) || [["", "", "", ""], ["", "", "", ""]];
    }
    else if (type === "reaction") { b.atoms = (seed && seed.atoms) || []; }
    else if (type === "experiment") { b.exp = (seed && seed.exp) || "spectrum"; b.z = (seed && seed.z) || 1; b.z2 = (seed && seed.z2) || 17; b.params = (seed && seed.params) || {}; b.result = (seed && seed.result) || null; }
    else if (type === "coupling") { b.a = (seed && seed.a) || "bond-vibration"; b.b = (seed && seed.b) || "schrodinger-tdse"; }
    else if (type === "comparison") {
      b.title = (seed && seed.title) || "Comparison";
      b.rowLabels = (seed && seed.rowLabels) || ["quantity 1", "quantity 2"];
      b.sets = (seed && seed.sets) || [{ name: "Set A", values: ["", ""] }, { name: "Set B", values: ["", ""] }];
      b.conclusion = (seed && seed.conclusion) || "";
    }
    // place the new card near the centre-top of the current view, with a slight cascade
    const v = board ? board.getView() : { x: 24, y: 24, scale: 1 };
    const casc = (nb.blocks.length % 6) * 26;
    b.x = (seed && isFinite(seed.x)) ? seed.x : Math.round((-v.x) / v.scale + 50 + casc);
    b.y = (seed && isFinite(seed.y)) ? seed.y : Math.round((-v.y) / v.scale + 50 + casc);
    b.w = (seed && seed.w) || defaultW(type);
    nb.blocks.push(b);
    render(); scheduleSave();
    toast("Added — drag it anywhere on the board");
  }
  function removeBlock(id) { nb.blocks = nb.blocks.filter(b => b.id !== id); render(); scheduleSave(); }
  function moveBlock(id, dir) {
    const i = nb.blocks.findIndex(b => b.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= nb.blocks.length) return;
    const t = nb.blocks[i]; nb.blocks[i] = nb.blocks[j]; nb.blocks[j] = t;
    render(); scheduleSave();
  }
  function blockById(id) { return nb.blocks.find(b => b.id === id); }

  /* ---------- public API (used by other views) ---------- */
  async function addEquation(latex, caption) {
    await ensureLoaded();
    addBlock("equation", { latex: latex || "", caption: caption || "" });
    toast("Added to 📓 Notebook");
  }
  async function addNote(text) { await ensureLoaded(); addBlock("note", { text: text || "" }); toast("Added to 📓 Notebook"); }
  async function addCoupling(aId) {
    await ensureLoaded();
    const KN = window.KNOWLEDGE;
    const bId = (KN && KN.byId[aId] && firstPartner(KN, aId)) || "schrodinger-tdse";
    addBlock("coupling", { a: aId, b: bId });
    if (window.switchView) window.switchView("notebook");
    toast("Combine in 📓 — " + ((KN && KN.byId[aId]) ? KN.byId[aId].name : aId));
  }

  /* ---------- freeform board ---------- */
  function attachBoard() {
    const vp = document.getElementById("nbBlocks");
    if (!vp || !window.Board || board) return;
    board = window.Board.attach(vp, {
      onMove: (el, x, y) => { const b = blockById(parseInt(el.dataset.id, 10)); if (b) { b.x = Math.round(x); b.y = Math.round(y); scheduleSave(); } },
      onResize: (el, w, h, dir) => { const b = blockById(parseInt(el.dataset.id, 10)); if (b) { if (dir !== "y") b.w = Math.round(w); if (dir !== "x") b.h = Math.round(h); scheduleSave(); } },
      onView: (v, committed) => { nb.view = { x: Math.round(v.x), y: Math.round(v.y), scale: +(+v.scale).toFixed(3) }; if (committed) scheduleSave(); }
    });
  }
  function ensurePositions() {
    let i = 0;
    nb.blocks.forEach(b => {
      if (!isFinite(b.x) || !isFinite(b.y)) { const c = i % 2; b.x = 24 + c * 470; b.y = 24 + Math.floor(i / 2) * 250; i++; }
      if (!isFinite(b.w)) b.w = defaultW(b.type);
    });
  }

  /* ---------- render ---------- */
  function render() {
    if (!board) attachBoard();
    const surface = board ? board.surface : document.getElementById("nbBlocks");
    if (!surface) return;
    ensurePositions();
    surface.innerHTML = "";
    if (!nb.blocks.length) {
      surface.innerHTML = '<p class="placeholder nb-empty">Empty board. Add an equation, note, table, comparison, atom reaction, or experiment from the toolbar — '
        + 'then <b>drag a card by its header</b> to move it, scroll to zoom, drag the background to pan. (Or click 📓 on any equation elsewhere to drop it here.)</p>';
    } else {
      nb.blocks.forEach(b => {
        const el = blockEl(b);
        el.dataset.id = b.id;
        el.style.left = b.x + "px"; el.style.top = b.y + "px"; el.style.width = b.w + "px";
        if (isFinite(b.h)) el.style.height = b.h + "px";
        surface.appendChild(el);
        if (board) board.equip(el);
      });
    }
    const titleEl = document.getElementById("nbTitle");
    if (titleEl && titleEl.value !== nb.title) titleEl.value = nb.title;
  }

  function blockEl(b) {
    const wrap = document.createElement("div");
    wrap.className = "nb-block nb-" + b.type;
    const tag = { note: "Note", idea: "Idea", equation: "Equation", table: "Table", reaction: "Atom reaction", comparison: "Comparison", experiment: "Experiment", coupling: "Combine equations" }[b.type] || b.type;
    let head = '<div class="nb-bhead" data-board-handle><span class="nb-tag">⠿ ' + tag + '</span>'
      + '<span class="nb-bctl"><button data-act="up" title="move up">↑</button>'
      + '<button data-act="down" title="move down">↓</button>'
      + '<button data-act="del" title="delete">✕</button></span></div>';
    wrap.innerHTML = head;
    const body = document.createElement("div"); body.className = "nb-body";
    wrap.appendChild(body);

    if (b.type === "note" || b.type === "idea") {
      const ta = document.createElement("textarea");
      ta.className = "nb-text"; ta.value = b.text || "";
      ta.placeholder = b.type === "idea" ? "an idea, hypothesis, thing to try…" : "your observations / notes…";
      ta.addEventListener("input", () => { b.text = ta.value; scheduleSave(); });
      body.appendChild(ta);
    } else if (b.type === "equation") {
      const cap = document.createElement("input");
      cap.className = "nb-cap"; cap.value = b.caption || ""; cap.placeholder = "label (e.g. Heisenberg exchange)";
      const tex = document.createElement("textarea");
      tex.className = "nb-latex"; tex.value = b.latex || ""; tex.placeholder = "LaTeX, e.g.  E_n = -13.6\\,\\frac{Z^2}{n^2}";
      const prev = document.createElement("div"); prev.className = "nb-eqprev";
      const renderTex = () => {
        if (window.TeX && b.latex && b.latex.trim()) prev.innerHTML = window.TeX.renderToString(b.latex, true);
        else prev.innerHTML = '<span class="nb-faint">— preview —</span>';
      };
      cap.addEventListener("input", () => { b.caption = cap.value; scheduleSave(); });
      tex.addEventListener("input", () => { b.latex = tex.value; renderTex(); scheduleSave(); });
      body.appendChild(cap); body.appendChild(tex); body.appendChild(prev);
      renderTex();
    } else if (b.type === "table") {
      const title = document.createElement("input");
      title.className = "nb-cap"; title.value = b.title || ""; title.placeholder = "table title";
      title.addEventListener("input", () => { b.title = title.value; scheduleSave(); });
      body.appendChild(title);
      body.appendChild(tableEl(b));
      const bar = document.createElement("div"); bar.className = "nb-tbar";
      bar.innerHTML = '<button data-t="addrow">+ row</button><button data-t="addcol">+ col</button>'
        + '<button data-t="delrow">− row</button><button data-t="delcol">− col</button>';
      bar.querySelector('[data-t=addrow]').onclick = () => { b.rows.push(b.headers.map(() => "")); render(); scheduleSave(); };
      bar.querySelector('[data-t=addcol]').onclick = () => { b.headers.push("col"); b.rows.forEach(r => r.push("")); render(); scheduleSave(); };
      bar.querySelector('[data-t=delrow]').onclick = () => { if (b.rows.length > 1) b.rows.pop(); render(); scheduleSave(); };
      bar.querySelector('[data-t=delcol]').onclick = () => { if (b.headers.length > 1) { b.headers.pop(); b.rows.forEach(r => r.pop()); } render(); scheduleSave(); };
      body.appendChild(bar);
    } else if (b.type === "reaction") {
      reactionInto(b, body);
    } else if (b.type === "experiment") {
      experimentInto(b, body);
    } else if (b.type === "coupling") {
      couplingInto(b, body);
    } else if (b.type === "comparison") {
      comparisonInto(b, body);
    }

    wrap.querySelector('[data-act=up]').onclick = () => moveBlock(b.id, -1);
    wrap.querySelector('[data-act=down]').onclick = () => moveBlock(b.id, 1);
    wrap.querySelector('[data-act=del]').onclick = () => removeBlock(b.id);
    return wrap;
  }

  function tableEl(b) {
    const t = document.createElement("table"); t.className = "nb-table";
    const thead = document.createElement("tr");
    b.headers.forEach((h, c) => {
      const th = document.createElement("th");
      const inp = document.createElement("input"); inp.value = h;
      inp.addEventListener("input", () => { b.headers[c] = inp.value; scheduleSave(); });
      th.appendChild(inp); thead.appendChild(th);
    });
    t.appendChild(thead);
    b.rows.forEach((row, r) => {
      const tr = document.createElement("tr");
      row.forEach((cell, c) => {
        const td = document.createElement("td");
        const inp = document.createElement("input"); inp.value = cell;
        inp.addEventListener("input", () => { b.rows[r][c] = inp.value; scheduleSave(); });
        td.appendChild(inp); tr.appendChild(td);
      });
      t.appendChild(tr);
    });
    return t;
  }

  /* ---------- reaction block: drag Bohr atoms, see their interaction ---------- */
  const RX_SCALE = 1.5; // pm per pixel

  function reactionInto(b, wrap) {
    if (!b.atoms) b.atoms = [];
    const ctl = document.createElement("div"); ctl.className = "nb-rctl";
    const sel = document.createElement("select");
    sel.innerHTML = elements.map(p => '<option value="' + p.element.atomicNumber + '">' +
      p.element.atomicNumber + " " + esc(p.element.symbol) + "</option>").join("");
    sel.value = "1";
    const add = document.createElement("button"); add.textContent = "+ atom";
    const clr = document.createElement("button"); clr.textContent = "clear"; clr.className = "nb-ghost2";
    const hint = document.createElement("span"); hint.className = "nb-faint";
    hint.textContent = "add atoms, then drag them together to see how they react";
    ctl.append(sel, add, clr, hint);
    const canvas = document.createElement("canvas"); canvas.className = "nb-rcanvas";
    const out = document.createElement("div"); out.className = "nb-rout";
    wrap.append(ctl, canvas, out);

    let dragIdx = -1, throttle = null, ctx = null;
    function size() {
      const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 600, h = canvas.clientHeight || 220;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function closestPair() {
      let best = null, bd = Infinity;
      for (let i = 0; i < b.atoms.length; i++) for (let j = i + 1; j < b.atoms.length; j++) {
        const d = Math.hypot(b.atoms[i].x - b.atoms[j].x, b.atoms[i].y - b.atoms[j].y);
        if (d < bd) { bd = d; best = [i, j, d]; }
      }
      return best;
    }
    function draw() {
      if (!ctx) return;
      const W = canvas.clientWidth || 600, H = canvas.clientHeight || 220;
      ctx.clearRect(0, 0, W, H);
      const pair = closestPair();
      if (pair) {
        const a = b.atoms[pair[0]], c = b.atoms[pair[1]];
        ctx.strokeStyle = "rgba(56,189,248,.5)"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "var(--text-dim)"; ctx.fillStyle = "#93a2bd"; ctx.font = "10px Inter";
        ctx.fillText(Math.round(pair[2] * RX_SCALE) + " pm", (a.x + c.x) / 2 + 4, (a.y + c.y) / 2 - 4);
      }
      b.atoms.forEach(at => drawBohr(ctx, byZ[at.z], at.x, at.y));
      if (!b.atoms.length) { ctx.fillStyle = "#5e6e8c"; ctx.font = "12px Inter"; ctx.fillText("add an atom ↑", 14, 24); }
    }
    function compute() {
      const pair = closestPair();
      if (!pair) { out.innerHTML = '<span class="nb-faint">Add a second atom and drag it close to the first.</span>'; return; }
      const a = b.atoms[pair[0]], c = b.atoms[pair[1]], dpm = pair[2] * RX_SCALE;
      fetch(API + "/api/interaction?z1=" + a.z + "&z2=" + c.z + "&distance_pm=" + dpm.toFixed(1))
        .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
        .then(res => { out.innerHTML = interactionHTML(res); })
        .catch(e => { out.innerHTML = '<span class="nb-faint">Could not compute the reaction. (' + esc(String(e.message || e)) + ')</span>'; });
    }
    function throttled() { if (throttle) return; throttle = setTimeout(() => { throttle = null; compute(); }, 150); }
    function onMove(e) {
      if (dragIdx < 0) return;
      const r = canvas.getBoundingClientRect(), W = canvas.clientWidth || 600, H = canvas.clientHeight || 220, s = bscale();
      let x = Math.max(30, Math.min(W - 30, (e.clientX - r.left) / s)), y = Math.max(30, Math.min(H - 30, (e.clientY - r.top) / s));
      b.atoms[dragIdx].x = x; b.atoms[dragIdx].y = y; draw(); throttled();
    }
    function onUp() { if (dragIdx >= 0) { dragIdx = -1; scheduleSave(); compute(); } window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
    canvas.addEventListener("mousedown", e => {
      const r = canvas.getBoundingClientRect(), s = bscale(), mx = (e.clientX - r.left) / s, my = (e.clientY - r.top) / s;
      for (let i = b.atoms.length - 1; i >= 0; i--) if (Math.hypot(mx - b.atoms[i].x, my - b.atoms[i].y) < 36) { dragIdx = i; break; }
      if (dragIdx >= 0) { window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp); }
    });
    add.onclick = () => { const W = canvas.clientWidth || 600; b.atoms.push({ z: parseInt(sel.value, 10), x: 70 + (b.atoms.length * 130) % Math.max(140, W - 140), y: 110 }); scheduleSave(); draw(); compute(); };
    clr.onclick = () => { b.atoms = []; scheduleSave(); draw(); compute(); };
    requestAnimationFrame(() => { size(); draw(); compute(); });
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => { size(); draw(); }); ro.observe(canvas); }
  }

  function drawBohr(ctx, p, cx, cy) {
    if (!p) return;
    const shells = p.shellOccupancy || [], nR = Math.min(shells.length, 4), R = 34;
    for (let i = 0; i < nR; i++) {
      const rr = 16 + (i + 1) / nR * (R - 14);
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.strokeStyle = "rgba(147,162,189,.3)"; ctx.lineWidth = 1; ctx.stroke();
      const cnt = Math.min(shells[i], 10);
      for (let e = 0; e < cnt; e++) {
        const ang = (e / cnt) * Math.PI * 2 + i;
        ctx.beginPath(); ctx.arc(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang), 2.4, 0, Math.PI * 2); ctx.fillStyle = "#93c5fd"; ctx.fill();
      }
    }
    const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 12);
    g.addColorStop(0, "#fde68a"); g.addColorStop(1, "#b45309");
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = "#1a1206"; ctx.font = "bold 11px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.element.symbol, cx, cy); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  function interactionHTML(res) {
    const c = res.classical || {}, q = res.quantum || {};
    const row = (k, v) => '<div class="pt-row"><span class="pt-k">' + esc(k) + '</span><span class="pt-v">' + esc(v) + "</span></div>";
    let h = '<div class="nb-bond">' + esc(res.symbol1) + " + " + esc(res.symbol2) + " · <b>" + esc(res.bondType) + "</b></div>";
    h += '<div class="nb-verdict">' + esc(res.verdict) + "</div>";
    h += row("Separation", num(res.distancePm) + " pm");
    h += row("Nuclear Coulomb repulsion", num(c.nuclearCoulombRepulsion_eV) + " eV");
    h += row("Force", num(c.force_nN) + " nN");
    h += row("Valence", num(q.valence1) + " & " + num(q.valence2));
    if (q.electronsTransferred != null) h += row("Electrons transferred", q.electronsTransferred);
    if (q.electronsShared != null) h += row("Electrons shared", q.electronsShared);
    if (q.predictedSpecies) h += row("Predicted species", q.predictedSpecies);
    if (q.reference) h += '<div class="nb-faint" style="margin-top:6px">' + esc(q.reference) + "</div>";
    return h;
  }

  /* ====================================================================== *
   *  EXPERIMENT block: run an animated experiment on a REAL chosen atom and
   *  see the computed results (from the in-browser physics engine).
   * ====================================================================== */
  const HC_EVNM = 1239.841984;        // hc in eV·nm  → λ = hc/E
  const LARMOR_GHZ_PER_T = 28.024951; // electron-spin Larmor frequency per tesla
  const A0_NM = 0.0529177;            // Bohr radius (nm)
  const MU_B_EV_T = 5.7883818e-5;     // Bohr magneton (eV/T)
  // web-sourced work functions φ (eV), by atomic number (Cs 2.1 … Pt 6.35)
  const WORK_FN = { 3: 2.9, 4: 5.0, 6: 4.81, 11: 2.36, 12: 3.68, 13: 4.08, 19: 2.30, 20: 2.9, 26: 4.5, 27: 5.0, 28: 5.01, 29: 4.7, 30: 4.3, 34: 5.11, 37: 2.16, 41: 4.3, 47: 4.26, 48: 4.07, 55: 2.10, 74: 4.55, 78: 6.35, 79: 5.1, 80: 4.5, 82: 4.14, 92: 3.6 };
  function clampInt(v, lo, hi, def) { v = parseInt(v, 10); if (!isFinite(v)) v = def; return Math.max(lo, Math.min(hi, v)); }
  function clampNum(v, lo, hi, def) { v = parseFloat(v); if (!isFinite(v)) v = def; return Math.max(lo, Math.min(hi, v)); }

  /* small canvas primitives */
  function eBall(ctx, x, y, r, color, lbl) {
    const g = ctx.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
    g.addColorStop(0, "#fff"); g.addColorStop(.35, color); g.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    if (lbl) { ctx.fillStyle = "#04121f"; ctx.font = "bold " + Math.round(r * 1.1) + "px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(lbl, x, y + .5); }
  }
  function eArrow(ctx, x1, y1, x2, y2, color, w) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w || 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1), h = 7; ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(a - .4), y2 - h * Math.sin(a - .4)); ctx.lineTo(x2 - h * Math.cos(a + .4), y2 - h * Math.sin(a + .4)); ctx.closePath(); ctx.fill();
  }
  function eText(ctx, txt, x, y, color, size, align) { ctx.fillStyle = color || "rgba(214,225,240,.85)"; ctx.font = (size || 11) + "px Inter"; ctx.textAlign = align || "left"; ctx.textBaseline = "alphabetic"; ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 3; ctx.fillText(txt, x, y); ctx.shadowBlur = 0; }
  function eWave(ctx, x0, y, x1, amp, color, k, phase) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); for (let x = x0; x <= x1; x += 2) { const yy = y + amp * Math.sin(k * (x - x0) - phase); x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); }
  function wavelengthColor(nm) {
    if (nm < 380) return "#a78bfa"; if (nm > 740) return "#7f1d1d";
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = (440 - nm) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = (510 - nm) / 20; } else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = (645 - nm) / 65; } else { r = 1; }
    return "rgb(" + (r * 255 | 0) + "," + (g * 255 | 0) + "," + (b * 255 | 0) + ")";
  }
  function region(nm) { return nm < 10 ? "X-ray" : nm < 380 ? "ultraviolet" : nm < 740 ? "visible" : nm < 1e6 ? "infrared" : "microwave"; }

  const EXPERIMENTS = {
    spectrum: {
      title: "Atomic spectrum — quantum jump",
      latex: "\\Delta E = E_{n_2}-E_{n_1},\\;\\; \\lambda = \\frac{hc}{\\Delta E}",
      blurb: "A hydrogen-like ion of nuclear charge Z: an electron drops between levels and emits a photon of exactly ΔE.",
      needs: { element: true, params: [{ key: "nHi", label: "from n", def: 2, min: 2, max: 6 }, { key: "nLo", label: "to n", def: 1, min: 1, max: 5 }] },
      async run(b) {
        const z = b.z; let method = "numerical Schrödinger";
        const byN = {};
        try { const r = await fetch(API + "/api/schrodinger?z=" + z); if (r.ok) { const s = await r.json(); (s.states || []).forEach(st => { if (byN[st.n] == null) byN[st.n] = st.energyNumeric_eV; }); } } catch (e) { }
        const En = (n) => byN[n] != null ? byN[n] : (method = "analytic −13.6·Z²/n²", -13.6057 * z * z / (n * n));
        let nHi = clampInt(b.params.nHi, 2, 6, 2), nLo = clampInt(b.params.nLo, 1, 5, 1);
        if (nHi <= nLo) nHi = nLo + 1;
        const eHi = En(nHi), eLo = En(nLo), photonE = eHi - eLo, lambda = HC_EVNM / photonE;
        const sym = byZ[z] ? byZ[z].element.symbol : "Z" + z;
        const levels = []; for (let n = 1; n <= Math.max(nHi, 4); n++) levels.push({ n, E: En(n) });
        const color = wavelengthColor(lambda);
        const rows = [
          ["Ion (hydrogen-like)", sym + "  (Z = " + z + ", 1 electron)"],
          ["E(n=" + nHi + ")", num(eHi) + " eV"], ["E(n=" + nLo + ")", num(eLo) + " eV"],
          ["ΔE (photon)", num(photonE) + " eV"], ["Wavelength λ", num(lambda) + " nm"],
          ["Spectral region", region(lambda)], ["Method", method]];
        return { rows, note: "Bohr/Schrödinger result for a single-electron ion of charge Z (multi-electron screening not included).", state: { levels, eHi, eLo, nHi, nLo, lambda, color } };
      },
      anim(ctx, t, W, H, s) {
        const left = 40, right = W - 26; const Es = s.levels.map(l => l.E); const Emax = Math.max(...Es, s.eHi), Emin = Math.min(...Es, s.eLo);
        const yOf = (E) => H * 0.86 - (H * 0.7) * (E - Emin) / ((Emax - Emin) || 1);
        ctx.lineWidth = 2; s.levels.forEach(l => { const y = yOf(l.E); ctx.strokeStyle = "rgba(120,140,180,.5)"; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right - 90, y); ctx.stroke(); eText(ctx, "n=" + l.n, right - 84, y + 4, "rgba(214,225,240,.7)", 10); });
        const ph = (t % 3) / 3, yHi = yOf(s.eHi), yLo = yOf(s.eLo), ey = yHi + (yLo - yHi) * Math.min(1, ph * 1.4), ex = (left + right - 90) / 2;
        eBall(ctx, ex, ey, 7, "#22d3ee", "−");
        if (ph > 0.7) { const pr = (ph - 0.7) / 0.3; eWave(ctx, ex, yLo, ex + pr * 120, 7, s.color, 0.5, t * 8); eText(ctx, "λ = " + num(s.lambda) + " nm", ex + 8, yLo - 12, s.color, 10); }
        eText(ctx, "n=" + s.nHi + " → n=" + s.nLo, left, 16, "rgba(214,225,240,.85)", 11);
      }
    },
    photonbeam: {
      title: "Photon beam on the atom",
      latex: "E=\\frac{hc}{\\lambda}\\;\\;\\text{vs}\\;\\;B_n=\\frac{13.6\\,Z^2}{n^2}",
      blurb: "Fire light of a chosen wavelength at a shell: does it scatter, excite, or ionise the atom?",
      needs: { element: true, params: [{ key: "wl", label: "λ (nm)", def: 5, min: 0.001, max: 1000, step: 0.1 }, { key: "shell", label: "shell", select: [["1", "K (n=1)"], ["2", "L (n=2)"], ["3", "M (n=3)"]] }, { key: "angle", label: "angle°", def: 90, min: 0, max: 180 }] },
      async run(b) {
        const z = b.z, wl = clampNum(b.params.wl, 0.001, 1e6, 5), shell = clampInt(b.params.shell, 1, 5, 1), ang = clampNum(b.params.angle, 0, 180, 90);
        const r = await fetch(API + "/api/beam?type=light&z=" + z + "&wavelength_nm=" + wl + "&shell=" + shell + "&angle=" + ang); if (!r.ok) throw new Error("HTTP " + r.status); const res = await r.json();
        const af = res.afterState || {};
        const rows = [
          ["Atom", res.symbol + "  (Z = " + z + ")"], ["Photon energy", num(res.photonEnergy_eV) + " eV  (" + res.band + ")"],
          ["Target binding (shell " + res.shellLabel + ")", num(res.targetBinding_eV) + " eV"], ["Outcome", res.outcome],
          ["After state", af.stateLabel || "—"], ["Charge after", (af.chargeAfter != null ? (af.chargeAfter > 0 ? "+" : "") + af.chargeAfter : "0")],
          ["Energy absorbed", num(af.energyAbsorbed_eV || 0) + " eV"]];
        return { rows, note: res.verdict, state: { profile: byZ[z], color: wavelengthColor(wl < 1 ? 5 : wl), band: res.band, ejected: !!res.ejected, excited: /excit/i.test(res.outcome || ""), label: res.outcome } };
      },
      anim(ctx, t, W, H, s) {
        const cx = W * 0.64, cy = H / 2; if (s.profile) drawBohr(ctx, s.profile, cx, cy);
        const ph = (t % 2.6) / 2.6, bx0 = W * 0.04, bxEnd = cx - 40, bx = bx0 + Math.min(1, ph / 0.62) * (bxEnd - bx0);
        eWave(ctx, bx0, cy, bx, 6, s.color, 0.6, t * 9); eText(ctx, "photon", bx0, cy - 14, s.color, 10);
        if (ph > 0.62) {
          const pr = (ph - 0.62) / 0.38;
          if (s.ejected) { eBall(ctx, cx + 30 + pr * 90, cy - 20 - pr * 50, 5, "#22d3ee", "−"); eText(ctx, "e⁻ ejected (ionised)", cx + 10, cy - 70, "#34d399", 10); }
          else if (s.excited) { eText(ctx, "electron excited ↑", cx - 20, cy - 50, "#facc15", 10); }
          else { eWave(ctx, cx + 30, cy - 10, cx + 30 + pr * 90, 5, s.color, 0.6, -t * 9); eText(ctx, "elastic scatter", cx + 20, cy + 64, "rgba(214,225,240,.7)", 10); }
        }
        eText(ctx, s.label, W / 2, H - 8, "rgba(214,225,240,.85)", 11, "center");
      }
    },
    particlebeam: {
      title: "Particle beam — Rutherford scattering",
      latex: "r_{min}=\\frac{Z_1 Z_2 e^2}{4\\pi\\varepsilon_0\\,E}",
      blurb: "Fire a nucleus (projectile) at a target atom and watch it deflect off the nuclear charge.",
      needs: { element: true, element2: true, params: [{ key: "keV", label: "energy (keV)", def: 500, min: 1, max: 100000, step: 1 }, { key: "angle", label: "angle°", def: 30, min: 1, max: 179 }] },
      async run(b) {
        const z = b.z, pz = b.z2, keV = clampNum(b.params.keV, 1, 1e7, 500), ang = clampNum(b.params.angle, 1, 179, 30);
        const r = await fetch(API + "/api/beam?type=material&z=" + z + "&projectile=" + pz + "&energy_keV=" + keV + "&angle=" + ang); if (!r.ok) throw new Error("HTTP " + r.status); const res = await r.json();
        const d = res.details || {};
        const rows = [["Target", res.symbol + "  (Z = " + z + ")"], ["Projectile", (res.projectileSymbol || ("Z" + pz)) + "  (" + num(keV) + " keV)"], ["Outcome", res.outcome]];
        Object.keys(d).forEach(k => rows.push([k.replace(/_/g, " "), num(d[k])]));
        return { rows, note: res.verdict, state: { targetSym: res.symbol, projSym: res.projectileSymbol || ("Z" + pz), label: res.outcome } };
      },
      anim(ctx, t, W, H, s) {
        const cx = W * 0.6, cy = H / 2; eBall(ctx, cx, cy, 16, "#fb7185", "+"); eText(ctx, s.targetSym + " nucleus", cx, cy + 34, "rgba(214,225,240,.7)", 10, "center");
        const ph = (t % 2.6) / 2.6, x = W * 0.04 + ph * (W * 0.92), b0 = H * 0.2;
        const tx = (x - cx) / (W * 0.16), y = cy - b0 - 42 * 0.5 * (1 + Math.tanh(tx));
        ctx.strokeStyle = "rgba(96,165,250,.3)"; ctx.lineWidth = 1.4; ctx.beginPath();
        for (let xx = W * 0.04; xx <= x; xx += 3) { const tt = (xx - cx) / (W * 0.16), yy = cy - b0 - 42 * 0.5 * (1 + Math.tanh(tt)); xx === W * 0.04 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke();
        eBall(ctx, x, y, 7, "#60a5fa", "+"); eText(ctx, s.projSym, x, y - 12, "#60a5fa", 10, "center");
        eText(ctx, s.label, W / 2, H - 8, "rgba(214,225,240,.85)", 11, "center");
      }
    },
    bond: {
      title: "Chemical bond between two atoms",
      latex: "\\Delta\\chi\\;\\text{large}\\Rightarrow\\text{ionic};\\;\\;\\Delta\\chi\\approx0\\Rightarrow\\text{covalent}",
      blurb: "Place two real atoms a chosen distance apart and see what kind of bond forms.",
      needs: { element: true, element2: true, params: [{ key: "dpm", label: "distance (pm)", def: 150, min: 30, max: 600, step: 1 }] },
      async run(b) {
        const z = b.z, z2 = b.z2, dpm = clampNum(b.params.dpm, 30, 600, 150);
        const r = await fetch(API + "/api/interaction?z1=" + z + "&z2=" + z2 + "&distance_pm=" + dpm); if (!r.ok) throw new Error("HTTP " + r.status); const res = await r.json();
        const c = res.classical || {}, q = res.quantum || {};
        const rows = [["Pair", res.symbol1 + " + " + res.symbol2], ["Bond type", res.bondType], ["Separation", num(res.distancePm) + " pm"],
          ["Coulomb repulsion", num(c.nuclearCoulombRepulsion_eV) + " eV"], ["Force", num(c.force_nN) + " nN"]];
        if (q.electronsTransferred != null) rows.push(["Electrons transferred", q.electronsTransferred]);
        if (q.electronsShared != null) rows.push(["Electrons shared", q.electronsShared]);
        if (q.predictedSpecies) rows.push(["Predicted species", q.predictedSpecies]);
        return { rows, note: res.verdict, state: { p1: byZ[z], p2: byZ[z2], bondType: res.bondType } };
      },
      anim(ctx, t, W, H, s) {
        const cy = H / 2, sep = W * 0.16 + 5 * Math.cos(2 * t), lx = W / 2 - sep, rx = W / 2 + sep;
        ctx.strokeStyle = "rgba(56,189,248,.5)"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lx, cy); ctx.lineTo(rx, cy); ctx.stroke(); ctx.setLineDash([]);
        if (s.p1) drawBohr(ctx, s.p1, lx, cy); if (s.p2) drawBohr(ctx, s.p2, rx, cy);
        const bt = (s.bondType || "").toLowerCase();
        if (bt.includes("ionic")) { eText(ctx, "+", lx, cy - 40, "#fb7185", 14, "center"); eText(ctx, "−", rx, cy - 40, "#22d3ee", 14, "center"); }
        else if (bt.includes("covalent")) { const ex = W / 2 + (sep + 14) * Math.cos(t * 2.6), ey = cy + 14 * Math.sin(2 * t * 2.6); eBall(ctx, ex, ey, 5, "#22d3ee", "−"); }
        eText(ctx, s.bondType, W / 2, H - 8, "rgba(214,225,240,.9)", 11, "center");
      }
    },
    larmor: {
      title: "Magnetism & Larmor precession",
      latex: "\\mu=\\sqrt{n(n+2)}\\,\\mu_B,\\;\\; f_L=\\frac{g_e\\mu_B}{h}B",
      blurb: "How magnetic is this atom, and how fast do its unpaired spins precess in a field B?",
      needs: { element: true, params: [{ key: "B", label: "field B (T)", def: 1, min: 0.1, max: 40, step: 0.1 }] },
      async run(b) {
        const z = b.z, B = clampNum(b.params.B, 0.1, 40, 1), p = byZ[z];
        const n = p ? (p.unpairedElectrons || 0) : 0, mu = Math.sqrt(n * (n + 2)), fL = LARMOR_GHZ_PER_T * B;
        const behaviour = n === 0 ? "diamagnetic (no unpaired spins)" : ([26, 27, 28].includes(z) ? "ferromagnetic (Fe/Co/Ni)" : "paramagnetic");
        const rows = [["Element", (p ? p.element.symbol + " — " + p.element.name : "Z" + z)], ["Unpaired electrons", n],
          ["Spin-only moment μ", num(mu) + " μ_B"], ["Magnetic behaviour", behaviour],
          ["Larmor freq @ " + num(B) + " T", num(fL) + " GHz"], ["Precession period", num(1000 / fL) + " ps"]];
        return { rows, note: "Spin-only (orbital contribution neglected); ferromagnetism also needs the solid-state lattice, not a lone atom.", state: { unpaired: n, mu, rate: Math.min(7, 1 + B * 1.2) } };
      },
      anim(ctx, t, W, H, s) {
        const cx = W / 2, cy = H * 0.58, R = Math.min(W, H) * 0.3, a = t * s.rate;
        eArrow(ctx, cx, cy + R + 8, cx, cy - R - 22, "#34d399", 2.5); eText(ctx, "B", cx + 8, cy - R - 18, "#34d399", 12);
        ctx.strokeStyle = "rgba(244,114,182,.3)"; ctx.beginPath(); ctx.ellipse(cx, cy - R * 0.7, R, R * 0.3, 0, 0, 7); ctx.stroke();
        if (s.unpaired === 0) { eText(ctx, "no unpaired spins → no moment", cx, cy + R, "rgba(214,225,240,.7)", 11, "center"); }
        else { const tx = cx + Math.cos(a) * R, ty = cy - R * 0.7 + Math.sin(a) * R * 0.3; eArrow(ctx, cx, cy, tx, ty, "#f472b6", 2.5); eText(ctx, "μ (" + s.unpaired + " e⁻)", tx + 6, ty, "#f472b6", 11); }
        eBall(ctx, cx, cy, 5, "#f472b6");
      }
    },
    slowlight: {
      title: "Slow & stopped light (EIT)",
      node: "slow-light",
      latex: "v_g=\\dfrac{c}{n_g},\\quad \\tau=\\dfrac{L}{v_g}",
      blurb: "Send a light pulse through an EIT atomic medium and watch its group velocity collapse — Lene Hau slowed light to 17 m/s in a sodium BEC, then stopped it.",
      needs: { element: true, params: [{ key: "ng", label: "group index n_g", def: 17600000, min: 1, max: 1e9, step: 1 }, { key: "Lmm", label: "cell length (mm)", def: 0.2, min: 0.001, max: 1000, step: 0.01 }] },
      async run(b) {
        const c = 299792458, ng = clampNum(b.params.ng, 1, 1e9, 1.76e7), Lm = clampNum(b.params.Lmm, 0.001, 1e6, 0.2) / 1000;
        const vg = c / ng, factor = c / vg, delay = Lm / vg, vacDelay = Lm / c, comp = vg / c;
        const sym = byZ[b.z] ? byZ[b.z].element.symbol : "Z" + b.z;
        const rows = [
          ["Medium", (byZ[b.z] ? byZ[b.z].element.name : sym) + " atomic gas (EIT)"],
          ["Group index n_g", num(ng)],
          ["Group velocity v_g", num(vg) + " m/s  (" + (vg < 200 ? num(vg * 3.6) + " km/h" : "") + ")"],
          ["Slowdown vs vacuum", num(factor) + "× slower than c"],
          ["Pulse delay through " + num(Lm * 1000) + " mm", num(delay * 1e6) + " µs   (vacuum: " + num(vacDelay * 1e9) + " ns)"],
          ["Spatial compression", "pulse squeezed " + num(1 / comp) + "× (a 1 km pulse → " + num(1000 * comp * 1e3) + " mm)"]];
        return { rows, note: "EIT slow-light formula with web-verified landmark numbers (Hau 1999: 17 m/s; light stopped 2001). n_g is the knob; the atom sets the resonance.", state: { vg: vg, factor: factor } };
      },
      anim(ctx, t, W, H, s) {
        const m0 = W * 0.34, m1 = W * 0.7, yV = H * 0.3, yS = H * 0.64;
        ctx.fillStyle = "rgba(252,211,77,.10)"; ctx.fillRect(m0, 18, m1 - m0, H - 50);
        ctx.strokeStyle = "rgba(252,211,77,.45)"; ctx.strokeRect(m0, 18, m1 - m0, H - 50);
        eText(ctx, "atomic medium (EIT)", (m0 + m1) / 2, H - 8, "rgba(252,211,77,.75)", 10, "center");
        const xv = (t * 0.85 % 1) * W; eBall(ctx, xv, yV, 5, "#22d3ee"); eText(ctx, "in vacuum: travels at c", 8, yV - 9, "#22d3ee", 10);
        const tA = 0.6, tB = 4.2, tC = 0.6, Tt = tA + tB + tC, tt = t % Tt; let x;
        if (tt < tA) x = (tt / tA) * m0; else if (tt < tA + tB) x = m0 + ((tt - tA) / tB) * (m1 - m0); else x = m1 + ((tt - tA - tB) / tC) * (W - m1);
        eBall(ctx, x, yS, 6, "#fcd34d"); eText(ctx, "light pulse: " + num(s.vg) + " m/s (" + num(s.factor) + "× slower)", 8, yS - 9, "#fcd34d", 10);
      }
    },
    lasercool: {
      title: "Laser cooling — slowing atoms with light",
      node: "laser-cooling",
      latex: "T_D=\\dfrac{\\hbar\\Gamma}{2k_B},\\quad v_r=\\dfrac{\\hbar k}{m}",
      blurb: "Red-detuned lasers slow atoms one photon-recoil at a time. Pick an atom and see its recoil kick, Doppler temperature limit, and stopping distance.",
      needs: { element: true, params: [{ key: "GMHz", label: "linewidth Γ/2π (MHz)", def: 9.8, min: 0.01, max: 100, step: 0.1 }, { key: "wl", label: "transition λ (nm)", def: 589, min: 100, max: 2000, step: 1 }, { key: "v0", label: "initial speed (m/s)", def: 600, min: 1, max: 2000, step: 1 }] },
      async run(b) {
        const HBAR = 1.054571817e-34, KB = 1.380649e-23, AMU = 1.66053907e-27;
        const p = byZ[b.z], mass = (p ? p.element.atomicMass : 23) * AMU;
        const G = clampNum(b.params.GMHz, 0.01, 100, 9.8) * 1e6 * 2 * Math.PI, lam = clampNum(b.params.wl, 100, 2000, 589) * 1e-9, v0 = clampNum(b.params.v0, 1, 2000, 600);
        const k = 2 * Math.PI / lam, vr = HBAR * k / mass, TD = HBAR * G / (2 * KB), aMax = HBAR * k * G / (2 * mass), nStop = v0 / vr, dStop = v0 * v0 / (2 * aMax);
        const sym = p ? p.element.symbol : "Z" + b.z;
        const rows = [
          ["Atom", (p ? p.element.name : sym) + "  (" + num(p ? p.element.atomicMass : 23) + " u)"],
          ["Photon recoil velocity v_r", num(vr * 100) + " cm/s"],
          ["Doppler cooling limit T_D", num(TD * 1e6) + " µK"],
          ["Max deceleration", num(aMax) + " m/s²  (" + num(aMax / 9.81) + " g)"],
          ["Photons to stop from " + num(v0) + " m/s", num(Math.round(nStop))],
          ["Stopping distance", num(dStop * 100) + " cm"]];
        return { rows, note: "Doppler theory T_D=ħΓ/2k_B with the element's real mass; sub-Doppler molasses beats this (Na ~40 µK vs 240 µK).", state: { sym: sym, color: (window.KNOWLEDGE.domains.optics.color) } };
      },
      anim(ctx, t, W, H, s) {
        const cy = H / 2, ph = (t % 3) / 3, ease = 1 - (1 - ph) * (1 - ph), x = W * 0.12 + ease * (W * 0.62);
        // counter-propagating photons from the right
        for (let i = 0; i < 4; i++) { const f = (t * 1.6 + i * 0.25) % 1, px = W * 0.95 - f * (W * 0.95 - x - 18); eWave(ctx, px - 12, cy, px, 4, "#fcd34d", 1.1, t * 10); }
        eBall(ctx, x, cy, 14, "#60a5fa", "atom"); eArrow(ctx, x + 22, cy - 26, x + 22 + (1 - ease) * 34, cy - 26, "#22d3ee", 2); eText(ctx, "v", x + 30, cy - 30, "#22d3ee", 11);
        // speed bar
        ctx.fillStyle = "rgba(96,165,250,.25)"; ctx.fillRect(20, H - 22, (1 - ease) * (W - 40), 8);
        eText(ctx, "laser cooling: photons kick the atom to a halt", 20, 22, "rgba(214,225,240,.8)", 11);
      }
    },
    refraction: {
      title: "Light in a medium (refraction)",
      node: "refractive-index",
      latex: "v=\\dfrac{c}{n},\\quad n_1\\sin\\theta_1=n_2\\sin\\theta_2",
      blurb: "Light slows to c/n entering a medium and bends (Snell's law). Set the refractive index and the angle of incidence.",
      needs: { params: [{ key: "n", label: "refractive index n", def: 1.5, min: 1, max: 4, step: 0.01 }, { key: "ang", label: "incidence angle°", def: 40, min: 0, max: 89, step: 1 }] },
      async run(b) {
        const c = 299792458, n = clampNum(b.params.n, 1, 4, 1.5), t1 = clampNum(b.params.ang, 0, 89, 40);
        const v = c / n, s2 = Math.sin(t1 * Math.PI / 180) / n, t2 = Math.asin(Math.max(-1, Math.min(1, s2))) * 180 / Math.PI;
        const rows = [
          ["Refractive index n", num(n)],
          ["Speed in medium v", num(v) + " m/s  (" + num(n) + "× slower than c)"],
          ["Angle of incidence", num(t1) + "°"],
          ["Refraction angle", num(t2) + "°"],
          ["Bent toward normal by", num(t1 - t2) + "°"]];
        return { rows, note: "Snell's law / phase velocity v=c/n (n>1 here, ray bends toward the normal).", state: { n: n, t1: t1, t2: t2 } };
      },
      anim(ctx, t, W, H, s) {
        const cx = W / 2, by = H * 0.5, L = Math.min(W, H) * 0.42;
        ctx.fillStyle = "rgba(252,211,77,.08)"; ctx.fillRect(0, by, W, H - by);
        ctx.strokeStyle = "rgba(150,170,200,.4)"; ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(W, by); ctx.stroke();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(150,170,200,.35)"; ctx.beginPath(); ctx.moveTo(cx, by - L * 0.7); ctx.lineTo(cx, by + L * 0.7); ctx.stroke(); ctx.setLineDash([]);
        const a1 = s.t1 * Math.PI / 180, a2 = s.t2 * Math.PI / 180;
        const ix = cx - Math.sin(a1) * L, iy = by - Math.cos(a1) * L, rx = cx + Math.sin(a2) * L, ry = by + Math.cos(a2) * L;
        eArrow(ctx, ix, iy, cx, by, "#fcd34d", 2); eArrow(ctx, cx, by, rx, ry, "#fb923c", 2);
        // photon: fast above, slow below
        const ph = (t % 2) / 2; let px, py;
        if (ph < 0.5) { const u = ph / 0.5; px = ix + (cx - ix) * u; py = iy + (by - iy) * u; } else { const u = (ph - 0.5) / 0.5; px = cx + (rx - cx) * u; py = by + (ry - by) * u; }
        eBall(ctx, px, py, 5, "#fef08a");
        eText(ctx, "θ₁ = " + num(s.t1) + "°", cx - 70, by - 16, "#fcd34d", 11); eText(ctx, "θ₂ = " + num(s.t2) + "°", cx + 14, by + 26, "#fb923c", 11);
        eText(ctx, "medium  v = c/n", 10, H - 10, "rgba(252,211,77,.7)", 10);
      }
    },
    photoelectric: {
      title: "Photoelectric effect (Einstein)",
      node: "photoelectric-effect",
      latex: "K_{\\max}=\\dfrac{hc}{\\lambda}-\\phi",
      blurb: "Shine light on a metal; if each photon beats the work function φ, electrons fly out — Einstein's 1905 photon explanation.",
      needs: { element: true, params: [{ key: "wl", label: "light λ (nm)", def: 250, min: 10, max: 1200, step: 1 }] },
      async run(b) {
        const wl = clampNum(b.params.wl, 10, 1200, 250), E = HC_EVNM / wl;
        const phi = WORK_FN[b.z] != null ? WORK_FN[b.z] : 4.5, KE = E - phi, emits = KE > 0, thr = HC_EVNM / phi;
        const vEl = emits ? Math.sqrt(2 * KE * 1.602176634e-19 / 9.1093837e-31) : 0;
        const sym = byZ[b.z] ? byZ[b.z].element.name : "Z" + b.z;
        const rows = [["Metal", sym], ["Work function φ", num(phi) + " eV" + (WORK_FN[b.z] == null ? " (generic — not tabulated)" : "")],
          ["Photon energy", num(E) + " eV  (" + region(wl) + ")"], ["Threshold wavelength", num(thr) + " nm"],
          [emits ? "Max electron energy" : "Result", emits ? num(KE) + " eV ejected" : "no emission (photon too weak)"]];
        if (emits) { rows.push(["Stopping voltage", num(KE) + " V"]); rows.push(["Electron speed", num(vEl / 1000) + " km/s"]); }
        return { rows, note: "K=hf−φ; work functions web-sourced (Cs 2.1 … Pt 6.35 eV).", state: { emits: emits, color: wavelengthColor(wl < 1 ? 5 : wl), ke: Math.max(0, KE) } };
      },
      anim(ctx, t, W, H, s) {
        const px = W * 0.14; ctx.fillStyle = "rgba(148,163,184,.25)"; ctx.fillRect(px - 10, 30, 20, H - 60); eText(ctx, "metal", px, H - 12, "rgba(214,225,240,.7)", 10, "center");
        const lx = (t * 0.7 % 1) * (px - 20); eWave(ctx, 0, H / 2, Math.max(2, lx), 7, s.color, 0.5, t * 9); eBall(ctx, lx, H / 2, 5, s.color);
        if (s.emits) { for (let i = 0; i < 3; i++) { const f = (t * 0.8 + i * 0.33) % 1; eBall(ctx, px + 12 + f * (W - px - 34), H / 2 + (i - 1) * 22 * f, 5, "#22d3ee", "−"); } eText(ctx, "e⁻ ejected (" + num(s.ke) + " eV)", W * 0.55, 26, "#34d399", 11); }
        else eText(ctx, "no emission — photon too weak", W * 0.55, 26, "#fbbf24", 11, "center");
      }
    },
    rydberg: {
      title: "Rydberg atom (giant orbit)",
      node: "rydberg",
      latex: "r_n=n^2 a_0,\\quad E_n=-\\dfrac{13.6}{n^2}\\,\\text{eV}",
      blurb: "Excite the outer electron to a huge n; the atom balloons to ~n² its size — the basis of neutral-atom qubits and the Rydberg blockade.",
      needs: { element: true, params: [{ key: "n", label: "principal n", def: 50, min: 10, max: 200, step: 1 }] },
      async run(b) {
        const n = clampInt(b.params.n, 10, 200, 50), r = n * n * A0_NM, E = -13.6 / (n * n), spacing = 27.2 / (n * n * n), tau = (n * n * n) * 1.0e-3;
        const sym = byZ[b.z] ? byZ[b.z].element.name : "Z" + b.z;
        const rows = [["Atom", sym + ", n=" + n], ["Orbit radius rₙ", num(r) + " nm  (" + num(n * n) + "× the ground state)"],
          ["Binding energy", num(E * 1000) + " meV  (very weakly bound)"], ["Spacing to n−1", num(spacing * 1000) + " meV"],
          ["Lifetime ∝ n³", "≈ " + num(tau) + " µs"], ["Rydberg blockade", "one excitation suppresses its neighbours → entangling gate"]];
        return { rows, note: "Hydrogen-like (quantum defect ignored); huge n → giant, fragile, strongly-interacting atom.", state: { n: n } };
      },
      anim(ctx, t, W, H, s) {
        const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.42, a = t * 0.7;
        eBall(ctx, cx, cy, 8, "#fb7185", "+");
        ctx.strokeStyle = "rgba(120,140,180,.45)"; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.stroke(); eText(ctx, "ground", cx + 18, cy - 12, "rgba(150,170,200,.6)", 9);
        ctx.strokeStyle = "rgba(45,212,191,.5)"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
        eBall(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 6, "#2dd4bf", "−");
        eText(ctx, "n = " + s.n + "  (radius ∝ n²)", cx, H - 10, "rgba(45,212,191,.85)", 11, "center");
      }
    },
    zeeman: {
      title: "Zeeman effect (magnetic line splitting)",
      node: "zeeman-effect",
      latex: "\\Delta E=g\\,\\mu_B\\,m_j\\,B",
      blurb: "A magnetic field splits a spectral line; the spacing reveals the electron's spin magnetic moment.",
      needs: { element: true, params: [{ key: "B", label: "field B (T)", def: 1, min: 0.01, max: 45, step: 0.1 }] },
      async run(b) {
        const B = clampNum(b.params.B, 0.01, 45, 1), g = 2.0023, dE = g * MU_B_EV_T * B;
        const fGHz = dE / 4.135667696e-15 / 1e9, dLam = 500 * 500 * dE / HC_EVNM;
        const sym = byZ[b.z] ? byZ[b.z].element.name : "Z" + b.z;
        const rows = [["Atom", sym], ["Field B", num(B) + " T"], ["g-factor (electron)", num(g)],
          ["Level splitting ΔE", num(dE * 1e6) + " µeV"], ["Transition frequency", num(fGHz) + " GHz"], ["Split of a 500 nm line", "±" + num(dLam * 1000) + " pm"]];
        return { rows, note: "Electron-spin Zeeman shift (Δm=1) — the basis of ESR/EPR and magnetic sensing.", state: { B: B } };
      },
      anim(ctx, t, W, H, s) {
        const cy = H / 2, split = Math.min(H * 0.3, s.B * 6 + 4);
        eText(ctx, "B = " + num(s.B) + " T", 10, 20, "#34d399", 11);
        ctx.strokeStyle = "rgba(214,225,240,.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.22 - 30, cy); ctx.lineTo(W * 0.22 + 30, cy); ctx.stroke(); eText(ctx, "B = 0", W * 0.22, cy + split + 22, "rgba(214,225,240,.6)", 10, "center");
        [-1, 0, 1].forEach(m => { const y = cy + m * split; ctx.strokeStyle = "#f472b6"; ctx.beginPath(); ctx.moveTo(W * 0.62 - 40, y); ctx.lineTo(W * 0.62 + 40, y); ctx.stroke(); eText(ctx, "m=" + (m === 0 ? "0" : (m > 0 ? "+1" : "−1")), W * 0.62 + 48, y + 3, "#f472b6", 9); });
        eText(ctx, "Zeeman triplet", W * 0.62, cy + split + 22, "#f472b6", 10, "center");
      }
    },
    blackbody: {
      title: "Blackbody radiation (Planck / Wien)",
      node: "planck-law",
      latex: "\\lambda_{\\max}=\\dfrac{b}{T},\\quad M=\\sigma T^4",
      blurb: "Every warm body glows. Set a temperature for the peak colour (Wien) and total power (Stefan–Boltzmann).",
      needs: { params: [{ key: "T", label: "temperature (K)", def: 5778, min: 100, max: 30000, step: 10 }] },
      async run(b) {
        const T = clampNum(b.params.T, 100, 30000, 5778), lam = 2.897771955e6 / T, M = 5.670374e-8 * Math.pow(T, 4), peakE = HC_EVNM / lam;
        const eg = T < 1500 ? "(dull red embers)" : T < 4000 ? "(reddish bulb / cool star)" : T < 7000 ? "(sun-like white, 5778 K = Sun)" : "(blue-hot O star)";
        const rows = [["Temperature", num(T) + " K"], ["Peak wavelength (Wien)", num(lam) + " nm  (" + region(lam) + ")"],
          ["Total power M (Stefan)", num(M) + " W/m²"], ["Peak photon energy", num(peakE) + " eV"], ["Looks like", eg]];
        return { rows, note: "Wien b≈2898 µm·K, Stefan σ=5.67×10⁻⁸; Planck's quantization ended the 'ultraviolet catastrophe'.", state: { T: T, lam: lam, color: wavelengthColor(lam) } };
      },
      anim(ctx, t, W, H, s) {
        const x0 = 20, x1 = W - 20, base = H - 22, top = 30, c2 = 1.438776877e7;
        eText(ctx, num(s.T) + " K  →  peak " + num(s.lam) + " nm", 10, 18, s.color, 11);
        let mx = 0; const I = (lam) => Math.pow(lam, -5) / (Math.exp(c2 / (lam * s.T)) - 1);
        for (let i = 0; i <= 160; i++) { const lam = 80 + i * (2400 - 80) / 160; mx = Math.max(mx, I(lam)); }
        ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= 160; i++) { const lam = 80 + i * (2400 - 80) / 160, xx = x0 + i / 160 * (x1 - x0), yy = base - (I(lam) / mx) * (base - top); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
        const xp = x0 + (s.lam - 80) / (2400 - 80) * (x1 - x0); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xp, top); ctx.lineTo(xp, base); ctx.stroke(); ctx.setLineDash([]); eBall(ctx, xp, top + 4, 6, s.color);
      }
    },
    debroglie: {
      title: "de Broglie matter wave",
      node: "de-broglie",
      latex: "\\lambda=\\dfrac{h}{m v}",
      blurb: "Every moving particle is also a wave. Pick an atom and a speed and see its (tiny) wavelength versus its own size.",
      needs: { element: true, params: [{ key: "v", label: "speed (m/s)", def: 1000, min: 0.001, max: 1e7, step: 1 }] },
      async run(b) {
        const h = 6.62607015e-34, AMU = 1.66053907e-27, amu = byZ[b.z] ? byZ[b.z].element.atomicMass : 1, m = amu * AMU, v = clampNum(b.params.v, 1e-3, 1e7, 1000);
        const lam = h / (m * v), lampm = lam * 1e12, ratio = lam / 0.0529177e-9;
        const sym = byZ[b.z] ? byZ[b.z].element.name : "Z" + b.z;
        const rows = [["Particle", sym + "  (" + num(amu) + " u)"], ["Speed", num(v) + " m/s"], ["de Broglie λ", num(lampm) + " pm"],
          ["vs Bohr radius (52.9 pm)", num(ratio) + "× " + (ratio > 1 ? "(wave bigger than the atom!)" : "(smaller than the atom)")],
          ["Wave nature", ratio > 0.3 ? "significant — quantum behaviour" : "negligible — acts classical"]];
        return { rows, note: "λ=h/mv; slow + light → long wavelength → wave behaviour (the seed of BEC & matter-wave optics).", state: {} };
      },
      anim(ctx, t, W, H, s) {
        const cy = H / 2, x = W * 0.1 + ((t * 40) % (W * 0.85));
        ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 1.6; ctx.beginPath();
        for (let xx = x - 60; xx <= x + 60; xx++) { const env = Math.exp(-Math.pow(xx - x, 2) / 800), y = cy - 26 * env * Math.cos((xx - x) * 0.5); xx === x - 60 ? ctx.moveTo(xx, y) : ctx.lineTo(xx, y); } ctx.stroke();
        eBall(ctx, x, cy, 7, "#60a5fa"); eText(ctx, "a moving particle is a wave packet", 10, 20, "rgba(214,225,240,.8)", 11);
      }
    },
    bec: {
      title: "Bose–Einstein condensate",
      node: "bec",
      latex: "T_c=\\dfrac{2\\pi\\hbar^2}{m k_B}\\left(\\dfrac{n}{2.612}\\right)^{2/3}",
      blurb: "Cool bosonic atoms until their matter waves overlap and merge into one quantum state — Rb-87 at 170 nK in 1995.",
      needs: { element: true, params: [{ key: "ncm3", label: "density (atoms/cm³)", def: 1e14, min: 1e10, max: 1e16, step: 1e12 }] },
      async run(b) {
        const HBAR = 1.054571817e-34, KB = 1.380649e-23, AMU = 1.66053907e-27, m = (byZ[b.z] ? byZ[b.z].element.atomicMass : 87) * AMU;
        const n = clampNum(b.params.ncm3, 1e10, 1e16, 1e14) * 1e6, Tc = (2 * Math.PI * HBAR * HBAR / (m * KB)) * Math.pow(n / 2.612, 2 / 3);
        const spacing = Math.pow(n, -1 / 3), lamdb = HBAR * Math.sqrt(2 * Math.PI / (m * KB * Tc));
        const sym = byZ[b.z] ? byZ[b.z].element.name : "Z" + b.z;
        const rows = [["Boson", sym], ["Number density n", num(b.params.ncm3) + " /cm³"], ["Critical temperature T_c", num(Tc * 1e9) + " nK"],
          ["Interatomic spacing", num(spacing * 1e9) + " nm"], ["Thermal de Broglie λ at T_c", num(lamdb * 1e9) + " nm  (≈ spacing → condensation)"]];
        return { rows, note: "Below T_c a macroscopic fraction collapses into the ground state. Rb-87 condensed at 170 nK (1995).", state: {} };
      },
      anim(ctx, t, W, H, s) {
        const cx = W / 2, cy = H / 2, cool = (t % 5) / 5;
        eText(ctx, cool < 0.82 ? "cooling…" : "condensate — one quantum state", 10, 20, cool < 0.82 ? "#a3e635" : "#22d3ee", 11);
        for (let i = 0; i < 26; i++) { const ang = i * 2.39996, spread = (1 - cool) * Math.min(W, H) * 0.4, rr = 10 + spread * (0.4 + 0.6 * ((i * 53) % 100) / 100), jit = (1 - cool) * 8;
          const x = cx + Math.cos(ang + t * (1 - cool) * 2) * rr + Math.sin(t * 3 + i) * jit, y = cy + Math.sin(ang + t * (1 - cool) * 2) * rr + Math.cos(t * 3 + i) * jit;
          eBall(ctx, x, y, 4, cool > 0.82 ? "#22d3ee" : "#a3e635"); }
        if (cool > 0.85) { ctx.strokeStyle = "rgba(34,211,238,.5)"; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 7); ctx.stroke(); }
      }
    }
  };

  function isNotebookActive() { const v = document.getElementById("view-notebook"); return v && v.classList.contains("active"); }

  function experimentInto(b, wrap) {
    const def = EXPERIMENTS[b.exp] || EXPERIMENTS.spectrum;
    if (!EXPERIMENTS[b.exp]) b.exp = "spectrum";
    if (!b.params) b.params = {};
    let animState = null; // transient (may hold full element profiles) — never persisted

    const ctl = document.createElement("div"); ctl.className = "nb-rctl nb-xctl";
    // experiment selector
    const expSel = document.createElement("select");
    expSel.innerHTML = Object.keys(EXPERIMENTS).map(k => '<option value="' + k + '">' + esc(EXPERIMENTS[k].title) + "</option>").join("");
    expSel.value = b.exp; expSel.onchange = () => { b.exp = expSel.value; b.params = {}; b.result = null; render(); scheduleSave(); };
    const expLbl = document.createElement("span"); expLbl.className = "nb-faint"; expLbl.textContent = "experiment:";
    ctl.append(expLbl, expSel);

    // element selectors
    const mkElSel = (cur, on) => { const s = document.createElement("select"); s.className = "nb-elsel"; s.innerHTML = elements.map(p => '<option value="' + p.element.atomicNumber + '">' + p.element.atomicNumber + " " + esc(p.element.symbol) + "</option>").join(""); s.value = String(cur || 1); s.onchange = () => { on(parseInt(s.value, 10)); doRun(); scheduleSave(); }; return s; };
    if (def.needs.element) { if (!b.z) b.z = 1; const s = mkElSel(b.z, v => b.z = v); ctl.append(labelSpan(def.needs.element2 ? "atom A" : "atom"), s); }
    if (def.needs.element2) { if (!b.z2) b.z2 = 17; const s = mkElSel(b.z2, v => b.z2 = v); ctl.append(labelSpan("atom B"), s); }

    // param inputs
    (def.needs.params || []).forEach(pf => {
      ctl.append(labelSpan(pf.label));
      if (pf.select) {
        const s = document.createElement("select"); s.className = "nb-psel";
        s.innerHTML = pf.select.map(o => '<option value="' + o[0] + '">' + esc(o[1]) + "</option>").join("");
        s.value = String(b.params[pf.key] != null ? b.params[pf.key] : pf.select[0][0]);
        b.params[pf.key] = s.value; s.onchange = () => { b.params[pf.key] = s.value; doRun(); scheduleSave(); }; ctl.append(s);
      } else {
        const inp = document.createElement("input"); inp.type = "number"; inp.className = "nb-pnum";
        if (pf.min != null) inp.min = pf.min; if (pf.max != null) inp.max = pf.max; if (pf.step != null) inp.step = pf.step;
        inp.value = String(b.params[pf.key] != null ? b.params[pf.key] : pf.def); b.params[pf.key] = parseFloat(inp.value);
        let deb = null; inp.addEventListener("input", () => { b.params[pf.key] = parseFloat(inp.value); if (deb) clearTimeout(deb); deb = setTimeout(() => { doRun(); scheduleSave(); }, 300); });
        ctl.append(inp);
      }
    });
    const runBtn = document.createElement("button"); runBtn.textContent = "▶ Run"; runBtn.className = "nb-runbtn"; runBtn.onclick = () => doRun();
    ctl.append(runBtn);
    wrap.appendChild(ctl);

    const eq = document.createElement("div"); eq.className = "nb-xeq";
    const KNX = window.KNOWLEDGE;
    const link = (def.node && KNX && KNX.byId && KNX.byId[def.node])
      ? '<span class="nb-xconcept" data-id="' + def.node + '">↳ open “' + esc(KNX.byId[def.node].name) + '” in the Knowledge Network</span>' : '';
    eq.innerHTML = (window.TeX ? window.TeX.renderToString(def.latex, true) : def.latex) + '<div class="nb-faint nb-xblurb">' + esc(def.blurb) + "</div>" + link;
    const lk = eq.querySelector(".nb-xconcept");
    if (lk) lk.onclick = () => { if (window.switchView) window.switchView("net"); if (window.Network) window.Network.focusNode(lk.dataset.id); };
    wrap.appendChild(eq);

    const canvas = document.createElement("canvas"); canvas.className = "nb-xcanvas"; wrap.appendChild(canvas);
    const out = document.createElement("div"); out.className = "nb-rout nb-xout"; wrap.appendChild(out);

    let ctx = null, W = 600, H = 210;
    function size() { const dpr = Math.min(window.devicePixelRatio || 1, 2); W = canvas.clientWidth || 600; H = canvas.clientHeight || 210; canvas.width = W * dpr; canvas.height = H * dpr; ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function resultHTML(title, rows, note) {
      let h = '<div class="nb-bond">' + esc(title) + "</div>";
      rows.forEach(r => h += '<div class="pt-row"><span class="pt-k">' + esc(r[0]) + '</span><span class="pt-v">' + esc(String(r[1])) + "</span></div>");
      if (note) h += '<div class="nb-faint" style="margin-top:6px">' + esc(note) + "</div>";
      return h;
    }
    let running = false;
    async function doRun() {
      if (running) return; running = true; out.innerHTML = '<span class="nb-faint">running experiment…</span>';
      try {
        const res = await def.run(b);
        animState = res.state;
        b.result = { title: def.title, rows: res.rows, note: res.note }; // compact (no profiles)
        out.innerHTML = resultHTML(def.title, res.rows, res.note);
        scheduleSave();
      } catch (e) {
        out.innerHTML = '<span class="nb-faint">Could not run this experiment. (' + esc(String(e.message || e)) + ")</span>";
      } finally { running = false; }
    }
    function frame() {
      if (!canvas.isConnected) return;
      if (isNotebookActive() && animState && ctx) { const t = performance.now() / 1000; ctx.clearRect(0, 0, W, H); try { def.anim(ctx, t, W, H, animState); } catch (e) { } }
      requestAnimationFrame(frame);
    }
    // restore cached result instantly, then refresh from the server
    if (b.result && b.result.rows) out.innerHTML = resultHTML(b.result.title, b.result.rows, b.result.note);
    requestAnimationFrame(() => { size(); requestAnimationFrame(frame); doRun(); });
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => size()); ro.observe(canvas); }
  }
  function labelSpan(txt) { const s = document.createElement("span"); s.className = "nb-faint"; s.textContent = txt; return s; }

  /* ====================================================================== *
   *  COUPLING block: combine one equation WITH another. A rule engine says
   *  whether they're complementary (and WHY not, if not), shows how they
   *  connect through the knowledge graph, and animates the resulting effect
   *  (oscillations, sidebands, precession…) — no derivation needed.
   * ====================================================================== */
  const COUPLING_RULES = {
    "acoustics|quantum": { ok: true, effect: "modulate", mech: "A vibration modulates the potential: V(x,t)=V₀(x)+δV·cos ωt. The stationary Schrödinger levels pick up time-dependent sidebands Eₙ ± mℏω and the wavefunction breathes at the drive frequency ω.", combined: "i\\hbar\\,\\partial_t\\Psi=\\big[\\hat H_0+\\delta V\\cos(\\omega t)\\big]\\Psi" },
    "acoustics|spin": { ok: true, effect: "sideband", mech: "Spin–phonon coupling: vibrational quanta drive spin flips on red/blue motional sidebands." },
    "acoustics|quantum-info": { ok: true, effect: "sideband", mech: "Motional modes act as a phonon bus, mediating entangling gates between qubits (trapped-ion gates)." },
    "acoustics|bonding": { ok: true, effect: "well", mech: "The bond's potential well sets the spring constant k, hence the vibration ω=√(k/μ)." },
    "acoustics|molecular": { ok: true, effect: "well", mech: "Molecular bonds vibrate; the exchange / bond stiffness sets the phonon spectrum." },
    "bonding|quantum": { ok: true, effect: "well", mech: "The bonding potential enters the Schrödinger equation; its curvature fixes the vibrational energy levels." },
    "molecular|quantum": { ok: true, effect: "well", mech: "The molecular Hamiltonian yields the electronic + vibrational level ladder." },
    "optics|quantum": { ok: true, effect: "rabi", mech: "Light–matter coupling: the photon field drives Rabi oscillations between two levels.", combined: "\\hat H=\\hat H_0+\\tfrac{\\hbar\\Omega}{2}\\cos(\\omega t)\\,\\hat\\sigma_x" },
    "optics|spin": { ok: true, effect: "rabi", mech: "Optical pumping / magnetic resonance cycles the spin populations." },
    "hardware|optics": { ok: true, effect: "rabi", mech: "Lasers drive and read out the qubit (optical control)." },
    "quantum|spin": { ok: true, effect: "precess", mech: "Adding a spin term to the Hamiltonian gives Zeeman splitting and Larmor precession." },
    "quantum-info|spin": { ok: true, effect: "precess", mech: "A spin-½ IS a qubit; field terms rotate its Bloch vector." },
    "entanglement|quantum-info": { ok: true, effect: "entangle", mech: "Two-qubit gates turn product states into entangled states." },
    "entanglement|quantum": { ok: true, effect: "entangle", mech: "A joint interaction / measurement correlates the two systems into an entangled state." },
    "classical|quantum": { ok: true, effect: "correspond", mech: "Correspondence principle: the classical equation is the ħ→0 (large-n) limit of the quantum one." },
    "quantum|thermal": { ok: true, effect: "populate", mech: "Temperature populates the quantum levels via Boltzmann / Bose–Einstein statistics." },
    "spin|thermal": { ok: true, effect: "populate", mech: "Thermal energy randomizes spin orientations (paramagnetism vs ordering)." },
    "forces|quantum": { ok: true, effect: "combine", mech: "A fundamental force enters as a potential term in the Hamiltonian." },
    "classical|forces": { ok: true, effect: "combine", mech: "The force sets the classical equation of motion (F = ma)." },
    // explicitly NOT complementary — with the reason
    "acoustics|relativistic": { ok: false, reason: "A bond vibration is a low-energy (meV), non-relativistic motion; relativity governs near-light-speed / strong-gravity regimes. The energy scales differ by many orders of magnitude — not complementary." },
    "classical|entanglement": { ok: false, reason: "Entanglement is intrinsically quantum — there is no classical-mechanics quantity to combine it with." },
    "entanglement|relativistic": { ok: false, reason: "Combining nonlocal entanglement with relativity needs full relativistic quantum field theory — not a direct equation-level combination here." },
    "acoustics|algorithms": { ok: false, reason: "A computational protocol and a mechanical vibration sit at different layers of description — no direct physical coupling." },
    "algorithms|classical": { ok: false, reason: "A quantum algorithm isn't expressed through classical mechanics — different layers." },
    "algorithms|bonding": { ok: false, reason: "Chemical bonding and an abstract algorithm don't couple directly." },
    "algorithms|thermal": { ok: false, reason: "An algorithm and a thermal distribution operate at different layers." },
    "relativistic|thermal": { ok: false, reason: "Mixing relativity with thermal statistics needs relativistic thermodynamics — beyond a direct pairing here." }
  };
  function domLabel(KN, d) { return (KN.domains[d] && KN.domains[d].label) || d; }
  function pathLocal(KN, fromId, toId) {
    const adj = {};
    KN.nodes.forEach(n => { adj[n.id] = adj[n.id] || new Set(); (n.related || []).forEach(t => { if (KN.byId[t]) { adj[n.id].add(t); adj[t] = adj[t] || new Set(); adj[t].add(n.id); } }); });
    if (!KN.byId[fromId] || !KN.byId[toId]) return null; if (fromId === toId) return [fromId];
    const prev = {}, seen = new Set([fromId]), q = [fromId];
    while (q.length) { const cur = q.shift(); for (const nb of (adj[cur] || [])) { if (!seen.has(nb)) { seen.add(nb); prev[nb] = cur; if (nb === toId) { const p = []; for (let at = toId; at != null; at = (prev[at] != null ? prev[at] : null)) { p.unshift(at); if (at === fromId) break; } return p; } q.push(nb); } } }
    return null;
  }
  function coupleVerdict(KN, aId, bId) {
    const A = KN.byId[aId], B = KN.byId[bId];
    if (!A || !B) return { ok: false, reason: "Pick two equations from the lists.", effect: "incompatible" };
    if (aId === bId) return { ok: false, reason: "Pick two different equations.", effect: "incompatible" };
    const path = pathLocal(KN, aId, bId), key = [A.domain, B.domain].sort().join("|");
    let rule = COUPLING_RULES[key];
    if (!rule && A.domain === B.domain) rule = { ok: true, effect: "combine", mech: "Same framework (" + domLabel(KN, A.domain) + ") — these combine directly within one set of equations." };
    if (rule) { const v = { ok: rule.ok, effect: rule.effect || (rule.ok ? "combine" : "incompatible"), path }; if (rule.ok) { v.mechanism = rule.mech; v.combined = rule.combined; } else v.reason = rule.reason; return v; }
    if (path && path.length - 1 <= 3) return { ok: true, soft: true, effect: "chain", mechanism: "No standard textbook coupling, but they're linked in the knowledge graph (chain below) — you can combine them indirectly through the shared concepts.", path };
    return { ok: false, effect: "incompatible", reason: "These don't combine directly: " + domLabel(KN, A.domain) + " and " + domLabel(KN, B.domain) + " act at different layers / energy scales and share no short path in the knowledge graph — not complementary.", path };
  }
  function compatibleDomains(aDom) {
    const set = new Set([aDom]);
    for (const key in COUPLING_RULES) { const r = COUPLING_RULES[key]; if (!r.ok) continue; const p = key.split("|"); if (p[0] === aDom) set.add(p[1]); else if (p[1] === aDom) set.add(p[0]); }
    return set;
  }
  function compatiblePartners(KN, aId, limit) {
    const A = KN.byId[aId]; if (!A) return [];
    const doms = compatibleDomains(A.domain), rel = new Set(A.related || []), out = [];
    KN.nodes.forEach(n => {
      if (n.id === aId) return;
      const okDom = doms.has(n.domain), neigh = rel.has(n.id);
      if (!okDom && !neigh) return;
      const ruled = !!COUPLING_RULES[[A.domain, n.domain].sort().join("|")];
      out.push({ id: n.id, name: n.name, domain: n.domain, score: (neigh ? 3 : 0) + (ruled && n.domain !== A.domain ? 2 : 0) });
    });
    out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return out.slice(0, limit || 12);
  }
  function firstPartner(KN, aId) { const p = compatiblePartners(KN, aId, 1); return p.length ? p[0].id : null; }

  function ensureConceptDatalist(KN) {
    if (document.getElementById("nbConceptList")) return;
    const dl = document.createElement("datalist"); dl.id = "nbConceptList";
    dl.innerHTML = KN.nodes.slice().sort((a, b) => a.name.localeCompare(b.name)).map(n => '<option value="' + esc(n.name) + '">').join("");
    document.body.appendChild(dl);
  }
  function resolveConcept(KN, val) {
    if (!val) return null; const v = val.trim().toLowerCase();
    if (KN.byId[v]) return v;
    for (const n of KN.nodes) if (n.name.toLowerCase() === v) return n.id;
    for (const n of KN.nodes) if (n.name.toLowerCase().includes(v)) return n.id;
    return null;
  }
  function couplingHTML(KN, aId, bId, v) {
    const A = KN.byId[aId], B = KN.byId[bId];
    const dom = (n) => n ? '<span style="color:' + ((KN.domains[n.domain] || {}).color) + '">' + esc(domLabel(KN, n.domain)) + '</span>' : '';
    let h = '<div class="nb-bond">' + esc(A ? A.name : aId) + '  ⊕  ' + esc(B ? B.name : bId) + '</div>';
    h += '<div class="nb-cdoms">' + dom(A) + ' &nbsp;×&nbsp; ' + dom(B) + '</div>';
    if (v.ok) {
      h += '<div class="nb-cverdict ok">✓ ' + (v.soft ? "indirectly combinable" : "combinable") + '</div>';
      h += '<div class="nb-cmech">' + esc(v.mechanism || "") + '</div>';
      if (v.combined) h += '<div class="nb-ceq">' + (window.TeX ? window.TeX.renderToString(v.combined, true) : esc(v.combined)) + '</div>';
    } else {
      h += '<div class="nb-cverdict no">✗ not directly combinable</div>';
      h += '<div class="nb-cmech">' + esc(v.reason || "") + '</div>';
    }
    if (v.path && v.path.length > 1) {
      h += '<div class="nb-cpath"><b>connects via →</b> ' + v.path.map((id, i) => { const n = KN.byId[id], c = (KN.domains[n.domain] || {}).color; return (i ? '<span class="nb-carrow">→</span>' : '') + '<span class="nb-cstep" data-id="' + id + '" style="border-color:' + c + ';color:' + c + '">' + esc(n.name) + '</span>'; }).join('') + '</div>';
    }
    return h;
  }
  function couplingInto(b, wrap) {
    const KN = window.KNOWLEDGE; ensureConceptDatalist(KN);
    if (!KN.byId[b.a]) b.a = "bond-vibration";
    if (!KN.byId[b.b]) b.b = "schrodinger-tdse";
    const ctl = document.createElement("div"); ctl.className = "nb-rctl nb-xctl";
    const mkInput = (id, ph) => { const i = document.createElement("input"); i.className = "nb-cinput"; i.setAttribute("list", "nbConceptList"); i.value = KN.byId[id] ? KN.byId[id].name : ""; i.placeholder = ph; return i; };
    const ia = mkInput(b.a, "equation A…"), ib = mkInput(b.b, "equation B…");
    const btn = document.createElement("button"); btn.className = "nb-runbtn"; btn.textContent = "⚗ Combine";
    ctl.append(labelSpan("use"), ia, labelSpan("on / with"), ib, btn);
    wrap.appendChild(ctl);
    const sugg = document.createElement("div"); sugg.className = "nb-csugg"; wrap.appendChild(sugg);
    const out = document.createElement("div"); out.className = "nb-rout nb-xout";
    const canvas = document.createElement("canvas"); canvas.className = "nb-xcanvas";
    wrap.appendChild(out); wrap.appendChild(canvas);
    function renderSuggestions(aId) {
      const ps = compatiblePartners(KN, aId, 10);
      sugg.innerHTML = '<span class="nb-faint">pairs well with →</span> ' + ps.map(p =>
        '<span class="nb-csug" data-id="' + p.id + '" style="border-color:' + ((KN.domains[p.domain] || {}).color) + '">' + esc(p.name) + '</span>').join(' ');
      sugg.querySelectorAll(".nb-csug").forEach(el => el.onclick = () => { ib.value = KN.byId[el.dataset.id].name; b.b = el.dataset.id; combine(); });
    }
    let ctx = null, W = 600, H = 210, eff = null, vstate = null;
    function size() { const dpr = Math.min(window.devicePixelRatio || 1, 2); W = canvas.clientWidth || 600; H = canvas.clientHeight || 210; canvas.width = W * dpr; canvas.height = H * dpr; ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function combine() {
      const aId = resolveConcept(KN, ia.value) || b.a, bId = resolveConcept(KN, ib.value) || b.b;
      b.a = aId; b.b = bId;
      const v = coupleVerdict(KN, aId, bId);
      eff = v.effect; vstate = { A: KN.byId[aId], B: KN.byId[bId], path: v.path };
      out.innerHTML = couplingHTML(KN, aId, bId, v);
      b.summary = (v.ok ? "✓ " : "✗ ") + (v.mechanism || v.reason || "");
      scheduleSave();
      out.querySelectorAll(".nb-cstep").forEach(el => el.onclick = () => { if (window.switchView) window.switchView("net"); if (window.Network) window.Network.focusNode(el.dataset.id); });
      renderSuggestions(aId);   // refresh "pairs well with" for the chosen A
    }
    ia.addEventListener("change", combine); ib.addEventListener("change", combine); btn.onclick = combine;
    function frame() { if (!canvas.isConnected) return; if (isNotebookActive() && ctx && eff) { const t = performance.now() / 1000; ctx.clearRect(0, 0, W, H); try { drawCouple(ctx, t, W, H, eff, vstate); } catch (e) { } } requestAnimationFrame(frame); }
    requestAnimationFrame(() => { size(); combine(); requestAnimationFrame(frame); });
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => size()); ro.observe(canvas); }
  }
  function drawCouple(ctx, t, W, H, eff, st) {
    eText(ctx, (st.A ? st.A.name : "A") + "   ⊕   " + (st.B ? st.B.name : "B"), W / 2, 16, "rgba(214,225,240,.85)", 11, "center");
    const cy = H * 0.56;
    if (eff === "modulate") {
      const left = 46, right = W - 26, w = 2.2, amp = 9, levels = 4;
      for (let n = 1; n <= levels; n++) { const baseY = H * 0.86 - (H * 0.58) * (1 - 1 / (n * n)) / (1 - 1 / 16), y = baseY + amp * Math.sin(w * t + n * 1.3); ctx.strokeStyle = "rgba(34,211,238,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right - 72, y); ctx.stroke(); eText(ctx, "n=" + n, right - 66, y + 4, "rgba(214,225,240,.6)", 9); }
      const mid = (left + right - 72) / 2, sig = 26 + 12 * Math.sin(w * t); ctx.strokeStyle = "#fcd34d"; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let x = left; x < right - 72; x += 3) { const e = Math.exp(-Math.pow(x - mid, 2) / (2 * sig * sig)), yy = H * 0.92 - e * 26; x === left ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke();
      eText(ctx, "vibration ω modulates V(x,t) → energy levels oscillate (sidebands Eₙ±mℏω)", W / 2, H - 7, "rgba(234,179,8,.9)", 10, "center");
    } else if (eff === "sideband") {
      const cx = W / 2, d = 18 + 18 * Math.abs(Math.sin(t * 1.5)), al = 0.5 + 0.5 * Math.sin(t * 3);
      [[0, "#22d3ee", 1], [-1, "#fcd34d", al], [1, "#fcd34d", al]].forEach(a => { ctx.globalAlpha = a[2]; ctx.strokeStyle = a[1]; ctx.lineWidth = 2; const y = cy + a[0] * d; ctx.beginPath(); ctx.moveTo(cx - 80, y); ctx.lineTo(cx + 80, y); ctx.stroke(); }); ctx.globalAlpha = 1;
      eText(ctx, "carrier ± ℏω motional sidebands", W / 2, H - 7, "rgba(214,225,240,.8)", 10, "center");
    } else if (eff === "rabi") {
      const p1 = Math.sin(t * 1.6) ** 2, bw = W * 0.16, gap = W * 0.1, base = H * 0.8, mh = H * 0.5, x0 = W / 2 - gap / 2 - bw, x1 = W / 2 + gap / 2;
      ctx.fillStyle = "rgba(167,139,250,.7)"; ctx.fillRect(x0, base - mh * (1 - p1), bw, mh * (1 - p1)); ctx.fillStyle = "rgba(244,114,182,.8)"; ctx.fillRect(x1, base - mh * p1, bw, mh * p1);
      eText(ctx, "|0⟩", x0 + bw / 2, base + 14, "#ddd", 10, "center"); eText(ctx, "|1⟩", x1 + bw / 2, base + 14, "#ddd", 10, "center"); eText(ctx, "driven Rabi oscillation", W / 2, H - 7, "rgba(214,225,240,.8)", 10, "center");
    } else if (eff === "precess") {
      const cx = W / 2, R = Math.min(W, H) * 0.26, a = t * 3; eArrow(ctx, cx, cy + R + 8, cx, cy - R - 16, "#34d399", 2); ctx.strokeStyle = "rgba(244,114,182,.3)"; ctx.beginPath(); ctx.ellipse(cx, cy - R * 0.7, R, R * 0.3, 0, 0, 7); ctx.stroke();
      const tx = cx + Math.cos(a) * R, ty = cy - R * 0.7 + Math.sin(a) * R * 0.3; eArrow(ctx, cx, cy, tx, ty, "#f472b6", 2.5); eText(ctx, "spin precesses in the field (Larmor)", W / 2, H - 7, "rgba(214,225,240,.8)", 10, "center");
    } else if (eff === "entangle") {
      const cyc = 2.4, ph = (t % cyc) / cyc, idx = Math.floor(t / cyc), bit = ((idx * 2654435761) >>> 0) % 2, meas = ph > 0.5, ax = W * 0.34, bx = W * 0.66;
      ctx.strokeStyle = "rgba(232,121,249,.5)"; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(ax + 24, cy); ctx.lineTo(bx - 24, cy); ctx.stroke(); ctx.setLineDash([]);
      [ax, bx].forEach(x => { ctx.strokeStyle = "#e879f9"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, cy, 22, 0, 7); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = "bold 18px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(meas ? String(bit) : "?", x, cy + 1); }); ctx.textBaseline = "alphabetic";
      eText(ctx, meas ? "outcomes always correlated" : "entangled — undetermined", W / 2, H - 7, "#e879f9", 10, "center");
    } else if (eff === "well") {
      const cx = W / 2; ctx.strokeStyle = "#fb923c"; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 40; x < W - 30; x++) { const xx = (x - cx) / 90, yy = Math.min(H - 28, cy - 46 + 52 * xx * xx); x === 40 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke();
      const bx = cx + (W * 0.16) * Math.sin(t * 2), by = cy - 46 + 52 * Math.pow((bx - cx) / 90, 2); eBall(ctx, bx, Math.min(H - 28, by), 7, "#facc15");
      eText(ctx, "the potential well sets the vibrational levels", W / 2, H - 7, "rgba(251,146,60,.9)", 10, "center");
    } else if (eff === "populate") {
      const left = 60, right = W - 30, levels = 4; for (let n = 1; n <= levels; n++) { const y = H * 0.84 - (n - 1) * (H * 0.18); ctx.strokeStyle = "rgba(120,140,180,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); const occ = Math.max(0, Math.round(3 * Math.exp(-(n - 1)) * (0.6 + 0.4 * Math.sin(t)))); for (let k = 0; k < occ; k++) eBall(ctx, left + 22 + k * 16, y - 6, 4, "#a3e635"); }
      eText(ctx, "temperature populates the levels (Boltzmann)", W / 2, H - 7, "rgba(163,230,53,.9)", 10, "center");
    } else if (eff === "correspond") {
      const cx = W / 2, R = Math.min(W, H) * 0.3, a = t * 1.5; for (let i = 0; i < 44; i++) { const ang = i / 44 * 7; ctx.fillStyle = "rgba(34,211,238,.22)"; ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, 2, 0, 7); ctx.fill(); }
      ctx.strokeStyle = "rgba(245,166,35,.45)"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); eBall(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 6, "#f5a623");
      eText(ctx, "classical orbit ≈ large-n quantum (correspondence)", W / 2, H - 7, "rgba(214,225,240,.8)", 10, "center");
    } else if (eff === "combine") {
      const yb = cy; const wave = (amp, k, ph, col, yo) => { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = 20; x < W - 20; x++) { const y = yb + yo + amp * Math.sin(k * (x - 20) * 0.05 - ph); x === 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); };
      wave(11, 1, t * 2, "rgba(34,211,238,.6)", -34); wave(11, 1.7, t * 2.4, "rgba(244,114,182,.6)", -12);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 20; x < W - 20; x++) { const y = yb + 30 + 11 * Math.sin(1 * (x - 20) * 0.05 - t * 2) + 11 * Math.sin(1.7 * (x - 20) * 0.05 - t * 2.4); x === 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      eText(ctx, "superpose → combined wave (same framework)", W / 2, H - 7, "rgba(214,225,240,.8)", 10, "center");
    } else if (eff === "chain") {
      const ids = st.path || [], n = ids.length, KN = window.KNOWLEDGE; if (n) { for (let i = 0; i < n; i++) { const x = 40 + (W - 80) * (n === 1 ? 0.5 : i / (n - 1)), c = (KN.domains[KN.byId[ids[i]].domain] || {}).color || "#7dd3fc"; if (i) { const x0 = 40 + (W - 80) * ((i - 1) / (n - 1)); ctx.strokeStyle = "rgba(150,170,200,.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x, cy); ctx.stroke(); const tt = (t * 1.5 + i) % 1; eBall(ctx, x0 + (x - x0) * tt, cy, 3, "#bfe9ff"); } eBall(ctx, x, cy, 7, c); } }
      eText(ctx, "linked through the knowledge graph", W / 2, H - 7, "rgba(214,225,240,.8)", 10, "center");
    } else {
      ctx.strokeStyle = "rgba(34,211,238,.6)"; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 20; x < W - 20; x++) { const y = cy - 22 + 18 * Math.sin((x - 20) * 0.04 - t * 1.5); x === 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      ctx.strokeStyle = "rgba(244,114,182,.6)"; ctx.beginPath(); for (let x = 20; x < W - 20; x++) { const y = cy + 24 + 5 * Math.sin((x - 20) * 0.6 - t * 8); x === 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      eText(ctx, "⚠ different scales / domains — they don't mesh", W / 2, H - 7, "#fbbf24", 11, "center");
    }
  }

  /* ---------- comparison block: value sets + computed changes + conclusion ---------- */
  function comparisonInto(b, wrap) {
    const title = document.createElement("input"); title.className = "nb-cap"; title.value = b.title || ""; title.placeholder = "comparison title";
    title.addEventListener("input", () => { b.title = title.value; scheduleSave(); });
    wrap.appendChild(title);

    const table = document.createElement("table"); table.className = "nb-table nb-cmp";
    const deltaCells = [], pctCells = [];
    function numVal(s) { const v = parseFloat(s); return isFinite(v) ? v : NaN; }
    function recompute() {
      let up = 0, down = 0, n = 0;
      for (let r = 0; r < b.rowLabels.length; r++) {
        const first = numVal(b.sets[0].values[r]), last = numVal(b.sets[b.sets.length - 1].values[r]);
        let dTxt = "—", pTxt = "—";
        if (!isNaN(first) && !isNaN(last)) {
          const d = last - first; dTxt = (d >= 0 ? "+" : "") + num(d);
          pTxt = first !== 0 ? (d / first >= 0 ? "+" : "") + num(d / first * 100) + "%" : "—";
          n++; if (d > 0) up++; else if (d < 0) down++;
        }
        if (deltaCells[r]) deltaCells[r].textContent = dTxt;
        if (pctCells[r]) pctCells[r].textContent = pTxt;
      }
      const sum = document.getElementById("cmpsum_" + b.id);
      if (sum) sum.textContent = n ? (up + " ↑, " + down + " ↓ across " + n + " numeric quantit" + (n === 1 ? "y" : "ies") + " from " + b.sets[0].name + " → " + b.sets[b.sets.length - 1].name) : "enter numeric values to auto-compute changes";
    }
    function build() {
      table.innerHTML = "";
      deltaCells.length = 0; pctCells.length = 0;
      const head = document.createElement("tr");
      head.appendChild(thInput("", null));
      b.sets.forEach((s, si) => head.appendChild(thInput(s.name, v => { s.name = v; scheduleSave(); recompute(); })));
      const dh = document.createElement("th"); dh.textContent = "Δ (last−first)"; head.appendChild(dh);
      const ph = document.createElement("th"); ph.textContent = "%"; head.appendChild(ph);
      table.appendChild(head);
      b.rowLabels.forEach((lbl, r) => {
        const tr = document.createElement("tr");
        tr.appendChild(tdInput(lbl, v => { b.rowLabels[r] = v; scheduleSave(); }));
        b.sets.forEach(s => tr.appendChild(tdInput(s.values[r] || "", v => { s.values[r] = v; scheduleSave(); recompute(); })));
        const dtd = document.createElement("td"); dtd.className = "nb-delta"; deltaCells[r] = dtd; tr.appendChild(dtd);
        const ptd = document.createElement("td"); ptd.className = "nb-delta"; pctCells[r] = ptd; tr.appendChild(ptd);
        table.appendChild(tr);
      });
      recompute();
    }
    function thInput(val, on) { const th = document.createElement("th"); if (on) { const i = document.createElement("input"); i.value = val; i.addEventListener("input", () => on(i.value)); th.appendChild(i); } else th.textContent = val; return th; }
    function tdInput(val, on) { const td = document.createElement("td"); const i = document.createElement("input"); i.value = val; i.addEventListener("input", () => on(i.value)); td.appendChild(i); return td; }
    build();
    wrap.appendChild(table);

    const bar = document.createElement("div"); bar.className = "nb-tbar";
    bar.innerHTML = '<button data-c="row">+ quantity</button><button data-c="set">+ value set</button><button data-c="delrow">− quantity</button><button data-c="delset">− set</button>';
    bar.querySelector('[data-c=row]').onclick = () => { b.rowLabels.push("quantity " + (b.rowLabels.length + 1)); b.sets.forEach(s => s.values.push("")); build(); scheduleSave(); };
    bar.querySelector('[data-c=set]').onclick = () => { b.sets.push({ name: "Set " + String.fromCharCode(65 + b.sets.length), values: b.rowLabels.map(() => "") }); build(); scheduleSave(); };
    bar.querySelector('[data-c=delrow]').onclick = () => { if (b.rowLabels.length > 1) { b.rowLabels.pop(); b.sets.forEach(s => s.values.pop()); build(); scheduleSave(); } };
    bar.querySelector('[data-c=delset]').onclick = () => { if (b.sets.length > 1) { b.sets.pop(); build(); scheduleSave(); } };
    wrap.appendChild(bar);

    const sum = document.createElement("div"); sum.className = "nb-cmpsum"; sum.id = "cmpsum_" + b.id; wrap.appendChild(sum);
    const concl = document.createElement("textarea"); concl.className = "nb-text"; concl.placeholder = "conclusion — what do the changes tell you?";
    concl.value = b.conclusion || ""; concl.addEventListener("input", () => { b.conclusion = concl.value; scheduleSave(); });
    wrap.appendChild(concl);
    recompute();
  }

  /* ---------- export ---------- */
  function exportMarkdown() {
    let md = "# " + (nb.title || "Notebook") + "\n\n";
    nb.blocks.forEach(b => {
      if (b.type === "note") md += (b.text || "") + "\n\n";
      else if (b.type === "idea") md += "> 💡 " + (b.text || "") + "\n\n";
      else if (b.type === "equation") md += (b.caption ? "**" + b.caption + "**\n\n" : "") + "$$" + (b.latex || "") + "$$\n\n";
      else if (b.type === "table") {
        md += (b.title ? "**" + b.title + "**\n\n" : "");
        md += "| " + b.headers.join(" | ") + " |\n| " + b.headers.map(() => "---").join(" | ") + " |\n";
        b.rows.forEach(r => md += "| " + r.join(" | ") + " |\n");
        md += "\n";
      }
      else if (b.type === "experiment" && b.result) {
        md += "**🧪 Experiment: " + (b.result.title || b.exp) + "**\n\n";
        (b.result.rows || []).forEach(r => md += "- " + r[0] + ": " + r[1] + "\n");
        if (b.result.note) md += "\n_" + b.result.note + "_\n";
        md += "\n";
      }
      else if (b.type === "coupling") {
        const KN = window.KNOWLEDGE, A = KN && KN.byId[b.a], B = KN && KN.byId[b.b];
        md += "**🔗 Combine: " + (A ? A.name : b.a) + " ⊕ " + (B ? B.name : b.b) + "**\n\n" + (b.summary || "") + "\n\n";
      }
    });
    if (navigator.clipboard) navigator.clipboard.writeText(md).then(() => toast("Notebook copied as Markdown"), () => fallbackCopy(md));
    else fallbackCopy(md);
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Notebook copied as Markdown"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  function sup(n) { const neg = n < 0; return (neg ? "⁻" : "") + String(Math.abs(n)).split("").map(d => SUP[+d]).join(""); }
  function num(v) {
    if (typeof v !== "number") { const f = parseFloat(v); if (!isFinite(f)) return String(v == null ? "" : v); v = f; }
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a >= 1e-3 && a < 1e5) return String(Number(v.toPrecision(5)));
    let exp = Math.floor(Math.log10(a)), m = v / Math.pow(10, exp);
    m = Math.round(m * 1000) / 1000; if (Math.abs(m) >= 10) { m /= 10; exp++; }
    return String(m) + "×10" + sup(exp);
  }

  function toast(msg) {
    let t = document.getElementById("nbToast");
    if (!t) { t = document.createElement("div"); t.id = "nbToast"; t.className = "nb-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 1600);
  }

  /* ---------- boot ---------- */
  function init() {
    elements = window.PERIODIC_DATA || [];
    byZ = {}; elements.forEach(p => byZ[p.element.atomicNumber] = p);
    const addBtns = { nbAddNote: "note", nbAddEq: "equation", nbAddTable: "table", nbAddIdea: "idea", nbAddReaction: "reaction", nbAddExperiment: "experiment", nbAddCombine: "coupling", nbAddCompare: "comparison" };
    Object.keys(addBtns).forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener("click", () => addBlock(addBtns[id])); });
    const titleEl = document.getElementById("nbTitle");
    if (titleEl) titleEl.addEventListener("input", () => { nb.title = titleEl.value; scheduleSave(); });
    const exp = document.getElementById("nbExport"); if (exp) exp.addEventListener("click", exportMarkdown);
    const save = document.getElementById("nbSave"); if (save) save.addEventListener("click", saveNow);
    attachBoard();
    const zb = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    zb("nbZoomIn", () => board && board.zoomIn());
    zb("nbZoomOut", () => board && board.zoomOut());
    zb("nbZoomReset", () => board && board.reset());
    zb("nbFit", () => board && board.fit());
  }
  async function activate() { await ensureLoaded(); render(); if (board && nb.view) board.setView(nb.view); }

  window.Notebook = { init: init, activate: activate, addEquation: addEquation, addNote: addNote, addCoupling: addCoupling };
  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
})();
