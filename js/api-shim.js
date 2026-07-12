/* ============================================================================
 *  API-SHIM.JS  —  the static "backend"
 *  ----------------------------------------------------------------------------
 *  The original Quantum Atom Lab talked to a compute backend over HTTP
 *  (/api/schrodinger, /api/circuit, /api/beam, …). This public build ships with
 *  NO server: instead this shim intercepts window.fetch, and every /api/* call
 *  is answered *in the browser* by js/physics-engine.js (real numerical physics,
 *  computed live) — plus localStorage for the notebook and beam history.
 *
 *  Nothing else in the app changes: every view still calls fetch("/api/…") and
 *  gets back exactly the JSON shape it expects. The whole lab therefore runs as
 *  a pure static site (GitHub Pages / Netlify / a file:// double-click).
 *
 *  Must load FIRST, before any view script can call fetch.
 * ========================================================================== */
(function () {
  "use strict";

  const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  const LS_BEAM = "quantumAtomLab.beamHistory";
  const LS_NOTEBOOK = "quantumAtomLab.notebook"; // shared with notebook.js mirror

  /* ---------- a minimal Response-like object ---------- */
  function jsonResponse(obj, status) {
    const body = JSON.stringify(obj);
    return {
      ok: status === undefined || (status >= 200 && status < 300),
      status: status || 200,
      headers: { get: () => "application/json" },
      async json() { return JSON.parse(body); },
      async text() { return body; }
    };
  }

  /* ---------- query-string parsing ---------- */
  function parseQuery(url) {
    const q = {};
    const i = url.indexOf("?");
    if (i < 0) return q;
    url.slice(i + 1).split("&").forEach(pair => {
      if (!pair) return;
      const eq = pair.indexOf("=");
      const k = eq < 0 ? pair : pair.slice(0, eq);
      const v = eq < 0 ? "" : pair.slice(eq + 1);
      q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
    });
    return q;
  }
  function path(url) {
    let p = url;
    const h = p.indexOf("?"); if (h >= 0) p = p.slice(0, h);
    // strip protocol + host so an absolute URL still matches by its /api/… path
    p = p.replace(/^[a-z]+:\/\/[^/]+/i, "");
    return p;
  }

  /* ---------- beam-history persistence ---------- */
  function loadBeamHistory() {
    try { const s = localStorage.getItem(LS_BEAM); if (s) return JSON.parse(s) || []; } catch (e) { }
    return [];
  }
  function saveBeamHistory(list) {
    try { localStorage.setItem(LS_BEAM, JSON.stringify(list.slice(-200))); } catch (e) { }
  }

  /* ---------- notebook persistence ---------- */
  function loadNotebook() {
    try { const s = localStorage.getItem(LS_NOTEBOOK); if (s) return JSON.parse(s); } catch (e) { }
    return { title: "My lab notebook", blocks: [], view: null };
  }
  function saveNotebook(obj) {
    try { localStorage.setItem(LS_NOTEBOOK, JSON.stringify(obj)); } catch (e) { }
  }

  /* ---------- router ---------- */
  function E() {
    if (!window.QuantumEngine) throw new Error("physics engine not loaded");
    return window.QuantumEngine;
  }

  async function route(url, init) {
    const p = path(url);
    const q = parseQuery(url);
    const method = (init && init.method ? init.method : "GET").toUpperCase();

    // ---- periodic table ----
    if (p === "/api/elements") {
      return jsonResponse(window.PERIODIC_DATA || []);
    }

    // ---- quantum solver ----
    if (p === "/api/schrodinger") {
      return jsonResponse(E().schrodinger(+q.z || 1));
    }
    if (p === "/api/circuit") {
      return jsonResponse(E().circuit(+q.n || 2, q.ops || "", q.shots === undefined ? 1024 : +q.shots));
    }
    if (p === "/api/molecule") {
      return jsonResponse(E().molecule());
    }
    if (p === "/api/wavepacket") {
      return jsonResponse(E().wavepacket(q.potential || "free", q.k0 === undefined ? 3 : +q.k0));
    }
    if (p === "/api/qec") {
      return jsonResponse(E().qec(q.code || "repetition", +q.p || 0.1, q.distances || "3,5,7", +q.shots || 0));
    }

    // ---- beam experiment ----
    if (p === "/api/beam/history") {
      return jsonResponse(loadBeamHistory());
    }
    if (p === "/api/beam") {
      let res;
      try { res = E().beam(q); }
      catch (e) { return jsonResponse({ error: String(e && e.message || e) }, 400); }
      if (res && res.error) return jsonResponse(res, 400);
      const hist = loadBeamHistory();
      res.id = hist.length ? (hist[hist.length - 1].id + 1) : 1;
      hist.push(res); saveBeamHistory(hist);
      return jsonResponse(res);
    }

    // ---- two-atom interaction ----
    if (p === "/api/interaction") {
      return jsonResponse(E().interaction(+q.z1 || 1, +q.z2 || 1, +q.distance_pm || 150));
    }

    // ---- notebook persistence (localStorage) ----
    if (p === "/api/notebook") {
      if (method === "POST") {
        let data = {};
        try { data = JSON.parse(init && init.body ? init.body : "{}"); } catch (e) { }
        saveNotebook(data);
        return jsonResponse({ ok: true });
      }
      return jsonResponse(loadNotebook());
    }

    // ---- knowledge-graph analytics ----
    if (p === "/api/brain/status") return jsonResponse(E().brainStatus());
    if (p === "/api/brain/stats") return jsonResponse(E().brainStats());
    if (p === "/api/brain/path") return jsonResponse(E().brainPath(q.from, q.to));

    // not one of ours → real network (KaTeX CDN, etc.)
    if (nativeFetch) return nativeFetch(url, init);
    return jsonResponse({ error: "no network in static build" }, 404);
  }

  /* ---------- install ---------- */
  window.fetch = function (input, init) {
    let url;
    try { url = (typeof input === "string") ? input : (input && input.url) || String(input); }
    catch (e) { url = String(input); }

    if (url && url.indexOf("/api/") >= 0) {
      // resolve asynchronously so callers still get a real Promise<Response>
      return route(url, init).catch(err => jsonResponse({ error: String(err && err.message || err) }, 500));
    }
    if (nativeFetch) return nativeFetch(input, init);
    return Promise.reject(new Error("fetch unavailable"));
  };

  // expose the persistence helpers (used by nothing else, but handy for debugging)
  window.QuantumStaticBackend = { loadBeamHistory, saveBeamHistory, loadNotebook, saveNotebook };
})();
