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
      default:
        this._tone(440, 440, 0.1, 'sine', 0.1);
    }
  }
}

export const audio = new AudioEngine();
