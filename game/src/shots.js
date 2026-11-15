// The screenshot scenes behind ?shot=title|play|draft|victory. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot (keep away from the nearest enemy,
// fire at it, dash out of a crowd, grab a heart when hurt), so the frame is
// what a real game looks like and the same seed always gives the same frame.
import { FIELD, LAST_WAVE, STEP } from './config.js';
import { EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import { SCREEN_DRAFT, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { victoryBuild } from './upgrades.js';

const TITLE_HOLD_SECONDS = 5;
const PLAY_HOLD_SECONDS = 8;
const PLAY_WAVE = 8;
const DRAFT_WAVE = 3;
const LIMIT_SECONDS = 1500;

/** The autopilot's pick: the strongest card it is offered, by a fixed order. */
const PICK_ORDER = ['split', 'heavy', 'rapid', 'pierce', 'nova', 'crit', 'heart', 'swift', 'magnet', 'dash'];

function nearestEnemy(state) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return { enemy: best, dist: Math.sqrt(bestDist) };
}

function autopilot(state) {
  const player = state.player;
  const { enemy, dist } = nearestEnemy(state);
  let mx = 0;
  let my = 0;
  let dash = false;
  let aimX = player.x;
  let aimY = player.y - 100;
  if (enemy) {
    aimX = enemy.x;
    aimY = enemy.y;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.max(1, dist);
    // Too close: back away. Far away: close in. In between: strafe.
    if (d < 150) {
      mx = dx / d;
      my = dy / d;
    } else if (d > 360) {
      mx = -dx / d;
      my = -dy / d;
    } else {
      mx = (-dy / d) * 0.7;
      my = (dx / d) * 0.7;
    }
    // Push away from every other enemy crowding in.
    for (const other of state.enemies) {
      if (other === enemy) continue;
      const ox = player.x - other.x;
      const oy = player.y - other.y;
      const od = Math.hypot(ox, oy) || 1;
      if (od < 150) {
        const w = (150 - od) / 150;
        mx += (ox / od) * w;
        my += (oy / od) * w;
      }
    }
    // A heart when hurt is worth the walk.
    if (player.hp < player.maxHp * 0.6) {
      for (const pickup of state.pickups) {
        if (pickup.kind !== 'heart') continue;
        const px = pickup.x - player.x;
        const py = pickup.y - player.y;
        const pd = Math.hypot(px, py) || 1;
        if (pd < 320) {
          mx += (px / pd) * 1.2;
          my += (py / pd) * 1.2;
        }
      }
    }
    if (d < 85) dash = true;
  }
  // Never hug the walls: drift back toward the middle.
  if (player.x < 90) mx += 0.8;
  if (player.x > FIELD.width - 90) mx -= 0.8;
  if (player.y < 90) my += 0.8;
  if (player.y > FIELD.height - 90) my -= 0.8;
  const len = Math.hypot(mx, my) || 1;
  return { moveX: mx / len, moveY: my / len, firing: enemy !== null, aimX, aimY, dash };
}

function pickDraft(world) {
  const draft = world.state.draft || [];
  for (const id of PICK_ORDER) {
    if (draft.some((card) => card.id === id)) {
      world.applyPick(id);
      return;
    }
  }
  if (draft.length > 0) world.applyPick(draft[0].id);
}

/**
 * Set `world` to the named scene (title, play, draft or victory; any other
 * name is title) and return the screen to draw over it and the best score
 * to show. `fx` steps alongside the world so particles settle in the frame.
 */
export function stageShot(name, world, fx) {
  world.start();
  if (name === 'victory') world.loadVictoryBuild(victoryBuild());
  let wave5At = null;
  let titleAt = null;
  const limit = LIMIT_SECONDS / STEP;
  for (let i = 0; i < limit; i += 1) {
    const events = world.step(STEP, autopilot(world.state));
    fx.step(STEP);
    if (events & EVENT_OVER) {
      return { screen: SCREEN_OVER, best: world.state.score };
    }
    if (events & EVENT_VICTORY) {
      return { screen: SCREEN_VICTORY, best: world.state.score };
    }
    if (events & EVENT_WAVE_CLEAR) {
      if (name === 'draft' && world.state.wave === DRAFT_WAVE) {
        return { screen: SCREEN_DRAFT, best: world.state.score };
      }
      pickDraft(world);
      continue;
    }
    if (name === 'title') {
      // Play into wave 3, then hold the frame: the title shows a busy arena.
      if (world.state.wave >= 3) {
        if (titleAt === null) titleAt = world.state.time;
        if (world.state.time - titleAt >= TITLE_HOLD_SECONDS) {
          return { screen: SCREEN_TITLE, best: 0 };
        }
      }
      continue;
    }
    if (name === 'play') {
      // Eight seconds into wave 8: mid-combat, the wave at full strength.
      if (world.state.wave >= PLAY_WAVE) {
        if (wave5At === null) wave5At = world.state.time;
        if (world.state.time - wave5At >= PLAY_HOLD_SECONDS) {
          return { screen: SCREEN_PLAY, best: world.state.score };
        }
      }
      continue;
    }
    if (name === 'draft' && world.state.wave > DRAFT_WAVE) {
      return { screen: SCREEN_DRAFT, best: world.state.score };
    }
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
