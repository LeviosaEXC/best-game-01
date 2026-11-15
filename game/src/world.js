// The simulation: one fixed 1/60 s step moves the player, the enemies, the
// bullets and the pickups, and nothing in it reads the wall clock or the
// screen — the same seed and the same inputs always give the same game.
// Rendering, sound and particles are notified, never consulted.
import {
  BOSSES, BOSS_WAVES, COMBO_MAX, COMBO_STEP, COMBO_WINDOW, ENEMIES, ENEMY_BULLET,
  FIELD, LAST_WAVE, PICKUPS, PLAYER, POOLS, STEP,
} from './config.js';
import { buildWave, enemyStats } from './enemies.js';
import { applyUpgrade, buildStats, createBuild, drawDraft } from './upgrades.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_OVER = 8;
export const EVENT_VICTORY = 16;
export const EVENT_BOSS = 32;
export const EVENT_PICKUP = 64;

function spawnPoint(random, player) {
  for (let tries = 0; tries < 12; tries += 1) {
    const edge = Math.floor(random() * 4);
    const x = edge === 0 ? 30 + random() * 80 : edge === 1 ? FIELD.width - 30 - random() * 80 : random() * FIELD.width;
    const y = edge === 2 ? 30 + random() * 80 : edge === 3 ? FIELD.height - 30 - random() * 80 : random() * FIELD.height;
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx * dx + dy * dy > 240 * 240) return { x, y };
  }
  return { x: 60, y: 60 };
}

export function createWorld(random, fx, audio) {
  const state = {
    time: 0,
    wave: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageDealt: 0,
    player: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    spawnQueue: [],
    spawnTimer: 0,
    boss: null,
    bossTimer: 0,
    novaTimer: 6,
    draft: null,
    banner: null,
    over: false,
    victory: false,
    build: createBuild(),
    stats: null,
  };
  state.stats = buildStats(state.build);

  function resetPlayer() {
    state.player = {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      aim: -Math.PI / 2,
      fireTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashX: 0,
      dashY: 0,
      invuln: 0,
      moving: false,
    };
  }

  function addEnemy(kind, elite, boss, at) {
    if (state.enemies.length >= POOLS.enemies) return null;
    const stats = enemyStats(kind, state.wave, elite, boss);
    const enemy = {
      kind,
      elite,
      boss,
      name: stats.name,
      x: at.x,
      y: at.y,
      radius: stats.radius,
      speed: stats.speed,
      hp: stats.hp,
      maxHp: stats.maxHp,
      score: stats.score,
      damage: stats.damage,
      color: stats.color,
      phase: random() * Math.PI * 2,
      shootTimer: 1.5 + random() * 1.5,
      summonTimer: 5,
      burstTimer: 4,
      teleportTimer: 9,
      spiralAngle: 0,
      flash: 0,
      knockX: 0,
      knockY: 0,
    };
    state.enemies.push(enemy);
    if (boss) {
      state.boss = enemy;
      state.bossTimer = 0;
    }
    return enemy;
  }

  function fireEnemyBullet(x, y, angle, speed = ENEMY_BULLET.speed) {
    if (state.enemyBullets.length >= POOLS.enemyBullets) return;
    state.enemyBullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: ENEMY_BULLET.radius,
      damage: ENEMY_BULLET.damage,
    });
  }

  function dropPickup(x, y, kind) {
    if (state.pickups.length >= POOLS.pickups) return;
    state.pickups.push({ x, y, kind, vx: 0, vy: 0, life: 14 });
  }

  function killEnemy(index, award) {
    const enemy = state.enemies[index];
    state.enemies.splice(index, 1);
    state.kills += 1;
    if (enemy.boss) state.boss = null;
    if (award) {
      const mult = 1 + Math.min(state.combo, 40) * COMBO_STEP;
      const gained = Math.round(enemy.score * Math.min(mult, COMBO_MAX));
      state.score += gained;
      state.combo += 1;
      state.comboTimer = COMBO_WINDOW;
      fx.text(enemy.x, enemy.y - enemy.radius, `+${gained}`, '#ffd166', enemy.boss);
      fx.burst(enemy.x, enemy.y, enemy.color, enemy.boss ? 46 : 18, enemy.boss ? 420 : 280);
      if (enemy.boss) {
        fx.addShake(14);
        fx.addHitStop(0.09);
      } else if (enemy.kind === 'brute' || enemy.elite) {
        fx.addHitStop(0.03);
      }
      audio.kill();
      const shards = enemy.boss ? 8 : enemy.elite ? 3 : random() < 0.6 ? 1 : 0;
      for (let i = 0; i < shards; i += 1) {
        dropPickup(enemy.x + (random() - 0.5) * 36, enemy.y + (random() - 0.5) * 36, 'shard');
      }
      if (enemy.boss || enemy.elite || random() < 0.05) dropPickup(enemy.x, enemy.y, 'heart');
    }
    return enemy;
  }

  function hurtPlayer(damage, fromX, fromY) {
    const player = state.player;
    if (player.invuln > 0 || player.dashTimer > 0 || state.over) return EVENT_NONE;
    player.hp -= damage;
    player.invuln = 0.9;
    fx.addFlash(0.4);
    fx.addShake(9);
    fx.burst(player.x, player.y, '#ef4444', 14, 300);
    audio.hurt();
    if (player.hp <= 0) {
      player.hp = 0;
      state.over = true;
      fx.burst(player.x, player.y, '#ffb347', 60, 420);
      fx.addShake(16);
      audio.gameover();
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = buildWave(wave, random);
    state.spawnTimer = 0;
    state.novaTimer = 6;
    const bossWave = BOSS_WAVES.includes(wave);
    state.banner = {
      text: bossWave ? `${BOSSES[wave === LAST_WAVE ? 'sovereign' : 'warden'].name} — Wave ${wave}` : `Wave ${wave}`,
      sub: bossWave ? 'A boss stirs in the dark' : wave === LAST_WAVE ? 'The last wave' : `${state.spawnQueue.length} enemies approach`,
      timer: 2.4,
    };
    if (bossWave) audio.boss();
    else audio.horn();
  }

  function firePlayerBullets() {
    const player = state.player;
    const stats = state.stats;
    const spread = 0.09;
    const count = stats.shots;
    for (let i = 0; i < count; i += 1) {
      if (state.bullets.length >= POOLS.bullets) break;
      const offset = (i - (count - 1) / 2) * spread;
      const angle = player.aim + offset;
      state.bullets.push({
        x: player.x + Math.cos(angle) * (PLAYER.radius + 8),
        y: player.y + Math.sin(angle) * (PLAYER.radius + 8),
        vx: Math.cos(angle) * PLAYER.bulletSpeed,
        vy: Math.sin(angle) * PLAYER.bulletSpeed,
        radius: PLAYER.bulletRadius,
        damage: PLAYER.bulletDamage * stats.damageMul,
        pierce: stats.pierce,
      });
    }
    state.shotsFired += 1;
    fx.muzzle(player.x + Math.cos(player.aim) * (PLAYER.radius + 8), player.y + Math.sin(player.aim) * (PLAYER.radius + 8), player.aim);
    audio.shoot();
  }

  function fireNova() {
    const player = state.player;
    const count = 12 + 4 * state.stats.novaLevel;
    for (let i = 0; i < count; i += 1) {
      if (state.bullets.length >= POOLS.bullets) break;
      const angle = (i / count) * Math.PI * 2;
      state.bullets.push({
        x: player.x, y: player.y,
        vx: Math.cos(angle) * PLAYER.bulletSpeed * 0.85,
        vy: Math.sin(angle) * PLAYER.bulletSpeed * 0.85,
        radius: PLAYER.bulletRadius,
        damage: PLAYER.bulletDamage * state.stats.damageMul,
        pierce: 1,
      });
    }
    fx.ring(player.x, player.y, '#ffd166', count);
    audio.nova();
  }

  function stepPlayer(dt, input) {
    const player = state.player;
    const stats = state.stats;
    player.aim = Math.atan2(input.aimY - player.y, input.aimX - player.x);
    if (player.invuln > 0) player.invuln -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (input.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      const dir = input.moveX !== 0 || input.moveY !== 0
        ? { x: input.moveX, y: input.moveY }
        : { x: Math.cos(player.aim), y: Math.sin(player.aim) };
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown * stats.dashCooldownMul;
      player.dashX = dir.x;
      player.dashY = dir.y;
      player.invuln = Math.max(player.invuln, PLAYER.invulnerable);
      audio.dash();
      if (stats.dashEmbers) fireNova();
    }
    let vx;
    let vy;
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      vx = player.dashX * PLAYER.dashSpeed;
      vy = player.dashY * PLAYER.dashSpeed;
    } else {
      const speed = PLAYER.speed * stats.speedMul;
      vx = input.moveX * speed;
      vy = input.moveY * speed;
    }
    player.moving = vx !== 0 || vy !== 0;
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + vx * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + vy * dt));
    if (input.firing) {
      player.fireTimer -= dt;
      while (player.fireTimer <= 0) {
        firePlayerBullets();
        player.fireTimer += PLAYER.fireInterval * stats.fireIntervalMul;
      }
    } else {
      player.fireTimer = Math.min(player.fireTimer, 0);
    }
    if (stats.novaLevel > 0) {
      state.novaTimer -= dt;
      if (state.novaTimer <= 0) {
        fireNova();
        state.novaTimer = 6;
      }
    }
  }

  function stepEnemies(dt) {
    const player = state.player;
    for (const enemy of state.enemies) {
      if (enemy.flash > 0) enemy.flash -= dt;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      let mx = nx;
      let my = ny;
      if (enemy.kind === 'wisp') {
        const wobble = Math.sin(state.time * 6 + enemy.phase) * 0.8;
        mx = nx - ny * wobble;
        my = ny + nx * wobble;
      } else if (enemy.kind === 'spitter') {
        if (dist < 280) {
          mx = -nx;
          my = -ny;
        } else if (dist < 380) {
          mx = -ny;
          my = nx;
        }
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && dist < 560) {
          fireEnemyBullet(enemy.x, enemy.y, Math.atan2(dy, dx));
          enemy.shootTimer = 2.2;
          fx.burst(enemy.x, enemy.y, enemy.color, 4, 120);
        }
      } else if (enemy.boss) {
        const bossDef = BOSSES[enemy.kind];
        const enraged = enemy.hp < enemy.maxHp * 0.5;
        enemy.summonTimer -= dt;
        enemy.burstTimer -= dt;
        if (enemy.summonTimer <= 0) {
          const kind = enemy.kind === 'sovereign' ? 'wisp' : 'mote';
          for (let i = 0; i < 3; i += 1) {
            const at = spawnPoint(random, player);
            addEnemy(kind, false, false, at);
          }
          enemy.summonTimer = bossDef.summonEvery;
          fx.burst(enemy.x, enemy.y, enemy.color, 20, 200);
        }
        if (enemy.burstTimer <= 0) {
          if (enemy.kind === 'sovereign') {
            for (let i = 0; i < 3; i += 1) {
              enemy.spiralAngle += 0.7;
              fireEnemyBullet(enemy.x, enemy.y, enemy.spiralAngle + (i * Math.PI * 2) / 3, 230);
            }
            enemy.burstTimer = 0.55;
          } else {
            for (let i = 0; i < 10; i += 1) fireEnemyBullet(enemy.x, enemy.y, (i / 10) * Math.PI * 2, 210);
            enemy.burstTimer = bossDef.burstEvery;
          }
        }
        if (enemy.kind === 'sovereign') {
          enemy.teleportTimer -= dt;
          if (enemy.teleportTimer <= 0) {
            const angle = random() * Math.PI * 2;
            const r = 260 + random() * 140;
            enemy.x = Math.min(FIELD.width - 60, Math.max(60, player.x + Math.cos(angle) * r));
            enemy.y = Math.min(FIELD.height - 60, Math.max(60, player.y + Math.sin(angle) * r));
            fx.burst(enemy.x, enemy.y, enemy.color, 24, 300);
            enemy.teleportTimer = 9;
          }
          const orbit = enraged ? 1.4 : 1;
          mx = -ny * orbit;
          my = nx * orbit;
        }
        if (enraged) {
          mx *= 1.4;
          my *= 1.4;
        }
      }
      enemy.x += (mx * enemy.speed + enemy.knockX) * dt;
      enemy.y += (my * enemy.speed + enemy.knockY) * dt;
      enemy.knockX *= 0.86;
      enemy.knockY *= 0.86;
      enemy.x = Math.min(FIELD.width - enemy.radius, Math.max(enemy.radius, enemy.x));
      enemy.y = Math.min(FIELD.height - enemy.radius, Math.max(enemy.radius, enemy.y));
    }
    // Enemies push apart so they never stack on one point.
    for (let i = 0; i < state.enemies.length; i += 1) {
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const a = state.enemies[i];
        const b = state.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (dist > 0 && dist < min) {
          const push = ((min - dist) / 2) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  function stepBullets(dt) {
    const player = state.player;
    let events = EVENT_NONE;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      let dead = bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = state.enemies[j];
          const dx = enemy.x - bullet.x;
          const dy = enemy.y - bullet.y;
          const rr = enemy.radius + bullet.radius;
          if (dx * dx + dy * dy > rr * rr) continue;
          const crit = random() < state.stats.critChance;
          const damage = Math.round(bullet.damage * (crit ? 2 : 1));
          enemy.hp -= damage;
          enemy.flash = 0.08;
          state.damageDealt += damage;
          state.shotsHit += 1;
          const kb = enemy.boss ? 0 : enemy.kind === 'brute' ? 12 : 60;
          enemy.knockX += (bullet.vx / PLAYER.bulletSpeed) * kb;
          enemy.knockY += (bullet.vy / PLAYER.bulletSpeed) * kb;
          fx.text(enemy.x, enemy.y - enemy.radius - 6, damage, crit ? '#facc15' : '#ffffff', crit);
          fx.burst(bullet.x, bullet.y, '#ffd166', 3, 140);
          audio.hit();
          if (enemy.hp <= 0) {
            killEnemy(j, true);
            events |= EVENT_KILL;
          }
          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.enemyBullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      const dx = player.x - bullet.x;
      const dy = player.y - bullet.y;
      const rr = PLAYER.radius + bullet.radius;
      let dead = bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20;
      if (!dead && dx * dx + dy * dy < rr * rr) {
        events |= hurtPlayer(bullet.damage, bullet.x, bullet.y);
        dead = true;
      }
      if (dead) state.enemyBullets.splice(i, 1);
    }
    return events;
  }

  function stepPickups(dt) {
    const player = state.player;
    const radius = PLAYER.pickupRadius * state.stats.pickupMul;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      pickup.life -= dt;
      if (pickup.life <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      const dx = player.x - pickup.x;
      const dy = player.y - pickup.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < radius) {
        const pull = 520 * (1 - dist / radius) + 120;
        pickup.vx += (dx / dist) * pull * dt * 8;
        pickup.vy += (dy / dist) * pull * dt * 8;
      }
      pickup.vx *= 0.92;
      pickup.vy *= 0.92;
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      if (dist < PLAYER.radius + PICKUPS[pickup.kind].radius + 4) {
        if (pickup.kind === 'shard') {
          state.score += PICKUPS.shard.score;
          fx.text(pickup.x, pickup.y - 10, `+${PICKUPS.shard.score}`, '#ffd166');
        } else {
          player.hp = Math.min(player.maxHp, player.hp + PICKUPS.heart.heal);
          fx.text(pickup.x, pickup.y - 10, `+${PICKUPS.heart.heal}`, '#4ade80');
          audio.heart();
        }
        audio.pickup();
        state.pickups.splice(i, 1);
      }
    }
  }

  function stepSpawns(dt) {
    if (state.spawnQueue.length === 0) return;
    state.spawnTimer -= dt;
    if (state.spawnTimer > 0) return;
    const next = state.spawnQueue.shift();
    const at = next.boss ? { x: FIELD.width / 2, y: 90 } : spawnPoint(random, state.player);
    addEnemy(next.kind, next.elite, next.boss, at);
    if (next.boss) fx.addShake(8);
    state.spawnTimer = next.delay;
  }

  return {
    state,
    reset() {
      state.time = 0;
      state.wave = 0;
      state.score = 0;
      state.combo = 0;
      state.comboTimer = 0;
      state.kills = 0;
      state.shotsFired = 0;
      state.shotsHit = 0;
      state.damageDealt = 0;
      state.enemies = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.pickups = [];
      state.spawnQueue = [];
      state.spawnTimer = 0;
      state.boss = null;
      state.novaTimer = 6;
      state.draft = null;
      state.banner = null;
      state.over = false;
      state.victory = false;
      state.build = createBuild();
      state.stats = buildStats(state.build);
      resetPlayer();
    },
    /** Start wave 1 from a fresh world. */
    start() {
      this.reset();
      startWave(1);
    },
    /** Offer the draft after a cleared wave; the caller picks, then calls nextWave. */
    offerDraft() {
      state.draft = drawDraft(state.build, random);
      return state.draft;
    },
    /** Apply a draft pick and start the next wave. Returns the new level. */
    applyPick(id) {
      const level = applyUpgrade(state.build, id);
      state.stats = buildStats(state.build);
      if (id === 'heart') {
        state.player.maxHp = PLAYER.maxHp + state.stats.maxHpBonus;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
      } else {
        state.player.maxHp = PLAYER.maxHp + state.stats.maxHpBonus;
      }
      state.draft = null;
      startWave(state.wave + 1);
      return level;
    },
    /** Load the strong victory loadout (screenshot staging only). */
    loadVictoryBuild(build) {
      state.build = build;
      state.stats = buildStats(build);
      state.player.maxHp = PLAYER.maxHp + state.stats.maxHpBonus;
      state.player.hp = state.player.maxHp;
    },
    step(dt, input) {
      if (state.over || state.victory) return EVENT_NONE;
      let events = EVENT_NONE;
      state.time += dt;
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 0;
      }
      if (state.banner && state.banner.timer > 0) state.banner.timer -= dt;
      stepPlayer(dt, input);
      if (state.over) return EVENT_OVER;
      stepEnemies(dt);
      events |= stepBullets(dt);
      if (state.over) return events | EVENT_OVER;
      // Contact damage: touching an enemy hurts.
      const player = state.player;
      for (const enemy of state.enemies) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const rr = PLAYER.radius + enemy.radius;
        if (dx * dx + dy * dy < rr * rr) {
          events |= hurtPlayer(enemy.damage, enemy.x, enemy.y);
          if (state.over) return events | EVENT_OVER;
          break;
        }
      }
      stepPickups(dt);
      stepSpawns(dt);
      if (state.spawnQueue.length === 0 && state.enemies.length === 0 && state.boss === null && !state.over) {
        if (state.wave >= LAST_WAVE) {
          state.victory = true;
          audio.victory();
          return events | EVENT_VICTORY;
        }
        state.draft = drawDraft(state.build, random);
        if (state.draft.length === 0) {
          // Every upgrade is maxed: no draft to offer, so the next wave starts at once.
          startWave(state.wave + 1);
          return events;
        }
        return events | EVENT_WAVE_CLEAR;
      }
      return events;
    },
  };
}
