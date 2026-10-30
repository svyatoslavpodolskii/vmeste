import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  RoomAuth,
  makeIdentity,
  signProof,
  verifyProof,
  pairingSymbols,
  keyId,
} from "../js/auth.js";
import { Database } from "../js/db.js";
import { Store } from "../js/store.js";
import { gamePool, sessionDeck, cardKey } from "../js/game-pools.js";
import { roomSymbols } from "../js/rooms.js";
import { avatars, illustrations } from "../data/presentation.js";
const room = "room-with-long-random-test-identity";
async function store(id) {
  const s = await new Store(
    await new Database(crypto.randomUUID()).open(),
    room,
    id,
  ).load();
  await s.save("users", {
    id: `${room}:${id}`,
    localUserId: id,
    displayName: id,
  });
  return s;
}
async function wire(a, b, modify = (x) => x) {
  a.options.onConfirm ||= async () => true;
  b.options.onConfirm ||= async () => true;
  let count = 0;
  const queue = [];
  const ca = {
      open: true,
      peer: "device-b",
      peerConnection: {
        localDescription: { sdp: "a=fingerprint:sha-256 AA" },
        remoteDescription: { sdp: "a=fingerprint:sha-256 BB" },
      },
      send: (m) => queue.push([1, modify(structuredClone(m), 0)]),
      close: () => {
        ca.open = cb.open = false;
      },
    },
    cb = {
      open: true,
      peer: "device-a",
      peerConnection: {
        localDescription: { sdp: "a=fingerprint:sha-256 BB" },
        remoteDescription: { sdp: "a=fingerprint:sha-256 AA" },
      },
      send: (m) => queue.push([0, modify(structuredClone(m), 1)]),
      close: () => {
        ca.open = cb.open = false;
      },
    };
  const sessions = [
    a.attach(ca, "a", () => count++),
    b.attach(cb, "b", () => count++),
  ];
  for (let n = 0; queue.length && n < 100; n++) {
    const [to, msg] = queue.shift();
    if (msg && ca.open && cb.open) await sessions[to].receive(msg);
  }
  return { sessions, count };
}
test("signatures bind payload and nonce; both sides derive the same positive code", async () => {
  const a = await makeIdentity(),
    b = await makeIdentity(),
    payload = [room, "A", "B", "fresh-nonce"];
  const signature = await signProof(a.privateKey, payload);
  assert.ok(await verifyProof(a.publicKey, payload, signature));
  assert.equal(
    await verifyProof(a.publicKey, [...payload, "tampered"], signature),
    false,
  );
  assert.equal(await verifyProof(b.publicKey, payload, signature), false);
  const ah = { publicKey: a.publicKey, nonce: "a" },
    bh = { publicKey: b.publicKey, nonce: "b" };
  assert.equal(
    await pairingSymbols(room, ah, bh),
    await pairingSymbols(room, bh, ah),
  );
  assert.notEqual(
    await pairingSymbols(room, ah, bh),
    await pairingSymbols(room, { ...ah, nonce: "other" }, bh),
  );
});
test("new device is approved, assigned a host-generated role, then reconnects without choosing a role", async () => {
  const a = await store("host"),
    b = await store("claimed-host");
  let asks = 0;
  const aa = await RoomAuth.create(a, {
      established: true,
      onRequest: async (req) => {
        asks++;
        return { target: req.targets[0].id };
      },
    }),
    ba = await RoomAuth.create(b, {
      onAdmitted: async (id) => {
        b.userId = id;
      },
    });
  const first = await wire(aa, ba);
  assert.equal(first.count, 2);
  assert.equal(asks, 1);
  assert.notEqual(b.userId, "claimed-host");
  assert.equal(aa.record.roster.length, 2);
  assert.equal(ba.record.memberId, b.userId);
  const second = await wire(aa, ba);
  assert.equal(second.count, 2);
  assert.equal(asks, 1);
  assert.ok(!JSON.stringify(a.export()).includes("privateKey"));
  a.db.close();
  b.db.close();
});
test("denied device and forged signature never authorize", async () => {
  const a = await store("host"),
    b = await store("guest");
  const aa = await RoomAuth.create(a, {
      established: true,
      onRequest: async () => false,
    }),
    ba = await RoomAuth.create(b);
  assert.equal((await wire(aa, ba)).count, 0);
  assert.equal(ba.record.established, false);
  assert.equal(aa.record.roster.length, 1);
  const x = await store("x"),
    xa = await RoomAuth.create(x);
  const hacked = await wire(aa, xa, (m, from) => {
    if (m.type === "auth-proof" && from === 1) m.signature[0] ^= 1;
    return m;
  });
  assert.equal(hacked.count, 0);
  a.db.close();
  b.db.close();
  x.db.close();
});
test("full pair blocks a third player but accepts a separate display without adding a role", async () => {
  const a = await store("A"),
    b = await store("B");
  const aa = await RoomAuth.create(a, {
      established: true,
      onRequest: async (r) => ({ target: r.targets[0].id }),
    }),
    ba = await RoomAuth.create(b, {
      onAdmitted: async (id) => (b.userId = id),
    });
  await wire(aa, ba);
  aa.options.onlineMembers = () => new Set(aa.record.roster.map((r) => r.id));
  const c = await store("C"),
    ca = await RoomAuth.create(c);
  assert.equal((await wire(aa, ca)).count, 0);
  const d = await store("D"),
    da = await RoomAuth.create(d, { requestedMode: "display" });
  assert.equal((await wire(aa, da)).count, 2);
  assert.equal(aa.record.roster.length, 2);
  assert.equal(da.record.viewer, true);
  a.db.close();
  b.db.close();
  c.db.close();
  d.db.close();
});
test("questions and truth are one pool; fresh authored prompts lead, old ones rotate", async () => {
  const s = await store("A");
  for (let n = 0; n < 10; n++)
    await s.save("customTasks", {
      title: "Свежий вопрос " + n,
      kind: n % 2 ? "truth" : "question",
    });
  const q = gamePool(s, "questions");
  assert.deepEqual(q, gamePool(s, "prediction"));
  assert.deepEqual(q, gamePool(s, "echo"));
  const deck = sessionDeck(s, "questions");
  assert.equal(deck.length, 13);
  assert.ok(deck.slice(0, 10).every((x) => x.startsWith("Свежий вопрос")));
  await s.save("plans", {
    title: "История",
    items: [],
    historyOwner: "A",
    played: Object.fromEntries(
      deck.map((x, i) => [cardKey(x), Date.now() + i]),
    ),
  });
  const next = sessionDeck(s, "prediction");
  assert.ok(next.every((x) => !deck.includes(x)));
  s.db.close();
});
test("visual room code is stable and legacy avatars remain available", () => {
  assert.equal(roomSymbols(room), roomSymbols(room));
  assert.equal(roomSymbols(room).split(" ").length, 6);
  assert.notEqual(roomSymbols(room), roomSymbols(room + "other"));
  for (const a of ["🌷", "🌿", "☀️", "🌙", "🍑", "🪻", "🧸", "🍀", "🧝"])
    assert.ok(avatars.includes(a));
  assert.ok(illustrations.length >= 15);
});

test("concurrent histories keep played prompts on both devices of one role", async () => {
  const a = await store("A"),
    b = await store("A");
  const id = `${room}:history:A`;
  await a.save("plans", {
    id,
    title: "История",
    items: [],
    historyOwner: "A",
    played: { first: 100 },
  });
  await b.save("plans", {
    id,
    title: "История",
    items: [],
    historyOwner: "A",
    played: { second: 200 },
  });
  await a.merge([
    { table: "plans", record: b.data.plans.find((p) => p.id === id) },
  ]);
  await b.merge([
    { table: "plans", record: a.data.plans.find((p) => p.id === id) },
  ]);
  assert.deepEqual(a.data.plans.find((p) => p.id === id).played, {
    second: 200,
    first: 100,
  });
  assert.deepEqual(b.data.plans.find((p) => p.id === id).played, {
    second: 200,
    first: 100,
  });
  a.db.close();
  b.db.close();
});
test("new requester must confirm its own code before either endpoint authorizes", async () => {
  const a = await store("A"),
    b = await store("B");
  const aa = await RoomAuth.create(a, {
    established: true,
    onRequest: async (r) => ({ target: r.targets[0].id }),
  });
  const ba = await RoomAuth.create(b, { onConfirm: async () => false });
  assert.equal((await wire(aa, ba)).count, 0);
  assert.equal(aa.record.roster.length, 1);
  assert.equal(ba.record.established, false);
  a.db.close();
  b.db.close();
});

test("legacy pairing preserves the real participant id instead of an older ghost profile", async () => {
  const a = await store("host"),
    b = await store("saida");
  await a.save("users", {
    id: `${room}:ghost`,
    localUserId: "ghost",
    displayName: "Свят",
  });
  await a.save("users", {
    id: `${room}:saida`,
    localUserId: "saida",
    displayName: "Саида",
  });
  await b.save("users", {
    id: `${room}:host`,
    localUserId: "host",
    displayName: "Свят",
  });
  const aa = await RoomAuth.create(a, {
      established: true,
      onRequest: async (req) => ({ target: req.targets[0].id }),
    }),
    ba = await RoomAuth.create(b, {
      established: true,
      onRequest: async (req) => ({ target: req.targets[0].id }),
    });
  assert.ok(aa.record.roster.some((r) => r.id === "ghost"));
  assert.equal((await wire(aa, ba)).count, 2);
  assert.deepEqual(aa.record.roster.map((r) => r.id).sort(), ["host", "saida"]);
  assert.equal(ba.record.memberId, "saida");
  assert.ok(a.data.users.some((u) => u.localUserId === "ghost"));
  a.db.close();
  b.db.close();
});
