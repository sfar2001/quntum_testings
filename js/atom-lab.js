/* ============================================================================
 *  ATOM-LAB.JS  —  the interactive figure
 *  Four scenes drawn on a canvas, each with hoverable vectors. Hovering a
 *  vector (or its legend chip) shows the real equation(s), the behaviour, the
 *  variables and the source paper in the right-hand inspector.
 *  Exposes: window.AtomLab = { init, setScene }
 * ========================================================================== */
(function () {
  "use strict";

  const KN = window.KNOWLEDGE;
  let canvas, ctx, tipEl, W = 0, H = 0, DPR = 1;
  let raf = null;

  const state = {
    scene: "classical",
    t: 0,                 // animation clock
    playing: true,
    hovered: null,        // vector key currently under cursor
    pinned: null,         // vector key clicked (sticky)
    mouse: { x: -1, y: -1, inside: false },
    hits: [],             // per-frame hot shapes for hit testing
    bloch: {
      s: [0, 0, 1],       // Bloch vector (starts at |0>)
      n: norm([0.35, 0.0, 1]), // field / rotation axis (the pink arrow)
      anim: null          // {axis, total, done, rate} for animated gate
    }
  };

  /* ----------------------------- vector math --------------------------- */
  function norm(v){ const m=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/m,v[1]/m,v[2]/m]; }
  function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function rotateAboutAxis(v, k, ang){ // Rodrigues
    k = norm(k);
    const c=Math.cos(ang), s=Math.sin(ang), kv=dot(k,v), cr=cross(k,v);
    return [
      v[0]*c + cr[0]*s + k[0]*kv*(1-c),
      v[1]*c + cr[1]*s + k[1]*kv*(1-c),
      v[2]*c + cr[2]*s + k[2]*kv*(1-c)
    ];
  }

  /* ----------------------------- 2D drawing ---------------------------- */
  function arrow(x1, y1, x2, y2, color, width, glow) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const head = 9 + width;
    ctx.save();
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = width; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
    ctx.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function label(text, x, y, color, size) {
    ctx.save();
    ctx.font = (size||13) + "px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillStyle = color || "#cbd5e1";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 4;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function glowDot(x, y, r, inner, outer) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }

  /* hit shapes ---------------------------------------------------------- */
  function pushSeg(key, x1, y1, x2, y2, pad){ state.hits.push({key, type:"seg", x1,y1,x2,y2, pad: pad||12}); }
  function pushRect(key, x, y, w, h){ state.hits.push({key, type:"rect", x,y,w,h}); }
  function pushCircle(key, x, y, r){ state.hits.push({key, type:"circle", x,y,r}); }

  function distToSeg(px, py, s){
    const dx=s.x2-s.x1, dy=s.y2-s.y1, l2=dx*dx+dy*dy;
    let t = l2 ? ((px-s.x1)*dx+(py-s.y1)*dy)/l2 : 0; t=Math.max(0,Math.min(1,t));
    return Math.hypot(px-(s.x1+t*dx), py-(s.y1+t*dy));
  }
  function hitTest(px, py){
    let best=null, bestD=1e9;
    for(const s of state.hits){
      let inside=false, d=1e9;
      if(s.type==="seg"){ d=distToSeg(px,py,s); inside = d<=s.pad; }
      else if(s.type==="rect"){ inside = px>=s.x&&px<=s.x+s.w&&py>=s.y&&py<=s.y+s.h; d = inside?0:1e9; }
      else if(s.type==="circle"){ d=Math.hypot(px-s.x,py-s.y); inside = d<=s.r; }
      if(inside && d<bestD){ bestD=d; best=s.key; }
    }
    return best;
  }

  /* ===================================================================== *
   *  SCENE 1 — CLASSICAL ATOM                                             *
   * ===================================================================== */
  function drawClassical(cx, cy){
    const a = Math.min(W,H)*0.30, b = a*0.62;     // orbit semi-axes
    const ang = state.t*0.6;
    // orbit path
    ctx.save();
    ctx.strokeStyle="rgba(245,166,35,.28)"; ctx.lineWidth=1.4; ctx.setLineDash([5,6]);
    ctx.beginPath(); ctx.ellipse(cx,cy,a,b,0,0,7); ctx.stroke(); ctx.restore();

    // nucleus
    glowDot(cx,cy, 26, "rgba(125,211,252,.95)", "rgba(37,99,235,0)");
    ctx.fillStyle="#bfe3ff"; glowDot(cx,cy,13,"#dff1ff","#2b6fb8");
    label("+Ze", cx, cy+1, "#06203b", 12);

    // electron position
    const ex = cx + a*Math.cos(ang), ey = cy + b*Math.sin(ang);
    // tangent direction (derivative of ellipse)
    let tx = -a*Math.sin(ang), ty = b*Math.cos(ang); const tl=Math.hypot(tx,ty); tx/=tl; ty/=tl;
    // inward (toward nucleus)
    let ix = cx-ex, iy = cy-ey; const il=Math.hypot(ix,iy); const inx=ix/il, iny=iy/il;

    const L = 66;
    // r : nucleus -> electron
    arrow(cx, cy, ex, ey, "#f5a623", 2.4, state.hovered==="r");
    pushSeg("r", cx, cy, ex, ey, 11);
    label("r", (cx+ex)/2+10, (cy+ey)/2-10, "#f5a623");

    // F : electron -> nucleus (inward)
    arrow(ex, ey, ex+inx*L*0.8, ey+iny*L*0.8, "#f87171", 2.6, state.hovered==="F");
    pushSeg("F", ex, ey, ex+inx*L*0.8, ey+iny*L*0.8, 11);
    label("F", ex+inx*L*0.5-12, ey+iny*L*0.5-10, "#f87171");

    // v : tangential
    arrow(ex, ey, ex+tx*L, ey+ty*L, "#fbbf24", 2.6, state.hovered==="v");
    pushSeg("v", ex, ey, ex+tx*L, ey+ty*L, 11);
    label("v", ex+tx*L+10, ey+ty*L, "#fbbf24");

    // p : parallel to v, offset outward
    const ox = -iny* (-1), oy = inx*(-1); // perpendicular-ish offset using inward normal
    const px1 = ex - inx*16, py1 = ey - iny*16;
    arrow(px1, py1, px1+tx*L*0.92, py1+ty*L*0.92, "#fb923c", 2.2, state.hovered==="p");
    pushSeg("p", px1, py1, px1+tx*L*0.92, py1+ty*L*0.92, 10);
    label("p", px1+tx*L*0.9-12, py1+ty*L*0.9+12, "#fb923c");

    // L : out of plane at nucleus (fake 3D, up)
    arrow(cx, cy, cx, cy-a*0.78, "#a3e635", 2.4, state.hovered==="L");
    pushSeg("L", cx, cy, cx, cy-a*0.78, 11);
    ctx.save(); ctx.strokeStyle="#a3e635"; ctx.fillStyle="rgba(163,230,53,.15)";
    ctx.beginPath(); ctx.arc(cx, cy-a*0.78, 6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy-a*0.78, 2.2, 0, 7); ctx.fillStyle="#a3e635"; ctx.fill(); ctx.restore();
    label("L", cx+16, cy-a*0.78, "#a3e635");

    // electron
    glowDot(ex,ey,12,"rgba(255,224,138,.9)","rgba(245,166,35,0)");
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(ex,ey,4.5,0,7); ctx.fill();
    label("e⁻", ex, ey+16, "#ffe08a", 11);
  }

  /* ===================================================================== *
   *  SCENE 2 — QUANTUM ATOM (probability cloud + wavefunction)            *
   * ===================================================================== */
  let cloudPts = null;
  function ensureCloud(){
    if(cloudPts) return;
    cloudPts=[];
    for(let i=0;i<460;i++){
      // sample a 2p-ish / smeared radial distribution
      const ang = Math.random()*7;
      const lobe = (Math.random()<0.5?1:-1);
      const r = (Math.random()**0.5)*1 + 0.15;
      cloudPts.push({ang, r, lobe, ph: Math.random()*7, sp: 0.6+Math.random()*1.2});
    }
  }
  function drawQuantum(cx, cy){
    ensureCloud();
    const R = Math.min(W,H)*0.30;
    // cloud
    ctx.save();
    for(const p of cloudPts){
      const tw = 0.5+0.5*Math.sin(state.t*p.sp + p.ph);
      const rr = p.r*R*(0.85+0.15*Math.sin(state.t*0.5+p.ph));
      const x = cx + Math.cos(p.ang)*rr;
      const y = cy + Math.sin(p.ang)*rr*0.78;
      const alpha = 0.05 + 0.30*tw*(1-p.r*0.6);
      ctx.fillStyle = "rgba(34,211,238,"+alpha.toFixed(3)+")";
      ctx.beginPath(); ctx.arc(x,y, 2.1+2*tw, 0, 7); ctx.fill();
    }
    ctx.restore();
    // soft halo
    const g=ctx.createRadialGradient(cx,cy,4,cx,cy,R*1.05);
    g.addColorStop(0,"rgba(34,211,238,.16)"); g.addColorStop(.6,"rgba(34,211,238,.05)"); g.addColorStop(1,"rgba(34,211,238,0)");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R*1.05,0,7); ctx.fill();
    pushCircle("cloud", cx, cy, R*0.95);

    // nucleus
    glowDot(cx,cy,16,"rgba(125,211,252,.95)","rgba(37,99,235,0)");
    ctx.fillStyle="#dff1ff"; ctx.beginPath(); ctx.arc(cx,cy,7,0,7); ctx.fill();

    // ψ(x) wave plot across bottom
    const wy = cy + R*0.92, wx0 = cx - R*1.1, wx1 = cx + R*1.1;
    ctx.save();
    ctx.strokeStyle="rgba(148,163,184,.35)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(wx0,wy); ctx.lineTo(wx1,wy); ctx.stroke();
    ctx.strokeStyle = state.hovered==="psi" ? "#bdf3ff" : "#67e8f9"; ctx.lineWidth= state.hovered==="psi"?3:2.2;
    if(state.hovered==="psi"){ ctx.shadowColor="#67e8f9"; ctx.shadowBlur=12; }
    ctx.beginPath();
    for(let i=0;i<=120;i++){
      const u=i/120, x=wx0+(wx1-wx0)*u;
      const xx=(u-0.5)*10;
      const env=Math.exp(-xx*xx*0.10);
      const y=wy - env*Math.sin(xx*1.6 - state.t*1.4)*30;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke(); ctx.restore();
    pushRect("psi", wx0, wy-34, wx1-wx0, 68);
    label("ψ(x)", wx0+18, wy-30, "#67e8f9", 12);

    // p̂ : momentum on a sample point of the cloud
    const sa=state.t*0.5, sx=cx+Math.cos(sa)*R*0.55, sy=cy+Math.sin(sa)*R*0.42;
    arrow(sx,sy, sx+44, sy-10, "#fb923c", 2.2, state.hovered==="p");
    pushSeg("p", sx,sy, sx+44, sy-10, 10);
    label("p̂", sx+52, sy-12, "#fb923c");

    // Ĥ badge (Schrödinger eq) top-center hotspot
    const bx=cx-86, by=cy-R*1.12;
    drawBadge("H","i ħ ∂Ψ/∂t = Ĥ Ψ", bx, by, 172, state.hovered==="H", "#a5f3fc");

    // energy levels on the right
    const lx0=cx+R*0.78, lx1=cx+R*1.18; let topY=cy-R*0.55;
    ctx.save();
    for(let n=0;n<5;n++){
      const yy=topY + n*22*(1+ n*0.18);
      const hot = state.hovered==="levels";
      ctx.strokeStyle = hot? "#bae6fd" : "rgba(56,189,248,.7)";
      ctx.lineWidth = hot?2.4:1.6;
      ctx.beginPath(); ctx.moveTo(lx0,yy); ctx.lineTo(lx1,yy); ctx.stroke();
    }
    ctx.restore();
    pushRect("levels", lx0-4, topY-8, (lx1-lx0)+8, 5*26+10);
    label("E", lx1+12, topY, "#38bdf8", 12);

    // uncertainty box near nucleus
    const ub=44, ux=cx-ub*1.4, uy=cy-ub*0.4;
    ctx.save();
    ctx.strokeStyle = state.hovered==="unc" ? "#c7d2fe" : "rgba(129,140,248,.7)";
    ctx.setLineDash([4,3]); ctx.lineWidth=1.6;
    ctx.strokeRect(ux,uy,ub,ub*0.7); ctx.restore();
    pushRect("unc", ux,uy,ub,ub*0.7);
    label("Δx·Δp", ux+ub*0.5, uy-9, "#818cf8", 11);
  }
  function drawBadge(key, text, x, y, w, hot, color){
    ctx.save();
    ctx.fillStyle = hot? "rgba(34,211,238,.18)" : "rgba(13,22,40,.8)";
    ctx.strokeStyle = hot? color : "rgba(56,189,248,.4)"; ctx.lineWidth=1.4;
    roundRect(x,y,w,30,8); ctx.fill(); ctx.stroke();
    ctx.fillStyle=color; ctx.font="12px ui-monospace, Consolas, monospace";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(text, x+w/2, y+15); ctx.restore();
    pushRect(key, x, y, w, 30);
  }
  function roundRect(x,y,w,h,r){ ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  /* ===================================================================== *
   *  SCENE 3 — BLOCH SPHERE                                               *
   * ===================================================================== */
  const VIEW_AZ = 0.62, VIEW_K = 0.34;
  function project(v, cx, cy, R){
    const h = v[0]*Math.cos(VIEW_AZ) - v[1]*Math.sin(VIEW_AZ);
    const d = v[0]*Math.sin(VIEW_AZ) + v[1]*Math.cos(VIEW_AZ);
    return { x: cx + R*h, y: cy - R*v[2] - R*VIEW_K*d, depth: d };
  }
  function drawBloch(cx, cy){
    const R = Math.min(W,H)*0.32;
    // advance precession when playing & no gate animation
    if(state.playing && !state.bloch.anim){
      state.bloch.s = rotateAboutAxis(state.bloch.s, state.bloch.n, 0.012);
    }
    // animated gate rotation
    if(state.bloch.anim){
      const an=state.bloch.anim, step=Math.min(an.rate, an.total-an.done);
      state.bloch.s = rotateAboutAxis(state.bloch.s, an.axis, step*an.dir);
      an.done += step;
      if(an.done>=an.total-1e-6) state.bloch.anim=null;
    }

    // sphere body
    ctx.save();
    const g=ctx.createRadialGradient(cx-R*0.3,cy-R*0.3,R*0.1,cx,cy,R);
    g.addColorStop(0,"rgba(167,139,250,.10)"); g.addColorStop(1,"rgba(80,60,160,.03)");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R,0,7); ctx.fill();
    ctx.strokeStyle="rgba(167,139,250,.5)"; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(cx,cy,R,0,7); ctx.stroke();
    // equator
    ctx.strokeStyle="rgba(167,139,250,.35)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(cx,cy,R,R*VIEW_K,0,0,7); ctx.stroke();
    // meridian
    ctx.beginPath(); ctx.ellipse(cx,cy,R*VIEW_K,R,0,0,7); ctx.stroke();
    ctx.restore();

    // axes & poles
    const axes=[
      {v:[0,0,1],  t:"|0⟩", c:"#c4b5fd"}, {v:[0,0,-1], t:"|1⟩", c:"#c4b5fd"},
      {v:[1,0,0],  t:"|+⟩ x", c:"#c4b5fd"}, {v:[-1,0,0],t:"|−⟩", c:"#c4b5fd"},
      {v:[0,1,0],  t:"y", c:"#c4b5fd"}, {v:[0,-1,0],t:"", c:"#c4b5fd"}
    ];
    const cAxes = state.hovered==="axes";
    for(const ax of axes){
      const p=project(ax.v,cx,cy,R);
      ctx.strokeStyle = cAxes ? "#ede9fe" : "rgba(196,181,253,.45)";
      ctx.lineWidth = cAxes?2:1.2;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(p.x,p.y); ctx.stroke();
      if(ax.t) label(ax.t, p.x+(p.x>cx?14:-14), p.y+(ax.v[2]>0?-10:14), ax.c, 12);
      pushSeg("axes", cx,cy,p.x,p.y, 9);
    }

    // field / rotation axis n (pink), both directions
    const pn=project(state.bloch.n,cx,cy,R*1.12), pn2=project([-state.bloch.n[0],-state.bloch.n[1],-state.bloch.n[2]],cx,cy,R*1.12);
    ctx.save(); ctx.setLineDash([5,4]);
    arrow(pn2.x,pn2.y, pn.x,pn.y, "#f472b6", state.hovered==="n"?2.6:1.8, state.hovered==="n");
    ctx.restore();
    pushSeg("n", pn2.x,pn2.y,pn.x,pn.y, 11);
    label("n / B", pn.x+12, pn.y-8, "#f472b6", 12);

    // magnetic moment μ : parallel to s, offset
    const mvec = state.bloch.s;
    const pm = project(mvec, cx,cy,R*0.92);
    const offx = 16, offy = 10;
    arrow(cx-offx, cy+offy, pm.x-offx, pm.y+offy, "#fb7185", state.hovered==="mu"?2.6:1.8, state.hovered==="mu");
    pushSeg("mu", cx-offx, cy+offy, pm.x-offx, pm.y+offy, 10);
    label("μ", pm.x-offx-12, pm.y+offy+12, "#fb7185", 12);

    // the Bloch state vector s (primary)
    const ps=project(state.bloch.s,cx,cy,R);
    arrow(cx,cy, ps.x,ps.y, "#a78bfa", state.hovered==="s"?4:3.2, true);
    pushSeg("s", cx,cy,ps.x,ps.y, 13);
    glowDot(ps.x,ps.y,10,"rgba(196,181,253,.9)","rgba(167,139,250,0)");
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(ps.x,ps.y,4,0,7); ctx.fill();
    label("|ψ⟩", ps.x+16, ps.y-6, "#ddd6fe", 13);

    // precession ring around n near tip
    drawPrecessionRing(cx,cy,R);

    // readout text
    const s=state.bloch.s;
    const p0=(1+s[2])/2;
    ctx.save();
    ctx.font="12px ui-monospace, Consolas, monospace"; ctx.fillStyle="#cbd5e1";
    ctx.textAlign="left";
    ctx.fillText("s = ("+s[0].toFixed(2)+", "+s[1].toFixed(2)+", "+s[2].toFixed(2)+")", 20, H-58);
    ctx.fillText("P(0) = cos²(θ/2) = "+p0.toFixed(2)+"    P(1) = "+(1-p0).toFixed(2), 20, H-40);
    ctx.restore();
  }
  function drawPrecessionRing(cx,cy,R){
    // a faint circle (the cone the state sweeps about n) + a moving marker
    const n=state.bloch.n, s=state.bloch.s;
    const ang=Math.acos(Math.max(-1,Math.min(1,dot(n,s))));
    const ringR=Math.sin(ang);
    if(ringR<0.05) return;
    // build basis perpendicular to n
    let u=cross(n,[0,0,1]); if(Math.hypot(u[0],u[1],u[2])<0.01) u=cross(n,[0,1,0]); u=norm(u);
    const w=norm(cross(n,u));
    const center=[n[0]*Math.cos(ang),n[1]*Math.cos(ang),n[2]*Math.cos(ang)];
    ctx.save();
    ctx.strokeStyle = state.hovered==="prec" ? "rgba(249,168,212,.95)" : "rgba(249,168,212,.45)";
    ctx.lineWidth = state.hovered==="prec"?2.4:1.4;
    ctx.beginPath();
    let started=false, lastP=null;
    for(let i=0;i<=60;i++){
      const th=i/60*7;
      const pt=[ center[0]+ringR*(Math.cos(th)*u[0]+Math.sin(th)*w[0]),
                 center[1]+ringR*(Math.cos(th)*u[1]+Math.sin(th)*w[1]),
                 center[2]+ringR*(Math.cos(th)*u[2]+Math.sin(th)*w[2]) ];
      const pp=project(pt,cx,cy,R);
      started?ctx.lineTo(pp.x,pp.y):ctx.moveTo(pp.x,pp.y); started=true; lastP=pp;
    }
    ctx.stroke(); ctx.restore();
    // hot region near the ring marker (use tip projection)
    const ps=project(s,cx,cy,R);
    pushCircle("prec", ps.x, ps.y, 22);
  }

  /* ===================================================================== *
   *  SCENE 4 — MOLECULE / SPIN CLUSTER                                     *
   * ===================================================================== */
  function drawMolecule(cx, cy){
    const sep=Math.min(W,H)*0.26;
    const A={x:cx-sep,y:cy}, B={x:cx+sep,y:cy};
    const wob=Math.sin(state.t*1.1)*8, wob2=Math.cos(state.t*1.1)*8;

    // exchange bond J
    ctx.save();
    ctx.strokeStyle = state.hovered==="J" ? "#bfdbfe" : "rgba(147,197,253,.6)";
    ctx.lineWidth = state.hovered==="J"?4:2.4; ctx.setLineDash([2,6]);
    ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();
    ctx.restore();
    pushSeg("J", A.x,A.y,B.x,B.y, 11);
    label("J  (exchange)", cx, cy-14, "#93c5fd", 12);

    // Rydberg interaction V — shaded blockade radius
    ctx.save();
    const vg=ctx.createRadialGradient(cx,cy,10,cx,cy,sep*1.15);
    vg.addColorStop(0,"rgba(167,139,250,.04)");
    vg.addColorStop(0.7, state.hovered==="V"?"rgba(167,139,250,.18)":"rgba(167,139,250,.08)");
    vg.addColorStop(1,"rgba(167,139,250,0)");
    ctx.fillStyle=vg; ctx.beginPath(); ctx.ellipse(cx,cy,sep*1.15,sep*0.7,0,0,7); ctx.fill();
    ctx.restore();
    pushRect("V", cx-sep*0.5, cy+30, sep, 40);
    label("Vᵢⱼ  (Rydberg blockade)", cx, cy+52, "#c4b5fd", 11);

    // ionic electron transfer A -> B (arc above)
    ctx.save();
    ctx.strokeStyle = state.hovered==="ionic" ? "#fecaca" : "rgba(248,113,113,.7)";
    ctx.lineWidth = state.hovered==="ionic"?2.6:1.8;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y-46);
    ctx.quadraticCurveTo(cx, cy-120, B.x, B.y-46);
    ctx.stroke();
    // arrowhead near B
    arrow(cx+sep*0.55, cy-92, B.x-6, B.y-50, state.hovered==="ionic"?"#fecaca":"rgba(248,113,113,.8)", 2, false);
    ctx.restore();
    pushSeg("ionic", A.x,A.y-46, cx, cy-120, 16);
    pushSeg("ionic", cx,cy-120, B.x,B.y-46, 16);
    label("e⁻ transfer", cx, cy-126, "#f87171", 11);

    // atom A (spin i) with cluster decomposition (small spins summing to S)
    drawAtom(A.x, A.y, "#60a5fa", "i  (+)", true, wob);
    // atom B (spin j)
    drawAtom(B.x, B.y, "#60a5fa", "j  (−)", false, wob2);

    // DM twist indicator between spins
    ctx.save();
    ctx.strokeStyle = state.hovered==="D" ? "#7dd3fc" : "rgba(56,189,248,.6)";
    ctx.lineWidth = state.hovered==="D"?2.4:1.6;
    ctx.beginPath(); ctx.arc(cx, cy+2, 18, -0.3, 3.6); ctx.stroke();
    arrow(cx+14, cy+14, cx+6, cy+24, state.hovered==="D"?"#7dd3fc":"rgba(56,189,248,.7)",1.6,false);
    ctx.restore();
    pushCircle("D", cx, cy+2, 22);
    label("D ×", cx+30, cy+6, "#38bdf8", 11);
  }
  function drawAtom(x, y, color, tag, withCluster, wob){
    glowDot(x,y,30,"rgba(96,165,250,.30)","rgba(96,165,250,0)");
    ctx.fillStyle="#0c1322"; ctx.strokeStyle=color; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(x,y,20,0,7); ctx.fill(); ctx.stroke();
    label(tag, x, y+34, "#9cc4ff", 11);
    // big spin S
    const hotS = state.hovered==="S";
    arrow(x, y, x+wob*0.4, y-58, color, hotS?3.4:2.6, hotS);
    pushSeg("S", x, y, x+wob*0.4, y-58, 12);
    label("S", x+12+wob*0.4, y-58, color, 13);
    // cluster of small spins
    if(withCluster && hotS){
      for(let i=0;i<3;i++){
        const dx=(i-1)*7;
        arrow(x+dx, y, x+dx+wob*0.3, y-30, "rgba(147,197,253,.8)", 1.4, false);
      }
      label("= Σ sₐ", x-2, y-72, "#93c5fd", 11);
    }
  }

  /* ===================================================================== *
   *  SCENE 5 — NUCLEUS / QUARKS (proton = uud + gluons)                   *
   * ===================================================================== */
  function drawSpring(x1,y1,x2,y2,amp){
    const segs=16, dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy)||1, nx=-dy/len, ny=dx/len;
    ctx.beginPath();
    for(let i=0;i<=segs;i++){
      const u=i/segs, bx=x1+dx*u, by=y1+dy*u;
      const off=Math.sin(u*Math.PI*6 + state.t*4)*amp*Math.sin(u*Math.PI);
      const x=bx+nx*off, y=by+ny*off; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  function drawPhoton(cx,cy,R){
    const hot=state.hovered==="photon";
    const x0=cx, y0=cy-R*0.15, x1=cx-R*1.55, y1=cy-R*1.0;
    const dx=x1-x0, dy=y1-y0, len=Math.hypot(dx,dy)||1, nx=-dy/len, ny=dx/len;
    ctx.save();
    ctx.strokeStyle= hot?"#a5f3fc":"rgba(34,211,238,.8)"; ctx.lineWidth=hot?2.8:1.9;
    if(hot){ ctx.shadowColor="#22d3ee"; ctx.shadowBlur=10; }
    ctx.beginPath();
    for(let i=0;i<=44;i++){ const u=i/44, bx=x0+dx*u, by=y0+dy*u;
      const off=Math.sin(u*Math.PI*10 - state.t*5)*7;
      const x=bx+nx*off, y=by+ny*off; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.stroke(); ctx.restore();
    arrow(x0+dx*0.8, y0+dy*0.8, x1, y1, hot?"#a5f3fc":"rgba(34,211,238,.85)", hot?2.6:1.9, false);
    label("γ", x1-4, y1-10, "#67e8f9", 13);
    pushSeg("photon", x0,y0,x1,y1, 12);
  }
  function drawNucleus(cx, cy){
    const R = Math.min(W,H)*0.24, t = state.t;
    // Higgs field background (faint mist) + hotspot
    ctx.save();
    ctx.globalAlpha = state.hovered==="higgs"?0.55:0.28;
    ctx.fillStyle="rgba(232,121,249,.55)";
    for(let i=0;i<44;i++){
      const a=i*2.4+t*0.15, rr=R*1.8*(0.35+0.65*(((i*37)%100)/100));
      const x=cx+Math.cos(a)*rr, y=cy+Math.sin(a)*rr*0.7;
      ctx.beginPath(); ctx.arc(x,y,2.4,0,7); ctx.fill();
    }
    ctx.restore();
    drawBadge("higgs","Higgs field → mass", cx-R*1.55, cy-R*1.25, 176, state.hovered==="higgs", "#f0abfc");

    // proton bag
    glowDot(cx,cy,R*0.95,"rgba(239,68,68,.14)","rgba(239,68,68,0)");
    ctx.save(); ctx.setLineDash([4,5]); ctx.lineWidth=1.6;
    ctx.strokeStyle="rgba(239,68,68,.55)";
    ctx.beginPath(); ctx.arc(cx,cy,R*0.62,0,7); ctx.stroke(); ctx.restore();
    label("proton  (uud)", cx, cy-R*0.62-14, "#fca5a5", 12);

    // three quarks orbiting inside the bag
    const quarks=[{n:"u",c:"#f87171"},{n:"u",c:"#fbbf24"},{n:"d",c:"#60a5fa"}];
    const qpos = quarks.map((q,i)=>{
      const a=t*0.7 + i*2.0944, rr=R*0.33*(1+0.14*Math.sin(t*1.3+i));
      return { x:cx+Math.cos(a)*rr, y:cy+Math.sin(a)*rr, q };
    });
    // gluon springs between quark pairs
    const hotG=state.hovered==="gluon";
    ctx.save();
    ctx.strokeStyle= hotG?"#fcd34d":"rgba(245,158,11,.75)"; ctx.lineWidth=hotG?2.6:1.8;
    if(hotG){ ctx.shadowColor="#f59e0b"; ctx.shadowBlur=8; }
    for(let i=0;i<3;i++){ const a=qpos[i], b=qpos[(i+1)%3];
      drawSpring(a.x,a.y,b.x,b.y, hotG?7:5); pushSeg("gluon", a.x,a.y,b.x,b.y, 10); }
    ctx.restore();
    if(hotG) label("gluons", cx, cy+R*0.5, "#fcd34d", 11);

    // quarks
    const hotQ=state.hovered==="quarks";
    qpos.forEach(p=>{
      glowDot(p.x,p.y, hotQ?17:13, p.q.c, "rgba(0,0,0,0)");
      ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(p.x,p.y,hotQ?7:5.5,0,7); ctx.fill();
      label(p.q.n, p.x, p.y+0.5, "#0b1020", 12);
      pushCircle("quarks", p.x,p.y, 15);
    });

    // outgoing photon (QED)
    drawPhoton(cx,cy,R);

    // neighbouring neutron + strong (pion-exchange) bond
    const nx=cx+R*1.55, ny=cy;
    glowDot(nx,ny,R*0.55,"rgba(14,165,233,.14)","rgba(14,165,233,0)");
    ctx.save(); ctx.setLineDash([3,4]); ctx.lineWidth=1.5;
    ctx.strokeStyle="rgba(14,165,233,.55)";
    ctx.beginPath(); ctx.arc(nx,ny,R*0.42,0,7); ctx.stroke(); ctx.restore();
    label("neutron (udd)", nx, ny-R*0.42-12, "#7dd3fc", 11);
    const hotStr=state.hovered==="strong";
    arrow(cx+R*0.64, cy, nx-R*0.44, ny, hotStr?"#38bdf8":"rgba(14,165,233,.85)", hotStr?3:2, hotStr);
    arrow(nx-R*0.44, ny, cx+R*0.64, cy, hotStr?"#38bdf8":"rgba(14,165,233,.85)", hotStr?3:2, hotStr);
    pushSeg("strong", cx+R*0.64, cy, nx-R*0.44, ny, 13);
    label("π exchange", (cx+nx)/2+R*0.05, cy+16, "#7dd3fc", 10);

    // mass badge (E = mc^2)
    drawBadge("mass","≈99% of mass = gluon energy  (E=mc²)", cx-130, cy+R*0.9, 260, state.hovered==="mass", "#a3e635");

    // central label
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(cx,cy,3,0,7); ctx.fill();
  }

  /* ===================================================================== *
   *  MAIN RENDER                                                          *
   * ===================================================================== */
  function frame(){
    if(!canvas) return;
    ctx.clearRect(0,0,W,H);
    state.hits.length=0;
    if(state.playing) state.t += 0.016;
    const cx=W*0.5, cy=H*0.52;

    if(state.scene==="classical") drawClassical(cx,cy);
    else if(state.scene==="quantum") drawQuantum(cx,cy);
    else if(state.scene==="bloch") drawBloch(cx,cy);
    else if(state.scene==="molecule") drawMolecule(cx,cy);
    else if(state.scene==="nucleus") drawNucleus(cx,cy);

    // floating tooltip
    const active = state.hovered;
    if(active && state.mouse.inside){
      showTip(active, state.mouse.x, state.mouse.y);
    } else { tipEl.style.display="none"; }

    raf=requestAnimationFrame(frame);
  }

  function showTip(vecKey, mx, my){
    const vec = currentVectors().find(v=>v.key===vecKey);
    if(!vec){ tipEl.style.display="none"; return; }
    const first = KN.byId[vec.nodes[0]];
    tipEl.innerHTML = '<div class="t-name">'+esc(vec.label)+'</div>'+
      '<div class="t-eq">'+ window.TeX.renderToString(first.latex||first.name, false) +'</div>'+
      '<div style="color:var(--text-faint);font-size:11px;margin-top:4px">click chip to pin · '+vec.nodes.length+' equation'+(vec.nodes.length>1?'s':'')+'</div>';
    tipEl.style.display="block";
    const tw=tipEl.offsetWidth, th=tipEl.offsetHeight;
    let x=mx+16, y=my+16;
    if(x+tw>W) x=mx-tw-16; if(y+th>H) y=my-th-16;
    tipEl.style.left=x+"px"; tipEl.style.top=y+"px";
  }

  /* ----------------------------- scene helpers ------------------------- */
  function currentVectors(){ return KN.scenes[state.scene].vectors; }

  function setScene(key){
    state.scene=key; state.hovered=null; state.pinned=null;
    if(key==="quantum") cloudPts=null;
    // scene buttons
    [...document.querySelectorAll("#sceneBar button")].forEach(b=>b.classList.toggle("active", b.dataset.scene===key));
    document.getElementById("sceneTagline").textContent = KN.scenes[key].tagline;
    document.getElementById("gateBar").classList.toggle("show", key==="bloch");
    buildLegend();
    resetDetail();
  }

  function buildSceneBar(){
    const bar=document.getElementById("sceneBar"); bar.innerHTML="";
    for(const k in KN.scenes){
      const b=document.createElement("button");
      b.dataset.scene=k; b.textContent=KN.scenes[k].label;
      b.className = k===state.scene?"active":"";
      b.onclick=()=>setScene(k);
      bar.appendChild(b);
    }
  }
  function buildLegend(){
    const leg=document.getElementById("vecLegend"); leg.innerHTML="";
    for(const v of currentVectors()){
      const c=document.createElement("div"); c.className="chip"; c.dataset.key=v.key;
      c.innerHTML='<span class="sw" style="background:'+v.color+'"></span>'+esc(v.label);
      c.onmouseenter=()=>{ state.hovered=v.key; };
      c.onmouseleave=()=>{ if(!state.pinned) state.hovered=null; };
      c.onclick=()=>{ state.pinned=v.key; state.hovered=v.key; selectVector(v.key); };
      leg.appendChild(c);
    }
  }
  function buildGateBar(){
    const bar=document.getElementById("gateBar"); bar.innerHTML="";
    const gates=KN.scenes.bloch.gates;
    const angles={X:[ [1,0,0],Math.PI],Y:[[0,1,0],Math.PI],Z:[[0,0,1],Math.PI],
                  H:[[1,0,1],Math.PI],S:[[0,0,1],Math.PI/2],T:[[0,0,1],Math.PI/4]};
    bar.insertAdjacentHTML("beforeend",'<div class="hint">apply a gate → watch |ψ⟩ rotate</div>');
    gates.forEach(g=>{
      const b=document.createElement("button"); b.textContent=g; b.title=g+" gate";
      b.onclick=()=>{ const [ax,ang]=angles[g]; applyGate(ax,ang); };
      bar.appendChild(b);
    });
    const r=document.createElement("button"); r.className="reset"; r.textContent="reset |0⟩";
    r.onclick=()=>{ state.bloch.s=[0,0,1]; state.bloch.anim=null; }; bar.appendChild(r);
  }
  function applyGate(axis, angle){
    state.bloch.anim={ axis:norm(axis), total:angle, done:0, rate:0.07, dir:1 };
  }

  /* ----------------------------- selection / detail -------------------- */
  function selectVector(key){
    const vec=currentVectors().find(v=>v.key===key); if(!vec) return;
    document.getElementById("detailTitle").textContent=vec.label;
    window.UI.renderEqCardsInto(document.getElementById("detailBody"), vec.nodes);
    [...document.querySelectorAll("#vecLegend .chip")].forEach(c=>c.classList.toggle("hot", c.dataset.key===key));
  }
  function resetDetail(){
    document.getElementById("detailTitle").textContent="Hover a vector";
    document.getElementById("detailBody").innerHTML=
      '<p class="placeholder">Move your cursor over any arrow on the atom (or click a chip on the left). '+
      'Each vector reveals the real equation behind it, what it makes the atom <em>do</em>, the variables, '+
      'and which source paper it came from.</p>';
    [...document.querySelectorAll("#vecLegend .chip")].forEach(c=>c.classList.remove("hot"));
  }

  /* ----------------------------- events -------------------------------- */
  function onMove(e){
    const r=canvas.getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;
    state.mouse.x=x; state.mouse.y=y; state.mouse.inside=true;
    const hit=hitTest(x,y);
    if(hit!==state.hovered){
      state.hovered=hit || state.pinned;
      const show = hit || state.pinned;
      if(show) selectVector(show);
      // sync chip highlight
      [...document.querySelectorAll("#vecLegend .chip")].forEach(c=>c.classList.toggle("hot", c.dataset.key===show));
    }
    canvas.style.cursor = hit ? "pointer" : "crosshair";
  }
  function onLeave(){ state.mouse.inside=false; if(!state.pinned) state.hovered=null; }
  function onClick(e){
    const r=canvas.getBoundingClientRect();
    const hit=hitTest(e.clientX-r.left, e.clientY-r.top);
    if(hit){ state.pinned=hit; selectVector(hit); }
    else { state.pinned=null; resetDetail(); }
  }

  function resize(){
    const wrap=canvas.parentElement;
    W=wrap.clientWidth; H=wrap.clientHeight;
    DPR=Math.min(window.devicePixelRatio||1, 2);
    canvas.width=W*DPR; canvas.height=H*DPR;
    canvas.style.width=W+"px"; canvas.style.height=H+"px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  function init(){
    canvas=document.getElementById("atomCanvas");
    ctx=canvas.getContext("2d");
    tipEl=document.getElementById("canvasTip");
    resize();
    window.addEventListener("resize", ()=>{ if(document.getElementById("view-lab").classList.contains("active")) resize(); });
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("click", onClick);
    document.getElementById("playToggle").onclick=(e)=>{
      state.playing=!state.playing;
      e.target.textContent = state.playing ? "⏸ pause motion" : "▶ resume motion";
    };
    buildSceneBar(); buildGateBar(); setScene("classical");
    frame();
  }

  function esc(s){ return String(s).replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

  window.AtomLab={ init, setScene, _resize:()=>resize() };
})();
