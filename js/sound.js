import {
  phraseNotes,
  compositionState,
  gardenPhrase,
  constellationTone,
} from "./composition.js";
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
    this.activeNotes = new Set();
    this.starVoices = new Map();
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
    const ctx = (this.context = new Audio({ latencyHint: "playback" }));
    await ctx.resume();
    const rng = random(this.seed),
      sr = ctx.sampleRate;
    const master = (this.master = ctx.createGain());
    master.gain.value = 0.0001;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.ratio.value = 3;
    limiter.attack.value = 0.003;
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
    const signature = Object.values(contributors)
      .map((c) =>
        (c.pads || [])
          .map((p) => p.map((v) => Math.round(v * 5)).join(","))
          .join("/"),
      )
      .join(";");
    const now = this.context.currentTime;
    if (
      this.positionSignature &&
      signature !== this.positionSignature &&
      now > (this.nextTouch || 0)
    ) {
      const shared = compositionState(contributors);
      const phrase = phraseNotes(shared.branch * 3, contributors, 0.65);
      this.note({ ...phrase[0], duration: 1.8, gain: 0.032 }, now);
      this.nextTouch = now + 0.32;
    }
    this.positionSignature = signature;
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
    const memory = [0, 1, 2, 3].map(
      (index) =>
        entries.reduce(
          (sum, [, c]) =>
            sum +
            (c.memory?.[index] || 0) *
              Math.exp(
                -Math.max(0, Date.now() - (c.memoryAt || Date.now())) / 900000,
              ),
          0,
        ) / Math.max(1, entries.length),
    );
    const gesture = [0, 1, 2, 3].map((index) =>
      Math.min(
        1,
        entries.reduce(
          (sum, [, c]) =>
            sum +
            (c.stars || [])
              .filter((s) => s.index % 4 === index && s.until > Date.now())
              .reduce(
                (n, s) =>
                  n + s.power * Math.min(1, (s.until - Date.now()) / 1200),
                0,
              ),
          0,
        ),
      ),
    );
    const season = (Math.sin(t / (9 + role * 3)) + 1) / 2,
      event = (Math.sin(t / (17 + role * 2)) + 1) / 2;
    for (let i = 0; i < 8; i++) {
      const node = this.nodes[i],
        index = (i + role) % 4;
      const voice =
        mode === "meditation"
          ? entries.find(([, c]) => c.slot === i % 4)?.[1]
          : null;
      const nodePoint = voice?.pads?.[0] || point;
      const nodeTone = voice ? [nodePoint[0], nodePoint[1]] : tone;
      const partner =
        remote.reduce((sum, w, n) => sum + w[(index + 2 + n) % 4], 0) /
        Math.max(1, remote.length);
      const localWeight = voice
        ? quad(...nodePoint)[index]
        : i < 4
          ? local[index]
          : harmony[index];
      const layer =
        mode === "meditation" ? 0.13 + localWeight * 0.5 : localWeight * 0.9;
      const ebb =
        0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t / (5 + i * 2) + i * 1.6));
      node.gain.gain.setTargetAtTime(
        Math.max(
          0.0001,
          (layer + partner * 0.48) *
            (i === 4 ? 0.025 : i < 5 ? 0.13 : 0.22) *
            ebb,
        ),
        t,
        responsive ? 0.16 : 1.2,
      );
      const openness =
        nodePoint[0] * 0.6 +
        (1 - nodePoint[1]) * 0.4 +
        memory[0] * 0.16 -
        memory[3] * 0.12 +
        gesture[0] * 0.35 -
        gesture[1] * 0.22;
      node.filter.frequency.setTargetAtTime(
        node.base * Math.pow(2, (openness - 0.5) * 3.8) * (1 + season * 0.5),
        t,
        responsive ? 0.18 : 2,
      );
      node.filter.Q.setTargetAtTime(
        0.4 + nodeTone[1] * 2.6 + gesture[2] * 2,
        t,
        0.12,
      );
      node.source.playbackRate.setTargetAtTime(
        i >= 5
          ? [1, 1.5, 0.75, 1.125][(i + role) % 4] *
              (0.985 +
                nodeTone[0] * 0.03 +
                memory[1] * 0.025 +
                gesture[3] * 0.04)
          : 0.25 + nodePoint[0] * 1.1 + partner * 0.4,
        t,
        0.5,
      );
      node.variant.playbackRate.setTargetAtTime(
        i >= 5 ? [1.5, 2, 0.5][(i + role) % 3] : 0.35 + nodeTone[1] * 0.9,
        t,
        2,
      );
      const morph = Math.max(
        0,
        Math.min(
          1,
          event * (0.25 + nodeTone[0] * 0.7) +
            partner * 0.22 +
            memory[2] * 0.16 +
            gesture[1] * 0.35,
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
          ? 2 + nodePoint[1] * 10 + gesture[2] * 5
          : 0.015 +
              nodePoint[1] * 0.55 +
              (i % 3) * 0.03 +
              memory[2] * 0.09 +
              gesture[2] * 1.5,
        t,
        responsive ? 0.2 : 2,
      );
      node.depth.gain.setTargetAtTime(0.08 + nodeTone[1] * 0.55, t, 0.2);
      node.pan.pan.setTargetAtTime(
        Math.sin(t / (5 + i) + i) * (0.15 + nodeTone[0] * 0.75),
        t,
        0.6,
      );
    }
    const sharedSpace =
      remoteTone.reduce((n, p) => n + p[1], 0) / Math.max(1, remoteTone.length);
    this.wet.gain.setTargetAtTime(
      0.08 +
        tone[1] * 0.55 +
        sharedSpace * 0.2 +
        memory[3] * 0.12 +
        gesture[1] * 0.25,
      t,
      0.5,
    );
    // Discrete, breathing phrases replace an indefinitely sustained high tone.
    // The third and fourth pads control musical density and spatial movement.
    this.nextMelody ||= 0;
    if (mode === "soundgarden" && t >= this.nextMelody) {
      const shared = compositionState(contributors);
      const phrases = entries
        .filter(([, c]) => c.slot !== -1)
        .map(([id, c], seat) => {
          const melody = c.pads?.[2] || [0.5, 0.5];
          const motion = c.pads?.[3] || [0.5, 0.5];
          return { id, c, seat, melody, motion };
        });
      for (const { c, seat, melody, motion } of phrases) {
        const phrase =
          mode === "soundgarden"
            ? gardenPhrase(contributors, seat, Math.floor(Date.now() / 24000))
            : phraseNotes(
                (seat * 3 + shared.branch) % 12,
                contributors,
                0.45 + melody[0] * 0.4,
              );
        const count =
          mode === "soundgarden"
            ? phrase.length
            : 1 + Math.floor(melody[0] * 3);
        for (const note of phrase.slice(0, count)) {
          this.note(
            {
              ...note,
              frequency:
                note.frequency *
                (mode === "soundgarden"
                  ? 1
                  : melody[1] > 0.7
                    ? 2
                    : melody[1] < 0.3
                      ? 0.5
                      : 1),
              gain:
                (note.gain * (mode === "meditation" ? 0.7 : 0.95)) /
                Math.sqrt(entries.length),
              duration: note.duration * (1 + (1 - motion[0]) * 0.8),
              pan: note.pan * (0.25 + motion[1] * 0.75),
            },
            t + seat * 0.18 + note.delay,
          );
        }
      }
      const density =
        phrases.reduce((n, p) => n + p.melody[0], 0) /
        Math.max(1, phrases.length);
      this.nextMelody = t + 2.4 + (1 - density) * 4;
    }
    for (const [id, c] of entries)
      for (const star of c.stars || []) {
        const key = id + ":" + star.index;
        if (star.until > Date.now()) this.spark(star, role, key);
      }
  }
  spark(star, role, key) {
    const ctx = this.context,
      now = ctx.currentTime;
    this.starVoices ||= new Map();
    const previous = this.starVoices.get(key);
    // A hold updates the envelope of ONE voice; it never adds another phrase.
    if (previous && previous.gesture === star.gesture) {
      if (previous.until === star.until) return;
      previous.until = star.until;
      previous.gain.gain.cancelAndHoldAtTime(now);
      previous.gain.gain.setTargetAtTime(0.025 + star.power * 0.03, now, 0.12);
      previous.gain.gain.setTargetAtTime(
        0.0001,
        now + (star.holding ? 0.4 : 0.12),
        star.holding ? 0.65 : 0.45 + (star.hold || 0) * 0.55,
      );
      previous.filter.frequency.setTargetAtTime(
        700 + star.power * 2600,
        now,
        0.3,
      );
      return;
    }
    if (previous && !star.gesture && previous.until >= star.until) return;
    if (previous) {
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setTargetAtTime(0.0001, now, 0.08);
      previous.osc.stop(now + 0.6);
      previous.shimmer.stop(now + 0.6);
    }
    if (this.starVoices.size >= 24 && !previous) return;
    const frequency = constellationTone(star.index, this.settings.contributors);
    const osc = ctx.createOscillator(),
      shimmer = ctx.createOscillator();
    const gain = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      blend = ctx.createGain();
    osc.type = star.index % 2 ? "sine" : "triangle";
    osc.frequency.value = frequency;
    shimmer.type = "sine";
    shimmer.frequency.value = frequency * 2.003;
    blend.gain.value = 0.12;
    filter.type = "lowpass";
    filter.frequency.value = 700 + star.power * 2600;
    filter.Q.value = 0.45;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      0.025 + star.power * 0.03,
      now + 0.035,
    );
    gain.gain.setTargetAtTime(0.0001, now + 0.12, 0.65);
    osc.connect(filter);
    shimmer.connect(blend).connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    gain.connect(this.reverb);
    const voice = {
      osc,
      shimmer,
      gain,
      filter,
      gesture: star.gesture,
      until: star.until,
    };
    this.starVoices.set(key, voice);
    osc.start(now);
    shimmer.start(now);
    osc.stop(now + 22);
    shimmer.stop(now + 22);
    osc.onended = () => {
      for (const node of [osc, shimmer, blend, filter, gain]) node.disconnect();
      if (this.starVoices.get(key) === voice) this.starVoices.delete(key);
    };
  }
  note(note, at) {
    const ctx = this.context;
    this.activeNotes ||= new Set();
    if (!ctx || ctx.state === "closed" || this.activeNotes.size >= 24) return;
    const presets = [
      {
        attack: 0.32,
        partials: [
          [1, 1],
          [2, 0.12],
          [3, 0.04],
        ],
        cutoff: 1400,
      },
      {
        attack: 0.14,
        partials: [
          [1, 1],
          [2, 0.24],
          [4, 0.045],
        ],
        cutoff: 2200,
      },
      {
        attack: 0.5,
        partials: [
          [1, 1],
          [1.5, 0.1],
          [2, 0.06],
        ],
        cutoff: 1050,
      },
      {
        attack: 0.09,
        partials: [
          [1, 1],
          [2.003, 0.15],
          [3, 0.055],
        ],
        cutoff: 1800,
      },
    ];
    const preset = presets[(note.timbre ?? note.bright ?? 0) % 4];
    const gain = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      pan = ctx.createStereoPanner();
    const oscillators = [],
      weights = [];
    filter.type = "lowpass";
    filter.frequency.value = preset.cutoff;
    filter.Q.value = 0.5;
    pan.pan.value = note.pan;
    const duration = Math.max(preset.attack + 0.2, note.duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(note.gain, at + preset.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    filter.connect(gain).connect(pan);
    pan.connect(this.master);
    pan.connect(this.reverb);
    for (const [ratio, level] of preset.partials) {
      const osc = ctx.createOscillator(),
        weight = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = note.frequency * ratio;
      weight.gain.value = level;
      osc.connect(weight).connect(filter);
      osc.start(at);
      osc.stop(at + duration + 0.05);
      oscillators.push(osc);
      weights.push(weight);
    }
    this.activeNotes.add(gain);
    oscillators[0].onended = () => {
      for (const node of [...oscillators, ...weights, gain, filter, pan])
        node.disconnect();
      this.activeNotes.delete(gain);
    };
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
      if (!this.started && this.context === ctx && ctx.state !== "closed") {
        try {
          await ctx.suspend();
        } catch (error) {
          if (ctx.state !== "closed") throw error;
        }
      }
    }
  }
  destroy() {
    this.started = false;
    clearInterval(this.evolution);
    this.context?.close();
    this.context = null;
    this.nodes = [];
    this.starVoices?.clear();
    this.starPhrases?.clear();
    this.nextMelody = 0;
    this.activeNotes?.clear();
  }
}
