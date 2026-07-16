const canvas = document.querySelector('[data-flag-canvas]');
const button = document.querySelector('[data-next]');
const caption = document.querySelector('[data-caption]');
const frame = document.querySelector('[data-frame]');
const fallback = document.querySelector('[data-fallback]');

const flags = [
  { name: 'EMBER / 01' },
  { name: 'ASH BLUE / 02' },
  { name: 'FOREST / 03' },
];

const TRANSITION_DURATION = 1800;
const INTRO_DELAY = 900;
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

function showFallback() {
  fallback.hidden = false;
  button.disabled = true;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || 'Shader compilation failed.');
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
    throw new Error(message || 'Shader link failed.');
  }

  return program;
}

function startDemo() {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: true,
    premultipliedAlpha: false,
  });

  if (!gl) {
    showFallback();
    return;
  }

  const planeVertexSource = `
    precision mediump float;

    attribute vec2 aPosition;
    attribute vec2 aUv;

    uniform float uAspect;
    uniform float uMotion;
    uniform float uProgress;
    uniform float uTime;
    uniform sampler2D uNoise;

    varying vec2 vUv;
    varying float vBurn;
    varying float vWaveLight;

    vec3 rotateFlag(vec3 point) {
      float angleX = -0.383972;
      float angleZ = -0.139626;
      float cosX = cos(angleX);
      float sinX = sin(angleX);
      float cosZ = cos(angleZ);
      float sinZ = sin(angleZ);
      vec3 rotatedX = vec3(
        point.x,
        point.y * cosX - point.z * sinX,
        point.y * sinX + point.z * cosX
      );
      return vec3(
        rotatedX.x * cosZ - rotatedX.y * sinZ,
        rotatedX.x * sinZ + rotatedX.y * cosZ,
        rotatedX.z
      );
    }

    void main() {
      float noiseR = texture2D(uNoise, aUv + vec2(uTime * 0.018, 0.0)).r;
      float noiseG = texture2D(uNoise, aUv - vec2(uTime * 0.027, 0.0)).g;
      float slide = texture2D(uNoise, aUv * 0.998 + 0.001).b;
      float burnSource = slide * 0.6 + noiseR * 0.2 + noiseG * 0.2;
      float burn = uProgress * 1.38 - burnSource;

      float wave1 = sin(aUv.x * -8.0 + aUv.y * -8.0 + uTime * 1.25);
      float wave2 = sin(aUv.x * 5.0 + aUv.y * 2.0 + uTime * 0.9);
      float wave = (wave1 * 0.6 + wave2 * 1.2) * 0.07 * uMotion;

      float riseSource = uProgress * 2.0 - slide;
      float rise = smoothstep(0.0, 0.5, riseSource)
        * (1.0 - smoothstep(0.5, 1.0, riseSource))
        * 0.38
        * uMotion;

      vec3 position = vec3(aPosition, wave + rise);
      position.y += sin(uTime * 0.55 + aUv.x * 2.0) * 0.025 * uMotion;
      position = rotateFlag(position);
      position.z -= 3.35;

      float perspective = 2.35;
      gl_Position = vec4(
        position.x * perspective / uAspect,
        position.y * perspective,
        0.0,
        -position.z
      );

      vUv = aUv;
      vBurn = burn;
      vWaveLight = 0.78 + (wave1 * 0.35 + wave2 * 0.2 + 0.55) * 0.2;
    }
  `;

  const planeFragmentSource = `
    precision mediump float;

    uniform float uCurrent;
    uniform float uNext;
    uniform float uTime;
    uniform sampler2D uNoise;

    varying vec2 vUv;
    varying float vBurn;
    varying float vWaveLight;

    vec3 flagPattern(float id, vec2 uv) {
      if (id < 0.5) {
        vec3 base = mix(vec3(0.17, 0.015, 0.01), vec3(0.95, 0.25, 0.025), uv.x);
        vec2 sunPoint = (uv - vec2(0.34, 0.52)) * vec2(1.0, 1.5);
        float distanceFromSun = length(sunPoint);
        float disk = 1.0 - smoothstep(0.105, 0.125, distanceFromSun);
        float ring = 1.0 - smoothstep(0.012, 0.026, abs(distanceFromSun - 0.19));
        float angle = atan(sunPoint.y, sunPoint.x);
        float rays = pow(abs(sin(angle * 8.0)), 18.0)
          * smoothstep(0.14, 0.18, distanceFromSun)
          * (1.0 - smoothstep(0.19, 0.31, distanceFromSun));
        float mark = clamp(disk + ring * 0.75 + rays * 0.7, 0.0, 1.0);
        return mix(base, vec3(1.0, 0.88, 0.52), mark);
      }

      if (id < 1.5) {
        vec3 base = mix(vec3(0.015, 0.06, 0.16), vec3(0.05, 0.55, 0.78), uv.x);
        float stripe = smoothstep(0.62, 0.9, 0.5 + sin((uv.x + uv.y) * 34.0) * 0.5);
        base += vec3(0.03, 0.12, 0.18) * stripe;
        vec2 orbitPoint = (uv - vec2(0.69, 0.51)) * vec2(1.0, 1.5);
        float orbitDistance = length(orbitPoint);
        float disk = 1.0 - smoothstep(0.105, 0.125, orbitDistance);
        float ring = 1.0 - smoothstep(0.012, 0.024, abs(orbitDistance - 0.19));
        float slash = 1.0 - smoothstep(
          0.014,
          0.03,
          abs((uv.x - 0.29) + (uv.y - 0.55) * 0.55)
        );
        slash *= step(0.12, uv.x) * step(uv.x, 0.5) * step(0.24, uv.y) * step(uv.y, 0.78);
        float mark = clamp(disk * 0.8 + ring + slash * 0.7, 0.0, 1.0);
        return mix(base, vec3(0.86, 0.97, 1.0), mark);
      }

      vec3 base = mix(vec3(0.015, 0.12, 0.075), vec3(0.22, 0.55, 0.12), uv.x);
      float bands = smoothstep(0.7, 0.92, 0.5 + sin(uv.y * 30.0) * 0.5);
      base += vec3(0.05, 0.11, 0.0) * bands;
      vec2 center = uv - vec2(0.5, 0.51);
      float diamond = 1.0 - smoothstep(0.16, 0.185, abs(center.x) + abs(center.y) * 0.72);
      float line1 = 1.0 - smoothstep(0.009, 0.018, abs(uv.x - 0.2));
      float line2 = 1.0 - smoothstep(0.009, 0.018, abs(uv.x - 0.8));
      float mark = clamp(diamond + (line1 + line2) * 0.55, 0.0, 1.0);
      return mix(base, vec3(0.92, 1.0, 0.58), mark);
    }

    void main() {
      vec3 previousColor = flagPattern(uCurrent, vUv);
      vec3 nextColor = flagPattern(uNext, vUv);
      float reveal = smoothstep(0.17, 0.21, vBurn);
      vec3 color = mix(previousColor, nextColor, reveal);

      float charred = smoothstep(-0.08, 0.06, vBurn)
        * (1.0 - smoothstep(0.06, 0.17, vBurn));
      float ember = smoothstep(-0.07, 0.14, vBurn)
        * (1.0 - smoothstep(0.14, 0.37, vBurn));
      float hotCore = smoothstep(0.1, 0.18, vBurn)
        * (1.0 - smoothstep(0.18, 0.235, vBurn));
      float grain = texture2D(uNoise, vUv * vec2(2.4, 1.8) + vec2(uTime * 0.01, 0.0)).r;
      float ash = charred * smoothstep(0.52, 0.8, grain);

      color *= 1.0 - charred * 0.72 - ash * 0.2;
      color *= vWaveLight + (grain - 0.5) * 0.09;
      color += vec3(1.0, 0.16, 0.01) * ember * 1.25;
      color += vec3(1.0, 0.78, 0.28) * hotCore * 2.1;

      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `;

  const particleVertexSource = `
    precision mediump float;

    attribute vec4 aParticle;
    attribute vec2 aDrift;

    uniform float uAspect;
    uniform float uMotion;
    uniform float uPixelRatio;
    uniform float uProgress;
    uniform float uTime;

    varying float vAlpha;
    varying float vHeat;

    vec3 rotateFlag(vec3 point) {
      float angleX = -0.383972;
      float angleZ = -0.139626;
      float cosX = cos(angleX);
      float sinX = sin(angleX);
      float cosZ = cos(angleZ);
      float sinZ = sin(angleZ);
      vec3 rotatedX = vec3(
        point.x,
        point.y * cosX - point.z * sinX,
        point.y * sinX + point.z * cosX
      );
      return vec3(
        rotatedX.x * cosZ - rotatedX.y * sinZ,
        rotatedX.x * sinZ + rotatedX.y * cosZ,
        rotatedX.z
      );
    }

    void main() {
      vec2 uv = aParticle.xy;
      float age = (uProgress - aParticle.z) * 3.8;
      float active = step(0.0, age) * (1.0 - smoothstep(0.64, 1.0, age));
      float wave1 = sin(uv.x * -8.0 + uv.y * -8.0 + uTime * 1.25);
      float wave2 = sin(uv.x * 5.0 + uv.y * 2.0 + uTime * 0.9);
      float wave = (wave1 * 0.6 + wave2 * 1.2) * 0.07 * uMotion;

      vec3 position = vec3(
        (uv.x - 0.5) * 3.3 + aDrift.x * age * 0.24,
        (uv.y - 0.5) * 2.2 + (0.2 + abs(aDrift.y) * 0.2) * age,
        wave + age * 0.32
      );
      position = rotateFlag(position);
      position.z -= 3.35;

      float perspective = 2.35;
      gl_Position = vec4(
        position.x * perspective / uAspect,
        position.y * perspective,
        0.0,
        -position.z
      );
      gl_PointSize = max(1.0, aParticle.w * uPixelRatio * active);

      vAlpha = active * (1.0 - smoothstep(0.34, 0.95, age));
      vHeat = 0.5 + sin(aParticle.z * 91.0 + uTime * 7.0) * 0.5;
    }
  `;

  const particleFragmentSource = `
    precision mediump float;

    varying float vAlpha;
    varying float vHeat;

    void main() {
      vec2 point = gl_PointCoord * 2.0 - 1.0;
      float alpha = (1.0 - smoothstep(0.25, 1.0, length(point))) * vAlpha;
      if (alpha < 0.01) discard;
      vec3 color = mix(vec3(1.0, 0.2, 0.01), vec3(1.0, 0.9, 0.45), vHeat);
      gl_FragColor = vec4(color, alpha);
    }
  `;

  try {
    const planeProgram = createProgram(gl, planeVertexSource, planeFragmentSource);
    const particleProgram = createProgram(gl, particleVertexSource, particleFragmentSource);
    const plane = createPlaneGeometry(gl, 48, 32);
    const noise = createNoiseTexture(gl);
    const particles = createParticles(gl, noise);

    const planeLocations = {
      position: gl.getAttribLocation(planeProgram, 'aPosition'),
      uv: gl.getAttribLocation(planeProgram, 'aUv'),
      aspect: gl.getUniformLocation(planeProgram, 'uAspect'),
      current: gl.getUniformLocation(planeProgram, 'uCurrent'),
      motion: gl.getUniformLocation(planeProgram, 'uMotion'),
      next: gl.getUniformLocation(planeProgram, 'uNext'),
      noise: gl.getUniformLocation(planeProgram, 'uNoise'),
      progress: gl.getUniformLocation(planeProgram, 'uProgress'),
      time: gl.getUniformLocation(planeProgram, 'uTime'),
    };
    const particleLocations = {
      data: gl.getAttribLocation(particleProgram, 'aParticle'),
      drift: gl.getAttribLocation(particleProgram, 'aDrift'),
      aspect: gl.getUniformLocation(particleProgram, 'uAspect'),
      motion: gl.getUniformLocation(particleProgram, 'uMotion'),
      pixelRatio: gl.getUniformLocation(particleProgram, 'uPixelRatio'),
      progress: gl.getUniformLocation(particleProgram, 'uProgress'),
      time: gl.getUniformLocation(particleProgram, 'uTime'),
    };

    let current = 0;
    let next = 1;
    let transitionStart = 0;
    let isTransitioning = false;
    let reducedMotion = motionQuery.matches;
    let introPlayed = false;
    let introTimer = null;
    let animationFrame = null;
    let pixelRatio = 1;

    function resize() {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      if (reducedMotion) drawScene(0, 0);
    }

    function drawScene(time, progress) {
      const aspect = canvas.width / canvas.height;
      const motion = reducedMotion ? 0 : 1;

      gl.clearColor(0.018, 0.014, 0.011, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, noise.texture);

      gl.useProgram(planeProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, plane.vertexBuffer);
      gl.enableVertexAttribArray(planeLocations.position);
      gl.vertexAttribPointer(planeLocations.position, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(planeLocations.uv);
      gl.vertexAttribPointer(planeLocations.uv, 2, gl.FLOAT, false, 16, 8);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, plane.indexBuffer);
      gl.uniform1f(planeLocations.aspect, aspect);
      gl.uniform1f(planeLocations.current, current);
      gl.uniform1f(planeLocations.motion, motion);
      gl.uniform1f(planeLocations.next, next);
      gl.uniform1i(planeLocations.noise, 0);
      gl.uniform1f(planeLocations.progress, progress);
      gl.uniform1f(planeLocations.time, time);
      gl.drawElements(gl.TRIANGLES, plane.indexCount, gl.UNSIGNED_SHORT, 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(particleProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, particles.buffer);
      gl.enableVertexAttribArray(particleLocations.data);
      gl.vertexAttribPointer(particleLocations.data, 4, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(particleLocations.drift);
      gl.vertexAttribPointer(particleLocations.drift, 2, gl.FLOAT, false, 24, 16);
      gl.uniform1f(particleLocations.aspect, aspect);
      gl.uniform1f(particleLocations.motion, motion);
      gl.uniform1f(particleLocations.pixelRatio, pixelRatio);
      gl.uniform1f(particleLocations.progress, progress);
      gl.uniform1f(particleLocations.time, time);
      gl.drawArrays(gl.POINTS, 0, particles.count);
      gl.disable(gl.BLEND);
    }

    function finishTransition() {
      current = next;
      next = (current + 1) % flags.length;
      isTransitioning = false;
      button.disabled = false;
      frame.setAttribute('aria-busy', 'false');
      caption.textContent = flags[current].name;
    }

    function render(now) {
      let progress = 0;

      if (isTransitioning) {
        const elapsedRatio = Math.min(1, (now - transitionStart) / TRANSITION_DURATION);
        progress = 1 - (1 - elapsedRatio) * (1 - elapsedRatio);

        if (elapsedRatio >= 1) {
          finishTransition();
          progress = 0;
        }
      }

      drawScene(now * 0.001, progress);
      animationFrame = requestAnimationFrame(render);
    }

    function startLoop() {
      if (animationFrame === null) animationFrame = requestAnimationFrame(render);
    }

    function stopLoop() {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    function clearIntroTimer() {
      if (introTimer !== null) clearTimeout(introTimer);
      introTimer = null;
    }

    function startTransition() {
      if (isTransitioning) return;
      clearIntroTimer();
      introPlayed = true;

      if (reducedMotion) {
        current = (current + 1) % flags.length;
        next = (current + 1) % flags.length;
        caption.textContent = flags[current].name;
        drawScene(0, 0);
        return;
      }

      next = (current + 1) % flags.length;
      transitionStart = performance.now();
      isTransitioning = true;
      button.disabled = true;
      frame.setAttribute('aria-busy', 'true');
      startLoop();
    }

    function scheduleIntro() {
      if (introPlayed || reducedMotion || introTimer !== null) return;
      introTimer = setTimeout(startTransition, INTRO_DELAY);
    }

    function handleMotionChange(event) {
      reducedMotion = event.matches;

      if (reducedMotion) {
        clearIntroTimer();
        if (isTransitioning) finishTransition();
        stopLoop();
        drawScene(0, 0);
      } else {
        startLoop();
        scheduleIntro();
      }
    }

    button.addEventListener('click', startTransition);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopLoop();
      } else if (!reducedMotion) {
        startLoop();
      }
    });

    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', handleMotionChange);
    } else {
      motionQuery.addListener(handleMotionChange);
    }

    caption.textContent = flags[current].name;
    resize();
    drawScene(0, 0);

    if (!reducedMotion) {
      startLoop();
      scheduleIntro();
    }
  } catch (error) {
    showFallback();
    console.error(error);
  }
}

function createPlaneGeometry(gl, columns, rows) {
  const vertices = [];
  const indices = [];

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      vertices.push((u - 0.5) * 3.3, (v - 0.5) * 2.2, u, v);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const upperLeft = row * (columns + 1) + column;
      const upperRight = upperLeft + 1;
      const lowerLeft = upperLeft + columns + 1;
      const lowerRight = lowerLeft + 1;
      indices.push(upperLeft, lowerLeft, upperRight, upperRight, lowerLeft, lowerRight);
    }
  }

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return { vertexBuffer, indexBuffer, indexCount: indices.length };
}

function createNoiseTexture(gl) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);

  function fract(value) {
    return value - Math.floor(value);
  }

  function lattice(x, y, cells, seed) {
    const wrappedX = ((x % cells) + cells) % cells;
    const wrappedY = ((y % cells) + cells) % cells;
    return fract(Math.sin(wrappedX * 127.1 + wrappedY * 311.7 + seed * 74.7) * 43758.5453);
  }

  function smoothNoise(x, y, scale, seed) {
    const gridX = x / scale;
    const gridY = y / scale;
    const x0 = Math.floor(gridX);
    const y0 = Math.floor(gridY);
    const cells = size / scale;
    const localX = gridX - x0;
    const localY = gridY - y0;
    const smoothX = localX * localX * (3 - 2 * localX);
    const smoothY = localY * localY * (3 - 2 * localY);
    const top = lattice(x0, y0, cells, seed)
      + (lattice(x0 + 1, y0, cells, seed) - lattice(x0, y0, cells, seed)) * smoothX;
    const bottom = lattice(x0, y0 + 1, cells, seed)
      + (lattice(x0 + 1, y0 + 1, cells, seed) - lattice(x0, y0 + 1, cells, seed)) * smoothX;
    return top + (bottom - top) * smoothY;
  }

  function fractalNoise(x, y, seed) {
    return smoothNoise(x, y, 64, seed) * 0.5
      + smoothNoise(x, y, 32, seed + 1) * 0.25
      + smoothNoise(x, y, 16, seed + 2) * 0.16
      + smoothNoise(x, y, 8, seed + 3) * 0.09;
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      data[index] = Math.round(fractalNoise(x, y, 3) * 255);
      data[index + 1] = Math.round(fractalNoise(x, y, 17) * 255);
      data[index + 2] = Math.round(Math.pow(fractalNoise(x, y, 31), 1.08) * 255);
      data[index + 3] = 255;
    }
  }

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);

  return { texture, data, size };
}

function createParticles(gl, noise) {
  const count = 96;
  const values = [];
  let seed = 0x4f1bbcdc;

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  for (let index = 0; index < count; index += 1) {
    const u = 0.04 + random() * 0.92;
    const v = 0.04 + random() * 0.92;
    const pixelX = Math.min(noise.size - 1, Math.floor(u * noise.size));
    const pixelY = Math.min(noise.size - 1, Math.floor(v * noise.size));
    const noiseIndex = (pixelY * noise.size + pixelX) * 4;
    const slide = noise.data[noiseIndex + 2] / 255;
    const birth = Math.min(0.82, (slide * 0.6 + 0.15 + random() * 0.1) / 1.38);
    const size = 2.2 + random() * 4.2;
    const driftX = random() * 2 - 1;
    const driftY = random() * 2 - 1;
    values.push(u, v, birth, size, driftX, driftY);
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);

  return { buffer, count };
}

startDemo();
