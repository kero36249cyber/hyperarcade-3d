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

const genreData = [
  ["Action", "AX", "Defeat drones in a 3D combat arena.", "WASD/arrows move. Space attacks."],
  ["Racing", "RC", "Race through checkpoint gates and avoid traffic.", "A/D or arrows steer. Space boosts."],
  ["Shooter", "SH", "Pilot a star fighter and destroy incoming ships.", "WASD/arrows fly. Space fires."],
  ["Platformer", "PF", "Jump across floating platforms to reach the flag.", "A/D move. Space or Up jumps."],
  ["Sports", "SP", "Push the ball into the glowing goal.", "WASD/arrows move. Space power-kicks."],
  ["Puzzle", "PZ", "Collect numbered crystals in the correct order.", "WASD/arrows move carefully."],
  ["Survival", "SV", "Stay alive while hazards rain into the arena.", "WASD/arrows move. Space dashes."],
  ["Strategy", "ST", "Defend your core by placing turrets.", "Move commander. Space places a turret."],
  ["Arena", "AR", "Capture energy zones while rivals chase you.", "WASD/arrows move. Space pulses."],
  ["Flight", "FL", "Thread a ship through floating rings.", "WASD/arrows fly. Space accelerates."]
];

const titles = {
  Action: ["Titan Raid", "Blade District", "Cyber Ronin", "Mech Breaker", "Shadow Vault", "Lava Siege", "Ninja Pulse", "Agent Zero", "Dragon Core", "Vortex War"],
  Racing: ["Neon GP", "Canyon Turbo", "Night Drift", "Skyway Rush", "Metro Rally", "Dustline Cup", "Ice Circuit", "Volcano Sprint", "Hyperlane", "Chrome Run"],
  Shooter: ["Star Siege", "Meteor Front", "Alien Swarm", "Nebula Fury", "Solar Wings", "Orbit Gunner", "Plasma Fleet", "Moon Strike", "Comet War", "Galaxy Breaker"],
  Platformer: ["Cloud Runner", "Jungle Leap", "Factory Hop", "Crystal Caves", "Magma Steps", "Frost Peak", "Clock Tower", "Rocket Boots", "Sky Island", "Dungeon Jump"],
  Sports: ["Goal Rush", "Power Striker", "Arena Kickoff", "Turbo Ball", "Street Soccer", "Penalty Clash", "Cup Final", "Beach League", "Night Match", "Gravity Goal"],
  Puzzle: ["Rune Path", "Logic Grid", "Crystal Order", "Cipher Maze", "Number Vault", "Switch Room", "Brain Circuit", "Code Garden", "Memory Lane", "Puzzle Forge"],
  Survival: ["Meteor Escape", "Zombie Zone", "Toxic Storm", "Alien Nest", "Last Beacon", "Firestorm", "Ice Panic", "Wasteland Loop", "Night Shelter", "Impact Run"],
  Strategy: ["Core Defense", "Tower Command", "Drone Guard", "Castle Grid", "Base Siege", "Orbital Line", "Crystal War", "Fortress Mind", "Empire Shield", "Final Stand"],
  Arena: ["Zone Clash", "Pulse Arena", "Capture Grid", "Energy Crown", "Dash Dome", "Quantum Ring", "Power Core", "Rival Field", "Control Point", "Arena Prime"],
  Flight: ["Ring Runner", "Sky Tunnel", "Astro Pilot", "Cloud Wings", "Jetstream", "Orbital Dive", "Horizon Flight", "Comet Rings", "Aero Rush", "Space Slalom"]
};

const games = Array.from({ length: 100 }, (_, index) => {
  const [genre, icon, mission, controls] = genreData[index % genreData.length];
  const variant = Math.floor(index / genreData.length);
  return {
    id: index + 1,
    genre,
    icon,
    title: titles[genre][variant],
    mission,
    controls,
    variant,
    goal: 5 + variant,
    time: 70 - variant * 3,
    lives: 3
  };
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a10);
scene.fog = new THREE.Fog(0x070a10, 30, 82);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 170);
camera.position.set(0, 13, 18);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xddeeff, 0x172030, 1.75));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(8, 15, 10);
scene.add(keyLight);

const world = new THREE.Group();
scene.add(world);

const mats = {
  floor: new THREE.MeshStandardMaterial({ color: 0x111823, roughness: 0.72, metalness: 0.18 }),
  road: new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.6 }),
  player: new THREE.MeshStandardMaterial({ color: 0x42d8ff, roughness: 0.32, metalness: 0.3 }),
  hero: new THREE.MeshStandardMaterial({ color: 0xf6b64a, roughness: 0.32, metalness: 0.2 }),
  enemy: new THREE.MeshStandardMaterial({ color: 0xff5b6e, roughness: 0.45, metalness: 0.1 }),
  goal: new THREE.MeshStandardMaterial({ color: 0x47df9b, emissive: 0x0c4d31, roughness: 0.25 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xf6b64a, emissive: 0x3d2400, roughness: 0.28 }),
  violet: new THREE.MeshStandardMaterial({ color: 0xa77cff, emissive: 0x1f0f44, roughness: 0.4 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x2c394c, roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf6f2e8, roughness: 0.42 })
};

const floor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.35, 34), mats.floor);
floor.position.y = -0.2;
scene.add(floor);
const grid = new THREE.GridHelper(34, 34, 0x42d8ff, 0x243244);
grid.position.y = 0.01;
scene.add(grid);

const keys = new Set();
const pressed = new Set();
let selected = games[0];
let state;
let player;
let last = performance.now();

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function sphere(r, mat) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
}

function cone(r, h, mat) {
  return new THREE.Mesh(new THREE.ConeGeometry(r, h, 28), mat);
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

function rand(seed) {
  return Math.abs(Math.sin(seed * 382.113)) % 1;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance2(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
}

function direction() {
  const x = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
  const z = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

function makePlayer(kind = "sphere") {
  if (kind === "car") return add(box(1.1, 0.45, 1.8, mats.player), 0, 0.35, 12);
  if (kind === "ship") {
    const ship = cone(0.65, 1.45, mats.player);
    ship.rotation.x = Math.PI / 2;
    return add(ship, 0, 0.7, 12);
  }
  if (kind === "fighter") return add(box(0.9, 1.5, 0.7, mats.hero), -7, 0.8, 0);
  return add(sphere(0.55, mats.player), 0, 0.6, 8);
}

function baseState() {
  return {
    score: 0,
    goal: selected.goal,
    time: selected.time,
    lives: selected.lives,
    paused: false,
    over: false,
    won: false,
    objects: [],
    bullets: [],
    turrets: [],
    spawn: 0,
    message: ""
  };
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score);
  goalEl.textContent = state.goal;
  timerEl.textContent = Math.max(0, Math.ceil(state.time));
  livesEl.textContent = state.lives;
  titleEl.textContent = selected.title;
  numberEl.textContent = `Game ${String(selected.id).padStart(3, "0")} - ${selected.genre}`;
  missionEl.textContent = `${selected.mission} Mode ${selected.variant + 1}/10.`;
  controlsEl.textContent = `${selected.controls} P pauses. R restarts.`;
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";
}

function finish(won, text) {
  if (state.over) return;
  state.over = true;
  state.won = won;
  state.message = text;
  overlay.innerHTML = `${won ? "Victory" : "Game Over"}<small>${text}</small>`;
  overlay.classList.remove("hidden");
}

function movePlayer(dt, speed = 8, bounds = 15) {
  const d = direction();
  player.position.x = clamp(player.position.x + d.x * speed * dt, -bounds, bounds);
  player.position.z = clamp(player.position.z + d.z * speed * dt, -bounds, bounds);
}

function spawnCube(seed, mat = mats.enemy, scale = 0.9) {
  return add(box(scale, scale, scale, mat), -14 + rand(seed) * 28, scale / 2, -13 + rand(seed + 9) * 22);
}

function setupAction() {
  player = makePlayer("fighter");
  state.goal = 7 + selected.variant;
  for (let i = 0; i < state.goal; i++) state.objects.push(spawnCube(i + selected.id, mats.enemy, 0.9));
}

function updateAction(dt) {
  movePlayer(dt, 8.5);
  if (pressed.has(" ")) {
    for (const enemy of state.objects) {
      if (!enemy.userData.dead && distance2(player, enemy) < 2.4) {
        enemy.userData.dead = true;
        enemy.visible = false;
        state.score += 1;
      }
    }
  }
  for (const enemy of state.objects) {
    if (enemy.userData.dead) continue;
    const dx = player.position.x - enemy.position.x;
    const dz = player.position.z - enemy.position.z;
    const len = Math.hypot(dx, dz) || 1;
    enemy.position.x += (dx / len) * (2.2 + selected.variant * 0.25) * dt;
    enemy.position.z += (dz / len) * (2.2 + selected.variant * 0.25) * dt;
    enemy.rotation.y += dt * 2.5;
    if (distance2(player, enemy) < 0.9) {
      enemy.position.x *= -1;
      enemy.position.z = -12;
      state.lives -= 1;
    }
  }
  if (state.score >= state.goal) finish(true, "Combat wave cleared.");
}

function setupRacing() {
  player = makePlayer("car");
  floor.material = mats.road;
  state.goal = 1200 + selected.variant * 240;
  state.distance = 0;
}

function updateRacing(dt) {
  const steer = direction().x;
  const boost = keys.has(" ") ? 1.6 : 1;
  player.position.x = clamp(player.position.x + steer * 11 * dt, -6, 6);
  state.distance += (210 + selected.variant * 28) * boost * dt;
  state.spawn -= dt;
  if (state.spawn <= 0) {
    state.spawn = 0.7 - Math.min(0.35, selected.variant * 0.025);
    state.objects.push(add(box(1.2, 0.55, 1.9, mats.enemy), [-5, 0, 5][Math.floor(Math.random() * 3)], 0.35, -18));
  }
  for (const car of state.objects) {
    car.position.z += (10 + selected.variant * 0.8) * dt;
    if (distance2(player, car) < 1.25) {
      car.position.z = 20;
      state.lives -= 1;
    }
  }
  state.objects = state.objects.filter((car) => car.position.z < 20);
  state.score = state.distance;
  if (state.distance >= state.goal) finish(true, "Finish line crossed.");
}

function setupShooter() {
  player = makePlayer("ship");
  state.goal = 12 + selected.variant * 2;
}

function updateShooter(dt) {
  movePlayer(dt, 9, 14);
  player.rotation.z = -direction().x * 0.35;
  if (pressed.has(" ")) {
    const bullet = add(sphere(0.16, mats.gold), player.position.x, 0.8, player.position.z - 1);
    bullet.userData.vz = -20;
    state.bullets.push(bullet);
  }
  state.spawn -= dt;
  if (state.spawn <= 0) {
    state.spawn = Math.max(0.28, 0.85 - selected.variant * 0.04);
    const enemy = add(cone(0.55, 1.1, mats.enemy), -13 + Math.random() * 26, 0.65, -17);
    enemy.rotation.x = -Math.PI / 2;
    state.objects.push(enemy);
  }
  for (const bullet of state.bullets) bullet.position.z += bullet.userData.vz * dt;
  for (const enemy of state.objects) enemy.position.z += (5 + selected.variant * 0.6) * dt;
  for (const bullet of state.bullets) {
    for (const enemy of state.objects) {
      if (!enemy.userData.dead && distance2(bullet, enemy) < 0.8) {
        enemy.userData.dead = true;
        bullet.userData.dead = true;
        enemy.visible = false;
        state.score += 1;
      }
    }
  }
  for (const enemy of state.objects) {
    if (!enemy.userData.dead && (enemy.position.z > 15 || distance2(player, enemy) < 1)) {
      enemy.userData.dead = true;
      enemy.visible = false;
      state.lives -= 1;
    }
  }
  state.bullets = state.bullets.filter((obj) => !obj.userData.dead && obj.position.z > -40);
  state.objects = state.objects.filter((obj) => !obj.userData.dead && obj.position.z < 24);
  if (state.score >= state.goal) finish(true, "Sector secured.");
}

function setupPlatformer() {
  player = makePlayer("sphere");
  player.position.set(-13, 1.1, 10);
  player.userData.vy = 0;
  state.goal = 1;
  state.platforms = [];
  for (let i = 0; i < 8; i++) {
    state.platforms.push(add(box(3.2, 0.35, 3.2, mats.wall), -13 + i * 4, 0.2 + (i % 3) * 0.85, 10 - i * 3.3));
  }
  state.flag = add(cone(0.7, 2.2, mats.goal), 14, 2.6, -13);
}

function updatePlatformer(dt) {
  const d = direction();
  player.position.x += d.x * 6 * dt;
  player.position.z += d.z * 6 * dt;
  if ((pressed.has(" ") || pressed.has("arrowup") || pressed.has("w")) && player.userData.grounded) player.userData.vy = 9.5;
  player.userData.vy -= 22 * dt;
  player.position.y += player.userData.vy * dt;
  player.userData.grounded = false;
  for (const p of state.platforms) {
    const near = Math.abs(player.position.x - p.position.x) < 2 && Math.abs(player.position.z - p.position.z) < 2;
    if (near && player.position.y <= p.position.y + 0.85 && player.userData.vy <= 0) {
      player.position.y = p.position.y + 0.85;
      player.userData.vy = 0;
      player.userData.grounded = true;
    }
  }
  if (player.position.y < -4) state.lives = 0;
  if (distance2(player, state.flag) < 1.5) {
    state.score = 1;
    finish(true, "Flag reached.");
  }
}

function setupSports() {
  player = makePlayer("sphere");
  player.position.set(-10, 0.6, 0);
  state.goal = 3 + Math.floor(selected.variant / 3);
  state.ball = add(sphere(0.55, mats.white), 0, 0.55, 0);
  state.ball.userData.vx = 0;
  state.ball.userData.vz = 0;
  state.net = add(box(0.3, 3, 6, mats.goal), 15.5, 1.5, 0);
}

function updateSports(dt) {
  movePlayer(dt, 8);
  const ball = state.ball;
  if (distance2(player, ball) < 1.3) {
    const power = keys.has(" ") ? 13 : 8;
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
  if (ball.position.x < -16) ball.userData.vx *= -1;
  if (ball.position.x > 15.2 && Math.abs(ball.position.z) < 3) {
    state.score += 1;
    ball.position.set(0, 0.55, 0);
    ball.userData.vx = 0;
    ball.userData.vz = 0;
  }
  if (state.score >= state.goal) finish(true, "Match won.");
}

function setupPuzzle() {
  player = makePlayer("sphere");
  state.goal = 6 + Math.floor(selected.variant / 2);
  state.next = 1;
  for (let i = 1; i <= state.goal; i++) {
    const gem = add(cone(0.55, 1, i === 1 ? mats.goal : mats.violet), -14 + rand(i + selected.id) * 28, 0.85, -13 + rand(i * 5) * 26);
    gem.userData.number = i;
    gem.rotation.x = Math.PI;
    state.objects.push(gem);
  }
}

function updatePuzzle(dt) {
  movePlayer(dt, 7);
  for (const gem of state.objects) {
    gem.rotation.y += dt * 2;
    gem.material = gem.userData.number === state.next ? mats.goal : mats.violet;
    if (!gem.userData.dead && distance2(player, gem) < 1.1) {
      if (gem.userData.number === state.next) {
        gem.userData.dead = true;
        gem.visible = false;
        state.next += 1;
        state.score += 1;
      } else {
        state.lives -= 1;
        player.position.set(0, 0.6, 8);
      }
    }
  }
  if (state.score >= state.goal) finish(true, "Puzzle solved.");
}

function setupSurvival() {
  player = makePlayer("sphere");
  state.goal = 35 + selected.variant * 4;
}

function updateSurvival(dt) {
  movePlayer(dt, keys.has(" ") ? 13 : 8);
  state.spawn -= dt;
  if (state.spawn <= 0) {
    state.spawn = Math.max(0.18, 0.45 - selected.variant * 0.02);
    const hazard = add(sphere(0.55, mats.enemy), -15 + Math.random() * 30, 9, -15 + Math.random() * 30);
    hazard.userData.vy = 7 + selected.variant * 0.6;
    state.objects.push(hazard);
  }
  for (const hazard of state.objects) {
    hazard.position.y -= hazard.userData.vy * dt;
    if (hazard.position.y < 0.5) hazard.position.y = 0.5;
    if (!hazard.userData.dead && hazard.position.y <= 0.7 && distance2(player, hazard) < 1.1) {
      hazard.userData.dead = true;
      hazard.visible = false;
      state.lives -= 1;
    }
  }
  state.score += dt;
  if (state.score >= state.goal) finish(true, "You survived.");
}

function setupStrategy() {
  player = makePlayer("sphere");
  state.goal = 12 + selected.variant;
  state.energy = 3;
  state.core = add(sphere(1.2, mats.goal), 0, 1.2, 0);
}

function updateStrategy(dt) {
  movePlayer(dt, 6.2);
  state.energy = Math.min(8, state.energy + dt * 0.45);
  if (pressed.has(" ") && state.energy >= 1) {
    state.energy -= 1;
    state.turrets.push(add(cone(0.55, 1.4, mats.gold), player.position.x, 0.75, player.position.z));
  }
  state.spawn -= dt;
  if (state.spawn <= 0) {
    state.spawn = Math.max(0.45, 1.2 - selected.variant * 0.06);
    const side = Math.random() < 0.5 ? -17 : 17;
    state.objects.push(add(sphere(0.55, mats.enemy), side, 0.6, -14 + Math.random() * 28));
  }
  for (const enemy of state.objects) {
    if (enemy.userData.dead) continue;
    const dx = -enemy.position.x;
    const dz = -enemy.position.z;
    const len = Math.hypot(dx, dz) || 1;
    enemy.position.x += (dx / len) * (2.5 + selected.variant * 0.22) * dt;
    enemy.position.z += (dz / len) * (2.5 + selected.variant * 0.22) * dt;
    if (distance2(enemy, state.core) < 1.4) {
      enemy.userData.dead = true;
      enemy.visible = false;
      state.lives -= 1;
    }
  }
  for (const turret of state.turrets) {
    turret.rotation.y += dt * 2;
    const target = state.objects.find((enemy) => !enemy.userData.dead && distance2(turret, enemy) < 4.5);
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

function setupArena() {
  player = makePlayer("sphere");
  state.goal = 5 + selected.variant;
  for (let i = 0; i < state.goal; i++) state.objects.push(spawnCube(i + 75, mats.goal, 1.2));
  for (let i = 0; i < 3 + selected.variant; i++) state.objects.push(spawnCube(i + 140, mats.enemy, 0.8));
}

function updateArena(dt) {
  movePlayer(dt, keys.has(" ") ? 12 : 8);
  for (const obj of state.objects) {
    obj.rotation.y += dt;
    if (obj.material === mats.enemy && distance2(player, obj) < 1) {
      state.lives -= 1;
      obj.position.x *= -1;
    }
    if (obj.material === mats.goal && !obj.userData.dead && distance2(player, obj) < 1.2) {
      obj.userData.dead = true;
      obj.visible = false;
      state.score += 1;
    }
  }
  if (state.score >= state.goal) finish(true, "Zones captured.");
}

function setupFlight() {
  player = makePlayer("ship");
  player.position.y = 3;
  state.goal = 8 + selected.variant;
  for (let i = 0; i < state.goal; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.09, 12, 40), mats.goal);
    ring.rotation.y = Math.PI / 2;
    add(ring, -10 + rand(i + 11) * 20, 2 + rand(i + 5) * 5, -7 - i * 5);
    state.objects.push(ring);
  }
}

function updateFlight(dt) {
  const d = direction();
  player.position.x = clamp(player.position.x + d.x * 9 * dt, -14, 14);
  player.position.y = clamp(player.position.y - d.z * 6 * dt, 1, 8);
  player.position.z -= (keys.has(" ") ? 13 : 7) * dt;
  for (const ring of state.objects) {
    if (!ring.userData.dead && distance2(player, ring) < 1.4 && Math.abs(player.position.y - ring.position.y) < 1.3) {
      ring.userData.dead = true;
      ring.visible = false;
      state.score += 1;
    }
  }
  if (state.score >= state.goal) finish(true, "Flight path cleared.");
  if (player.position.z < -65) state.lives = 0;
}

const setups = {
  Action: setupAction,
  Racing: setupRacing,
  Shooter: setupShooter,
  Platformer: setupPlatformer,
  Sports: setupSports,
  Puzzle: setupPuzzle,
  Survival: setupSurvival,
  Strategy: setupStrategy,
  Arena: setupArena,
  Flight: setupFlight
};

const updates = {
  Action: updateAction,
  Racing: updateRacing,
  Shooter: updateShooter,
  Platformer: updatePlatformer,
  Sports: updateSports,
  Puzzle: updatePuzzle,
  Survival: updateSurvival,
  Strategy: updateStrategy,
  Arena: updateArena,
  Flight: updateFlight
};

function resetGame() {
  floor.material = selected.genre === "Racing" ? mats.road : mats.floor;
  camera.position.set(0, 13, 18);
  clearWorld();
  state = baseState();
  setups[selected.genre]();
  updateHud();
  renderGameList();
  overlay.classList.add("hidden");
}

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
  if (selected.genre === "Flight") {
    camera.position.x += (player.position.x - camera.position.x) * 0.05;
    camera.position.y += (player.position.y + 7 - camera.position.y) * 0.05;
    camera.position.z = player.position.z + 17;
    camera.lookAt(player.position.x, player.position.y, player.position.z - 8);
  } else {
    camera.position.x += (player.position.x * 0.25 - camera.position.x) * 0.04;
    camera.position.z += (player.position.z + 18 - camera.position.z) * 0.04;
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
    button.innerHTML = `<span class="badge">${game.icon}</span><span><strong>${String(game.id).padStart(3, "0")} ${game.title}</strong><small>${game.genre} 3D</small></span><span>${game.variant + 1}/10</span>`;
    button.addEventListener("click", () => {
      selected = game;
      resetGame();
    });
    listEl.appendChild(button);
  }
}

function setupFilters() {
  for (const [name] of genreData) {
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
playFeaturedBtn.addEventListener("click", () => {
  selected = games[1];
  resetGame();
});
randomGameBtn.addEventListener("click", () => {
  selected = games[Math.floor(Math.random() * games.length)];
  resetGame();
});

setupFilters();
resize();
resetGame();
render();
