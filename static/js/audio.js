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
    const now = this._ctx.currentTime;
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freq2 !== freq) {
      osc.frequency.linearRampToValueAtTime(freq2, now + duration);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  _noise(duration, volume = 0.05) {
    if (!this._ready || this._muted) return;
    this._resume();
    const now = this._ctx.currentTime;
    const bufLen = Math.floor(this._ctx.sampleRate * duration);
    const buf = this._ctx.createBuffer(1, bufLen, this._ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = this._ctx.createBufferSource();
    src.buffer = buf;
    const gain = this._ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
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

  // ── Ambient soundscape ──────────────────────────────────────

  startAmbient(intensity) {
    this._init();
    if (this._ambientActive) return;
    this._resume();

    const ctx = this._ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const targetVol = this._ambientVolume(intensity);

    // Dedicated gain for ambient — start at 0, ramp up
    this._ambientGain = ctx.createGain();
    this._ambientGain.gain.value = 0;
    this._ambientGain.connect(this._masterGain);

    // Two detuned low sine oscillators (beating drone)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 55.5; // slight detune for beating

    // Filtered white noise (server room hum)
    const bufLen = ctx.sampleRate * 4;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) noiseData[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 400;
    noiseFilter.Q.value = 1;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.3;

    // Connect: osc1/osc2 → ambientGain, noise → filter → noiseGain → ambientGain
    osc1.connect(this._ambientGain);
    osc2.connect(this._ambientGain);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this._ambientGain);

    osc1.start(now);
    osc2.start(now);
    noiseSrc.start(now);

    // Fade in over 2s — setValueAtTime anchors the ramp start
    this._ambientGain.gain.setValueAtTime(0.001, now);
    this._ambientGain.gain.linearRampToValueAtTime(targetVol, now + 2);

    this._ambientNodes = { osc1, osc2, noiseSrc, noiseFilter, noiseGain };
    this._ambientActive = true;

    // If currently muted, temporarily unmute masterGain is not our job —
    // ambient will become audible once user unmutes.  But if NOT muted,
    // ensure masterGain is up (it should already be 0.4).
    if (!this._muted && this._masterGain) {
      this._masterGain.gain.value = 0.4;
    }
  }

  stopAmbient() {
    if (!this._ambientActive || !this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    // Fade out over 2s
    this._ambientGain.gain.cancelScheduledValues(now);
    this._ambientGain.gain.setValueAtTime(this._ambientGain.gain.value, now);
    this._ambientGain.gain.linearRampToValueAtTime(0, now + 2);

    const nodes = this._ambientNodes;
    const gain = this._ambientGain;
    setTimeout(() => {
      try { nodes.osc1.stop(); } catch (e) {}
      try { nodes.osc2.stop(); } catch (e) {}
      try { nodes.noiseSrc.stop(); } catch (e) {}
      try { nodes.osc1.disconnect(); } catch (e) {}
      try { nodes.osc2.disconnect(); } catch (e) {}
      try { nodes.noiseSrc.disconnect(); } catch (e) {}
      try { nodes.noiseFilter.disconnect(); } catch (e) {}
      try { nodes.noiseGain.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
    }, 2500);

    this._ambientNodes = null;
    this._ambientGain = null;
    this._ambientActive = false;
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
    // intensity 1 → 0.05, intensity 20 → 0.4
    return 0.05 + (intensity - 1) * (0.35 / 19);
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
      default:
        this._tone(440, 440, 0.1, 'sine', 0.1);
    }
  }
}

export const audio = new AudioEngine();
