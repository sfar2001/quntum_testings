/* ============================================================================
 *  PERIODIC-SIM.JS  —  the deep element inspector
 *  A tabbed panel that opens when you click an element in the Periodic Table:
 *    Overview · Phases & heat · Zoom to quarks · Motion & momentum ·
 *    Radioactivity · All equations applied.
 *  Uses window.ELEMENT_EXTRAS (phase/thermo/nuclear data), window.ElementPhysics
 *  (numeric engine), window.PERIODIC_DATA (per-atom computed equations),
 *  window.KNOWLEDGE + window.TeX (equation rendering).
 *  Exposes: window.PeriodicSim = { show }
 * ========================================================================== */
(function () {
  "use strict";

  const CAT_COLOR = {
    "Alkali metal": "#f87171", "Alkaline earth metal": "#fb923c", "Transition metal": "#fbbf24",
    "Post-transition metal": "#4ade80", "Metalloid": "#2dd4bf", "Reactive nonmetal": "#38bdf8",
    "Noble gas": "#a78bfa", "Lanthanide": "#f472b6", "Actinide": "#e879f9", "Unknown": "#94a3b8"
  };
  const DOMAIN_COLOR = { classical:"#f5a623", quantum:"#22d3ee", "quantum-info":"#a78bfa", spin:"#f472b6",
    relativistic:"#34d399", molecular:"#60a5fa", forces:"#fb7185", acoustics:"#eab308", bonding:"#fb923c",
    entanglement:"#e879f9", algorithms:"#2dd4bf", hardware:"#94a3b8", optics:"#fcd34d", thermal:"#a3e635",
    particle:"#ef4444", nuclear:"#0ea5e9", em:"#3b82f6" };
  const DOMAIN_LABEL = (window.KNOWLEDGE && window.KNOWLEDGE.domains) || {};
  const PHASE_COLOR = { solid:"#60a5fa", liquid:"#2dd4bf", gas:"#f472b6", unknown:"#94a3b8" };

  let cur = null;            // {p,e,x,color,Z,N,A,maxZ}
  let activeTab = "overview";
  let anim = null;           // {raf}
  let fullPage = false;      // full-page (grid hidden) mode — persists across elements
  function stopAnim(){ if (anim){ cancelAnimationFrame(anim.raf); anim = null; } }

  const EP = () => window.ElementPhysics;
  function esc(s){ return String(s).replace(/[&<>"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }
  function num(v, d){ if (v==null||!isFinite(v)) return "—"; const a=Math.abs(v);
    if (a!==0 && (a<1e-3||a>=1e6)) return v.toExponential(d==null?2:d);
    return String(Number(v.toPrecision(d==null?4:d))); }
  function K2C(k){ return k==null ? null : k - 273.15; }

  /* ---------- entry ---------- */
  function show(p) {
    stopAnim();
    const e = p.element, Z = e.atomicNumber;
    const x = (window.ELEMENT_EXTRAS || {})[Z] || (window.ELEMENT_EXTRAS || {})[String(Z)] || null;
    const A = (x && x.mostCommonA) || Math.round(e.atomicMass);
    const maxZ = (window.PeriodicTable && window.PeriodicTable.maxZ) ? window.PeriodicTable.maxZ() : 118;
    cur = { p, e, x, Z, A, N: A - Z, maxZ: maxZ, color: CAT_COLOR[e.category] || "#94a3b8" };

    const panel = document.getElementById("ptableDetail");
    if (!panel) return;
    panel.innerHTML = navHTML() + headerHTML() + tabBarHTML() + '<div class="pt-tabbody" id="ptTabBody"></div>';
    wireNav(panel);
    panel.querySelectorAll(".pt-tab").forEach(b => b.onclick = () => selectTab(b.dataset.tab));
    selectTab(TABS[activeTab] ? activeTab : "overview");
    panel.scrollTop = 0;
  }

  /* ---------- navigation bar: prev / next · search · full-page ---------- */
  function navHTML(){
    const hasPrev = cur.Z > 1, hasNext = cur.Z < cur.maxZ;
    return '<div class="pt-nav">' +
      '<button class="pt-navbtn" id="ptPrev"' + (hasPrev?'':' disabled') + ' title="previous element (←)">◀ Prev</button>' +
      '<button class="pt-navbtn" id="ptNext"' + (hasNext?'':' disabled') + ' title="next element (→)">Next ▶</button>' +
      '<input class="pt-navsearch" id="ptNavSearch" list="ptNavList" autocomplete="off" placeholder="🔍 jump to element — name, symbol or Z… ↵">' +
      '<datalist id="ptNavList"></datalist>' +
      '<button class="pt-navbtn pt-fp" id="ptFull">' + (fullPage ? '◱ Show table' : '⤢ Full page') + '</button>' +
      '</div>';
  }
  function wireNav(panel){
    const prev = panel.querySelector("#ptPrev"), next = panel.querySelector("#ptNext"),
          full = panel.querySelector("#ptFull"), search = panel.querySelector("#ptNavSearch"),
          dl = panel.querySelector("#ptNavList");
    if (prev) prev.onclick = () => navTo(-1);
    if (next) next.onclick = () => navTo(1);
    if (full) full.onclick = () => { setFull(!fullPage); if(full) full.textContent = fullPage ? '◱ Show table' : '⤢ Full page'; };
    if (search){
      const go = () => { const v = search.value.trim(); if (v && window.PeriodicTable && window.PeriodicTable.search) window.PeriodicTable.search(v); };
      search.onkeydown = (e) => { if (e.key === "Enter") go(); };
      search.onchange = go;
    }
    if (dl && window.PERIODIC_DATA) dl.innerHTML = window.PERIODIC_DATA.map(q =>
      '<option value="' + esc(q.element.name) + '">' + esc(q.element.symbol) + " · " + q.element.atomicNumber + "</option>").join("");
    // keyboard arrows (bound on the panel, cleared each rebuild)
    panel.onkeydown = (e) => { if (e.target && e.target.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") navTo(-1); else if (e.key === "ArrowRight") navTo(1); };
    setFull(fullPage);  // re-apply persisted full-page state on every element
  }
  function navTo(dz){
    const z = cur.Z + dz;
    if (z < 1 || z > cur.maxZ) return;
    if (window.PeriodicTable && window.PeriodicTable.select) window.PeriodicTable.select(z);
  }
  function ptWrap(){ const el = document.getElementById("ptableDetail"); return el ? el.closest(".pt-wrap") : null; }
  function setFull(on){ fullPage = on; const w = ptWrap(); if (w) w.classList.toggle("pt-fullpage", on); }

  function headerHTML() {
    const e = cur.e, x = cur.x;
    const phase = x ? x.phaseSTP : "—";
    const pc = PHASE_COLOR[phase] || "#94a3b8";
    return '<div class="pt-d-head" style="--cat:' + cur.color + '">' +
      '<div class="pt-d-sym">' + esc(e.symbol) + '</div>' +
      '<div class="pt-d-id"><div class="pt-d-name">' + esc(e.name) +
        ' <span class="pt-phase-badge" style="--pc:' + pc + '">' + esc(phase) + ' @ 25°C</span></div>' +
      '<div class="pt-d-sub">Z = ' + e.atomicNumber + ' · ' + num(e.atomicMass,5) + ' u · ' +
      esc(e.category) + ' · period ' + e.period + ' · group ' + esc(String(e.group)) +
      ' · ' + cur.Z + 'p + ' + cur.N + 'n</div></div></div>';
  }

  const TAB_ORDER = ["overview","phases","zoom","motion","radio","equations"];
  const TAB_LABEL = { overview:"Overview", phases:"Phases & heat", zoom:"Zoom → quarks",
    motion:"Motion & momentum", radio:"Radioactivity", equations:"All equations" };
  function tabBarHTML(){
    return '<div class="pt-tabs">' + TAB_ORDER.map(t =>
      '<button class="pt-tab' + (t===activeTab?" sel":"") + '" data-tab="' + t + '">' + TAB_LABEL[t] + '</button>'
    ).join("") + '</div>';
  }
  function selectTab(t){
    stopAnim();
    activeTab = t;
    document.querySelectorAll(".pt-tab").forEach(b => b.classList.toggle("sel", b.dataset.tab===t));
    const body = document.getElementById("ptTabBody");
    if (body && TABS[t]) TABS[t](body);
  }

  /* ---------- shared canvas helper ---------- */
  function mkCanvas(host, h){
    const wrap = document.createElement("div"); wrap.className = "pt-canvas-wrap";
    const c = document.createElement("canvas"); wrap.appendChild(c); host.appendChild(wrap);
    const W = Math.max(240, host.clientWidth - 4), H = h || 280;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    c.width = W*DPR; c.height = H*DPR; c.style.width = W+"px"; c.style.height = H+"px";
    const ctx = c.getContext("2d"); ctx.setTransform(DPR,0,0,DPR,0,0);
    return { c, ctx, W, H };
  }
  function loop(fn){ let t0=null; function step(ts){ if(t0==null)t0=ts; const t=(ts-t0)/1000; fn(t); anim={raf:requestAnimationFrame(step)}; } anim={raf:requestAnimationFrame(step)}; }
  function arrow(ctx,x1,y1,x2,y2,col,w){ const a=Math.atan2(y2-y1,x2-x1),hd=5+w; ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=w;
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-hd*Math.cos(a-0.4),y2-hd*Math.sin(a-0.4));ctx.lineTo(x2-hd*Math.cos(a+0.4),y2-hd*Math.sin(a+0.4));ctx.closePath();ctx.fill(); }

  /* ================= OVERVIEW ================= */
  function renderOverview(body){
    const p = cur.p, x = cur.x;
    let h = '<div class="pt-d-struct">' +
      kv("Electron configuration", '<span class="mono">' + esc(p.electronConfiguration||"—") + '</span>') +
      kv("Shell occupancy", "[" + (p.shellOccupancy||[]).join(", ") + "]") +
      kv("Valence electrons", p.valenceElectrons) +
      kv("Unpaired electrons", p.unpairedElectrons) +
      (x ? kv("Oxidation states", esc(x.oxidationStates||"—")) : "") +
      (x ? kv("Electronegativity (Pauling)", x.electroneg_pauling!=null ? x.electroneg_pauling : "none") : "") +
      (x ? kv("1st ionization energy", num(x.ionizationE1_eV,4) + " eV") : "") +
      (x ? kv("Atomic radius", num(x.atomicRadius_pm,3) + " pm") : "") +
      (x ? kv("Density (STP)", num(x.densitySTP_g_cm3,3) + " g/cm³") : "") +
      (x ? kv("Discovered", esc(String(x.discoveredYear!=null?x.discoveredYear:"—"))) : "") +
      '</div>';
    h += secHTML("Classical — Bohr orbit", p.classical, DOMAIN_COLOR.classical);
    h += secHTML("Quantum — Schrödinger", p.quantum, DOMAIN_COLOR.quantum);
    h += secHTML("Molecular / spin cluster", p.molecular, DOMAIN_COLOR.molecular);
    body.innerHTML = h;
  }

  /* ================= PHASES & HEAT ================= */
  function renderPhases(body){
    const x = cur.x;
    if (!x){ body.innerHTML = '<p class="placeholder">No phase data for this element.</p>'; return; }
    const mc = K2C(x.meltK), bc = K2C(x.boilK);
    let h = '<div class="pt-d-struct">' +
      kv("Phase at 25°C", '<b style="color:' + (PHASE_COLOR[x.phaseSTP]) + '">' + esc(x.phaseSTP) + '</b>') +
      kv("Melting point", x.meltK!=null ? (num(x.meltK,5)+" K  ("+num(mc,4)+" °C)") : (x.sublimes?"sublimes":"—")) +
      kv("Boiling point", x.boilK!=null ? (num(x.boilK,5)+" K  ("+num(bc,4)+" °C)") : (x.sublimes?"sublimes":"—")) +
      kv("Heat of fusion ΔH<sub>fus</sub>", x.dHfus_kJmol!=null ? num(x.dHfus_kJmol,4)+" kJ/mol" : "—") +
      kv("Heat of vaporization ΔH<sub>vap</sub>", x.dHvap_kJmol!=null ? num(x.dHvap_kJmol,4)+" kJ/mol" : "—") +
      kv("Molar heat capacity", x.molarHeat_J_molK!=null ? num(x.molarHeat_J_molK,4)+" J/mol·K" : "—") +
      '</div>';
    // block 0: heat calculator
    h += '<div class="pt-sim-block"><h4>How much heat to melt & boil it?</h4>' +
      '<div class="pt-ctl-row"><label>Sample: <input id="phMol" type="number" value="1" min="0" step="any" style="width:70px"> mol' +
      ' <span class="pt-dim">(= ' + num(cur.e.atomicMass,4) + ' g)</span></label></div>' +
      '<div id="phHeatOut" class="pt-heat-out"></div></div>';
    // block 1: temperature slider + live phase particles
    const tmax = Math.round((x.boilK ? x.boilK*1.25 : (x.meltK? x.meltK*1.5 : 500)) + 20);
    h += '<div class="pt-sim-block"><h4>Watch the phase change — drag the temperature</h4>' +
      '<div class="pt-ctl-row"><input id="phT" type="range" min="1" max="' + tmax + '" value="' + Math.min(298, tmax) + '">' +
      '<span id="phTlab" class="pt-tlab"></span></div></div>';
    body.innerHTML = h;

    const blocks = body.querySelectorAll(".pt-sim-block");
    const heatBlock = blocks[0], tempBlock = blocks[1];
    const molIn = body.querySelector("#phMol"), heatOut = body.querySelector("#phHeatOut");

    // heating-curve block, inserted right after the heat calculator
    const cvBlock = document.createElement("div"); cvBlock.className = "pt-sim-block";
    cvBlock.innerHTML = '<h4>Heating curve — temperature vs energy added</h4>';
    heatBlock.after(cvBlock);
    const heatCurve = mkCanvas(cvBlock, 200);

    function drawHeatCurve(r){
      const ctx = heatCurve.ctx, W = heatCurve.W, H = heatCurve.H;
      ctx.clearRect(0,0,W,H);
      const pad=36, curve=r.curve; if(!curve || !curve.length) return;
      const maxQ=Math.max(1e-9, r.total_kJ), maxT=Math.max.apply(null, curve.map(c=>c.T))*1.05;
      const X=q=>pad+(W-pad-10)*(q/maxQ), Y=T=>H-24-(H-32)*(T/maxT);
      ctx.strokeStyle="rgba(148,163,184,.4)"; ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(pad,8);ctx.lineTo(pad,H-24);ctx.lineTo(W-6,H-24);ctx.stroke();
      ctx.fillStyle="#93a2bd"; ctx.font="10px Inter,system-ui,sans-serif"; ctx.textAlign="center";
      ctx.fillText("energy added (kJ) →", W/2, H-6);
      ctx.save(); ctx.translate(11,H/2); ctx.rotate(-Math.PI/2); ctx.fillText("T (K)",0,0); ctx.restore();
      for(let i=1;i<curve.length;i++){ const a=curve[i-1], b=curve[i];
        ctx.strokeStyle=PHASE_COLOR[b.phase]||"#67e8f9"; ctx.lineWidth=2.4;
        ctx.beginPath(); ctx.moveTo(X(a.Q),Y(a.T)); ctx.lineTo(X(b.Q),Y(b.T)); ctx.stroke();
        if(b.event && b.event.indexOf("done")>=0){ ctx.fillStyle="#e6edf7"; ctx.beginPath(); ctx.arc(X(b.Q),Y(b.T),2.6,0,7); ctx.fill(); }
      }
    }
    function row(lbl, kJ, tag){ return '<tr><td>' + lbl + (tag?' <span class="pt-dim">'+tag+'</span>':'') +
      '</td><td class="pt-heat-q">' + num(kJ,4) + ' kJ</td></tr>'; }
    function recalcHeat(){
      const moles = Math.max(0, parseFloat(molIn.value)||0);
      const r = EP().heating(x, moles), m = r.milestones;
      let out = '<table class="pt-heat-tbl">';
      if (m.reachMelt_kJ!=null) out += row("Warm solid to melting point", m.reachMelt_kJ);
      if (m.fullyLiquid_kJ!=null) out += row("…then fully melt (latent heat)", m.fullyLiquid_kJ, "→ fully liquid");
      if (m.reachBoil_kJ!=null) out += row("…warm liquid to boiling point", m.reachBoil_kJ);
      if (m.fullyGas_kJ!=null) out += row("…then fully boil (latent heat)", m.fullyGas_kJ, "→ fully gas");
      out += '</table>';
      heatOut.innerHTML = out;
      drawHeatCurve(r);
    }
    molIn.oninput = recalcHeat;
    recalcHeat();

    // live particle box driven by the temperature slider
    const Tin = body.querySelector("#phT"), Tlab = body.querySelector("#phTlab");
    const box = mkCanvas(tempBlock, 220);
    const parts = makeParticles(46, box.W, box.H);
    function updLab(){ const T=+Tin.value, ph=EP().phaseAt(x,T);
      Tlab.innerHTML = T + " K  (" + num(T-273.15,3) + " °C) — <b style='color:"+PHASE_COLOR[ph]+"'>" + ph + "</b>"; }
    Tin.oninput = updLab; updLab();
    loop(function(){ drawPhaseBox(box, parts, EP().phaseAt(x, +Tin.value), +Tin.value); });
  }

  /* particle box that arranges/jiggles atoms according to the current phase */
  function drawPhaseBox(cv, parts, phase, T){
    const ctx=cv.ctx, W=cv.W, H=cv.H; ctx.clearRect(0,0,W,H);
    ctx.strokeStyle="rgba(148,163,184,.25)"; ctx.strokeRect(1,1,W-2,H-2);
    const jig = Math.min(1, T/1500);
    if (phase==="solid"){
      const cols=9, rows=5, sx=W/(cols+1), sy=H/(rows+1);
      for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
        const px=sx*(i+1)+Math.sin(performance.now()/300+i+j)*jig*4;
        const py=sy*(j+1)+Math.cos(performance.now()/300+i)*jig*4;
        dot(ctx,px,py,7,cur.color);
      }
    } else if (phase==="liquid"){
      parts.forEach(p=>{ p.x+=p.vx*jig*1.2; p.y+=p.vy*jig*1.2;
        if(p.x<8||p.x>W-8)p.vx*=-1; if(p.y<8||p.y>H-8)p.vy*=-1;
        p.x=Math.max(8,Math.min(W-8,p.x)); p.y=Math.max(8,Math.min(H-8,p.y));
        dot(ctx,p.x,p.y,6,cur.color); });
    } else if (phase==="gas"){
      parts.forEach(p=>{ p.x+=p.vx*(2+jig*4); p.y+=p.vy*(2+jig*4);
        if(p.x<6||p.x>W-6)p.vx*=-1; if(p.y<6||p.y>H-6)p.vy*=-1;
        p.x=Math.max(6,Math.min(W-6,p.x)); p.y=Math.max(6,Math.min(H-6,p.y));
        dot(ctx,p.x,p.y,4.5,cur.color); });
    } else {
      txt(ctx,"phase unknown",W/2,H/2,"#94a3b8");
    }
    txt(ctx, phase+" · "+T+" K", W/2, 13, "#93a2bd", 11);
  }

  /* ================= ZOOM TO QUARKS ================= */
  const ZOOM_STAGES = [
    { name:"Bulk sample", scale:"~1 mm  (10⁻³ m)", note:"A chunk of the material — atoms packed as its phase (solid lattice / liquid / gas)." },
    { name:"Atoms & bonds", scale:"~1 nm  (10⁻⁹ m)", note:"Individual atoms, arranged and bonded — a few nanometres across." },
    { name:"One atom", scale:"~100 pm  (10⁻¹⁰ m)", note:"A single atom: a tiny nucleus wrapped in electron shells / the probability cloud." },
    { name:"The nucleus", scale:"~5 fm  (10⁻¹⁴ m)", note:"The dense core — protons (red) and neutrons (blue) bound by the strong force." },
    { name:"One nucleon", scale:"~1 fm  (10⁻¹⁵ m)", note:"A single proton — itself not fundamental, but a bag of quarks." },
    { name:"Quarks & gluons", scale:"~0.1 fm  (10⁻¹⁶ m)", note:"The proton = u u d, glued by gluons. The deepest layer we can draw." }
  ];
  function renderZoom(body){
    const x = cur.x, p = cur.p;
    body.innerHTML = '<div class="pt-sim-block"><h4>Zoom from the bulk material down to the quarks</h4>' +
      '<div class="pt-ctl-row"><button id="zOut" class="pt-zbtn">− out</button>' +
      '<input id="zSlider" type="range" min="0" max="5" step="0.01" value="0">' +
      '<button id="zIn" class="pt-zbtn">in +</button></div>' +
      '<div id="zLabel" class="pt-zoom-label"></div></div>';
    const blk = body.querySelector(".pt-sim-block");
    const cv = mkCanvas(blk, 320);
    const sl = body.querySelector("#zSlider"), lab = body.querySelector("#zLabel");
    body.querySelector("#zIn").onclick = () => { sl.value = Math.min(5, (+sl.value)+0.5); };
    body.querySelector("#zOut").onclick = () => { sl.value = Math.max(0, (+sl.value)-0.5); };
    function updLab(){ const st = ZOOM_STAGES[Math.round(+sl.value)];
      lab.innerHTML = '<b>' + st.name + '</b> · <span class="pt-scale">' + st.scale + '</span><br><span class="pt-dim">' + st.note + '</span>'; }
    sl.oninput = updLab; updLab();
    loop(function(t){ drawZoom(cv, +sl.value, t, p, x); });
  }
  function drawZoom(cv, z, t, p, x){
    const ctx=cv.ctx, W=cv.W, H=cv.H, cx=W/2, cy=H/2;
    ctx.clearRect(0,0,W,H);
    const stage = Math.round(z), frac = z - Math.floor(z), lower = Math.floor(z);
    // draw current (rounded) stage; blend a hint of the neighbour near the boundary
    drawStage(ctx,W,H,cx,cy,stage,t,p,x,1);
    if (lower < 5 && frac > 0.6 && Math.round(z) === lower){ ctx.save(); ctx.globalAlpha=(frac-0.6)/0.4*0.5; drawStage(ctx,W,H,cx,cy,lower+1,t,p,x,0.7); ctx.restore(); }
  }
  function drawStage(ctx,W,H,cx,cy,stage,t,p,x,alpha){
    ctx.save(); ctx.globalAlpha = alpha;
    const col = cur.color;
    if (stage<=0){ // bulk
      const phase = x? x.phaseSTP : "solid";
      const cols=10, rows=7, sp=Math.min(W/(cols+1),H/(rows+1));
      for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
        let ox=0,oy=0;
        if(phase==="gas"){ ox=Math.sin(t*2+i*3+j)*sp*0.6; oy=Math.cos(t*1.7+j*2+i)*sp*0.6; }
        else if(phase==="liquid"){ ox=Math.sin(t*1.5+i+j)*sp*0.28; oy=Math.cos(t*1.3+i*2)*sp*0.28; }
        else { ox=Math.sin(t*3+i+j)*1.4; oy=Math.cos(t*3+i)*1.4; }
        const px=(W-cols*sp)/2+sp*0.5+i*sp+ox, py=(H-rows*sp)/2+sp*0.5+j*sp+oy;
        dot(ctx,px,py,sp*0.28,col);
      }
      txt(ctx,"~10²³ atoms",cx,H-14,"#93a2bd");
    } else if (stage===1){ // atoms & bonds (lattice)
      const n=4, sp=Math.min(W,H)/(n+1);
      const pts=[];
      for(let i=0;i<n;i++)for(let j=0;j<n;j++){ const px=(W-(n-1)*sp)/2+i*sp+Math.sin(t*2+i+j)*2, py=(H-(n-1)*sp)/2+j*sp+Math.cos(t*2+i)*2; pts.push([px,py]); }
      ctx.strokeStyle="rgba(148,163,184,.35)"; ctx.lineWidth=2;
      pts.forEach((a,i)=>pts.forEach((b,j)=>{ if(j>i){ const d=Math.hypot(a[0]-b[0],a[1]-b[1]); if(d<sp*1.3){ ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke(); } } }));
      pts.forEach(a=>{ glow(ctx,a[0],a[1],sp*0.34,col); txt(ctx,cur.e.symbol,a[0],a[1],"#0b1020",11); });
    } else if (stage===2){ // one atom: nucleus + shells
      const shells = p.shellOccupancy || [2];
      const rmax = Math.min(W,H)*0.42;
      shells.forEach((occ,si)=>{
        const r=rmax*(si+1)/shells.length;
        ctx.strokeStyle="rgba(148,163,184,.3)"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.stroke();
        for(let k=0;k<occ;k++){ const a=t*(1.2-si*0.12)+k/occ*Math.PI*2; const ex=cx+Math.cos(a)*r, ey=cy+Math.sin(a)*r;
          dot(ctx,ex,ey,3.4,"#38bdf8"); }
      });
      glow(ctx,cx,cy,16,cur.color); txt(ctx,cur.e.symbol,cx,cy,"#0b1020",13);
      txt(ctx,"nucleus + "+shells.reduce((a,b)=>a+b,0)+" electrons in "+shells.length+" shells",cx,H-14,"#93a2bd");
    } else if (stage===3){ // nucleus: protons + neutrons
      const Z=cur.Z, N=cur.N, tot=Z+N, R=Math.min(W,H)*0.34;
      // deterministic-ish placement in a disk
      for(let i=0;i<tot;i++){ const a=i*2.399963, r=R*Math.sqrt((i+0.5)/tot); const px=cx+Math.cos(a+t*0.2)*r, py=cy+Math.sin(a+t*0.2)*r;
        dot(ctx,px,py,Math.max(3,R*0.12), i<Z?"#f87171":"#60a5fa"); }
      txt(ctx,Z+" protons + "+N+" neutrons  (A="+cur.A+")",cx,H-14,"#93a2bd");
      legend(ctx,W,"#f87171","proton","#60a5fa","neutron");
    } else if (stage===4){ // one nucleon
      glow(ctx,cx,cy,Math.min(W,H)*0.3,"#f87171");
      for(let i=0;i<3;i++){ const a=t*0.7+i*2.094, r=Math.min(W,H)*0.12; dot(ctx,cx+Math.cos(a)*r,cy+Math.sin(a)*r,7,["#f87171","#fbbf24","#60a5fa"][i]); }
      txt(ctx,"one proton — a bag of 3 quarks",cx,H-14,"#93a2bd");
    } else { // quarks
      const qs=[{n:"u",c:"#f87171"},{n:"u",c:"#fbbf24"},{n:"d",c:"#60a5fa"}];
      const pos=qs.map((q,i)=>{ const a=t*0.8+i*2.094, r=Math.min(W,H)*0.22*(1+0.12*Math.sin(t*1.4+i)); return {x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,q}; });
      ctx.strokeStyle="rgba(245,158,11,.8)"; ctx.lineWidth=2;
      for(let i=0;i<3;i++){ spring(ctx,pos[i].x,pos[i].y,pos[(i+1)%3].x,pos[(i+1)%3].y,t,6); }
      pos.forEach(o=>{ glow(ctx,o.x,o.y,16,o.q.c); txt(ctx,o.q.n,o.x,o.y,"#0b1020",13); });
      txt(ctx,"proton = u u d  (glued by gluons)",cx,H-14,"#93a2bd");
    }
    ctx.restore();
  }
  function spring(ctx,x1,y1,x2,y2,t,amp){ const seg=14,dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
    ctx.beginPath(); for(let i=0;i<=seg;i++){ const u=i/seg,bx=x1+dx*u,by=y1+dy*u,o=Math.sin(u*Math.PI*6+t*4)*amp*Math.sin(u*Math.PI); (i===0?ctx.moveTo:ctx.lineTo).call(ctx,bx+nx*o,by+ny*o); } ctx.stroke(); }
  function dot(ctx,x,y,r,c){ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); }
  function glow(ctx,x,y,r,c){ const g=ctx.createRadialGradient(x,y,1,x,y,r); g.addColorStop(0,"#fff"); g.addColorStop(0.5,c); g.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); }
  function txt(ctx,s,x,y,c,size){ ctx.fillStyle=c; ctx.font=(size||11)+"px Inter,system-ui,sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(s,x,y); ctx.textBaseline="alphabetic"; }
  function legend(ctx,W,c1,l1,c2,l2){ ctx.textAlign="left"; ctx.font="10px Inter,system-ui,sans-serif";
    ctx.fillStyle=c1; ctx.beginPath();ctx.arc(14,16,4,0,7);ctx.fill(); ctx.fillStyle="#93a2bd"; ctx.fillText(l1,22,19);
    ctx.fillStyle=c2; ctx.beginPath();ctx.arc(70,16,4,0,7);ctx.fill(); ctx.fillStyle="#93a2bd"; ctx.fillText(l2,78,19); }

  /* ================= MOTION & MOMENTUM ================= */
  function renderMotion(body){
    const x = cur.x, A = cur.e.atomicMass;
    body.innerHTML = '<div class="pt-sim-block"><h4>Kinetic theory — thermal motion & momentum</h4>' +
      '<p class="pt-dim">Atoms jiggle with a Maxwell–Boltzmann spread of speeds. Hotter = faster. ' +
      'Arrows are momentum vectors p = m·v.</p>' +
      '<div class="pt-ctl-row"><label>Temperature <input id="moT" type="range" min="10" max="3000" value="300"></label><span id="moTlab" class="pt-tlab"></span></div>' +
      '<div id="moStats" class="pt-stats"></div></div>';
    const blk = body.querySelector(".pt-sim-block");
    const cv = mkCanvas(blk, 240);
    const Tin = body.querySelector("#moT"), Tlab = body.querySelector("#moTlab"), stats = body.querySelector("#moStats");
    const parts = makeParticles(34, cv.W, cv.H);
    function upd(){ const T=+Tin.value; const s=EP().speeds(A,T);
      Tlab.textContent = T + " K";
      stats.innerHTML =
        '<span>v<sub>rms</sub> = <b>' + num(s.vrms,4) + '</b> m/s</span>' +
        '<span>v<sub>mean</sub> = ' + num(s.vmean,4) + ' m/s</span>' +
        '<span>v<sub>mp</sub> = ' + num(s.vmp,4) + ' m/s</span>' +
        '<span>⟨KE⟩ = (3/2)kT = ' + num(s.meanKE_eV,3) + ' eV</span>' +
        '<span>Λ<sub>th</sub> = ' + num(EP().thermalDeBroglie_pm(A,T),3) + ' pm</span>';
    }
    Tin.oninput = upd; upd();
    // assign each particle a speed ~ scaled so display is nice; recompute scale from T
    loop(function(t){
      const T=+Tin.value; const vscale = Math.sqrt(T/300); // relative to 300K baseline
      drawMotion(cv, parts, vscale, A, T);
    });
  }
  function makeParticles(n,W,H){ const a=[]; for(let i=0;i<n;i++){ const sp=0.5+Math.random()*1.5; const ang=Math.random()*Math.PI*2;
    a.push({x:Math.random()*W,y:Math.random()*H,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,base:sp}); } return a; }
  function drawMotion(cv, parts, vscale, A, T){
    const ctx=cv.ctx,W=cv.W,H=cv.H; ctx.clearRect(0,0,W,H);
    ctx.strokeStyle="rgba(148,163,184,.25)"; ctx.strokeRect(1,1,W-2,H-2);
    const spd = 40*vscale; // px/s display
    parts.forEach(pt=>{
      pt.x+=pt.vx*spd*0.016; pt.y+=pt.vy*spd*0.016;
      if(pt.x<6||pt.x>W-6){pt.vx*=-1; pt.x=Math.max(6,Math.min(W-6,pt.x));}
      if(pt.y<6||pt.y>H-6){pt.vy*=-1; pt.y=Math.max(6,Math.min(H-6,pt.y));}
      const v=Math.hypot(pt.vx,pt.vy)||1; const mag=(6+pt.base*10)*vscale;
      arrow(ctx,pt.x,pt.y,pt.x+pt.vx/v*mag,pt.y+pt.vy/v*mag,"rgba(251,191,36,.7)",1.2);
      dot(ctx,pt.x,pt.y,4.5,cur.color);
    });
    txt(ctx,cur.e.symbol+" atoms at "+T+" K",W/2,14,"#93a2bd",11);
  }

  /* ================= RADIOACTIVITY ================= */
  function renderRadio(body){
    const x = cur.x;
    if (!x){ body.innerHTML='<p class="placeholder">No nuclear data.</p>'; return; }
    const rad = x.radioactive;
    const dm = x.decayMode;
    const lbl = (EP().DECAY_LABEL[dm]) || (rad ? "radioactive" : "");
    const hl = x.halfLifeText || (rad?"unknown":"stable");
    const secs = EP().parseHalfLifeSeconds(hl);
    const lam = EP().decayConstant(secs);
    // daughter
    let daughter = "";
    if (rad && dm){ let dZ=cur.Z, dA=cur.A;
      if(dm==="alpha"){dZ-=2;dA-=4;} else if(dm==="beta-"){dZ+=1;} else if(dm==="beta+"||dm==="EC"){dZ-=1;}
      if(dm!=="SF") daughter = 'Transmutes: <b>'+cur.e.symbol+'-'+cur.A+'</b> → Z='+dZ+', A='+dA+(dm==="alpha"?" + ⁴He":dm==="beta-"?" + e⁻ + ν̄":(dm==="beta+"?" + e⁺ + ν":""));
      else daughter = 'Splits into two lighter nuclei + neutrons.';
    }
    let h = '<div class="pt-d-struct">' +
      kv("Most common isotope", cur.e.symbol + "-" + cur.A + "  (" + cur.Z + "p, " + cur.N + "n)") +
      kv("Stability", rad ? '<b style="color:#f87171">radioactive</b>' : '<b style="color:#4ade80">has stable isotopes</b>') +
      (rad ? kv("Decay mode", esc(lbl)) : "") +
      kv("Half-life (longest-lived)", esc(hl)) +
      (lam ? kv("Decay constant λ = ln2/t½", num(lam,3)+" s⁻¹") : "") +
      (daughter ? '<div class="pt-row"><span class="pt-k">Transmutation</span><span class="pt-v">'+daughter+'</span></div>' : "") +
      '</div>';
    h += '<div class="pt-sim-block"><h4>Decay law &nbsp; N(t) = N₀·e^(−λt)</h4>' +
      '<p class="pt-dim">' + (rad ? 'Each nucleus decays at random; the population halves every half-life. Time below is <b>compressed</b> so you can watch it.' : 'This element is stable — shown here as an <b>illustrative</b> decay so you can see the law N(t)=N₀e^(−λt).') + '</p>' +
      '<div id="rdStats" class="pt-stats"></div><button id="rdReset" class="pt-zbtn">↻ reset sample</button></div>';
    body.innerHTML = h;
    const blk = body.querySelector(".pt-sim-block");
    const cv = mkCanvas(blk, 240);
    const stats = body.querySelector("#rdStats");
    let N0 = 240, nuclei, startT;
    function reset(){ nuclei = []; const cols=20, rows=12; for(let i=0;i<N0;i++) nuclei.push({alive:true, i}); startT=null; }
    reset();
    body.querySelector("#rdReset").onclick = reset;
    const displayHalfLife = 3.0; // seconds on screen per half-life (schematic)
    loop(function(t){
      if(startT==null) startT=t; const el=t-startT;
      // stochastic decay toward N0*0.5^(el/displayHalfLife)
      const target = N0*Math.pow(0.5, el/displayHalfLife);
      let alive = nuclei.filter(n=>n.alive).length;
      while(alive>target && alive>0){ // kill some
        const cand = nuclei.filter(n=>n.alive); cand[Math.floor(Math.random()*cand.length)].alive=false; alive--;
      }
      drawDecay(cv, nuclei, cur.color);
      const frac = alive/N0;
      stats.innerHTML = '<span>remaining: <b>'+alive+'</b> / '+N0+'</span><span>'+(frac*100).toFixed(0)+'%</span>' +
        '<span>elapsed: '+(el/displayHalfLife).toFixed(2)+' half-lives</span>';
      if(alive<=0){ startT=t; nuclei.forEach(n=>n.alive=true); } // loop
    });
  }
  function drawDecay(cv, nuclei, col){
    const ctx=cv.ctx,W=cv.W,H=cv.H; ctx.clearRect(0,0,W,H);
    const cols=20, rows=Math.ceil(nuclei.length/cols), sx=W/(cols+1), sy=(H-10)/(rows+1);
    nuclei.forEach((n,i)=>{ const c=i%cols, r=Math.floor(i/cols); const px=sx*(c+1), py=sy*(r+1)+4;
      if(n.alive){ dot(ctx,px,py,Math.min(sx,sy)*0.32,col); }
      else { ctx.strokeStyle="rgba(148,163,184,.3)"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(px,py,Math.min(sx,sy)*0.2,0,7); ctx.stroke(); }
    });
  }

  /* ================= EQUATIONS ================= */
  function renderEquations(body){
    const eqs = cur.p.equations;
    if (!eqs || !eqs.length){ body.innerHTML='<p class="placeholder">No equation data.</p>'; return; }
    const KN = window.KNOWLEDGE;
    const groups = {}; eqs.forEach(eq => { (groups[eq.domain]=groups[eq.domain]||[]).push(eq); });
    let h = '<p class="pt-eqs-note">Every equation in the knowledge base, evaluated for <b>'+esc(cur.e.name)+'</b>. ' +
      '<span class="pt-kind computed">computed</span> = atom-specific · ' +
      '<span class="pt-kind universal">universal</span> = same for all · ' +
      '<span class="pt-kind structural">structural</span> = needs a partner/field.</p>';
    const order = Object.keys(groups);
    order.forEach(dom => {
      const list = groups[dom], color = DOMAIN_COLOR[dom] || "#94a3b8";
      const dl = DOMAIN_LABEL[dom] ? DOMAIN_LABEL[dom].label : dom;
      h += '<div class="pt-eq-group" style="--sec:'+color+'"><div class="pt-eq-dom">'+esc(dl)+' <span>('+list.length+')</span></div>';
      list.forEach(eq => {
        const node = KN && KN.byId ? KN.byId[eq.id] : null;
        const latex = node && node.latex ? node.latex : "";
        const tex = (latex && window.TeX) ? '<div class="pt-eq-tex">'+window.TeX.renderToString(latex,false)+'</div>' : "";
        h += '<div class="pt-eq"><div class="pt-eq-head"><span class="pt-eq-name">'+esc(eq.name)+'</span>' +
          '<span class="pt-kind '+esc(eq.kind)+'">'+esc(eq.kind)+'</span></div>'+tex+
          '<div class="pt-eq-sum">'+esc(eq.summary)+'</div></div>';
      });
      h += '</div>';
    });
    body.innerHTML = h;
  }

  /* ---------- small html helpers ---------- */
  function kv(k,v){ return '<div class="pt-row"><span class="pt-k">'+k+'</span><span class="pt-v">'+v+'</span></div>'; }
  function secHTML(title, map, color){
    if(!map) return "";
    const model = map.model ? '<div class="pt-sec-model">'+esc(map.model)+'</div>' : "";
    let rows=""; Object.keys(map).forEach(k=>{ if(k==="model")return;
      rows += '<div class="pt-row"><span class="pt-k">'+esc(prettyKey(k))+'</span><span class="pt-v">'+esc(fmtVal(map[k]))+'</span></div>'; });
    return '<div class="pt-sec" style="--sec:'+color+'"><h4>'+esc(title)+'</h4>'+model+rows+'</div>';
  }
  function fmtVal(v){ if(typeof v==="number") return num(v,5); if(Array.isArray(v)) return v.map(fmtVal).join(", ");
    if(typeof v==="boolean") return v?"yes":"no"; return String(v); }
  const UNITS={pm:"(pm)",nm:"(nm)",eV:"(eV)",N:"(N)",Js:"(J·s)",muB:"(µ_B)","m_per_s":"(m/s)","kg_m_per_s":"(kg·m/s)","JperT":"(J/T)","fraction_of_c":"(/c)","2S_plus_1":"(2S+1)","2S":"(2S)","rad_per_s":"(rad/s)"};
  function prettyKey(k){ let unit=""; for(const s in UNITS){ if(k.endsWith("_"+s)){ unit=" "+UNITS[s]; k=k.slice(0,-(s.length+1)); break; } }
    let l=k.replace(/_/g," ").replace(/([a-z])([A-Z])/g,"$1 $2"); return l.charAt(0).toUpperCase()+l.slice(1)+unit; }

  const TABS = { overview:renderOverview, phases:renderPhases, zoom:renderZoom, motion:renderMotion, radio:renderRadio, equations:renderEquations };

  window.PeriodicSim = { show, deactivate: stopAnim };
})();
