/* ============================================================================
 *  CONSENT.JS  —  About-first consent gate
 *  ----------------------------------------------------------------------------
 *  The About tab is shown first. Until the visitor accepts the short notice,
 *  every other tab stays LOCKED (disabled). On accept we remember it (so we
 *  never nag returning visitors), unlock the tabs and drop them into the lab.
 * ========================================================================== */
(function () {
  "use strict";
  var KEY = "quantumAtomLab.consent";

  function tabButtons() { return Array.prototype.slice.call(document.querySelectorAll("nav.tabs button")); }
  function lock() { tabButtons().forEach(function (b) { if (b.dataset.view !== "about") { b.disabled = true; b.classList.add("tab-locked"); } }); }
  function unlock() { tabButtons().forEach(function (b) { b.disabled = false; b.classList.remove("tab-locked"); }); }
  function accepted() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }

  function boot() {
    var card = document.getElementById("consentCard");
    var chk = document.getElementById("consentChk");
    var btn = document.getElementById("consentAccept");

    if (accepted()) {                       // returning visitor — nothing to gate
      unlock();
      if (card) card.classList.add("accepted");
      return;
    }

    // first visit → lock everything but About, and make sure About is the visible tab
    lock();
    if (window.switchView) window.switchView("about");

    if (chk && btn) chk.addEventListener("change", function () { btn.disabled = !chk.checked; });
    if (btn) btn.addEventListener("click", function () {
      if (btn.disabled) return;
      try { localStorage.setItem(KEY, "1"); } catch (e) { }
      unlock();
      if (card) card.classList.add("accepted");
      if (window.switchView) window.switchView("lab");   // open the lab for them
    });
  }

  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
