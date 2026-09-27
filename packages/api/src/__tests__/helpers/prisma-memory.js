/**
 * General-purpose in-memory Prisma stub for `node:test` unit tests.
 *
 * Not a full Prisma re-implementation: it supports only the subset of the
 * query API the membership/credit code (and later tasks: engine, order
 * service, support) actually uses. Extend it as new tasks need more, but
 * keep it small.
 *
 * Supported per delegate: create, findUnique, findFirst, findMany
 * (where: equals / gt / gte / lt / lte / in / not, orderBy, take),
 * update (plain assignment plus {increment}/{decrement}/{set}), updateMany
 * (returns {count}), createMany (returns {count}), aggregate ({_sum}), count,
 * delete, deleteMany. A relation `{ connect: { id } }` in update data is
 * kept as an array of ids on the row (for implicit many-to-many lists).
 * `include` and `select` are ignored (whole rows come back).
 *
 * Plus `$transaction(fn)`: runs `fn(tx)` against a cloned snapshot of the
 * whole in-memory database. If `fn` resolves, the snapshot is committed
 * back over the real collections; if it throws, the snapshot is discarded
 * and the real collections are left untouched (rollback).
 */

const COLLECTIONS = [
  "creditLot", "creditEvent", "user", "reward", "order", "seat", "supportCase", "userBadge", "badge", "menuItem",
  // Order service (Task A6)
  "orderItem", "location", "tenant", "guest", "promoCode", "promoCodeUsage", "giftCard", "mealGift", "mealGiftChain",
  "challenge", "userChallenge",
  // Group orders (Task A7)
  "groupOrder",
];

/**
 * `@@unique` constraints the schema declares that engine/credits code
 * actually relies on being enforced (e.g. to exercise a real P2002 conflict
 * path). `create()` checks these and throws a Prisma-shaped error
 * (`err.code === "P2002"`) on a clash, same as a real unique-index violation.
 * As in Postgres, a row with a NULL in any indexed column never clashes.
 */
const UNIQUE_INDEXES = {
  reward: [["userId", "type", "issuedFor"]],
  giftCard: [["code"], ["stripePaymentId"]],
  mealGift: [["stripePaymentIntentId"], ["orderId"]],
  userChallenge: [["userId", "challengeId"]],
};

function toTime(v) {
  return v instanceof Date ? v.getTime() : v;
}

function valEquals(a, b) {
  if (a instanceof Date || b instanceof Date) return toTime(a) === toTime(b);
  // A real Postgres row always has a concrete value for every column - never
  // "missing". A seed/create call that omits a nullable field should match a
  // `where: { field: null }` filter the same way an explicit `null` would.
  const av = a === undefined ? null : a;
  const bv = b === undefined ? null : b;
  return av === bv;
}

function compare(a, b) {
  const av = toTime(a);
  const bv = toTime(b);
  if (av < bv) return -1;
  if (av > bv) return 1;
  return 0;
}

function matchField(val, cond) {
  if (cond === null || typeof cond !== "object" || cond instanceof Date) {
    return valEquals(val, cond);
  }
  return Object.entries(cond).every(([op, opVal]) => {
    switch (op) {
      case "equals":
        return valEquals(val, opVal);
      case "not":
        return !matchField(val, opVal);
      case "gt":
        return val !== undefined && val !== null && compare(val, opVal) > 0;
      case "gte":
        return val !== undefined && val !== null && compare(val, opVal) >= 0;
      case "lt":
        return val !== undefined && val !== null && compare(val, opVal) < 0;
      case "lte":
        return val !== undefined && val !== null && compare(val, opVal) <= 0;
      case "in":
        return opVal.some((v) => valEquals(val, v));
      default:
        throw new Error(`prisma-memory: unsupported where operator "${op}"`);
    }
  });
}

function matchWhere(rec, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) =>
    key === "OR" && Array.isArray(cond) ? cond.some((w) => matchWhere(rec, w)) : matchField(rec[key], cond),
  );
}

function applyOrder(rows, orderBy) {
  if (!orderBy) return rows;
  const [field, dir] = Object.entries(orderBy)[0];
  const sorted = [...rows].sort((a, b) => compare(a[field], b[field]));
  return dir === "desc" ? sorted.reverse() : sorted;
}

function applyData(rec, data) {
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === "object" && !(val instanceof Date)) {
      if ("increment" in val) { rec[key] = (rec[key] || 0) + val.increment; continue; }
      if ("decrement" in val) { rec[key] = (rec[key] || 0) - val.decrement; continue; }
      if ("set" in val) { rec[key] = val.set; continue; }
      if ("connect" in val) {
        const ids = (Array.isArray(val.connect) ? val.connect : [val.connect]).map((c) => c.id);
        rec[key] = [...new Set([...(Array.isArray(rec[key]) ? rec[key] : []), ...ids])];
        continue;
      }
    }
    rec[key] = val;
  }
}

function makeDelegate(store, prefix, nextId) {
  return {
    async create({ data } = {}) {
      const rec = { createdAt: new Date(), ...data };
      if (rec.id === undefined) rec.id = nextId(prefix);
      for (const fields of UNIQUE_INDEXES[prefix] || []) {
        if (fields.some((f) => rec[f] === null || rec[f] === undefined)) continue;
        const clash = [...store.values()].some((r) => fields.every((f) => valEquals(r[f], rec[f])));
        if (clash) {
          const err = new Error(`prisma-memory: unique constraint failed on ${prefix}(${fields.join(", ")})`);
          err.code = "P2002";
          err.meta = { target: fields };
          throw err;
        }
      }
      store.set(rec.id, { ...rec });
      return { ...rec };
    },
    async createMany({ data = [] } = {}) {
      for (const row of data) await this.create({ data: row });
      return { count: data.length };
    },
    async findUnique({ where } = {}) {
      if (where && where.id !== undefined) {
        const rec = store.get(where.id);
        return rec ? { ...rec } : null;
      }
      const rec = [...store.values()].find((r) => matchWhere(r, where));
      return rec ? { ...rec } : null;
    },
    async findFirst({ where, orderBy } = {}) {
      const rows = applyOrder([...store.values()].filter((r) => matchWhere(r, where)), orderBy);
      return rows[0] ? { ...rows[0] } : null;
    },
    async findMany({ where, orderBy, take } = {}) {
      let rows = applyOrder([...store.values()].filter((r) => matchWhere(r, where)), orderBy);
      if (typeof take === "number") rows = rows.slice(0, take);
      return rows.map((r) => ({ ...r }));
    },
    async update({ where, data }) {
      const rec = where && where.id !== undefined
        ? store.get(where.id)
        : [...store.values()].find((r) => matchWhere(r, where));
      if (!rec) throw new Error(`prisma-memory: ${prefix} record not found for update`);
      applyData(rec, data);
      return { ...rec };
    },
    async updateMany({ where, data } = {}) {
      const rows = [...store.values()].filter((r) => matchWhere(r, where));
      for (const rec of rows) applyData(rec, data);
      return { count: rows.length };
    },
    async delete({ where } = {}) {
      const rec = where && where.id !== undefined ? store.get(where.id) : [...store.values()].find((r) => matchWhere(r, where));
      if (!rec) throw new Error(`prisma-memory: ${prefix} record not found for delete`);
      store.delete(rec.id);
      return { ...rec };
    },
    async deleteMany({ where } = {}) {
      const rows = [...store.values()].filter((r) => matchWhere(r, where));
      for (const rec of rows) store.delete(rec.id);
      return { count: rows.length };
    },
    async aggregate({ where, _sum } = {}) {
      const rows = [...store.values()].filter((r) => matchWhere(r, where));
      const sums = {};
      for (const field of Object.keys(_sum || {})) {
        sums[field] = rows.reduce((acc, r) => acc + (r[field] || 0), 0);
      }
      return { _sum: sums };
    },
    async count({ where } = {}) {
      return [...store.values()].filter((r) => matchWhere(r, where)).length;
    },
  };
}

function cloneDb(db) {
  const clone = {};
  for (const key of Object.keys(db)) {
    clone[key] = new Map([...db[key]].map(([id, rec]) => [id, { ...rec }]));
  }
  return clone;
}

/**
 * A tiny run-in-order queue. Real Postgres serializes conflicting
 * transactions (a second `updateMany` claim blocks until the first commits,
 * then re-evaluates its WHERE clause and sees 0 matching rows). This stub's
 * transactions are snapshot-clone-and-commit, which by itself has no such
 * blocking behavior: two `$transaction` calls started before either commits
 * would each clone the same pre-claim state and both believe they won a
 * race. Routing every `$transaction` call on a given in-memory database
 * through one mutex makes concurrent callers (e.g. two `Promise.all`'d
 * `onOrderCompleted` calls for the same order) run their transactions one at
 * a time, in start order, which is what actually gives the second one a
 * post-first-commit view to correctly lose its claim against.
 */
function createMutex() {
  let tail = Promise.resolve();
  return function withLock(fn) {
    const result = tail.then(fn, fn);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

function buildClient(db, nextId, mutex) {
  const client = {};
  for (const name of COLLECTIONS) {
    client[name] = makeDelegate(db[name], name, nextId);
  }
  client.$transaction = (fn) =>
    mutex(async () => {
      const base = cloneDb(db);
      const snapshot = cloneDb(db);
      const tx = buildClient(snapshot, nextId, mutex);
      // No try/catch: if fn throws, we simply never commit, which is the rollback.
      const result = await fn(tx);
      // Commit only what this transaction changed (like row-level writes in
      // Postgres), so a non-transactional write that landed while it ran is
      // not clobbered by the stale snapshot.
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      for (const key of Object.keys(db)) {
        for (const [id, rec] of snapshot[key]) {
          if (!base[key].has(id) || !same(base[key].get(id), rec)) db[key].set(id, rec);
        }
        for (const id of base[key].keys()) {
          if (!snapshot[key].has(id)) db[key].delete(id);
        }
      }
      return result;
    });
  return client;
}

/**
 * @param {object} seed - e.g. { users: [...], creditLots: [...], creditEvents: [...],
 *   rewards: [...], orders: [...], seats: [...], supportCases: [...] }
 */
export function makeMemoryPrisma(seed = {}) {
  const db = Object.fromEntries(COLLECTIONS.map((name) => [name, new Map()]));
  let seq = 0;
  const nextId = (prefix) => `${prefix}_${++seq}`;

  const seedMap = {
    users: "user",
    creditLots: "creditLot",
    creditEvents: "creditEvent",
    rewards: "reward",
    orders: "order",
    seats: "seat",
    supportCases: "supportCase",
    userBadges: "userBadge",
    badges: "badge",
    menuItems: "menuItem",
    orderItems: "orderItem",
    locations: "location",
    tenants: "tenant",
    guests: "guest",
    promoCodes: "promoCode",
    promoCodeUsages: "promoCodeUsage",
    giftCards: "giftCard",
    mealGifts: "mealGift",
    mealGiftChains: "mealGiftChain",
    challenges: "challenge",
    userChallenges: "userChallenge",
    groupOrders: "groupOrder",
  };
  for (const [seedKey, collection] of Object.entries(seedMap)) {
    for (const rec of seed[seedKey] || []) {
      const withId = rec.id === undefined ? { ...rec, id: nextId(collection) } : { ...rec };
      db[collection].set(withId.id, withId);
    }
  }

  return buildClient(db, nextId, createMutex());
}
