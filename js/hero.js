/* ============================================================================
 *  HERO.JS  —  the 3D landing overlay
 *  ----------------------------------------------------------------------------
 *  A glowing rotating atom (nucleus + electron orbits + starfield) rendered with
 *  three.js, sitting behind a frosted-glass "launch" card. Clicking Launch fades
 *  the overlay away and reveals the lab. Degrades gracefully: if WebGL/three is
 *  unavailable, the CSS gradient stays and the card still works.
 * ========================================================================== */
(function () {
  "use strict";

  function launchWireup() {
    const hero = document.getElementById("hero");
    const btn = document.getElementById("heroLaunch");
    if (!hero || !btn) return;
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return; dismissed = true;
      hero.classList.add("hidden");
      window.__heroRunning = false;
      // nudge the active view to (re)size now that it's visible
      setTimeout(() => { try { window.dispatchEvent(new Event("resize")); } catch (e) { } }, 60);
      setTimeout(() => { if (hero && hero.parentNode) hero.style.display = "none"; }, 900);
    };
    btn.addEventListener("click", dismiss);
    document.addEventListener("keydown", e => { if (e.key === "Escape" || e.key === "Enter") dismiss(); });
  }

  function initScene() {
    const canvas = document.getElementById("heroCanvas");
    if (!canvas || typeof THREE === "undefined") return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) { return; } // no WebGL → CSS backdrop remains
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    const atom = new THREE.Group();
    scene.add(atom);

    // --- soft radial glow sprite texture (shared) ---
    function glowTexture() {
      const s = 128, c = document.createElement("canvas"); c.width = c.height = s;
      const g = c.getContext("2d");
      const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.25, "rgba(255,255,255,0.85)");
      grd.addColorStop(0.55, "rgba(255,255,255,0.28)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
      const t = new THREE.CanvasTexture(c); return t;
    }
    const GLOW = glowTexture();
    function glow(color, scale) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.scale.setScalar(scale);
      return sp;
    }

    // --- nucleus: bright core + additive halo ---
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 2),
      new THREE.MeshBasicMaterial({ color: 0xbfeaff })
    );
    atom.add(core);
    const halo = glow(0x38bdf8, 3.1); atom.add(halo);
    const haloInner = glow(0xa78bfa, 1.7); atom.add(haloInner);

    // --- electron orbits: tilted rings + orbiting glow electrons ---
    const ORBIT_COLORS = [0x22d3ee, 0xa78bfa, 0xf472b6];
    const orbits = [];
    const tilts = [
      { rx: 1.15, ry: 0.35, ax: 0.0, ay: 0.0, az: 0.0 },
      { rx: 1.15, ry: 0.35, ax: 1.15, ay: 0.5, az: 0.4 },
      { rx: 1.15, ry: 0.35, ax: -1.0, ay: -0.6, az: -0.5 }
    ];
    tilts.forEach((t, i) => {
      const R = 1.7 + i * 0.55;
      const pts = [];
      for (let a = 0; a <= 128; a++) { const th = a / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(th) * R, Math.sin(th) * R, 0)); }
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: ORBIT_COLORS[i], transparent: true, opacity: 0.32 })
      );
      const g = new THREE.Group();
      g.rotation.set(t.ax, t.ay, t.az);
      g.add(ring);
      // one or two electrons per orbit
      const nE = i === 1 ? 2 : 1;
      const electrons = [];
      for (let k = 0; k < nE; k++) {
        const e = glow(ORBIT_COLORS[i], 0.62);
        g.add(e);
        electrons.push({ sprite: e, R: R, phase: (k / nE) * Math.PI * 2 + i, speed: 0.7 - i * 0.14 });
      }
      atom.add(g);
      orbits.push({ group: g, electrons: electrons, spin: 0.12 + i * 0.03 });
    });

    // --- faint starfield for depth ---
    const starN = 420, spos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 14 + Math.random() * 20, u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      spos[i * 3] = r * s * Math.cos(th); spos[i * 3 + 1] = r * s * Math.sin(th); spos[i * 3 + 2] = r * u;
    }
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(spos, 3)),
      new THREE.PointsMaterial({ color: 0x9fc4ff, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false })
    );
    scene.add(stars);

    // --- resize ---
    function resize() {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    // --- gentle mouse parallax ---
    let tx = 0, ty = 0;
    window.addEventListener("pointermove", e => {
      tx = (e.clientX / window.innerWidth - 0.5) * 0.5;
      ty = (e.clientY / window.innerHeight - 0.5) * 0.5;
    });

    // --- animate ---
    window.__heroRunning = true;
    let t = 0;
    function frame() {
      if (!window.__heroRunning) { renderer.dispose && renderer.dispose(); return; }
      requestAnimationFrame(frame);
      t += 0.016;
      atom.rotation.y += 0.0032;
      atom.rotation.x += 0.0011;
      const pulse = 1 + Math.sin(t * 1.8) * 0.06;
      halo.scale.setScalar(3.1 * pulse);
      haloInner.scale.setScalar(1.7 * pulse);
      core.rotation.y -= 0.004; core.rotation.x += 0.002;
      orbits.forEach(o => {
        o.group.rotation.z += o.spin * 0.01;
        o.electrons.forEach(el => {
          el.phase += el.speed * 0.03;
          el.sprite.position.set(Math.cos(el.phase) * el.R, Math.sin(el.phase) * el.R, 0);
        });
      });
      stars.rotation.y += 0.0004;
      // smooth camera parallax
      camera.position.x += (tx * 1.6 - camera.position.x) * 0.05;
      camera.position.y += (-ty * 1.2 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    frame();
  }

  function boot() { launchWireup(); initScene(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
