(() => {
  const instruments = document.querySelectorAll("[data-sound-canvas-expanded]");
  if (!instruments.length) return;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const TAU = Math.PI * 2;
  const waveTypes = ["sine", "triangle", "sawtooth", "square", "sine"];
  const presetVoices = {
    "#285f4a": { base: 130.81, wave: 0.15 },
    "#9dd3f2": { base: 196, wave: 1.05 },
    "#9df2bc": { base: 174.61, wave: 0.6 },
    "#9df2e6": { base: 220, wave: 1.25 },
    "#f4df78": { base: 261.63, wave: 0.25 },
    "#f5a88d": { base: 233.08, wave: 1.55 },
    "#c9b8f4": { base: 293.66, wave: 0.85 },
    "#f3b6d2": { base: 329.63, wave: 1.75 },
    "#b86c45": { base: 164.81, wave: 2.3 },
    "#232a35": { base: 110, wave: 2.85 }
  };

  const hexToHsl = (hex) => {
    const normalized = hex.replace("#", "");
    const value = normalized.length === 3
      ? normalized.split("").map((part) => part + part).join("")
      : normalized.padEnd(6, "0").slice(0, 6);
    const r = parseInt(value.slice(0, 2), 16) / 255;
    const g = parseInt(value.slice(2, 4), 16) / 255;
    const b = parseInt(value.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const delta = max - min;
    let hue = 0;
    let saturation = 0;

    if (delta) {
      saturation = delta / (1 - Math.abs(2 * lightness - 1));
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }

    return {
      hue: (hue + 360) % 360,
      saturation: clamp(saturation || 0, 0, 1),
      lightness: clamp(lightness, 0, 1)
    };
  };

  const hexToHsv = (hex) => {
    const normalized = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
    const r = parseInt(normalized.slice(0, 2), 16) / 255;
    const g = parseInt(normalized.slice(2, 4), 16) / 255;
    const b = parseInt(normalized.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    return {
      hue: (hue + 360) % 360,
      saturation: max === 0 ? 0 : delta / max,
      value: max
    };
  };

  const hsvToHex = (hue, saturation, value) => {
    const chroma = value * saturation;
    const segment = ((hue % 360) + 360) % 360 / 60;
    const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
    const match = value - chroma;
    let rgb;
    if (segment < 1) rgb = [chroma, secondary, 0];
    else if (segment < 2) rgb = [secondary, chroma, 0];
    else if (segment < 3) rgb = [0, chroma, secondary];
    else if (segment < 4) rgb = [0, secondary, chroma];
    else if (segment < 5) rgb = [secondary, 0, chroma];
    else rgb = [chroma, 0, secondary];
    return `#${rgb.map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0")).join("")}`;
  };

  const soundProfile = (color) => {
    const key = color.toLowerCase();
    const hsl = hexToHsl(key);
    const preset = presetVoices[key];
    return {
      ...hsl,
      base: preset?.base || 92.5 * (2 ** (hsl.lightness * 1.7)),
      wave: preset?.wave ?? (hsl.hue / 90),
      brightness: 450 + hsl.saturation * 2300 + hsl.lightness * 1250
    };
  };

  instruments.forEach((instrument) => {
    const canvas = instrument.querySelector("[data-canvas-surface]");
    const context = canvas?.getContext("2d");
    const resetButton = instrument.querySelector("[data-canvas-reset]");
    const volumeControl = instrument.querySelector("[data-canvas-volume]");
    const volumeOutput = instrument.querySelector("[data-canvas-volume-output]");
    const swatches = Array.from(instrument.querySelectorAll("[data-draw-color]"));
    const customColor = instrument.querySelector("[data-custom-color]");
    const customColorWrap = customColor?.closest(".sound-canvas__custom-color");
    const colorToggle = instrument.querySelector("[data-color-toggle]");
    const colorPanel = instrument.querySelector("[data-color-panel]");
    const colorArea = instrument.querySelector("[data-color-area]");
    const hueControl = instrument.querySelector("[data-color-hue]");
    const colorValueOutput = instrument.querySelector("[data-color-value]");
    const toolButtons = Array.from(instrument.querySelectorAll("[data-canvas-tool]"));
    const sizeButtons = Array.from(instrument.querySelectorAll("[data-canvas-size]"));
    const magicButton = instrument.querySelector("[data-canvas-magic]");
    const magicLabel = magicButton?.querySelector("span");
    const soundButton = instrument.querySelector("[data-canvas-sound]");
    const soundButtonLabel = soundButton?.querySelector("span");
    const infoButton = instrument.querySelector("[data-canvas-info]");
    const infoWrap = infoButton?.closest(".about-canvas__info-wrap");
    if (!canvas || !context || !resetButton || !swatches.length || !toolButtons.length || !magicButton) return;

    let strokes = [];
    let activeStroke = null;
    let activeColor = swatches[0].dataset.drawColor;
    let activeTool = "pen";
    let activeSize = "medium";
    const toolWidths = {
      pen: { small: 2.5, medium: 4, large: 7 },
      highlighter: { small: 10, medium: 17, large: 28 }
    };
    const eraserRadii = { small: 10, medium: 19, large: 32 };
    const currentToolWidth = () => toolWidths[activeTool]?.[activeSize] || 4;
    const initialPickerColor = hexToHsv(customColor?.value || "#74d6d6");
    let pickerHue = initialPickerColor.hue;
    let pickerSaturation = initialPickerColor.saturation;
    let pickerValue = initialPickerColor.value;
    let pickingColor = false;
    let drawing = false;
    let outputLevel = Number(volumeControl?.value || 55) / 100;
    let audioContext;
    let drawingVoice;
    let strokeCounter = 0;
    let eraserSoundAt = 0;
    let eraseAnimationFrame = 0;
    let magicAnimationFrame = 0;
    let magicActive = false;
    let magicStartedAt = 0;
    let lastPhysicsAt = 0;
    let nextDanceSoundAt = 0;
    let danceSoundStep = 0;
    let bodies = [];
    let collisionFlashes = [];
    const eraseGhosts = [];
    const collisionCooldowns = new Map();
    const oneShots = new Set();

    const ensureAudio = () => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!audioContext) audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") audioContext.resume();
      return audioContext;
    };

    const canvasSize = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });

    const drawPath = (points, color, tool, strokeWidth, transformPoint = (point) => point) => {
      if (points.length < 2) return;
      const { width, height } = canvasSize();
      context.save();
      context.beginPath();
      context.strokeStyle = color;
      context.globalAlpha = tool === "highlighter" ? 0.24 : 0.96;
      context.globalCompositeOperation = "source-over";
      context.lineWidth = strokeWidth || (tool === "highlighter" ? 17 : 4);
      context.lineCap = "round";
      context.lineJoin = "round";
      points.forEach((point, index) => {
        const transformed = transformPoint(point);
        const x = transformed.normalized ? transformed.x * width : transformed.x;
        const y = transformed.normalized ? transformed.y * height : transformed.y;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
      context.restore();
    };

    const drawStatic = () => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      strokes.forEach((stroke) => drawPath(
        stroke.points.map((point) => ({ ...point, normalized: true })),
        stroke.color,
        stroke.tool,
        stroke.width
      ));

      const now = performance.now();
      eraseGhosts.forEach((ghost) => {
        const progress = clamp((now - ghost.startedAt) / 220, 0, 1);
        context.save();
        context.globalAlpha = (1 - progress) * 0.32;
        context.fillStyle = ghost.color;
        context.beginPath();
        context.arc(ghost.x, ghost.y, 3 + progress * 7, 0, TAU);
        context.fill();
        context.restore();
      });
    };

    const animateEraseGhosts = () => {
      cancelAnimationFrame(eraseAnimationFrame);
      const frame = () => {
        const now = performance.now();
        for (let index = eraseGhosts.length - 1; index >= 0; index -= 1) {
          if (now - eraseGhosts[index].startedAt > 230) eraseGhosts.splice(index, 1);
        }
        drawStatic();
        if (eraseGhosts.length) eraseAnimationFrame = requestAnimationFrame(frame);
      };
      eraseAnimationFrame = requestAnimationFrame(frame);
    };

    const resizeCanvas = () => {
      if (magicActive) stopMagic(false);
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      drawStatic();
    };

    const canvasPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        time: performance.now()
      };
    };

    const connectTimbre = (profile, frequency, gainValue, panValue) => {
      const audio = ensureAudio();
      if (!audio) return null;
      const master = audio.createGain();
      const filter = audio.createBiquadFilter();
      const panner = audio.createStereoPanner?.();
      const waveIndex = Math.floor(profile.wave) % 4;
      const blend = profile.wave - Math.floor(profile.wave);
      const oscillatorA = audio.createOscillator();
      const oscillatorB = audio.createOscillator();
      const gainA = audio.createGain();
      const gainB = audio.createGain();

      oscillatorA.type = waveTypes[waveIndex];
      oscillatorB.type = waveTypes[waveIndex + 1];
      oscillatorA.frequency.value = frequency;
      oscillatorB.frequency.value = frequency * (1 + profile.saturation * 0.004);
      gainA.gain.value = 1 - blend * 0.72;
      gainB.gain.value = blend * (0.22 + profile.saturation * 0.68);
      filter.type = "lowpass";
      filter.frequency.value = profile.brightness;
      filter.Q.value = 0.6 + profile.saturation * 3.2;
      master.gain.value = Math.max(0.0001, gainValue);
      if (panner) panner.pan.value = clamp(panValue, -1, 1);

      oscillatorA.connect(gainA);
      oscillatorB.connect(gainB);
      gainA.connect(filter);
      gainB.connect(filter);
      filter.connect(master);
      if (panner) {
        master.connect(panner);
        panner.connect(audio.destination);
      } else {
        master.connect(audio.destination);
      }
      oscillatorA.start();
      oscillatorB.start();
      return { audio, oscillatorA, oscillatorB, gainA, gainB, filter, master, panner, profile };
    };

    const stopNodes = (voice, release = 0.15) => {
      if (!voice) return;
      const now = voice.audio.currentTime;
      voice.master.gain.cancelScheduledValues(now);
      voice.master.gain.setTargetAtTime(0.0001, now, Math.max(0.02, release / 3));
      voice.oscillatorA.stop(now + release + 0.08);
      voice.oscillatorB.stop(now + release + 0.08);
    };

    const releaseNodesLater = (voice, hold = 0.12, release = 0.18) => {
      if (!voice) return;
      const releaseAt = voice.audio.currentTime + hold;
      voice.master.gain.setTargetAtTime(0.0001, releaseAt, Math.max(0.02, release / 3));
      voice.oscillatorA.stop(releaseAt + release + 0.08);
      voice.oscillatorB.stop(releaseAt + release + 0.08);
    };

    const startDrawingVoice = (point, tool, color) => {
      const profile = soundProfile(color);
      const frequency = profile.base * (2 ** ((1 - point.y) * 1.2));
      const targetGain = (tool === "highlighter" ? 0.022 : 0.045) * outputLevel;
      const voice = connectTimbre(profile, frequency, 0.0001, point.x * 1.6 - 0.8);
      if (!voice) return;
      const now = voice.audio.currentTime;
      voice.master.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetGain), now + (tool === "highlighter" ? 0.18 : 0.035));
      if (tool === "highlighter") {
        voice.filter.frequency.value *= 0.58;
        voice.filter.Q.value *= 0.55;
      }
      drawingVoice = { ...voice, tool, lastPoint: point, distance: 0 };
    };

    const updateDrawingVoice = (point) => {
      const voice = drawingVoice;
      if (!voice) return;
      const now = voice.audio.currentTime;
      const dx = point.x - voice.lastPoint.x;
      const dy = point.y - voice.lastPoint.y;
      const elapsed = Math.max(16, point.time - voice.lastPoint.time);
      const movement = clamp(Math.hypot(dx, dy) * 900 / elapsed, 0, 1);
      voice.distance += Math.hypot(dx, dy);
      const drift = Math.min(4, voice.distance * 1.7);
      const frequency = voice.profile.base * (2 ** ((1 - point.y) * 1.25)) * (2 ** ((point.x * 5 + drift) / 12));
      voice.oscillatorA.frequency.setTargetAtTime(frequency, now, voice.tool === "highlighter" ? 0.11 : 0.025);
      voice.oscillatorB.frequency.setTargetAtTime(frequency * (1 + voice.profile.saturation * 0.004), now, 0.05);
      const filterTarget = voice.profile.brightness * (voice.tool === "highlighter" ? 0.52 : 0.85) + movement * (voice.tool === "highlighter" ? 700 : 2300);
      voice.filter.frequency.setTargetAtTime(filterTarget, now, voice.tool === "highlighter" ? 0.14 : 0.035);
      const targetGain = (voice.tool === "highlighter" ? 0.014 + movement * 0.025 : 0.016 + movement * 0.06) * outputLevel;
      voice.master.gain.setTargetAtTime(Math.max(0.0001, targetGain), now, voice.tool === "highlighter" ? 0.1 : 0.025);
      voice.panner?.pan.setTargetAtTime(point.x * 1.6 - 0.8, now, 0.04);
      voice.lastPoint = point;
    };

    const stopDrawingVoice = () => {
      if (!drawingVoice) return;
      stopNodes(drawingVoice, drawingVoice.tool === "highlighter" ? 0.42 : 0.16);
      drawingVoice = null;
    };

    const registerOneShot = (voice, duration) => {
      if (!voice) return;
      oneShots.add(voice);
      window.setTimeout(() => oneShots.delete(voice), duration * 1000 + 250);
      while (oneShots.size > 12) {
        const oldest = oneShots.values().next().value;
        stopNodes(oldest, 0.04);
        oneShots.delete(oldest);
      }
    };

    const playEraseSound = (stroke, point) => {
      const nowMs = performance.now();
      if (nowMs - eraserSoundAt < 90) return;
      eraserSoundAt = nowMs;
      const profile = soundProfile(stroke.color);
      const startFrequency = profile.base * (2 ** ((1 - point.y) * 1.15));
      const voice = connectTimbre(profile, startFrequency, 0.022 * outputLevel, point.x * 1.5 - 0.75);
      if (!voice) return;
      const now = voice.audio.currentTime;
      voice.oscillatorA.frequency.exponentialRampToValueAtTime(Math.max(45, startFrequency * 0.45), now + 0.26);
      voice.oscillatorB.frequency.exponentialRampToValueAtTime(Math.max(46, startFrequency * 0.48), now + 0.26);
      voice.filter.frequency.setValueAtTime(profile.brightness, now);
      voice.filter.frequency.exponentialRampToValueAtTime(180, now + 0.28);
      releaseNodesLater(voice, 0.1, 0.2);
      registerOneShot(voice, 0.38);
    };

    const circularHueAverage = (hueA, hueB) => {
      const x = Math.cos(hueA * Math.PI / 180) + Math.cos(hueB * Math.PI / 180);
      const y = Math.sin(hueA * Math.PI / 180) + Math.sin(hueB * Math.PI / 180);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };

    const playCollisionSound = (bodyA, bodyB, x, y, velocity) => {
      const audio = ensureAudio();
      if (!audio || oneShots.size >= 12) return;
      const profileA = soundProfile(bodyA.color);
      const profileB = soundProfile(bodyB.color);
      const toolPair = `${bodyA.tool}-${bodyB.tool}`;
      const highlighterPair = toolPair === "highlighter-highlighter";
      const hybrid = bodyA.tool !== bodyB.tool;
      const intensity = clamp((velocity - 7) / 80, 0.08, 1);
      const weight = clamp((bodyA.width + bodyB.width) / 34, 0.25, 1);
      const register = 2 ** ((1 - y) * 1.55 - weight * 0.38);
      const harmony = 2 ** (((circularHueAverage(profileA.hue, profileB.hue) / 360) * 7) / 12);
      const frequencyA = profileA.base * register;
      const frequencyB = profileB.base * register * harmony;
      const duration = highlighterPair ? 0.9 : hybrid ? 0.56 : 0.34;
      const gainValue = (highlighterPair ? 0.038 : hybrid ? 0.052 : 0.068) * intensity * outputLevel;
      const voiceA = connectTimbre(profileA, frequencyA, 0.0001, x * 1.7 - 0.85);
      const voiceB = connectTimbre(profileB, frequencyB, 0.0001, x * 1.7 - 0.85);
      if (!voiceA || !voiceB) return;
      const now = audio.currentTime;
      [voiceA, voiceB].forEach((voice, index) => {
        const target = gainValue * (index ? 0.72 : 1);
        voice.master.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + (highlighterPair ? 0.12 : 0.012));
        voice.filter.frequency.setValueAtTime((profileA.brightness + profileB.brightness) * (highlighterPair ? 0.3 : 0.55), now);
        voice.filter.frequency.exponentialRampToValueAtTime(Math.max(220, voice.filter.frequency.value * 0.42), now + duration);
        releaseNodesLater(voice, duration * 0.42, duration * 0.58);
        registerOneShot(voice, duration + 0.1);
      });
    };

    const playDanceStart = () => {
      const audio = ensureAudio();
      if (!audio || !bodies.length) return;
      const voices = bodies.slice(0, 3).map((body, index) => {
        const profile = soundProfile(body.color);
        const frequency = profile.base * (2 ** ((index + 2) / 12));
        const voice = connectTimbre(profile, frequency, 0.0001, (index - 1) * 0.38);
        if (!voice) return null;
        const now = audio.currentTime;
        voice.master.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.042 * outputLevel), now + 0.035 + index * 0.025);
        voice.filter.frequency.setValueAtTime(profile.brightness * 0.55, now);
        voice.filter.frequency.exponentialRampToValueAtTime(Math.max(260, profile.brightness * 0.3), now + 0.62);
        releaseNodesLater(voice, 0.34 + index * 0.04, 0.38);
        registerOneShot(voice, 0.82);
        return voice;
      });
      return voices;
    };

    const playSoundReady = () => {
      const audio = ensureAudio();
      if (!audio) return;
      const profile = soundProfile(activeColor);
      [0, 4, 7].forEach((step, index) => {
        const voice = connectTimbre(profile, profile.base * (2 ** (step / 12)), 0.0001, (index - 1) * 0.32);
        if (!voice) return;
        const now = audio.currentTime;
        voice.master.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.032 * outputLevel), now + 0.025 + index * 0.018);
        releaseNodesLater(voice, 0.16 + index * 0.025, 0.22);
        registerOneShot(voice, 0.48);
      });
    };

    const eraseAt = (point) => {
      const { width, height } = canvasSize();
      const px = point.x * width;
      const py = point.y * height;
      const radius = eraserRadii[activeSize];
      let firstHit;
      const nextStrokes = [];

      strokes.forEach((stroke) => {
        let segment = [];
        let hitStroke = false;
        stroke.points.forEach((candidate) => {
          const cx = candidate.x * width;
          const cy = candidate.y * height;
          const hit = Math.hypot(cx - px, cy - py) <= radius + stroke.width * 0.35;
          if (hit) {
            hitStroke = true;
            if (!firstHit) firstHit = stroke;
            if (segment.length > 1) nextStrokes.push({ ...stroke, id: ++strokeCounter, points: segment });
            segment = [];
            eraseGhosts.push({ x: cx, y: cy, color: stroke.color, startedAt: performance.now() });
          } else {
            segment.push(candidate);
          }
        });
        if (segment.length > 1) nextStrokes.push({ ...stroke, id: hitStroke ? ++strokeCounter : stroke.id, points: segment });
      });

      if (firstHit) {
        strokes = nextStrokes;
        playEraseSound(firstHit, point);
        animateEraseGhosts();
      } else {
        drawStatic();
      }
    };

    const setTool = (tool) => {
      if (magicActive) stopMagic(false);
      activeTool = tool;
      toolButtons.forEach((button) => {
        const active = button.dataset.canvasTool === tool;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      canvas.classList.toggle("is-erasing", tool === "eraser");
      canvas.classList.toggle("is-highlighting", tool === "highlighter");
    };

    const syncColorPicker = (selectColor = true) => {
      const color = hsvToHex(pickerHue, pickerSaturation, pickerValue);
      if (customColor) customColor.value = color;
      if (hueControl) hueControl.value = String(Math.round(pickerHue));
      if (colorValueOutput) colorValueOutput.value = color.toUpperCase();
      customColorWrap?.style.setProperty("--custom-color", color);
      customColorWrap?.style.setProperty("--picker-hue", `hsl(${pickerHue} 100% 50%)`);
      customColorWrap?.style.setProperty("--picker-hue-number", String(pickerHue));
      customColorWrap?.style.setProperty("--picker-x", `${pickerSaturation * 100}%`);
      customColorWrap?.style.setProperty("--picker-y", `${(1 - pickerValue) * 100}%`);
      colorArea?.setAttribute("aria-valuetext", `${Math.round(pickerSaturation * 100)}% saturation, ${Math.round(pickerValue * 100)}% brightness`);
      if (selectColor && customColor) customColor.dispatchEvent(new Event("input", { bubbles: true }));
    };

    const updateColorArea = (event) => {
      if (!colorArea) return;
      const rect = colorArea.getBoundingClientRect();
      pickerSaturation = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      pickerValue = 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1);
      syncColorPicker(true);
    };

    const setColorPanelOpen = (open) => {
      customColorWrap?.classList.toggle("is-open", open);
      colorToggle?.setAttribute("aria-expanded", String(open));
    };

    const createBodies = () => {
      const { width, height } = canvasSize();
      return strokes.map((stroke, index) => {
        const absolute = stroke.points.map((point) => ({ x: point.x * width, y: point.y * height }));
        const center = absolute.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
        center.x /= absolute.length;
        center.y /= absolute.length;
        const local = absolute.map((point) => ({ x: point.x - center.x, y: point.y - center.y }));
        const radius = clamp(Math.max(...local.map((point) => Math.hypot(point.x, point.y))) * 0.56 + stroke.width, 11, 70);
        const seed = (stroke.id * 1.618 + index * 0.73) % TAU;
        const speed = 11 + (stroke.id % 7) * 2.2;
        return {
          id: stroke.id,
          color: stroke.color,
          tool: stroke.tool,
          width: stroke.width,
          local,
          x: center.x,
          y: center.y,
          vx: Math.cos(seed) * speed,
          vy: Math.sin(seed) * speed,
          angle: 0,
          angularVelocity: ((stroke.id % 5) - 2) * 0.035,
          radius,
          boundarySoundAt: 0
        };
      });
    };

    const bodyPoint = (body, point) => {
      const cosine = Math.cos(body.angle);
      const sine = Math.sin(body.angle);
      return {
        x: body.x + point.x * cosine - point.y * sine,
        y: body.y + point.x * sine + point.y * cosine
      };
    };

    const settleBodiesIntoStrokes = () => {
      const { width, height } = canvasSize();
      strokes = bodies.map((body) => ({
        id: body.id,
        color: body.color,
        tool: body.tool,
        width: body.width,
        points: body.local.map((point) => {
          const transformed = bodyPoint(body, point);
          return { x: clamp(transformed.x / width, 0, 1), y: clamp(transformed.y / height, 0, 1), time: performance.now() };
        })
      }));
    };

    const renderMagic = (now) => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      bodies.forEach((body) => drawPath(body.local, body.color, body.tool, body.width, (point) => bodyPoint(body, point)));
      collisionFlashes = collisionFlashes.filter((flash) => now - flash.startedAt < 280);
      collisionFlashes.forEach((flash) => {
        const progress = clamp((now - flash.startedAt) / 280, 0, 1);
        context.save();
        context.globalAlpha = (1 - progress) * 0.42;
        context.strokeStyle = flash.color;
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(flash.x, flash.y, 4 + progress * 18, 0, TAU);
        context.stroke();
        context.restore();
      });
    };

    const resolveCollisions = (now, energy) => {
      const { width, height } = canvasSize();
      const padding = 4;
      bodies.forEach((body) => {
        const radius = body.radius;
        let bounced = false;
        if (body.x - radius < padding) {
          body.x = padding + radius;
          body.vx = Math.abs(body.vx) * 0.9;
          bounced = true;
        } else if (body.x + radius > width - padding) {
          body.x = width - padding - radius;
          body.vx = -Math.abs(body.vx) * 0.9;
          bounced = true;
        }
        if (body.y - radius < padding) {
          body.y = padding + radius;
          body.vy = Math.abs(body.vy) * 0.9;
          bounced = true;
        } else if (body.y + radius > height - padding) {
          body.y = height - padding - radius;
          body.vy = -Math.abs(body.vy) * 0.9;
          bounced = true;
        }
        if (bounced && now - body.boundarySoundAt > 420) {
          body.boundarySoundAt = now;
          const impact = Math.hypot(body.vx, body.vy);
          playCollisionSound(body, body, body.x / width, body.y / height, Math.max(10, impact * 0.68));
          collisionFlashes.push({ x: body.x, y: body.y, color: body.color, startedAt: now });
        }
      });

      for (let first = 0; first < bodies.length; first += 1) {
        for (let second = first + 1; second < bodies.length; second += 1) {
          const bodyA = bodies[first];
          const bodyB = bodies[second];
          const dx = bodyB.x - bodyA.x;
          const dy = bodyB.y - bodyA.y;
          const distance = Math.max(0.001, Math.hypot(dx, dy));
          const minimumDistance = (bodyA.radius + bodyB.radius) * 0.78;
          if (distance >= minimumDistance) continue;

          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = minimumDistance - distance;
          bodyA.x -= nx * overlap * 0.5;
          bodyA.y -= ny * overlap * 0.5;
          bodyB.x += nx * overlap * 0.5;
          bodyB.y += ny * overlap * 0.5;
          const relativeX = bodyB.vx - bodyA.vx;
          const relativeY = bodyB.vy - bodyA.vy;
          const separatingVelocity = relativeX * nx + relativeY * ny;
          if (separatingVelocity < 0) {
            const impulse = -(1.72 * separatingVelocity) / 2;
            bodyA.vx -= impulse * nx;
            bodyA.vy -= impulse * ny;
            bodyB.vx += impulse * nx;
            bodyB.vy += impulse * ny;
            bodyA.angularVelocity -= (ny * relativeX - nx * relativeY) * 0.00045;
            bodyB.angularVelocity += (ny * relativeX - nx * relativeY) * 0.00045;
          }

          const relativeSpeed = Math.hypot(relativeX, relativeY) * energy;
          const pairKey = bodyA.id < bodyB.id ? `${bodyA.id}-${bodyB.id}` : `${bodyB.id}-${bodyA.id}`;
          const lastSound = collisionCooldowns.get(pairKey) || 0;
          if (relativeSpeed > 7 && now - lastSound > 190) {
            collisionCooldowns.set(pairKey, now);
            const collisionX = (bodyA.x + bodyB.x) / 2;
            const collisionY = (bodyA.y + bodyB.y) / 2;
            playCollisionSound(bodyA, bodyB, collisionX / width, collisionY / height, relativeSpeed);
            collisionFlashes.push({ x: collisionX, y: collisionY, color: bodyB.color, startedAt: now });
          }
        }
      }
    };

    const magicFrame = (now) => {
      if (!magicActive) return;
      const elapsed = (now - magicStartedAt) / 1000;
      const delta = clamp((now - lastPhysicsAt) / 1000, 0.001, 0.032);
      lastPhysicsAt = now;
      const energy = 0.72 + Math.min(1.75, elapsed / 18);
      const { width, height } = canvasSize();
      const centerX = width / 2;
      const centerY = height / 2;
      const fieldAngle = elapsed * 0.16;

      bodies.forEach((body, index) => {
        const towardCenterX = (centerX - body.x) * 0.006;
        const towardCenterY = (centerY - body.y) * 0.006;
        const orbitX = Math.cos(fieldAngle + index * 1.37) * (2.2 + energy * 1.4);
        const orbitY = Math.sin(fieldAngle * 0.82 + index * 1.11) * (2.2 + energy * 1.4);
        body.vx += (towardCenterX + orbitX) * delta * energy;
        body.vy += (towardCenterY + orbitY) * delta * energy;
        body.vx *= 0.999;
        body.vy *= 0.999;
        const speed = Math.hypot(body.vx, body.vy);
        const speedLimit = 31 + Math.min(62, elapsed * 2.1);
        if (speed > speedLimit) {
          body.vx = body.vx / speed * speedLimit;
          body.vy = body.vy / speed * speedLimit;
        }
        body.x += body.vx * delta;
        body.y += body.vy * delta;
        body.angle += body.angularVelocity * delta * (22 + energy * 5);
        body.angularVelocity = clamp(body.angularVelocity * 0.9995, -0.16, 0.16);
      });

      resolveCollisions(now, energy);

      if (bodies.length && now >= nextDanceSoundAt) {
        const density = clamp(elapsed / 18, 0, 1);
        const voiceCount = density > 0.72 && bodies.length > 2 ? 2 : 1;
        for (let voiceIndex = 0; voiceIndex < voiceCount; voiceIndex += 1) {
          const firstIndex = (danceSoundStep * 2 + voiceIndex) % bodies.length;
          const secondIndex = (firstIndex + 1 + danceSoundStep % Math.max(1, bodies.length - 1)) % bodies.length;
          const bodyA = bodies[firstIndex];
          const bodyB = bodies[secondIndex];
          const soundX = clamp((bodyA.x + bodyB.x) / (width * 2), 0, 1);
          const soundY = clamp((bodyA.y + bodyB.y) / (height * 2), 0, 1);
          const pulseVelocity = 28 + density * 50 + ((danceSoundStep + voiceIndex) % 4) * 7;
          playCollisionSound(bodyA, bodyB, soundX, soundY, pulseVelocity);
        }
        danceSoundStep += 1;
        const baseInterval = 860 - density * 500;
        const rhythmVariation = [0, 110, -70, 55, -35][danceSoundStep % 5];
        nextDanceSoundAt = now + Math.max(290, baseInterval + rhythmVariation);
      }

      renderMagic(now);
      magicAnimationFrame = requestAnimationFrame(magicFrame);
    };

    const startMagic = () => {
      if (!strokes.length) {
        magicButton.animate(
          [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
          { duration: 260, easing: "ease-out" }
        );
        return;
      }
      stopDrawingVoice();
      bodies = createBodies();
      magicActive = true;
      magicStartedAt = performance.now();
      lastPhysicsAt = magicStartedAt;
      nextDanceSoundAt = magicStartedAt + 520;
      danceSoundStep = 0;
      collisionCooldowns.clear();
      instrument.classList.add("is-magic");
      magicButton.classList.add("is-active");
      magicButton.setAttribute("aria-pressed", "true");
      if (magicLabel) magicLabel.textContent = "Pause";
      playDanceStart();
      magicAnimationFrame = requestAnimationFrame(magicFrame);
    };

    function stopMagic(settle = true) {
      if (!magicActive) return;
      magicActive = false;
      cancelAnimationFrame(magicAnimationFrame);
      if (settle) settleBodiesIntoStrokes();
      bodies = [];
      collisionFlashes = [];
      instrument.classList.remove("is-magic");
      magicButton.classList.remove("is-active");
      magicButton.setAttribute("aria-pressed", "false");
      if (magicLabel) magicLabel.textContent = "Dance";
      Array.from(oneShots).forEach((voice) => stopNodes(voice, 0.08));
      oneShots.clear();
      drawStatic();
    }

    canvas.addEventListener("pointerdown", (event) => {
      if (magicActive) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      drawing = true;
      const point = canvasPoint(event);
      if (activeTool === "eraser") {
        eraseAt(point);
        return;
      }
      const width = currentToolWidth();
      activeStroke = { id: ++strokeCounter, color: activeColor, tool: activeTool, width, points: [point] };
      strokes.push(activeStroke);
      startDrawingVoice(point, activeTool, activeColor);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drawing || magicActive) return;
      const point = canvasPoint(event);
      if (activeTool === "eraser") {
        eraseAt(point);
        return;
      }
      if (!activeStroke) return;
      const previous = activeStroke.points[activeStroke.points.length - 1];
      const { width, height } = canvasSize();
      const distance = Math.hypot((point.x - previous.x) * width, (point.y - previous.y) * height);
      const steps = Math.max(1, Math.ceil(distance / 4));
      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        activeStroke.points.push({
          x: previous.x + (point.x - previous.x) * progress,
          y: previous.y + (point.y - previous.y) * progress,
          time: previous.time + (point.time - previous.time) * progress
        });
      }
      drawStatic();
      updateDrawingVoice(point);
    });

    const endStroke = () => {
      drawing = false;
      if (activeStroke?.points.length === 1) strokes.pop();
      activeStroke = null;
      stopDrawingVoice();
      drawStatic();
    };

    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);
    canvas.addEventListener("lostpointercapture", endStroke);

    toolButtons.forEach((button) => {
      button.addEventListener("click", () => setTool(button.dataset.canvasTool));
    });

    sizeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeSize = button.dataset.canvasSize;
        sizeButtons.forEach((item) => {
          const selected = item === button;
          item.classList.toggle("is-active", selected);
          item.setAttribute("aria-pressed", String(selected));
        });
      });
    });

    swatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        activeColor = swatch.dataset.drawColor;
        swatches.forEach((item) => {
          const selected = item === swatch;
          item.classList.toggle("is-active", selected);
          item.setAttribute("aria-pressed", String(selected));
        });
        customColorWrap?.classList.remove("is-active");
        setColorPanelOpen(false);
      });
    });

    customColor?.addEventListener("input", () => {
      activeColor = customColor.value;
      swatches.forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-pressed", "false");
      });
      customColorWrap?.classList.add("is-active");
      customColorWrap?.style.setProperty("--custom-color", activeColor);
    });

    colorToggle?.addEventListener("click", () => {
      setColorPanelOpen(!customColorWrap.classList.contains("is-open"));
    });

    hueControl?.addEventListener("input", () => {
      pickerHue = Number(hueControl.value);
      syncColorPicker(true);
    });

    colorArea?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      pickingColor = true;
      colorArea.setPointerCapture(event.pointerId);
      updateColorArea(event);
    });

    colorArea?.addEventListener("pointermove", (event) => {
      if (pickingColor) updateColorArea(event);
    });

    const stopPickingColor = () => {
      pickingColor = false;
    };

    colorArea?.addEventListener("pointerup", stopPickingColor);
    colorArea?.addEventListener("pointercancel", stopPickingColor);
    colorArea?.addEventListener("lostpointercapture", stopPickingColor);
    colorArea?.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 0.08 : 0.025;
      if (event.key === "ArrowLeft") pickerSaturation = clamp(pickerSaturation - step, 0, 1);
      else if (event.key === "ArrowRight") pickerSaturation = clamp(pickerSaturation + step, 0, 1);
      else if (event.key === "ArrowUp") pickerValue = clamp(pickerValue + step, 0, 1);
      else if (event.key === "ArrowDown") pickerValue = clamp(pickerValue - step, 0, 1);
      else return;
      event.preventDefault();
      syncColorPicker(true);
    });

    soundButton?.addEventListener("click", async () => {
      const audio = ensureAudio();
      if (audio?.state === "suspended") {
        try {
          await audio.resume();
        } catch (error) {
          return;
        }
      }
      soundButton.classList.add("is-active");
      soundButton.setAttribute("aria-pressed", "true");
      if (soundButtonLabel) soundButtonLabel.textContent = "Sound ready";
      playSoundReady();
    });

    magicButton.addEventListener("click", async () => {
      if (magicActive) stopMagic(true);
      else {
        const audio = ensureAudio();
        if (audio?.state === "suspended") {
          try {
            await audio.resume();
          } catch (error) {
            // The next direct interaction can still unlock audio in restrictive browsers.
          }
        }
        startMagic();
      }
    });

    resetButton.addEventListener("click", () => {
      stopMagic(false);
      stopDrawingVoice();
      Array.from(oneShots).forEach((voice) => stopNodes(voice, 0.04));
      oneShots.clear();
      strokes = [];
      bodies = [];
      eraseGhosts.length = 0;
      collisionFlashes = [];
      drawing = false;
      activeStroke = null;
      drawStatic();
    });

    volumeControl?.addEventListener("input", () => {
      outputLevel = Number(volumeControl.value) / 100;
      if (volumeOutput) volumeOutput.value = `${volumeControl.value}%`;
      if (drawingVoice) {
        const target = (drawingVoice.tool === "highlighter" ? 0.025 : 0.05) * outputLevel;
        drawingVoice.master.gain.setTargetAtTime(Math.max(0.0001, target), drawingVoice.audio.currentTime, 0.03);
      }
    });

    infoButton?.addEventListener("click", () => {
      const open = !infoWrap.classList.contains("is-open");
      infoWrap.classList.toggle("is-open", open);
      infoButton.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", (event) => {
      if (infoWrap && !infoWrap.contains(event.target)) {
        infoWrap.classList.remove("is-open");
        infoButton?.setAttribute("aria-expanded", "false");
      }
      if (customColorWrap && !customColorWrap.contains(event.target)) setColorPanelOpen(false);
    });

    new ResizeObserver(resizeCanvas).observe(canvas);
    setTool("pen");
    syncColorPicker(false);
    resizeCanvas();
  });
})();
