// Homepage-only: mounts the LiquidEther background and the SpecularButton
// CTA, and cross-fades the LiquidEther's visibility (opacity + interaction)
// as the user scrolls from the hero into the Selected Work section.
import { createLiquidEther } from "./liquid-ether.js";
import { createSpecularButton } from "./specular-button.js";

const liquidRoot = document.getElementById("liquid-ether-root");
const homeTop = document.querySelector(".home-top");

if (liquidRoot && homeTop && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const fx = createLiquidEther(liquidRoot, {
    colors: ["#1d346b", "#307878", "#81f8ff"],
    mouseForce: 20,
    cursorSize: 75,
    isViscous: false,
    viscous: 31,
    iterationsViscous: 30,
    iterationsPoisson: 38,
    resolution: 0.5,
    isBounce: false,
    autoDemo: true,
    autoSpeed: 0.5,
    autoIntensity: 2.6,
    takeoverDuration: 0.25,
    autoResumeDelay: 3000,
    autoRampDuration: 0.6
  });

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
    // clicks meant for the Selected Work section beneath it.
    const shouldDisable = progress >= 0.98;
    if (shouldDisable !== interactionDisabled) {
      interactionDisabled = shouldDisable;
      fx.setMouseEnabled(!interactionDisabled);
      if (interactionDisabled) {
        fx.pause();
      } else {
        fx.start();
      }
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateFade);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  updateFade();
} else if (liquidRoot) {
  // Reduced-motion: keep a plain, still background instead of the sim.
  liquidRoot.style.background = "var(--color-bg-alt)";
}

const heroCta = document.querySelector(".hero-cta");
if (heroCta) {
  createSpecularButton(heroCta, {
    radius: 999,
    lineColor: heroCta.dataset.sbLineColor || "#ffffff",
    baseColor: heroCta.dataset.sbBaseColor || "#525252",
    intensity: Number(heroCta.dataset.sbIntensity) || 1,
    shineSize: Number(heroCta.dataset.sbShineSize) || 10,
    shineFade: Number(heroCta.dataset.sbShineFade) || 40,
    thickness: Number(heroCta.dataset.sbThickness) || 1,
    speed: Number(heroCta.dataset.sbSpeed) || 0.35,
    proximity: Number(heroCta.dataset.sbProximity) || 250,
    followMouse: true,
    autoAnimate: false
  });
}
