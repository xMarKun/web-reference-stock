const playfield = document.querySelector(".js-playfield");
const player = document.querySelector(".js-player");
const friend = document.querySelector(".js-cursor-friend");
const controls = [...document.querySelectorAll("[data-control]")];

const keyMap = new Map([
  ["KeyA", "left"],
  ["ArrowLeft", "left"],
  ["KeyD", "right"],
  ["ArrowRight", "right"],
  ["KeyW", "up"],
  ["ArrowUp", "up"],
  ["KeyS", "down"],
  ["ArrowDown", "down"],
]);

const keys = new Set();
const state = {
  x: 120,
  lane: 20,
  jump: 0,
  jumpVelocity: 0,
  face: 1,
  targetX: 120,
  targetLane: 20,
  friendX: 80,
  friendY: 70,
  friendTargetX: 80,
  friendTargetY: 70,
  lastTime: performance.now(),
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getBounds() {
  const rect = playfield.getBoundingClientRect();
  const footerFloor = parseFloat(getComputedStyle(playfield).getPropertyValue("--floor")) || 64;

  return {
    rect,
    floor: footerFloor,
    maxX: Math.max(0, rect.width - 58),
    maxLane: Math.max(0, Math.min(94, rect.height - footerFloor - 110)),
    maxFriendX: Math.max(0, rect.width - 36),
    maxFriendY: Math.max(0, rect.height - footerFloor - 42),
  };
}

function movementKeyIsPressed() {
  return ["left", "right", "up", "down"].some((key) => keys.has(key));
}

function jump() {
  if (state.jump <= 0.5) {
    state.jumpVelocity = 720;
  }
}

function setPointerTarget(event) {
  const bounds = getBounds();
  const pointerX = event.clientX - bounds.rect.left;
  const pointerY = event.clientY - bounds.rect.top;

  state.targetX = clamp(pointerX - 25, 0, bounds.maxX);
  state.targetLane = clamp(bounds.rect.height - bounds.floor - pointerY - 20, 0, bounds.maxLane);
  state.friendTargetX = clamp(pointerX + 12, 0, bounds.maxFriendX);
  state.friendTargetY = clamp(pointerY - 30, 0, bounds.maxFriendY);
}

function setControl(control, active) {
  const button = controls.find((item) => item.dataset.control === control);

  if (button) {
    button.classList.toggle("is-active", active);
  }
}

function pressControl(control) {
  if (control === "jump") {
    jump();
    setControl(control, true);
    return;
  }

  keys.add(control);
  setControl(control, true);
}

function releaseControl(control) {
  if (control === "jump") {
    setControl(control, false);
    return;
  }

  keys.delete(control);
  setControl(control, false);
}

function handleKeydown(event) {
  const control = keyMap.get(event.code);

  if (control) {
    event.preventDefault();
    pressControl(control);
  }

  if (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.code === "Space") {
    event.preventDefault();
    pressControl("jump");
  }
}

function handleKeyup(event) {
  const control = keyMap.get(event.code);

  if (control) {
    releaseControl(control);
  }

  if (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.code === "Space") {
    releaseControl("jump");
  }
}

function update(dt) {
  const bounds = getBounds();
  const speed = 260;
  const laneSpeed = 185;
  let vx = 0;
  let vlane = 0;

  state.targetX = clamp(state.targetX, 0, bounds.maxX);
  state.targetLane = clamp(state.targetLane, 0, bounds.maxLane);
  state.friendTargetX = clamp(state.friendTargetX, 0, bounds.maxFriendX);
  state.friendTargetY = clamp(state.friendTargetY, 0, bounds.maxFriendY);

  if (keys.has("left")) vx -= speed;
  if (keys.has("right")) vx += speed;
  if (keys.has("up")) vlane += laneSpeed;
  if (keys.has("down")) vlane -= laneSpeed;

  if (movementKeyIsPressed()) {
    state.x = clamp(state.x + vx * dt, 0, bounds.maxX);
    state.lane = clamp(state.lane + vlane * dt, 0, bounds.maxLane);
  } else {
    const followStrength = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.36 : 0.14;
    state.x += (state.targetX - state.x) * followStrength;
    state.lane += (state.targetLane - state.lane) * followStrength;
  }

  state.x = clamp(state.x, 0, bounds.maxX);
  state.lane = clamp(state.lane, 0, bounds.maxLane);

  if (Math.abs(vx) > 1) {
    state.face = vx < 0 ? -1 : 1;
  } else if (Math.abs(state.targetX - state.x) > 3) {
    state.face = state.targetX < state.x ? -1 : 1;
  }

  state.jump = Math.max(0, state.jump + state.jumpVelocity * dt);
  state.jumpVelocity -= 1900 * dt;

  if (state.jump <= 0) {
    state.jump = 0;
    state.jumpVelocity = 0;
  }

  state.friendX += (state.friendTargetX - state.friendX) * 0.18;
  state.friendY += (state.friendTargetY - state.friendY) * 0.18;
  state.friendX = clamp(state.friendX, 0, bounds.maxFriendX);
  state.friendY = clamp(state.friendY, 0, bounds.maxFriendY);

  player.style.setProperty("--x", `${state.x.toFixed(1)}px`);
  player.style.setProperty("--lane", `${state.lane.toFixed(1)}px`);
  player.style.setProperty("--jump", `${state.jump.toFixed(1)}px`);
  player.style.setProperty("--jump-value", state.jump.toFixed(1));
  player.style.setProperty("--face", state.face);
  player.classList.toggle("is-running", movementKeyIsPressed() || Math.abs(state.targetX - state.x) > 4);

  friend.style.setProperty("--friend-x", `${state.friendX.toFixed(1)}px`);
  friend.style.setProperty("--friend-y", `${state.friendY.toFixed(1)}px`);
}

function tick(now) {
  const dt = Math.min((now - state.lastTime) / 1000, 0.032);
  state.lastTime = now;
  update(dt);
  requestAnimationFrame(tick);
}

if (playfield && player && friend) {
  playfield.addEventListener("pointermove", (event) => {
    setPointerTarget(event);
    playfield.focus({ preventScroll: true });
  });

  playfield.addEventListener("pointerdown", (event) => {
    setPointerTarget(event);
    playfield.focus({ preventScroll: true });
  });

  playfield.addEventListener("keydown", handleKeydown);
  playfield.addEventListener("keyup", handleKeyup);
  playfield.addEventListener("blur", () => {
    keys.clear();
    controls.forEach((button) => button.classList.remove("is-active"));
  });

  controls.forEach((button) => {
    const control = button.dataset.control;

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      playfield.focus({ preventScroll: true });
      pressControl(control);
      button.setPointerCapture(event.pointerId);
    });

    button.addEventListener("pointerup", () => releaseControl(control));
    button.addEventListener("pointercancel", () => releaseControl(control));
    button.addEventListener("lostpointercapture", () => releaseControl(control));
  });

  requestAnimationFrame(tick);
}
