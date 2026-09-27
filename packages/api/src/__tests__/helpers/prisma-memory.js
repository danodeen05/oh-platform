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
 * (returns {count}), aggregate ({_sum}), count.
 *
 * Plus `$transaction(fn)`: runs `fn(tx)` against a cloned snapshot of the
 * whole in-memory database. If `fn` resolves, the snapshot is committed
 * back over the real collections; if it throws, the snapshot is discarded
 * and the real collections are left untouched (rollback).
 */

const COLLECTIONS = ["creditLot", "creditEvent", "user", "reward", "order", "seat", "supportCase"];

function toTime(v) {
  return v instanceof Date ? v.getTime() : v;
}

function valEquals(a, b) {
  if (a instanceof Date || b instanceof Date) return toTime(a) === toTime(b);
  return a === b;
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
  return Object.entries(where).every(([key, cond]) => matchField(rec[key], cond));
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
    }
    rec[key] = val;
  }
}

function makeDelegate(store, prefix, nextId) {
  return {
    async create({ data } = {}) {
      const rec = { createdAt: new Date(), ...data };
      if (rec.id === undefined) rec.id = nextId(prefix);
      store.set(rec.id, { ...rec });
      return { ...rec };
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

function buildClient(db, nextId) {
  const client = {};
  for (const name of COLLECTIONS) {
    client[name] = makeDelegate(db[name], name, nextId);
  }
  client.$transaction = async (fn) => {
    const snapshot = cloneDb(db);
    const tx = buildClient(snapshot, nextId);
    // No try/catch: if fn throws, we simply never commit, which is the rollback.
    const result = await fn(tx);
    for (const key of Object.keys(db)) {
      db[key].clear();
      for (const [id, rec] of snapshot[key]) db[key].set(id, rec);
    }
    return result;
  };
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
  };
  for (const [seedKey, collection] of Object.entries(seedMap)) {
    for (const rec of seed[seedKey] || []) {
      const withId = rec.id === undefined ? { ...rec, id: nextId(collection) } : { ...rec };
      db[collection].set(withId.id, withId);
    }
  }

  return buildClient(db, nextId);
}
