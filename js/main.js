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

// Collapsed nav (project detail pages): click/tap the circular trigger to
// toggle the Home/About switcher open. Clicking outside, or the trigger
// again, closes it.
document.querySelectorAll(".nav-morph").forEach((morph) => {
  const trigger = morph.querySelector(".nav-morph__trigger");
  if (!trigger) return;

  function setOpen(open) {
    morph.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", String(open));
  }

  trigger.addEventListener("click", () => {
    setOpen(!morph.classList.contains("is-open"));
  });

  document.addEventListener("click", (event) => {
    if (!morph.contains(event.target)) setOpen(false);
  });
});

// Segmented control (Home/About nav): a white pill slides beneath whichever
// item is hovered, and rests under the active item (or stays hidden if
// neither is active, as on project detail pages).
document.querySelectorAll(".segmented-control").forEach((nav) => {
  const pill = nav.querySelector(".segmented-control__pill");
  const items = nav.querySelectorAll(".segmented-control__item");
  if (!pill || !items.length) return;

  function moveTo(item) {
    pill.style.width = `${item.offsetWidth}px`;
    pill.style.transform = `translateX(${item.offsetLeft - 6}px)`;
    pill.style.opacity = "1";
  }

  const activeItem = nav.querySelector(".segmented-control__item.is-active");
  if (activeItem) moveTo(activeItem);

  items.forEach((item) => {
    item.addEventListener("mouseenter", () => moveTo(item));
  });

  nav.addEventListener("mouseleave", () => {
    if (activeItem) {
      moveTo(activeItem);
    } else {
      pill.style.opacity = "0";
    }
  });
});

// Selected Work filter pills: show only cards whose data-tags include the
// active filter ("all" shows everything). Cards can carry multiple tags.
const filterBar = document.querySelector(".filter-bar");
if (filterBar) {
  const filterButtons = filterBar.querySelectorAll(".filter-pill");
  const filterableCards = document.querySelectorAll(".project-grid .project-card");
  const validFilters = Array.from(filterButtons).map((b) => b.dataset.filter);

  function applyFilter(filter, { updateUrl = false, scrollToProjects = false } = {}) {
    filterButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.filter === filter));
    filterableCards.forEach((card) => {
      const tags = (card.dataset.tags || "").split(" ");
      card.style.display = filter === "all" || tags.includes(filter) ? "" : "none";
    });

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (filter === "all") {
        url.searchParams.delete("track");
      } else {
        url.searchParams.set("track", filter);
      }
      history.replaceState(null, "", url);
    }

    if (scrollToProjects) {
      filterBar.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyFilter(button.dataset.filter, { updateUrl: true });
    });
  });

  // Shareable, pre-filtered links: ?track=ui / ?track=physical / ?track=generative-ai
  // land straight on that category, already scrolled into view — e.g. for
  // pointing a specific application at the relevant work.
  const requestedTrack = new URLSearchParams(window.location.search).get("track");
  if (requestedTrack && validFilters.includes(requestedTrack)) {
    applyFilter(requestedTrack, { scrollToProjects: true });
  }
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

// YouTube/Vimeo embeds: load the real iframe only once the facade is
// clicked, instead of every embed on the page loading upfront.
document.querySelectorAll(".video-facade").forEach((facade) => {
  facade.addEventListener(
    "click",
    () => {
      const iframe = document.createElement("iframe");
      iframe.src = facade.dataset.embedSrc;
      iframe.title = facade.dataset.embedTitle || "";
      iframe.allow = facade.dataset.embedAllow || "";
      iframe.allowFullscreen = true;
      if (facade.dataset.embedReferrer) {
        iframe.referrerPolicy = facade.dataset.embedReferrer;
      }
      facade.replaceWith(iframe);
    },
    { once: true }
  );
});

// Nomi prototype: fullscreen toggle. This is a CSS-only "fullscreen"
// (fixed-position overlay, not the browser's native Fullscreen API) —
// iOS Safari doesn't support requestFullscreen on arbitrary elements at
// all (only on <video>), so a native-API version would silently do
// nothing for a lot of visitors. A CSS toggle works identically on every
// browser and needs no permission grant.
document.querySelectorAll(".nomi-embed").forEach((embed) => {
  const button = embed.querySelector(".nomi-fullscreen-btn");
  if (!button) return;

  const setActive = (active) => {
    embed.classList.toggle("is-fullscreen", active);
    button.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
    document.documentElement.classList.toggle("nomi-fullscreen-lock", active);
  };

  button.addEventListener("click", () => {
    setActive(!embed.classList.contains("is-fullscreen"));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && embed.classList.contains("is-fullscreen")) {
      setActive(false);
    }
  });
});
