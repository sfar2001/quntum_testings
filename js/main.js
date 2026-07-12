/* ============================================================================
 *  MAIN.JS  —  shared UI, tab routing, Equation Library, bootstrap
 * ========================================================================== */
(function () {
  "use strict";
  const KN = window.KNOWLEDGE;

  const PROV_LABEL = {
    "in-text": "printed in paper",
    "in-text-prose": "described in prose",
    "standard-supplied": "standard physics (not in PDF)",
    "web-sourced": "verified on the web (2025–26)"
  };

  /* ---------- shared equation-card renderer (used by all three views) ---- */
  function eqCardHTML(node){
    const dom = KN.domains[node.domain];
    const eq = node.latex
      ? window.TeX.renderToString(node.latex, true)
      : '<span style="color:var(--text-faint)">— conceptual (no single equation) —</span>';
    let vars = "";
    if(node.variables && node.variables.length){
      vars = '<div class="vars">' + node.variables.map(v =>
        "<div><b>" + window.TeX.renderToString(v[0], false) + "</b> &nbsp;" + esc(v[1]) + "</div>"
      ).join("") + "</div>";
    }
    const srcs = (node.sources || [node.source]);
    const srcHTML = srcs.map(sid => {
      const s = KN.sources[sid];
      return '<span class="src" data-src="' + sid + '">📄 ' + esc(shorten(s.title,30)) + "</span>";
    }).join("");

    return '<div class="eq-card" style="border-left-color:' + dom.color + '">' +
      '<div class="eq-head"><span class="eq-name">' + esc(node.name) + '</span>' +
        '<span class="badge" style="color:' + dom.color + ';background:' + hexA(dom.color,0.13) + '">' + esc(dom.label) + '</span>' +
        '<button class="eq-nb" title="copy to 📓 Notebook" data-latex="' + esc(node.latex||"") + '" data-name="' + esc(node.name) + '">📓</button>' +
        '<button class="eq-combine" title="Combine in 📓 — auto-suggests compatible equations" data-id="' + esc(node.id||"") + '">⚗</button></div>' +
      '<div class="katex-host">' + eq + '</div>' +
      '<div class="behaviour">' + esc(node.behaviour) + '</div>' +
      vars +
      workedHTML(node.id) +
      '<div class="meta">' + srcHTML +
        '<span class="prov ' + node.provenance + '">' + PROV_LABEL[node.provenance] + '</span>' +
      '</div>' +
    '</div>';
  }

  /* expandable "worked example" (from js/worked-examples.js), rendered as a native <details> */
  function workedHTML(id){
    const W = window.WORKED_EXAMPLES && window.WORKED_EXAMPLES[id];
    if(!W) return "";
    const steps = (W.steps||[]).map(s=>'<div class="we-step">'+esc(s)+'</div>').join("");
    return '<details class="eq-worked"><summary>▸ Worked example — plug in the numbers</summary>' +
      '<div class="we-given"><b>Given:</b> '+esc(W.given||"")+'</div>' +
      '<div class="we-steps">'+steps+'</div>' +
      '<div class="we-result"><b>Result:</b> '+esc(W.result||"")+'</div>' +
      (W.insight?'<div class="we-insight">'+esc(W.insight)+'</div>':'') +
    '</details>';
  }

  function renderEqCardsInto(container, nodeIds){
    if(!container) return;
    container.innerHTML = nodeIds.map(id => {
      const n = KN.byId[id]; return n ? eqCardHTML(n) : "";
    }).join("");
    // wire source pills -> jump to network
    container.querySelectorAll(".src").forEach(el=>{
      el.onclick = () => { switchView("net"); if(window.Network) window.Network.focusNode(el.dataset.src); };
    });
    wireNotebookButtons(container);
  }

  function wireNotebookButtons(container){
    container.querySelectorAll(".eq-nb").forEach(el=>{
      el.onclick = (e) => { e.stopPropagation(); if(window.Notebook) window.Notebook.addEquation(el.dataset.latex, el.dataset.name); };
    });
    container.querySelectorAll(".eq-combine").forEach(el=>{
      el.onclick = (e) => { e.stopPropagation(); if(window.Notebook && el.dataset.id) window.Notebook.addCoupling(el.dataset.id); };
    });
  }

  window.UI = { eqCardHTML, renderEqCardsInto };

  /* ---------- tab routing ---------- */
  function switchView(view){
    document.querySelectorAll("nav.tabs button").forEach(b=>b.classList.toggle("active", b.dataset.view===view));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    document.getElementById("view-"+view).classList.add("active");
    if(view==="lab" && window.AtomLab) window.AtomLab._resize();
    if(view==="net" && window.Network) window.Network.activate();
    if(view==="net" && window.Brain) window.Brain.activate();
    if(view==="sim" && window.AtomSim) window.AtomSim.activate();
    if(view==="notebook" && window.Notebook) window.Notebook.activate();
    if(view==="demos" && window.Demos) window.Demos.activate();
    if(view!=="demos" && window.Demos) window.Demos.deactivate();
    if(view==="quantum" && window.QuantumBoard) window.QuantumBoard.activate();
    if(view!=="ptable" && window.PeriodicSim && window.PeriodicSim.deactivate) window.PeriodicSim.deactivate();
  }
  window.switchView = switchView;

  /* ---------- Equation Library ---------- */
  function buildLibrary(){
    // source strip
    const strip=document.getElementById("srcStrip"); strip.innerHTML="";
    Object.keys(KN.sources).forEach(sid=>{
      const s=KN.sources[sid];
      const p=document.createElement("span"); p.className="src-pill";
      p.innerHTML="<b>"+esc(s.title)+"</b>";
      p.style.cursor="pointer";
      p.onclick=()=>{ switchView("net"); if(window.Network) window.Network.focusNode(sid); };
      strip.appendChild(p);
    });

    // filters
    const filt=document.getElementById("libFilters"); filt.innerHTML="";
    const mkBtn=(key,label,color)=>{
      const b=document.createElement("button"); b.textContent=label; b.dataset.dom=key;
      if(color){ b.style.borderColor=hexA(color,0.5); }
      b.onclick=()=>{ [...filt.children].forEach(c=>c.classList.remove("active")); b.classList.add("active"); renderGrid(key); };
      return b;
    };
    const allB=mkBtn("all","All ("+KN.nodes.length+")"); allB.classList.add("active"); filt.appendChild(allB);
    for(const d in KN.domains){
      const cnt=KN.nodes.filter(n=>n.domain===d).length;
      filt.appendChild(mkBtn(d, KN.domains[d].label+" ("+cnt+")", KN.domains[d].color));
    }
    renderGrid("all");
  }
  function renderGrid(dom){
    const grid=document.getElementById("libGrid");
    const list = dom==="all" ? KN.nodes : KN.nodes.filter(n=>n.domain===dom);
    grid.innerHTML = list.map(n=>eqCardHTML(n)).join("");
    grid.querySelectorAll(".src").forEach(el=>{
      el.onclick=()=>{ switchView("net"); if(window.Network) window.Network.focusNode(el.dataset.src); };
    });
    wireNotebookButtons(grid);
  }

  /* ---------- helpers ---------- */
  function esc(s){ return String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
  function shorten(s,n){ return s.length>n ? s.slice(0,n-1)+"…" : s; }
  function hexA(hex,a){ const c=hex.replace("#",""); const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
    return "rgba("+r+","+g+","+b+","+a+")"; }

  /* ---------- bootstrap (after KaTeX deferred script + DOM are ready) ---- */
  function boot(){
    // tab buttons
    document.querySelectorAll("nav.tabs button").forEach(b=>{
      b.onclick=()=>switchView(b.dataset.view);
    });
    if(!window.TeX.available()){
      document.getElementById("texWarn").classList.add("show");
    }
    window.AtomLab.init();
    window.Network.init();
    if(window.Brain) window.Brain.init();
    if(window.Demos) window.Demos.init();
    buildLibrary();
  }

  if(document.readyState==="complete") boot();
  else window.addEventListener("load", boot);
})();
