// What each wave throws at the player, and how the two bosses behave.
// A wave's spawn list is built from a point budget: cheap motes early, then
// wisps and spitters, brutes from wave 3, elites from wave 4, a boss on
// waves 6 and 12. The list is shuffled with the run's seeded random, so the
// same seed always gives the same wave.
import { BOSS_WAVES, BOSSES, ELITE, ENEMIES, LAST_WAVE } from './config.js';

/** The enemy kinds a wave may hold, by wave number. */
function kindsFor(wave) {
  const kinds = ['mote'];
  if (wave >= 2) kinds.push('wisp');
  if (wave >= 3) kinds.push('spitter', 'brute');
  return kinds;
}

/**
 * Build one wave's spawn queue: entries of { kind, elite, delay } where
 * delay is the seconds after the previous spawn. Boss waves hold the boss
 * first, then a trickle of adds while it lives.
 */
export function buildWave(wave, random) {
  const queue = [];
  if (BOSS_WAVES.includes(wave)) {
    const boss = wave === LAST_WAVE ? 'sovereign' : 'warden';
    queue.push({ kind: boss, elite: false, delay: 1.2, boss: true });
    const adds = wave === LAST_WAVE ? 13 : 10;
    for (let i = 0; i < adds; i += 1) {
      const kind = i % 3 === 0 ? 'wisp' : 'mote';
      queue.push({ kind, elite: false, delay: 3 + random() * 3, boss: false });
    }
    return queue;
  }
  // +25% spawn budget over the original (8 + wave*5 vs 6 + wave*4): density
  // is the cheap difficulty lever — enemy HP is NOT raised to compensate.
  let budget = 8 + wave * 5;
  const kinds = kindsFor(wave);
  const picks = [];
  while (budget > 0) {
    const kind = kinds[Math.floor(random() * kinds.length)];
    const cost = ENEMIES[kind].cost;
    if (cost > budget && picks.length > 0) break;
    picks.push(kind);
    budget -= cost;
  }
  // Shuffle the picks so the wave never arrives in kind order.
  for (let i = picks.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  const interval = Math.max(0.5, 1.35 - wave * 0.09);
  // From wave 5, every third spawn arrives together with the previous one:
  // the wave lands in small clusters instead of a thin trickle, so several
  // enemies are on screen at once instead of one at a time. Total count is
  // unchanged (the budget above); only the pacing is denser.
  const clusterEvery = wave >= 5 ? 3 : 0;
  picks.forEach((kind, index) => {
    const clustered = clusterEvery > 0 && index > 0 && index % clusterEvery === 0;
    queue.push({ kind, elite: false, delay: index === 0 ? 0.8 : clustered ? 0 : interval * (0.7 + random() * 0.6), boss: false });
  });
  const elites = wave >= 8 ? 2 : wave >= 4 ? 1 : 0;
  for (let i = 0; i < elites; i += 1) {
    const kind = wave >= 5 ? 'brute' : 'spitter';
    queue.splice(2 + i * 4, 0, { kind, elite: true, delay: 2.5, boss: false });
  }
  return queue;
}

/** Stats for one spawned enemy, scaled by its wave. */
export function enemyStats(kind, wave, elite, boss) {
  if (boss) {
    const base = BOSSES[kind];
    return {
      name: base.name,
      radius: base.radius,
      speed: base.speed,
      hp: base.hp,
      maxHp: base.hp,
      score: base.score,
      damage: base.damage,
      color: base.color,
      boss: true,
    };
  }
  const base = ENEMIES[kind];
  const hpMul = (1 + 0.18 * (wave - 1)) * (elite ? ELITE.hpMul : 1);
  return {
    name: elite ? `Elite ${kind}` : kind,
    radius: base.radius * (elite ? ELITE.radiusMul : 1),
    speed: base.speed * (1 + 0.02 * (wave - 1)) * (elite ? ELITE.speedMul : 1),
    hp: Math.round(base.hp * hpMul),
    maxHp: Math.round(base.hp * hpMul),
    score: base.score * (elite ? ELITE.scoreMul : 1),
    damage: base.damage,
    color: elite ? '#facc15' : base.color,
    boss: false,
  };
}
