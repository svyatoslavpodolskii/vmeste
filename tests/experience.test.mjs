import test from "node:test";
import assert from "node:assert/strict";
import { gardenState, worldScreen } from "../js/worlds.js";
import {
  ownLiked,
  partnerPreference,
  recommendations,
  completedIdea,
} from "../js/plans.js";
const record = (id, author, event) => ({
  id,
  authorId: author,
  worldEvent: { world: "gardenworld", ...event },
});
test("garden needs days to grow, accepts one daily watering per person and preserves archived wishes", () => {
  const at = Date.now(),
    store = {
      data: {
        plans: [
          record("p", "a", {
            type: "plant",
            species: "unique",
            plot: "flower",
            text: "Wish",
            at,
          }),
        ],
      },
    };
  for (let i = 0; i < 5; i++)
    store.data.plans.push(
      record("w" + i, "a", { type: "water", plot: "flower", at: at + i * 100 }),
    );
  let state = gardenState(store, at + 1000);
  assert.equal(state.waters, 1);
  assert.equal(state.plots[0].stage, 1);
  assert.equal(gardenState(store, at + 86400000).bloom, 0);
  store.data.plans.push(
    record("release", "a", { type: "release", plot: "flower", at: at + 2000 }),
  );
  state = gardenState(store, at + 3000);
  assert.equal(state.plots.length, 0);
  assert.equal(state.archived[0].text, "Wish");
  store.data.plans.push(
    record("restore", "b", { type: "restore", plot: "flower", at: at + 4000 }),
  );
  state = gardenState(store, at + 7 * 86400000);
  assert.equal(state.plots.length, 1);
  assert.equal(state.bloom, 1);
  const html = worldScreen(
    { kind: "gardenworld", public: { ...state, players: [] } },
    true,
  );
  assert.ok(html.includes('data-world="release"'));
});
test("a thousand wishes remain available without duplicating plots", () => {
  const store = {
    data: {
      plans: Array.from({ length: 1200 }, (_, i) =>
        record("p" + i, "a", {
          type: "plant",
          species: "unique",
          plot: String(i),
          at: i,
          text: "Wish" + i,
        }),
      ),
    },
  };
  assert.equal(gardenState(store).plots.length, 1200);
});
test("discovery omits own likes and completed activities while plan recommendations retain likes", () => {
  const store = {
    userId: "a",
    ideas: [{ id: "own" }, { id: "partner" }, { id: "new" }, { id: "done" }],
    data: {
      reactions: [
        { ideaId: "own", userId: "a", reaction: "favorite" },
        { ideaId: "partner", userId: "b", reaction: "like" },
      ],
      plans: [{ completedIdea: "done", completedAt: 1 }],
    },
  };
  assert.ok(ownLiked(store, "own"));
  assert.equal(partnerPreference(store, "partner"), 2);
  assert.ok(completedIdea(store, "done"));
  assert.deepEqual(
    recommendations(store, [], { discover: true }).map((i) => i.id),
    ["partner", "new"],
  );
  assert.equal(recommendations(store)[0].id, "own");
});
