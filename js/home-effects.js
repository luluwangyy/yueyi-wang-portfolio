// Homepage-only: mounts the hero background and the SpecularButton CTA, and
// cross-fades the background's visibility (opacity + interaction) as the
// user scrolls from the hero into the Selected Work section.
//
// The background is a soft 3D sphere (see hero-sphere.js) — the earlier
// LiquidEther fluid animation (liquid-ether.js) is hidden, not deleted, in
// case we want it back.
import { createHeroSphere } from "./hero-sphere.js";
import { createSpecularButton } from "./specular-button.js";

const liquidRoot = document.getElementById("liquid-ether-root");
const homeTop = document.querySelector(".home-top");

if (liquidRoot && homeTop && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const fx = createHeroSphere(liquidRoot, {
    // Pale blue-white (not pure white) so the lit side still reads as a
    // shape against the white page, harmonizing with the cyan shadow side.
    litColor: "#e6f4fa",
    shadowColor: "#aee9f2",
    fillFraction: 0.86,
    blurPx: 4,
    idleRotateSpeed: 0.12,
    followEase: 0.055
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
  liquidRoot.style.background = "#ffffff";
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
