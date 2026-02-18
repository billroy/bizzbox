/**
 * Web Audio API synthesizer for BizzBox.
 * All sounds are synthesized — no audio files required.
 */

class AudioEngine {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._muted = false;
    this._ready = false;
    // Ambient state
    this._ambientNodes = null;
    this._ambientGain = null;
    this._ambientActive = false;
  }

  _init() {
    if (this._ready) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._muted ? 0 : 0.4;
      this._masterGain.connect(this._ctx.destination);
      this._ready = true;
    } catch (e) {
      console.warn('BizzBox: Web Audio not available', e);
    }
  }

  _resume() {
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  }

  /**
   * Play a tone with given parameters.
   * @param {number} freq      Start frequency
   * @param {number} freq2     End frequency (for sweep, or same as freq)
   * @param {number} duration  Duration in seconds
   * @param {string} type      OscillatorType: 'sine'|'square'|'sawtooth'|'triangle'
   * @param {number} volume    0–1
   */
  _tone(freq, freq2, duration, type = 'sine', volume = 0.3) {
    if (!this._ready || this._muted) return;
    this._resume();
    const vol = volume * 0.316;   // event sounds −10 dB
    const now = this._ctx.currentTime;
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freq2 !== freq) {
      osc.frequency.linearRampToValueAtTime(freq2, now + duration);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.setValueAtTime(vol, now + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  _noise(duration, volume = 0.05) {
    if (!this._ready || this._muted) return;
    this._resume();
    const vol = volume * 0.316;   // event sounds −10 dB
    const now = this._ctx.currentTime;
    const bufLen = Math.floor(this._ctx.sampleRate * duration);
    const buf = this._ctx.createBuffer(1, bufLen, this._ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = this._ctx.createBufferSource();
    src.buffer = buf;
    const gain = this._ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    src.connect(gain);
    gain.connect(this._masterGain);
    src.start(now);
  }

  /** Called on first user interaction to unlock AudioContext */
  unlock() {
    this._init();
    this._resume();
  }

  mute() {
    this._muted = true;
    if (this._masterGain) this._masterGain.gain.value = 0;
  }

  unmute() {
    this._muted = false;
    if (this._masterGain) this._masterGain.gain.value = 0.4;
  }

  setMuted(val) {
    val ? this.mute() : this.unmute();
  }

  // ── Ambient soundscape presets ──────────────────────────────

  /**
   * Start an ambient preset by name, or stop if already playing the same preset.
   * @param {string} preset  One of AMBIENT_PRESETS keys
   * @param {number} intensity  Current activity intensity (1-20)
   */
  startAmbient(preset, intensity) {
    this._init();
    this._resume();
    // If already running, stop first (crossfade)
    if (this._ambientActive) this._teardownAmbient();

    const ctx = this._ctx;
    if (!ctx) return;

    const builder = AMBIENT_PRESETS[preset];
    if (!builder) return;

    const now = ctx.currentTime;
    const targetVol = this._ambientVolume(intensity);

    // Master ambient gain — fade in
    this._ambientGain = ctx.createGain();
    this._ambientGain.gain.value = 0;
    this._ambientGain.connect(this._masterGain);

    // Build the preset's node graph; collect stoppable/disconnectable nodes
    const nodes = builder(ctx, this._ambientGain, now);
    this._ambientStoppables = nodes;

    // Fade in over 2s
    this._ambientGain.gain.setValueAtTime(0.001, now);
    this._ambientGain.gain.linearRampToValueAtTime(targetVol, now + 2);

    this._ambientActive = true;
    this._ambientPreset = preset;
  }

  stopAmbient() {
    if (!this._ambientActive || !this._ctx) return;
    this._teardownAmbient();
  }

  _teardownAmbient() {
    if (!this._ambientGain || !this._ctx) {
      this._ambientActive = false;
      return;
    }
    const ctx = this._ctx;
    const now = ctx.currentTime;
    // Fade out
    this._ambientGain.gain.cancelScheduledValues(now);
    this._ambientGain.gain.setValueAtTime(this._ambientGain.gain.value, now);
    this._ambientGain.gain.linearRampToValueAtTime(0, now + 1.5);

    const stoppables = this._ambientStoppables || [];
    const gain = this._ambientGain;
    setTimeout(() => {
      for (const n of stoppables) {
        try { n.stop(); } catch (e) {}
        try { n.disconnect(); } catch (e) {}
      }
      try { gain.disconnect(); } catch (e) {}
    }, 1800);

    this._ambientStoppables = null;
    this._ambientGain = null;
    this._ambientActive = false;
    this._ambientPreset = null;
  }

  updateAmbientIntensity(intensity) {
    if (!this._ambientActive || !this._ambientGain || !this._ctx) return;
    const now = this._ctx.currentTime;
    const vol = this._ambientVolume(intensity);
    this._ambientGain.gain.cancelScheduledValues(now);
    this._ambientGain.gain.setValueAtTime(this._ambientGain.gain.value, now);
    this._ambientGain.gain.linearRampToValueAtTime(vol, now + 0.5);
  }

  _ambientVolume(intensity) {
    // intensity 1 → 0.113, intensity 20 → 0.708  (+7 dB over original)
    return 0.113 + (intensity - 1) * (0.595 / 19);
  }

  // ── Spawn / despawn sounds ────────────────────────────────────

  playSpawn() {
    this._init();
    // Short ascending chirp
    this._tone(400, 800, 0.15, 'sine', 0.25);
    this._tone(600, 1200, 0.1, 'triangle', 0.1);
  }

  playDespawn() {
    this._init();
    // Short descending chirp
    this._tone(800, 300, 0.2, 'sine', 0.2);
  }

  // ── Per-activity ambient sounds ──────────────────────────────

  playActivitySound(type) {
    this._init();
    switch (type) {
      case 'radar':
        this._tone(880, 880, 0.08, 'sine', 0.3);
        break;
      case 'oscilloscope':
        this._tone(440, 440, 0.3, 'triangle', 0.15);
        break;
      case 'terminal':
      case 'code_scroll':
        this._noise(0.03, 0.08);
        break;
      case 'log_tail':
        this._tone(660, 660, 0.05, 'square', 0.1);
        break;
      case 'network_topology':
        this._tone(523, 659, 0.12, 'sine', 0.15);
        break;
      case 'countdown':
        this._tone(880, 880, 0.1, 'square', 0.2);
        setTimeout(() => this._tone(1108, 1108, 0.1, 'square', 0.2), 150);
        break;
      case 'facial_recognition':
        this._tone(1200, 800, 0.15, 'sawtooth', 0.1);
        break;
      case 'hex_dump':
        this._noise(0.05, 0.06);
        break;
      case 'resource_gauges':
        this._tone(330, 330, 0.2, 'sine', 0.12);
        break;
      case 'geo_map':
        this._tone(440, 554, 0.2, 'sine', 0.12);
        break;
      case 'notifications':
        this._tone(880, 1108, 0.08, 'sine', 0.2);
        setTimeout(() => this._tone(1108, 880, 0.08, 'sine', 0.15), 100);
        break;
      case 'matrix_rain':
        this._noise(0.04, 0.05);
        this._tone(200, 150, 0.15, 'sine', 0.08);
        break;
      case 'audio_spectrum':
        this._tone(220, 440, 0.12, 'triangle', 0.12);
        break;
      case 'progress_bars':
        this._tone(550, 550, 0.06, 'square', 0.08);
        break;
      case 'dna_sequence':
        this._tone(300, 350, 0.1, 'sine', 0.1);
        this._noise(0.03, 0.04);
        break;
      case 'graph':
        this._tone(392, 392, 0.15, 'sine', 0.1);
        break;
      case 'orbital_view':
        this._tone(260, 340, 0.2, 'sine', 0.08);
        this._tone(520, 680, 0.15, 'triangle', 0.05);
        break;
      case 'camera_feed':
        this._noise(0.06, 0.04);
        break;
      case 'cipher_decrypt':
        this._noise(0.02, 0.06);
        this._tone(600, 800, 0.08, 'square', 0.08);
        break;
      case 'data_table':
        this._tone(700, 700, 0.04, 'square', 0.06);
        break;
      case 'system_topology':
        this._tone(440, 480, 0.1, 'sine', 0.08);
        this._noise(0.02, 0.03);
        break;
      case 'globe_arcs':
        this._tone(350, 500, 0.15, 'sine', 0.1);
        break;
      case 'chat_intercept':
        this._noise(0.04, 0.08);
        this._tone(500, 600, 0.08, 'square', 0.08);
        break;
      case 'wireframe_3d':
        this._tone(110, 110, 0.2, 'sine', 0.08);
        break;
      case 'power_grid':
        this._tone(60, 60, 0.15, 'sawtooth', 0.06);
        this._noise(0.02, 0.04);
        break;
      case 'game_of_life':
        this._tone(800, 800, 0.03, 'sine', 0.08);
        this._tone(600, 600, 0.03, 'sine', 0.06);
        break;
      default:
        this._tone(440, 440, 0.1, 'sine', 0.1);
    }
  }
}

// ── Ambient Preset Helpers ──────────────────────────────────────
// Each returns an array of stoppable AudioNodes (oscillators, buffer sources).
// All connect to the provided `dest` gain node.

function makeNoise(ctx, dest, now, filterFreq, filterQ, vol, filterType = 'lowpass') {
  const bufLen = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(now);
  return src;
}

function makeOsc(ctx, dest, now, freq, type, vol) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  return osc;
}

function makeLFO(ctx, target, now, freq, amount) {
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = freq;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = amount;
  lfo.connect(lfoGain);
  lfoGain.connect(target);
  lfo.start(now);
  return lfo;
}

// ── Preset Definitions ─────────────────────────────────────────

const AMBIENT_PRESETS = {
  // Original server room: detuned 55Hz drone + filtered noise
  server_room(ctx, dest, now) {
    const o1 = makeOsc(ctx, dest, now, 55, 'sine', 0.6);
    const o2 = makeOsc(ctx, dest, now, 55.5, 'sine', 0.6);
    const n = makeNoise(ctx, dest, now, 400, 1, 0.3);
    return [o1, o2, n];
  },

  // Forest rain: pink-ish filtered noise (low rumble + high patter)
  forest_rain(ctx, dest, now) {
    const low = makeNoise(ctx, dest, now, 200, 0.5, 0.4);        // distant thunder rumble
    const mid = makeNoise(ctx, dest, now, 1200, 0.7, 0.25);      // leaf patter
    const high = makeNoise(ctx, dest, now, 4000, 2.0, 0.15);     // rain hiss
    // Slow LFO on low filter for rolling thunder
    const lowFilter = low; // can't LFO a buffer source directly — but the noise itself fluctuates
    const wind = makeOsc(ctx, dest, now, 0.3, 'sine', 0.08);     // very low sub-rumble
    return [low, mid, high, wind];
  },

  // Drone approaching: rising sawtooth sweep + rotorblade chop
  drone_approaching(ctx, dest, now) {
    const motor = makeOsc(ctx, dest, now, 85, 'sawtooth', 0.25);
    const motor2 = makeOsc(ctx, dest, now, 170, 'sawtooth', 0.12);
    // Blade chop: amplitude-modulated noise
    const chop = makeNoise(ctx, dest, now, 600, 2, 0.2);
    const chopLfo = makeLFO(ctx, chop.context ? dest : dest, now, 12, 0.08); // ~12 Hz chop
    const wind = makeNoise(ctx, dest, now, 2000, 0.5, 0.1);
    return [motor, motor2, chop, chopLfo, wind];
  },

  // Bunker with countdown: deep sub-bass pulse + ticking + distant rumble
  bunker_countdown(ctx, dest, now) {
    const sub = makeOsc(ctx, dest, now, 30, 'sine', 0.5);        // deep sub-bass
    const hum = makeOsc(ctx, dest, now, 60, 'triangle', 0.2);    // fluorescent hum
    const hum2 = makeOsc(ctx, dest, now, 120, 'sine', 0.08);     // harmonic
    const rumble = makeNoise(ctx, dest, now, 150, 0.5, 0.2);     // distant shaking
    // Ticking: square wave pulse at 1Hz
    const tick = makeOsc(ctx, dest, now, 1.0, 'square', 0.03);
    const tickTone = makeOsc(ctx, dest, now, 1000, 'sine', 0.0);
    // Modulate tick tone amplitude with tick
    const tickMod = makeLFO(ctx, dest, now, 1.0, 0.04);
    return [sub, hum, hum2, rumble, tick, tickTone, tickMod];
  },

  // Deep space: very slow detuned pads + cosmic crackle
  deep_space(ctx, dest, now) {
    const pad1 = makeOsc(ctx, dest, now, 65, 'sine', 0.35);
    const pad2 = makeOsc(ctx, dest, now, 65.2, 'sine', 0.35);
    const pad3 = makeOsc(ctx, dest, now, 97.5, 'sine', 0.15);    // fifth
    const pad4 = makeOsc(ctx, dest, now, 130.5, 'sine', 0.08);   // octave
    const crackle = makeNoise(ctx, dest, now, 8000, 5, 0.04);    // sparse crackle
    const sub = makeOsc(ctx, dest, now, 20, 'sine', 0.2);        // infrasonic rumble
    return [pad1, pad2, pad3, pad4, crackle, sub];
  },

  // War room: tense low brass + radio static + heartbeat pulse
  war_room(ctx, dest, now) {
    const brass1 = makeOsc(ctx, dest, now, 73.4, 'sawtooth', 0.12);  // D2
    const brass2 = makeOsc(ctx, dest, now, 82.4, 'sawtooth', 0.08);  // E2
    const static1 = makeNoise(ctx, dest, now, 3000, 3, 0.06);
    const sub = makeOsc(ctx, dest, now, 36.7, 'sine', 0.25);    // sub D1
    // Heartbeat LFO ~ 1.1Hz
    const pulse = makeLFO(ctx, dest, now, 1.1, 0.06);
    const hum = makeOsc(ctx, dest, now, 50, 'sine', 0.15);      // electrical hum
    return [brass1, brass2, static1, sub, pulse, hum];
  },

  // Ocean depth: underwater rumble + whale-like slow sweeps
  ocean_depth(ctx, dest, now) {
    const rumble = makeNoise(ctx, dest, now, 120, 0.3, 0.35);
    const bubble = makeNoise(ctx, dest, now, 800, 8, 0.06);     // bubble pops
    const whale1 = makeOsc(ctx, dest, now, 140, 'sine', 0.12);
    const whale2 = makeOsc(ctx, dest, now, 142, 'sine', 0.12);  // slow beat
    const deep = makeOsc(ctx, dest, now, 25, 'sine', 0.3);      // abyss
    const current = makeNoise(ctx, dest, now, 300, 1, 0.15);
    return [rumble, bubble, whale1, whale2, deep, current];
  },

  // Power plant: 60Hz transformer hum + steam + machinery
  power_plant(ctx, dest, now) {
    const hum60 = makeOsc(ctx, dest, now, 60, 'sine', 0.4);
    const hum120 = makeOsc(ctx, dest, now, 120, 'sine', 0.2);   // 2nd harmonic
    const hum180 = makeOsc(ctx, dest, now, 180, 'sine', 0.08);  // 3rd harmonic
    const steam = makeNoise(ctx, dest, now, 2500, 2, 0.1);
    const machinery = makeNoise(ctx, dest, now, 500, 1, 0.15);
    const throb = makeLFO(ctx, dest, now, 0.5, 0.05);           // slow throb
    return [hum60, hum120, hum180, steam, machinery, throb];
  },

  // Arctic wind: howling bandpassed wind + ice creak
  arctic_wind(ctx, dest, now) {
    const wind1 = makeNoise(ctx, dest, now, 600, 3, 0.3);
    const wind2 = makeNoise(ctx, dest, now, 1500, 2, 0.2);
    const gust = makeNoise(ctx, dest, now, 300, 1, 0.15);       // low gusts
    const creak = makeOsc(ctx, dest, now, 2200, 'sine', 0.02);  // ice stress
    const creak2 = makeOsc(ctx, dest, now, 2203, 'sine', 0.02); // beating creak
    const sub = makeOsc(ctx, dest, now, 40, 'sine', 0.15);      // pressure
    return [wind1, wind2, gust, creak, creak2, sub];
  },
};

/** Ordered list of ambient preset names for UI */
export const AMBIENT_PRESET_LIST = [
  { key: 'server_room',      label: 'Server Room' },
  { key: 'forest_rain',      label: 'Forest Rain' },
  { key: 'drone_approaching', label: 'Drone Approaching' },
  { key: 'bunker_countdown', label: 'Bunker Countdown' },
  { key: 'deep_space',       label: 'Deep Space' },
  { key: 'war_room',         label: 'War Room' },
  { key: 'ocean_depth',      label: 'Ocean Depth' },
  { key: 'power_plant',      label: 'Power Plant' },
  { key: 'arctic_wind',      label: 'Arctic Wind' },
];

export const audio = new AudioEngine();
