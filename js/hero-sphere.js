// A soft, elegant 3D sphere for the homepage hero background — replaces the
// LiquidEther fluid animation. Lit like a moon/planet: a pale yellow-orange
// "day" side and a pale blue "night" side, with a soft terminator between
// them (no hard line). The sphere itself never rotates; instead the light
// direction orbits it, always leaning toward wherever the cursor is, with a
// slow idle auto-drift when the cursor's been still for a bit. The silhouette
// fades softly to transparent (revealing the white page) via a Fresnel term
// in the shader, plus a light CSS blur on the canvas for extra softness.
//
// Usage:
//   import { createHeroSphere } from "./hero-sphere.js";
//   const fx = createHeroSphere(containerEl, { ... });
//   fx.start(); fx.pause(); fx.setMouseEnabled(false); fx.dispose();

import * as THREE from "https://esm.sh/three@0.169.0";

const VERT = `
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAG = `
precision highp float;
uniform vec3 uLitColor;
uniform vec3 uShadowColor;
uniform vec3 uLightDir;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uLightDir);

  // Terminator: a bit more defined than a fully flat gradient, so the
  // sphere's actual curvature reads instead of looking like a flat blob.
  float diffuse = dot(N, L);
  float t = smoothstep(-0.25, 0.35, diffuse);
  vec3 color = mix(uShadowColor, uLitColor, t);

  // Edge (limb) darkening: real lit spheres go slightly darker/cooler
  // toward the grazing-angle rim on BOTH sides — this single cue is most
  // of what reads as "3D sphere" instead of "flat gradient disc".
  float facing = clamp(dot(N, V), 0.0, 1.0);
  float limb = mix(0.78, 1.0, pow(facing, 0.6));
  color *= limb;

  // Specular glint where the reflection lines up with the viewer — the
  // second big cue for roundness/glossiness.
  vec3 H = normalize(L + V);
  float spec = pow(clamp(dot(N, H), 0.0, 1.0), 60.0) * smoothstep(0.0, 0.4, diffuse);
  color += spec * 0.55;

  // A gentle warm highlight around the light-facing region (broader/softer
  // than the specular glint above).
  float highlight = smoothstep(0.55, 1.0, diffuse) * 0.16;
  color += highlight * vec3(1.0, 0.97, 0.92);

  // Fresnel falloff: opaque near the center of the disc, fading to fully
  // transparent at the silhouette so the edge blends softly into the page
  // instead of a hard circular cutoff.
  // Pushed even wider/earlier: the melt into the white page now starts
  // well before the true silhouette and finishes gradually, so there's no
  // point where it reads as a hard-ish ring — just a long, soft dissolve.
  float fresnel = pow(1.0 - facing, 0.9);
  float alpha = smoothstep(0.0, 0.85, 1.0 - fresnel);

  gl_FragColor = vec4(color, alpha);
}
`;

export function createHeroSphere(container, opts = {}) {
  const options = {
    litColor: "#ffe3ad",
    shadowColor: "#aecdf2",
    fillFraction: 0.86, // sphere diameter as a fraction of the smaller viewport dimension
    blurPx: 3,
    idleRotateSpeed: 0.12, // radians/sec of the auto-drift light orbit, while the cursor is off-page
    followEase: 0.055, // per-frame lerp factor toward the target light dir (smaller = smoother/slower)
    ...opts
  };

  let mouseEnabled = true;
  let running = false;
  let disposed = false;
  let rafId = null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
  camera.position.set(0, 0, 3);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(new THREE.Color(0x000000), 0);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  renderer.domElement.style.filter = `blur(${options.blurPx}px)`;
  container.appendChild(renderer.domElement);

  const geometry = new THREE.SphereGeometry(1, 96, 96);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uLitColor: { value: new THREE.Color(options.litColor) },
      uShadowColor: { value: new THREE.Color(options.shadowColor) },
      uLightDir: { value: new THREE.Vector3(0.4, 0.3, 0.8) }
    }
  });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  function resize() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);

    const vFov = (camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * camera.position.z;
    const visibleWidth = visibleHeight * camera.aspect;
    const minDim = Math.min(visibleWidth, visibleHeight);
    const radius = (minDim * options.fillFraction) / 2;
    sphere.scale.setScalar(radius);
  }

  // --- Cursor tracking -> target light direction, with idle auto-drift ---
  // "Idle" means the cursor has actually left the page/window — NOT just
  // that it stopped moving while still resting over the hero. A resting
  // cursor should keep the light pinned on it, not drift away on its own.
  let cursorPresent = false;
  let targetDir = new THREE.Vector3(0.4, 0.3, 0.8).normalize();
  const currentDir = material.uniforms.uLightDir.value;
  let autoAngle = Math.atan2(0.3, 0.4);

  function onPointerMove(event) {
    if (!mouseEnabled) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    // z stays positive so the light always leans toward the camera — the
    // sphere never goes fully dark, it just tilts which side is brighter.
    targetDir.set(nx, -ny, 0.65).normalize();
    cursorPresent = true;
  }
  function onPointerLeave() {
    cursorPresent = false;
  }
  window.addEventListener("mousemove", onPointerMove);
  document.documentElement.addEventListener("mouseleave", onPointerLeave);

  function updateLightTarget(dtSeconds) {
    const idle = !cursorPresent || !mouseEnabled;
    if (idle) {
      autoAngle += options.idleRotateSpeed * dtSeconds;
      targetDir.set(Math.cos(autoAngle) * 0.65, Math.sin(autoAngle) * 0.45, 0.65).normalize();
    }
    currentDir.lerp(targetDir, options.followEase);
  }

  // --- Render loop, with the same off-screen/hidden-tab pausing as the
  // previous LiquidEther background ---
  const clock = new THREE.Clock();

  function frame() {
    if (!running) return;
    const dt = clock.getDelta();
    updateLightTarget(dt);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (disposed || running) return;
    running = true;
    clock.start();
    rafId = requestAnimationFrame(frame);
  }
  function pause() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }
  function stop() {
    pause();
  }
  function setMouseEnabled(enabled) {
    mouseEnabled = enabled;
    if (!enabled) cursorPresent = false;
  }
  function dispose() {
    disposed = true;
    pause();
    window.removeEventListener("mousemove", onPointerMove);
    document.documentElement.removeEventListener("mouseleave", onPointerLeave);
    resizeObserver.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);

  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible) start();
      else pause();
    },
    { threshold: 0.01 }
  );
  io.observe(container);

  function onVisibility() {
    if (document.hidden) pause();
    else if (!disposed) start();
  }
  document.addEventListener("visibilitychange", onVisibility);

  resize();
  renderer.render(scene, camera);

  return { start, pause, stop, setMouseEnabled, dispose };
}
