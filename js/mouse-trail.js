// Homepage-only: a smooth Tiffany-blue line traces the cursor's recent
// path — a full-viewport canvas overlay, decorative only (pointer-events
// are disabled so it never intercepts clicks). Skipped entirely under
// prefers-reduced-motion.
//
// Smoothness comes from a spring/chain model rather than plotting raw
// mouse history: each link eases toward the link ahead of it every frame,
// independent of how irregularly mousemove events actually fire. That's
// what gives it a fluid, silky feel instead of a jittery point trail.

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const TIFFANY_BLUE = "10, 186, 181"; // #0ABAB5, as an rgb() triple
  const LINK_COUNT = 10;
  const EASE = 0.55; // how quickly each link catches up to the one ahead
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

  const links = Array.from({ length: LINK_COUNT }, () => ({ x: 0, y: 0 }));
  let targetX = 0;
  let targetY = 0;
  let hasMouse = false;

  window.addEventListener("mousemove", (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    if (!hasMouse) {
      // Snap the whole chain in on the first move so it doesn't visibly
      // shoot in from the top-left corner.
      links.forEach((link) => { link.x = targetX; link.y = targetY; });
      hasMouse = true;
    }
  });

  function draw() {
    if (hasMouse) {
      links[0].x += (targetX - links[0].x) * EASE;
      links[0].y += (targetY - links[0].y) * EASE;
      for (let i = 1; i < links.length; i++) {
        links[i].x += (links[i - 1].x - links[i].x) * EASE;
        links[i].y += (links[i - 1].y - links[i].y) * EASE;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (hasMouse) {
      const head = links[0];
      const tail = links[links.length - 1];
      // Only draw once the chain has actually spread out into a line —
      // otherwise (chain still bunched at a stationary cursor) skip
      // drawing a near-zero-length speck.
      const spread = Math.hypot(head.x - tail.x, head.y - tail.y);
      if (spread > 1.5) {
        const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        gradient.addColorStop(0, `rgba(${TIFFANY_BLUE}, 0)`);
        gradient.addColorStop(0.65, `rgba(${TIFFANY_BLUE}, 0.5)`);
        gradient.addColorStop(1, `rgba(${TIFFANY_BLUE}, 0.9)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(links[0].x, links[0].y);
        for (let i = 1; i < links.length - 1; i++) {
          const midX = (links[i].x + links[i + 1].x) / 2;
          const midY = (links[i].y + links[i + 1].y) / 2;
          ctx.quadraticCurveTo(links[i].x, links[i].y, midX, midY);
        }
        ctx.lineTo(tail.x, tail.y);
        ctx.stroke();
      }
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}
