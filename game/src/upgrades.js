// The upgrade draft: between waves the player picks one of three cards.
// Each upgrade stacks to its cap; a maxed one leaves the pool. The draft
// is drawn with the run's seeded random, so the same seed always offers the
// same cards, and applying a pick mutates only the player's build.
import { UPGRADES } from './config.js';

/** A fresh build: every upgrade at level 0. */
export function createBuild() {
  const levels = {};
  for (const upgrade of UPGRADES) levels[upgrade.id] = 0;
  return levels;
}

/** Three distinct upgrades that still have room to grow. */
export function drawDraft(build, random) {
  const pool = UPGRADES.filter((upgrade) => build[upgrade.id] < upgrade.max);
  const draft = [];
  while (draft.length < 3 && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    draft.push(pool.splice(index, 1)[0]);
  }
  return draft;
}

/** Apply one pick to the build. Returns the new level of that upgrade. */
export function applyUpgrade(build, id) {
  const upgrade = UPGRADES.find((entry) => entry.id === id);
  if (!upgrade || build[id] >= upgrade.max) return build[id] ?? 0;
  build[id] += 1;
  return build[id];
}

/** Derived player stats from the build's levels. */
export function buildStats(build) {
  return {
    shots: 1 + build.split,
    fireIntervalMul: Math.pow(0.85, build.rapid),
    damageMul: 1 + 0.3 * build.heavy,
    pierce: build.pierce,
    speedMul: 1 + 0.12 * build.swift,
    maxHpBonus: 25 * build.heart,
    novaLevel: build.nova,
    critChance: 0.12 * build.crit,
    pickupMul: 1 + 0.6 * build.magnet,
    dashCooldownMul: Math.pow(0.75, build.dash),
    dashEmbers: build.dash > 0,
  };
}

/** The strongest honest loadout, used only to stage the victory screenshot. */
export function victoryBuild() {
  const build = createBuild();
  build.split = 3;
  build.rapid = 5;
  build.heavy = 5;
  build.pierce = 3;
  build.swift = 3;
  build.heart = 3;
  build.nova = 3;
  build.crit = 4;
  build.magnet = 2;
  build.dash = 2;
  return build;
}
