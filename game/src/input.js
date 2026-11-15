// Keyboard and pointer input. Held keys give a move direction and a firing
// state; one-shot presses (start, pause, dash, mute, draft picks) are queued
// as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. The mouse aim is kept in playfield
// coordinates, scaled from the canvas by the caller.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const MUTE = new Set(['KeyM']);
const PICK = new Set(['Digit1', 'Digit2', 'Digit3']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let firing = false;
  let aimX = 0;
  let aimY = 0;
  let pick = 0;

  function keyDown(event) {
    if (event.repeat) {
      if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
        event.preventDefault();
      }
      return;
    }
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      actions |= ACTION_PAUSE;
    } else if (DASH.has(event.code)) {
      actions |= ACTION_DASH;
    } else if (MUTE.has(event.code)) {
      actions |= ACTION_MUTE;
    } else if (PICK.has(event.code)) {
      pick = Number(event.code.slice(-1));
    } else {
      return;
    }
    event.preventDefault();
  }

  function keyUp(event) {
    held.delete(event.code);
  }

  function blur() {
    held.clear();
    firing = false;
  }

  function trackAim(event) {
    const rect = canvas.getBoundingClientRect();
    aimX = (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
    aimY = (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('pointermove', trackAim);
  canvas.addEventListener('pointerdown', (event) => {
    trackAim(event);
    if (event.button === 2) actions |= ACTION_DASH;
    else {
      firing = true;
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button !== 2) firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Aim in playfield coordinates (the canvas is scaled to FIELD by the renderer). */
    aim() {
      return { x: aimX, y: aimY };
    },
    /** Normalised move direction from the held keys. */
    move() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        if (UP.has(code)) y -= 1;
        else if (DOWN.has(code)) y += 1;
        else if (LEFT.has(code)) x -= 1;
        else if (RIGHT.has(code)) x += 1;
      }
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    isFiring() {
      return firing;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The draft card number pressed (1-3), 0 when none. */
    takePick() {
      const taken = pick;
      pick = 0;
      return taken;
    },
    destroy() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    },
  };
}
