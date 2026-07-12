/* ============================================================================
 *  ABOUT.JS  —  make the (first-seen) About tab interactive
 *  ----------------------------------------------------------------------------
 *  1) A live mouse-reactive atom canvas in the header (tilts toward the cursor,
 *     electrons orbit, click sends a pulse).
 *  2) The "What's inside" cards become a launchpad — click one to open that tab.
 *     Before consent is accepted the tabs are locked, so a click instead nudges
 *     (shakes) the consent card to hold the visitor on the accept step.
 * ========================================================================== */
(function () {
  "use strict";
  var KEY = "quantumAtomLab.consent";
  function accepted() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }

  /* ---------- interactive mini-atom ---------- */
  function atomCanvas() {
    var c = document.getElementById("aboutAtom");
    if (!c || !c.getContext) return;
    var ctx = c.getContext("2d");
    var W = 220, H = 220, dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
    var mx = 0, my = 0, tilt = 0, t = 0, pulses = [];
    var orbits = [
      { r: 50, col: "#22d3ee", s: 1.0, ph: 0.0, tilt: 0.0 },
      { r: 72, col: "#a78bfa", s: -0.8, ph: 2.0, tilt: 1.1 },
      { r: 92, col: "#f472b6", s: 0.6, ph: 4.0, tilt: -1.0 }
    ];
    c.addEventListener("pointermove", function (e) { var r = c.getBoundingClientRect(); mx = (e.clientX - r.left) / W - 0.5; my = (e.clientY - r.top) / H - 0.5; });
    c.addEventListener("pointerleave", function () { mx = 0; my = 0; });
    c.addEventListener("pointerdown", function () { pulses.push({ r: 16, a: 0.9 }); });

    function frame() {
      requestAnimationFrame(frame);
      if (c.offsetParent === null) return;        // About not visible → don't draw
      t += 0.016;
      tilt += ((mx * 0.6) - tilt) * 0.08;
      var oy = my * 12;
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H / 2 + oy;

      // halo
      var g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 62);
      g.addColorStop(0, "rgba(56,189,248,.5)"); g.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 62, 0, 7); ctx.fill();

      // click pulses
      for (var i = 0; i < pulses.length; i++) { var p = pulses[i]; p.r += 2.4; p.a *= 0.94; ctx.strokeStyle = "rgba(125,211,252," + p.a + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, p.r, 0, 7); ctx.stroke(); }
      pulses = pulses.filter(function (p) { return p.a > 0.05; });

      // orbits + electrons
      orbits.forEach(function (o) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.tilt + tilt); ctx.scale(1, 0.4);
        ctx.globalAlpha = 0.5; ctx.strokeStyle = o.col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, o.r, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
        var a = t * o.s + o.ph, ex = Math.cos(a) * o.r, ey = Math.sin(a) * o.r;
        var eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 9);
        eg.addColorStop(0, "#fff"); eg.addColorStop(0.4, o.col); eg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, 9, 0, 7); ctx.fill();
        ctx.restore();
      });

      // nucleus
      var ng = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 15);
      ng.addColorStop(0, "#fff"); ng.addColorStop(0.5, "#7dd3fc"); ng.addColorStop(1, "#2563eb");
      ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill();
    }
    frame();
  }

  /* ---------- launchpad: "What's inside" cards open their tab ---------- */
  var MAP = [
    ["Atom Lab", "lab"], ["Knowledge Network", "net"], ["Demonstrations", "demos"],
    ["Equation Library", "lib"], ["Periodic Table", "ptable"], ["Atom Sim", "sim"],
    ["Quantum Solver", "quantum"], ["Notebook", "notebook"]
  ];
  function nudgeConsent() {
    var card = document.getElementById("consentCard");
    if (!card || card.classList.contains("accepted")) return;
    card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
    try { card.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { }
    var chk = document.getElementById("consentChk"); if (chk) chk.focus();
  }
  function open(view) {
    var btn = document.querySelector('nav.tabs button[data-view="' + view + '"]');
    if (btn) { btn.disabled = false; btn.click(); }
    else if (window.switchView) window.switchView(view);
  }
  function launchpad() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".about-grid .about-card:not(.proj)"));
    cards.forEach(function (card) {
      var h = card.querySelector("h3"); if (!h) return;
      var txt = h.textContent || "";
      var hit = null;
      for (var i = 0; i < MAP.length; i++) { if (txt.indexOf(MAP[i][0]) >= 0) { hit = MAP[i][1]; break; } }
      if (!hit) return;
      card.classList.add("launch"); card.setAttribute("data-goto", hit); card.setAttribute("role", "button"); card.tabIndex = 0;
      var go = document.createElement("span"); go.className = "card-go"; go.textContent = "Open →"; card.appendChild(go);
      var act = function () { if (accepted()) open(hit); else nudgeConsent(); };
      card.addEventListener("click", act);
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
    });
  }

  function boot() { atomCanvas(); launchpad(); }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
