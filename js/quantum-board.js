/* ============================================================================
 *  QUANTUM-BOARD.JS  —  make the Quantum solver cards a freeform board
 *  Drag (by the card title), pan, zoom, width-resize, regroup. Card positions
 *  + view persist in localStorage so your layout survives reloads.
 *  Exposes: window.QuantumBoard = { activate }
 * ========================================================================== */
(function () {
  "use strict";
  const LS = "quantumAtomLab.qboard";
  let board = null, started = false;
  let state = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })();
  if (!state.cards) state.cards = {};
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) { } };

  function layout(cards) {
    const colX = [24, 770], colH = [24, 24];
    cards.forEach(c => {
      const id = c.dataset.qid, saved = state.cards[id], wide = c.classList.contains("q-card-wide");
      c.style.position = "absolute";
      if (saved && isFinite(saved.x)) {
        c.style.left = saved.x + "px"; c.style.top = saved.y + "px";
        c.style.width = (saved.w || (wide ? 700 : 480)) + "px";
        if (isFinite(saved.h)) c.style.height = saved.h + "px";
      } else {
        c.style.width = (wide ? 700 : 480) + "px";
        const col = colH[0] <= colH[1] ? 0 : 1;
        c.style.left = colX[col] + "px"; c.style.top = colH[col] + "px";
        colH[col] += c.offsetHeight + 26;
        state.cards[id] = { x: colX[col], y: parseFloat(c.style.top), w: parseFloat(c.style.width) };
      }
    });
    save();
  }

  function wireZoom() {
    const b = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    b("qZoomIn", () => board.zoomIn()); b("qZoomOut", () => board.zoomOut());
    b("qZoomReset", () => board.reset()); b("qFit", () => board.fit());
  }

  function activate() {
    const vp = document.getElementById("qBoard"); if (!vp || !window.Board) return;
    if (started) return;
    started = true;
    const cards = [].slice.call(vp.querySelectorAll(".q-card"));
    cards.forEach((c, i) => {
      c.dataset.qid = "q" + i;
      const h = c.querySelector("h2");
      if (h) {
        h.setAttribute("data-board-handle", "");
        if (!c.querySelector(":scope > .q-body")) { const body = document.createElement("div"); body.className = "q-body"; while (h.nextSibling) body.appendChild(h.nextSibling); c.appendChild(body); }
      }
    });
    board = window.Board.attach(vp, {
      onMove: (el, x, y) => { const s = state.cards[el.dataset.qid] || (state.cards[el.dataset.qid] = {}); s.x = x; s.y = y; save(); },
      onResize: (el, w, h, dir) => { const s = state.cards[el.dataset.qid] || (state.cards[el.dataset.qid] = {}); if (dir !== "y") s.w = w; if (dir !== "x") s.h = h; save(); },
      onView: (v, committed) => { state.view = v; if (committed) save(); }
    });
    // move the static cards onto the transformable surface so pan/zoom affects them
    cards.forEach(c => board.surface.appendChild(c));
    cards.forEach(c => board.equip(c));
    layout(cards);
    if (state.view) board.setView(state.view);
    wireZoom();
  }

  window.QuantumBoard = { activate };
})();
