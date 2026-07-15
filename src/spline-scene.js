const SCENE_URL = "https://prod.spline.design/Slk6b8kz3LRlKiyk/scene.splinecode";

export async function initSplineScene() {
  const canvas = document.querySelector("#spline-scene");
  const stage = canvas?.closest(".hero-media");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!canvas || !stage || reduceMotion) {
    stage?.classList.add("spline-unavailable");
    return null;
  }

  try {
    const { Application } = await import("@splinetool/runtime");
    const app = new Application(canvas);
    await app.load(SCENE_URL);
    stage.classList.add("spline-ready");

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) app.stop?.();
      else app.play?.();
    });

    return app;
  } catch (error) {
    console.warn("Spline scene could not load; using the local video fallback.", error);
    stage.classList.add("spline-unavailable");
    return null;
  }
}
