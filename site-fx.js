/**
 * site-fx.js — drop this ONE script into every page
 * Add to any page with:  <script src="../site-fx.js"></script>   (posts)
 *                         <script src="site-fx.js"></script>      (root pages)
 *
 * What it does:
 *  1. Injects a <canvas id="bg"> and positions it fixed behind everything
 *  2. Starts the Three.js 3-tier node graph (same as index.html)
 *  3. Adds CRT scanline overlay via CSS
 *  4. Adds a green reading-progress bar (top of page)
 *  5. Scroll-reveals any element with class "rv"
 *  6. Stagger-reveals all direct children of .post-body
 *  7. Draws the left-border line on .entry and .post-item as they scroll in
 *  8. Animated divider scan line
 *  9. Typed cursor blink on any element with id="tcur"
 */
(function () {
  /* ── 1. CANVAS ──────────────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-fx';
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', zIndex: '0', pointerEvents: 'none'
  });
  document.body.prepend(canvas);

  /* ── 2. CSS INJECTIONS ──────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    nav,section,article,div.blog-page-header,ul.post-list,footer,h1,p,header
      { position:relative; z-index:2; }
    body::after {
      content:''; position:fixed; inset:0; z-index:1; pointer-events:none;
      background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.055) 2px,rgba(0,0,0,.055) 4px);
    }
    #read-prog {
      position:fixed; top:0; left:0; height:2px; width:0%;
      background:#98c379; z-index:999;
      box-shadow:0 0 8px #98c37966;
      transition:width .1s linear;
    }
    .rv { opacity:0; transform:translateY(10px); transition:opacity .4s ease,transform .4s ease; transition-delay:var(--d,0s); }
    .rv.on { opacity:1; transform:none; }
    .post-body>* { opacity:0; transform:translateY(8px); transition:opacity .38s ease,transform .38s ease; }
    .post-body>.on { opacity:1; transform:none; }
    .entry,.post-item { position:relative; }
    .entry::before,.post-item::before {
      content:''; position:absolute; left:0; top:0; bottom:0; width:2px;
      background:#98c379; transform:scaleY(0); transform-origin:top; transition:transform .32s ease;
    }
    .entry.on::before,.post-item.on::before { transform:scaleY(1); }
    .post-item { transition:padding-left .15s ease; }
    .post-item:hover { padding-left:10px; }
    .post-item:hover .post-link { color:var(--green,#98c379); }
    .divider::after {
      background:linear-gradient(90deg,#1e1e1e 0%,#98c37944 50%,#1e1e1e 100%);
      background-size:200% 100%; animation:scanfx 3s linear infinite;
    }
    .post-body h2 { position:relative; display:inline-block; }
    .post-body h2::after { content:''; position:absolute; left:0; bottom:-2px; height:1px; width:100%; background:linear-gradient(90deg,#e5c07b,transparent); }
    .post-body blockquote { animation:bqpulse 4s ease-in-out infinite; }
    @keyframes scanfx { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    @keyframes bqpulse { 0%,100%{border-left-color:#e5c07b} 50%{border-left-color:#98c37988} }
    @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0} }
    #tcur { display:inline-block; width:9px; height:1em; background:#98c379; vertical-align:middle; margin-left:2px; animation:blink 1.1s step-end infinite; }
  `;
  document.head.appendChild(style);

  /* ── 3. PROGRESS BAR ────────────────────────── */
  const prog = document.createElement('div');
  prog.id = 'read-prog';
  document.body.prepend(prog);
  window.addEventListener('scroll', () => {
    const d = document.documentElement;
    prog.style.width = Math.min((d.scrollTop / (d.scrollHeight - d.clientHeight)) * 100, 100) + '%';
  }, { passive: true });

  /* ── 4. THREE.JS ────────────────────────────── */
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  s.onload = () => {
    const W = () => window.innerWidth, H = () => window.innerHeight;
    const rend = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    rend.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    rend.setSize(W(), H());
    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(55, W() / H(), .1, 300);
    cam.position.z = 60;
    const GREEN = 0x98c379, AMBER = 0xe5c07b, BLUE = 0x61afef;
    const nodes = [];
    const cfg = [
      { n: 4,  r: .55, c: GREEN, op: .85, sx: 44, sy: 32, spd: .012 },
      { n: 14, r: .28, c: AMBER, op: .55, sx: 50, sy: 38, spd: .009 },
      { n: 28, r: .13, c: BLUE,  op: .30, sx: 56, sy: 42, spd: .006 }
    ];
    cfg.forEach(({ n, r, c, op, sx, sy, spd }, ti) => {
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(r, 9, 9),
          new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op })
        );
        const pos = new THREE.Vector3((Math.random() - .5) * sx * 2, (Math.random() - .5) * sy * 2, (Math.random() - .5) * 16 - 6);
        const vel = new THREE.Vector3((Math.random() - .5) * spd, (Math.random() - .5) * spd * .7, 0);
        m.position.copy(pos);
        sc.add(m);
        const nd = { m, pos, vel, tier: ti, phase: Math.random() * Math.PI * 2 };
        if (ti === 0) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(.75, .83, 32),
            new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: .16, side: THREE.DoubleSide })
          );
          ring.rotation.x = Math.PI / 2; m.add(ring); nd.ring = ring;
        }
        nodes.push(nd);
      }
    });
    const DISTS = [30, 18, 10];
    const N = nodes.length;
    const eV = new Float32Array(N * N * 6);
    const eG = new THREE.BufferGeometry();
    eG.setAttribute('position', new THREE.BufferAttribute(eV, 3));
    sc.add(new THREE.LineSegments(eG, new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: .09 })));
    let scrollY = 0, t = 0;
    const mouse = new THREE.Vector2();
    const tmp = new THREE.Vector3();
    window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
    window.addEventListener('mousemove', e => { mouse.x = (e.clientX / W() - .5) * 2; mouse.y = -(e.clientY / H() - .5) * 2; });
    window.addEventListener('resize', () => { rend.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); });
    (function tick() {
      requestAnimationFrame(tick); t += .016;
      nodes.forEach(nd => {
        nd.pos.addScaledVector(nd.vel, 1);
        const bx = 56 + nd.tier * 6, by = 42 + nd.tier * 4;
        if (nd.pos.x > bx) nd.pos.x = -bx; if (nd.pos.x < -bx) nd.pos.x = bx;
        if (nd.pos.y > by) nd.pos.y = -by; if (nd.pos.y < -by) nd.pos.y = by;
        nd.m.position.copy(nd.pos);
        if (nd.tier === 0) { const s = 1 + .18 * Math.sin(t * 1.2 + nd.phase); nd.m.scale.setScalar(s); if (nd.ring) nd.ring.rotation.z += .008; }
        if (nd.tier === 1) nd.m.position.y += .035 * Math.sin(t * .8 + nd.phase);
      });
      let ei = 0;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = nodes[i], b = nodes[j];
        tmp.subVectors(a.pos, b.pos);
        if (tmp.length() < DISTS[Math.min(a.tier, b.tier)]) {
          eV[ei++]=a.pos.x; eV[ei++]=a.pos.y; eV[ei++]=a.pos.z;
          eV[ei++]=b.pos.x; eV[ei++]=b.pos.y; eV[ei++]=b.pos.z;
        }
      }
      for (let k = ei; k < eV.length; k++) eV[k] = 0;
      eG.attributes.position.needsUpdate = true;
      eG.setDrawRange(0, ei / 3);
      cam.position.y += (-scrollY * .008 - cam.position.y) * .08;
      cam.position.x += (mouse.x * 1.8 - cam.position.x) * .02;
      cam.lookAt(0, cam.position.y, 0);
      rend.render(sc, cam);
    })();
  };
  document.head.appendChild(s);

  /* ── 5–8. OBSERVERS ─────────────────────────── */
  window.addEventListener('DOMContentLoaded', () => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
    }, { threshold: .07 });
    document.querySelectorAll('.rv, .entry, .post-item').forEach(el => io.observe(el));
    document.querySelectorAll('.post-body > *').forEach((el, i) => {
      el.style.transitionDelay = (i * 0.045) + 's';
      io.observe(el);
    });
    /* cursor hide */
    const tcur = document.getElementById('tcur');
    if (tcur) setTimeout(() => { tcur.style.display = 'none'; }, 2400);
  });
})();
