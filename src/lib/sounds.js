// Procedural retro sounds. No audio files, no network, no per-frame work.
// Everything is short oscillator/noise envelopes so the sounds follow the
// selected volume and work offline.

export const MESSAGE_SOUNDS = [
  { id: "off", label: "off" },
  { id: "macintosh", label: "Macintosh" },
  { id: "sun", label: "Sun Sparc" },
  { id: "sgi", label: "SGI IRIX" },
  { id: "msn", label: "MSN Messenger" },
  { id: "aol", label: "AOL Mail" },
  { id: "icq", label: "ICQ" },
  { id: "palm", label: "Palm PDA" },
  { id: "blackberry", label: "BlackBerry" },
  { id: "blade-runner", label: "Blade Runner" },
  { id: "tron", label: "Tron" },
  { id: "c64", label: "Commodore 64" },
  { id: "amiga", label: "Amiga" },
];

export const CLICK_SOUNDS = [
  { id: "off", label: "off" },
  { id: "model-m", label: "Model M" },
  { id: "mac-click", label: "Mac mouse" },
  { id: "sun-type", label: "Sun keyboard" },
  { id: "sgi-beep", label: "SGI blip" },
  { id: "msn-nudge", label: "MSN nudge" },
  { id: "aol-ok", label: "AOL chime" },
  { id: "palm-tap", label: "Palm tap" },
  { id: "blackberry-key", label: "BlackBerry key" },
  { id: "blade-runner-ui", label: "Blade Runner UI" },
  { id: "tron-disc", label: "Tron disc" },
  { id: "c64-key", label: "C64 key" },
  { id: "amiga-click", label: "Amiga click" },
];

let ctx = null;
let lastClickAt = 0;

function audio() {
  if (typeof AudioContext === "undefined" && !globalThis.webkitAudioContext) return null;
  if (!ctx) {
    const Ctor = typeof AudioContext !== "undefined" ? AudioContext : globalThis.webkitAudioContext;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") {
    try {
      ctx.resume().catch(() => {});
    } catch {}
  }
  return ctx;
}

export function unlockAudio() {
  audio();
}

function envGain(ac, start, duration, peak, master) {
  const g = ac.createGain();
  const t = ac.currentTime + start;
  const level = Math.max(0.0001, peak * master);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, duration));
  return g;
}

function tone(ac, { freq, start = 0, duration = 0.12, peak = 0.08, master = 0.6, type = "sine", slideTo = null, filter = null }) {
  const osc = ac.createOscillator();
  const gain = envGain(ac, start, duration, peak, master);
  osc.type = type;
  const t = ac.currentTime + start;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
  let tail = osc;
  if (filter) {
    const f = ac.createBiquadFilter();
    f.type = filter.type || "bandpass";
    f.frequency.setValueAtTime(filter.freq || 1200, t);
    f.Q.setValueAtTime(filter.q ?? 2, t);
    tail.connect(f);
    tail = f;
  }
  tail.connect(gain);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

function noise(ac, { start = 0, duration = 0.035, peak = 0.04, master = 0.6, freq = 1800, q = 1.2 }) {
  const length = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = envGain(ac, start, duration, peak, master);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  source.start(ac.currentTime + start);
  source.stop(ac.currentTime + start + duration + 0.02);
}

function playMessage(id, volume) {
  if (!id || id === "off") return false;
  const ac = audio();
  if (!ac) return false;
  const vol = Number(volume);
  const master = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0.6;
  try {
    switch (id) {
      case "macintosh":
        // warm startup chord, slow bloom
        [261.63, 329.63, 392.0, 523.25].forEach((f, i) =>
          tone(ac, { freq: f, start: i * 0.045, duration: 1.15, peak: 0.032, master, type: "sine", filter: { type: "lowpass", freq: 1800, q: 0.6 } }),
        );
        tone(ac, { freq: 1046.5, start: 0.18, duration: 0.7, peak: 0.012, master, type: "triangle" });
        break;
      case "sun":
        [784, 1046.5, 1318.5, 1568].forEach((f, i) =>
          tone(ac, { freq: f, start: i * 0.065, duration: 0.28, peak: 0.04, master, type: "triangle" }),
        );
        break;
      case "sgi":
        tone(ac, { freq: 880, start: 0, duration: 0.9, peak: 0.055, master, type: "sine" });
        tone(ac, { freq: 1320, start: 0.01, duration: 0.7, peak: 0.022, master, type: "sine" });
        tone(ac, { freq: 440, start: 0.03, duration: 0.8, peak: 0.018, master, type: "triangle" });
        break;
      case "msn":
        tone(ac, { freq: 1318.5, start: 0, duration: 0.09, peak: 0.055, master, type: "square" });
        tone(ac, { freq: 1046.5, start: 0.14, duration: 0.2, peak: 0.045, master, type: "square" });
        break;
      case "aol":
        [1046.5, 1318.5, 1568].forEach((f, i) =>
          tone(ac, { freq: f, start: i * 0.11, duration: 0.32, peak: 0.04, master, type: "triangle" }),
        );
        break;
      case "icq":
        tone(ac, { freq: 1350, start: 0, duration: 0.11, peak: 0.05, master, type: "square" });
        tone(ac, { freq: 900, start: 0.13, duration: 0.18, peak: 0.04, master, type: "square" });
        break;
      case "palm":
        tone(ac, { freq: 1760, start: 0, duration: 0.06, peak: 0.04, master, type: "sine" });
        tone(ac, { freq: 1760, start: 0.1, duration: 0.06, peak: 0.04, master, type: "sine" });
        break;
      case "blackberry":
        tone(ac, { freq: 1480, start: 0, duration: 0.08, peak: 0.045, master, type: "square" });
        tone(ac, { freq: 1850, start: 0.11, duration: 0.1, peak: 0.04, master, type: "square" });
        break;
      case "blade-runner":
        // Vangelis-ish slow brass pad: low fifths under a filtered saw
        tone(ac, { freq: 110, start: 0, duration: 1.8, peak: 0.045, master, type: "sawtooth", filter: { type: "lowpass", freq: 700, q: 1.5 } });
        tone(ac, { freq: 164.81, start: 0.05, duration: 1.7, peak: 0.033, master, type: "sawtooth", filter: { type: "lowpass", freq: 900, q: 1.2 } });
        tone(ac, { freq: 220, start: 0.1, duration: 1.5, peak: 0.02, master, type: "triangle" });
        break;
      case "tron":
        [330, 440, 660, 880, 1320].forEach((f, i) =>
          tone(ac, { freq: f, start: i * 0.055, duration: 0.14, peak: 0.035, master, type: "square" }),
        );
        break;
      case "c64":
        [523, 659, 784, 1047, 784, 659].forEach((f, i) =>
          tone(ac, { freq: f, start: i * 0.04, duration: 0.075, peak: 0.035, master, type: "square" }),
        );
        break;
      case "amiga":
        [392, 523, 659, 784, 1047, 784].forEach((f, i) =>
          tone(ac, { freq: f, start: i * 0.05, duration: 0.18, peak: 0.03, master, type: "triangle" }),
        );
        break;
      default:
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

function playClick(id, volume) {
  if (!id || id === "off") return false;
  const ac = audio();
  if (!ac) return false;
  const now = performance.now();
  if (now - lastClickAt < 45) return false;
  lastClickAt = now;
  const vol = Number(volume);
  const master = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0.55;
  try {
    switch (id) {
      case "model-m":
        noise(ac, { duration: 0.03, peak: 0.045, master, freq: 900, q: 0.7 });
        tone(ac, { freq: 180, start: 0, duration: 0.045, peak: 0.045, master, type: "sine" });
        break;
      case "mac-click":
        noise(ac, { duration: 0.018, peak: 0.03, master, freq: 2400, q: 1.1 });
        tone(ac, { freq: 820, start: 0, duration: 0.018, peak: 0.018, master, type: "triangle" });
        break;
      case "sun-type":
        tone(ac, { freq: 1900, start: 0, duration: 0.012, peak: 0.025, master, type: "square" });
        noise(ac, { duration: 0.015, peak: 0.018, master, freq: 3000, q: 1.5 });
        break;
      case "sgi-beep":
        tone(ac, { freq: 990, start: 0, duration: 0.045, peak: 0.035, master, type: "sine" });
        break;
      case "msn-nudge":
        tone(ac, { freq: 1200, start: 0, duration: 0.018, peak: 0.028, master, type: "square" });
        tone(ac, { freq: 1500, start: 0.035, duration: 0.018, peak: 0.025, master, type: "square" });
        break;
      case "aol-ok":
        tone(ac, { freq: 880, start: 0, duration: 0.06, peak: 0.03, master, type: "triangle" });
        tone(ac, { freq: 1320, start: 0.05, duration: 0.08, peak: 0.022, master, type: "triangle" });
        break;
      case "palm-tap":
        tone(ac, { freq: 1600, start: 0, duration: 0.012, peak: 0.022, master, type: "sine" });
        break;
      case "blackberry-key":
        noise(ac, { duration: 0.018, peak: 0.03, master, freq: 1400, q: 0.8 });
        tone(ac, { freq: 320, start: 0.01, duration: 0.035, peak: 0.025, master, type: "sine" });
        break;
      case "blade-runner-ui":
        tone(ac, { freq: 220, start: 0, duration: 0.12, peak: 0.035, master, type: "sawtooth", filter: { type: "lowpass", freq: 800, q: 2 } });
        tone(ac, { freq: 330, start: 0.02, duration: 0.09, peak: 0.018, master, type: "triangle" });
        break;
      case "tron-disc":
        noise(ac, { duration: 0.07, peak: 0.028, master, freq: 2600, q: 2.4 });
        tone(ac, { freq: 740, start: 0, duration: 0.07, peak: 0.022, master, type: "sine", slideTo: 980 });
        break;
      case "c64-key":
        tone(ac, { freq: 1046, start: 0, duration: 0.02, peak: 0.03, master, type: "square" });
        noise(ac, { duration: 0.012, peak: 0.016, master, freq: 2200, q: 1.2 });
        break;
      case "amiga-click":
        tone(ac, { freq: 620, start: 0, duration: 0.03, peak: 0.028, master, type: "triangle" });
        break;
      default:
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function playMessageSound(id, volume = 0.6) {
  return playMessage(id, volume);
}

export function playClickSound(id, volume = 0.5) {
  return playClick(id, volume);
}

export function previewSound(kind, id, volume = 0.6) {
  return kind === "message" ? playMessage(id, volume) : playClick(id, volume);
}
