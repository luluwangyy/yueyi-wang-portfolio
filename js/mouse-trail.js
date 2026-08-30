// Homepage-only: a Tiffany-blue line traces the cursor's exact path, like
// ink from a pen — a full-viewport canvas overlay, decorative only
// (pointer-events are disabled so it never intercepts clicks). Skipped
// entirely under prefers-reduced-motion.
//
// Deliberately NOT a spring/eased follower — the line's head sits exactly
// at the current cursor position with no lag. The whole visible trail is
// drawn as a single continuous stroke (not many tiny segments — that
// produced a "beaded" look, since every 2-point segment gets its own
// round cap at both ends) with a curved, quadratic-smoothed path and a
// fade gradient from tail to head, so width and texture stay consistent
// along its length.

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const TIFFANY_BLUE = "77, 200, 224"; // #4DC8E0 — lighter, more blue-leaning
  const TRAIL_LIFETIME_MS = 650;
  const LINE_WIDTH = 2.5;
  const SMOOTHING = 0.4; // how much pull toward the previous smoothed point

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
  let smoothX = null;
  let smoothY = null;

  function addPoint(rawX, rawY, now) {
    if (smoothX === null) {
      smoothX = rawX;
      smoothY = rawY;
    } else {
      smoothX += (rawX - smoothX) * (1 - SMOOTHING);
      smoothY += (rawY - smoothY) * (1 - SMOOTHING);
    }
    const x = smoothX;
    const y = smoothY;
    // Fill in a fast flick's gap with interpolated points, spaced closely,
    // so the ink reads as one continuous stroke rather than a dashed one.
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
  }

  window.addEventListener("mousemove", (event) => {
    const now = performance.now();
    // getCoalescedEvents exposes every real OS-level mouse sample between
    // animation frames (a mouse can report at 125-1000Hz), not just the
    // single throttled point the browser would otherwise deliver — using
    // the real samples makes the traced path itself smoother and more
    // accurate, with no synthetic guessing and no added latency.
    const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : null;
    if (samples && samples.length) {
      samples.forEach((sample) => addPoint(sample.clientX, sample.clientY, now));
    } else {
      addPoint(event.clientX, event.clientY, now);
    }
  });

  function draw() {
    const now = performance.now();
    points = points.filter((p) => now - p.t < TRAIL_LIFETIME_MS);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length > 1) {
      const first = points[0];
      const last = points[points.length - 1];
      const gradient = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
      gradient.addColorStop(0, `rgba(${TIFFANY_BLUE}, 0)`);
      gradient.addColorStop(0.6, `rgba(${TIFFANY_BLUE}, 0.55)`);
      gradient.addColorStop(1, `rgba(${TIFFANY_BLUE}, 0.9)`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // One continuous path, smoothed through the midpoints of consecutive
      // points, drawn with a single stroke() call — that's what keeps the
      // width and texture consistent along the whole visible length.
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}
