import { Sync } from "./sync.js";
import { keyId } from "./auth.js";
import {
  acceptGameFrame,
  rememberClosed,
  GAME_PROTOCOL,
} from "./game-protocol.js";
export class RoomPeer {
  constructor(store, onStatus, auth) {
    this.store = store;
    this.status = onStatus;
    this.auth = auth;
    this.sessions = new Map();
    this.games = new Map();
    this.savedClosedRevision = 0;
    try {
      const saved = JSON.parse(
        localStorage.getItem(`vmeste:closed-rounds:${store.roomId}`),
      );
      this.games.closedRounds = new Map(
        (Array.isArray(saved) ? saved : [])
          .filter(
            (f) =>
              validFrame(f) &&
              f.finished &&
              f.closedAt &&
              typeof f.round === "string",
          )
          .map((f) => [f.round, f]),
      );
    } catch {}
    this.pendingInputs = [];
    this.pendingCommands = [];
    this.stopped = false;
    this.change = (e) => {
      if (e.detail.local)
        for (const s of this.players()) s.sync.changed(e.detail.entries);
    };
    store.addEventListener("change", this.change);
    this.resume = () => {
      if (
        !this.stopped &&
        !this.peer?.open &&
        document.visibilityState !== "hidden"
      )
        this.restart();
    };
    this.offline = () => {
      this.status("Офлайн");
      for (const s of this.sessions.values()) s.c.close();
    };
    window.addEventListener("online", this.resume);
    window.addEventListener("offline", this.offline);
    document.addEventListener("visibilitychange", this.resume);
    this.start();
  }
  players() {
    return [...this.sessions.values()].filter(
      (s) =>
        s.admission?.authorized &&
        !s.admission.remoteViewer &&
        !this.store.authViewer &&
        s.c.open,
    );
  }
  onlineMembers() {
    return new Set([
      this.store.userId,
      ...(!this.isHub ? this.store.authOnline || [] : []),
      ...[...this.sessions.values()]
        .filter((s) => s.admission?.authorized && !s.admission.remoteViewer)
        .map((s) => s.admission.remoteMemberId || s.admission.remote?.memberId),
    ]);
  }
  onlineDisplays() {
    return this.isHub
      ? [...this.sessions.values()].filter(
          (s) =>
            s.admission?.authorized && s.admission.remoteViewer && s.c.open,
        ).length
      : this.store.authScreens?.length || 0;
  }
  gameCapabilities() {
    const own = {
      client: this.peer?.id,
      member: this.store.userId,
      name:
        this.store.users?.find((u) => u.localUserId === this.store.userId)
          ?.displayName || "Вы",
      protocol: GAME_PROTOCOL,
      viewer: !!this.store.authViewer,
    };
    if (!this.isHub && this.store.authCapabilities?.length)
      return this.store.authCapabilities;
    return [
      own,
      ...[...this.sessions.values()]
        .filter((s) => s.admission?.authorized && s.c.open)
        .map((s) => ({
          client: s.c.peer,
          member: s.admission.remoteMemberId || s.admission.remote?.memberId,
          name: s.admission.remote?.name || "Участник",
          protocol: Number(s.admission.remote?.gameProtocol) || 0,
          viewer: !!s.admission.remoteViewer,
        })),
    ];
  }
  gameCompatibility(required) {
    return this.gameCapabilities()
      .filter((c) => c.protocol < required)
      .map((c) => c.name);
  }
  async start() {
    this.store.authScreens = [];
    this.store.authCapabilities = [];
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(this.store.roomId),
      ),
    );
    this.prefix =
      "vmeste-" +
      [...digest]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32);
    if (this.stopped) return;
    this.claim(!!this.auth?.record.established && !this.store.authViewer);
    this.timer = setInterval(() => {
      if (!navigator.onLine) {
        this.status("Офлайн");
        return;
      }
      for (const s of this.sessions.values()) {
        if (s.c.open && Date.now() - s.lastSeen > 30000) {
          s.c.close();
          continue;
        }
        if (s.c.open) {
          s.c.send({ type: "auth-ping" });
          if (
            s.admission?.authorized &&
            !s.admission.remoteViewer &&
            !this.store.authViewer
          )
            s.sync.hello();
        }
      }
      if (!this.peer || this.peer.destroyed) return this.restart();
      if (this.peer.disconnected) {
        try {
          this.peer.reconnect();
        } catch {
          this.restart();
        }
      }
      if (!this.isHub && !this.sessions.size && this.peer.open) {
        if (this.auth?.record.established && !this.store.authViewer)
          this.restart();
        else this.connect();
      }
    }, 6000);
  }
  claim(hub) {
    if (this.stopped || !navigator.onLine) return;
    if (!window.Peer) {
      this.status("Соединение пока недоступно");
      return;
    }
    this.isHub = hub;
    this.status(
      this.store.authEstablished
        ? "Ждём участников"
        : "Ищем участника для подтверждения…",
    );
    const peer = (this.peer = new window.Peer(
      this.prefix +
        (hub
          ? "-hub"
          : "-d-" + crypto.randomUUID().replaceAll("-", "").slice(0, 16)),
      { debug: 0 },
    ));
    peer.on("open", () => {
      window.dispatchEvent(new CustomEvent("vmeste-peer-ready"));
      if (peer !== this.peer) return;
      if (!hub) this.connect();
    });
    peer.on("connection", (c) => {
      if (
        !hub ||
        !c.peer.startsWith(this.prefix + "-d-") ||
        this.sessions.size >= 24
      ) {
        c.close();
        return;
      }
      this.bind(c);
    });
    peer.on("disconnected", () => {
      if (peer === this.peer)
        this.status(navigator.onLine ? "Восстанавливаем связь…" : "Офлайн");
    });
    peer.on("error", (err) => {
      if (peer !== this.peer || this.stopped) return;
      if (err.type === "unavailable-id" && hub) {
        peer.destroy();
        this.claim(false);
      } else if (err.type === "peer-unavailable") {
        this.connecting = false;
        this.status("Нужен один из участников онлайн");
      } else {
        this.connecting = false;
        this.status("Связь прервалась. Данные сохранены");
      }
    });
  }
  connect() {
    if (this.connecting || this.sessions.size || !this.peer?.open) return;
    this.connecting = true;
    this.bind(
      this.peer.connect(this.prefix + "-hub", {
        reliable: true,
        serialization: "json",
      }),
    );
  }
  bind(c) {
    const session = { c, lastSeen: Date.now() };
    this.sessions.set(c.peer, session);
    const timeout = setTimeout(() => {
      if (!c.open) {
        c.close();
        this.sessions.delete(c.peer);
        this.connecting = false;
      }
    }, 9000);
    session.sync = new Sync(
      this.store,
      (m) => {
        if (
          session.admission?.authorized &&
          !session.admission.remoteViewer &&
          !this.store.authViewer &&
          c.open
        )
          c.send(m);
      },
      this.status,
    );
    c.on("open", () => {
      clearTimeout(timeout);
      this.connecting = false;
      session.lastSeen = Date.now();
      this.status("Подтверждаем участника…");
      if (!this.auth) {
        c.close();
        return;
      }
      session.admission = this.auth.attach(c, this.isHub ? "a" : "b", () => {
        this.connection = c;
        this.admission = session.admission;
        this.status(
          this.store.authViewer
            ? "Экран подключён"
            : this.store.authCapacity > 2
              ? "Компания на связи"
              : "Вы вдвоём",
        );
        if (!session.admission.remoteViewer && !this.store.authViewer)
          session.sync.hello();
        if (this.isHub) this.shareRoster();
        this.sendClosedRounds(c);
        for (const frame of this.framesForConnection())
          c.send({ type: "game-view", frame });
        this.flushInputs();
        this.flushCommands();
        window.dispatchEvent(new CustomEvent("vmeste-game-connected"));
      });
    });
    c.on("data", async (m) => {
      session.lastSeen = Date.now();
      if (m?.type?.startsWith("auth-")) {
        session.admission?.receive(m);
        return;
      }
      if (!session.admission?.authorized) return;
      if (m?.type === "room-roster" && !this.isHub && !this.store.authViewer) {
        if (
          !validRoster(m.roster) ||
          !m.roster.some((r) => r.id === this.store.userId)
        )
          return;
        this.auth.record.roster = m.roster;
        this.auth.record.displays = Array.isArray(m.displays)
          ? m.displays.slice(0, 10)
          : [];
        this.auth.record.capacity = m.capacity === 10 ? 10 : 2;
        this.store.authOnline = Array.isArray(m.online) ? m.online : [];
        this.store.authScreens = Array.isArray(m.screens) ? m.screens : [];
        this.store.authCapabilities = Array.isArray(m.gameCapabilities)
          ? m.gameCapabilities
              .slice(0, 24)
              .filter(
                (r) =>
                  r &&
                  typeof r.name === "string" &&
                  r.name.length <= 60 &&
                  Number.isFinite(r.protocol),
              )
              .map((r) => ({
                client: r.client,
                member: r.member,
                name: r.name,
                protocol: r.protocol,
                viewer: !!r.viewer,
              }))
          : [];
        await this.auth.save();
        window.dispatchEvent(new CustomEvent("vmeste-game-capabilities"));
        this.store.dispatchEvent(
          new CustomEvent("change", { detail: { entries: [], local: false } }),
        );
        return;
      }
      if (
        m?.type === "play-input" &&
        this.isHub &&
        !session.admission.remoteViewer
      ) {
        this.routeInput(
          session.admission.remoteMemberId || session.admission.remote.memberId,
          m.input,
        );
        return;
      }
      if (
        m?.type === "play-command" &&
        !this.isHub &&
        !this.store.authViewer &&
        JSON.stringify(m).length < 16000
      ) {
        window.dispatchEvent(
          new CustomEvent("vmeste-game-input", {
            detail: { sender: m.sender, input: m.input },
          }),
        );
        return;
      }
      if (m?.type === "play-private" && !session.admission.remoteViewer) {
        if (this.isHub) {
          if (
            [...this.games.values()].some(
              (f) =>
                f.round === m.payload?.round && f.controllerClient === c.peer,
            )
          )
            this.routePrivate(m.target, m.payload);
        } else if (!this.store.authViewer)
          window.dispatchEvent(
            new CustomEvent("vmeste-game-private", { detail: m.payload }),
          );
        return;
      }
      if (m?.type === "game-tombstones") {
        if (
          session.admission.remoteViewer ||
          !Array.isArray(m.frames) ||
          m.frames.length > 16 ||
          JSON.stringify(m).length > 24000
        )
          return;
        const member =
          session.admission.remoteMemberId ||
          session.admission.remote?.memberId;
        const accepted = [];
        for (const marker of m.frames) {
          if (
            !validFrame(marker) ||
            !marker.finished ||
            !Number.isFinite(marker.closedAt) ||
            typeof marker.round !== "string" ||
            marker.round.length > 200 ||
            typeof marker.kind !== "string" ||
            marker.kind.length > 100
          )
            continue;
          if (
            this.isHub &&
            (marker.controller !== member || marker.controllerClient !== c.peer)
          )
            continue;
          rememberClosed(this.games, marker);
          accepted.push(marker);
          const current = this.games.get(marker.kind);
          if (current?.round === marker.round && !current.finished) {
            acceptGameFrame(this.games, marker);
            window.dispatchEvent(
              new CustomEvent("vmeste-game-view", { detail: marker }),
            );
          }
        }
        this.saveClosedRounds();
        if (this.isHub && accepted.length)
          for (const other of this.sessions.values())
            if (other.c !== c && other.admission?.authorized && other.c.open)
              other.c.send({ type: "game-tombstones", frames: accepted });
        return;
      }
      if (m?.type === "game-view") {
        if (session.admission.remoteViewer || !validFrame(m.frame)) return;
        if (this.isHub) {
          const member =
            session.admission.remoteMemberId ||
            session.admission.remote.memberId;
          // Cached foreign snapshots are not authored by this connection.
          if (
            m.frame.controller !== member ||
            m.frame.controllerClient !== c.peer
          )
            return;
          m.frame.controller =
            session.admission.remoteMemberId ||
            session.admission.remote.memberId;
          m.frame.controllerClient = c.peer;
        }
        const { chosen, retired } = acceptGameFrame(this.games, m.frame);
        this.saveClosedRounds();
        for (const closed of retired) {
          window.dispatchEvent(
            new CustomEvent("vmeste-game-view", { detail: closed }),
          );
          if (this.isHub)
            for (const other of this.sessions.values())
              if (other.admission?.authorized && other.c.open)
                other.c.send({ type: "game-view", frame: closed });
        }
        if (chosen !== m.frame) {
          if (this.isHub || chosen.controllerClient === this.peer?.id)
            c.send({ type: "game-view", frame: chosen });
          window.dispatchEvent(
            new CustomEvent("vmeste-game-view", { detail: chosen }),
          );
          return;
        }
        this.games.set(m.frame.kind, m.frame);
        this.flushCommands();
        this.lastGame = m.frame;
        window.dispatchEvent(
          new CustomEvent("vmeste-game-view", { detail: m.frame }),
        );
        if (this.isHub)
          for (const other of this.sessions.values())
            if (
              other !== session &&
              other.admission?.authorized &&
              other.c.open
            )
              other.c.send(m);
        return;
      }
      if (this.store.authViewer || session.admission.remoteViewer) return;
      await session.sync.receive(m);
      if (
        this.isHub &&
        m?.type === "records" &&
        Array.isArray(m.entries) &&
        m.entries.length <= 100
      )
        for (const other of this.players())
          if (other !== session) other.c.send(m);
    });
    const closed = () => {
      clearTimeout(timeout);
      this.connecting = false;
      this.sessions.delete(c.peer);
      this.auth?.pending.delete(c.peer);
      this.auth?.options.onPendingClosed?.(c.peer);
      if (this.connection === c) {
        this.connection = null;
        this.admission = null;
      }
      if (this.isHub) this.shareRoster();
      if (
        !this.sessions.size ||
        (!this.store.authViewer && this.players().length === 0)
      )
        this.status(navigator.onLine ? "Ждём участников" : "Офлайн");
    };
    c.on("close", closed);
    c.on("error", () => {
      c.close();
      closed();
    });
  }
  shareRoster() {
    const msg = {
      type: "room-roster",
      roster: this.auth.record.roster,
      capacity: this.auth.record.capacity,
      displays: this.auth.record.displays,
      online: [...this.onlineMembers()],
      screens: [...this.sessions.values()]
        .filter(
          (s) =>
            s.admission?.authorized && s.admission.remoteViewer && s.c.open,
        )
        .map((s) => s.c.peer),
      gameCapabilities: this.gameCapabilities(),
    };
    for (const s of this.players()) s.c.send(msg);
  }
  framesForConnection() {
    const frames = [...this.games.values()];
    return this.isHub
      ? frames
      : frames
          .filter(
            (f) =>
              f.controllerClient === this.peer?.id ||
              (f.finished &&
                f.controller === this.store.userId &&
                f.ownerDevice === localStorage.getItem("vmeste-device")),
          )
          .map((f) =>
            f.controller === this.store.userId
              ? { ...f, controllerClient: this.peer?.id }
              : f,
          );
  }
  sendClosedRounds(connection) {
    const all = [...(this.games.closedRounds?.values() || [])];
    const ownDevice = localStorage.getItem("vmeste-device");
    const frames = this.isHub
      ? all
      : all
          .filter(
            (f) =>
              f.controller === this.store.userId && f.ownerDevice === ownDevice,
          )
          .map((f) => ({ ...f, controllerClient: this.peer?.id }));
    for (let i = 0; i < frames.length; i += 16)
      connection.send({
        type: "game-tombstones",
        frames: frames.slice(i, i + 16),
      });
  }
  saveClosedRounds() {
    const revision = this.games.closedRevision || 0;
    if (this.savedClosedRevision === revision) return;
    try {
      localStorage.setItem(
        `vmeste:closed-rounds:${this.store.roomId}`,
        JSON.stringify([...(this.games.closedRounds?.values() || [])]),
      );
    } catch {
    } finally {
      this.savedClosedRevision = revision;
    }
  }
  publishGame(frame) {
    if (!validFrame(frame) || this.store.authViewer) return;
    frame = {
      ...frame,
      controller: this.store.userId,
      controllerClient: this.peer?.id,
    };
    const { chosen, retired } = acceptGameFrame(this.games, frame);
    this.saveClosedRounds();
    for (const closed of retired) {
      window.dispatchEvent(
        new CustomEvent("vmeste-game-view", { detail: closed }),
      );
      for (const session of this.sessions.values())
        if (session.admission?.authorized && session.c.open)
          session.c.send({ type: "game-view", frame: closed });
    }
    if (chosen !== frame) {
      window.dispatchEvent(
        new CustomEvent("vmeste-game-view", { detail: chosen }),
      );
      return;
    }
    this.games.set(frame.kind, frame);
    this.flushCommands();
    this.lastGame = frame;
    for (const s of this.sessions.values())
      if (s.admission?.authorized && s.c.open)
        s.c.send({ type: "game-view", frame });
  }
  sendInput(input) {
    if (!input || JSON.stringify(input).length > 14000 || this.store.authViewer)
      return;
    const own = [...this.games.values()].find(
      (f) => f.round === input.round && f.controllerClient === this.peer?.id,
    );
    if (own) {
      window.dispatchEvent(
        new CustomEvent("vmeste-game-input", {
          detail: { sender: this.store.userId, input },
        }),
      );
      return;
    }
    if (this.isHub) this.routeInput(this.store.userId, input);
    else {
      const sessions = this.players().filter((s) => s.c.open);
      if (!sessions.length) {
        this.pendingInputs.push(input);
        this.pendingInputs = this.pendingInputs.slice(-100);
      } else for (const s of sessions) s.c.send({ type: "play-input", input });
    }
  }
  flushInputs() {
    const pending = this.pendingInputs.splice(0);
    for (const input of pending) this.sendInput(input);
  }
  routeInput(sender, input, queuedAt = Date.now()) {
    if (!input || JSON.stringify(input).length > 14000) return;
    const game = [...this.games.values()].find((f) => f.round === input.round);
    if (game?.finished) return;
    const msg = { type: "play-command", sender, input };
    if (game?.controllerClient === this.peer?.id)
      window.dispatchEvent(
        new CustomEvent("vmeste-game-input", { detail: { sender, input } }),
      );
    else {
      const target = this.sessions.get(game?.controllerClient);
      if (
        target?.admission?.authorized &&
        !target.admission.remoteViewer &&
        target.c.open
      )
        target.c.send(msg);
      else {
        this.pendingCommands.push({ sender, input, at: queuedAt });
        this.pendingCommands = this.pendingCommands.slice(-100);
      }
    }
  }
  flushCommands() {
    const pending = this.pendingCommands.splice(0);
    for (const item of pending)
      if (Date.now() - item.at < 30000)
        this.routeInput(item.sender, item.input, item.at);
  }
  sendPrivate(target, payload) {
    if (
      !payload ||
      JSON.stringify(payload).length > 5000 ||
      this.store.authViewer
    )
      return;
    if (this.isHub) this.routePrivate(target, payload);
    else
      for (const s of this.players())
        s.c.send({ type: "play-private", target, payload });
  }
  routePrivate(target, payload) {
    if (!payload || JSON.stringify(payload).length > 5000) return;
    if (target === this.store.userId)
      window.dispatchEvent(
        new CustomEvent("vmeste-game-private", { detail: payload }),
      );
    for (const s of this.players())
      if (
        (s.admission.remoteMemberId || s.admission.remote?.memberId) === target
      )
        s.c.send({ type: "play-private", target, payload });
  }
  restart() {
    if (this.stopped || !this.prefix) return;
    for (const s of this.sessions.values()) s.c.close();
    this.sessions.clear();
    this.peer?.destroy();
    this.connection = null;
    this.admission = null;
    this.connecting = false;
    this.claim(!!this.auth?.record.established && !this.store.authViewer);
  }
  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    for (const s of this.sessions.values()) s.c.close();
    this.sessions.clear();
    this.peer?.destroy();
    this.store.removeEventListener("change", this.change);
    window.removeEventListener("online", this.resume);
    window.removeEventListener("offline", this.offline);
    document.removeEventListener("visibilitychange", this.resume);
  }
}
function validRoster(roster) {
  return (
    Array.isArray(roster) &&
    roster.length > 0 &&
    roster.length <= 10 &&
    new Set(roster.map((r) => r.id)).size === roster.length &&
    roster.every(
      (r) =>
        typeof r.id === "string" &&
        r.id.length <= 100 &&
        typeof r.name === "string" &&
        r.name.length <= 60 &&
        (!r.keys || (Array.isArray(r.keys) && r.keys.length <= 10)),
    )
  );
}
function validFrame(frame) {
  return (
    frame &&
    typeof frame === "object" &&
    JSON.stringify(frame).length < 48000 &&
    typeof frame.title === "string" &&
    typeof frame.text === "string" &&
    frame.title.length < 160 &&
    frame.text.length < 2000
  );
}
