(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const radar = document.getElementById("radar");
  const rtx = radar.getContext("2d");
  const menu = document.getElementById("menu");
  const playBtn = document.getElementById("playBtn");
  const trainingBtn = document.getElementById("trainingBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const blueScoreEl = document.getElementById("blueScore");
  const redScoreEl = document.getElementById("redScore");
  const timerEl = document.getElementById("timer");
  const feedEl = document.getElementById("feed");
  const healthEl = document.getElementById("health");
  const armorEl = document.getElementById("armor");
  const boostEl = document.getElementById("boost");

  const TAU = Math.PI * 2;
  const ARENA = { w: 3200, h: 2100, goalW: 520, goalD: 120 };
  const keys = new Set();
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  let dpr = 1;
  let paused = true;
  let training = false;
  let started = false;
  let last = 0;
  let shake = 0;
  let camera = { x: 0, y: 0, zoom: 1 };
  let messageTimer = 0;
  let audioReady = false;
  let audio;

  const state = {
    time: 180,
    blue: 0,
    red: 0,
    stormRadius: 1700,
    stormNext: 1700,
    phase: "kickoff",
    over: false,
  };

  const player = makeCar("player", "blue", 0, 520, "#37c0ff");
  const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 54, spin: 0, air: 0 };
  const bots = [
    makeCar("Raze", "red", 980, -310, "#ff4e6c"),
    makeCar("Viper", "red", 980, 310, "#ff8a4d"),
    makeCar("Orbit", "blue", -920, -330, "#42d7a7"),
    makeCar("Nova", "red", 380, -660, "#f7c948"),
  ];
  const pickups = [];
  const particles = [];
  const skidMarks = [];

  function makeCar(name, team, x, y, color) {
    return {
      name,
      team,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: team === "blue" ? 0 : Math.PI,
      r: 32,
      length: 82,
      width: 46,
      color,
      boost: team === "blue" ? 74 : 60,
      health: 100,
      armor: team === "blue" ? 45 : 30,
      cooldown: 0,
      jump: 0,
      aiMood: Math.random(),
      eliminated: false,
      respawn: 0,
    };
  }

  function resetMatch(isTraining = false) {
    training = isTraining;
    Object.assign(state, {
      time: training ? 5999 : 180,
      blue: 0,
      red: 0,
      stormRadius: 1700,
      stormNext: 1700,
      phase: "kickoff",
      over: false,
    });
    resetKickoff();
    message(training ? "Training arena online" : "Match start");
    updateHud();
  }

  function resetKickoff(scoredBy) {
    ball.x = 0;
    ball.y = 0;
    ball.vx = scoredBy === "blue" ? -260 : scoredBy === "red" ? 260 : 0;
    ball.vy = 0;
    ball.air = 0;
    ball.spin = 0;

    revive(player, -880, 0, 0);
    revive(bots[0], 900, -330, Math.PI);
    revive(bots[1], 900, 330, Math.PI);
    revive(bots[2], -940, -420, 0);
    revive(bots[3], 360, 660, Math.PI * 1.3);

    pickups.length = 0;
    for (let i = 0; i < 18; i += 1) {
      const kind = i % 5 === 0 ? "armor" : i % 3 === 0 ? "repair" : "boost";
      pickups.push({
        kind,
        x: rand(-ARENA.w / 2 + 260, ARENA.w / 2 - 260),
        y: rand(-ARENA.h / 2 + 220, ARENA.h / 2 - 220),
        r: kind === "boost" ? 24 : 28,
        cooldown: 0,
        pulse: Math.random() * TAU,
      });
    }
  }

  function revive(car, x, y, angle) {
    car.x = x;
    car.y = y;
    car.vx = 0;
    car.vy = 0;
    car.angle = angle;
    car.health = 100;
    car.armor = car.team === "blue" ? 45 : 30;
    car.boost = Math.max(car.boost, 62);
    car.jump = 0;
    car.cooldown = 0;
    car.eliminated = false;
    car.respawn = 0;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function begin() {
    initAudio();
    paused = false;
    menu.classList.add("hidden");
    last = performance.now();
    if (!started) {
      started = true;
      requestAnimationFrame(loop);
    }
  }

  function loop(t) {
    const dt = Math.min((t - last) / 1000, 0.033);
    last = t;
    if (!paused) update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (state.over) return;
    state.time -= training ? 0 : dt;
    if (state.time <= 0) endMatch();

    const targetStorm = training ? 1700 : lerp(1700, 640, 1 - state.time / 180);
    state.stormNext = targetStorm;
    state.stormRadius = lerp(state.stormRadius, state.stormNext, 0.18 * dt);

    updateCar(player, dt, getPlayerInput());
    bots.forEach((bot) => updateCar(bot, dt, getBotInput(bot)));
    resolveCarContacts(dt);
    updateBall(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateCamera(dt);
    updateHud();
  }

  function getPlayerInput() {
    const forward = keys.has("w") || keys.has("arrowup") ? 1 : keys.has("s") || keys.has("arrowdown") ? -0.72 : 0;
    const turn = keys.has("a") || keys.has("arrowleft") ? -1 : keys.has("d") || keys.has("arrowright") ? 1 : 0;
    const drift = keys.has("q") || keys.has("e");
    const boost = keys.has("shift");
    const jump = keys.has(" ");
    return { forward, turn, drift, boost, jump };
  }

  function getBotInput(bot) {
    if (bot.eliminated) return { forward: 0, turn: 0, drift: false, boost: false, jump: false };
    const ownGoal = bot.team === "red" ? { x: ARENA.w / 2, y: 0 } : { x: -ARENA.w / 2, y: 0 };
    const attackGoal = bot.team === "red" ? { x: -ARENA.w / 2, y: 0 } : { x: ARENA.w / 2, y: 0 };
    const lowHealth = bot.health < 42;
    let target = ball;

    if (lowHealth) {
      const item = pickups.filter((p) => p.cooldown <= 0 && p.kind !== "boost").sort((a, b) => dist(bot, a) - dist(bot, b))[0];
      if (item) target = item;
    } else if (bot.aiMood > 0.68 && dist(bot, player) < 620) {
      target = player;
    } else if (dist(ball, ownGoal) < 700 && bot.team === "red") {
      target = { x: ball.x + 220, y: ball.y };
    } else {
      target = { x: ball.x - Math.sign(attackGoal.x) * 120, y: ball.y * 0.82 };
    }

    const desired = angleTo(bot, target);
    const turnError = wrapAngle(desired - bot.angle);
    const speed = Math.hypot(bot.vx, bot.vy);
    const aimGood = Math.abs(turnError) < 0.52;
    return {
      forward: aimGood ? 1 : 0.58,
      turn: clamp(turnError * 2.1, -1, 1),
      drift: Math.abs(turnError) > 0.9 && speed > 360,
      boost: aimGood && bot.boost > 12 && (dist(bot, target) > 430 || target === player),
      jump: dist(bot, ball) < 105 && Math.random() < 0.015,
    };
  }

  function updateCar(car, dt, input) {
    if (car.eliminated) {
      car.respawn -= dt;
      if (car.respawn <= 0) revive(car, car.team === "blue" ? -980 : 980, rand(-360, 360), car.team === "blue" ? 0 : Math.PI);
      return;
    }

    car.cooldown = Math.max(0, car.cooldown - dt);
    const speed = Math.hypot(car.vx, car.vy);
    const traction = input.drift ? 0.8 : 2.75;
    const turnPower = (input.drift ? 3.4 : 2.35) * (0.32 + clamp(speed / 680, 0, 1));
    car.angle += input.turn * turnPower * dt;

    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const sx = Math.cos(car.angle + Math.PI / 2);
    const sy = Math.sin(car.angle + Math.PI / 2);
    const forwardSpeed = car.vx * fx + car.vy * fy;
    const sideSpeed = car.vx * sx + car.vy * sy;
    const accel = input.forward > 0 ? 760 : 520;
    car.vx += fx * input.forward * accel * dt;
    car.vy += fy * input.forward * accel * dt;
    car.vx -= sx * sideSpeed * traction * dt;
    car.vy -= sy * sideSpeed * traction * dt;

    if (input.boost && car.boost > 0 && input.forward >= 0) {
      car.vx += fx * 1160 * dt;
      car.vy += fy * 1160 * dt;
      car.boost = Math.max(0, car.boost - 34 * dt);
      emitTrail(car, "#39b8ff", 4);
      shake = Math.max(shake, 2.4);
    } else {
      car.boost = Math.min(100, car.boost + 6 * dt);
    }

    if (input.jump && car.jump <= 0 && car.cooldown <= 0) {
      car.jump = 0.38;
      car.cooldown = 0.75;
      car.vx += fx * 130;
      car.vy += fy * 130;
      burst(car.x, car.y, "#eef5ff", 12, 210);
      tone(220, 0.04, "triangle");
    }
    car.jump = Math.max(0, car.jump - dt);

    const drag = input.drift ? 0.987 : 0.976;
    car.vx *= Math.pow(drag, dt * 60);
    car.vy *= Math.pow(drag, dt * 60);

    const max = input.boost ? 1120 : 850;
    const nowSpeed = Math.hypot(car.vx, car.vy);
    if (nowSpeed > max) {
      car.vx = (car.vx / nowSpeed) * max;
      car.vy = (car.vy / nowSpeed) * max;
    }

    car.x += car.vx * dt;
    car.y += car.vy * dt;
    clampToArena(car);
    applyStorm(car, dt);

    if (Math.abs(sideSpeed) > 210 && speed > 330 && skidMarks.length < 80) {
      skidMarks.push({ x: car.x - fx * 18, y: car.y - fy * 18, a: car.angle, life: 0.72 });
    }
  }

  function clampToArena(car) {
    const hw = ARENA.w / 2 - 54;
    const hh = ARENA.h / 2 - 54;
    if (car.x < -hw || car.x > hw) {
      car.x = clamp(car.x, -hw, hw);
      car.vx *= -0.38;
      damage(car, 4);
    }
    if (car.y < -hh || car.y > hh) {
      car.y = clamp(car.y, -hh, hh);
      car.vy *= -0.38;
      damage(car, 4);
    }
  }

  function applyStorm(car, dt) {
    if (training) return;
    const outside = Math.hypot(car.x, car.y) - state.stormRadius;
    if (outside > 0) {
      damage(car, (8 + outside / 120) * dt);
      if (car === player && messageTimer <= 0) message("Danger zone eating your shields");
    }
  }

  function damage(car, amount) {
    if (amount <= 0 || car.eliminated) return;
    const armorHit = Math.min(car.armor, amount * 0.72);
    car.armor -= armorHit;
    car.health -= amount - armorHit * 0.42;
    if (car.health <= 0) {
      car.eliminated = true;
      car.respawn = 3.2;
      car.health = 0;
      burst(car.x, car.y, car.color, 34, 520);
      tone(74, 0.13, "sawtooth");
      shake = Math.max(shake, 12);
      if (car === player) message("Eliminated - respawning");
      else message(`${car.name} wrecked`);
    }
  }

  function resolveCarContacts(dt) {
    const cars = [player, ...bots].filter((c) => !c.eliminated);
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const minD = a.r + b.r;
        if (d < minD) {
          const nx = dx / d;
          const ny = dy / d;
          const overlap = minD - d;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          const impulse = Math.max(80, -rel * 0.62);
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
          b.vx += nx * impulse;
          b.vy += ny * impulse;
          if (Math.abs(rel) > 380) {
            damage(a, Math.abs(rel) / 110);
            damage(b, Math.abs(rel) / 110);
            burst((a.x + b.x) / 2, (a.y + b.y) / 2, "#f7c948", 16, 300);
            tone(110, 0.05, "square");
            shake = Math.max(shake, 7);
          }
        }
      }
    }

    cars.forEach((car) => collideCarBall(car, dt));
  }

  function collideCarBall(car) {
    const dx = ball.x - car.x;
    const dy = ball.y - car.y;
    const d = Math.hypot(dx, dy) || 1;
    const minD = ball.r + car.r + car.jump * 28;
    if (d > minD) return;
    const nx = dx / d;
    const ny = dy / d;
    const overlap = minD - d;
    ball.x += nx * overlap;
    ball.y += ny * overlap;
    const carSpeed = Math.hypot(car.vx, car.vy);
    const forwardHit = Math.max(0, Math.cos(angleTo(car, ball) - car.angle));
    const impulse = 250 + carSpeed * (0.75 + forwardHit * 0.65) + car.jump * 520;
    ball.vx += nx * impulse + car.vx * 0.42;
    ball.vy += ny * impulse + car.vy * 0.42;
    ball.spin += ((car.vx * ny - car.vy * nx) / 380) + rand(-0.5, 0.5);
    ball.air = Math.max(ball.air, car.jump * 0.7);
    burst(ball.x - nx * ball.r, ball.y - ny * ball.r, car.color, 18, 320);
    tone(164 + clamp(carSpeed / 5, 0, 160), 0.05, "triangle");
    shake = Math.max(shake, 5);
  }

  function updateBall(dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx += ball.vy * ball.spin * 0.018 * dt;
    ball.vy -= ball.vx * ball.spin * 0.018 * dt;
    ball.vx *= Math.pow(0.988, dt * 60);
    ball.vy *= Math.pow(0.988, dt * 60);
    ball.spin *= Math.pow(0.982, dt * 60);
    ball.air = Math.max(0, ball.air - dt * 0.7);

    const hw = ARENA.w / 2;
    const hh = ARENA.h / 2;
    const insideGoalMouth = Math.abs(ball.y) < ARENA.goalW / 2;
    if (ball.x - ball.r < -hw && insideGoalMouth) score("red");
    if (ball.x + ball.r > hw && insideGoalMouth) score("blue");

    if (Math.abs(ball.x) + ball.r > hw && !insideGoalMouth) {
      ball.x = Math.sign(ball.x) * (hw - ball.r);
      ball.vx *= -0.72;
      ball.spin *= -0.6;
      burst(ball.x, ball.y, "#eef5ff", 10, 180);
    }
    if (Math.abs(ball.y) + ball.r > hh) {
      ball.y = Math.sign(ball.y) * (hh - ball.r);
      ball.vy *= -0.72;
      ball.spin *= -0.6;
      burst(ball.x, ball.y, "#eef5ff", 10, 180);
    }
  }

  function score(team) {
    state[team] += 1;
    blueScoreEl.textContent = state.blue;
    redScoreEl.textContent = state.red;
    message(`${team === "blue" ? "Blue" : "Red"} goal`);
    burst(ball.x, ball.y, team === "blue" ? "#39b8ff" : "#ff4e6c", 80, 760);
    tone(team === "blue" ? 330 : 247, 0.22, "sawtooth");
    shake = 18;
    resetKickoff(team);
  }

  function updatePickups(dt) {
    pickups.forEach((p) => {
      p.pulse += dt * 3;
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (p.cooldown > 0) return;
      [player, ...bots].forEach((car) => {
        if (car.eliminated || dist(car, p) > car.r + p.r) return;
        if (p.kind === "boost") car.boost = Math.min(100, car.boost + 42);
        if (p.kind === "armor") car.armor = Math.min(100, car.armor + 42);
        if (p.kind === "repair") car.health = Math.min(100, car.health + 34);
        p.cooldown = 7.5;
        burst(p.x, p.y, pickupColor(p.kind), 20, 260);
        tone(p.kind === "repair" ? 440 : 294, 0.05, "sine");
      });
    });
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.94, dt * 60);
      p.vy *= Math.pow(0.94, dt * 60);
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = skidMarks.length - 1; i >= 0; i -= 1) {
      skidMarks[i].life -= dt;
      if (skidMarks[i].life <= 0) skidMarks.splice(i, 1);
    }
    messageTimer = Math.max(0, messageTimer - dt);
    if (messageTimer <= 0) feedEl.textContent = training ? "Training mode" : "Score goals and stay inside the zone";
    shake = Math.max(0, shake - dt * 20);
  }

  function updateCamera(dt) {
    const lead = { x: player.x + player.vx * 0.25, y: player.y + player.vy * 0.25 };
    const ballBlend = clamp(1 - dist(player, ball) / 1500, 0.08, 0.36);
    const tx = lerp(lead.x, ball.x, ballBlend);
    const ty = lerp(lead.y, ball.y, ballBlend);
    camera.x = lerp(camera.x, tx, 1 - Math.pow(0.001, dt));
    camera.y = lerp(camera.y, ty, 1 - Math.pow(0.001, dt));
    camera.zoom = lerp(camera.zoom, clamp(innerWidth / 1450, 0.58, 0.95), 0.06);
  }

  function endMatch() {
    state.over = true;
    paused = true;
    const result = state.blue === state.red ? "Draw" : state.blue > state.red ? "Blue wins" : "Red wins";
    message(result);
    menu.classList.remove("hidden");
    menu.querySelector(".summary").textContent = `${result}. Final score ${state.blue}-${state.red}. Jump back in for another match.`;
  }

  function render() {
    ctx.save();
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    drawPerspectiveScene();
    ctx.restore();
    drawVignette();
    drawRadar();
  }

  function viewBasis() {
    const fx = Math.cos(player.angle);
    const fy = Math.sin(player.angle);
    return {
      fx,
      fy,
      rx: -fy,
      ry: fx,
      x: player.x - fx * 620,
      y: player.y - fy * 620,
      z: 260 + player.jump * 70,
      pitch: 0.24,
      focus: innerHeight * 0.55,
    };
  }

  function project3D(x, y, z, basis = viewBasis()) {
    const dx = x - basis.x;
    const dy = y - basis.y;
    const right = dx * basis.rx + dy * basis.ry;
    const forward = dx * basis.fx + dy * basis.fy;
    const up = z - basis.z;
    const cp = Math.cos(basis.pitch);
    const sp = Math.sin(basis.pitch);
    const camY = up * cp - forward * sp;
    const depth = up * sp + forward * cp;
    if (depth < 40) return null;
    const scale = basis.focus / depth;
    return {
      x: innerWidth / 2 + right * scale,
      y: innerHeight * 0.43 - camY * scale,
      depth,
      scale,
    };
  }

  function drawPerspectiveScene() {
    const basis = viewBasis();
    const sky = ctx.createLinearGradient(0, 0, 0, innerHeight);
    sky.addColorStop(0, "#07101a");
    sky.addColorStop(0.48, "#102427");
    sky.addColorStop(1, "#071016");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    const sx = shake ? rand(-shake, shake) : 0;
    const sy = shake ? rand(-shake, shake) : 0;
    ctx.translate(sx, sy);

    drawArena3D(basis);
    const objects = [
      ...pickups.filter((p) => p.cooldown <= 0).map((p) => ({ type: "pickup", item: p, depth: objectDepth(p.x, p.y, 0, basis) })),
      ...particles.map((p) => ({ type: "particle", item: p, depth: objectDepth(p.x, p.y, 18, basis) })),
      ...[player, ...bots].filter((c) => !c.eliminated).map((c) => ({ type: "car", item: c, depth: objectDepth(c.x, c.y, 35, basis) })),
      { type: "ball", item: ball, depth: objectDepth(ball.x, ball.y, 80 + ball.air * 160, basis) },
    ].sort((a, b) => b.depth - a.depth);

    objects.forEach((obj) => {
      if (obj.type === "pickup") drawPickup3D(obj.item, basis);
      if (obj.type === "particle") drawParticle3D(obj.item, basis);
      if (obj.type === "car") drawCar3D(obj.item, basis);
      if (obj.type === "ball") drawBall3D(basis);
    });
  }

  function objectDepth(x, y, z, basis) {
    const dx = x - basis.x;
    const dy = y - basis.y;
    const forward = dx * basis.fx + dy * basis.fy;
    const up = z - basis.z;
    return up * Math.sin(basis.pitch) + forward * Math.cos(basis.pitch);
  }

  function drawArena3D(basis) {
    const hw = ARENA.w / 2;
    const hh = ARENA.h / 2;
    drawGroundQuad(-hw, -hh, hw, hh, basis);

    ctx.lineWidth = 1.5;
    for (let x = -hw; x <= hw; x += 160) drawWorldLine(x, -hh, 0, x, hh, 0, "rgba(255,255,255,0.13)", basis);
    for (let y = -hh; y <= hh; y += 160) drawWorldLine(-hw, y, 0, hw, y, 0, "rgba(255,255,255,0.13)", basis);
    drawWorldLine(0, -hh, 2, 0, hh, 2, "rgba(238,245,255,0.42)", basis, 5);

    for (let a = 0; a < TAU; a += TAU / 80) {
      const b = a + TAU / 80;
      drawWorldLine(Math.cos(a) * 220, Math.sin(a) * 220, 4, Math.cos(b) * 220, Math.sin(b) * 220, "rgba(238,245,255,0.34)", basis, 3);
      drawWorldLine(Math.cos(a) * state.stormRadius, Math.sin(a) * state.stormRadius, 8, Math.cos(b) * state.stormRadius, Math.sin(b) * state.stormRadius, "rgba(247,201,72,0.5)", basis, 4);
    }

    drawWall(-hw, -hh, hw, -hh, "#263640", basis);
    drawWall(hw, -hh, hw, hh, "#263640", basis);
    drawWall(hw, hh, -hw, hh, "#263640", basis);
    drawWall(-hw, hh, -hw, -hh, "#263640", basis);
    drawGoal3D(-hw, "#ff4e6c", basis);
    drawGoal3D(hw, "#39b8ff", basis);
  }

  function drawGroundQuad(x1, y1, x2, y2, basis) {
    const pts = [
      project3D(x1, y1, 0, basis),
      project3D(x2, y1, 0, basis),
      project3D(x2, y2, 0, basis),
      project3D(x1, y2, 0, basis),
    ];
    if (pts.some((p) => !p)) return;
    const g = ctx.createLinearGradient(0, pts[0].y, 0, innerHeight);
    g.addColorStop(0, "#16282c");
    g.addColorStop(0.58, "#15261f");
    g.addColorStop(1, "#111720");
    drawPoly(pts, g, "rgba(255,255,255,0.08)");
  }

  function drawWall(x1, y1, x2, y2, color, basis) {
    const h = 210;
    const pts = [
      project3D(x1, y1, 0, basis),
      project3D(x2, y2, 0, basis),
      project3D(x2, y2, h, basis),
      project3D(x1, y1, h, basis),
    ];
    if (pts.some((p) => !p)) return;
    drawPoly(pts, `${color}99`, "rgba(238,245,255,0.22)");
  }

  function drawGoal3D(x, color, basis) {
    const s = Math.sign(x);
    const back = x + s * 130;
    const mouth = x;
    const top = 270;
    const y1 = -ARENA.goalW / 2;
    const y2 = ARENA.goalW / 2;
    drawQuad3D(mouth, y1, 0, back, y1, 0, back, y1, top, mouth, y1, top, `${color}66`, basis);
    drawQuad3D(mouth, y2, 0, back, y2, 0, back, y2, top, mouth, y2, top, `${color}66`, basis);
    drawQuad3D(back, y1, 0, back, y2, 0, back, y2, top, back, y1, top, `${color}3d`, basis);
  }

  function drawCar3D(car, basis) {
    const z = car.jump * 95;
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const rx = -fy;
    const ry = fx;
    const l = car.length;
    const w = car.width;
    const h = 42;
    const point = (front, side, up) => project3D(car.x + fx * front + rx * side, car.y + fy * front + ry * side, z + up, basis);
    const shadow = project3D(car.x, car.y, 2, basis);
    if (shadow) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, 58 * shadow.scale, 28 * shadow.scale, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    const faces = [
      { pts: [point(-l / 2, -w / 2, 0), point(l / 2, -w / 2, 0), point(l / 2, -w / 2, h), point(-l / 2, -w / 2, h)], fill: shade(car.color, -0.22) },
      { pts: [point(l / 2, -w / 2, 0), point(l / 2, w / 2, 0), point(l / 2, w / 2, h), point(l / 2, -w / 2, h)], fill: shade(car.color, 0.16) },
      { pts: [point(-l / 2, w / 2, 0), point(l / 2, w / 2, 0), point(l / 2, w / 2, h), point(-l / 2, w / 2, h)], fill: shade(car.color, -0.06) },
      { pts: [point(-l / 2, -w / 2, h), point(l / 2, -w / 2, h), point(l / 2, w / 2, h), point(-l / 2, w / 2, h)], fill: car.color },
    ];
    faces.forEach((face) => {
      if (!face.pts.some((p) => !p)) drawPoly(face.pts, face.fill, "rgba(5,8,12,0.55)");
    });

    const nose = point(l / 2 + 8, 0, h * 0.58);
    if (nose) {
      ctx.fillStyle = "#eef5ff";
      ctx.beginPath();
      ctx.arc(nose.x, nose.y, Math.max(2, nose.scale * 7), 0, TAU);
      ctx.fill();
    }
  }

  function drawBall3D(basis) {
    const p = project3D(ball.x, ball.y, ball.r + ball.air * 160, basis);
    const shadow = project3D(ball.x, ball.y, 2, basis);
    if (!p) return;
    if (shadow) {
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, ball.r * 0.95 * shadow.scale, ball.r * 0.36 * shadow.scale, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    const r = Math.max(5, ball.r * p.scale);
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.42, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.55, "#dae7f4");
    g.addColorStop(1, "#8198ad");
    ctx.save();
    ctx.shadowColor = "#eef5ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(5,9,14,0.35)";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.62, ball.spin, ball.spin + Math.PI * 1.25);
    ctx.stroke();
    ctx.restore();
  }

  function drawPickup3D(pickup, basis) {
    const p = project3D(pickup.x, pickup.y, 34 + Math.sin(pickup.pulse) * 10, basis);
    if (!p) return;
    const size = Math.max(5, pickup.r * p.scale);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(pickup.pulse);
    ctx.shadowColor = pickupColor(pickup.kind);
    ctx.shadowBlur = 16;
    ctx.fillStyle = pickupColor(pickup.kind);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawParticle3D(particle, basis) {
    const p = project3D(particle.x, particle.y, 22, basis);
    if (!p) return;
    ctx.save();
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, particle.size * p.scale), 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawWorldLine(x1, y1, z1, x2, y2, z2, color, basis, width = 2) {
    const a = project3D(x1, y1, z1, basis);
    const b = project3D(x2, y2, z2, basis);
    if (!a || !b) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function drawQuad3D(x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4, fill, basis) {
    const pts = [
      project3D(x1, y1, z1, basis),
      project3D(x2, y2, z2, basis),
      project3D(x3, y3, z3, basis),
      project3D(x4, y4, z4, basis),
    ];
    if (pts.some((p) => !p)) return;
    drawPoly(pts, fill, "rgba(238,245,255,0.18)");
  }

  function drawPoly(pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function shade(hex, amount) {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = clamp(((n >> 16) & 255) + amount * 255, 0, 255);
    const g = clamp(((n >> 8) & 255) + amount * 255, 0, 255);
    const b = clamp((n & 255) + amount * 255, 0, 255);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawArena() {
    const hw = ARENA.w / 2;
    const hh = ARENA.h / 2;
    ctx.save();
    const grd = ctx.createLinearGradient(-hw, -hh, hw, hh);
    grd.addColorStop(0, "#14252b");
    grd.addColorStop(0.5, "#17241f");
    grd.addColorStop(1, "#241c23");
    ctx.fillStyle = grd;
    ctx.fillRect(-hw, -hh, ARENA.w, ARENA.h);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    for (let x = -hw; x <= hw; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, -hh);
      ctx.lineTo(x, hh);
      ctx.stroke();
    }
    for (let y = -hh; y <= hh; y += 160) {
      ctx.beginPath();
      ctx.moveTo(-hw, y);
      ctx.lineTo(hw, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(238,245,255,0.38)";
    ctx.lineWidth = 8;
    roundRect(-hw, -hh, ARENA.w, ARENA.h, 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(0, hh);
    ctx.strokeStyle = "rgba(238,245,255,0.22)";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 220, 0, TAU);
    ctx.stroke();

    drawGoal(-hw, "#ff4e6c");
    drawGoal(hw, "#39b8ff");

    ctx.beginPath();
    ctx.arc(0, 0, state.stormRadius, 0, TAU);
    ctx.strokeStyle = "rgba(247,201,72,0.58)";
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, state.stormRadius + 34, 0, TAU);
    ctx.strokeStyle = "rgba(247,201,72,0.13)";
    ctx.lineWidth = 40;
    ctx.stroke();
    ctx.restore();
  }

  function drawGoal(x, color) {
    ctx.save();
    ctx.fillStyle = `${color}22`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.fillRect(x - Math.sign(x) * ARENA.goalD, -ARENA.goalW / 2, Math.sign(x) * ARENA.goalD, ARENA.goalW);
    ctx.strokeRect(x - Math.sign(x) * ARENA.goalD, -ARENA.goalW / 2, Math.sign(x) * ARENA.goalD, ARENA.goalW);
    ctx.restore();
  }

  function drawPickups() {
    pickups.forEach((p) => {
      if (p.cooldown > 0) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      const color = pickupColor(p.kind);
      ctx.rotate(p.pulse);
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = color;
      ctx.beginPath();
      const sides = p.kind === "boost" ? 6 : 4;
      for (let i = 0; i < sides; i += 1) {
        const a = (i / sides) * TAU + Math.PI / 4;
        const rr = p.r + Math.sin(p.pulse + i) * 3;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  function drawSkids() {
    skidMarks.forEach((s) => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      ctx.globalAlpha = clamp(s.life, 0, 0.55);
      ctx.fillStyle = "#020507";
      ctx.fillRect(-38, -24, 76, 7);
      ctx.fillRect(-38, 18, 76, 7);
      ctx.restore();
    });
  }

  function drawCars() {
    [player, ...bots].forEach((car) => {
      if (car.eliminated) return;
      ctx.save();
      ctx.translate(car.x, car.y - car.jump * 40);
      ctx.rotate(car.angle);
      ctx.shadowColor = car.color;
      ctx.shadowBlur = car === player ? 18 : 9;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(-car.length / 2 + 6, -car.width / 2 + 28, car.length - 12, car.width);
      ctx.fillStyle = car.color;
      roundRect(-car.length / 2, -car.width / 2, car.length, car.width, 10);
      ctx.fill();
      ctx.fillStyle = "#101923";
      roundRect(-8, -car.width / 2 + 6, 30, car.width - 12, 7);
      ctx.fill();
      ctx.fillStyle = "#eef5ff";
      ctx.fillRect(car.length / 2 - 12, -14, 8, 8);
      ctx.fillRect(car.length / 2 - 12, 6, 8, 8);
      ctx.fillStyle = "#05080c";
      ctx.fillRect(-28, -car.width / 2 - 4, 22, 8);
      ctx.fillRect(-28, car.width / 2 - 4, 22, 8);
      ctx.fillRect(18, -car.width / 2 - 4, 22, 8);
      ctx.fillRect(18, car.width / 2 - 4, 22, 8);
      ctx.restore();

      drawNameplate(car);
    });
  }

  function drawNameplate(car) {
    if (car === player) return;
    ctx.save();
    ctx.translate(car.x, car.y - 72);
    ctx.fillStyle = "rgba(3,7,11,0.64)";
    roundRect(-42, -14, 84, 20, 4);
    ctx.fill();
    ctx.fillStyle = "#dce9f8";
    ctx.font = "700 12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(car.name, 0, 1);
    ctx.restore();
  }

  function drawBallShadow() {
    ctx.save();
    ctx.globalAlpha = 0.36;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(ball.x + 12, ball.y + 22, ball.r * 0.9, ball.r * 0.48, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBall() {
    ctx.save();
    ctx.translate(ball.x, ball.y - ball.air * 80);
    ctx.rotate(ball.spin);
    const g = ctx.createRadialGradient(-20, -24, 8, 0, 0, ball.r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.55, "#d9e5f2");
    g.addColorStop(1, "#8da6bf");
    ctx.fillStyle = g;
    ctx.shadowColor = "#eef5ff";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, ball.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(6,15,24,0.42)";
    ctx.lineWidth = 5;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, ball.r * (0.25 + i * 0.11), i, i + Math.PI * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(innerWidth / 2, innerHeight / 2, innerWidth * 0.25, innerWidth / 2, innerHeight / 2, innerWidth * 0.74);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
  }

  function drawRadar() {
    const w = radar.width;
    const h = radar.height;
    rtx.clearRect(0, 0, w, h);
    rtx.fillStyle = "rgba(8, 13, 20, 0.82)";
    rtx.fillRect(0, 0, w, h);
    const sx = w / ARENA.w;
    const sy = h / ARENA.h;
    const map = (o) => ({ x: w / 2 + o.x * sx, y: h / 2 + o.y * sy });
    rtx.strokeStyle = "rgba(238,245,255,0.22)";
    rtx.strokeRect(8, 8, w - 16, h - 16);
    rtx.beginPath();
    rtx.arc(w / 2, h / 2, state.stormRadius * sx, 0, TAU);
    rtx.strokeStyle = "rgba(247,201,72,0.75)";
    rtx.stroke();
    const bp = map(ball);
    rtx.fillStyle = "#eef5ff";
    rtx.beginPath();
    rtx.arc(bp.x, bp.y, 4, 0, TAU);
    rtx.fill();
    [player, ...bots].forEach((car) => {
      if (car.eliminated) return;
      const p = map(car);
      rtx.fillStyle = car === player ? "#ffffff" : car.color;
      rtx.fillRect(p.x - 3, p.y - 3, 6, 6);
    });
  }

  function updateHud() {
    blueScoreEl.textContent = state.blue;
    redScoreEl.textContent = state.red;
    timerEl.textContent = training ? "FREE" : formatTime(state.time);
    healthEl.value = player.health;
    armorEl.value = player.armor;
    boostEl.value = player.boost;
  }

  function formatTime(time) {
    const t = Math.max(0, Math.ceil(time));
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }

  function pickupColor(kind) {
    if (kind === "repair") return "#42d7a7";
    if (kind === "armor") return "#f7c948";
    return "#39b8ff";
  }

  function emitTrail(car, color, count) {
    const backX = car.x - Math.cos(car.angle) * car.length * 0.46;
    const backY = car.y - Math.sin(car.angle) * car.length * 0.46;
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x: backX + rand(-12, 12),
        y: backY + rand(-12, 12),
        vx: -Math.cos(car.angle) * rand(80, 260) + rand(-90, 90),
        vy: -Math.sin(car.angle) * rand(80, 260) + rand(-90, 90),
        life: rand(0.18, 0.36),
        maxLife: 0.36,
        size: rand(4, 9),
        color,
      });
    }
  }

  function burst(x, y, color, count, power) {
    for (let i = 0; i < count; i += 1) {
      const a = rand(0, TAU);
      const s = rand(power * 0.15, power);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.25, 0.82),
        maxLife: 0.82,
        size: rand(3, 11),
        color,
      });
    }
  }

  function message(text) {
    feedEl.textContent = text;
    messageTimer = 2.6;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function initAudio() {
    if (audioReady) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audio = new AudioContext();
    audioReady = true;
  }

  function tone(freq, duration, type) {
    if (!audioReady || !audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.045, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    keys.add(key);
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
    if (key === "p") {
      paused = !paused;
      menu.classList.toggle("hidden", !paused);
      if (!paused) last = performance.now();
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  playBtn.addEventListener("click", () => {
    resetMatch(false);
    begin();
  });
  trainingBtn.addEventListener("click", () => {
    resetMatch(true);
    begin();
  });
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    menu.classList.toggle("hidden", !paused);
    if (!paused) {
      initAudio();
      last = performance.now();
    }
  });
  resetBtn.addEventListener("click", () => resetMatch(training));

  resize();
  resetMatch(false);
  if (new URLSearchParams(window.location.search).get("demo") === "1") {
    resetMatch(true);
    begin();
  }
  render();
})();
