// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, draft, paused, game over and victory.
//
// ?seed=N fixes the run's random numbers. ?shot=title|play|draft|victory
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createEffects } from './effects.js';
import {
  SCREEN_DRAFT, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const fx = createEffects(createRandom((seed ^ 0x9e3779b9) >>> 0));
const audio = createAudio();
const world = createWorld(random, fx, audio);
const renderer = createRenderer(canvas, fx);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, fx);
  // Let particles and floating texts settle so the frame is clean.
  for (let i = 0; i < 60; i += 1) fx.step(STEP);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let dashQueued = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.start();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Survive 12 waves.');
  }

  function endGame(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(victory ? `Victory. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_DASH) dashQueued = true;
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_DRAFT) {
      const pick = input.takePick();
      if (pick >= 1 && pick <= 3 && world.state.draft && world.state.draft[pick - 1]) {
        world.applyPick(world.state.draft[pick - 1].id);
        screen = SCREEN_PLAY;
        announce(`Wave ${world.state.wave}.`);
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if ((screen === SCREEN_OVER || screen === SCREEN_VICTORY) && (actions & ACTION_CONFIRM)) {
      audio.unlock();
      startGame();
    }
  }

  function step() {
    const move = input.move();
    const aim = input.aim();
    const dash = dashQueued;
    dashQueued = false;
    const events = world.step(STEP, {
      moveX: move.x,
      moveY: move.y,
      firing: input.isFiring(),
      aimX: aim.x,
      aimY: aim.y,
      dash,
    });
    fx.step(STEP);
    if (events & EVENT_VICTORY) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_WAVE_CLEAR) {
      screen = SCREEN_DRAFT;
      announce(`Wave ${world.state.wave} clear. Choose an upgrade.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, now / 1000);
  }

  // Clicking a draft card picks it: the cards are laid out in render.js.
  canvas.addEventListener('pointerdown', (event) => {
    if (screen !== SCREEN_DRAFT || !world.state.draft) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
    const y = (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
    const cards = world.state.draft;
    const cardW = 300;
    const cardH = 210;
    const gap = 36;
    const totalW = cards.length * cardW + (cards.length - 1) * gap;
    const startX = 640 - totalW / 2;
    cards.forEach((card, i) => {
      const cx = startX + i * (cardW + gap);
      if (x >= cx && x <= cx + cardW && y >= 230 && y <= 230 + cardH) {
        world.applyPick(card.id);
        screen = SCREEN_PLAY;
        announce(`Wave ${world.state.wave}.`);
      }
    });
  });

  // Leaving the tab pauses a running game rather than letting enemies close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  world.start();
  announce('Cinderfall. Click or press Space to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
