// Everything the player sees, painted on one canvas: the arena, the
// Emberkeeper, the enemies, the bullets, the pickups, the particles, the
// HUD, the wave banner and every screen (title, draft, pause, game over,
// victory). The renderer never changes the world — it only reads it.
import { FIELD, FONT, LAST_WAVE, PALETTE, PLAYER, UPGRADES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_DRAFT = 'draft';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGlow(ctx, x, y, radius, color, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas, fx) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  function drawArena(time) {
    ctx.fillStyle = PALETTE.arena;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // A faint grid and a ring of old stones: the arena reads as a place, not a void.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    for (let x = 80; x < FIELD.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = PALETTE.arenaEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(FIELD.width / 2, FIELD.height / 2, 300, 0, Math.PI * 2);
    ctx.stroke();
    // Drifting embers in the dark, purely decorative.
    for (let i = 0; i < 24; i += 1) {
      const x = ((i * 173 + time * 12) % (FIELD.width + 40)) - 20;
      const y = 40 + ((i * 97) % (FIELD.height - 80)) + Math.sin(time * 0.7 + i) * 8;
      drawGlow(ctx, x, y, 5, '#ffb347', 0.25);
    }
  }

  function drawPlayer(player, time) {
    const blink = player.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    if (blink) return;
    drawGlow(ctx, player.x, player.y, 52, '#ffb347', 0.35);
    // The Emberkeeper: a hooded figure drawn as a cloak and a burning core.
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.aim);
    ctx.fillStyle = '#2b2b4d';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, -13);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-12, 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(2, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(2, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    // The gun: a short ember staff pointing at the aim.
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
    ctx.restore();
    // Dash cooldown as a small ring under the player.
    if (player.dashCooldown > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius + 7, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (1 - player.dashCooldown / 2.2)));
      ctx.stroke();
    }
  }

  function drawEnemy(enemy, time) {
    const wobble = Math.sin(time * 5 + enemy.phase) * 0.06;
    drawGlow(ctx, enemy.x, enemy.y, enemy.radius * 2.4, enemy.color, enemy.boss ? 0.5 : 0.3);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (enemy.boss) {
      // A crowned ember: a big ring with horns and a burning eye.
      ctx.rotate(Math.sin(time * 1.2) * 0.1);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-enemy.radius * 0.7, -enemy.radius * 0.7);
      ctx.lineTo(-enemy.radius * 1.25, -enemy.radius * 1.25);
      ctx.moveTo(enemy.radius * 0.7, -enemy.radius * 0.7);
      ctx.lineTo(enemy.radius * 1.25, -enemy.radius * 1.25);
      ctx.stroke();
    } else if (enemy.kind === 'mote') {
      ctx.rotate(time * 2 + enemy.phase);
      ctx.fillStyle = enemy.color;
      for (let i = 0; i < 4; i += 1) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -enemy.radius);
        ctx.lineTo(4, 0);
        ctx.lineTo(-4, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#fff3c4';
      ctx.fill();
    } else if (enemy.kind === 'wisp') {
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * (1 + wobble), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(-4, -3, 3, 0, Math.PI * 2);
      ctx.arc(4, -3, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'spitter') {
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.moveTo(0, -enemy.radius);
      ctx.lineTo(enemy.radius, enemy.radius * 0.8);
      ctx.lineTo(-enemy.radius, enemy.radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(0, 2, enemy.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Brute: a heavy hex slab.
      ctx.rotate(wobble);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * enemy.radius;
        const py = Math.sin(a) * enemy.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (enemy.flash > 0) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (enemy.elite) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (enemy.hp < enemy.maxHp && !enemy.boss) {
      const w = enemy.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w, 4);
      ctx.fillStyle = enemy.color;
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w * (enemy.hp / enemy.maxHp), 4);
    }
  }

  function drawBullets(world) {
    for (const bullet of world.bullets) {
      drawGlow(ctx, bullet.x, bullet.y, 14, '#ffb347', 0.5);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const bullet of world.enemyBullets) {
      drawGlow(ctx, bullet.x, bullet.y, 14, '#c084fc', 0.45);
      ctx.fillStyle = '#e9d5ff';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPickups(world, time) {
    for (const pickup of world.pickups) {
      const bob = Math.sin(time * 4 + pickup.x) * 3;
      if (pickup.kind === 'shard') {
        drawGlow(ctx, pickup.x, pickup.y + bob, 12, '#ffd166', 0.6);
        ctx.fillStyle = '#ffd166';
        ctx.save();
        ctx.translate(pickup.x, pickup.y + bob);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      } else {
        drawGlow(ctx, pickup.x, pickup.y + bob, 16, '#4ade80', 0.6);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(pickup.x - 3, pickup.y + bob - 8, 6, 16);
        ctx.fillRect(pickup.x - 8, pickup.y + bob - 3, 16, 6);
      }
    }
  }

  function drawParticles() {
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const t of fx.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life / 0.4));
      ctx.font = t.big ? 'bold 26px ' + FONT : 'bold 17px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.fillText(t.value, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(world) {
    const player = world.player;
    // Score and combo, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px ' + FONT;
    ctx.fillText(String(world.score).padStart(6, '0'), 24, 44);
    if (world.combo > 1) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 18px ' + FONT;
      ctx.fillText(`COMBO x${(1 + Math.min(world.combo, 40) * 0.05).toFixed(2)}  (${world.combo})`, 24, 70);
    }
    // Wave and enemies left, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText(`WAVE ${world.wave} / ${LAST_WAVE}`, FIELD.width / 2, 36);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '16px ' + FONT;
    const left = world.enemies.length + world.spawnQueue.length;
    ctx.fillText(left > 0 ? `${left} enemies remain` : 'Wave clear!', FIELD.width / 2, 60);
    // Boss bar under the wave line.
    if (world.boss) {
      const w = 420;
      const x = FIELD.width / 2 - w / 2;
      const y = 72;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, x, y, w, 14, 7);
      ctx.fill();
      ctx.fillStyle = world.boss.color;
      roundRect(ctx, x, y, w * Math.max(0, world.boss.hp / world.boss.maxHp), 14, 7);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillText(world.boss.name, FIELD.width / 2, y + 32);
    }
    // Health and dash, bottom left.
    const barW = 260;
    const barX = 24;
    const barY = FIELD.height - 44;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText(`HP ${Math.ceil(player.hp)} / ${player.maxHp}`, barX, barY - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, barX, barY, barW, 14, 7);
    ctx.fill();
    const hpFrac = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = hpFrac > 0.5 ? '#4ade80' : hpFrac > 0.25 ? '#facc15' : '#ef4444';
    if (hpFrac > 0) {
      roundRect(ctx, barX, barY, barW * hpFrac, 14, 7);
      ctx.fill();
    }
    // Dash pip, bottom right; mute hint beside it.
    ctx.textAlign = 'right';
    ctx.fillStyle = player.dashCooldown <= 0 ? '#ffd166' : PALETTE.muted;
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText(player.dashCooldown <= 0 ? 'DASH READY  [Shift]' : 'DASH …', FIELD.width - 24, FIELD.height - 28);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px ' + FONT;
    ctx.fillText('WASD move · Mouse aim · Hold click to fire · P pause · M mute', FIELD.width - 24, FIELD.height - 52);
    // Wave banner, centre.
    if (world.banner && world.banner.timer > 0) {
      const a = Math.min(1, world.banner.timer / 0.5);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 54px ' + FONT;
      ctx.fillText(world.banner.text, FIELD.width / 2, FIELD.height / 2 - 60);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '20px ' + FONT;
      ctx.fillText(world.banner.sub, FIELD.width / 2, FIELD.height / 2 - 26);
      ctx.globalAlpha = 1;
    }
  }

  function drawPanel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10,10,24,0.82)';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
  }

  function drawTitle(world, best, time) {
    ctx.fillStyle = 'rgba(8,8,20,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    const glow = 0.75 + Math.sin(time * 2) * 0.25;
    drawGlow(ctx, FIELD.width / 2, 190, 220, '#ffb347', 0.25 * glow);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 84px ' + FONT;
    ctx.fillText('CINDERFALL', FIELD.width / 2, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '26px ' + FONT;
    ctx.fillText('An ember arena — hold the light against the dark', FIELD.width / 2, 252);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '19px ' + FONT;
    ctx.fillText('Survive 12 waves. Draft upgrades between waves. Fell the Ash Sovereign.', FIELD.width / 2, 292);
    drawPanel(FIELD.width / 2 - 330, 330, 660, 150);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '18px ' + FONT;
    ctx.fillText('WASD / Arrows — move        Mouse — aim        Hold click — fire embers', FIELD.width / 2, 372);
    ctx.fillText('Shift / Right-click — dash (briefly untouchable)        P — pause        M — mute', FIELD.width / 2, 402);
    ctx.fillText('Between waves, pick 1 of 3 upgrades — click a card, or press 1, 2, 3.', FIELD.width / 2, 432);
    const pulse = 0.75 + Math.sin(time * 3) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText('Click or press Space to begin', FIELD.width / 2, 540);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '18px ' + FONT;
      ctx.fillText(`Best score: ${best}`, FIELD.width / 2, 580);
    }
  }

  function drawDraft(world) {
    ctx.fillStyle = 'rgba(8,8,20,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 44px ' + FONT;
    ctx.fillText(`WAVE ${world.wave} CLEAR`, FIELD.width / 2, 120);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px ' + FONT;
    ctx.fillText('Choose one ember to carry into the next wave', FIELD.width / 2, 158);
    const cards = world.draft || [];
    const cardW = 300;
    const cardH = 210;
    const gap = 36;
    const totalW = cards.length * cardW + (cards.length - 1) * gap;
    const startX = FIELD.width / 2 - totalW / 2;
    cards.forEach((card, i) => {
      const x = startX + i * (cardW + gap);
      const y = 230;
      const level = world.build[card.id];
      drawPanel(x, y, cardW, cardH);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillText(`PRESS ${i + 1}`, x + cardW / 2, y + 32);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 24px ' + FONT;
      ctx.fillText(card.name, x + cardW / 2, y + 78);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '17px ' + FONT;
      const words = card.text.split(' ');
      let line = '';
      let lineY = y + 116;
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 26) {
          ctx.fillText(line.trim(), x + cardW / 2, lineY);
          line = word;
          lineY += 24;
        } else {
          line += ' ' + word;
        }
      }
      ctx.fillText(line.trim(), x + cardW / 2, lineY);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillText(`Level ${level} → ${level + 1}  (max ${card.max})`, x + cardW / 2, y + cardH - 22);
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '17px ' + FONT;
    ctx.fillText(`Score ${world.score}   ·   Kills ${world.kills}   ·   Wave ${world.wave} of ${LAST_WAVE}`, FIELD.width / 2, 520);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8,8,20,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 52px ' + FONT;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '20px ' + FONT;
    ctx.fillText('Press P or Esc to keep playing', FIELD.width / 2, FIELD.height / 2 + 30);
  }

  function drawEnd(world, best, victory) {
    ctx.fillStyle = 'rgba(8,8,20,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = victory ? '#ffd166' : '#f87171';
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText(victory ? 'THE LIGHT HOLDS' : 'THE EMBERS FADE', FIELD.width / 2, 190);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '24px ' + FONT;
    ctx.fillText(
      victory ? 'The Ash Sovereign is unmade. Twelve waves, and the arena is yours.' : `The dark took the Emberkeeper on wave ${world.wave}.`,
      FIELD.width / 2,
      236,
    );
    drawPanel(FIELD.width / 2 - 300, 290, 600, 210);
    const rows = [
      ['Score', String(world.score)],
      ['Best', String(Math.max(best, world.score))],
      ['Waves cleared', victory ? String(LAST_WAVE) : String(Math.max(0, world.wave - 1))],
      ['Kills', String(world.kills)],
      ['Time', `${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}`],
    ];
    rows.forEach(([label, value], i) => {
      const y = 330 + i * 36;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '20px ' + FONT;
      ctx.fillText(label, FIELD.width / 2 - 260, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 20px ' + FONT;
      ctx.fillText(value, FIELD.width / 2 + 260, y);
    });
    const pulse = 0.75 + Math.sin(world.time * 3) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('Press Space to play again', FIELD.width / 2, 570);
    ctx.globalAlpha = 1;
  }

  return {
    /** Paint the world on the given screen. `time` is the wall time in seconds. */
    draw(world, screen, best, time) {
      const offset = fx.shakeOffset();
      ctx.save();
      ctx.translate(offset.x, offset.y);
      drawArena(time);
      drawPickups(world, time);
      for (const enemy of world.enemies) drawEnemy(enemy, time);
      drawBullets(world);
      if (!world.over && !world.victory) drawPlayer(world.player, time);
      drawParticles();
      ctx.restore();
      if (fx.flashLeft > 0) {
        ctx.fillStyle = `rgba(239,68,68,${Math.min(0.35, fx.flashLeft)})`;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
      if (screen === SCREEN_TITLE) drawTitle(world, best, time);
      else if (screen === SCREEN_DRAFT) drawDraft(world);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawEnd(world, best, false);
      else if (screen === SCREEN_VICTORY) drawEnd(world, best, true);
      else drawHud(world);
    },
  };
}

// Keep the upgrade table referenced for the dossier outline.
export const UPGRADE_NAMES = UPGRADES.map((u) => u.name);
