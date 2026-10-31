import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(process.env.VMESTE_BASE || "http://127.0.0.1:4173");
  const result = await page.evaluate(async () => {
    const { NatureSound, seamlessLoop } = await import("./js/sound.js");
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const sound = new NatureSound("audio-regression-one");
    await sound.start();
    const layers = Array(8).fill(0);
    layers[6] = 1;
    sound.apply(
      { me: { layers, moods: [0.5, 0.3, 0.6, 0.7] } },
      "me",
      "soundgarden",
    );
    sound.volume(0.27);
    const analyser = sound.context.createAnalyser();
    analyser.fftSize = 2048;
    sound.master.connect(analyser);
    const energy = () => {
      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
    };
    await sleep(1600);
    const firstEnergy = energy();
    const ownPad = sound.nodes[6].gain.gain.value;
    const otherPad = sound.nodes[1].gain.gain.value;
    const harmonic = sound.nodes.slice(5).map(({ source }) => {
      const d = source.buffer.getChannelData(0);
      return {
        edge: Math.abs(d[0] - d[d.length - 1]),
        rate: source.playbackRate.value,
      };
    });
    await sound.stop();
    const stopped = sound.context.state;
    await sound.start();
    await sleep(1600);
    const resumedEnergy = energy();
    const resumedGain = sound.master.gain.value;
    const level = sound.level;
    // A fast stop/start must not let an older suspend timer silence playback.
    const pending = sound.stop();
    await sound.start();
    await pending;
    const fastRestart = sound.context.state;
    const sameContext = sound.context;
    await sound.stop();
    await sound.start();
    const contextReused = sound.context === sameContext;
    sound.apply(
      {
        me: {
          pads: [
            [0, 1],
            [0, 0],
          ],
        },
      },
      "me",
      "soundgarden",
    );
    await sleep(600);
    const lowCutoff = sound.nodes[0].filter.frequency.value;
    sound.apply(
      {
        me: {
          pads: [
            [1, 0],
            [1, 1],
          ],
        },
      },
      "me",
      "soundgarden",
    );
    await sleep(600);
    const highCutoff = sound.nodes[0].filter.frequency.value;
    sound.apply(
      {
        me: {
          pads: [
            [0, 0],
            [0, 0],
          ],
        },
      },
      "me",
      "soundgarden",
    );
    await sleep(700);
    const quietLayer = sound.nodes[1].gain.gain.value;
    sound.apply(
      {
        me: {
          pads: [
            [0, 0],
            [0, 0],
          ],
        },
        partner: {
          pads: [
            [1, 1],
            [0.3, 0.8],
          ],
        },
      },
      "me",
      "soundgarden",
    );
    await sleep(700);
    const partnerLayer = sound.nodes[1].gain.gain.value;
    sound.destroy();
    // Boundary follows the original tail's adjacent samples, rather than jumping
    // back to the beginning of an unrelated random buffer.
    const raw = Float32Array.from({ length: 100 }, (_, i) =>
      Math.sin(i * 0.12),
    );
    const loop = seamlessLoop(raw, 20);
    return {
      lowCutoff,
      highCutoff,
      quietLayer,
      partnerLayer,
      firstEnergy,
      resumedEnergy,
      resumedGain,
      level,
      ownPad,
      otherPad,
      harmonic,
      stopped,
      fastRestart,
      contextReused,
      boundary: Math.abs(loop[0] - loop.at(-1)),
      original: Math.abs(raw[80] - raw[79]),
    };
  });
  assert.ok(result.highCutoff > result.lowCutoff * 5, JSON.stringify(result));
  assert.ok(
    result.partnerLayer > result.quietLayer * 5,
    JSON.stringify(result),
  );
  assert.ok(result.firstEnergy > 0.00005, JSON.stringify(result));
  assert.ok(result.resumedEnergy > 0.00005, JSON.stringify(result));
  assert.ok(Math.abs(result.resumedGain - 0.216) < 0.005);
  assert.equal(result.level, 0.27);
  assert.equal(result.stopped, "suspended");
  assert.equal(result.fastRestart, "running");
  assert.equal(result.contextReused, true);
  assert.ok(result.ownPad > 0 && result.otherPad > 0);
  assert.ok(
    result.harmonic.every(
      (v) => v.edge < 0.012 && v.rate > 0.4 && v.rate < 2.1,
    ),
  );
  assert.ok(Math.abs(result.boundary - result.original) < 0.000001);
  console.log(
    "PASS audible signal before/after pause, preserved volume, rapid resume, evolving pad spectrum, seamless noise and harmonic loops",
  );
} finally {
  await browser.close();
}
