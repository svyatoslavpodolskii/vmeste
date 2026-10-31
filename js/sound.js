import { quad } from "./sound-controls.js";
export const soundLayers = [
  "Берег",
  "Дождь",
  "Листва",
  "Ветер",
  "Ночь",
  "Воздух",
  "Свет",
  "Глубина",
];
function random(seed) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    return (n >>> 0) / 4294967296;
  };
}
// Fold the extra tail into the beginning: the loop boundary follows the
// original continuous signal, with a smooth crossfade away from the boundary.
export function seamlessLoop(raw, overlap) {
  const length = raw.length - overlap;
  const result = raw.slice(0, length);
  for (let n = 0; n < overlap; n++) {
    const t = n / (overlap - 1);
    const mix = t * t * (3 - 2 * t);
    result[n] = raw[length + n] * (1 - mix) + raw[n] * mix;
  }
  return result;
}
export class NatureSound {
  constructor(seed) {
    this.seed = seed;
    this.nodes = [];
    this.started = false;
    this.level = 0.65;
  }
  async start() {
    if (this.context) {
      await this.context.resume();
      this.started = true;
      this.volume(this.level);
      return;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw Error("В этом браузере звук недоступен");
    const ctx = (this.context = new Audio());
    await ctx.resume();
    const rng = random(this.seed),
      sr = ctx.sampleRate;
    const master = (this.master = ctx.createGain());
    master.gain.value = 0.0001;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.ratio.value = 3;
    limiter.attack.value = 0.08;
    limiter.release.value = 1.2;
    master.connect(limiter).connect(ctx.destination);
    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    dry.connect(master);
    const reverb = (this.reverb = ctx.createConvolver()),
      impulse = ctx.createBuffer(2, sr * 4, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = impulse.getChannelData(ch);
      let low = 0;
      for (let n = 0; n < d.length; n++) {
        low = 0.7 * low + 0.3 * (rng() * 2 - 1);
        d[n] = low * Math.pow(1 - n / d.length, 2.7);
      }
    }
    reverb.buffer = impulse;
    const wet = (this.wet = ctx.createGain());
    wet.gain.value = 0.24;
    reverb.connect(wet).connect(master);
    const buffers = [];
    for (let type = 0; type < 3; type++) {
      const buffer = ctx.createBuffer(2, sr * 7, sr);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        const overlap = Math.round(sr * 0.75);
        const raw = new Float32Array(data.length + overlap);
        let brown = 0,
          pink = 0;
        for (let n = 0; n < raw.length; n++) {
          const white = rng() * 2 - 1;
          brown = (brown + 0.02 * white) / 1.02;
          pink = 0.985 * pink + 0.015 * white;
          raw[n] = type === 0 ? white * 0.3 : type === 1 ? pink * 3 : brown * 3;
        }
        data.set(seamlessLoop(raw, overlap));
      }
      buffers.push(buffer);
    }
    // Sustained, beatless harmonic beds: no note attacks or MIDI instruments.
    // Integer cycles make every partial periodic at the buffer boundary.
    const beds = [];
    for (const root of [165, 220, 110]) {
      const seconds = 8;
      const buffer = ctx.createBuffer(2, sr * seconds, sr);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (const [ratio, weight] of [
          [1, 0.12],
          [1.5, 0.045],
          [2, 0.025],
          [3, 0.009],
        ]) {
          const cycles = Math.round(root * ratio * seconds) + (ch ? 1 : -1);
          const phase = rng() * Math.PI * 2;
          for (let n = 0; n < data.length; n++) {
            const t = n / data.length;
            data[n] +=
              Math.sin(2 * Math.PI * cycles * t + phase) *
              weight *
              (0.7 + 0.3 * Math.cos(2 * Math.PI * t + phase));
          }
        }
      }
      beds.push(buffer);
    }
    const lowpass = [500, 5500, 1800, 900, 4600, 2900, 450, 150];
    for (let i = 0; i < 8; i++) {
      const source = ctx.createBufferSource();
      source.buffer =
        i >= 5
          ? beds[i - 5]
          : buffers[i === 1 || i === 4 ? 0 : i === 0 ? 2 : 1];
      source.loop = true;
      source.playbackRate.value = i >= 5 ? 1 : 0.82 + rng() * 0.37;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = i === 4 ? 3100 : i === 1 ? 600 : i === 2 ? 400 : 40;
      const filter = ctx.createBiquadFilter();
      filter.type = i === 4 ? "bandpass" : "lowpass";
      filter.frequency.value = lowpass[i] * (0.8 + rng() * 0.4);
      filter.Q.value = i === 4 ? 1.2 : 0.5;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      const drift = ctx.createGain();
      drift.gain.value = 0.65;
      const lfo = ctx.createOscillator(),
        depth = ctx.createGain();
      lfo.frequency.value = i === 4 ? 5 + rng() * 2 : 0.015 + rng() * 0.12;
      depth.gain.value = i === 4 ? 0.2 : 0.28;
      lfo.connect(depth).connect(drift.gain);
      lfo.start();
      const pan = ctx.createStereoPanner();
      pan.pan.value = (rng() - 0.5) * 1.2;
      const primary = ctx.createGain(),
        alternate = ctx.createGain(),
        variant = ctx.createBufferSource();
      primary.gain.value = 1;
      alternate.gain.value = 0;
      variant.buffer = i >= 5 ? beds[(i - 4) % 3] : buffers[(i + 1) % 3];
      variant.loop = true;
      variant.playbackRate.value = source.playbackRate.value;
      variant.connect(alternate).connect(hp);
      variant.start(0, rng() * 5);
      source
        .connect(primary)
        .connect(hp)
        .connect(filter)
        .connect(gain)
        .connect(drift)
        .connect(pan);
      pan.connect(dry);
      pan.connect(reverb);
      source.start(0, rng() * 6);
      this.nodes.push({
        source,
        variant,
        primary,
        alternate,
        depth,
        hp,
        filter,
        gain,
        lfo,
        pan,
        base: lowpass[i],
      });
    }
    this.started = true;
    this.volume(this.level);
    this.evolution = setInterval(() => this.evolve(), 500);
  }
  apply(contributors, ownId, mode) {
    if (!this.context || !this.started) return;
    this.settings = { contributors, ownId, mode };
    this.evolve(true);
  }
  evolve(touch = false) {
    if (!this.started || !this.context || !this.settings) return;
    const { contributors, ownId, mode } = this.settings,
      ctx = this.context,
      t = ctx.currentTime;
    if (touch) {
      this.interactiveUntil = t + 0.9;
      for (const node of this.nodes)
        for (const param of [
          node.gain.gain,
          node.filter.frequency,
          node.filter.Q,
          node.source.playbackRate,
          node.variant.playbackRate,
          node.lfo.frequency,
          node.depth.gain,
          node.pan.pan,
        ]) {
          if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
          else {
            const value = param.value;
            param.cancelScheduledValues(t);
            param.setValueAtTime(value, t);
          }
        }
    }
    const responsive = touch || t < (this.interactiveUntil || 0);
    const entries = Object.entries(contributors),
      own = contributors[ownId] || {};
    const role = Math.max(
      0,
      entries.findIndex(([id]) => id === ownId),
    );
    const point = own.pads?.[0] || [0.5, 0.5],
      tone = own.pads?.[1] || [0.45, 0.65];
    const local = quad(...point),
      harmony = quad(...tone);
    const others = entries.filter(([id]) => id !== ownId);
    const remote = others.map(([, c]) => quad(...(c.pads?.[0] || [0.5, 0.5])));
    const remoteTone = others.map(([, c]) => c.pads?.[1] || [0.5, 0.5]);
    const memory = (own.memory || [0, 0, 0, 0]).map(
      (n) =>
        n *
        Math.exp(
          -Math.max(0, Date.now() - (own.memoryAt || Date.now())) / 900000,
        ),
    );
    const season = (Math.sin(t / (9 + role * 3)) + 1) / 2,
      event = (Math.sin(t / (17 + role * 2)) + 1) / 2;
    for (let i = 0; i < 8; i++) {
      const node = this.nodes[i],
        index = (i + role) % 4;
      const partner =
        remote.reduce((sum, w, n) => sum + w[(index + 2 + n) % 4], 0) /
        Math.max(1, remote.length);
      const localWeight = i < 4 ? local[index] : harmony[index];
      const layer =
        mode === "meditation" ? 0.13 + localWeight * 0.5 : localWeight * 0.9;
      const ebb =
        0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t / (5 + i * 2) + i * 1.6));
      node.gain.gain.setTargetAtTime(
        Math.max(
          0.0001,
          (layer + partner * 0.48) * (i === 4 ? 0.08 : i < 5 ? 0.4 : 0.3) * ebb,
        ),
        t,
        responsive ? 0.16 : 1.2,
      );
      const openness =
        point[0] * 0.6 +
        (1 - point[1]) * 0.4 +
        memory[0] * 0.16 -
        memory[3] * 0.12;
      node.filter.frequency.setTargetAtTime(
        node.base * Math.pow(2, (openness - 0.5) * 3.8) * (1 + season * 0.5),
        t,
        responsive ? 0.18 : 2,
      );
      node.filter.Q.setTargetAtTime(0.4 + tone[1] * 2.6, t, 0.35);
      node.source.playbackRate.setTargetAtTime(
        i >= 5
          ? [1, 1.5, 0.75, 1.125][(i + role) % 4] *
              (0.985 + tone[0] * 0.03 + memory[1] * 0.025)
          : 0.25 + point[0] * 1.1 + partner * 0.4,
        t,
        0.5,
      );
      node.variant.playbackRate.setTargetAtTime(
        i >= 5 ? [1.5, 2, 0.5][(i + role) % 3] : 0.35 + tone[1] * 0.9,
        t,
        2,
      );
      const morph = Math.max(
        0,
        Math.min(
          1,
          event * (0.25 + tone[0] * 0.7) + partner * 0.22 + memory[2] * 0.16,
        ),
      );
      node.primary.gain.setTargetAtTime(
        Math.cos((morph * Math.PI) / 2),
        t,
        2.5,
      );
      node.alternate.gain.setTargetAtTime(
        Math.sin((morph * Math.PI) / 2),
        t,
        2.5,
      );
      node.lfo.frequency.setTargetAtTime(
        i === 4
          ? 2 + point[1] * 10
          : 0.015 + point[1] * 0.55 + (i % 3) * 0.03 + memory[2] * 0.09,
        t,
        responsive ? 0.2 : 2,
      );
      node.depth.gain.setTargetAtTime(0.08 + tone[1] * 0.55, t, 0.4);
      node.pan.pan.setTargetAtTime(
        Math.sin(t / (5 + i) + i) * (0.15 + tone[0] * 0.75),
        t,
        0.6,
      );
    }
    const sharedSpace =
      remoteTone.reduce((n, p) => n + p[1], 0) / Math.max(1, remoteTone.length);
    this.wet.gain.setTargetAtTime(
      0.08 + tone[1] * 0.55 + sharedSpace * 0.2 + memory[3] * 0.12,
      t,
      0.5,
    );
    // Constellations are transient gestures; they never accumulate without bound.
    this.starSeen ||= new Map();
    for (const [id, c] of entries)
      for (const star of c.stars || []) {
        const key = id + ":" + star.index,
          previous = this.starSeen.get(key) || 0;
        if (star.until > Date.now() && star.until > previous + 300) {
          this.starSeen.set(key, star.until);
          this.spark(star, role);
        }
      }
  }
  spark(star, role) {
    const ctx = this.context,
      t = ctx.currentTime,
      remaining = Math.max(0.2, Math.min(12, (star.until - Date.now()) / 1000)),
      osc = ctx.createOscillator(),
      gain = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    osc.type = star.index % 2 ? "sine" : "triangle";
    osc.frequency.value = [110, 165, 220, 330][(star.index + role) % 4];
    osc.frequency.exponentialRampToValueAtTime(
      osc.frequency.value * (star.index === 2 ? 1.5 : 1.003),
      t + remaining,
    );
    filter.type = "lowpass";
    filter.frequency.value = 400 + star.power * 3200;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.015 + star.power * 0.045, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + remaining);
    osc.connect(filter).connect(gain).connect(this.reverb);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + remaining + 0.1);
  }

  volume(value) {
    this.level = Math.max(0, Math.min(1, value));
    if (this.context)
      this.master.gain.setTargetAtTime(
        this.level * 0.8,
        this.context.currentTime,
        0.3,
      );
  }
  async stop() {
    this.started = false;
    if (this.context) {
      const ctx = this.context;
      this.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
      await new Promise((r) => setTimeout(r, 800));
      if (!this.started) await ctx.suspend();
    }
  }
  destroy() {
    this.started = false;
    clearInterval(this.evolution);
    this.context?.close();
    this.context = null;
    this.nodes = [];
  }
}
