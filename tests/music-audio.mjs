import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4173");
  const result = await page.evaluate(async () => {
    const { NatureSound } = await import("./js/sound.js");
    const sound = new NatureSound("ensemble-stress");
    await sound.start();
    const now = Date.now();
    const room = Object.fromEntries(
      Array.from({ length: 4 }, (_, slot) => [
        String(slot),
        {
          slot,
          pads: [
            [slot / 3, 1 - slot / 3],
            [0.45, 0.6],
            [1, 0.5],
            [0.5, 0.5],
          ],
          stars: Array.from({ length: 3 }, (_, i) => ({
            index: slot + i * 4,
            power: 1,
            until: now + 1800,
          })),
        },
      ]),
    );
    const analyser = sound.context.createAnalyser();
    analyser.fftSize = 4096;
    sound.master.connect(analyser);
    let peak = 0,
      rms = 0,
      maxVoices = 0;
    for (let i = 0; i < 60; i++) {
      sound.apply(room, "0", "meditation");
      maxVoices = Math.max(maxVoices, sound.starVoices?.size || 0);
    }
    for (let i = 0; i < 12; i++) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      peak = Math.max(peak, ...samples.map(Math.abs));
      rms = Math.max(
        rms,
        Math.sqrt(samples.reduce((sum, n) => sum + n * n, 0) / samples.length),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const released = [...sound.starVoices.values()].every(
      (voice) => voice.gain.gain.value < 0.0005,
    );
    sound.destroy();
    return {
      peak,
      rms,
      maxVoices,
      released,
      afterClose: sound.activeNotes.size,
    };
  });
  assert.ok(
    result.maxVoices <= 24 && result.maxVoices > 0,
    JSON.stringify(result),
  );
  assert.ok(result.released, JSON.stringify(result));
  assert.ok(result.rms > 0.00005 && result.peak < 0.8, JSON.stringify(result));
  assert.equal(result.afterClose, 0);
  console.log(
    "PASS twelve simultaneous gestures stay audible and bounded; notes release and close cleans up",
    result,
  );
} finally {
  await browser.close();
}
