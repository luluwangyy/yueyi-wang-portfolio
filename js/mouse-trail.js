// Homepage-only: a Tiffany-blue line traces the cursor's exact path, like
// ink from a pen — a full-viewport canvas overlay, decorative only
// (pointer-events are disabled so it never intercepts clicks). Skipped
// entirely under prefers-reduced-motion.
//
// Deliberately NOT a spring/eased follower — the line's head sits exactly
// at the current cursor position with no lag. Each short segment fades out
// on its own after a beat, based on its own age, the way ink dries.

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const TIFFANY_BLUE = "77, 200, 224"; // #4DC8E0 — lighter, more blue-leaning
  const TRAIL_LIFETIME_MS = 350;
  const LINE_WIDTH = 2.5;

  const canvas = document.createElement("canvas");
  canvas.id = "mouse-trail-canvas";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "9999"
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  let points = [];
  let lastX = null;
  let lastY = null;

  window.addEventListener("mousemove", (event) => {
    const x = event.clientX;
    const y = event.clientY;
    const now = performance.now();
    // Fill in a fast flick's gap with interpolated points, spaced closely,
    // so the "ink" reads as one continuous stroke rather than a dashed one.
    if (lastX !== null) {
      const dist = Math.hypot(x - lastX, y - lastY);
      const steps = Math.min(Math.floor(dist / 4), 20);
      for (let i = 1; i <= steps; i++) {
        const t = i / (steps + 1);
        points.push({ x: lastX + (x - lastX) * t, y: lastY + (y - lastY) * t, t: now });
      }
    }
    points.push({ x, y, t: now });
    lastX = x;
    lastY = y;
  });

  function draw() {
    const now = performance.now();
    points = points.filter((p) => now - p.t < TRAIL_LIFETIME_MS);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = LINE_WIDTH;

    // Each segment fades on its own, by its own age — a true "drying ink"
    // look, rather than one gradient smeared across the whole visible
    // length regardless of how the mouse actually moved.
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i];
      const next = points[i + 1];
      const age = now - p.t;
      const alpha = Math.max(0, 1 - age / TRAIL_LIFETIME_MS) * 0.9;
      if (alpha <= 0.01) continue;
      ctx.strokeStyle = `rgba(${TIFFANY_BLUE}, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}
