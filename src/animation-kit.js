import { animate, inView, stagger } from "motion";

const EASE = [0.22, 1, 0.36, 1];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function initPageEntrance() {
  const page = document.querySelector("[data-page-entrance]");
  if (!page || reduceMotion) return;
  animate(
    page,
    { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0px)"] },
    { duration: 0.72, ease: EASE },
  );
}

function initReveals() {
  if (reduceMotion) return;
  document.querySelectorAll("[data-reveal]").forEach((element) => {
    element.style.opacity = "0";
    element.style.transform = "translateY(24px)";
    inView(
      element,
      () => {
        const controls = animate(
          element,
          { opacity: [0, 1], transform: ["translateY(24px)", "translateY(0px)"] },
          { duration: 0.78, ease: EASE },
        );
        controls.finished.then(() => { element.style.transform = ""; });
      },
      { amount: Number(element.dataset.revealAmount || 0.2) },
    );
  });

  document.querySelectorAll("[data-stagger]").forEach((container) => {
    const items = Array.from(container.querySelectorAll("[data-stagger-item]"));
    if (!items.length) return;
    items.forEach((item) => {
      item.style.opacity = "0";
      item.style.transform = "translateY(18px)";
    });
    inView(
      container,
      () => {
        const controls = animate(
          items,
          { opacity: [0, 1], transform: ["translateY(18px)", "translateY(0px)"] },
          { duration: 0.64, delay: stagger(0.09), ease: EASE },
        );
        controls.finished.then(() => items.forEach((item) => { item.style.transform = ""; }));
      },
      { amount: Number(container.dataset.staggerAmount || 0.16) },
    );
  });
}

function initSpotlights() {
  if (reduceMotion) return;
  document.querySelectorAll("[data-spotlight]").forEach((element) => {
    element.addEventListener("pointermove", (event) => {
      const bounds = element.getBoundingClientRect();
      element.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
      element.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
      element.dataset.spotlightActive = "true";
    });
    element.addEventListener("pointerleave", () => {
      element.dataset.spotlightActive = "false";
    });
  });
}

function initSeamlessVideos() {
  document.querySelectorAll("[data-seamless-video]").forEach((container) => {
    const videos = Array.from(container.querySelectorAll("video"));
    if (videos.length !== 2) return;
    let active = 0;
    let switching = false;
    let frame = 0;

    const safePlay = async (video) => {
      video.muted = true;
      try { await video.play(); } catch { /* autoplay can be retried on visibility */ }
    };

    videos.forEach((video, index) => {
      video.muted = true;
      video.currentTime = 0;
      video.classList.toggle("is-active", index === 0);
    });
    safePlay(videos[0]);

    const tick = () => {
      const current = videos[active];
      const nextIndex = active === 0 ? 1 : 0;
      const next = videos[nextIndex];
      if (
        !switching && Number.isFinite(current.duration) && current.duration > 0 &&
        current.duration - current.currentTime <= 0.22
      ) {
        switching = true;
        next.currentTime = 0;
        safePlay(next);
        next.classList.add("is-active");
        current.classList.remove("is-active");
        window.setTimeout(() => {
          current.pause();
          current.currentTime = 0;
          active = nextIndex;
          switching = false;
        }, reduceMotion ? 0 : 360);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) videos.forEach((video) => video.pause());
      else safePlay(videos[active]);
    });
    container.animationCleanup = () => cancelAnimationFrame(frame);
  });
}

export function initAnimationKit() {
  initPageEntrance();
  initReveals();
  initSpotlights();
  initSeamlessVideos();
}
