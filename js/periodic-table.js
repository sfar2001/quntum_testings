/* ============================================================================
 *  PERIODIC-TABLE.JS  —  the 4th view: all 119 elements + their computed behaviour
 *  ----------------------------------------------------------------------------
 *  Data comes from window.PERIODIC_DATA (js/periodic-data.js), computed in-browser:
 *    • served through the static fetch shim at /api/elements
 *    • bundled snapshot: window.PERIODIC_DATA in js/periodic-data.js
 *  Each record holds the same
 *  classical / quantum / molecular-spin equations as the rest of the lab.
 * ========================================================================== */
(function () {
  "use strict";

  const API_BASE = (location.protocol === "http:" || location.protocol === "https:") ? "" : "http://localhost:8080";
  const API_URL = API_BASE + "/api/elements";

  // category → accent colour (dark-theme friendly)
  const CAT_COLOR = {
    "Alkali metal":          "#f87171",
    "Alkaline earth metal":  "#fb923c",
    "Transition metal":      "#fbbf24",
    "Post-transition metal": "#4ade80",
    "Metalloid":             "#2dd4bf",
    "Reactive nonmetal":     "#38bdf8",
    "Noble gas":             "#a78bfa",
    "Lanthanide":            "#f472b6",
    "Actinide":              "#e879f9",
    "Unknown":               "#94a3b8"
  };

  // domain → colour (mirrors knowledge-data.js DOMAINS / styles.css)
  const DOMAIN_COLOR = {
    classical: "#f5a623", quantum: "#22d3ee", "quantum-info": "#a78bfa",
    spin: "#f472b6", relativistic: "#34d399", molecular: "#60a5fa", forces: "#fb7185"
  };
  const DOMAIN_LABEL = {
    classical: "Classical mechanics", quantum: "Quantum (Schrödinger)",
    "quantum-info": "Qubit / Bloch sphere", spin: "Spin & magnetism",
    relativistic: "Relativity", molecular: "Molecules & clusters", forces: "Forces & big picture"
  };
  const DOMAIN_ORDER = ["classical", "quantum", "quantum-info", "spin", "relativistic", "molecular", "forces"];

  let DATA = [];
  let byZ = {};
  let selectedZ = null;
  let built = false;

  /* ---------- data loading ---------- */
  function indexData(arr) {
    DATA = arr || [];
    byZ = {};
    DATA.forEach(p => { byZ[p.element.atomicNumber] = p; });
  }

  async function tryLive() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(API_URL, { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d) && d.length) return d;
      }
    } catch (e) { /* server not running → use bundled snapshot */ }
    return null;
  }

  function setSource(text, live) {
    const el = document.getElementById("ptSource");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("live", !!live);
  }

  /* ---------- grid layout ---------- */
  // f-block series members live in the lower strip; everything else uses group/period.
  function isFstrip(e) {
    const Z = e.atomicNumber;
    return (e.category === "Lanthanide" && Z >= 57 && Z <= 70) ||
           (e.category === "Actinide"   && Z >= 89 && Z <= 102);
  }

  function cellHTML(p, pos) {
    const e = p.element;
    const color = CAT_COLOR[e.category] || "#94a3b8";
    return '<button class="pt-cell" data-z="' + e.atomicNumber + '" ' +
      'style="' + pos + '--cat:' + color + '" title="' + esc(e.name + " — " + e.category) + '">' +
      '<span class="pt-z">' + e.atomicNumber + '</span>' +
      '<span class="pt-sym">' + esc(e.symbol) + '</span>' +
      '<span class="pt-mass">' + fmtMass(e.atomicMass) + '</span>' +
      '</button>';
  }

  function buildGrid() {
    const main = document.getElementById("ptableMain");
    const fblock = document.getElementById("ptableF");
    if (!main || !fblock) return;

    let mainHTML = "";
    let fHTML = "";
    DATA.forEach(p => {
      const e = p.element;
      if (isFstrip(e)) {
        const row = e.category === "Lanthanide" ? 1 : 2;
        const base = e.category === "Lanthanide" ? 57 : 89;
        const col = 4 + (e.atomicNumber - base);   // sit under groups 4..17
        fHTML += cellHTML(p, "grid-row:" + row + ";grid-column:" + col + ";");
      } else {
        let col = parseInt(e.group, 10);
        if (isNaN(col)) col = 3;
        mainHTML += cellHTML(p, "grid-row:" + e.period + ";grid-column:" + col + ";");
      }
    });

    main.innerHTML = mainHTML;
    fblock.innerHTML =
      '<span class="pt-fl-label" style="grid-row:1;grid-column:1 / span 3">57–70 · lanthanides</span>' +
      '<span class="pt-fl-label" style="grid-row:2;grid-column:1 / span 3">89–102 · actinides</span>' +
      fHTML;

    [main, fblock].forEach(g => g.querySelectorAll(".pt-cell").forEach(btn => {
      btn.onclick = () => selectElement(parseInt(btn.dataset.z, 10));
    }));

    buildLegend();
    buildSearch();
    built = true;
    if (selectedZ != null) selectElement(selectedZ);
  }

  /* ---------- search bar (over the grid) ---------- */
  function buildSearch() {
    const head = document.querySelector("#view-ptable .pt-head");
    if (!head) return;
    if (!head.querySelector(".pt-search-bar")) {
      const bar = document.createElement("div");
      bar.className = "pt-search-bar";
      bar.innerHTML =
        '<input id="ptSearch" list="ptSearchList" autocomplete="off" ' +
        'placeholder="🔍  search element — name, symbol or atomic number… (press ↵ to open)">' +
        '<datalist id="ptSearchList"></datalist>';
      head.appendChild(bar);
      const input = bar.querySelector("#ptSearch");
      input.addEventListener("input", () => filterGrid(input.value));
      const go = () => { const z = findMatch(input.value); if (z != null) { selectElement(z); scrollToCell(z); } };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      input.addEventListener("change", go);
    }
    populateDatalist();
  }
  function populateDatalist() {
    const dl = document.getElementById("ptSearchList");
    if (!dl) return;
    dl.innerHTML = DATA.map(p =>
      '<option value="' + esc(p.element.name) + '">' + esc(p.element.symbol) + " · " + p.element.atomicNumber + "</option>"
    ).join("");
  }
  function filterGrid(q) {
    q = (q || "").trim().toLowerCase();
    document.querySelectorAll(".pt-cell").forEach(c => {
      const p = byZ[+c.dataset.z];
      if (!p) { c.classList.remove("pt-dim"); return; }
      const e = p.element;
      const hit = !q || e.symbol.toLowerCase().startsWith(q) || e.name.toLowerCase().includes(q) || String(e.atomicNumber) === q;
      c.classList.toggle("pt-dim", !hit);
    });
  }
  function scrollToCell(z) {
    const c = document.querySelector('.pt-cell[data-z="' + z + '"]');
    if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function findMatch(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return null;
    let m = DATA.find(p => p.element.symbol.toLowerCase() === q); if (m) return m.element.atomicNumber;
    if (/^\d+$/.test(q) && byZ[+q]) return +q;
    m = DATA.find(p => p.element.name.toLowerCase() === q); if (m) return m.element.atomicNumber;
    m = DATA.find(p => p.element.name.toLowerCase().startsWith(q) || p.element.symbol.toLowerCase().startsWith(q)); if (m) return m.element.atomicNumber;
    m = DATA.find(p => p.element.name.toLowerCase().includes(q)); return m ? m.element.atomicNumber : null;
  }

  function buildLegend() {
    const leg = document.getElementById("ptLegend");
    if (!leg) return;
    leg.innerHTML = Object.keys(CAT_COLOR).map(cat =>
      '<span class="pt-leg"><i style="background:' + CAT_COLOR[cat] + '"></i>' + esc(cat) + '</span>'
    ).join("");
  }

  /* ---------- detail panel ---------- */
  function selectElement(z) {
    selectedZ = z;
    const p = byZ[z];
    const panel = document.getElementById("ptableDetail");
    if (!panel || !p) return;

    document.querySelectorAll(".pt-cell.sel").forEach(c => c.classList.remove("sel"));
    const cell = document.querySelector('.pt-cell[data-z="' + z + '"]');
    if (cell) cell.classList.add("sel");

    // Deep inspector (tabbed: phases/heat, zoom-to-quarks, motion, radioactivity, equations)
    if (window.PeriodicSim && window.PeriodicSim.show) { window.PeriodicSim.show(p); return; }

    const e = p.element;
    const color = CAT_COLOR[e.category] || "#94a3b8";

    let html = '<div class="pt-d-head" style="--cat:' + color + '">' +
      '<div class="pt-d-sym">' + esc(e.symbol) + '</div>' +
      '<div class="pt-d-id"><div class="pt-d-name">' + esc(e.name) + '</div>' +
      '<div class="pt-d-sub">Z = ' + e.atomicNumber + ' · ' + fmtMass(e.atomicMass) + ' u · ' +
      esc(e.category) + ' · period ' + e.period + ' · group ' + esc(String(e.group)) + '</div></div></div>';

    // electron structure
    html += '<div class="pt-d-struct">' +
      kv("Electron configuration", '<span class="mono">' + esc(p.electronConfiguration) + '</span>') +
      kv("Shell occupancy", "[" + (p.shellOccupancy || []).join(", ") + "]") +
      kv("Outer shell n", p.principalQuantumNumber) +
      kv("Valence electrons", p.valenceElectrons) +
      kv("Unpaired electrons", p.unpairedElectrons) +
      '</div>';

    html += sectionHTML("Classical — Bohr orbit", p.classical, DOMAIN_COLOR.classical);
    html += sectionHTML("Quantum — Schrödinger", p.quantum, DOMAIN_COLOR.quantum);
    html += sectionHTML("Molecular / spin cluster", p.molecular, DOMAIN_COLOR.molecular);

    html += equationsHTML(p.equations);

    panel.innerHTML = html;
    panel.querySelectorAll(".eq-nb").forEach(el => el.onclick = () => { if (window.Notebook) window.Notebook.addEquation(el.dataset.latex, el.dataset.name); });
    panel.scrollTop = 0;
  }

  /* full knowledge-base equation list, applied to this atom and grouped by domain */
  function equationsHTML(equations) {
    if (!equations || !equations.length) return "";
    const KN = window.KNOWLEDGE;
    const groups = {};
    equations.forEach(eq => { (groups[eq.domain] = groups[eq.domain] || []).push(eq); });

    let html = '<div class="pt-eqs"><h4 class="pt-eqs-title">All equations applied · ' +
      equations.length + '</h4>' +
      '<p class="pt-eqs-note">Every equation in the knowledge base, evaluated for this atom in your browser. ' +
      '<span class="pt-kind computed">computed</span> = atom-specific value · ' +
      '<span class="pt-kind universal">universal</span> = same for all atoms · ' +
      '<span class="pt-kind structural">structural</span> = needs a partner/field.</p>';

    DOMAIN_ORDER.forEach(dom => {
      const list = groups[dom];
      if (!list) return;
      const color = DOMAIN_COLOR[dom] || "#94a3b8";
      html += '<div class="pt-eq-group" style="--sec:' + color + '">' +
        '<div class="pt-eq-dom">' + esc(DOMAIN_LABEL[dom] || dom) + ' <span>(' + list.length + ')</span></div>';
      list.forEach(eq => {
        const node = KN && KN.byId ? KN.byId[eq.id] : null;
        const latex = node && node.latex ? node.latex : "";
        const texHost = (latex && window.TeX)
          ? '<div class="pt-eq-tex">' + window.TeX.renderToString(latex, false) + '</div>'
          : "";
        html += '<div class="pt-eq">' +
          '<div class="pt-eq-head"><span class="pt-eq-name">' + esc(eq.name) + '</span>' +
          '<span class="pt-kind ' + esc(eq.kind) + '">' + esc(eq.kind) + '</span>' +
          '<button class="eq-nb" title="copy to 📓 Notebook" data-latex="' + esc(latex) + '" data-name="' + esc(eq.name) + '">📓</button></div>' +
          texHost +
          '<div class="pt-eq-sum">' + esc(eq.summary) + '</div>' +
          '</div>';
      });
      html += '</div>';
    });
    return html + '</div>';
  }

  function sectionHTML(title, map, color) {
    if (!map) return "";
    const model = map.model ? '<div class="pt-sec-model">' + esc(map.model) + '</div>' : "";
    let rows = "";
    Object.keys(map).forEach(k => {
      if (k === "model") return;
      rows += '<div class="pt-row"><span class="pt-k">' + esc(prettyKey(k)) +
        '</span><span class="pt-v">' + esc(fmtVal(map[k])) + '</span></div>';
    });
    return '<div class="pt-sec" style="--sec:' + color + '">' +
      '<h4>' + esc(title) + '</h4>' + model + rows + '</div>';
  }

  /* ---------- formatting helpers ---------- */
  function kv(k, v) { return '<div class="pt-row"><span class="pt-k">' + esc(k) + '</span><span class="pt-v">' + v + '</span></div>'; }

  function fmtVal(v) {
    if (typeof v === "number") return fmtNum(v);
    if (Array.isArray(v)) return v.map(fmtVal).join(", ");
    if (typeof v === "boolean") return v ? "yes" : "no";
    return String(v);
  }

  // clean, readable number: plain for [1e-3, 1e5); else scientific with a superscript exponent.
  const SUPER = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  function sup(n) {
    const neg = n < 0;
    return (neg ? "⁻" : "") + String(Math.abs(n)).split("").map(d => SUPER[+d]).join("");
  }
  function fmtNum(v) {
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a >= 1e-3 && a < 1e5) return String(Number(v.toPrecision(5)));
    let exp = Math.floor(Math.log10(a));
    let mant = v / Math.pow(10, exp);
    mant = Math.round(mant * 1000) / 1000;
    if (Math.abs(mant) >= 10) { mant /= 10; exp++; }
    return String(mant) + "×10" + sup(exp);
  }

  function fmtMass(m) { return (Math.round(m * 1000) / 1000).toString(); }

  const UNIT_LABEL = {
    pm: "(pm)", nm: "(nm)", eV: "(eV)", N: "(N)", Js: "(J·s)", muB: "(µ_B)",
    "m_per_s": "(m/s)", "kg_m_per_s": "(kg·m/s)", "JperT": "(J/T)",
    "fraction_of_c": "(/c)", "2S_plus_1": "(2S+1)", "2S": "(2S)"
  };

  function prettyKey(k) {
    // peel a known unit suffix, then de-camelCase the rest
    let unit = "";
    for (const suf in UNIT_LABEL) {
      if (k.endsWith("_" + suf)) { unit = " " + UNIT_LABEL[suf]; k = k.slice(0, -(suf.length + 1)); break; }
    }
    let label = k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
    label = label.charAt(0).toUpperCase() + label.slice(1);
    return label + unit;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  /* ---------- boot ---------- */
  async function init() {
    indexData(window.PERIODIC_DATA || []);
    if (DATA.length) {
      buildGrid();
      setSource("bundled snapshot (" + DATA.length + " elements)", false);
    } else {
      setSource("no data — check js/periodic-data.js", false);
    }
    // try to upgrade to the live server in the background
    const live = await tryLive();
    if (live) {
      indexData(live);
      buildGrid();
      setSource("● " + DATA.length + " elements · computed in-browser", true);
    }
  }

  window.PeriodicTable = {
    init,
    activate: function () { if (!built && (window.PERIODIC_DATA || []).length) init(); },
    select: function (z) { if (byZ[z]) { selectElement(z); scrollToCell(z); return true; } return false; },
    search: function (q) { const z = findMatch(q); if (z != null) { selectElement(z); scrollToCell(z); } return z; },
    maxZ: function () { return DATA.length ? Math.max.apply(null, DATA.map(p => p.element.atomicNumber)) : 118; }
  };

  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
})();
