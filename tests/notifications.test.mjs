import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("notification click focuses the right room and posts a route without reloading unsaved input", async () => {
  const handlers = {},
    messages = [];
  let focused = 0,
    opened;
  const clients = [
    {
      url: "https://example.test/another/?room=room-one",
      focus: async () => {
        throw Error("wrong app");
      },
    },
    {
      url: "https://example.test/vmeste/?room=room-two",
      focus: async () => {
        throw Error("wrong room");
      },
    },
    {
      url: "https://example.test/vmeste/?room=room-one",
      focus: async () => {
        focused++;
      },
      postMessage: (m) => messages.push(m),
    },
  ];
  const self = {
    registration: { scope: "https://example.test/vmeste/" },
    addEventListener: (type, fn) => (handlers[type] = fn),
    clients: {
      matchAll: async () => clients,
      openWindow: async (url) => {
        opened = url;
      },
    },
  };
  vm.runInNewContext(await readFile("service-worker.js", "utf8"), {
    self,
    URL,
  });
  let promise,
    closed = 0;
  handlers.notificationclick({
    notification: {
      data: { room: "room-one", tab: "games" },
      close: () => closed++,
    },
    waitUntil: (p) => (promise = p),
  });
  await promise;
  assert.equal(closed, 1);
  assert.equal(focused, 1);
  assert.equal(opened, undefined);
  assert.equal(messages[0].room, "room-one");
  assert.equal(messages[0].tab, "games");
  assert.equal(messages[0].type, "OPEN_ROOM_TAB");
  self.clients.matchAll = async () => [];
  handlers.notificationclick({
    notification: {
      data: { room: "room-three", tab: "not-a-route" },
      close: () => {},
    },
    waitUntil: (p) => (promise = p),
  });
  await promise;
  const url = new URL(opened);
  assert.equal(url.origin, "https://example.test");
  assert.equal(url.pathname, "/vmeste/");
  assert.equal(url.searchParams.get("room"), "room-three");
  assert.equal(url.hash, "#matches");
});
