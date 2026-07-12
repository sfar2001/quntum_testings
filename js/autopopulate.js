/* ============================================================================
 *  AUTOPOPULATE.JS  —  make every tab feel alive on first visit
 *  ----------------------------------------------------------------------------
 *  • Seeds a friendly starter Notebook (only if the visitor has none of their own).
 *  • Auto-runs the Quantum-solver and Atom-Sim outputs the first time each tab is
 *    opened, so their result panels show real charts/values instead of a prompt.
 *  Everything stays fully editable — this only fills empties, never overwrites.
 * ========================================================================== */
(function () {
  "use strict";

  /* ---------- 1) starter notebook (only when the user has none) ---------- */
  try {
    var K = "quantumAtomLab.notebook";
    if (!localStorage.getItem(K)) localStorage.setItem(K, JSON.stringify(demoNotebook()));
  } catch (e) { /* private mode / no storage — fine */ }

  function demoNotebook() {
    return {
      title: "Welcome — a starter notebook",
      view: null,
      blocks: [
        { id: 1, type: "note", x: 30, y: 30, w: 360,
          text: "👋 This is your lab notebook — everything here is yours to edit, drag and delete.\n\nAdd equations, notes, tables, comparisons, atom reactions and live experiments from the toolbar. It saves automatically in your browser." },
        { id: 2, type: "equation", x: 30, y: 262, w: 380,
          caption: "Hydrogen-like energy levels", latex: "E_n = -13.6\\,\\frac{Z^2}{n^2}\\ \\text{eV}" },
        { id: 3, type: "equation", x: 30, y: 470, w: 380,
          caption: "Bell state — maximally entangled", latex: "|\\Phi^+\\rangle = \\tfrac{1}{\\sqrt{2}}\\big(|00\\rangle + |11\\rangle\\big)" },
        { id: 4, type: "comparison", x: 440, y: 30, w: 560,
          title: "Classical vs. Quantum",
          rowLabels: ["Ground-state energy of H", "Picture of the electron", "Measurement"],
          sets: [
            { name: "Classical (Bohr)", values: ["−13.6 eV (fixed orbit)", "a point on a circular orbit", "deterministic"] },
            { name: "Quantum (Schrödinger)", values: ["−13.6 eV (n=1 eigenvalue)", "a probability cloud |ψ|²", "probabilistic (Born rule)"] }
          ],
          conclusion: "Same ground-state energy — a completely different picture of the electron." },
        { id: 5, type: "table", x: 440, y: 372, w: 520,
          title: "Handy constants",
          headers: ["quantity", "value", "unit", "note"],
          rows: [
            ["Rydberg energy", "13.606", "eV", "hydrogen ionization"],
            ["Bohr radius", "52.9", "pm", "ground-state orbit"],
            ["Fine-structure α", "1/137", "—", "coupling strength"],
            ["Bohr magneton μ_B", "9.27×10⁻²⁴", "J/T", "electron magnetism"]
          ] },
        { id: 6, type: "idea", x: 440, y: 690, w: 360,
          text: "Try this:\n• Fire a 0.05 nm X-ray at gold (Atom Sim + Beam)\n• Build a Bell pair, then a GHZ state (Quantum solver)\n• Drag H + H close together here to bond them" }
      ]
    };
  }

  /* ---------- 2) auto-run the Atom-Sim output once (fixed layout — no overlap).
     The Quantum-solver tab is deliberately left with its five detailed cards and
     their controls: on the freeform board, auto-expanding every result overlaps
     the neighbouring cards, so we let visitors run each solver themselves. ---- */
  var did = {};
  function click(id) { var el = document.getElementById(id); if (el) { el.click(); return true; } return false; }

  function fillSim() {
    if (did.sim) return; did.sim = true;
    setTimeout(function () { click("simFire"); }, 600);                                    // fire the default beam
  }

  function watch(id, cb) {
    var el = document.getElementById(id);
    if (!el) return;
    var check = function () { if (el.classList.contains("active")) cb(); };
    check();
    try { new MutationObserver(check).observe(el, { attributes: true, attributeFilter: ["class"] }); } catch (e) { }
  }
  function boot() { watch("view-sim", fillSim); }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
