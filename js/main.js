// A restrained synthesized sound language for hover interactions. Sound stays
// opt-in: the homepage "enter with sound" action enables it, and the muted
// entry keeps it off. The preference follows navigation within the portfolio.
const portfolioUISounds = (() => {
  const preferenceKey = "portfolio-ui-sound";
  const frequencies = [330, 392, 466, 554];
  let context = null;
  let master = null;
  let enabled = false;
  let lastPlayedAt = 0;

  try {
    enabled = sessionStorage.getItem(preferenceKey) === "on";
  } catch {
    // Some file:// previews do not expose session storage.
  }

  function remember(value) {
    try {
      sessionStorage.setItem(preferenceKey, value ? "on" : "off");
    } catch {
      // Sound still works for the current page when storage is unavailable.
    }
  }

  function ensureContext() {
    if (context) return context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0.34;
    master.connect(context.destination);
    return context;
  }

  async function enable() {
    enabled = true;
    remember(true);
    const audio = ensureContext();
    if (!audio) return false;
    if (audio.state !== "running") await audio.resume().catch(() => {});
    return audio.state === "running";
  }

  function disable() {
    enabled = false;
    remember(false);
    if (context?.state === "running") context.suspend().catch(() => {});
  }

  function synthPing({ frequency, endFrequency, duration, overtone = 2.01 }) {
    if (!context || !master || context.state !== "running") return;

    const now = context.currentTime;
    const primary = context.createOscillator();
    const shimmer = context.createOscillator();
    const primaryGain = context.createGain();
    const shimmerGain = context.createGain();
    const filter = context.createBiquadFilter();

    primary.type = "sine";
    primary.frequency.setValueAtTime(frequency, now);
    primary.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    shimmer.type = "triangle";
    shimmer.frequency.setValueAtTime(frequency * overtone, now);
    shimmer.frequency.exponentialRampToValueAtTime(endFrequency * overtone, now + duration);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1850, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + duration);

    primaryGain.gain.setValueAtTime(0.0001, now);
    primaryGain.gain.exponentialRampToValueAtTime(0.05, now + 0.012);
    primaryGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    shimmerGain.gain.setValueAtTime(0.0001, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.014, now + 0.018);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.82);

    primary.connect(primaryGain);
    shimmer.connect(shimmerGain);
    primaryGain.connect(filter);
    shimmerGain.connect(filter);
    filter.connect(master);
    primary.start(now);
    shimmer.start(now);
    primary.stop(now + duration + 0.02);
    shimmer.stop(now + duration + 0.02);
  }

  function play(kind, index = 0) {
    if (!enabled) return;
    const audio = ensureContext();
    if (!audio) return;

    const start = () => {
      const now = performance.now();
      if (now - lastPlayedAt < 70) return;
      lastPlayedAt = now;

      if (kind === "interactive") {
        synthPing({ frequency: 415, endFrequency: 659, duration: 0.17, overtone: 2.015 });
        return;
      }

      const frequency = frequencies[index % frequencies.length];
      synthPing({ frequency, endFrequency: frequency * 1.12, duration: 0.095 });
    };

    if (audio.state === "running") {
      start();
    } else {
      audio.resume().then(() => {
        if (audio.state === "running") start();
      }).catch(() => {});
    }
  }

  document.addEventListener("pointerdown", (event) => {
    if (!enabled || event.target.closest?.("[data-entry-muted]")) return;
    enable();
  }, { capture: true });

  return { enable, disable, play };
})();

window.portfolioUISounds = portfolioUISounds;

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
// toggle the Home/Work/Make/About switcher open. Clicking outside, or the trigger
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

// Segmented control (primary navigation): a white pill slides beneath whichever
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

  items.forEach((item, index) => {
    item.addEventListener("mouseenter", () => {
      moveTo(item);
      portfolioUISounds.play("nav", index);
    });
  });

  nav.addEventListener("mouseleave", () => {
    if (activeItem) {
      moveTo(activeItem);
    } else {
      pill.style.opacity = "0";
    }
  });
});

document.querySelector(".home-interactive")?.addEventListener("pointerenter", () => {
  portfolioUISounds.play("interactive");
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

// Cover videos are always-muted ambient media. Explicitly ask them to play
// after loading and when a cached page becomes active again so playback never
// depends on a click or on the scroll-triggered video observer below.
document.querySelectorAll("video.case-cover-autoplay").forEach((video) => {
  video.defaultMuted = true;
  video.muted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;

  const startCoverVideo = () => {
    if (video.paused) video.play().catch(() => {});
  };

  if (video.readyState >= 2) startCoverVideo();
  ["loadeddata", "canplay"].forEach((eventName) => {
    video.addEventListener(eventName, startCoverVideo);
  });
  window.addEventListener("pageshow", startCoverVideo);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) startCoverVideo();
  });
});

// Detail-page videos marked .scroll-autoplay: play while scrolled into
// view, pause as soon as they scroll out of view (only one plays at a time
// as the reader moves down the page).
const scrollAutoplayVideos = document.querySelectorAll("video.scroll-autoplay");
if (scrollAutoplayVideos.length) {
  // If a video hasn't buffered enough data yet when it scrolls into view,
  // the browser can silently reject that first play() and nothing retries
  // it — the video just sits there paused. Track which videos are
  // "supposed" to be playing and retry once they actually have data.
  const wantsToPlay = new WeakSet();
  const tryPlay = (video) => { video.play().catch(() => {}); };

  const scrollPlayObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          wantsToPlay.add(entry.target);
          tryPlay(entry.target);
        } else {
          wantsToPlay.delete(entry.target);
          entry.target.pause();
        }
      });
    },
    { threshold: 0.5 }
  );

  scrollAutoplayVideos.forEach((video) => {
    scrollPlayObserver.observe(video);
    ["loadeddata", "canplay"].forEach((eventName) => {
      video.addEventListener(eventName, () => {
        if (wantsToPlay.has(video) && video.paused) tryPlay(video);
      });
    });
  });
}

// Creative-practice videos begin muted for reliable autoplay. On devices
// with a pointer, hovering temporarily reveals the soundtrack. The visible
// button lets people explicitly keep sound on or off and works for touch and
// keyboard users as well.
document.querySelectorAll("[data-hover-sound]").forEach((media) => {
  const video = media.querySelector("video");
  const toggle = media.querySelector("[data-sound-toggle]");
  const label = media.querySelector("[data-sound-label]");
  if (!video || !toggle || !label) return;

  let soundPreference = null;

  const updateSoundControl = () => {
    const soundIsOn = !video.muted;
    toggle.setAttribute("aria-pressed", String(soundIsOn));
    toggle.setAttribute("aria-label", soundIsOn ? "Mute video" : "Turn sound on");
    label.textContent = soundIsOn ? "Mute" : "Sound on";
  };

  media.addEventListener("mouseenter", () => {
    if (soundPreference === null) {
      video.muted = false;
      updateSoundControl();
    }
  });

  media.addEventListener("mouseleave", () => {
    if (soundPreference === null) {
      video.muted = true;
      updateSoundControl();
    }
  });

  toggle.addEventListener("click", () => {
    video.muted = !video.muted;
    soundPreference = !video.muted;
    if (!video.paused) video.play().catch(() => {});
    updateSoundControl();
  });

  updateSoundControl();
});

// Keep the full research paper out of the reading flow until someone asks
// for it. The PDF source is assigned on first open so the large file is not
// downloaded in the background for readers who do not view it.
document.querySelectorAll("[data-paper-disclosure]").forEach((disclosure) => {
  const toggle = disclosure.querySelector("[data-paper-toggle]");
  const viewer = disclosure.querySelector(".story-paper-viewer");
  const frame = viewer?.querySelector("iframe[data-src]");
  if (!toggle || !viewer || !frame) return;

  toggle.addEventListener("click", () => {
    const shouldOpen = viewer.hidden;
    viewer.hidden = !shouldOpen;
    toggle.setAttribute("aria-expanded", String(shouldOpen));
    toggle.textContent = shouldOpen ? "Hide research paper" : "View research paper";

    if (shouldOpen && !frame.hasAttribute("src")) {
      frame.src = frame.dataset.src || "";
    }
  });
});

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

// Accessible before/after image comparisons. The range input supports
// pointer dragging as well as arrow-key control.
document.querySelectorAll("[data-before-after]").forEach((comparison) => {
  const range = comparison.querySelector('input[type="range"]');
  if (!range) return;

  const updateComparison = () => {
    comparison.style.setProperty("--before-after-position", `${range.value}%`);
    range.setAttribute("aria-valuetext", `${range.value}% original design visible`);
  };

  range.addEventListener("input", updateComparison);
  updateComparison();
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

// SketchTrace case study: keep the persistent rail and compact mobile
// navigator synchronized with the section nearest the reading line.
const caseNavLinks = Array.from(document.querySelectorAll(".case-nav__link"));
const caseMobileNav = document.querySelector(".case-mobile-nav");
const caseMobileTrigger = caseMobileNav?.querySelector(".case-mobile-nav__trigger");
const caseMobileIndex = caseMobileNav?.querySelector(".case-mobile-nav__index");
const caseMobileLinks = Array.from(caseMobileNav?.querySelectorAll(".case-mobile-nav__menu a") || []);

if (caseNavLinks.length) {
  const caseSections = caseNavLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  let scrollTicking = false;

  const setActiveCaseSection = (id) => {
    caseNavLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    caseMobileLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    const sectionIndex = caseSections.findIndex((section) => section.id === id);
    if (caseMobileIndex && sectionIndex >= 0) {
      caseMobileIndex.textContent = String(sectionIndex + 1).padStart(2, "0");
    }
  };

  const syncCaseNavigation = () => {
    const readingLine = window.innerHeight * 0.3;
    let current = caseSections[0];
    caseSections.forEach((section) => {
      if (section.getBoundingClientRect().top <= readingLine) current = section;
    });
    if (current) setActiveCaseSection(current.id);
    scrollTicking = false;
  };

  window.addEventListener("scroll", () => {
    if (!scrollTicking) {
      requestAnimationFrame(syncCaseNavigation);
      scrollTicking = true;
    }
  }, { passive: true });

  const setMobileCaseNavOpen = (open) => {
    if (!caseMobileNav || !caseMobileTrigger) return;
    caseMobileNav.classList.toggle("is-open", open);
    caseMobileTrigger.setAttribute("aria-expanded", String(open));
    caseMobileTrigger.setAttribute("aria-label", open ? "Close section navigation" : "Open section navigation");
  };

  caseMobileTrigger?.addEventListener("click", () => {
    setMobileCaseNavOpen(!caseMobileNav.classList.contains("is-open"));
  });

  caseMobileLinks.forEach((link) => {
    link.addEventListener("click", () => setMobileCaseNavOpen(false));
  });

  document.addEventListener("click", (event) => {
    if (caseMobileNav && !caseMobileNav.contains(event.target)) setMobileCaseNavOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMobileCaseNavOpen(false);
  });

  syncCaseNavigation();
}

// Purposeful entrance motion explains ordered relationships. Content remains
// fully visible when IntersectionObserver or animation is unavailable.
const caseRevealTargets = document.querySelectorAll(".case-reveal");
if (caseRevealTargets.length && "IntersectionObserver" in window) {
  const caseRevealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-inview");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.28 });

  caseRevealTargets.forEach((target) => caseRevealObserver.observe(target));
} else {
  caseRevealTargets.forEach((target) => target.classList.add("is-inview"));
}

// Before/after range control for the dense-to-curated flowchart decision.
document.querySelectorAll(".case-compare").forEach((comparison) => {
  const control = comparison.querySelector('input[type="range"]');
  if (!control) return;
  const updateComparison = () => {
    comparison.style.setProperty("--compare", `${control.value}%`);
  };
  control.addEventListener("input", updateComparison);
  updateComparison();
});

// Generative AI research notes: visible controls move one note at a time,
// while the focusable track still supports touch, trackpad, and arrow keys.
document.querySelectorAll("[data-research-slider]").forEach((slider) => {
  const track = slider.querySelector("[data-research-track]");
  const previous = slider.querySelector("[data-research-prev]");
  const next = slider.querySelector("[data-research-next]");
  if (!track || !previous || !next) return;

  const getStep = () => {
    const firstNote = track.querySelector("figure");
    if (!firstNote) return track.clientWidth;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || "0");
    return firstNote.getBoundingClientRect().width + gap;
  };

  const updateControls = () => {
    previous.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
  };

  previous.addEventListener("click", () => {
    track.scrollBy({ left: -getStep(), behavior: "smooth" });
  });

  next.addEventListener("click", () => {
    track.scrollBy({ left: getStep(), behavior: "smooth" });
  });

  track.addEventListener("scroll", updateControls, { passive: true });
  window.addEventListener("resize", updateControls);
  updateControls();
});

// Research-note enlarger: a single native dialog serves every note so the
// images can be inspected at near-fullscreen scale without leaving the page.
document.querySelectorAll("[data-research-slider]").forEach((slider) => {
  const dialog = slider.querySelector("[data-research-dialog]");
  const dialogImage = dialog?.querySelector("[data-research-dialog-image]");
  const dialogCaption = dialog?.querySelector("[data-research-dialog-caption]");
  const closeButton = dialog?.querySelector("[data-research-close]");
  if (!dialog || !dialogImage || !dialogCaption || !closeButton) return;

  slider.querySelectorAll("[data-research-expand]").forEach((button) => {
    button.addEventListener("click", () => {
      dialogImage.src = button.dataset.noteSrc || "";
      dialogImage.alt = button.dataset.noteAlt || "";
      dialogCaption.textContent = button.dataset.noteCaption || "";
      dialog.showModal();
    });
  });

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});
