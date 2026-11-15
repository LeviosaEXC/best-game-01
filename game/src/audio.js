// Every sound in CINDERFALL, synthesised with WebAudio: no audio files, no
// network, nothing to load. The engine stays silent until the player first
// interacts (a browser only lets sound start after a gesture), and a shot
// scene never creates an audio context at all.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let nextNote = 0;
  let step = 0;

  /** A slow minor arpeggio over a low pad: the music is a loop of 16 steps. */
  const SCALE = [0, 3, 5, 7, 10, 12, 15, 12, 10, 7, 5, 3, 0, -2, -5, -2];
  const ROOT = 110;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq = 1200, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function scheduleMusic() {
    if (!ctx || muted) return;
    const ahead = 0.25;
    while (nextNote < ctx.currentTime + ahead) {
      const semis = SCALE[step % SCALE.length];
      const freq = ROOT * Math.pow(2, semis / 12);
      const when = Math.max(0, nextNote - ctx.currentTime);
      tone(freq, 0.5, 'triangle', 0.5, when);
      if (step % 8 === 0) tone(ROOT / 2, 1.8, 'sine', 0.5, when);
      if (step % 4 === 2) tone(freq * 2, 0.22, 'sine', 0.22, when);
      nextNote += 0.24;
      step += 1;
    }
  }

  return {
    /** Call from the first user gesture; also starts the music loop. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (musicTimer === null) {
        nextNote = ctx.currentTime + 0.1;
        musicTimer = window.setInterval(scheduleMusic, 120);
      }
    },
    get isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() {
      tone(720, 0.09, 'square', 0.10, 0, 320);
    },
    hit() {
      noise(0.06, 0.12, 2400);
    },
    kill() {
      noise(0.22, 0.28, 900);
      tone(180, 0.25, 'sine', 0.30, 0, 55);
    },
    hurt() {
      tone(140, 0.22, 'sawtooth', 0.28, 0, 70);
      noise(0.15, 0.20, 700);
    },
    pickup() {
      tone(660, 0.08, 'sine', 0.18);
      tone(990, 0.12, 'sine', 0.18, 0.07);
    },
    heart() {
      tone(520, 0.14, 'sine', 0.22);
      tone(780, 0.2, 'sine', 0.22, 0.1);
    },
    dash() {
      noise(0.14, 0.16, 3200);
    },
    nova() {
      tone(440, 0.4, 'sine', 0.2, 0, 1760);
      noise(0.3, 0.14, 1800);
    },
    horn() {
      tone(196, 0.7, 'sawtooth', 0.20, 0, 392);
      tone(294, 0.7, 'sawtooth', 0.14, 0.05, 392);
    },
    boss() {
      tone(82, 0.9, 'sawtooth', 0.3, 0, 41);
      noise(0.7, 0.22, 500);
    },
    victory() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.22, i * 0.13));
    },
    gameover() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.2, i * 0.16));
    },
  };
}
