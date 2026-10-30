const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
const algorithm = { name: "ECDSA", namedCurve: "P-256" };
const signing = { name: "ECDSA", hash: "SHA-256" };
const symbols = [
  "🦊",
  "🦋",
  "🍋",
  "🪐",
  "🎸",
  "🍄",
  "🐳",
  "🔥",
  "🌈",
  "🧩",
  "🦄",
  "🍒",
  "🪁",
  "🐼",
  "🌵",
  "⭐",
];
export const keyId = (key) => `${key?.kty}:${key?.crv}:${key?.x}:${key?.y}`;
export async function makeIdentity() {
  const keys = await crypto.subtle.generateKey(algorithm, true, [
    "sign",
    "verify",
  ]);
  return {
    publicKey: await crypto.subtle.exportKey("jwk", keys.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", keys.privateKey),
  };
}
export async function signProof(privateKey, payload) {
  const key = await crypto.subtle.importKey(
    "jwk",
    privateKey,
    algorithm,
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign(signing, key, encode(payload))),
  );
}
export async function verifyProof(publicKey, payload, signature) {
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      publicKey,
      algorithm,
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      signing,
      key,
      new Uint8Array(signature),
      encode(payload),
    );
  } catch {
    return false;
  }
}
export async function pairingSymbols(room, hello, other) {
  const values = [
    keyId(hello.publicKey) + hello.nonce,
    keyId(other.publicKey) + other.nonce,
  ].sort();
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encode([room, ...values])),
  );
  return [...hash.slice(0, 5)].map((n) => symbols[n % 16]).join(" ");
}
export function channelBinding(connection) {
  const pc = connection.peerConnection;
  const local =
    pc?.currentLocalDescription?.sdp || pc?.localDescription?.sdp || "";
  const remote =
    pc?.currentRemoteDescription?.sdp || pc?.remoteDescription?.sdp || "";
  const extract = (s) => [
    ...new Set(
      (s.match(/^a=fingerprint:[^\r\n]+/gm) || []).map((x) =>
        x.toLowerCase().trim(),
      ),
    ),
  ];
  const a = extract(local),
    b = extract(remote);
  if (!a.length || !b.length) return null;
  return [...a, ...b].sort();
}
export class RoomAuth {
  static async create(store, options = {}) {
    const auth = new RoomAuth();
    auth.blocked = new Map();
    auth.pending = new Map();
    auth.store = store;
    auth.options = options;
    auth.record = (await store.db.all("meta", store.roomId)).find(
      (r) => r.id === `${store.roomId}:auth`,
    );
    if (!auth.record) {
      const identity = await makeIdentity();
      auth.record = {
        id: `${store.roomId}:auth`,
        roomId: store.roomId,
        ...identity,
        memberId: store.userId,
        established: !!options.established,
        roster: [],
        capacity: options.capacity === 10 ? 10 : 2,
        displays: [],
        viewer: false,
        requestMode: options.requestedMode || "player",
      };
      if (auth.record.established) {
        const me = store.data.users.find(
          (u) => u.localUserId === store.userId && !u.deletedAt,
        );
        const partner = store.data.users
          .filter(
            (u) =>
              u.localUserId !== store.userId && !u.deletedAt && !u.provisional,
          )
          .sort((a, b) => a.createdAt - b.createdAt)[0];
        auth.record.roster = [
          {
            id: store.userId,
            publicKey: identity.publicKey,
            name: me?.displayName || "Вы",
          },
          ...(partner
            ? [{ id: partner.localUserId, name: partner.displayName }]
            : []),
        ];
      }
      await auth.save();
    }
    if (!auth.record.established && options.requestedMode) {
      auth.record.requestMode = options.requestedMode;
      await auth.save();
    }
    auth.expose();
    return auth;
  }
  expose() {
    this.store.authEstablished = this.record.established;
    this.store.authRoster = this.record.roster;
    this.store.authCapacity = this.record.capacity || 2;
    this.store.authViewer = !!this.record.viewer;
  }
  async save() {
    await this.store.db.put("meta", this.record);
    this.expose();
  }
  attach(connection, slot, onAuthorized) {
    return new Admission(this, connection, slot, onAuthorized);
  }
}
class Admission {
  constructor(auth, connection, slot, onAuthorized) {
    this.auth = auth;
    this.c = connection;
    this.slot = slot;
    this.onAuthorized = onAuthorized;
    this.verified = false;
    this.authorized = false;
    this.queue = Promise.resolve();
    this.binding = channelBinding(connection);
    const me = auth.store.data.users.find(
      (u) => u.localUserId === auth.store.userId && !u.deletedAt,
    );
    this.hello = {
      type: "auth-hello",
      protocol: 3,
      roomId: auth.store.roomId,
      memberId: auth.record.memberId,
      name: (me?.displayName || "Участник").slice(0, 60),
      avatar: me?.avatar || "🦊",
      publicKey: auth.record.publicKey,
      nonce: crypto.randomUUID(),
      established: auth.record.established,
      requestedMode: auth.record.viewer
        ? "display"
        : auth.options.requestedMode || auth.record.requestMode || "player",
    };
    this.send(this.hello);
  }
  send(msg) {
    if (this.c.open) this.c.send(msg);
  }
  receive(msg) {
    this.queue = this.queue
      .then(() => this.process(msg))
      .catch(() =>
        this.reject(
          "Не удалось подтвердить устройство. Повторите подключение.",
        ),
      );
    return this.queue;
  }
  payload(from, to) {
    if (!this.binding) throw Error("Не удалось проверить защищённый канал");
    return [
      this.binding,
      this.auth.store.roomId,
      from.memberId,
      keyId(from.publicKey),
      from.nonce,
      from.name,
      from.established,
      from.requestedMode,
      to.memberId,
      keyId(to.publicKey),
      to.nonce,
    ];
  }
  async process(msg) {
    if (!msg || (msg.roomId && msg.roomId !== this.auth.store.roomId)) return;
    if (msg.type === "auth-ping") return;
    if (msg.type === "auth-reject") {
      this.auth.options.onWaiting?.({
        message: msg.message || "Вход не подтверждён",
        denied: true,
      });
      return;
    }
    if (msg.type === "auth-hello") {
      if (
        this.remote ||
        msg.protocol !== 3 ||
        typeof msg.memberId !== "string" ||
        msg.memberId.length > 100 ||
        typeof msg.nonce !== "string" ||
        msg.nonce.length > 100 ||
        typeof msg.name !== "string" ||
        msg.name.length > 60 ||
        JSON.stringify(msg).length > 3000
      )
        return;
      if (keyId(msg.publicKey) === keyId(this.hello.publicKey))
        return this.reject(
          "Этот участник уже открыт на другом клиенте. Для второго человека нужно отдельное устройство или профиль браузера.",
        );
      this.remote = msg;
      this.send({
        type: "auth-proof",
        signature: await signProof(
          this.auth.record.privateKey,
          this.payload(this.hello, msg),
        ),
      });
      return;
    }
    if (msg.type === "auth-proof" && this.remote && !this.verified) {
      if (
        !Array.isArray(msg.signature) ||
        msg.signature.length !== 64 ||
        !(await verifyProof(
          this.remote.publicKey,
          this.payload(this.remote, this.hello),
          msg.signature,
        ))
      )
        return this.reject("Не удалось проверить подпись устройства.");
      this.verified = true;
      const known = this.auth.record.roster.find(
        (r) =>
          r.id === this.remote.memberId &&
          [r.publicKey, ...(r.keys || [])].some(
            (k) => k && keyId(k) === keyId(this.remote.publicKey),
          ),
      );
      const knownDisplay = (this.auth.record.displays || []).some(
        (k) => keyId(k) === keyId(this.remote.publicKey),
      );
      if (
        (known || knownDisplay) &&
        this.auth.record.established &&
        this.remote.established
      ) {
        this.remoteViewer = knownDisplay;
        this.finish();
        return;
      }
      if (
        (this.auth.blocked.get(keyId(this.remote.publicKey)) || 0) > Date.now()
      )
        return this.reject("Вход отклонён. Повторите запрос позже.");
      if (
        this.auth.record.established &&
        this.remote.established &&
        this.slot !== "a" &&
        !known
      ) {
        const previous = this.auth.record.roster.find(
          (r) => r.id === this.remote.memberId,
        );
        if (!previous)
          return this.reject(
            "Это устройство не закреплено за участником комнаты. Откройте доверенный клиент первым.",
          );
        const code = await pairingSymbols(
          this.auth.store.roomId,
          this.hello,
          this.remote,
        );
        const consent = await this.auth.options.onRequest?.({
          name: this.remote.name,
          clientId: this.c.peer,
          code,
          mode: "verify",
          targets: [
            { id: previous.id, name: `Новое устройство · ${previous.name}` },
          ],
          restoring: true,
        });
        if (!consent)
          return this.reject(
            "Новое устройство участника не подтверждено.",
            true,
          );
        this.localConfirmed = true;
      }
      this.approver =
        this.auth.record.established &&
        (!this.remote.established || this.slot === "a");
      if (!this.approver && !this.remote.established)
        return this.reject(
          "Для входа нужен один из прежних участников онлайн.",
        );
      this.code = await pairingSymbols(
        this.auth.store.roomId,
        this.hello,
        this.remote,
      );
      if (this.approver) {
        const roster = this.auth.record.roster.map((r) => ({
          ...r,
          name:
            this.auth.store.data.users.find(
              (u) => u.localUserId === r.id && !u.deletedAt,
            )?.displayName || r.name,
        }));
        const mode = this.remote.requestedMode;
        const online =
          this.auth.options.onlineMembers?.() ||
          new Set([this.auth.record.memberId]);
        const capacity = this.auth.record.capacity || 2;
        const legacySlot = roster.find(
          (r) =>
            r.id !== this.auth.record.memberId &&
            !r.publicKey &&
            !(r.keys || []).length,
        );
        const legacyRemote =
          this.remote.established &&
          this.remote.memberId !== this.auth.record.memberId
            ? this.auth.store.data.users.find(
                (u) =>
                  u.localUserId === this.remote.memberId &&
                  !u.deletedAt &&
                  !u.provisional,
              )
            : null;
        let targets = [];
        if (mode === "display")
          targets = [
            { id: "display", name: "Общий экран · без личных данных" },
          ];
        else if (mode === "player" && legacySlot && legacyRemote)
          targets = [
            {
              id: legacyRemote.localUserId,
              name: `Прежний участник · ${legacyRemote.displayName}`,
            },
          ];
        else if (mode === "mirror")
          targets = roster.map((r) => ({ id: r.id, name: r.name }));
        else if (
          roster.length +
            [...this.auth.pending.values()].filter((p) => p.newSeat).length <
          capacity
        )
          targets = [
            { id: "new", name: `Новый участник · ${this.remote.name}` },
          ];
        else
          targets = roster
            .filter((r) => !online.has(r.id))
            .map((r) => ({ id: r.id, name: r.name }));
        if (!targets.length)
          return this.reject(
            "Все места заняты подключёнными игроками. Дополнительный экран можно запросить отдельно.",
          );
        const result = await this.auth.options.onRequest?.({
          name: this.remote.name,
          clientId: this.c.peer,
          code: this.code,
          targets,
          mode,
          restoring: targets[0].id !== "new" && targets[0].id !== "display",
        });
        if (!this.c.open) return;
        const selected =
          typeof result === "object"
            ? result?.target
            : result
              ? targets[0].id
              : null;
        if (!targets.some((t) => t.id === selected))
          return this.reject("Вход отклонён участником комнаты.", true);
        let target,
          member,
          proposedRoster = roster;
        if (selected === "display") {
          target = "screen-" + crypto.randomUUID();
          this.remoteViewer = true;
        } else {
          target = selected === "new" ? crypto.randomUUID() : selected;
          const existing = roster.find((r) => r.id === target);
          member = {
            id: target,
            name: existing?.name || this.remote.name,
            publicKey: existing?.publicKey || this.remote.publicKey,
            keys: [
              ...new Map(
                [...(existing?.keys || []), this.remote.publicKey].map((k) => [
                  keyId(k),
                  k,
                ]),
              ).values(),
            ].slice(-10),
          };
          proposedRoster = roster
            .filter(
              (r) =>
                r.id !== target &&
                !(
                  legacySlot &&
                  legacyRemote?.localUserId === target &&
                  r.id === legacySlot.id
                ),
            )
            .concat(member);
        }
        this.proposal = {
          target,
          member,
          newSeat: selected === "new",
          replaceId:
            legacySlot && legacyRemote?.localUserId === target
              ? legacySlot.id
              : null,
          viewer: !!this.remoteViewer,
        };
        this.auth.pending.set(this.c.peer, this.proposal);
        this.remoteMemberId = target;
        this.awaitingReady = true;
        this.send({
          type: "auth-grant",
          target,
          roster: proposedRoster,
          capacity,
          viewer: !!this.remoteViewer,
        });
      } else
        this.auth.options.onWaiting?.({
          code: this.code,
          message:
            "Сверьте значки с вашим человеком. Он подтвердит вход или восстановит вашу прежнюю роль.",
        });
      return;
    }
    if (
      msg.type === "auth-ready" &&
      this.verified &&
      this.approver &&
      this.awaitingReady &&
      this.proposal
    ) {
      const { member, target, viewer, newSeat, replaceId } = this.proposal;
      if (member) {
        const existing = this.auth.record.roster.find((r) => r.id === target);
        if (
          newSeat &&
          !existing &&
          this.auth.record.roster.length >= (this.auth.record.capacity || 2)
        )
          return this.reject("Все места уже заняты.");
        const merged = {
          ...member,
          publicKey: existing?.publicKey || member.publicKey,
          keys: [
            ...new Map(
              [...(existing?.keys || []), ...(member.keys || [])].map((k) => [
                keyId(k),
                k,
              ]),
            ).values(),
          ].slice(-10),
        };
        this.auth.record.roster = this.auth.record.roster
          .filter((r) => r.id !== target && r.id !== replaceId)
          .concat(merged);
      }
      if (viewer)
        this.auth.record.displays = [
          ...(this.auth.record.displays || []),
          this.remote.publicKey,
        ].slice(-10);
      this.auth.pending.delete(this.c.peer);
      this.awaitingReady = false;
      await this.auth.save();
      this.finish();
      return;
    }
    if (
      msg.type === "auth-grant" &&
      this.verified &&
      !this.approver &&
      !this.authorized
    ) {
      if (
        !Array.isArray(msg.roster) ||
        msg.roster.length < 1 ||
        msg.roster.length > 10 ||
        new Set(msg.roster.map((r) => r.id)).size !== msg.roster.length
      )
        return;
      const mine = msg.roster.find(
        (r) =>
          r.id === msg.target &&
          [r.publicKey, ...(r.keys || [])].some(
            (k) => k && keyId(k) === keyId(this.hello.publicKey),
          ),
      );
      const theirs = msg.roster.find(
        (r) =>
          r.id === this.remote.memberId &&
          [r.publicKey, ...(r.keys || [])].some(
            (k) => k && keyId(k) === keyId(this.remote.publicKey),
          ),
      );
      if (
        (!mine && !msg.viewer) ||
        !theirs ||
        msg.roster.some(
          (r) =>
            typeof r.id !== "string" ||
            r.id.length > 100 ||
            typeof r.name !== "string" ||
            r.name.length > 60,
        )
      )
        return;
      const confirmed =
        this.localConfirmed ||
        (await this.auth.options.onConfirm?.({
          code: this.code,
          name: this.remote.name,
          clientId: this.c.peer,
        }));
      if (!confirmed)
        return this.reject("Значки не подтверждены на новом устройстве.");
      if (!this.c.open) return;
      this.auth.record.memberId = msg.target;
      this.auth.record.capacity = msg.capacity === 10 ? 10 : 2;
      this.auth.record.viewer = !!msg.viewer;
      this.auth.record.roster = msg.roster;
      this.auth.record.established = true;
      await this.auth.save();
      await this.auth.options.onAdmitted?.(
        msg.target,
        mine?.name || "Общий экран",
      );
      this.send({ type: "auth-ready" });
      this.finish();
    }
  }
  finish() {
    if (this.authorized) return;
    this.authorized = true;
    this.auth.options.onWaiting?.(null);
    this.onAuthorized();
    this.auth.options.onConnected?.();
  }
  reject(message, cooldown = false) {
    this.auth.pending.delete(this.c.peer);
    if (this.remote && cooldown)
      this.auth.blocked.set(keyId(this.remote.publicKey), Date.now() + 30000);
    this.send({ type: "auth-reject", message });
    this.auth.options.onWaiting?.({ message, denied: true });
    this.c.close();
  }
}
