/* ============================================================================
 *  KATEX-HELPER.JS
 *  Thin wrapper around KaTeX (loaded from CDN in index.html).
 *  If KaTeX fails to load (e.g. offline), we degrade gracefully to a cleaned-up
 *  plain-text rendering of the LaTeX so equations are still readable.
 * ========================================================================== */
(function () {
  "use strict";

  function katexReady() {
    return typeof window.katex !== "undefined" && typeof window.katex.render === "function";
  }

  /* very small LaTeX -> readable-text fallback (only used when offline) */
  function latexToText(tex) {
    if (!tex) return "";
    let s = tex;
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");
    s = s.replace(/\\tfrac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
    s = s.replace(/\\begin\{pmatrix\}/g, "[").replace(/\\end\{pmatrix\}/g, "]");
    s = s.replace(/\\\\/g, " ; ").replace(/&/g, ", ");
    const map = {
      "\\hbar": "ħ", "\\partial": "∂", "\\psi": "ψ", "\\Psi": "Ψ", "\\phi": "φ",
      "\\theta": "θ", "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\mu": "μ",
      "\\sigma": "σ", "\\Omega": "Ω", "\\varphi": "φ", "\\varepsilon": "ε",
      "\\lambda": "λ", "\\pi": "π", "\\times": "×", "\\cdot": "·", "\\rightarrow": "→",
      "\\Rightarrow": "⇒", "\\Longleftrightarrow": "⟷", "\\langle": "⟨", "\\rangle": "⟩",
      "\\geq": "≥", "\\leq": "≤", "\\gg": "≫", "\\ll": "≪", "\\approx": "≈",
      "\\hat": "", "\\vec": "", "\\mathbb": "", "\\left": "", "\\right": "",
      "\\dots": "…", "\\quad": "  ",
      "\\qquad": "   ", "\\,": " ", "\\;": " ", "\\!": "", "\\text": "", "\\mathrm": "",
      "\\sum": "Σ", "\\int": "∫", "\\infty": "∞", "_": "", "^": "^", "{": "", "}": ""
    };
    for (const k in map) s = s.split(k).join(map[k]);
    return s.replace(/\s+/g, " ").trim();
  }

  /* render LaTeX into an element. display = block vs inline */
  function render(el, tex, display) {
    if (!el) return;
    if (katexReady()) {
      try {
        window.katex.render(tex, el, {
          displayMode: !!display,
          throwOnError: false,
          errorColor: "#fb7185"
        });
        return;
      } catch (e) { /* fall through to text */ }
    }
    el.classList.add("tex-fallback");
    el.textContent = latexToText(tex);
  }

  /* return an HTML string (used where we build markup as strings) */
  function renderToString(tex, display) {
    if (katexReady()) {
      try {
        return window.katex.renderToString(tex, {
          displayMode: !!display, throwOnError: false, errorColor: "#fb7185"
        });
      } catch (e) { /* fall through */ }
    }
    return '<span class="tex-fallback">' + latexToText(tex) + "</span>";
  }

  window.TeX = { render: render, renderToString: renderToString, available: katexReady };
})();
