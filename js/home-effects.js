// Homepage-only: mounts the hero background and the SpecularButton CTA, and
// cross-fades the background's visibility (opacity + interaction) as the
// user moves beyond the landing statement.
//
// The background is a soft 3D sphere (see hero-sphere.js) — the earlier
// LiquidEther fluid animation (liquid-ether.js) is hidden, not deleted, in
// case we want it back.
import { createHeroSphere } from "./hero-sphere.js?v=sphere-offset-4";

const liquidRoot = document.getElementById("liquid-ether-root");
const homeTop = document.querySelector(".home-top");
const entryPortal = document.querySelector("[data-entry-portal]");

let startHeroSphere = () => {};

if (liquidRoot && homeTop && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let fx = null;
  let ticking = false;
  let interactionDisabled = false;

  function updateFade() {
    ticking = false;
    const heroHeight = homeTop.offsetHeight || 1;
    const progress = Math.min(1, Math.max(0, window.scrollY / heroHeight));
    const opacity = 1 - progress;
    liquidRoot.style.opacity = String(opacity);

    // Interaction (mouse force + render loop) only matters while the
    // effect is at least partially visible; turn it off once it's
    // essentially gone so it doesn't keep simulating off-screen or catch
    // clicks meant for the footer beneath it.
    const shouldDisable = progress >= 0.98;
    if (shouldDisable !== interactionDisabled) {
      interactionDisabled = shouldDisable;
      fx?.setMouseEnabled(!interactionDisabled);
      if (interactionDisabled) {
        fx?.pause();
      } else {
        fx?.start();
      }
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateFade);
    }
  }

  startHeroSphere = () => {
    if (fx) return fx;
    fx = createHeroSphere(liquidRoot, {
      // Pale blue-white (not pure white) so the lit side still reads as a
      // shape against the white page, harmonizing with the cyan shadow side.
      litColor: "#dff3f6",
      shadowColor: "#9dd3f2",
      fillFraction: 0.86,
      offsetX: 0.45,
      offsetY: 0.06,
      blurPx: 4,
      idleRotateSpeed: 0.12,
      followEase: 0.055
    });
    document.body.classList.add("entry-sphere-ready");
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateFade();
    return fx;
  };

  // The door scene gets the only WebGL context during landing. The homepage
  // sphere mounts under the white transition after the door has finished.
  if (!entryPortal) startHeroSphere();
} else if (liquidRoot) {
  // Reduced-motion: keep a plain, still background instead of the sim.
  liquidRoot.style.background = "#ffffff";
}

// Character-by-character homepage introduction. The pacing mirrors the
// reference interaction the portfolio is responding to: 16 frames per second,
// four temporary glyph treatments, and a 230ms stagger between visual lines.
// Sounds are original Web Audio tones generated in the browser; no third-party
// audio or animation code is used.
const introStatement = document.querySelector("[data-home-intro]");
const introSoundButton = document.querySelector("[data-home-intro-sound]");
const introSoundLabel = document.querySelector("[data-home-intro-sound-label]");
const entrySoundButton = document.querySelector("[data-entry-sound]");
const entrySoundLabel = document.querySelector("[data-entry-sound-label]");
const entryMutedButton = document.querySelector("[data-entry-muted]");
const homeFooter = document.querySelector(".home-footer");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (introStatement) {
  const frameDuration = 1000 / 16;
  const variationCycles = 4;
  const lineStagger = 230;
  const highlightDuration = 280;
  const highlightStagger = 60;
  const variationClasses = [
    "is-char-fill",
    "is-char-inverse",
    "is-char-accent",
    "is-char-accent-inverse",
    "is-char-accent-fill",
    "is-char-border"
  ];

  let runId = 0;
  let runTimers = [];
  let audioEnabled = false;
  let audioContext = null;
  let audioMaster = null;
  let lastCharacterPulse = -Infinity;
  let pulseIndex = 0;
  let activeCharacterVoices = [];
  let activeHighlightVoices = [];
  let entryAttempting = false;

  function wrapTextNode(textNode) {
    const fragment = document.createDocumentFragment();
    const parts = textNode.nodeValue.split(/(\s+)/);

    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        fragment.append(document.createTextNode(part));
        return;
      }

      const word = document.createElement("span");
      word.className = "home-intro-word";
      word.setAttribute("aria-hidden", "true");

      Array.from(part).forEach((character) => {
        const characterSpan = document.createElement("span");
        characterSpan.className = "home-intro-char";
        characterSpan.textContent = character;
        word.append(characterSpan);
      });

      fragment.append(word);
    });

    textNode.replaceWith(fragment);
  }

  function splitIntroText() {
    const walker = document.createTreeWalker(introStatement, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let currentNode = walker.nextNode();

    while (currentNode) {
      if (currentNode.nodeValue.trim()) textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    textNodes.forEach(wrapTextNode);
    introStatement.classList.add("has-intro-animation");
  }

  function groupCharactersByVisualLine() {
    const words = Array.from(introStatement.querySelectorAll(".home-intro-word"));
    const lines = [];

    words.forEach((word) => {
      const top = Math.round(word.getBoundingClientRect().top);
      let line = lines.find((candidate) => Math.abs(candidate.top - top) <= 2);

      if (!line) {
        line = { top, characters: [] };
        lines.push(line);
      }

      line.characters.push(...word.querySelectorAll(".home-intro-char"));
    });

    return lines.sort((a, b) => a.top - b.top).map((line) => line.characters);
  }

  function introSoundSchedule() {
    const lines = groupCharactersByVisualLine();
    const characterTimes = [];

    lines.forEach((characters, lineIndex) => {
      characters.forEach((_, characterIndex) => {
        characterTimes.push(lineIndex * lineStagger + characterIndex * frameDuration);
      });
    });

    characterTimes.sort((a, b) => a - b);
    const characterEnd = Math.max(
      0,
      ...lines.map((characters, lineIndex) => lineIndex * lineStagger + (characters.length + variationCycles) * frameDuration)
    );
    const highlightCount = introStatement.querySelectorAll(".home-interactive .home-intro-word").length;
    const highlightTimes = Array.from({ length: highlightCount }, (_, index) => characterEnd + index * highlightStagger);
    return { characterTimes, highlightTimes };
  }

  function clearRunTimers() {
    runTimers.forEach((timer) => {
      window.clearTimeout(timer);
      window.clearInterval(timer);
    });
    runTimers = [];
  }

  function removeVariationClasses(character) {
    character.classList.remove(...variationClasses, "is-settled");
  }

  function resetIntro() {
    clearRunTimers();
    introStatement.querySelectorAll(".home-intro-char").forEach(removeVariationClasses);
    introStatement.querySelectorAll(".home-intro-word").forEach((word) => {
      word.classList.remove("is-intro-highlight");
    });
  }

  function pruneVoices(voices) {
    return voices.filter((voice) => voice.endsAt > performance.now());
  }

  function stopOldestVoice(voices) {
    const oldest = voices.shift();
    if (!oldest) return;
    try {
      oldest.oscillator.stop();
    } catch {
      // It may already have reached the end of its envelope.
    }
  }

  function createTone({ frequency, duration, volume, type = "triangle", detune = 0 }) {
    if (!audioEnabled || !audioContext || !audioMaster || audioContext.state !== "running") return null;

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(detune, now);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(0.7, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audioMaster);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.015);

    return { oscillator, endsAt: performance.now() + (duration + 0.02) * 1000 };
  }

  function playCharacterPulse() {
    if (!audioEnabled) return;
    const now = performance.now();
    if (now - lastCharacterPulse < 28) return;

    lastCharacterPulse = now;
    activeCharacterVoices = pruneVoices(activeCharacterVoices);
    while (activeCharacterVoices.length >= 2) stopOldestVoice(activeCharacterVoices);

    const detunePattern = [-45, 0, 35, 0];
    const voice = createTone({
      frequency: 420,
      duration: 0.1,
      volume: activeCharacterVoices.length ? 0.035 : 0.055,
      type: pulseIndex % 2 ? "sine" : "triangle",
      detune: detunePattern[pulseIndex % detunePattern.length]
    });
    pulseIndex += 1;
    if (voice) activeCharacterVoices.push(voice);
  }

  function playHighlightPulse(index) {
    if (!audioEnabled) return;
    activeHighlightVoices = pruneVoices(activeHighlightVoices);
    while (activeHighlightVoices.length >= 4) stopOldestVoice(activeHighlightVoices);

    const notePattern = [392, 440, 493.88, 523.25, 587.33, 659.25];
    const voice = createTone({
      frequency: notePattern[index % notePattern.length],
      duration: 0.22,
      volume: 0.055,
      type: "sine"
    });
    if (voice) activeHighlightVoices.push(voice);
  }

  async function enableAudio() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;

      audioContext = new AudioContextClass();
      const compressor = audioContext.createDynamicsCompressor();
      audioMaster = audioContext.createGain();

      compressor.threshold.value = -4;
      compressor.knee.value = 2;
      compressor.ratio.value = 10;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.045;
      audioMaster.gain.value = 0.5;
      compressor.connect(audioMaster);
      audioMaster.connect(audioContext.destination);

      // Route generated voices through the compressor before the master gain.
      audioMaster = compressor;
    }

    if (audioContext.state !== "running") await audioContext.resume();
    audioEnabled = audioContext.state === "running";
    return audioEnabled;
  }

  function playPortalSwell() {
    if (!audioEnabled || !audioContext || !audioMaster || audioContext.state !== "running") return;

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const overtone = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(92, now);
    oscillator.frequency.exponentialRampToValueAtTime(196, now + 1.18);
    overtone.type = "triangle";
    overtone.frequency.setValueAtTime(184, now);
    overtone.frequency.exponentialRampToValueAtTime(294, now + 1.08);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(1500, now + 0.88);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.052, now + 0.28);
    gain.gain.setValueAtTime(0.052, now + 0.62);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.28);

    oscillator.connect(filter);
    overtone.connect(filter);
    filter.connect(gain);
    gain.connect(audioMaster);
    oscillator.start(now);
    overtone.start(now);
    oscillator.stop(now + 1.32);
    overtone.stop(now + 1.32);
  }

  function highlightIntroWords(currentRun) {
    const highlightedWords = Array.from(
      introStatement.querySelectorAll(".home-interactive .home-intro-word")
    );

    highlightedWords.forEach((word, index) => {
      const timer = window.setTimeout(() => {
        if (runId !== currentRun) return;
        word.classList.add("is-intro-highlight");
        playHighlightPulse(index);
      }, index * highlightStagger);
      runTimers.push(timer);
    });

    return highlightedWords.length
      ? (highlightedWords.length - 1) * highlightStagger + highlightDuration
      : 0;
  }

  function playIntro({ withSound = false } = {}) {
    runId += 1;
    const currentRun = runId;
    resetIntro();
    audioEnabled = withSound && audioContext?.state === "running";
    lastCharacterPulse = -Infinity;
    pulseIndex = 0;

    introSoundButton?.classList.remove("is-ready");
    if (introSoundButton) introSoundButton.classList.toggle("is-playing", withSound);
    if (introSoundLabel) introSoundLabel.textContent = withSound ? "Playing with sound" : "Play with sound";

    if (reduceMotion.matches) {
      introStatement.querySelectorAll(".home-intro-char").forEach((character) => {
        character.classList.add("is-settled");
      });
      introStatement.querySelectorAll(".home-interactive .home-intro-word").forEach((word) => {
        word.classList.add("is-intro-highlight");
      });
      introSoundButton?.classList.remove("is-playing");
      introSoundButton?.classList.add("is-ready");
      if (introSoundLabel) introSoundLabel.textContent = "Replay with sound";
      return;
    }

    const lines = groupCharactersByVisualLine();
    const lineDurations = [];

    lines.forEach((characters, lineIndex) => {
      const lineStart = lineIndex * lineStagger;
      const lineDuration = (characters.length + variationCycles) * frameDuration;
      lineDurations.push(lineStart + lineDuration);

      const startTimer = window.setTimeout(() => {
        if (runId !== currentRun) return;
        let tick = 0;

        const interval = window.setInterval(() => {
          if (runId !== currentRun) {
            window.clearInterval(interval);
            return;
          }

          characters.forEach((character, characterIndex) => {
            const age = tick - characterIndex;
            if (age < 0) return;

            character.classList.remove(...variationClasses);

            if (age === 0) playCharacterPulse();
            if (age < variationCycles) {
              const stateIndex = (characterIndex * 3 + tick + lineIndex) % variationClasses.length;
              character.classList.add(variationClasses[stateIndex]);
            } else {
              character.classList.add("is-settled");
            }
          });

          tick += 1;
          if (tick > characters.length + variationCycles) window.clearInterval(interval);
        }, frameDuration);

        runTimers.push(interval);
      }, lineStart);

      runTimers.push(startTimer);
    });

    const characterEnd = Math.max(0, ...lineDurations);
    const highlightTimer = window.setTimeout(() => {
      if (runId !== currentRun) return;
      const highlightTime = highlightIntroWords(currentRun);
      const completeTimer = window.setTimeout(() => {
        if (runId !== currentRun) return;
        introSoundButton?.classList.remove("is-playing");
        introSoundButton?.classList.add("is-ready");
        if (introSoundLabel) introSoundLabel.textContent = "Replay with sound";
      }, highlightTime);
      runTimers.push(completeTimer);
    }, characterEnd);
    runTimers.push(highlightTimer);
  }

  splitIntroText();

  const interactiveWord = introStatement.querySelector(".home-interactive");
  if (interactiveWord && !reduceMotion.matches) {
    const interactiveCharacters = Array.from(interactiveWord.querySelectorAll(".home-intro-char"));
    const escapeRadius = 92;
    const escapeDistance = 16;
    let escapeFrame = 0;
    let latestPointer = null;

    function resetEscapingLetters() {
      interactiveWord.classList.remove("is-escaping");
      interactiveCharacters.forEach((character) => {
        character.style.removeProperty("--escape-x");
        character.style.removeProperty("--escape-y");
        character.style.removeProperty("--escape-rotate");
      });
    }

    function moveLettersFromPointer() {
      escapeFrame = 0;
      if (!latestPointer) return;

      interactiveWord.classList.add("is-escaping");
      interactiveCharacters.forEach((character, index) => {
        const rect = character.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = centerX - latestPointer.x;
        const deltaY = centerY - latestPointer.y;
        const distance = Math.max(1, Math.hypot(deltaX, deltaY));
        const strength = Math.max(0, 1 - distance / escapeRadius);

        if (strength === 0) {
          character.style.setProperty("--escape-x", "0px");
          character.style.setProperty("--escape-y", "0px");
          character.style.setProperty("--escape-rotate", "0deg");
          return;
        }

        const travel = strength * escapeDistance;
        const x = (deltaX / distance) * travel;
        const y = (deltaY / distance) * travel;
        const rotation = strength * (index % 2 === 0 ? -7 : 7);
        character.style.setProperty("--escape-x", `${x.toFixed(2)}px`);
        character.style.setProperty("--escape-y", `${y.toFixed(2)}px`);
        character.style.setProperty("--escape-rotate", `${rotation.toFixed(2)}deg`);
      });
    }

    interactiveWord.addEventListener("pointermove", (event) => {
      latestPointer = { x: event.clientX, y: event.clientY };
      if (!escapeFrame) escapeFrame = requestAnimationFrame(moveLettersFromPointer);
    });

    interactiveWord.addEventListener("pointerleave", () => {
      latestPointer = null;
      if (escapeFrame) cancelAnimationFrame(escapeFrame);
      escapeFrame = 0;
      resetEscapingLetters();
    });
  }

  function revealHomepage({ withSound }) {
    playIntro({ withSound });
  }

  function requestSoundTap() {
    entryPortal?.classList.add("is-audio-needed");
    if (entrySoundLabel) entrySoundLabel.textContent = "Tap to enter with sound";
    entrySoundButton?.focus({ preventScroll: true });
  }

  async function enterPortfolio({ withSound, requireSound = false }) {
    if (!entryPortal || entryPortal.classList.contains("is-entering") || entryAttempting) return;
    entryAttempting = true;

    let soundReady = false;
    if (withSound) {
      window.portfolioUISounds?.enable();
      soundReady = await Promise.race([
        enableAudio().catch(() => false),
        new Promise((resolve) => window.setTimeout(() => resolve(false), 400))
      ]);

      if (!soundReady && requireSound) {
        window.portfolioUISounds?.disable();
        entryAttempting = false;
        requestSoundTap();
        return;
      }
    } else {
      window.portfolioUISounds?.disable();
    }

    entryPortal.classList.remove("is-audio-needed");
    if (entrySoundLabel) entrySoundLabel.textContent = "Enter with sound";

    entrySoundButton?.setAttribute("disabled", "");
    entryMutedButton?.setAttribute("disabled", "");

    document.body.classList.add("portal-entering");
    entryPortal.classList.add("is-entering");
    entryPortal.setAttribute("aria-hidden", "true");

    const isTrumanLanding = entryPortal.hasAttribute("data-truman-landing");
    if (isTrumanLanding) {
      const trumanFrame = entryPortal.querySelector("[data-truman-frame]");

      // At full white, release the door's WebGL context and prepare the home
      // scene beneath the overlay. Keeping this in one page preserves audio.
      window.setTimeout(() => {
        trumanFrame?.contentWindow?.postMessage({ type: "truman-door-release" }, window.location.origin);

        window.setTimeout(() => {
          entryPortal.classList.add("is-home-ready");
          startHeroSphere();
          document.body.classList.remove("entry-pending");
          homeTop?.removeAttribute("inert");
          homeTop?.removeAttribute("aria-hidden");
          homeFooter?.removeAttribute("inert");
          homeFooter?.removeAttribute("aria-hidden");
        }, reduceMotion.matches ? 40 : 140);
      }, reduceMotion.matches ? 220 : 2460);

      window.setTimeout(() => {
        trumanFrame?.contentWindow?.postMessage(
          { type: "truman-intro-sound", ...introSoundSchedule() },
          window.location.origin
        );
        playIntro({ withSound: true });
      }, reduceMotion.matches ? 360 : 3080);

      window.setTimeout(() => {
        entryPortal.hidden = true;
        document.body.classList.remove("portal-entering");
      }, reduceMotion.matches ? 820 : 3860);
      return;
    }

    if (soundReady) playPortalSwell();

    const introDelay = reduceMotion.matches ? 120 : 820;
    const finishDelay = reduceMotion.matches ? 850 : 1450;

    window.setTimeout(() => revealHomepage({ withSound: soundReady }), introDelay);
    window.setTimeout(() => {
      entryPortal.hidden = true;
      document.body.classList.remove("entry-pending", "portal-entering");
      homeTop?.removeAttribute("inert");
      homeTop?.removeAttribute("aria-hidden");
      homeFooter?.removeAttribute("inert");
      homeFooter?.removeAttribute("aria-hidden");
    }, finishDelay);
  }

  if (entryPortal) {
    let wheelDistance = 0;
    let wheelResetTimer = 0;

    function handleEntryWheel(event) {
      if (entryPortal.classList.contains("is-entering") || event.deltaY <= 0) return;
      event.preventDefault();
      window.clearTimeout(wheelResetTimer);
      wheelDistance = Math.min(120, wheelDistance + Math.abs(event.deltaY));

      const progress = wheelDistance / 120;
      const previewScale = 4.2 - progress * 1.7;
      liquidRoot?.style.setProperty("--entry-sphere-scale", previewScale.toFixed(3));

      if (wheelDistance >= 120) {
        enterPortfolio({ withSound: true, requireSound: true });
        return;
      }

      wheelResetTimer = window.setTimeout(() => {
        wheelDistance = 0;
        liquidRoot?.style.removeProperty("--entry-sphere-scale");
      }, 480);
    }

    homeTop?.setAttribute("inert", "");
    homeTop?.setAttribute("aria-hidden", "true");
    homeFooter?.setAttribute("inert", "");
    homeFooter?.setAttribute("aria-hidden", "true");
    entryPortal.addEventListener("pointerdown", (event) => {
      if (event.target.closest?.("[data-entry-muted]")) return;
      enableAudio().catch(() => false);
      window.portfolioUISounds?.enable();
    }, { capture: true });
    entrySoundButton?.addEventListener("click", () => enterPortfolio({ withSound: true, requireSound: true }));
    entryMutedButton?.addEventListener("click", () => enterPortfolio({ withSound: false }));
    entryPortal.addEventListener("wheel", handleEntryWheel, { passive: false });

    const trumanFrame = entryPortal.querySelector("[data-truman-frame]");
    if (trumanFrame) {
      window.addEventListener("message", (event) => {
        if (event.source !== trumanFrame.contentWindow || event.origin !== window.location.origin) return;
        if (event.data?.type !== "truman-door-enter") return;
        enterPortfolio({ withSound: true, requireSound: false });
      });
    }
  } else {
    requestAnimationFrame(() => playIntro());
  }

  introSoundButton?.addEventListener("click", async () => {
    introSoundButton.disabled = true;
    window.portfolioUISounds?.enable();
    const enabled = await enableAudio().catch(() => false);
    introSoundButton.disabled = false;

    if (!enabled) {
      if (introSoundLabel) introSoundLabel.textContent = "Sound unavailable";
      return;
    }

    playIntro({ withSound: true });
  });
}
