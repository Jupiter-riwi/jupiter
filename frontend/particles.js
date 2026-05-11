/* ============================================================
   APEX VISION — Ambient Particle Network
   Echoes computer-vision feature points: nodes + connections.
   ============================================================ */
(function () {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');

  let DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const particles = [];
  const COUNT = 70;
  const MAX_DIST = 160;
  const MOUSE_DIST = 220;

  const mouse = { x: -9999, y: -9999, active: false };

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function spawn() {
    particles.length = 0;
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.2 + 0.4,
        a: Math.random() * 0.35 + 0.15,
      });
    }
  }

  function step() {
    ctx.clearRect(0, 0, W, H);

    // Update positions
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      // Mouse repulsion (gentle)
      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_DIST * MOUSE_DIST) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / MOUSE_DIST) * 0.6;
          p.x += (dx / d) * f;
          p.y += (dy / d) * f;
        }
      }

      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;
    }

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MAX_DIST * MAX_DIST) {
          const alpha = (1 - Math.sqrt(d2) / MAX_DIST) * 0.18;
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Mouse line
      if (mouse.active) {
        const dx = a.x - mouse.x;
        const dy = a.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_DIST * MOUSE_DIST) {
          const alpha = (1 - Math.sqrt(d2) / MOUSE_DIST) * 0.35;
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const p of particles) {
      ctx.fillStyle = `rgba(255,255,255,${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(step);
  }

  window.addEventListener('resize', () => { resize(); });
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
  });
  window.addEventListener('mouseleave', () => { mouse.active = false; });

  resize();
  spawn();
  step();
})();

/* ============================================================
   FEED CANVAS — animated camera feed placeholder
   Generates a moving scene in pure greys, w/ scanlines.
   ============================================================ */
window.AVFeed = function (canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const seed = opts.seed || 1;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H, t = 0;

  function rs() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Pseudorandom from seed
  function rng(n) {
    const x = Math.sin(seed * 999 + n * 17.31) * 43758.5453;
    return x - Math.floor(x);
  }

  function draw() {
    if (!W) rs();
    t += 0.005;

    // Sky / floor gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const tone = 0.06 + rng(0) * 0.05;
    g.addColorStop(0, `rgba(${tone*255},${tone*255},${tone*255},1)`);
    g.addColorStop(1, `rgba(${(tone-0.02)*255},${(tone-0.02)*255},${(tone-0.02)*255},1)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Distant horizon / structures
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 6; i++) {
      const x = (rng(i + 1) * W);
      const w = 30 + rng(i + 9) * 80;
      const h = 40 + rng(i + 17) * 100;
      ctx.fillRect(x, H * 0.55 - h, w, h);
    }

    // Floor grid (perspective)
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const horizon = H * 0.55;
    for (let i = 1; i < 8; i++) {
      const y = horizon + (i / 8) * (H - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let i = -4; i <= 4; i++) {
      const x = W / 2 + i * 60;
      ctx.beginPath();
      ctx.moveTo(W / 2, horizon);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Moving silhouettes (people/objects)
    const tracks = opts.tracks || 2;
    for (let i = 0; i < tracks; i++) {
      const phase = (t + rng(i + 30)) % 1;
      const x = phase * W;
      const y = horizon + 30 + rng(i + 40) * 80;
      const sz = 20 + rng(i + 50) * 18;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      // body
      ctx.fillRect(x - sz * 0.18, y - sz * 1.2, sz * 0.36, sz * 1.2);
      // head
      ctx.beginPath();
      ctx.arc(x, y - sz * 1.35, sz * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scanline + vignette
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    const sl = ((t * 200) % H);
    ctx.fillRect(0, sl, W, 1);

    // Vignette
    const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.2, W/2, H/2, Math.max(W,H)*0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(draw);
  }
  rs();
  window.addEventListener('resize', rs);
  draw();
};

/* ============================================================
   SPARKLINE
   ============================================================ */
window.AVSpark = function (svg, data, opts = {}) {
  const w = 200, h = 28;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const fill = `${d} L${w},${h} L0,${h} Z`;
  svg.innerHTML = `
    <defs>
      <linearGradient id="sg-${opts.id||'x'}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(255,255,255,0.25)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </linearGradient>
    </defs>
    <path d="${fill}" fill="url(#sg-${opts.id||'x'})"/>
    <path d="${d}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1"/>
  `;
};
