const canvas = document.querySelector("[data-dome-canvas]");
const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");

const CONFIG = Object.freeze({
  visibleCount: 12,
  domeRadius: 15.2,
  horizontalRadiusScale: 0.95,
  planeHeight: 8.1,
  minPlaneWidth: 5.6,
  maxPlaneWidth: 9.9,
  collisionScale: 0.94,
  domeYScale: 0.88,
  domeYOffset: -0.9,
  topPullDown: 0.8,
  planeSegments: 16,
  cameraFov: 60,
  cameraTargetY: -4,
  wheelScale: 0.18,
  touchScale: 0.9,
  velocityDecay: 0.92,
  maxVelocity: 180,
  wheelFactor: 0.5,
  wheelDirection: -1,
  orbitSensitivity: 0.253,
  curveFrequency: 0.18,
  curveStrength: 0.11,
  depthCurveStrength: 0.05,
  reassignCount: 4,
  artworkCount: 24,
});

const ARTWORKS = [
  {
    shape: "portrait",
    paper: "#1a2730",
    glow: "#82c9c1",
    ink: "#071113",
    accent: "#ed6a4d",
    skin: "#d9a27f",
    mode: 0,
  },
  {
    shape: "portrait",
    paper: "#d9d1c5",
    glow: "#f7ead7",
    ink: "#22201e",
    accent: "#172c68",
    skin: "#8f5f45",
    mode: 2,
  },
  {
    shape: "portrait",
    paper: "#7a1623",
    glow: "#ef9a7d",
    ink: "#22070c",
    accent: "#f2c967",
    skin: "#b8795f",
    mode: 1,
  },
  {
    shape: "landscape",
    paper: "#15261e",
    glow: "#9dc59a",
    ink: "#08110d",
    accent: "#e6b44d",
    skin: "#d5aa8c",
    mode: 3,
  },
  {
    shape: "portrait",
    paper: "#b9c2d0",
    glow: "#eff2f7",
    ink: "#11161d",
    accent: "#e84b33",
    skin: "#754936",
    mode: 2,
  },
  {
    shape: "square",
    paper: "#301648",
    glow: "#a780c5",
    ink: "#13081f",
    accent: "#72d6cd",
    skin: "#c88d69",
    mode: 0,
  },
  {
    shape: "portrait",
    paper: "#d7b36f",
    glow: "#f0ddb5",
    ink: "#2b1c0d",
    accent: "#31584d",
    skin: "#6f432f",
    mode: 1,
  },
  {
    shape: "landscape",
    paper: "#7d93a3",
    glow: "#dce9ed",
    ink: "#101b22",
    accent: "#e47743",
    skin: "#b77555",
    mode: 3,
  },
  {
    shape: "portrait",
    paper: "#222222",
    glow: "#737373",
    ink: "#050505",
    accent: "#e7e0d2",
    skin: "#c49170",
    mode: 0,
  },
  {
    shape: "square",
    paper: "#c64d36",
    glow: "#f3a46c",
    ink: "#35120d",
    accent: "#173b54",
    skin: "#87543f",
    mode: 2,
  },
  {
    shape: "portrait",
    paper: "#c9d2aa",
    glow: "#eef2d7",
    ink: "#182113",
    accent: "#6b2847",
    skin: "#d0a386",
    mode: 1,
  },
  {
    shape: "landscape",
    paper: "#17345b",
    glow: "#5e8ec3",
    ink: "#08192e",
    accent: "#f0b24b",
    skin: "#9f684f",
    mode: 3,
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createNoiseTile() {
  const noise = document.createElement("canvas");
  noise.width = 128;
  noise.height = 128;
  const context = noise.getContext("2d");
  const pixels = context.createImageData(noise.width, noise.height);
  const random = createRandom(213);

  for (let index = 0; index < pixels.data.length; index += 4) {
    const tone = Math.floor(random() * 255);
    pixels.data[index] = tone;
    pixels.data[index + 1] = tone;
    pixels.data[index + 2] = tone;
    pixels.data[index + 3] = Math.floor(28 + random() * 46);
  }

  context.putImageData(pixels, 0, 0);
  return noise;
}

const noiseTile = createNoiseTile();

function getArtworkSize(shape) {
  if (shape === "landscape") {
    return { width: 1024, height: 512 };
  }

  if (shape === "square") {
    return { width: 512, height: 512 };
  }

  return { width: 512, height: 1024 };
}

function drawSoftBackdrop(context, width, height, spec, random) {
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, spec.paper);
  background.addColorStop(0.56, spec.glow);
  background.addColorStop(1, spec.paper);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.save();
  context.filter = `blur(${Math.round(Math.min(width, height) * 0.075)}px)`;
  context.globalAlpha = 0.58;

  for (let index = 0; index < 4; index += 1) {
    const radius = Math.min(width, height) * (0.18 + random() * 0.28);
    const glow = context.createRadialGradient(
      width * random(),
      height * random(),
      0,
      width * random(),
      height * random(),
      radius,
    );
    glow.addColorStop(0, index % 2 === 0 ? spec.accent : spec.glow);
    glow.addColorStop(1, "transparent");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  }

  context.restore();

  context.save();
  context.globalAlpha = 0.14;
  context.strokeStyle = spec.ink;
  context.lineWidth = Math.max(1, width * 0.002);
  const step = Math.max(32, Math.round(width * 0.075));

  for (let x = -height; x < width + height; x += step) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x - height * 0.35, height);
    context.stroke();
  }

  context.restore();
}

function drawBust(context, width, height, spec, random) {
  const centerX = width * (0.43 + (random() - 0.5) * 0.18);
  const headY = height * 0.31;
  const headRadiusX = Math.min(width, height) * 0.105;
  const headRadiusY = headRadiusX * 1.28;

  context.save();
  context.globalAlpha = 0.52;
  context.fillStyle = spec.accent;
  context.beginPath();
  context.ellipse(
    centerX + width * 0.09,
    headY + height * 0.015,
    headRadiusX * 2.25,
    headRadiusY * 1.65,
    -0.25,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();

  context.fillStyle = spec.ink;
  context.beginPath();
  context.moveTo(centerX - width * 0.36, height * 1.02);
  context.bezierCurveTo(
    centerX - width * 0.33,
    height * 0.62,
    centerX - width * 0.2,
    height * 0.48,
    centerX,
    height * 0.49,
  );
  context.bezierCurveTo(
    centerX + width * 0.24,
    height * 0.47,
    centerX + width * 0.39,
    height * 0.66,
    centerX + width * 0.42,
    height * 1.02,
  );
  context.closePath();
  context.fill();

  const garment = context.createLinearGradient(0, height * 0.5, width, height);
  garment.addColorStop(0, spec.accent);
  garment.addColorStop(1, spec.ink);
  context.fillStyle = garment;
  context.beginPath();
  context.moveTo(centerX - width * 0.28, height * 0.62);
  context.quadraticCurveTo(centerX, height * 0.48, centerX + width * 0.29, height * 0.62);
  context.lineTo(centerX + width * 0.38, height * 1.02);
  context.lineTo(centerX - width * 0.38, height * 1.02);
  context.closePath();
  context.fill();

  context.fillStyle = spec.skin;
  context.fillRect(
    centerX - headRadiusX * 0.32,
    headY + headRadiusY * 0.7,
    headRadiusX * 0.64,
    headRadiusY * 1.12,
  );
  context.beginPath();
  context.ellipse(
    centerX,
    headY,
    headRadiusX,
    headRadiusY,
    -0.08,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.fillStyle = spec.ink;
  context.beginPath();
  context.ellipse(
    centerX - headRadiusX * 0.05,
    headY - headRadiusY * 0.36,
    headRadiusX * 1.04,
    headRadiusY * 0.68,
    -0.16,
    Math.PI,
    Math.PI * 2,
  );
  context.lineTo(centerX + headRadiusX * 0.9, headY + headRadiusY * 0.18);
  context.quadraticCurveTo(
    centerX + headRadiusX * 0.64,
    headY - headRadiusY * 0.05,
    centerX + headRadiusX * 0.38,
    headY - headRadiusY * 0.2,
  );
  context.closePath();
  context.fill();

  context.save();
  context.strokeStyle = spec.ink;
  context.lineWidth = Math.max(2, width * 0.008);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(centerX - headRadiusX * 0.46, headY - headRadiusY * 0.02);
  context.lineTo(centerX - headRadiusX * 0.08, headY - headRadiusY * 0.08);
  context.moveTo(centerX + headRadiusX * 0.12, headY - headRadiusY * 0.08);
  context.lineTo(centerX + headRadiusX * 0.48, headY - headRadiusY * 0.02);
  context.moveTo(centerX - headRadiusX * 0.12, headY + headRadiusY * 0.45);
  context.quadraticCurveTo(
    centerX + headRadiusX * 0.08,
    headY + headRadiusY * 0.52,
    centerX + headRadiusX * 0.28,
    headY + headRadiusY * 0.42,
  );
  context.stroke();
  context.restore();
}

function drawFullFigure(context, width, height, spec, random) {
  const centerX = width * (0.5 + (random() - 0.5) * 0.2);
  const headY = height * 0.18;
  const unit = Math.min(width, height);

  context.save();
  context.globalAlpha = 0.36;
  context.fillStyle = spec.glow;
  context.beginPath();
  context.arc(centerX, headY, unit * 0.23, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.fillStyle = spec.skin;
  context.beginPath();
  context.ellipse(centerX, headY, unit * 0.07, unit * 0.09, 0.08, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = spec.ink;
  context.beginPath();
  context.ellipse(
    centerX,
    headY - unit * 0.035,
    unit * 0.074,
    unit * 0.065,
    0.05,
    Math.PI,
    Math.PI * 2,
  );
  context.fill();

  context.fillStyle = spec.skin;
  context.fillRect(centerX - unit * 0.025, headY + unit * 0.07, unit * 0.05, unit * 0.12);

  const dress = context.createLinearGradient(
    centerX - unit * 0.3,
    height * 0.28,
    centerX + unit * 0.34,
    height * 0.93,
  );
  dress.addColorStop(0, spec.accent);
  dress.addColorStop(0.58, spec.ink);
  dress.addColorStop(1, spec.accent);
  context.fillStyle = dress;
  context.beginPath();
  context.moveTo(centerX - unit * 0.12, height * 0.28);
  context.quadraticCurveTo(centerX, height * 0.23, centerX + unit * 0.12, height * 0.28);
  context.bezierCurveTo(
    centerX + unit * 0.18,
    height * 0.48,
    centerX + unit * 0.34,
    height * 0.68,
    centerX + unit * 0.42,
    height * 0.96,
  );
  context.lineTo(centerX - unit * 0.4, height * 0.96);
  context.bezierCurveTo(
    centerX - unit * 0.3,
    height * 0.68,
    centerX - unit * 0.19,
    height * 0.49,
    centerX - unit * 0.12,
    height * 0.28,
  );
  context.closePath();
  context.fill();

  context.save();
  context.globalAlpha = 0.34;
  context.strokeStyle = spec.glow;
  context.lineWidth = unit * 0.016;

  for (let index = 0; index < 7; index += 1) {
    context.beginPath();
    context.moveTo(centerX - unit * 0.31 + index * unit * 0.1, height * 0.45);
    context.quadraticCurveTo(
      centerX + (index - 3) * unit * 0.04,
      height * 0.66,
      centerX - unit * 0.24 + index * unit * 0.08,
      height * 0.91,
    );
    context.stroke();
  }

  context.restore();
}

function drawProfile(context, width, height, spec, random) {
  const unit = Math.min(width, height);
  const centerX = width * (0.56 + (random() - 0.5) * 0.14);
  const centerY = height * 0.39;

  context.save();
  context.globalAlpha = 0.62;
  context.fillStyle = spec.accent;
  context.beginPath();
  context.arc(centerX - unit * 0.05, centerY, unit * 0.31, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.fillStyle = spec.ink;
  context.beginPath();
  context.moveTo(centerX - unit * 0.42, height * 1.03);
  context.quadraticCurveTo(centerX - unit * 0.26, height * 0.57, centerX, height * 0.54);
  context.quadraticCurveTo(centerX + unit * 0.26, height * 0.57, centerX + unit * 0.43, height * 1.03);
  context.closePath();
  context.fill();

  context.fillStyle = spec.skin;
  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    unit * 0.12,
    unit * 0.16,
    -0.18,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.fillStyle = spec.ink;
  context.beginPath();
  context.arc(centerX - unit * 0.045, centerY - unit * 0.07, unit * 0.115, Math.PI, Math.PI * 2);
  context.quadraticCurveTo(
    centerX + unit * 0.13,
    centerY - unit * 0.01,
    centerX + unit * 0.085,
    centerY + unit * 0.04,
  );
  context.quadraticCurveTo(
    centerX - unit * 0.02,
    centerY - unit * 0.01,
    centerX - unit * 0.15,
    centerY + unit * 0.02,
  );
  context.closePath();
  context.fill();

  context.save();
  context.strokeStyle = spec.ink;
  context.lineWidth = Math.max(2, unit * 0.007);
  context.beginPath();
  context.moveTo(centerX + unit * 0.025, centerY - unit * 0.005);
  context.lineTo(centerX + unit * 0.1, centerY + unit * 0.005);
  context.moveTo(centerX + unit * 0.045, centerY + unit * 0.09);
  context.quadraticCurveTo(
    centerX + unit * 0.09,
    centerY + unit * 0.1,
    centerX + unit * 0.12,
    centerY + unit * 0.07,
  );
  context.stroke();
  context.restore();
}

function drawAbstractSet(context, width, height, spec, random) {
  const unit = Math.min(width, height);
  const centerX = width * (0.48 + (random() - 0.5) * 0.16);
  const centerY = height * 0.48;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(-0.18);

  for (let index = 0; index < 5; index += 1) {
    const scale = 1 - index * 0.14;
    context.globalAlpha = 0.18 + index * 0.12;
    context.strokeStyle = index % 2 === 0 ? spec.accent : spec.ink;
    context.lineWidth = unit * (0.018 + index * 0.004);
    context.beginPath();
    context.ellipse(
      0,
      0,
      unit * 0.46 * scale,
      unit * 0.27 * scale,
      index * 0.12,
      0,
      Math.PI * 2,
    );
    context.stroke();
  }

  context.restore();

  context.fillStyle = spec.ink;
  context.fillRect(width * 0.17, height * 0.2, width * 0.13, height * 0.58);
  context.fillStyle = spec.accent;
  context.fillRect(width * 0.7, height * 0.33, width * 0.12, height * 0.5);

  context.save();
  context.globalAlpha = 0.76;
  context.fillStyle = spec.glow;
  context.beginPath();
  context.moveTo(width * 0.34, height * 0.12);
  context.lineTo(width * 0.72, height * 0.22);
  context.lineTo(width * 0.58, height * 0.89);
  context.lineTo(width * 0.24, height * 0.72);
  context.closePath();
  context.fill();
  context.restore();
}

function finishArtwork(context, width, height, spec, index, random) {
  context.save();
  context.globalAlpha = 0.2;
  context.fillStyle = spec.ink;
  context.font = `900 ${Math.round(Math.min(width, height) * 0.3)}px Georgia, serif`;
  context.textAlign = "right";
  context.textBaseline = "top";
  context.fillText(String(index + 1).padStart(2, "0"), width * 0.95, height * 0.02);
  context.restore();

  context.save();
  context.globalAlpha = 0.74;
  context.fillStyle = spec.ink;
  context.font = `700 ${Math.max(14, Math.round(width * 0.022))}px Arial, sans-serif`;
  context.letterSpacing = `${Math.max(2, Math.round(width * 0.004))}px`;
  context.fillText("FORM / STUDY", width * 0.055, height * 0.945);
  context.restore();

  const pattern = context.createPattern(noiseTile, "repeat");
  context.save();
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = 0.38;
  context.fillStyle = pattern;
  context.fillRect(0, 0, width, height);
  context.restore();

  context.save();
  context.globalAlpha = 0.32;

  for (let index = 0; index < 180; index += 1) {
    const radius = random() * 1.5 + 0.3;
    context.fillStyle = random() > 0.52 ? "#ffffff" : "#000000";
    context.beginPath();
    context.arc(random() * width, random() * height, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();

  const vignette = context.createRadialGradient(
    width * 0.5,
    height * 0.45,
    Math.min(width, height) * 0.12,
    width * 0.5,
    height * 0.45,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.28)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.5;
  context.strokeStyle = "rgba(255, 255, 255, 0.48)";
  context.lineWidth = Math.max(2, width * 0.004);
  context.strokeRect(width * 0.025, height * 0.018, width * 0.95, height * 0.964);
  context.restore();
}

function createArtwork(spec, index) {
  const source = document.createElement("canvas");
  const { width, height } = getArtworkSize(spec.shape);
  source.width = width;
  source.height = height;
  const context = source.getContext("2d");
  const random = createRandom(2130 + index * 97);

  drawSoftBackdrop(context, width, height, spec, random);

  if (spec.mode === 0) {
    drawBust(context, width, height, spec, random);
  } else if (spec.mode === 1) {
    drawFullFigure(context, width, height, spec, random);
  } else if (spec.mode === 2) {
    drawProfile(context, width, height, spec, random);
  } else {
    drawAbstractSet(context, width, height, spec, random);
  }

  finishArtwork(context, width, height, spec, index, random);
  return source;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Shader compilation failed.");
  }

  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message || "Shader link failed.");
  }

  return program;
}

function createPlaneGeometry(segments) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const rowLength = segments + 1;

  for (let y = 0; y <= segments; y += 1) {
    const v = y / segments;

    for (let x = 0; x <= segments; x += 1) {
      const u = x / segments;
      positions.push(u - 0.5, v - 0.5);
      uvs.push(u, v);
    }
  }

  for (let y = 0; y < segments; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const bottomLeft = y * rowLength + x;
      const bottomRight = bottomLeft + 1;
      const topLeft = bottomLeft + rowLength;
      const topRight = topLeft + 1;
      indices.push(bottomLeft, bottomRight, topLeft);
      indices.push(bottomRight, topRight, topLeft);
    }
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function createPerspective(fov, aspect, near, far) {
  const scale = 1 / Math.tan((fov * Math.PI) / 360);
  const range = 1 / (near - far);

  return new Float32Array([
    scale / aspect,
    0,
    0,
    0,
    0,
    scale,
    0,
    0,
    0,
    0,
    (near + far) * range,
    -1,
    0,
    0,
    near * far * range * 2,
    0,
  ]);
}

function createViewMatrix(eye, target) {
  const up = [0, 1, 0];
  const zAxis = normalize([
    eye[0] - target[0],
    eye[1] - target[1],
    eye[2] - target[2],
  ]);
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);

  return new Float32Array([
    xAxis[0],
    yAxis[0],
    zAxis[0],
    0,
    xAxis[1],
    yAxis[1],
    zAxis[1],
    0,
    xAxis[2],
    yAxis[2],
    zAxis[2],
    0,
    -dot(xAxis, eye),
    -dot(yAxis, eye),
    -dot(zAxis, eye),
    1,
  ]);
}

function createFacingModelMatrix(position) {
  const up = [0, 1, 0];
  const zAxis = normalize([-position[0], -position[1], -position[2]]);
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);

  return new Float32Array([
    xAxis[0],
    xAxis[1],
    xAxis[2],
    0,
    yAxis[0],
    yAxis[1],
    yAxis[2],
    0,
    zAxis[0],
    zAxis[1],
    zAxis[2],
    0,
    position[0],
    position[1],
    position[2],
    1,
  ]);
}

function getPlaneSize(aspect) {
  const unclampedWidth = CONFIG.planeHeight * aspect;

  return {
    width:
      clamp(unclampedWidth, CONFIG.minPlaneWidth, CONFIG.maxPlaneWidth) *
      CONFIG.collisionScale,
    height: CONFIG.planeHeight * CONFIG.collisionScale,
  };
}

function createDomePositions() {
  const positions = [];
  const ringRadius = CONFIG.domeRadius * CONFIG.horizontalRadiusScale;

  for (let index = 0; index < CONFIG.visibleCount; index += 1) {
    const theta = (index / CONFIG.visibleCount) * Math.PI * 2;
    const row = (index % 3) - 1;
    const phi = Math.PI * 0.52 + row * 0.24;
    const rawY = CONFIG.domeRadius * Math.cos(phi) * CONFIG.domeYScale;
    const y =
      rawY -
      Math.max(0, rawY) * CONFIG.topPullDown +
      CONFIG.domeYOffset;

    positions.push([
      ringRadius * Math.cos(theta),
      y,
      ringRadius * Math.sin(theta),
    ]);
  }

  return positions;
}

function isPowerOfTwo(value) {
  return (value & (value - 1)) === 0;
}

function createTexture(gl, source, anisotropyExtension) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    source,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  if (isPowerOfTwo(source.width) && isPowerOfTwo(source.height)) {
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  if (anisotropyExtension) {
    const max = gl.getParameter(
      anisotropyExtension.MAX_TEXTURE_MAX_ANISOTROPY_EXT,
    );
    gl.texParameterf(
      gl.TEXTURE_2D,
      anisotropyExtension.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(max, 16),
    );
  }

  return texture;
}

function drawFallback(message) {
  const context = canvas.getContext("2d");

  if (!context) {
    canvas.dataset.error = message;
    return;
  }

  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  context.scale(ratio, ratio);
  context.fillStyle = "#f3f1ec";
  context.fillRect(0, 0, innerWidth, innerHeight);
  context.fillStyle = "#151515";
  context.font = '16px "Helvetica Neue", Arial, sans-serif';
  context.textAlign = "center";
  context.fillText(message, innerWidth / 2, innerHeight / 2);
}

function startSlider() {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: true,
    depth: true,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });

  if (!gl) {
    drawFallback("この環境ではWebGLスライダーを表示できません。");
    return;
  }

  const vertexSource = `
    precision highp float;

    attribute vec2 aPosition;
    attribute vec2 aUv;

    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    uniform vec2 uPlaneSize;
    uniform float uVelocity;

    varying vec2 vUv;

    void main() {
      vec3 base = vec3(aPosition * uPlaneSize, 0.0);
      vec4 worldBase = uModel * vec4(base, 1.0);
      float worldY = worldBase.y;
      float scrollImpulse = uVelocity * 0.005 * 0.5 * -1.0;
      float dynamicCurve = scrollImpulse * 0.5;

      vec3 deformed = base;
      deformed.x += 0.11 * cos(worldY * 0.18) - 0.11;
      deformed.y -= sin(aUv.x * 3.14159265359) * dynamicCurve;
      deformed.z -= pow(abs(worldY), 1.25) * 0.05;

      gl_Position = uProjection * uView * uModel * vec4(deformed, 1.0);
      vUv = aUv;
    }
  `;

  const fragmentSource = `
    precision mediump float;

    uniform sampler2D uTexture;
    varying vec2 vUv;

    void main() {
      gl_FragColor = texture2D(uTexture, vUv);
    }
  `;

  let program;

  try {
    program = createProgram(gl, vertexSource, fragmentSource);
  } catch (error) {
    console.error(error);
    drawFallback("3Dスライダーの初期化に失敗しました。");
    return;
  }

  const geometry = createPlaneGeometry(CONFIG.planeSegments);
  const positionBuffer = gl.createBuffer();
  const uvBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.uvs, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

  const locations = {
    position: gl.getAttribLocation(program, "aPosition"),
    uv: gl.getAttribLocation(program, "aUv"),
    projection: gl.getUniformLocation(program, "uProjection"),
    view: gl.getUniformLocation(program, "uView"),
    model: gl.getUniformLocation(program, "uModel"),
    planeSize: gl.getUniformLocation(program, "uPlaneSize"),
    velocity: gl.getUniformLocation(program, "uVelocity"),
    texture: gl.getUniformLocation(program, "uTexture"),
  };

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(locations.position);
  gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.enableVertexAttribArray(locations.uv);
  gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.uniform1i(locations.texture, 0);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(243 / 255, 241 / 255, 236 / 255, 1);

  const anisotropyExtension =
    gl.getExtension("EXT_texture_filter_anisotropic") ||
    gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic") ||
    gl.getExtension("MOZ_EXT_texture_filter_anisotropic");
  const sources = Array.from({ length: CONFIG.artworkCount }, (_, index) =>
    createArtwork(ARTWORKS[index % ARTWORKS.length], index),
  );
  const artworkAspects = sources.map(
    (source) => source.width / source.height,
  );
  const textures = sources.map((source) =>
    createTexture(gl, source, anisotropyExtension),
  );

  for (const source of sources) {
    source.width = 1;
    source.height = 1;
  }

  const positions = createDomePositions();
  const planes = positions.map((position, index) => {
    const artworkIndex =
      (index - 2 + CONFIG.visibleCount) % CONFIG.visibleCount;

    return {
      artworkIndex,
      model: createFacingModelMatrix(position),
      position,
      size: getPlaneSize(artworkAspects[artworkIndex]),
      texture: textures[artworkIndex],
      wasVisible: false,
    };
  });
  const safeVisibleCount = CONFIG.visibleCount - CONFIG.reassignCount;
  const slotStep = (Math.PI * 2) / CONFIG.visibleCount;
  const recycleStart =
    Math.ceil((Math.PI * 1.5) / slotStep) % CONFIG.visibleCount;
  const recycleOrder = Array.from(
    { length: CONFIG.visibleCount },
    (_, index) => (recycleStart + index) % CONFIG.visibleCount,
  );

  let projection = createPerspective(
    CONFIG.cameraFov,
    innerWidth / innerHeight,
    0.1,
    1000,
  );
  let velocity = 0;
  let orbitAngle = 0;
  let pointerId = null;
  let pointerType = null;
  let pointerX = 0;
  let pointerY = 0;
  let didDrag = false;
  let frameId = null;
  let isContextLost = false;
  let nextArtworkIndex = CONFIG.visibleCount;
  let reassignmentCount = 0;

  function getSafeSet(angle) {
    const cameraDirection = [
      CONFIG.domeRadius * 0.9 * Math.sin(angle),
      CONFIG.cameraTargetY,
      CONFIG.domeRadius * 0.9 * Math.cos(angle),
    ];
    const rankedSlots = positions
      .map((position, slotIndex) => ({
        slotIndex,
        score: dot(position, cameraDirection),
      }))
      .sort((a, b) => b.score - a.score);

    return new Set(
      rankedSlots
        .slice(0, safeVisibleCount)
        .map(({ slotIndex }) => slotIndex),
    );
  }

  function recycleSlots(angle) {
    const safeSet = getSafeSet(angle);
    const exitedSlots = [];

    for (let index = 0; index < planes.length; index += 1) {
      const plane = planes[index];
      const isVisible = safeSet.has(index);

      if (plane.wasVisible && !isVisible) {
        exitedSlots.push(index);
      }

      plane.wasVisible = isVisible;
    }

    if (exitedSlots.length === 0) {
      return;
    }

    const exitedSet = new Set(exitedSlots);
    let changed = 0;

    for (const slotIndex of recycleOrder) {
      if (!exitedSet.has(slotIndex)) {
        continue;
      }

      const artworkIndex = nextArtworkIndex % CONFIG.artworkCount;
      const plane = planes[slotIndex];
      plane.artworkIndex = artworkIndex;
      plane.texture = textures[artworkIndex];
      plane.size = getPlaneSize(artworkAspects[artworkIndex]);
      nextArtworkIndex += 1;
      reassignmentCount += 1;
      changed += 1;

      if (changed >= CONFIG.reassignCount) {
        break;
      }
    }
  }

  function resize() {
    const pixelRatio = Math.min(devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(innerWidth * pixelRatio));
    const height = Math.max(1, Math.round(innerHeight * pixelRatio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    projection = createPerspective(
      CONFIG.cameraFov,
      innerWidth / innerHeight,
      0.1,
      1000,
    );
    canvas.dataset.pixelRatio = pixelRatio.toFixed(2);
  }

  function addWheelImpulse(delta) {
    const scale = motionQuery.matches ? CONFIG.wheelScale * 0.32 : CONFIG.wheelScale;
    const limit = motionQuery.matches ? 42 : CONFIG.maxVelocity;
    velocity = clamp(velocity + delta * scale, -limit, limit);
  }

  function addTouchImpulse(delta) {
    const scale = motionQuery.matches ? CONFIG.touchScale * 0.3 : CONFIG.touchScale;
    const limit = motionQuery.matches ? 42 : CONFIG.maxVelocity;
    velocity = clamp(velocity - delta * scale, -limit, limit);
  }

  function render() {
    if (isContextLost) {
      return;
    }

    const decay = motionQuery.matches ? 0.78 : CONFIG.velocityDecay;
    velocity *= decay;
    const scrollImpulse =
      velocity * 0.005 * CONFIG.wheelFactor * CONFIG.wheelDirection;
    orbitAngle += scrollImpulse * CONFIG.orbitSensitivity;
    recycleSlots(orbitAngle);

    const cameraTarget = [
      CONFIG.domeRadius * 0.9 * Math.sin(orbitAngle),
      CONFIG.cameraTargetY,
      CONFIG.domeRadius * 0.9 * Math.cos(orbitAngle),
    ];
    const view = createViewMatrix([0, 0, 0], cameraTarget);
    const shaderVelocity = motionQuery.matches ? 0 : velocity;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(locations.projection, false, projection);
    gl.uniformMatrix4fv(locations.view, false, view);
    gl.uniform1f(locations.velocity, shaderVelocity);
    gl.activeTexture(gl.TEXTURE0);

    for (const plane of planes) {
      gl.uniformMatrix4fv(locations.model, false, plane.model);
      gl.uniform2f(locations.planeSize, plane.size.width, plane.size.height);
      gl.bindTexture(gl.TEXTURE_2D, plane.texture);
      gl.drawElements(
        gl.TRIANGLES,
        geometry.indices.length,
        gl.UNSIGNED_SHORT,
        0,
      );
    }

    canvas.dataset.velocity = velocity.toFixed(3);
    canvas.dataset.warp = Math.abs(shaderVelocity * -0.00125).toFixed(4);
    canvas.dataset.orbit = orbitAngle.toFixed(5);
    frameId = requestAnimationFrame(render);
  }

  function handleWheel(event) {
    addWheelImpulse(event.deltaY);
  }

  function handlePointerDown(event) {
    if (event.pointerType === "mouse") {
      return;
    }

    pointerId = event.pointerId;
    pointerType = event.pointerType;
    pointerX = event.clientX;
    pointerY = event.clientY;
    didDrag = false;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (pointerId === null || event.pointerId !== pointerId || pointerType === "mouse") {
      return;
    }

    const deltaX = event.clientX - pointerX;
    const deltaY = event.clientY - pointerY;
    const dominantDelta =
      Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;

    if (
      didDrag ||
      Math.abs(deltaX) >= 6 ||
      Math.abs(deltaY) >= 6
    ) {
      didDrag = true;
      addTouchImpulse(dominantDelta);
      event.preventDefault();
    }

    pointerX = event.clientX;
    pointerY = event.clientY;
  }

  function releasePointer(event) {
    if (event.pointerId !== pointerId) {
      return;
    }

    canvas.releasePointerCapture?.(event.pointerId);
    pointerId = null;
    pointerType = null;
    didDrag = false;
  }

  function handleKeydown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      addWheelImpulse(360);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      addWheelImpulse(-360);
    }
  }

  function handleContextLost(event) {
    event.preventDefault();
    isContextLost = true;

    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function handleContextRestored() {
    location.reload();
  }

  window.addEventListener("resize", resize);
  window.addEventListener("wheel", handleWheel, { passive: true });
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("keydown", handleKeydown);
  canvas.addEventListener("webglcontextlost", handleContextLost);
  canvas.addEventListener("webglcontextrestored", handleContextRestored);

  motionQuery.addEventListener?.("change", () => {
    velocity = 0;
  });

  window.__domeSlider = {
    config: CONFIG,
    impulse(deltaY) {
      addWheelImpulse(deltaY);
    },
    getState() {
      return {
        velocity,
        orbitAngle,
        maxWarp: Math.abs((motionQuery.matches ? 0 : velocity) * -0.00125),
        planeCount: planes.length,
        planeSegments: CONFIG.planeSegments,
        artworkCount: CONFIG.artworkCount,
        artworkIndices: planes.map((plane) => plane.artworkIndex),
        nextArtworkIndex,
        reassignmentCount,
        reducedMotion: motionQuery.matches,
        canvas: {
          width: canvas.width,
          height: canvas.height,
          cssWidth: innerWidth,
          cssHeight: innerHeight,
        },
      };
    },
  };

  resize();
  const initialSafeSet = getSafeSet(orbitAngle);

  for (let index = 0; index < planes.length; index += 1) {
    planes[index].wasVisible = initialSafeSet.has(index);
  }

  canvas.dataset.ready = "true";
  canvas.dataset.renderer = "webgl";
  render();
}

if (canvas) {
  startSlider();
}
