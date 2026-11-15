// CINDERFALL — every tuning number, colour and upgrade in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Waves in one run; wave 6 and wave 12 are boss waves, wave 12 ends in victory. */
export const LAST_WAVE = 12;
export const BOSS_WAVES = [6, 12];

/** Seconds a kill keeps the combo alive; each kill inside it raises the multiplier. */
export const COMBO_WINDOW = 3;
export const COMBO_STEP = 0.05;
export const COMBO_MAX = 3;

export const PLAYER = {
  radius: 16,
  speed: 300,
  maxHp: 100,
  fireInterval: 0.22,
  bulletSpeed: 640,
  bulletDamage: 12,
  bulletRadius: 5,
  /** Dash: a short burst with invulnerability, then a cooldown. */
  dashSpeed: 920,
  dashTime: 0.16,
  dashCooldown: 2.2,
  invulnerable: 0.25,
  pickupRadius: 90,
};

/** Enemy kinds. hp and speed scale with the wave; score is the base kill value. */
export const ENEMIES = {
  mote: { radius: 13, speed: 150, hp: 18, score: 10, damage: 8, cost: 1, color: '#ffb347' },
  wisp: { radius: 12, speed: 215, hp: 14, score: 15, damage: 8, cost: 2, color: '#5eead4' },
  spitter: { radius: 15, speed: 105, hp: 30, score: 20, damage: 10, cost: 2, color: '#c084fc' },
  brute: { radius: 24, speed: 72, hp: 110, score: 40, damage: 16, cost: 4, color: '#f87171' },
};

/** Elites are bigger, tougher, worth triple and always drop a heart. */
export const ELITE = { hpMul: 3.2, speedMul: 0.9, scoreMul: 3, radiusMul: 1.35 };

export const BOSSES = {
  warden: {
    name: 'Cinder Warden',
    radius: 46, speed: 62, hp: 1500, score: 500, damage: 22,
    color: '#fb923c', summonEvery: 7, burstEvery: 5,
  },
  sovereign: {
    name: 'Ash Sovereign',
    radius: 52, speed: 88, hp: 2800, score: 1000, damage: 24,
    color: '#e879f9', summonEvery: 6, burstEvery: 4,
  },
};

/** Enemy bullets (spitters and bosses). */
export const ENEMY_BULLET = { radius: 6, speed: 260, damage: 10 };

/** Pickups: shards are score, hearts heal. */
export const PICKUPS = {
  shard: { radius: 8, score: 5 },
  heart: { radius: 11, heal: 20 },
};

/** How many things can exist at once; the pools are allocated once, at boot. */
export const POOLS = { enemies: 96, bullets: 320, enemyBullets: 220, particles: 640, texts: 48, pickups: 96 };

/**
 * The upgrade draft: ten upgrades, each with a level cap. Between waves the
 * player picks one of three cards; every pick is a real build choice.
 */
export const UPGRADES = [
  { id: 'split', name: 'Split Embers', max: 3, text: '+1 ember bolt per shot' },
  { id: 'rapid', name: 'Rapid Embers', max: 5, text: '+18% fire rate' },
  { id: 'heavy', name: 'Heavy Embers', max: 5, text: '+30% bolt damage' },
  { id: 'pierce', name: 'Piercing Embers', max: 3, text: 'Bolts pierce +1 enemy' },
  { id: 'swift', name: 'Swift Boots', max: 5, text: '+12% move speed' },
  { id: 'heart', name: 'Ember Heart', max: 5, text: '+25 max health, heal 25' },
  { id: 'nova', name: 'Nova Burst', max: 3, text: 'A ring of embers bursts out every 6s' },
  { id: 'crit', name: 'Deadly Aim', max: 5, text: '+12% critical chance (crits deal double)' },
  { id: 'magnet', name: 'Magnet Core', max: 3, text: '+60% pickup radius' },
  { id: 'dash', name: 'Dash Mastery', max: 3, text: '-25% dash cooldown, dash leaves embers' },
];

export const PALETTE = {
  backdrop: '#0b0b16',
  arena: '#12122a',
  arenaEdge: '#1e1e40',
  grid: '#1b1b38',
  ember: '#ffb347',
  emberHot: '#ffd166',
  teal: '#5eead4',
  violet: '#c084fc',
  crimson: '#f87171',
  gold: '#facc15',
  heart: '#4ade80',
  panel: '#17172e',
  panelEdge: '#2e2e5c',
  text: '#f4f1e8',
  muted: '#9a97b8',
  danger: '#ef4444',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'cinderfall.best';
