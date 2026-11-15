// Juice: particles, floating damage numbers, screen shake and hit-stop.
// Everything here is visual only — it never changes the simulation, so a
// replay of the same seed paints the same frame.
import { POOLS } from './config.js';

export function createEffects(random) {
  const particles = [];
  const texts = [];
  let shake = 0;
  let hitStop = 0;
  let flash = 0;

  function spawnParticle(x, y, vx, vy, life, size, color) {
    if (particles.length >= POOLS.particles) particles.shift();
    particles.push({ x, y, vx, vy, life, maxLife: life, size, color });
  }

  return {
    /** A burst of sparks, as when a bolt hits or an enemy dies. */
    burst(x, y, color, count, speed = 260) {
      for (let i = 0; i < count; i += 1) {
        const angle = random() * Math.PI * 2;
        const v = speed * (0.3 + random() * 0.7);
        spawnParticle(x, y, Math.cos(angle) * v, Math.sin(angle) * v, 0.35 + random() * 0.35, 2 + random() * 3, color);
      }
    },
    /** A ring of embers, as the nova upgrade fires. */
    ring(x, y, color, count) {
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        spawnParticle(x, y, Math.cos(angle) * 320, Math.sin(angle) * 320, 0.5, 3, color);
      }
    },
    /** Muzzle sparks at the player's gun. */
    muzzle(x, y, angle) {
      for (let i = 0; i < 3; i += 1) {
        const a = angle + (random() - 0.5) * 0.5;
        const v = 300 + random() * 160;
        spawnParticle(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.12 + random() * 0.1, 2, '#ffd166');
      }
    },
    /** A number that floats up and fades: damage, score, healing. */
    text(x, y, value, color, big = false) {
      if (texts.length >= POOLS.texts) texts.shift();
      texts.push({ x, y, value: String(value), color, life: 0.9, big });
    },
    /** A shake that decays over a few frames. */
    addShake(amount) {
      shake = Math.min(18, shake + amount);
    },
    /** Freeze the simulation briefly: the punch of a big kill. */
    addHitStop(seconds) {
      hitStop = Math.max(hitStop, seconds);
    },
    /** A red flash over the whole screen when the player is hurt. */
    addFlash(amount) {
      flash = Math.min(0.55, flash + amount);
    },
    get hitStopLeft() {
      return hitStop;
    },
    get flashLeft() {
      return flash;
    },
    step(dt) {
      if (hitStop > 0) hitStop -= dt;
      if (flash > 0) flash -= dt * 1.6;
      shake = Math.max(0, shake - dt * 40);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.life -= dt;
        t.y -= 42 * dt;
        if (t.life <= 0) texts.splice(i, 1);
      }
    },
    /** The current shake offset, from the same seeded random. */
    shakeOffset() {
      if (shake <= 0.2) return { x: 0, y: 0 };
      return { x: (random() - 0.5) * shake, y: (random() - 0.5) * shake };
    },
    get particles() {
      return particles;
    },
    get texts() {
      return texts;
    },
  };
}
