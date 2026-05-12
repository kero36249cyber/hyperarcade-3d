import * as THREE from "three";

const viewport = document.querySelector("#viewport");
const overlay = document.querySelector("#overlay");
const listEl = document.querySelector("#gameList");
const searchEl = document.querySelector("#search");
const categoryEl = document.querySelector("#category");
const scoreEl = document.querySelector("#score");
const goalEl = document.querySelector("#goal");
const timerEl = document.querySelector("#timer");
const livesEl = document.querySelector("#lives");
const titleEl = document.querySelector("#gameTitle");
const numberEl = document.querySelector("#gameNumber");
const missionEl = document.querySelector("#mission");
const controlsEl = document.querySelector("#controls");
const pauseBtn = document.querySelector("#pauseBtn");
const restartBtn = document.querySelector("#restartBtn");
const playFeaturedBtn = document.querySelector("#playFeatured");
const randomGameBtn = document.querySelector("#randomGame");

const genres = [
  ["Racing", "RC", "City Escape Driver", "Drive through traffic and collect coins."],
  ["Shooter", "SH", "Star Defender", "Fly a ship and shoot enemy drones."],
  ["Soccer", "SP", "Street Soccer", "Push the ball into the goal."],
  ["Fighting", "FG", "Arena Fighter", "Punch the opponent until they fall."],
  ["Platformer", "PF", "Sky Platformer", "Jump across platforms to the flag."],
  ["Flight", "FL", "Ring Pilot", "Fly through glowing sky rings."],
  ["Survival", "SV", "Meteor Survival", "Dodge falling meteors."],
  ["Puzzle", "PZ", "Crystal Puzzle", "Collect crystals in the right order."],
  ["Strategy", "ST", "Tower Defense", "Place turrets to defend your core."],
  ["Runner", "RN", "Lane Runner", "Run, switch lanes, and jump obstacles."]
];

const variants = ["Rookie", "Turbo", "Night", "Desert", "Ice", "Lava", "Cyber", "Storm", "Elite", "Boss"];
const games = Array.from({ length: 100 }, (_, index) => {
  const [genre, icon, base, mission] = genres[index % genres.length];
  const tier = Math.floor(index / genres.length);
  return {
    id: index + 1,
    genre,
    icon,
    title: `${variants[tier]} ${base}`,
    mission,
    tier,
    time: 70 - tier * 3,
    goal: 5 + tier
  };
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x09101a);
scene.fog = new THREE.Fog(0x09101a, 35, 110);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x172033, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(8, 16, 10);
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const keys = new Set();
const pressed = new Set();
let selected = games[0];
let state;
let player;
let last = performance.now();

function material(color, emissive = 0x000000, roughness = 0.55, metalness = 0.12) {
  return new THREE.MeshStandardMaterial({ color, emissive, roughness, metalness });
}

const mats = {
  floor: material(0x111823),
  road: material(0x20242c),
  grass: material(0x12351f),
  player: material(0x42d8ff, 0x052a36, 0.28, 0.45),
  hero: material(0xf6b64a, 0x2d1700, 0.32, 0.3),
  enemy: material(0xff5b6e, 0x240006),
  green: material(0x47df9b, 0x0b4f32),
  violet: material(0xa77cff, 0x1f0f44),
  white: material(0xf6f2e8),
  dark: material(0x090909),
  wall: material(0x2c394c),
  coin: material(0xffd166, 0x4a2b00),
  glass: material(0x6ed6ff, 0x082638, 0.25, 0.4)
};

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function sphere(r, mat) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
}

function cone(r, h, mat) {
  return new THREE.Mesh(new THREE.ConeGeometry(r, h, 28), mat);
}

function torus(r, tube, mat) {
  return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 36), mat);
}

function add(obj, x = 0, y = 0, z = 0) {
  obj.position.set(x, y, z);
  world.add(obj);
  return obj;
}

function clearWorld() {
  while (world.children.length) {
    const obj = world.children.pop();
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
}

function dir() {
  const x = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  const z = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

function moveTopDown(dt, speed = 8, bounds = 15) {
  const d = dir();
  player.position.x = clamp(player.position.x + d.x * speed * dt, -bounds, bounds);
  player.position.z = clamp(player.position.z + d.z * speed * dt, -bounds, bounds);
}

function makeCar(mat = mats.player) {
  const car = new THREE.Group();
  car.add(box(1.8, 0.48, 3.2, mat));
  const cab = box(1.1, 0.45, 1.15, mats.glass);
  cab.position.y = 0.55;
  cab.position.z = -0.25;
  car.add(cab);
  for (const x of [-1, 1]) for (const z of [-1.05, 1.05]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 18), mats.dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -0.2, z);
    car.add(wheel);
  }
  return car;
}

function makeHumanoid(mat = mats.hero) {
  const body = new THREE.Group();
  body.add(box(0.7, 1.2, 0.45, mat));
  const head = sphere(0.32, mats.white);
  head.position.y = 0.92;
  body.add(head);
  const arm = box(1.25, 0.22, 0.22, mat);
  arm.position.y = 0.25;
  body.add(arm);
  return body;
}

function makeShip(mat = mats.player) {
  const ship = cone(0.65, 1.45, mat);
  ship.rotation.x = Math.PI / 2;
  return ship;
}

function baseState() {
  return {
    score: 0,
    goal: selected.goal,
    time: selected.time,
    lives: 3,
    paused: false,
    over: false,
    objects: [],
    bullets: [],
    extras: [],
    spawn: 0
  };
}

function setupFloor(kind = "floor") {
  add(box(34, 0.35, 34, kind === "grass" ? mats.grass : kind === "road" ? mats.road : mats.floor), 0, -0.18, 0);
  const grid = new THREE.GridHelper(34, 34, 0x42d8ff, 0x243244);
  grid.position.y = 0.02;
  world.add(grid);
}

function resetGame() {
  clearWorld();
  scene.background = new THREE.Color(selected.genre === "Flight" || selected.genre === "Shooter" ? 0x050914 : 0x09101a);
  state = baseState();
  setups[selected.genre]();
  overlay.classList.add("hidden");
  updateHud();
  renderGameList();
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score);
  goalEl.textContent = state.goal;
  timerEl.textContent = Math.max(0, Math.ceil(state.time));
  livesEl.textContent = state.lives;
  titleEl.textContent = selected.title;
  numberEl.textContent = `Game ${String(selected.id).padStart(3, "0")} - ${selected.genre}`;
  missionEl.textContent = `${selected.mission} Difficulty ${selected.tier + 1}/10.`;
  controlsEl.textContent = controls[selected.genre];
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";
}

function finish(won, message) {
  if (state.over) return;
  state.over = true;
  overlay.innerHTML = `${won ? "You Win" : "Game Over"}<small>${message}</small>`;
  overlay.classList.remove("hidden");
}

function setupRacing() {
  setupFloor("road");
  player = makeCar(mats.player);
  add(player, 0, 0.45, 11);
  state.goal = 1200 + selected.tier * 260;
  state.speed = 0;
  state.coins = [];
  for (let i = 0; i < 14; i++) {
    const coin = torus(0.42, 0.09, mats.coin);
    coin.rotation.y = Math.PI / 2;
    add(coin, [-5, -2.5, 0, 2.5, 5][i % 5], 0.9, -10 - i * 9);
    state.coins.push(coin);
  }
}

function updateRacing(dt) {
  const steer = dir().x;
  if (keys.has("w") || keys.has("arrowup")) state.speed += 18 * dt;
  else state.speed -= 8 * dt;
  if (keys.has("s") || keys.has("arrowdown")) state.speed -= 18 * dt;
  if (keys.has(" ")) state.speed += 10 * dt;
  state.speed = clamp(state.speed, 0, 28 + selected.tier * 2);
  player.position.x = clamp(player.position.x + steer * 11 * dt, -6, 6);
  player.rotation.z = -steer * 0.15;
  const travel = state.speed * dt;
  state.score += travel * 18;
  state.spawn -= dt;
  if (state.spawn <= 0) {
    state.spawn = Math.max(0.45, 1.1 - selected.tier * 0.05);
    const car = makeCar(Math.random() > 0.5 ? mats.enemy : mats.hero);
    add(car, [-5, -2.5, 0, 2.5, 5][Math.floor(Math.random() * 5)], 0.45, -42);
    car.userData.speed = 7 + Math.random() * 7;
    state.objects.push(car);
  }
  for (const car of state.objects) {
    car.position.z += (state.speed - car.userData.speed) * dt;
    if (Math.abs(player.position.x - car.position.x) < 1.6 && Math.abs(player.position.z - car.position.z) < 2.4) {
      state.lives -= 1;
      state.speed *= 0.25;
      car.position.z = 24;
    }
  }
  for (const coin of state.coins) {
    coin.position.z += travel;
    coin.rotation.z += dt * 5;
    if (Math.abs(player.position.x - coin.position.x) < 1.2 && Math.abs(player.position.z - coin.position.z) < 1.5) {
      state.score += 60;
      coin.position.z -= 140;
    }
    if (coin.position.z > 25) coin.position.z -= 140;
  }
  state.objects = state.objects.filter((car) => car.position.z < 26);
  if (state.score >= state.goal) finish(true, "You escaped the city.");
}

function setupShooter() {
  setupFloor();
  player = makeShip();
  add(player, 0, 0.8, 12);
  state.goal = 12 + selected.tier * 2;
}

function updateShooter(dt) {
  moveTopDown(dt, 9, 14);
  if (pressed.has(" ")) {
    const bullet = add(sphere(0.17, mats.coin), player.position.x, 0.8, player.position.z - 1);
    bullet.userData.vz = -22;
    state.bullets.push(bullet);
  }
  state.spawn -= dt;
  if (state.spawn <= 0) {
    state.spawn = Math.max(0.25, 0.8 - selected.tier * 0.04);
    const enemy = makeShip(mats.enemy);
    enemy.rotation.x = -Math.PI / 2;
    add(enemy, -13 + Math.random() * 26, 0.8, -18);
    state.objects.push(enemy);
  }
  state.bullets.forEach((b) => (b.position.z -= 22 * dt));
  state.objects.forEach((e) => (e.position.z += (5 + selected.tier) * dt));
  for (const b of state.bullets) for (const e of state.objects) {
    if (!e.userData.dead && dist(b, e) < 0.9) {
      b.userData.dead = true;
      e.userData.dead = true;
      e.visible = false;
      state.score += 1;
    }
  }
  for (const e of state.objects) if (!e.userData.dead && (e.position.z > 15 || dist(player, e) < 1)) {
    e.userData.dead = true;
    e.visible = false;
    state.lives -= 1;
  }
  state.objects = state.objects.filter((e) => !e.userData.dead && e.position.z < 24);
  state.bullets = state.bullets.filter((b) => !b.userData.dead && b.position.z > -30);
  if (state.score >= state.goal) finish(true, "Sector cleared.");
}

function setupSoccer() {
  setupFloor("grass");
  player = makeHumanoid(mats.player);
  add(player, -8, 0.8, 0);
  state.goal = 3 + Math.floor(selected.tier / 3);
  state.ball = add(sphere(0.55, mats.white), 0, 0.55, 0);
  state.ball.userData.vx = 0;
  state.ball.userData.vz = 0;
  add(box(0.3, 3, 6, mats.green), 15.4, 1.5, 0);
}

function updateSoccer(dt) {
  moveTopDown(dt, 8);
  const ball = state.ball;
  if (dist(player, ball) < 1.3) {
    const power = keys.has(" ") ? 14 : 8;
    const dx = ball.position.x - player.position.x;
    const dz = ball.position.z - player.position.z;
    const len = Math.hypot(dx, dz) || 1;
    ball.userData.vx = (dx / len) * power;
    ball.userData.vz = (dz / len) * power;
  }
  ball.position.x += ball.userData.vx * dt;
  ball.position.z += ball.userData.vz * dt;
  ball.userData.vx *= 0.985;
  ball.userData.vz *= 0.985;
  if (Math.abs(ball.position.z) > 15) ball.userData.vz *= -1;
  if (ball.position.x > 15 && Math.abs(ball.position.z) < 3) {
    state.score += 1;
    ball.position.set(0, 0.55, 0);
    ball.userData.vx = 0;
    ball.userData.vz = 0;
  }
  if (state.score >= state.goal) finish(true, "You won the match.");
}

function setupFighting() {
  setupFloor();
  player = makeHumanoid(mats.player);
  add(player, -7, 0.8, 0);
  state.enemy = makeHumanoid(mats.enemy);
  add(state.enemy, 7, 0.8, 0);
  state.enemyHp = 100 + selected.tier * 12;
  state.playerHp = 100;
  state.goal = 100;
}

function updateFighting(dt) {
  player.position.x = clamp(player.position.x + dir().x * 8 * dt, -14, 14);
  state.enemy.position.x += Math.sign(player.position.x - state.enemy.position.x) * (2.5 + selected.tier * 0.25) * dt;
  const close = Math.abs(player.position.x - state.enemy.position.x) < 1.8;
  if (pressed.has(" ") && close) {
    state.enemyHp -= 12;
    state.score = 100 - Math.max(0, state.enemyHp);
  }
  state.enemy.userData.cool = Math.max(0, (state.enemy.userData.cool || 0) - dt);
  if (close && state.enemy.userData.cool <= 0) {
    state.playerHp -= 10;
    state.enemy.userData.cool = 0.65;
    state.lives = Math.ceil(state.playerHp / 34);
  }
  if (state.enemyHp <= 0) finish(true, "Knockout.");
}

function setupPlatformer() {
  setupFloor();
  player = makeHumanoid(mats.player);
  add(player, -14, 1, 10);
  player.userData.vy = 0;
  state.goal = 1;
  state.platforms = [];
  for (let i = 0; i < 8; i++) state.platforms.push(add(box(3.3, 0.35, 3.3, mats.wall), -14 + i * 4, 0.3 + (i % 3) * 0.9, 10 - i * 3.4));
  state.flag = add(cone(0.7, 2.2, mats.green), 14, 2.5, -13);
}

function updatePlatformer(dt) {
  const d = dir();
  player.position.x += d.x * 6 * dt;
  player.position.z += d.z * 6 * dt;
  if ((pressed.has(" ") || pressed.has("w") || pressed.has("arrowup")) && player.userData.grounded) player.userData.vy = 9;
  player.userData.vy -= 22 * dt;
  player.position.y += player.userData.vy * dt;
  player.userData.grounded = false;
  for (const p of state.platforms) {
    if (Math.abs(player.position.x - p.position.x) < 2 && Math.abs(player.position.z - p.position.z) < 2 && player.position.y <= p.position.y + 1.1 && player.userData.vy <= 0) {
      player.position.y = p.position.y + 1.1;
      player.userData.vy = 0;
      player.userData.grounded = true;
    }
  }
  if (player.position.y < -5) state.lives = 0;
  if (dist(player, state.flag) < 1.5) {
    state.score = 1;
    finish(true, "Flag reached.");
  }
}

function setupFlight() {
  setupFloor();
  player = makeShip(mats.hero);
  add(player, 0, 4, 10);
  state.goal = 8 + selected.tier;
  for (let i = 0; i < state.goal; i++) {
    const ring = torus(1.25, 0.09, mats.green);
    ring.rotation.y = Math.PI / 2;
    add(ring, -10 + Math.random() * 20, 2 + Math.random() * 5, -8 - i * 5);
    state.objects.push(ring);
  }
}

function updateFlight(dt) {
  const d = dir();
  player.position.x = clamp(player.position.x + d.x * 9 * dt, -14, 14);
  player.position.y = clamp(player.position.y - d.z * 6 * dt, 1, 8);
  player.position.z -= (keys.has(" ") ? 13 : 7) * dt;
  for (const ring of state.objects) if (!ring.userData.dead && dist(player, ring) < 1.4 && Math.abs(player.position.y - ring.position.y) < 1.3) {
    ring.userData.dead = true;
    ring.visible = false;
    state.score += 1;
  }
  if (state.score >= state.goal) finish(true, "Flight path cleared.");
}

function setupSurvival() {
  setupFloor();
  player = makeHumanoid(mats.player);
  add(player, 0, 0.8, 8);
  state.goal = 35 + selected.tier * 4;
}

function updateSurvival(dt) {
  moveTopDown(dt, keys.has(" ") ? 13 : 8);
  state.spawn -= dt;
  if (state.spawn <= 0) {
    state.spawn = Math.max(0.18, 0.45 - selected.tier * 0.02);
    const meteor = add(sphere(0.55, mats.enemy), -15 + Math.random() * 30, 9, -15 + Math.random() * 30);
    meteor.userData.vy = 7 + selected.tier * 0.6;
    state.objects.push(meteor);
  }
  for (const meteor of state.objects) {
    meteor.position.y -= meteor.userData.vy * dt;
    if (meteor.position.y < 0.5) meteor.position.y = 0.5;
    if (!meteor.userData.dead && meteor.position.y <= 0.7 && dist(player, meteor) < 1.1) {
      meteor.userData.dead = true;
      meteor.visible = false;
      state.lives -= 1;
    }
  }
  state.score += dt;
  if (state.score >= state.goal) finish(true, "You survived.");
}

function setupPuzzle() {
  setupFloor();
  player = makeHumanoid(mats.player);
  add(player, 0, 0.8, 9);
  state.goal = 6 + Math.floor(selected.tier / 2);
  state.next = 1;
  for (let i = 1; i <= state.goal; i++) {
    const gem = cone(0.55, 1, i === 1 ? mats.green : mats.violet);
    gem.rotation.x = Math.PI;
    gem.userData.number = i;
    add(gem, -14 + Math.random() * 28, 0.9, -13 + Math.random() * 26);
    state.objects.push(gem);
  }
}

function updatePuzzle(dt) {
  moveTopDown(dt, 7);
  for (const gem of state.objects) {
    gem.rotation.y += dt * 2;
    gem.material = gem.userData.number === state.next ? mats.green : mats.violet;
    if (!gem.userData.dead && dist(player, gem) < 1.15) {
      if (gem.userData.number === state.next) {
        gem.userData.dead = true;
        gem.visible = false;
        state.next += 1;
        state.score += 1;
      } else {
        state.lives -= 1;
        player.position.set(0, 0.8, 9);
      }
    }
  }
  if (state.score >= state.goal) finish(true, "Puzzle solved.");
}

function setupStrategy() {
  setupFloor();
  player = makeHumanoid(mats.player);
  add(player, 0, 0.8, 8);
  state.goal = 12 + selected.tier;
  state.energy = 3;
  state.core = add(sphere(1.15, mats.green), 0, 1.1, 0);
}

function updateStrategy(dt) {
  moveTopDown(dt, 6.2);
  state.energy = Math.min(8, state.energy + dt * 0.45);
  if (pressed.has(" ") && state.energy >= 1) {
    state.energy -= 1;
    state.extras.push(add(cone(0.55, 1.4, mats.coin), player.position.x, 0.75, player.position.z));
  }
  state.spawn -= dt;
  if (state.spawn <= 0) {
    state.spawn = Math.max(0.45, 1.2 - selected.tier * 0.06);
    state.objects.push(add(sphere(0.55, mats.enemy), Math.random() < 0.5 ? -17 : 17, 0.6, -14 + Math.random() * 28));
  }
  for (const enemy of state.objects) {
    if (enemy.userData.dead) continue;
    const dx = -enemy.position.x;
    const dz = -enemy.position.z;
    const len = Math.hypot(dx, dz) || 1;
    enemy.position.x += (dx / len) * 3 * dt;
    enemy.position.z += (dz / len) * 3 * dt;
    if (dist(enemy, state.core) < 1.4) {
      enemy.userData.dead = true;
      enemy.visible = false;
      state.lives -= 1;
    }
  }
  for (const turret of state.extras) {
    turret.rotation.y += dt * 2;
    const target = state.objects.find((enemy) => !enemy.userData.dead && dist(turret, enemy) < 4.5);
    if (target) {
      target.userData.hp = (target.userData.hp || 2) - dt * 4;
      if (target.userData.hp <= 0) {
        target.userData.dead = true;
        target.visible = false;
        state.score += 1;
      }
    }
  }
  if (state.score >= state.goal) finish(true, "Core defended.");
}

function setupRunner() {
  setupFloor("road");
  player = makeHumanoid(mats.player);
  add(player, 0, 0.8, 10);
  player.userData.vy = 0;
  state.goal = 900 + selected.tier * 220;
  state.lane = 1;
}

function updateRunner(dt) {
  if (pressed.has("a") || pressed.has("arrowleft")) state.lane = clamp(state.lane - 1, 0, 2);
  if (pressed.has("d") || pressed.has("arrowright")) state.lane = clamp(state.lane + 1, 0, 2);
  if ((pressed.has(" ") || pressed.has("w") || pressed.has("arrowup")) && player.userData.grounded !== false) player.userData.vy = 8;
  player.userData.vy -= 22 * dt;
  player.position.y += player.userData.vy * dt;
  if (player.position.y <= 0.8) {
    player.position.y = 0.8;
    player.userData.vy = 0;
    player.userData.grounded = true;
  } else player.userData.grounded = false;
  player.position.x += ([-4, 0, 4][state.lane] - player.position.x) * 12 * dt;
  state.score += (12 + selected.tier) * dt;
  state.spawn -= dt;
  if (state.spawn <= 0) {
    state.spawn = Math.max(0.45, 1 - selected.tier * 0.04);
    state.objects.push(add(box(1.4, 1.1, 1.4, mats.enemy), [-4, 0, 4][Math.floor(Math.random() * 3)], 0.55, -24));
  }
  for (const block of state.objects) {
    block.position.z += (12 + selected.tier) * dt;
    if (Math.abs(block.position.x - player.position.x) < 1.2 && Math.abs(block.position.z - player.position.z) < 1.4 && player.position.y < 1.5) {
      block.position.z = 24;
      state.lives -= 1;
    }
  }
  state.objects = state.objects.filter((block) => block.position.z < 25);
  if (state.score >= state.goal) finish(true, "Run complete.");
}

const setups = { Racing: setupRacing, Shooter: setupShooter, Soccer: setupSoccer, Fighting: setupFighting, Platformer: setupPlatformer, Flight: setupFlight, Survival: setupSurvival, Puzzle: setupPuzzle, Strategy: setupStrategy, Runner: setupRunner };
const updates = { Racing: updateRacing, Shooter: updateShooter, Soccer: updateSoccer, Fighting: updateFighting, Platformer: updatePlatformer, Flight: updateFlight, Survival: updateSurvival, Puzzle: updatePuzzle, Strategy: updateStrategy, Runner: updateRunner };
const controls = {
  Racing: "W/Up accelerate. A/D steer. S brakes. Space nitro. P pause. R restart.",
  Shooter: "WASD/arrows fly. Space shoots. P pause. R restart.",
  Soccer: "WASD/arrows move. Space power-kicks the ball. P pause. R restart.",
  Fighting: "A/D move. Space punches when close. P pause. R restart.",
  Platformer: "A/D move. Space or Up jumps. P pause. R restart.",
  Flight: "WASD/arrows fly through rings. Space accelerates. P pause. R restart.",
  Survival: "WASD/arrows move. Space dashes. P pause. R restart.",
  Puzzle: "WASD/arrows move. Collect the glowing crystal first. P pause. R restart.",
  Strategy: "WASD/arrows move. Space places turrets. P pause. R restart.",
  Runner: "A/D switch lanes. Space jumps. P pause. R restart."
};

function update(dt) {
  if (state.paused || state.over) return;
  state.time -= dt;
  updates[selected.genre](dt);
  if (state.time <= 0) finish(false, "Time expired.");
  if (state.lives <= 0) finish(false, "No lives left.");
  updateHud();
  pressed.clear();
}

function render() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  if (selected.genre === "Racing" || selected.genre === "Runner") {
    camera.position.x += (player.position.x * 0.45 - camera.position.x) * 0.08;
    camera.position.set(camera.position.x, 6.2, player.position.z + 10.5);
    camera.lookAt(player.position.x, 0.7, player.position.z - 10);
  } else if (selected.genre === "Flight") {
    camera.position.x += (player.position.x - camera.position.x) * 0.05;
    camera.position.y += (player.position.y + 7 - camera.position.y) * 0.05;
    camera.position.z = player.position.z + 17;
    camera.lookAt(player.position.x, player.position.y, player.position.z - 8);
  } else {
    camera.position.x += (player.position.x * 0.22 - camera.position.x) * 0.05;
    camera.position.y += (13 - camera.position.y) * 0.05;
    camera.position.z += (player.position.z + 18 - camera.position.z) * 0.05;
    camera.lookAt(player.position.x, 0, player.position.z);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

function resize() {
  const rect = viewport.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

function renderGameList() {
  const query = searchEl.value.trim().toLowerCase();
  const category = categoryEl.value;
  const filtered = games.filter((game) => {
    const text = `${game.id} ${game.title} ${game.genre}`.toLowerCase();
    return text.includes(query) && (category === "all" || game.genre === category);
  });
  listEl.innerHTML = "";
  for (const game of filtered) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `game-card${game.id === selected.id ? " active" : ""}`;
    button.innerHTML = `<span class="badge">${game.icon}</span><span><strong>${String(game.id).padStart(3, "0")} ${game.title}</strong><small>${game.genre} 3D game</small></span><span>${game.tier + 1}/10</span>`;
    button.addEventListener("click", () => {
      selected = game;
      resetGame();
    });
    listEl.appendChild(button);
  }
}

function setupFilters() {
  categoryEl.innerHTML = '<option value="all">All games</option>';
  for (const [name] of genres) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    categoryEl.appendChild(option);
  }
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
  if (!keys.has(key)) pressed.add(key);
  keys.add(key);
  if (key === "p") {
    state.paused = !state.paused;
    overlay.innerHTML = "Paused<small>Press P or Resume to continue.</small>";
    overlay.classList.toggle("hidden", !state.paused);
    updateHud();
  }
  if (key === "r") resetGame();
});

window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("resize", resize);
searchEl.addEventListener("input", renderGameList);
categoryEl.addEventListener("change", renderGameList);
pauseBtn.addEventListener("click", () => {
  state.paused = !state.paused;
  overlay.innerHTML = "Paused<small>Press P or Resume to continue.</small>";
  overlay.classList.toggle("hidden", !state.paused);
  updateHud();
});
restartBtn.addEventListener("click", resetGame);
playFeaturedBtn.addEventListener("click", () => resetGame());
randomGameBtn.addEventListener("click", () => {
  selected = games[Math.floor(Math.random() * games.length)];
  resetGame();
});

setupFilters();
resize();
resetGame();
render();
