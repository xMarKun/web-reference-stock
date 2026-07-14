const loader = document.querySelector("[data-loader]");
const loaderStack = document.querySelector("[data-loader-stack]");
const loaderStatus = document.querySelector("[data-loader-status]");
const loaderMessage = document.querySelector("[data-loader-message]");
const loaderProgress = document.querySelector("[data-loader-progress]");
const loaderBar = document.querySelector("[data-loader-bar]");
const curtainPaths = [...document.querySelectorAll("[data-curtain-path]")];
const site = document.querySelector("[data-site]");
const replayButton = document.querySelector("[data-replay]");
const stickerScene = document.querySelector("[data-sticker-scene]");
const sticker = document.querySelector("[data-sticker]");
const stickerMeter = document.querySelector("[data-sticker-meter]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const INITIAL_CURTAIN_PATH = "M -2 -2 H 102 V 102 Q 50 102 -2 102 Z";
const messages = [
  "おいしい土台を準備中…",
  "香ばしいメインを重ねます…",
  "とろける一枚を追加中…",
  "彩りトマトをスライス中…",
  "シャキッとグリーンを追加中…",
  "最後のひと重ね…",
];

let introTimers = [];
let progressFrame = 0;
let curtainFrame = 0;
let stickerFrame = 0;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function easeInOutQuad(value) {
  return value < 0.5
    ? 2 * value * value
    : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function easeInOutQuart(value) {
  return value < 0.5
    ? 8 * Math.pow(value, 4)
    : 1 - Math.pow(-2 * value + 2, 4) / 2;
}

function schedule(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  introTimers.push(timer);
}

function clearIntro() {
  introTimers.forEach((timer) => window.clearTimeout(timer));
  introTimers = [];
  window.cancelAnimationFrame(progressFrame);
  window.cancelAnimationFrame(curtainFrame);
  progressFrame = 0;
  curtainFrame = 0;

  if (typeof loaderStack?.getAnimations === "function") {
    loaderStack.getAnimations().forEach((animation) => animation.cancel());
  }
}

function setProgress(value) {
  const safeValue = clamp(value, 0, 100);
  loaderProgress?.setAttribute("aria-valuenow", String(Math.floor(safeValue)));

  if (loaderBar) {
    loaderBar.style.width = `${safeValue}%`;
  }
}

function animateProgress() {
  const startedAt = performance.now();

  const tick = (now) => {
    const progress = clamp((now - startedAt) / 1500);
    setProgress(easeInOutQuad(progress) * 100);

    if (progress < 1) {
      progressFrame = window.requestAnimationFrame(tick);
    }
  };

  progressFrame = window.requestAnimationFrame(tick);
}

function squashStack() {
  if (!loaderStack || typeof loaderStack.animate !== "function") return;

  loaderStack.animate(
    [
      { transform: "scaleX(1) scaleY(1)" },
      { transform: "scaleX(1.06) scaleY(.88)", offset: 0.23 },
      { transform: "scaleX(.98) scaleY(1.03)", offset: 0.54 },
      { transform: "scaleX(1) scaleY(1)" },
    ],
    {
      duration: 260,
      easing: "linear",
    },
  );
}

function resetCurtains() {
  curtainPaths.forEach((path) => path.setAttribute("d", INITIAL_CURTAIN_PATH));
}

function animateCurtains() {
  const startedAt = performance.now();
  // DOM order is back, middle, front. The visible front layer leaves first.
  const delays = [240, 120, 0];

  const tick = (now) => {
    let isComplete = true;

    curtainPaths.forEach((path, index) => {
      const localTime = now - startedAt - delays[index];
      const edgeProgress = clamp(localTime / 800);
      const centerProgress = clamp(localTime / 1100);

      if (centerProgress < 1) isComplete = false;

      const edgeY = 102 - 104 * easeInOutQuad(edgeProgress);
      const centerY = 102 - 104 * easeInOutQuart(centerProgress);
      const edge = edgeY.toFixed(3);
      const center = centerY.toFixed(3);

      path.setAttribute("d", `M -2 -2 H 102 V ${edge} Q 50 ${center} -2 ${edge} Z`);
    });

    if (isComplete) {
      finishIntro();
      return;
    }

    curtainFrame = window.requestAnimationFrame(tick);
  };

  curtainFrame = window.requestAnimationFrame(tick);
}

function finishIntro() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.body.classList.remove("is-loading");
  loader?.setAttribute("hidden", "");
  site?.setAttribute("aria-hidden", "false");
  updateSticker();
}

function playIntro() {
  if (!loader || !loaderStack || !site) return;

  clearIntro();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.body.classList.add("is-loading");
  site.setAttribute("aria-hidden", "true");
  loader.removeAttribute("hidden");
  loader.classList.remove("is-playing", "is-status-leaving", "is-leaving");
  loaderStack.classList.remove("is-bursting", "is-ready");
  loaderMessage.textContent = messages[0];
  setProgress(0);
  resetCurtains();

  // Force a style flush so the CSS ingredient sequence can replay.
  void loader.offsetWidth;
  loader.classList.add("is-playing");

  animateProgress();

  messages.forEach((message, index) => {
    schedule(() => {
      loaderMessage.textContent = message;
    }, 50 + index * 220);

    schedule(squashStack, 300 + index * 220);
  });

  schedule(() => {
    loaderStack.classList.add("is-bursting");
  }, 1420);

  schedule(() => {
    loaderMessage.textContent = "できあがり！ GOOD DAY!";
    loaderStack.classList.add("is-ready");
  }, 1720);

  schedule(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    loader.classList.add("is-status-leaving");
  }, 2220);

  schedule(() => {
    loader.classList.add("is-leaving");
    animateCurtains();
  }, 2620);
}

function updateSticker() {
  if (!sticker || !stickerScene || !stickerMeter) return;

  if (reduceMotion.matches) {
    sticker.style.setProperty("--peel", "0");
    stickerMeter.style.transform = "scaleX(1)";
    return;
  }

  const stickerTop = sticker.getBoundingClientRect().top;
  const startLine = window.innerHeight * 0.96;
  const endLine = window.innerHeight * 0.48;
  const travel = Math.max(startLine - endLine, 1);
  const progress = clamp((startLine - stickerTop) / travel);
  const peelAmount = 1 - progress;

  sticker.style.setProperty("--peel", peelAmount.toFixed(4));
  stickerMeter.style.transform = `scaleX(${progress.toFixed(4)})`;
}

function requestStickerUpdate() {
  if (stickerFrame) return;

  stickerFrame = window.requestAnimationFrame(() => {
    updateSticker();
    stickerFrame = 0;
  });
}

function updateStickerLight(event) {
  if (!sticker) return;

  const bounds = sticker.getBoundingClientRect();
  const x = clamp((event.clientX - bounds.left) / bounds.width) * 100;
  const y = clamp((event.clientY - bounds.top) / bounds.height) * 100;
  sticker.style.setProperty("--light-x", `${x.toFixed(1)}%`);
  sticker.style.setProperty("--light-y", `${y.toFixed(1)}%`);
}

function resetStickerLight() {
  sticker?.style.setProperty("--light-x", "50%");
  sticker?.style.setProperty("--light-y", "25%");
}

window.addEventListener("scroll", requestStickerUpdate, { passive: true });
window.addEventListener("resize", requestStickerUpdate);
replayButton?.addEventListener("click", playIntro);

if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  sticker?.addEventListener("pointermove", updateStickerLight);
  sticker?.addEventListener("pointerleave", resetStickerLight);
}

if (reduceMotion.matches) {
  finishIntro();
} else {
  playIntro();
}
