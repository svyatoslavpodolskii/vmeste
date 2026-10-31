import test from "node:test";
import assert from "node:assert/strict";
import { acceptGameFrame } from "../js/game-protocol.js";
import { RoomPeer } from "../js/peer.js";
test("closed rounds survive a newer round of the same game and persisted history", () => {
  const games = new Map();
  const first = {
    kind: "meditation",
    round: "first",
    stage: "running",
    createdAt: 1,
    revision: 1,
    ownerDevice: "A",
  };
  acceptGameFrame(games, first, 10);
  acceptGameFrame(
    games,
    { ...first, finished: true, closedAt: 20, revision: 2 },
    20,
  );
  const next = { ...first, round: "next", createdAt: 30 };
  acceptGameFrame(games, next, 30);
  const restored = new Map(games);
  restored.closedRounds = new Map(
    JSON.parse(JSON.stringify([...games.closedRounds])),
  );
  assert.equal(
    acceptGameFrame(restored, { ...first, revision: 999 }, 40).chosen.round,
    "next",
  );
  assert.equal(
    acceptGameFrame(
      restored,
      { ...first, finished: true, closedAt: 20, revision: 1000 },
      41,
    ).chosen.round,
    "next",
  );
  assert.equal(restored.get("meditation").finished, undefined);
});
test("a guest replays only authored frames, while the hub may relay foreign games", () => {
  const own = { round: "own", controller: "A", controllerClient: "a-client" };
  const foreign = {
    round: "foreign",
    controller: "B",
    controllerClient: "b-client",
  };
  const peer = {
    peer: { id: "a-client" },
    store: { userId: "A" },
    games: new Map([
      ["a", own],
      ["b", foreign],
    ]),
    isHub: false,
  };
  assert.deepEqual(RoomPeer.prototype.framesForConnection.call(peer), [own]);
  peer.isHub = true;
  assert.deepEqual(RoomPeer.prototype.framesForConnection.call(peer), [
    own,
    foreign,
  ]);
});
test("hub retains moves while the controller reconnects and routes each once to the new client", () => {
  const sent = [];
  const game = { round: "rejoin", controllerClient: "old-client" };
  const hub = {
    peer: { id: "hub" },
    games: new Map([["race", game]]),
    sessions: new Map(),
    pendingCommands: [],
    routeInput: RoomPeer.prototype.routeInput,
  };
  hub.routeInput("B", { round: "rejoin", action: "run-ready", turn: 0 });
  assert.equal(hub.pendingCommands.length, 1);
  game.controllerClient = "new-client";
  hub.sessions.set("new-client", {
    admission: { authorized: true },
    c: { open: true, send: (m) => sent.push(m) },
  });
  RoomPeer.prototype.flushCommands.call(hub);
  assert.equal(hub.pendingCommands.length, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].sender, "B");
  RoomPeer.prototype.flushCommands.call(hub);
  assert.equal(sent.length, 1);
  game.finished = true;
  hub.routeInput("B", { round: "rejoin", action: "run-ready", turn: 0 });
  assert.equal(sent.length, 1);
});
test("one live host per device converges across replay order and cannot resurrect a superseded lobby", () => {
  const older = {
    kind: "museum",
    round: "old",
    stage: "lobby",
    createdAt: 1,
    revision: 10,
    ownerDevice: "device-A",
  };
  const newer = {
    kind: "choice",
    round: "new",
    stage: "lobby",
    createdAt: 2,
    revision: 1,
    ownerDevice: "device-A",
  };
  for (const order of [
    [older, newer],
    [newer, older],
  ]) {
    const games = new Map();
    order.forEach((f) => acceptGameFrame(games, f, 100));
    assert.ok(games.get("museum").finished);
    assert.equal(games.get("choice").finished, undefined);
    acceptGameFrame(games, { ...older, revision: 999 }, 200);
    assert.ok(games.get("museum").finished);
    acceptGameFrame(
      games,
      {
        kind: "beacon",
        round: "B",
        stage: "running",
        createdAt: 3,
        ownerDevice: "device-B",
      },
      300,
    );
    assert.equal([...games.values()].filter((f) => !f.finished).length, 2);
    acceptGameFrame(
      games,
      {
        kind: "gardenworld",
        round: "world",
        stage: "persistent",
        ownerDevice: "device-A",
      },
      400,
    );
    assert.equal(games.get("choice").finished, undefined);
  }
});
test("host processes its own moves without a hub round-trip and disconnected guest moves wait for an authenticated route", () => {
  const bus = new EventTarget();
  globalThis.window = bus;
  const received = [],
    sent = [];
  bus.addEventListener("vmeste-game-input", (e) => received.push(e.detail));
  let sessions = [];
  const peer = {
    store: { userId: "A" },
    peer: { id: "client-A" },
    games: new Map([
      ["own", { round: "own", controllerClient: "client-A" }],
      ["remote", { round: "remote", controllerClient: "client-B" }],
    ]),
    pendingInputs: [],
    players: () => sessions,
    isHub: false,
    sendInput: RoomPeer.prototype.sendInput,
  };
  peer.sendInput({ round: "own", action: "join" });
  assert.equal(received.length, 1);
  peer.sendInput({ round: "remote", action: "join" });
  peer.sendInput({ round: "remote", action: "ready" });
  assert.equal(peer.pendingInputs.length, 2);
  sessions = [{ c: { open: true, send: (message) => sent.push(message) } }];
  RoomPeer.prototype.flushInputs.call(peer);
  assert.equal(peer.pendingInputs.length, 0);
  assert.deepEqual(
    sent.map((m) => m.input.action),
    ["join", "ready"],
  );
});
