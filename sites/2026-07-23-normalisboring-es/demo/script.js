const svg = document.querySelector("[data-morph-svg]");
const progressOutput = document.querySelector("[data-progress]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const numberPattern = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
const scrubDuration = 2000;

let currentProgress = 0;
let targetProgress = 0;
let startScroll = 0;
let endScroll = 1;
let animationFrame = 0;
let previousTime = 0;

function createMorph(path) {
  const startValue = path.dataset.start || "";
  const endValue = path.dataset.end || "";
  const start = (startValue.match(numberPattern) || []).map(Number);
  const end = (endValue.match(numberPattern) || []).map(Number);
  const fragments = startValue.split(numberPattern);

  if (start.length !== end.length) {
    return null;
  }

  return { path, start, end, fragments };
}

const morphs = svg ? [...svg.querySelectorAll("[data-start][data-end]")].map(createMorph).filter(Boolean) : [];

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

function render(progress) {
  morphs.forEach(({ path, start, end, fragments }) => {
    let value = fragments[0];

    start.forEach((startNumber, index) => {
      const number = startNumber + (end[index] - startNumber) * progress;
      value += `${number.toFixed(2)}${fragments[index + 1]}`;
    });

    path.setAttribute("d", value);
  });

  svg?.setAttribute("data-progress", progress.toFixed(3));

  if (progressOutput) {
    progressOutput.value = String(Math.round(progress * 100)).padStart(3, "0");
  }
}

function measure() {
  if (!svg) {
    return;
  }

  const rect = svg.getBoundingClientRect();
  const documentTop = rect.top + window.scrollY;
  const topAtHalfViewport = documentTop - window.innerHeight * 0.5;
  const bottomAtViewportBottom = documentTop + rect.height - window.innerHeight;

  startScroll = Math.min(topAtHalfViewport, bottomAtViewportBottom);
  endScroll = Math.max(topAtHalfViewport, bottomAtViewportBottom);
  updateTarget();
}

function updateTarget() {
  if (!svg) {
    return;
  }

  if (reducedMotion.matches) {
    targetProgress = 1;
    currentProgress = 1;
    render(1);
    return;
  }

  targetProgress = clamp((window.scrollY - startScroll) / Math.max(1, endScroll - startScroll));

  if (!animationFrame) {
    previousTime = 0;
    animationFrame = requestAnimationFrame(tick);
  }
}

function tick(time) {
  const delta = previousTime ? Math.min(64, time - previousTime) : 16;
  const follow = Math.min(1, (delta / scrubDuration) * 8);

  previousTime = time;
  currentProgress += (targetProgress - currentProgress) * follow;

  if (Math.abs(targetProgress - currentProgress) < 0.0005) {
    currentProgress = targetProgress;
  }

  render(currentProgress);

  if (currentProgress !== targetProgress) {
    animationFrame = requestAnimationFrame(tick);
  } else {
    animationFrame = 0;
  }
}

function handleMotionPreference() {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  measure();
}

window.addEventListener("scroll", updateTarget, { passive: true });
window.addEventListener("resize", measure);
reducedMotion.addEventListener?.("change", handleMotionPreference);

measure();
render(reducedMotion.matches ? 1 : currentProgress);
