/* ============================================================================
 *  NETWORK.JS  —  the observable "knowledge neural network"
 *  A force-directed graph: every equation/concept is a neuron, coloured by
 *  domain; the source papers are larger hub-neurons. Edges = relationships
 *  (concept↔concept) and membership (paper→concept). Pulses travel the
 *  synapses. Pan / zoom / drag / click-to-inspect / search / domain toggles.
 *  Exposes: window.Network = { init, activate }
 * ========================================================================== */
(function () {
  "use strict";

  const KN = window.KNOWLEDGE;
  let canvas, ctx, W=0, H=0, DPR=1, raf=null, started=false;

  const cam = { x: 0, y: 0, scale: 0.66 };
  const nodes = [];          // {id,isSource,domain,color,x,y,vx,vy,r,deg,fixed,label,latex}
  const edges = [];          // {a,b,kind}
  const nodeById = {};
  const domAnchor = {};      // domain -> {x,y} cluster centre (keeps the map tidy)
  const hiddenDomains = new Set();
  let hoverId=null, selectedId=null, searchTerm="";
  let pathIds=[]; const pathNodeSet=new Set(); const pathEdgeSet=new Set();
  let cooling=true, stillFrames=0, coolFrames=0;   // run the sim until it settles, then FREEZE
  function reheat(){ cooling=true; stillFrames=0; coolFrames=0; }   // nudge it back to life on a real change
  const drag = { node:null, panning:false, lastX:0, lastY:0, moved:0, downX:0, downY:0 };

  /* ----------------------------- build graph --------------------------- */
  function build(){
    const keys=Object.keys(KN.domains);
    const RD = 230 + keys.length*30;                 // domain-ring radius (scales with #domains)
    keys.forEach((d,i)=>{ const a=(i/keys.length)*Math.PI*2 - Math.PI/2; domAnchor[d]={ x:Math.cos(a)*RD, y:Math.sin(a)*RD }; });
    const col = (d)=> (KN.domains[d]&&KN.domains[d].color) || "#7dd3fc";
    const jit = ()=> (Math.random()-0.5);

    // concept nodes — seeded near their domain's cluster centre
    KN.nodes.forEach(n=>{
      const an = domAnchor[n.domain] || {x:0,y:0};
      const node={
        id:n.id, isSource:false, domain:n.domain, color:col(n.domain),
        x:an.x+jit()*150, y:an.y+jit()*150, vx:0, vy:0,
        r:7, deg:0, fixed:false, label:n.name, latex:n.latex
      };
      nodes.push(node); nodeById[n.id]=node;
    });
    // source hub nodes — sit just inside their domain cluster
    Object.keys(KN.sources).forEach(sid=>{
      const src=KN.sources[sid]; const an=domAnchor[src.domainHint] || {x:0,y:0};
      const node={
        id:sid, isSource:true, domain:src.domainHint, color:col(src.domainHint),
        x:an.x+jit()*90, y:an.y+jit()*90, vx:0, vy:0,
        r:15, deg:0, fixed:false, label:src.title, file:src.file, blurb:src.blurb
      };
      nodes.push(node); nodeById[sid]=node;
    });

    // edges
    const seen=new Set();
    function addEdge(a,b,kind){
      if(!nodeById[a]||!nodeById[b]||a===b) return;
      const key=[a,b].sort().join("|")+kind;
      if(seen.has(key)) return; seen.add(key);
      edges.push({a,b,kind});
      nodeById[a].deg++; nodeById[b].deg++;
    }
    KN.nodes.forEach(n=>{
      (n.related||[]).forEach(r=>addEdge(n.id,r,"concept"));
      const srcs = n.sources || [n.source];
      srcs.forEach(s=>addEdge(s,n.id,"source"));
    });
    // size by degree
    nodes.forEach(n=>{ if(!n.isSource) n.r = 6 + Math.min(7, n.deg*0.8); });
  }

  /* ----------------------------- physics ------------------------------- */
  function tick(){
    const REP = 3200 + nodes.length*18;      // repulsion scales with population
    const SPRING=0.02, CLUSTER=0.013, CENTER=0.0005, DAMP=0.78;
    const rest={concept:72, source:118};
    // repulsion (O(n^2))
    for(let i=0;i<nodes.length;i++){
      const a=nodes[i]; if(visibleNode(a)===false) continue;
      for(let j=i+1;j<nodes.length;j++){
        const b=nodes[j]; if(visibleNode(b)===false) continue;
        let dx=a.x-b.x, dy=a.y-b.y; let d2=dx*dx+dy*dy; if(d2<1) d2=1;
        const f=REP/d2; const d=Math.sqrt(d2); const fx=f*dx/d, fy=f*dy/d;
        const wa=a.isSource?0.6:1, wb=b.isSource?0.6:1;
        a.vx+=fx*wa; a.vy+=fy*wa; b.vx-=fx*wb; b.vy-=fy*wb;
      }
    }
    // springs
    for(const e of edges){
      const a=nodeById[e.a], b=nodeById[e.b];
      if(!visibleNode(a)||!visibleNode(b)) continue;
      let dx=b.x-a.x, dy=b.y-a.y; const d=Math.hypot(dx,dy)||1;
      const f=SPRING*(d-rest[e.kind]);
      const fx=f*dx/d, fy=f*dy/d;
      a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy;
    }
    // integrate: pull each node toward its DOMAIN cluster centre (keeps it tidy) + a whisper of global gravity
    for(const n of nodes){
      if(n.fixed){ n.vx=0; n.vy=0; continue; }
      const an=domAnchor[n.domain];
      if(an){ n.vx += (an.x-n.x)*CLUSTER; n.vy += (an.y-n.y)*CLUSTER; }
      n.vx += -n.x*CENTER; n.vy += -n.y*CENTER;
      n.vx*=DAMP; n.vy*=DAMP;
      n.x+=n.vx; n.y+=n.vy;
    }
  }
  function visibleNode(n){ return !hiddenDomains.has(n.domain); }

  /* ----------------------------- transforms ---------------------------- */
  function toScreen(x,y){ return [ x*cam.scale + cam.x + W/2, y*cam.scale + cam.y + H/2 ]; }
  function toWorld(sx,sy){ return [ (sx - cam.x - W/2)/cam.scale, (sy - cam.y - H/2)/cam.scale ]; }

  /* ----------------------------- render -------------------------------- */
  let pulseClock=0;
  function render(){
    // only simulate while "cooling"; once the layout settles we FREEZE so nodes stop drifting
    if(cooling){
      tick(); tick();
      coolFrames++;
      // freeze once the layout is CALM (not perfectly still) so it stops jiggling…
      let mx=0; for(const n of nodes){ if(n.fixed) continue; const s=n.vx*n.vx+n.vy*n.vy; if(s>mx) mx=s; }
      if(mx < 0.02){ if(++stillFrames > 10) cooling=false; } else stillFrames=0;
      // …and a hard backstop so it can never wiggle forever (settles within a few seconds)
      if(coolFrames > 260) cooling=false;
      if(!cooling){ for(const n of nodes){ n.vx=0; n.vy=0; } }   // kill residual motion cleanly
    }
    pulseClock += 0.01;
    ctx.clearRect(0,0,W,H);

    const matchActive = searchTerm.length>0;
    const anyFocus = hoverId || selectedId;

    // faint domain-cluster labels (watermark behind everything)
    ctx.save();
    ctx.textAlign="center"; ctx.textBaseline="middle";
    for(const d in domAnchor){
      if(hiddenDomains.has(d)) continue;
      const [sx,sy]=toScreen(domAnchor[d].x, domAnchor[d].y);
      ctx.globalAlpha=0.16; ctx.fillStyle=(KN.domains[d]&&KN.domains[d].color)||"#7dd3fc";
      ctx.font="700 "+Math.max(12,14*cam.scale)+"px Inter, system-ui, sans-serif";
      ctx.fillText((KN.domains[d]?KN.domains[d].label:d).toUpperCase(), sx, sy);
    }
    ctx.restore(); ctx.textBaseline="alphabetic";

    // edges
    for(const e of edges){
      const a=nodeById[e.a], b=nodeById[e.b];
      if(!visibleNode(a)||!visibleNode(b)) continue;
      const [ax,ay]=toScreen(a.x,a.y), [bx,by]=toScreen(b.x,b.y);
      const near = hoverId && (e.a===hoverId||e.b===hoverId);
      const sel  = selectedId && (e.a===selectedId||e.b===selectedId);
      const onPath = pathEdgeSet.size && pathEdgeSet.has([e.a,e.b].sort().join("|"));
      if(onPath){
        ctx.strokeStyle="rgba(251,191,36,.95)"; ctx.lineWidth=3; ctx.setLineDash([]);
        ctx.shadowColor="rgba(251,191,36,.8)"; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.shadowBlur=0;
        const t=(pulseClock*3 + e.a.length)%1; const px=ax+(bx-ax)*t, py=ay+(by-ay)*t;
        ctx.fillStyle="#fffbe6"; ctx.beginPath(); ctx.arc(px,py,3,0,7); ctx.fill();
        continue;
      }
      let alpha = e.kind==="source" ? 0.05 : 0.09;
      if(anyFocus && !(near||sel)) alpha *= 0.45;      // fade the rest when inspecting a node
      if(near||sel) alpha = 0.75;
      ctx.strokeStyle = (near||sel) ? "rgba(125,211,252,"+alpha+")" : "rgba(120,140,180,"+alpha+")";
      ctx.lineWidth = (near||sel) ? 1.8 : (e.kind==="source"?0.5:0.8);
      if(e.kind==="source"){ ctx.setLineDash([2,4]); } else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      ctx.setLineDash([]);
      // synapse pulse on connected/selected edges
      if(near||sel){
        const t=(pulseClock*2 + (e.a.length))%1;
        const px=ax+(bx-ax)*t, py=ay+(by-ay)*t;
        ctx.fillStyle="rgba(190,240,255,.9)"; ctx.beginPath(); ctx.arc(px,py,2.4,0,7); ctx.fill();
      }
    }

    // nodes
    for(const n of nodes){
      if(!visibleNode(n)) continue;
      const [x,y]=toScreen(n.x,n.y);
      const r=n.r*Math.max(0.7,Math.min(1.6,cam.scale));
      const isHover=n.id===hoverId, isSel=n.id===selectedId;
      const onPath = pathNodeSet.has(n.id);
      const dim = (matchActive && !matches(n)) || (pathNodeSet.size && !onPath && !isHover && !isSel);
      ctx.save();
      ctx.globalAlpha = dim ? 0.16 : 1;
      // glow
      if(isHover||isSel){ ctx.shadowColor=n.color; ctx.shadowBlur=20; }
      else { ctx.shadowColor=n.color; ctx.shadowBlur=n.isSource?12:6; }
      // body
      const g=ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.1,x,y,r);
      if(n.isSource){ g.addColorStop(0,"#ffffff"); g.addColorStop(0.4,n.color); g.addColorStop(1,"rgba(0,0,0,.2)"); }
      else { g.addColorStop(0,lighten(n.color)); g.addColorStop(1,n.color); }
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
      if(n.isSource){ ctx.lineWidth=1.6; ctx.strokeStyle="rgba(255,255,255,.7)"; ctx.stroke(); }
      ctx.restore();
      // gold ring on the concept-path nodes
      if(onPath){
        ctx.save(); ctx.strokeStyle="rgba(251,191,36,.95)"; ctx.lineWidth=2.5;
        ctx.shadowColor="rgba(251,191,36,.9)"; ctx.shadowBlur=14;
        ctx.beginPath(); ctx.arc(x,y,r+4,0,7); ctx.stroke(); ctx.restore();
      }

      // labels: sources always; concepts on hover/select/zoom-in/on-path
      if(n.isSource || isHover || isSel || onPath || cam.scale>1.35 || (matchActive && matches(n))){
        ctx.save();
        ctx.globalAlpha = dim?0.3:1;
        ctx.font=(n.isSource?"600 12px":"11px")+" Inter, system-ui, sans-serif";
        ctx.fillStyle = (isHover||isSel)? "#ffffff" : "rgba(214,225,240,.85)";
        ctx.textAlign="center"; ctx.textBaseline="top";
        ctx.shadowColor="rgba(0,0,0,.9)"; ctx.shadowBlur=4;
        const txt = n.isSource ? shorten(n.label,28) : shorten(n.label,26);
        ctx.fillText(txt, x, y+r+3);
        ctx.restore();
      }
    }
    raf=requestAnimationFrame(render);
  }
  function lighten(hex){
    const c=hex.replace("#",""); const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
    return "rgb("+Math.min(255,r+70)+","+Math.min(255,g+70)+","+Math.min(255,b+70)+")";
  }
  function shorten(s,n){ return s.length>n ? s.slice(0,n-1)+"…" : s; }
  function matches(n){
    if(!searchTerm) return true;
    const node=KN.byId[n.id];
    const hay=(n.label+" "+(n.domain||"")+" "+(node?node.category+" "+node.behaviour:"")).toLowerCase();
    return hay.includes(searchTerm);
  }

  /* ----------------------------- picking ------------------------------- */
  function pick(sx,sy){
    let best=null, bestD=1e9;
    for(const n of nodes){
      if(!visibleNode(n)) continue;
      const [x,y]=toScreen(n.x,n.y); const r=n.r*Math.max(0.7,Math.min(1.6,cam.scale))+5;
      const d=Math.hypot(sx-x,sy-y);
      if(d<=r && d<bestD){ bestD=d; best=n; }
    }
    return best;
  }

  /* ----------------------------- detail card --------------------------- */
  function showDetail(n){
    const box=document.getElementById("netDetail");
    const body=document.getElementById("netDetailBody");
    if(n.isSource){
      const s=KN.sources[n.id];
      const count=KN.nodes.filter(x=>(x.sources||[x.source]).includes(n.id)).length;
      body.innerHTML='<h2 style="color:'+n.color+';text-transform:uppercase;font-size:11px;letter-spacing:1px;margin:0 0 4px">Source paper</h2>'+
        '<div style="font-size:16px;font-weight:650;margin-bottom:6px">'+esc(s.title)+'</div>'+
        '<div style="font-size:11px;color:var(--text-faint);margin-bottom:10px">📄 '+esc(s.file)+'</div>'+
        '<div style="font-size:12.5px;line-height:1.6;color:var(--text-dim)">'+esc(s.blurb)+'</div>'+
        '<div style="margin-top:12px;font-size:12px;color:var(--text)">Feeds <b>'+count+'</b> equations / concepts in this map.</div>';
    } else {
      const node=KN.byId[n.id];
      body.innerHTML='<div class="eq-host"></div>';
      window.UI.renderEqCardsInto(body.querySelector(".eq-host"), [n.id]);
      // related links
      if(node.related && node.related.length){
        const wrap=document.createElement("div");
        wrap.style.cssText="margin-top:6px;font-size:11.5px;color:var(--text-dim)";
        wrap.innerHTML="<b style='color:var(--text-faint)'>connects to →</b> ";
        node.related.forEach(rid=>{
          const rn=KN.byId[rid]; if(!rn) return;
          const a=document.createElement("a");
          a.textContent=rn.name; a.href="#";
          a.style.cssText="color:"+KN.domains[rn.domain].color+";text-decoration:none;margin-right:8px;cursor:pointer";
          a.onclick=(ev)=>{ ev.preventDefault(); focusNode(rid); };
          wrap.appendChild(a);
        });
        body.appendChild(wrap);
      }
    }
    box.classList.add("show");
  }
  function focusNode(id){
    const n=nodeById[id]; if(!n) return;
    selectedId=id; showDetail(n);
    // glide camera to it
    cam.x = -n.x*cam.scale; cam.y = -n.y*cam.scale;
  }

  /* ----------------------------- UI build ------------------------------ */
  function buildLegend(){
    const rows=document.getElementById("netLegendRows"); rows.innerHTML="";
    for(const d in KN.domains){
      const row=document.createElement("div"); row.className="row"; row.dataset.dom=d;
      row.innerHTML='<span class="dot" style="background:'+KN.domains[d].color+';color:'+KN.domains[d].color+'"></span>'+KN.domains[d].label;
      row.onclick=()=>{
        if(hiddenDomains.has(d)) hiddenDomains.delete(d); else hiddenDomains.add(d);
        row.classList.toggle("off", hiddenDomains.has(d));
        reheat();   // relayout the remaining clusters, then settle again
      };
      rows.appendChild(row);
    }
  }

  /* ----------------------------- events -------------------------------- */
  function onDown(e){
    const r=canvas.getBoundingClientRect(); const sx=e.clientX-r.left, sy=e.clientY-r.top;
    drag.downX=sx; drag.downY=sy; drag.moved=0; drag.lastX=sx; drag.lastY=sy;
    const n=pick(sx,sy);
    if(n){ drag.node=n; n.fixed=true; reheat(); }
    else { drag.panning=true; canvas.classList.add("dragging"); }
  }
  function onMove(e){
    const r=canvas.getBoundingClientRect(); const sx=e.clientX-r.left, sy=e.clientY-r.top;
    drag.moved += Math.abs(sx-drag.lastX)+Math.abs(sy-drag.lastY);
    if(drag.node){
      const w=toWorld(sx,sy); drag.node.x=w[0]; drag.node.y=w[1]; drag.node.vx=0; drag.node.vy=0; reheat();
    } else if(drag.panning){
      cam.x += sx-drag.lastX; cam.y += sy-drag.lastY;
    } else {
      const n=pick(sx,sy); hoverId=n?n.id:null;
      canvas.style.cursor = n? "pointer" : "grab";
    }
    drag.lastX=sx; drag.lastY=sy;
  }
  function onUp(e){
    if(drag.node && drag.moved<5){ selectedId=drag.node.id; showDetail(drag.node); }
    else if(drag.panning && drag.moved<5){ selectedId=null; document.getElementById("netDetail").classList.remove("show"); }
    if(drag.node){ drag.node.fixed=false; reheat(); }   // let neighbours re-settle after a drag, then freeze
    drag.node=null; drag.panning=false; canvas.classList.remove("dragging");
  }
  function onWheel(e){
    e.preventDefault();
    const r=canvas.getBoundingClientRect(); const sx=e.clientX-r.left, sy=e.clientY-r.top;
    const before=toWorld(sx,sy);
    const f=e.deltaY<0?1.12:0.89;
    cam.scale=Math.max(0.3,Math.min(3.2,cam.scale*f));
    const after=toWorld(sx,sy);
    cam.x += (after[0]-before[0])*cam.scale; cam.y += (after[1]-before[1])*cam.scale;
  }

  function resize(){
    W=canvas.clientWidth; H=canvas.clientHeight;
    DPR=Math.min(window.devicePixelRatio||1,2);
    canvas.width=W*DPR; canvas.height=H*DPR;
    canvas.style.width=W+"px"; canvas.style.height=H+"px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  function init(){
    canvas=document.getElementById("netCanvas"); ctx=canvas.getContext("2d");
    build(); buildLegend();
    document.getElementById("netStats").textContent =
      KN.nodes.length+" concepts · "+Object.keys(KN.sources).length+" sources · "+edges.length+" links";
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, {passive:false});
    document.getElementById("netDetailClose").onclick=()=>{ selectedId=null; document.getElementById("netDetail").classList.remove("show"); };
    document.getElementById("netSearch").addEventListener("input",(e)=>{ searchTerm=e.target.value.trim().toLowerCase(); });
  }

  function activate(){            // called when the tab is shown
    resize();
    if(!started){ started=true; render(); }
  }

  function esc(s){ return String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

  /* highlight a shortest concept-path (list of node ids) and frame it on screen */
  function highlightPath(ids){
    pathIds = Array.isArray(ids) ? ids.slice() : [];
    pathNodeSet.clear(); pathEdgeSet.clear();
    pathIds.forEach(id=>pathNodeSet.add(id));
    for(let i=0;i<pathIds.length-1;i++){ pathEdgeSet.add([pathIds[i],pathIds[i+1]].sort().join("|")); }
    if(pathIds.length){
      // frame the path: centre the camera on its bounding box
      const hidBefore=hiddenDomains.size;
      let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9, cnt=0;
      pathIds.forEach(id=>{ const n=nodeById[id]; if(!n) return; cnt++;
        minX=Math.min(minX,n.x); maxX=Math.max(maxX,n.x); minY=Math.min(minY,n.y); maxY=Math.max(maxY,n.y);
        hiddenDomains.delete(n.domain); });
      if(hiddenDomains.size!==hidBefore) reheat();   // a hidden cluster was revealed → re-settle
      if(cnt){
        const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
        const spanX=Math.max(120,maxX-minX), spanY=Math.max(120,maxY-minY);
        const sc=Math.max(0.45,Math.min(1.6, Math.min(W/(spanX*1.6), H/(spanY*1.6))));
        cam.scale=sc; cam.x=-cx*sc; cam.y=-cy*sc;
      }
    }
  }

  window.Network={ init, activate, _resize:()=>resize(), focusNode:(id)=>focusNode(id), highlightPath:(ids)=>highlightPath(ids) };
})();
