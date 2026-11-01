import test from "node:test";
import assert from "node:assert/strict";
import {
  initBeacon,
  prepareBeacon,
  beaconSecret,
  beaconPublic,
  beaconEvaluation,
} from "../js/beacon.js";
import { resolveBeaconGuide, guideFields } from "../js/beacon-help.js";
import { beaconMechanism } from "../js/beacon-ui.js";
test("interactive book resolves every module from spoken readings and private manual, without leaking solutions publicly", () => {
  const seen = new Set();
  for (let seed = 0; seed < 30; seed++) {
    const s = {
      round: "human-book-" + seed,
      players: [{ id: "a" }, { id: "b" }],
      started: 1000,
    };
    initBeacon(s, 6);
    for (let turn = 0; turn < 6; turn++) {
      s.turn = turn;
      prepareBeacon(s);
      const q = s.machine,
        id = s.module.id;
      seen.add(id);
      const guide = beaconSecret(s, s.guides[0]),
        engineer = beaconSecret(s, s.engineer);
      assert.equal(resolveBeaconGuide(id, guide.manual, {}), null);
      const r = resolveBeaconGuide(
        id,
        guide.manual,
        Object.fromEntries(
          guideFields[id].map((key) => [
            key,
            Number(engineer.observations[key]),
          ]),
        ),
      );
      assert.ok(r);
      if (id === "prism") {
        q.order = r.order;
        q.angle = r.angle;
        assert.ok(beaconEvaluation(s).ok);
      }
      if (id === "power") {
        assert.equal(r.minLight, q.minLight);
        assert.equal(r.maxHeat, q.maxHeat);
      }
      if (id === "coolant") {
        assert.equal(r.material, q.allowed);
        assert.equal(r.forbidden, q.forbidden === 0 ? "вверх" : "влево");
      }
      if (id === "signal") {
        const observed = r.reversed ? [...q.observed].reverse() : q.observed;
        assert.deepEqual(
          observed.flatMap((n) => r.dictionary[n]),
          q.answerSignal,
        );
      }
      if (id === "pendulum") {
        assert.equal(r.ratio, q.ratio);
        assert.equal(Number(r.direction), q.answerDirection);
        assert.equal(r.phase, q.answerPhase);
      }
      if (id === "navigation") {
        assert.equal(r.water, q.preferred);
        assert.equal(r.cargo, q.needCargo);
      }
      const pub = beaconPublic(s);
      assert.ok(pub.display);
      assert.ok(!Object.keys(pub.display).some((k) => k.startsWith("answer")));
      assert.ok(!pub.display.manual);
      assert.ok(!pub.display.serial);
      s.phase = "repair";
      const html = beaconMechanism(beaconPublic(s));
      assert.ok(html.includes("beacon-monitor-mechanism"));
      assert.ok(!html.includes("data-party="));
    }
  }
  assert.equal(seen.size, 6);
});
