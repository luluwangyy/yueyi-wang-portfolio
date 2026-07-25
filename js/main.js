// Reveal project cards as they enter the viewport
const revealTargets = document.querySelectorAll(".project-card");

if (revealTargets.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealTargets.forEach((el) => observer.observe(el));
}

// Scroll cue on the hero jumps to whatever section it points at
document.querySelectorAll("[data-scroll-target]").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const target = document.querySelector(trigger.dataset.scrollTarget);
    target?.scrollIntoView({ behavior: "smooth" });
  });
});

// Media placeholders: if a file hasn't been dropped into assets/ yet, hide
// the broken element so the plain muted box shows instead of a broken-image
// icon or an empty black video canvas.
//
// - <img>: hide if it fails to load (also check on a delay, since a local
//   404 can resolve before this script even attaches its listener).
// - A working <video> (loadeddata/canplay fires) always wins and is never
//   hidden, even if its poster is missing — the poster is just a fallback.
// - Only once the video is confirmed broken (NETWORK_NO_SOURCE or an error,
//   given time to settle) do we test whether its poster loads on its own;
//   hide only if that fails too.
document.querySelectorAll(".project-visual img").forEach((img) => {
  const hide = () => { img.style.display = "none"; };
  const isBroken = () => img.complete && img.naturalWidth === 0;

  img.addEventListener("error", hide);
  if (isBroken()) hide();
  setTimeout(() => { if (isBroken()) hide(); }, 400);
});

document.querySelectorAll(".project-visual video").forEach((video) => {
  const hide = () => { video.style.display = "none"; };
  const posterUrl = video.getAttribute("poster");
  let confirmedGood = false;

  video.addEventListener("loadeddata", () => { confirmedGood = true; });
  video.addEventListener("canplay", () => { confirmedGood = true; });

  const evaluate = () => {
    if (confirmedGood) return;
    const sourceBroken = video.networkState === video.NETWORK_NO_SOURCE || !!video.error;
    if (!sourceBroken) return;

    if (posterUrl) {
      const posterTest = new Image();
      posterTest.onerror = hide;
      posterTest.src = posterUrl;
    } else {
      hide();
    }
  };

  video.addEventListener("error", evaluate);
  setTimeout(evaluate, 500);
  setTimeout(evaluate, 2000);
});

// Homepage cards: the video always shows its poster (first frame) and only
// plays, on loop, while the card is hovered.
document.querySelectorAll(".project-card").forEach((card) => {
  const video = card.querySelector(".project-visual video");
  if (!video) return;

  card.addEventListener("mouseenter", () => {
    video.play().catch(() => {});
  });
  card.addEventListener("mouseleave", () => {
    video.pause();
    video.currentTime = 0;
  });
});

// Detail-page videos marked .scroll-autoplay: play while scrolled into
// view, pause as soon as they scroll out of view (only one plays at a time
// as the reader moves down the page).
const scrollAutoplayVideos = document.querySelectorAll("video.scroll-autoplay");
if (scrollAutoplayVideos.length) {
  const scrollPlayObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.play().catch(() => {});
        } else {
          entry.target.pause();
        }
      });
    },
    { threshold: 0.5 }
  );

  scrollAutoplayVideos.forEach((video) => scrollPlayObserver.observe(video));
}
