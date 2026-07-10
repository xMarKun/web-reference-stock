const button = document.querySelector(".tunnel-button");
const canvas = document.querySelector(".tunnel-canvas");
const ctx = canvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TUNNEL = {
  halfWidth: 2,
  halfHeight: 1.8,
  segmentDepth: 1,
  segments: 18,
  nearPlane: 0.52,
  farPlane: 18,
};

const state = {
  travel: 3.8,
  speed: reduceMotion ? 0 : 0.6,
  targetSpeed: reduceMotion ? 0 : 0.6,
  pressed: false,
  lastTime: performance.now(),
  dpr: 1,
};

const palette = ["#ff6100", "#ffb200", "#ea3737", "#0072e3", "#00aa3c", "#a64cf0"];
const photoPalettes = [
  ["#f7f0e7", "#7bd7d0", "#ffb200", "#ffffff"],
  ["#f9f6ef", "#ff8f4f", "#0072e3", "#222222"],
  ["#f2efe7", "#ea3737", "#a64cf0", "#f8d9bd"],
  ["#f9f4ec", "#00aa3c", "#bde7ff", "#2b2b2b"],
  ["#fff9ee", "#ff6100", "#ffd56b", "#e7e1d8"],
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function pathQuad(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.closePath();
}

function boundsOf(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { left, top, width: right - left, height: bottom - top };
}

function drawPhotoTile(points, seed) {
  const bounds = boundsOf(points);
  const colors = photoPalettes[Math.floor(hash(seed + 2) * photoPalettes.length)];
  const gradient = ctx.createLinearGradient(bounds.left, bounds.top, bounds.left + bounds.width, bounds.top + bounds.height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.36, colors[1]);
  gradient.addColorStop(0.7, colors[2]);
  gradient.addColorStop(1, colors[3]);

  ctx.save();
  pathQuad(points);
  ctx.clip();
  ctx.fillStyle = gradient;
  ctx.fillRect(bounds.left - 2, bounds.top - 2, bounds.width + 4, bounds.height + 4);

  const pad = Math.max(4, Math.min(bounds.width, bounds.height) * 0.12);
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.fillRect(bounds.left + pad, bounds.top + pad, bounds.width * 0.42, bounds.height * 0.46);
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(bounds.left + bounds.width * 0.6, bounds.top + pad, bounds.width * 0.18, bounds.height * 0.72);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.68)";
  ctx.lineWidth = Math.max(2, Math.min(bounds.width, bounds.height) * 0.06);
  ctx.beginPath();
  ctx.moveTo(bounds.left + bounds.width * 0.12, bounds.top + bounds.height * 0.76);
  ctx.lineTo(bounds.left + bounds.width * 0.9, bounds.top + bounds.height * 0.24);
  ctx.stroke();
  ctx.restore();
}

function drawPanel(points, seed) {
  const variant = hash(seed);

  pathQuad(points);
  ctx.fillStyle = "#f4e9e1";
  ctx.fill();

  if (variant < 0.18) {
    ctx.fillStyle = palette[Math.floor(hash(seed + 9) * palette.length)];
    ctx.fill();
  } else if (variant < 0.4) {
    drawPhotoTile(points, seed);
  }

  pathQuad(points);
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function project(point, camera) {
  return {
    x: camera.cx + (point.x / point.z) * camera.focalLength,
    y: camera.cy + (point.y / point.z) * camera.focalLength,
  };
}

function drawWallSegment(nearZ, farZ, side, divisions, segmentId, camera) {
  for (let cell = 0; cell < divisions; cell += 1) {
    const a = cell / divisions;
    const b = (cell + 1) / divisions;
    let farA;
    let farB;
    let nearA;
    let nearB;

    if (side === "top" || side === "bottom") {
      const y = side === "top" ? -TUNNEL.halfHeight : TUNNEL.halfHeight;
      const xA = lerp(-TUNNEL.halfWidth, TUNNEL.halfWidth, a);
      const xB = lerp(-TUNNEL.halfWidth, TUNNEL.halfWidth, b);
      farA = { x: xA, y, z: farZ };
      farB = { x: xB, y, z: farZ };
      nearA = { x: xA, y, z: nearZ };
      nearB = { x: xB, y, z: nearZ };
    } else {
      const x = side === "left" ? -TUNNEL.halfWidth : TUNNEL.halfWidth;
      const yA = lerp(-TUNNEL.halfHeight, TUNNEL.halfHeight, a);
      const yB = lerp(-TUNNEL.halfHeight, TUNNEL.halfHeight, b);
      farA = { x, y: yA, z: farZ };
      farB = { x, y: yB, z: farZ };
      nearA = { x, y: yA, z: nearZ };
      nearB = { x, y: yB, z: nearZ };
    }

    const seed = segmentId * 101 + cell * 17 + side.charCodeAt(0);
    drawPanel([project(farA, camera), project(farB, camera), project(nearB, camera), project(nearA, camera)], seed);
  }
}

function drawFarOpening(camera) {
  const z = TUNNEL.farPlane;
  const points = [
    project({ x: -TUNNEL.halfWidth, y: -TUNNEL.halfHeight, z }, camera),
    project({ x: TUNNEL.halfWidth, y: -TUNNEL.halfHeight, z }, camera),
    project({ x: TUNNEL.halfWidth, y: TUNNEL.halfHeight, z }, camera),
    project({ x: -TUNNEL.halfWidth, y: TUNNEL.halfHeight, z }, camera),
  ];

  pathQuad(points);
  ctx.fillStyle = "#f4e9e1";
  ctx.fill();
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTunnel() {
  const width = canvas.width / state.dpr;
  const height = canvas.height / state.dpr;
  const camera = {
    cx: width / 2,
    cy: height / 2,
    focalLength: Math.min(width, height) * 0.92,
  };
  const firstSegment = Math.floor(state.travel / TUNNEL.segmentDepth);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f4e9e1";
  ctx.fillRect(0, 0, width, height);
  drawFarOpening(camera);

  // Draw back to front. Each panel keeps its world segment ID while the
  // camera moves through it, so neither geometry nor imagery jumps at a loop.
  for (let index = TUNNEL.segments; index >= 0; index -= 1) {
    const segmentId = firstSegment + index;
    const unclippedNearZ = segmentId * TUNNEL.segmentDepth - state.travel;
    const farZ = unclippedNearZ + TUNNEL.segmentDepth;

    if (farZ <= TUNNEL.nearPlane) continue;
    if (unclippedNearZ >= TUNNEL.farPlane) continue;

    const nearZ = Math.max(unclippedNearZ, TUNNEL.nearPlane);
    drawWallSegment(nearZ, farZ, "top", 4, segmentId, camera);
    drawWallSegment(nearZ, farZ, "bottom", 4, segmentId + 31, camera);
    drawWallSegment(nearZ, farZ, "left", 4, segmentId + 63, camera);
    drawWallSegment(nearZ, farZ, "right", 4, segmentId + 97, camera);
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.max(1, Math.round(rect.width * state.dpr));
  canvas.height = Math.max(1, Math.round(rect.height * state.dpr));
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  drawTunnel();
}

function setPressed(value) {
  state.pressed = value;
  state.targetSpeed = reduceMotion ? 0 : value ? 4 : 0.6;
  state.speed = state.targetSpeed;
  button.classList.toggle("is-pressed", value);
  button.setAttribute("aria-pressed", String(value));
}

function animate(time) {
  const dt = Math.min(0.05, (time - state.lastTime) / 1000);
  state.lastTime = time;
  state.travel += state.speed * dt;
  drawTunnel();
  window.requestAnimationFrame(animate);
}

button.addEventListener("pointerenter", () => {
  button.classList.add("is-hovered");
});

button.addEventListener("pointerleave", () => {
  button.classList.remove("is-hovered");
  setPressed(false);
});

button.addEventListener("pointermove", (event) => {
  const rect = button.getBoundingClientRect();
  button.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
  button.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
});

button.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  button.setPointerCapture(event.pointerId);
  setPressed(true);
});

button.addEventListener("pointerup", (event) => {
  if (button.hasPointerCapture(event.pointerId)) {
    button.releasePointerCapture(event.pointerId);
  }
  setPressed(false);
});

button.addEventListener("pointercancel", () => {
  setPressed(false);
});

button.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    setPressed(true);
  }
});

button.addEventListener("keyup", (event) => {
  if (event.key === " " || event.key === "Enter") {
    setPressed(false);
  }
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();

if (reduceMotion) {
  drawTunnel();
} else {
  window.requestAnimationFrame(animate);
}
