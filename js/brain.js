/* ============================================================================
 *  BRAIN.JS  —  the front-end bridge to the in-browser knowledge engine
 *  ----------------------------------------------------------------------------
 *  The Knowledge Network (network.js) draws the graph from the local
 *  window.KNOWLEDGE. This module connects, in parallel, to the knowledge graph
 *  (in the browser) which loads that same graph and computes — across a pool
 *  of worker actors — the relationships every concept has: degree, bridges,
 *  hubs, and shortest concept-paths between any two ideas.
 *
 *  When the cluster is reachable, the network view shows a live "served by Brain
 *  cluster" badge + hub list, and the "Connect two ideas" explorer asks the
 *  cluster for the shortest path. When it is offline, everything degrades to a
 *  local BFS over window.KNOWLEDGE so the feature still works (clearly flagged).
 *
 *  Exposes: window.Brain = { init, activate, connected }
 * ========================================================================== */
(function () {
  "use strict";
  const KN = window.KNOWLEDGE;
  const host = location.hostname || "localhost";
  // try our running port (8091) first, then the canonical default (8090)
  const CANDIDATES = ["http://" + host + ":8091", "http://" + host + ":8090"];

  let BASE = null, status = null, stats = null, connected = false, started = false;

  function timeoutSignal(ms) { return (typeof AbortSignal !== "undefined" && AbortSignal.timeout) ? AbortSignal.timeout(ms) : undefined; }

  async function probe() {
    for (const base of CANDIDATES) {
      try {
        const r = await fetch(base + "/api/brain/status", { signal: timeoutSignal(2500) });
        if (r.ok) { BASE = base; status = await r.json(); connected = true; return true; }
      } catch (e) { /* try next */ }
    }
    connected = false; BASE = null; return false;
  }

  async function loadStats() {
    if (!BASE) return;
    try {
      const r = await fetch(BASE + "/api/brain/stats", { signal: timeoutSignal(3500) });
      if (r.ok) stats = await r.json();
    } catch (e) { /* keep null */ }
  }

  /* ---- shortest concept-path over the knowledge graph ---- */
  async function findPath(fromId, toId) {
    if (connected && BASE) {
      try {
        const r = await fetch(BASE + "/api/brain/path?from=" + encodeURIComponent(fromId) + "&to=" + encodeURIComponent(toId), { signal: timeoutSignal(4000) });
        if (r.ok) { const j = await r.json(); return { found: j.found, ids: (j.path || []).map(p => p.id), hops: j.hops, source: "cluster" }; }
      } catch (e) { /* fall through to local */ }
    }
    return localPath(fromId, toId);
  }

  function localPath(fromId, toId) {
    // undirected BFS over window.KNOWLEDGE
    const adj = {};
    KN.nodes.forEach(n => { adj[n.id] = adj[n.id] || new Set(); (n.related || []).forEach(t => { if (KN.byId[t]) { adj[n.id].add(t); adj[t] = adj[t] || new Set(); adj[t].add(n.id); } }); });
    if (!KN.byId[fromId] || !KN.byId[toId]) return { found: false, ids: [], hops: -1, source: "local" };
    if (fromId === toId) return { found: true, ids: [fromId], hops: 0, source: "local" };
    const prev = {}, seen = new Set([fromId]), q = [fromId];
    while (q.length) {
      const cur = q.shift();
      for (const nb of (adj[cur] || [])) {
        if (!seen.has(nb)) {
          seen.add(nb); prev[nb] = cur;
          if (nb === toId) { const path = []; for (let at = toId; at != null; at = prev[at] ?? null) { path.unshift(at); if (at === fromId) break; } return { found: true, ids: path, hops: path.length - 1, source: "local" }; }
          q.push(nb);
        }
      }
    }
    return { found: false, ids: [], hops: -1, source: "local" };
  }

  /* ----------------------------- DOM render ---------------------------- */
  function renderBadge() {
    const el = document.getElementById("brainBadge");
    if (!el) return;
    if (connected && status) {
      el.innerHTML =
        '<span class="bdot live"></span>🧠 Knowledge engine <b>live</b> · ' +
        status.nodeCount + ' concepts · ' + status.edgeCount + ' links · ' +
        status.domainCount + ' domains · computed in-browser';
      el.title = "Graph analytics computed live in your browser";
    } else {
      el.innerHTML = '<span class="bdot off"></span>🧠 Knowledge engine <b>offline</b> · showing ' +
        KN.nodes.length + ' concepts locally';
      el.title = "Graph analytics computed live in your browser";
    }
  }

  function renderPanel() {
    const head = document.getElementById("brainConn");
    if (head) {
      head.innerHTML = connected
        ? '<span class="bdot live"></span>in-browser knowledge engine'
        : '<span class="bdot off"></span>in-browser knowledge engine';
    }
    const hubBox = document.getElementById("brainHubs");
    if (hubBox) {
      if (connected && stats && stats.topHubs) {
        hubBox.innerHTML = '<div class="bh-title">Most connected concepts <span>(computed in your browser)</span></div>' +
          stats.topHubs.slice(0, 6).map(h =>
            '<span class="bhub" data-id="' + h.id + '" style="border-color:' + domColor(h.domain) + '">' +
            esc(h.name) + ' <b>' + h.degree + '</b></span>').join("");
        hubBox.querySelectorAll(".bhub").forEach(c => c.onclick = () => focus(c.dataset.id));
      } else if (connected && stats) {
        hubBox.innerHTML = '';
      } else {
        hubBox.innerHTML = '<div class="bh-title" style="color:var(--text-faint)">Hub analytics for the graph.</div>';
      }
    }
    const bc = document.getElementById("brainBridges");
    if (bc) {
      if (connected && stats && typeof stats.bridgeCount === "number") {
        bc.textContent = stats.bridgeCount + " bridge concepts link ≥2 domains · avg degree " + stats.avgDegree;
      } else { bc.textContent = ""; }
    }
  }

  function domColor(d) { return (KN.domains[d] && KN.domains[d].color) || "#7dd3fc"; }
  function focus(id) { if (window.Network && window.Network.focusNode) window.Network.focusNode(id); }

  /* --------------------------- path explorer --------------------------- */
  async function runPath() {
    const fromEl = document.getElementById("brainFrom");
    const toEl = document.getElementById("brainTo");
    const out = document.getElementById("brainPathOut");
    const fromId = resolveId(fromEl.value);
    const toId = resolveId(toEl.value);
    if (!fromId || !toId) { out.innerHTML = '<span class="bp-warn">Pick two concepts from the lists.</span>'; return; }
    out.innerHTML = '<span style="color:var(--text-faint)">finding the shortest path…</span>';
    const res = await findPath(fromId, toId);
    if (!res.found) {
      out.innerHTML = '<span class="bp-warn">No path between those concepts in the graph.</span>';
      if (window.Network.highlightPath) window.Network.highlightPath([]);
      return;
    }
    const chain = res.ids.map((id, i) => {
      const n = KN.byId[id];
      const c = domColor(n ? n.domain : "");
      return (i > 0 ? '<span class="bp-arrow">→</span>' : '') +
        '<span class="bp-step" data-id="' + id + '" style="border-color:' + c + ';color:' + c + '">' + esc(n ? n.name : id) + '</span>';
    }).join("");
    out.innerHTML = '<div class="bp-meta">' + res.hops + ' hops · ' +
      'computed in your browser' +
      '</div><div class="bp-chain">' + chain + '</div>';
    out.querySelectorAll(".bp-step").forEach(s => s.onclick = () => focus(s.dataset.id));
    if (window.Network.highlightPath) window.Network.highlightPath(res.ids);
  }

  function resolveId(val) {
    if (!val) return null;
    const v = val.trim().toLowerCase();
    if (KN.byId[v]) return v;                              // exact id
    for (const n of KN.nodes) if (n.name.toLowerCase() === v) return n.id;  // exact name
    for (const n of KN.nodes) if (n.name.toLowerCase().includes(v)) return n.id; // partial name
    return null;
  }

  function fillDatalist() {
    const dl = document.getElementById("brainConceptList");
    if (!dl) return;
    dl.innerHTML = KN.nodes.slice().sort((a, b) => a.name.localeCompare(b.name))
      .map(n => '<option value="' + esc(n.name) + '">').join("");
  }

  /* ------------------------------- init -------------------------------- */
  async function refresh() {
    await probe();
    if (connected) await loadStats();
    renderBadge(); renderPanel();
  }

  function init() {
    fillDatalist();
    const btn = document.getElementById("brainPathBtn");
    if (btn) btn.onclick = runPath;
    const toggle = document.getElementById("brainPanelToggle");
    const panel = document.getElementById("brainPanel");
    if (toggle && panel) toggle.onclick = () => panel.classList.toggle("collapsed");
    [document.getElementById("brainFrom"), document.getElementById("brainTo")].forEach(inp => {
      if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter") runPath(); });
    });
    renderBadge(); renderPanel();
  }

  function activate() {            // called whenever the network tab is shown
    if (!started) { started = true; refresh(); }
    else refresh();                // re-probe re-probe the graph
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  window.Brain = { init, activate, isConnected: () => connected, base: () => BASE };
})();
