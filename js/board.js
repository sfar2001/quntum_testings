/* ============================================================================
 *  BOARD.JS  —  a tiny freeform canvas engine (whiteboard)
 *  ----------------------------------------------------------------------------
 *  Turns a viewport element into an infinite, pannable, zoomable surface whose
 *  child "cards" can be dragged around freely (by a handle) and width-resized.
 *  Used by the Notebook and the Quantum solver so their components float and
 *  regroup instead of stacking one above the other.
 *
 *  const board = window.Board.attach(viewportEl, {
 *     onMove(cardEl, x, y), onResize(cardEl, w), onView({x,y,scale}, committed)
 *  });
 *  board.surface           // append your absolutely-positioned cards here
 *  board.equip(cardEl)     // mark a card draggable + add a resize grip
 *  board.setView(v) / getView() / zoomIn() / zoomOut() / reset() / fit()
 * ========================================================================== */
(function () {
  "use strict";
  const MIN = 0.25, MAX = 2.5;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function attach(viewport, opts) {
    opts = opts || {};
    viewport.classList.add("board-viewport");
    let surface = viewport.querySelector(":scope > .board-surface");
    if (!surface) { surface = document.createElement("div"); surface.className = "board-surface"; viewport.appendChild(surface); }

    const view = { x: 24, y: 24, scale: 1 };
    const apply = () => { surface.style.transform = "translate(" + view.x + "px," + view.y + "px) scale(" + view.scale + ")"; };
    const emitView = (committed) => { if (opts.onView) opts.onView({ x: view.x, y: view.y, scale: view.scale }, !!committed); };

    let mode = null, target = null, sx = 0, sy = 0, startX = 0, startY = 0, startW = 0, startH = 0, rdir = "xy";

    function onDown(e) {
      if (e.button !== 0) return;
      // let interactive controls work normally (their clicks must not start a drag/pan)
      if (e.target.closest("button, input, select, textarea, a, label") && !e.target.closest(".board-resize")) return;
      const resize = e.target.closest(".board-resize");
      const handle = e.target.closest("[data-board-handle]");
      const card = e.target.closest(".board-card");
      if (resize && card) {
        mode = "resize"; target = card; startW = card.offsetWidth; startH = card.offsetHeight;
        rdir = resize.classList.contains("r") ? "x" : resize.classList.contains("b") ? "y" : "xy";
        card.style.zIndex = ++Z;
      }
      else if (handle && card) { mode = "drag"; target = card; startX = parseFloat(card.style.left) || 0; startY = parseFloat(card.style.top) || 0; card.classList.add("dragging"); card.style.zIndex = ++Z; }
      else if (!card) { mode = "pan"; viewport.classList.add("panning"); }
      else return; // inside a card body → let it interact normally
      sx = e.clientX; sy = e.clientY;
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      e.preventDefault();
    }
    function onMove(e) {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (mode === "pan") { view.x += dx; view.y += dy; sx = e.clientX; sy = e.clientY; apply(); emitView(false); }
      else if (mode === "drag") { target.style.left = (startX + dx / view.scale) + "px"; target.style.top = (startY + dy / view.scale) + "px"; }
      else if (mode === "resize") {
        if (rdir !== "y") target.style.width = Math.max(240, startW + dx / view.scale) + "px";
        if (rdir !== "x") target.style.height = Math.max(140, startH + dy / view.scale) + "px";
      }
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp);
      viewport.classList.remove("panning");
      if (mode === "drag" && target) { target.classList.remove("dragging"); if (opts.onMove) opts.onMove(target, parseFloat(target.style.left) || 0, parseFloat(target.style.top) || 0); }
      else if (mode === "resize" && target && opts.onResize) opts.onResize(target, target.offsetWidth, target.offsetHeight, rdir);
      else if (mode === "pan") emitView(true);
      mode = null; target = null;
    }
    let Z = 10;

    viewport.addEventListener("mousedown", onDown);
    viewport.addEventListener("wheel", function (e) {
      // let editable / scrollable fields scroll normally; otherwise zoom
      if (e.target.closest("textarea, input, select, .board-noZoom")) return;
      e.preventDefault();
      const r = viewport.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      const wx = (px - view.x) / view.scale, wy = (py - view.y) / view.scale;
      view.scale = clamp(view.scale * (e.deltaY < 0 ? 1.12 : 0.892), MIN, MAX);
      view.x = px - wx * view.scale; view.y = py - wy * view.scale; apply(); emitView(true);
    }, { passive: false });

    function zoomCenter(f) {
      const r = viewport.getBoundingClientRect(), px = r.width / 2, py = r.height / 2;
      const wx = (px - view.x) / view.scale, wy = (py - view.y) / view.scale;
      view.scale = clamp(view.scale * f, MIN, MAX);
      view.x = px - wx * view.scale; view.y = py - wy * view.scale; apply(); emitView(true);
    }
    function equip(card) {
      card.classList.add("board-card");
      if (!card.querySelector(":scope > .board-resize")) {
        [["r", "drag to resize width"], ["b", "drag to resize height"], ["br", "drag to resize"]].forEach(d => {
          const h = document.createElement("div"); h.className = "board-resize " + d[0]; h.title = d[1]; card.appendChild(h);
        });
      }
    }
    function setView(v) { if (v) { if (isFinite(v.x)) view.x = v.x; if (isFinite(v.y)) view.y = v.y; if (isFinite(v.scale)) view.scale = clamp(v.scale, MIN, MAX); } apply(); }
    function fit() {
      const cards = [].slice.call(surface.querySelectorAll(".board-card"));
      if (!cards.length) { view.x = 24; view.y = 24; view.scale = 1; apply(); emitView(true); return; }
      let nx = 1e9, ny = 1e9, xx = -1e9, yy = -1e9;
      cards.forEach(c => { const x = parseFloat(c.style.left) || 0, y = parseFloat(c.style.top) || 0; nx = Math.min(nx, x); ny = Math.min(ny, y); xx = Math.max(xx, x + c.offsetWidth); yy = Math.max(yy, y + c.offsetHeight); });
      const r = viewport.getBoundingClientRect(), pad = 50;
      view.scale = clamp(Math.min(r.width / ((xx - nx) + pad * 2), r.height / ((yy - ny) + pad * 2)), MIN, 1.2);
      view.x = -(nx - pad) * view.scale; view.y = -(ny - pad) * view.scale; apply(); emitView(true);
    }
    apply();
    return {
      surface, equip, setView, getView: () => ({ x: view.x, y: view.y, scale: view.scale }),
      zoomIn: () => zoomCenter(1.2), zoomOut: () => zoomCenter(1 / 1.2),
      reset: () => { view.x = 24; view.y = 24; view.scale = 1; apply(); emitView(true); }, fit
    };
  }
  window.Board = { attach };
})();
