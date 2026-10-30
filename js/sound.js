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
      source
        .connect(hp)
        .connect(filter)
        .connect(gain)
        .connect(drift)
        .connect(pan);
      pan.connect(dry);
      pan.connect(reverb);
      source.start(0, rng() * 6);
      this.nodes.push({ source, hp, filter, gain, lfo, pan, base: lowpass[i] });
    }
    this.started = true;
    this.volume(this.level);
  }
  apply(contributors, ownId, mode) {
    if (!this.context || !this.started) return;
    const ctx = this.context,
      own = contributors[ownId] || {},
      others = Object.entries(contributors)
        .filter(([id]) => id !== ownId)
        .map(([, v]) => v);
    const values = Object.values(contributors),
      average = (index, fallback) =>
        values.length
          ? values.reduce((s, v) => s + (v.moods?.[index] ?? fallback), 0) /
            values.length
          : fallback;
    const warmth = average(0, 0.55),
      motion = average(1, 0.35),
      space = average(2, 0.6),
      softness = average(3, 0.7);
    const rng = random(this.seed),
      offset = Math.floor(rng() * 8);
    for (let i = 0; i < 8; i++) {
      const index = i,
        local = own.layers?.[index] ?? (index < 3 ? 1 : 0),
        remote = others.length
          ? others.reduce(
              (s, v) => s + (v.layers?.[(index + 3 + offset) % 8] ?? 0),
              0,
            ) / others.length
          : 0;
      const level =
        mode === "meditation"
          ? (0.16 + (i % 3 === 0 ? 0.5 : 0.15)) *
            ((i < 4 ? 1 - warmth * 0.4 : warmth * 0.65) + 0.2)
          : local * 0.65 + remote * 0.45;
      const texture = i === 4 ? 0.12 : i === 1 ? 0.3 : 0.5;
      this.nodes[i].gain.gain.setTargetAtTime(
        Math.max(0.0001, level * texture * (0.65 + softness * 0.35)),
        ctx.currentTime,
        2.5,
      );
      this.nodes[i].filter.frequency.setTargetAtTime(
        this.nodes[i].base * (0.65 + (1 - softness) * 0.55 + warmth * 0.25),
        ctx.currentTime,
        3,
      );
      this.nodes[i].lfo.frequency.setTargetAtTime(
        i === 4 ? 4 + motion * 5 : 0.012 + motion * 0.13 + (i % 3) * 0.025,
        ctx.currentTime,
        3,
      );
    }
    this.wet.gain.setTargetAtTime(0.1 + space * 0.45, ctx.currentTime, 3);
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
    this.context?.close();
    this.context = null;
    this.nodes = [];
  }
}
