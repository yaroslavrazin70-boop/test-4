// ============================================================
// Zombie Siege — 2D Shooter
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const healthBar = document.getElementById('healthBar');
const ammoText = document.getElementById('ammoText');
const scoreText = document.getElementById('scoreText');
const waveText = document.getElementById('waveText');
const zombiesLeftText = document.getElementById('zombiesLeft');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const reloadMsg = document.getElementById('reloadMsg');

// ---------- Input ----------
const keys = {};
let mouse = { x: W / 2, y: H / 2, down: false };

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'r') tryReload();
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) * (W / rect.width);
  mouse.y = (e.clientY - rect.top) * (H / rect.height);
});
canvas.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);

// ---------- Game State ----------
let player, bullets, zombies, particles, score, wave, running, spawnQueue, spawnTimer;
let lastShot = 0;
const SHOOT_COOLDOWN = 160; // ms
let playerWalkPhase = 0; // used to animate the player's leg-swing while moving

function resetGame() {
  player = {
    x: W / 2, y: H / 2, r: 14,
    speed: 3.4,
    health: 100, maxHealth: 100,
    ammo: 12, magSize: 12,
    reserve: 48,
    reloading: false,
    reloadTime: 1200,
    reloadStart: 0,
    invuln: 0
  };
  bullets = [];
  zombies = [];
  particles = [];
  score = 0;
  wave = 1;
  running = true;
  spawnTimer = 0;
  startWave(wave);
  updateHUD();
}

function startWave(n) {
  const count = 4 + n * 3;
  spawnQueue = count;
  waveText.textContent = 'Wave ' + n;
}

// ---------- Zombies ----------
function spawnZombie() {
  // spawn just outside the canvas edges
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (edge === 0) { x = -30; y = Math.random() * H; }
  else if (edge === 1) { x = W + 30; y = Math.random() * H; }
  else if (edge === 2) { x = Math.random() * W; y = -30; }
  else { x = Math.random() * W; y = H + 30; }

  const speedVariance = 0.7 + Math.random() * 0.6;
  const isFast = Math.random() < Math.min(0.1 + wave * 0.02, 0.35);
  const isTank = !isFast && Math.random() < Math.min(0.05 + wave * 0.015, 0.25);

  zombies.push({
    x, y,
    r: isTank ? 20 : 13,
    speed: (isFast ? 2.6 : isTank ? 1.0 : 1.6) * speedVariance,
    health: isTank ? 6 : isFast ? 2 : 3,
    maxHealth: isTank ? 6 : isFast ? 2 : 3,
    damage: isTank ? 20 : 10,
    color: isFast ? '#c9ff4a' : isTank ? '#6a3f9e' : '#5aa832',
    hitFlash: 0
  });
}

// ---------- Shooting ----------
function tryReload() {
  if (!player || player.reloading || player.ammo === player.magSize || player.reserve <= 0) return;
  player.reloading = true;
  player.reloadStart = performance.now();
  reloadMsg.classList.remove('hidden');
}

function shoot() {
  if (player.reloading) return;
  const now = performance.now();
  if (now - lastShot < SHOOT_COOLDOWN) return;
  if (player.ammo <= 0) { tryReload(); return; }
  lastShot = now;
  player.ammo--;

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const spread = (Math.random() - 0.5) * 0.05;
  const a = angle + spread;
  bullets.push({
    x: player.x + Math.cos(a) * player.r,
    y: player.y + Math.sin(a) * player.r,
    vx: Math.cos(a) * 11,
    vy: Math.sin(a) * 11,
    life: 60
  });

  // muzzle flash particle
  particles.push({ x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, vx: 0, vy: 0, life: 6, size: 6, color: '#ffdd66' });
  updateHUD();
}

function updateHUD() {
  healthBar.style.width = Math.max(0, player.health / player.maxHealth * 100) + '%';
  ammoText.textContent = `Ammo: ${player.ammo} / ${player.magSize}  (reserve ${player.reserve})`;
  scoreText.textContent = score;
  zombiesLeftText.textContent = zombies.length + spawnQueue;
}

function gameOver() {
  running = false;
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <h1 style="color:#ff5a5a; text-shadow:0 0 20px #700;">YOU DIED</h1>
    <p>Final Score: ${score}</p>
    <p>Survived to Wave ${wave}</p>
    <button id="restartBtn">Try Again</button>
  `;
  document.getElementById('restartBtn').addEventListener('click', () => {
    overlay.classList.add('hidden');
    resetGame();
  });
}

// ---------- Update Loop ----------
function update(dt) {
  if (!running) return;

  // player reload completion
  if (player.reloading && performance.now() - player.reloadStart >= player.reloadTime) {
    const needed = player.magSize - player.ammo;
    const take = Math.min(needed, player.reserve);
    player.ammo += take;
    player.reserve -= take;
    player.reloading = false;
    reloadMsg.classList.add('hidden');
  }

  // player movement
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    player.x += (dx / len) * player.speed;
    player.y += (dy / len) * player.speed;
  }
  player.x = Math.max(player.r, Math.min(W - player.r, player.x));
  player.y = Math.max(player.r, Math.min(H - player.r, player.y));

  if (mouse.down) shoot();

  if (player.invuln > 0) player.invuln -= dt;

  // spawn logic — this is where new zombies enter the map
  spawnTimer -= dt;
  if (spawnQueue > 0 && spawnTimer <= 0) {
    spawnZombie();
    spawnQueue--;
    spawnTimer = Math.max(250, 900 - wave * 30);
  }

  // bullets: move them, check collision with zombies
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life <= 0 || b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) {
      bullets.splice(i, 1);
      continue;
    }
    for (let j = zombies.length - 1; j >= 0; j--) {
      const z = zombies[j];
      if (Math.hypot(b.x - z.x, b.y - z.y) < z.r) {
        z.health--;
        z.hitFlash = 6;
        bullets.splice(i, 1);
        spawnBlood(z.x, z.y);
        if (z.health <= 0) {
          spawnBlood(z.x, z.y, 10);
          zombies.splice(j, 1);
          score += 10;
        }
        break;
      }
    }
  }

  // zombies: chase the player, damage on contact
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    const ang = Math.atan2(player.y - z.y, player.x - z.x);
    z.x += Math.cos(ang) * z.speed;
    z.y += Math.sin(ang) * z.speed;
    if (z.hitFlash > 0) z.hitFlash--;

    const distToPlayer = Math.hypot(player.x - z.x, player.y - z.y);
    if (distToPlayer < player.r + z.r && player.invuln <= 0) {
      player.health -= z.damage;
      player.invuln = 600;
      spawnBlood(player.x, player.y, 8, '#ff5a5a');
      zombies.splice(i, 1);
      if (player.health <= 0) {
        player.health = 0;
        updateHUD();
        gameOver();
        return;
      }
    }
  }

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.life--;
    p.vx *= 0.9; p.vy *= 0.9;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // wave complete -> next wave
  if (spawnQueue === 0 && zombies.length === 0) {
    wave++;
    startWave(wave);
    player.health = Math.min(player.maxHealth, player.health + 15);
    player.reserve += 24;
  }

  updateHUD();
}

function spawnBlood(x, y, count = 5, color = '#8fd94a') {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * 3 + 1;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 20 + Math.random() * 10, size: 2 + Math.random() * 2, color
    });
  }
}

// ---------- Render ----------
function draw() {
  ctx.clearRect(0, 0, W, H);

  // ground grid
  ctx.strokeStyle = 'rgba(60,90,40,0.15)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
  }
  for (let gy = 0; gy < H; gy += 40) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }

  // particles
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / 25);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // bullets
  ctx.fillStyle = '#ffe066';
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // zombies
  zombies.forEach(z => drawZombie(z));

  // player
  if (running) drawPlayer();
}

// ---------- Character Sprites ----------

// Draws a shambling humanoid zombie: legs, torso, arms reaching forward, rotting head.
function drawZombie(z) {
  ctx.save();
  ctx.translate(z.x, z.y);
  const angle = Math.atan2(player.y - z.y, player.x - z.x);
  ctx.rotate(angle);

  const flash = z.hitFlash > 0;
  const skin = flash ? '#ffffff' : z.color;
  const dark = flash ? '#dddddd' : shade(z.color, -35);
  const scale = z.r / 13; // base sprite designed around r=13

  // shambling limb sway
  z.walkPhase = (z.walkPhase || 0) + z.speed * 0.15;
  const swing = Math.sin(z.walkPhase) * 5 * scale;

  // legs
  ctx.strokeStyle = dark;
  ctx.lineWidth = 4 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4 * scale, 2 * scale);
  ctx.lineTo(-8 * scale + swing, 14 * scale);
  ctx.moveTo(4 * scale, 2 * scale);
  ctx.lineTo(8 * scale - swing, 14 * scale);
  ctx.stroke();

  // arms reaching toward player
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3.5 * scale;
  ctx.beginPath();
  ctx.moveTo(0, -2 * scale);
  ctx.lineTo(14 * scale, -4 * scale + swing * 0.4);
  ctx.moveTo(0, -2 * scale);
  ctx.lineTo(12 * scale, 6 * scale - swing * 0.4);
  ctx.stroke();

  // torso
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 0, z.r * 0.75, z.r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // torn clothing streaks
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-4 * scale, -4 * scale); ctx.lineTo(-2 * scale, 4 * scale);
  ctx.moveTo(3 * scale, -3 * scale); ctx.lineTo(5 * scale, 5 * scale);
  ctx.stroke();

  // head
  ctx.fillStyle = flash ? '#ffffff' : shade(z.color, 15);
  ctx.beginPath();
  ctx.arc(z.r * 0.55, 0, z.r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.stroke();

  // glowing dead eyes
  ctx.fillStyle = '#ff2b2b';
  ctx.beginPath();
  ctx.arc(z.r * 0.75, -z.r * 0.18, 1.6 * scale, 0, Math.PI * 2);
  ctx.arc(z.r * 0.75, z.r * 0.18, 1.6 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // health bar above zombie (screen-space, not rotated)
  const w = z.r * 2;
  ctx.fillStyle = '#300';
  ctx.fillRect(z.x - w / 2, z.y - z.r - 12, w, 4);
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(z.x - w / 2, z.y - z.r - 12, w * (z.health / z.maxHealth), 4);
}

// Draws the player character: legs, torso, head, and a held rifle aimed at the mouse.
function drawPlayer() {
  ctx.save();
  if (player.invuln > 0 && Math.floor(player.invuln / 100) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

  // walk-cycle based on movement keys
  const moving = keys['w'] || keys['a'] || keys['s'] || keys['d'] ||
                 keys['arrowup'] || keys['arrowleft'] || keys['arrowdown'] || keys['arrowright'];
  playerWalkPhase = (playerWalkPhase || 0) + (moving ? player.speed * 0.18 : 0);
  const legSwing = Math.sin(playerWalkPhase) * 6;

  ctx.translate(player.x, player.y);

  // legs (drawn in world orientation, not rotated with aim, for a top-down feel)
  ctx.strokeStyle = '#1c2b45';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 2); ctx.lineTo(-4 + legSwing * 0.3, 16);
  ctx.moveTo(4, 2); ctx.lineTo(4 - legSwing * 0.3, 16);
  ctx.stroke();

  // body + gun rotate to face the mouse
  ctx.save();
  ctx.rotate(angle);

  // gun (drawn first so torso overlaps the grip)
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(6, -3, 24, 6);
  ctx.fillStyle = '#111';
  ctx.fillRect(26, -4.5, 6, 3); // barrel tip / sight

  // torso
  ctx.fillStyle = '#3f7fd1';
  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#dff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // shoulder/vest detail
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, player.r * 0.6, -0.6, 0.6);
  ctx.stroke();

  // head (small circle offset toward facing direction)
  ctx.fillStyle = '#f2c79a';
  ctx.beginPath();
  ctx.arc(3, 0, player.r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore(); // undo rotation
  ctx.restore(); // undo translate/alpha
}

// Utility: lighten/darken a hex color by `percent` (-100..100)
function shade(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000FF) + Math.round(255 * (percent / 100));
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

// ---------- Main Loop ----------
let lastTime = performance.now();
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  if (running) update(dt);
  draw();
  requestAnimationFrame(loop);
}

startBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
  resetGame();
});

requestAnimationFrame(loop);
