/** In-memory Prisma stub shared by the plan route tests (no database needed). */

export function makePrismaStub() {
  const codes = new Map();
  const sessions = new Map();
  const views = new Map();
  const questions = new Map();
  const chats = [];
  const summaries = [];
  const ndas = [];
  let countersigner = null;
  let seq = 0;
  const id = (p) => `${p}_${++seq}`;

  function withNdas(code) {
    if (!code) return code;
    return { ...code, ndas: ndas.filter((n) => n.accessCodeId === code.id && n.status === "SIGNED") };
  }
  function matchNda(n, where = {}) {
    for (const [k, v] of Object.entries(where)) {
      if (k === "status" && v && typeof v === "object" && Array.isArray(v.in)) { if (!v.in.includes(n.status)) return false; continue; }
      if (n[k] !== v) return false;
    }
    return true;
  }
  function applyNda(rec, data) {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in v) rec[k] = (rec[k] || 0) + v.increment;
      else rec[k] = v;
    }
    rec.updatedAt = new Date();
  }

  const stub = {
    _codes: codes,
    _sessions: sessions,
    _views: views,
    _questions: questions,
    _chats: chats,
    _summaries: summaries,
    _ndas: ndas,
    get _countersigner() { return countersigner; },
    planAccessCode: {
      async findUnique({ where, include }) {
        const rec = where.code
          ? [...codes.values()].find((c) => c.code === where.code)
          : codes.get(where.id);
        if (!rec) return null;
        const mine = [...sessions.values()].filter((s) => s.accessCodeId === rec.id);
        const out = { ...withNdas(rec), _count: { sessions: mine.length } };
        if (include?.sessions) {
          out.sessions = mine.map((s) => ({
            ...s,
            sectionViews: [...views.values()].filter((v) => v.sessionId === s.id),
          }));
        }
        if (include?.questions) {
          out.questions = [...questions.values()].filter((q) => q.accessCodeId === rec.id);
        }
        return out;
      },
      async create({ data }) {
        if ([...codes.values()].some((c) => c.code === data.code)) {
          const err = new Error("unique"); err.code = "P2002"; throw err;
        }
        const rec = { id: id("code"), createdAt: new Date(), lastViewedAt: null, revokedAt: null, expiresAt: null, maxSessions: null, ndaRequired: false, ...data };
        codes.set(rec.id, rec);
        return rec;
      },
      async update({ where, data }) {
        const rec = codes.get(where.id);
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === "object" && "increment" in v) rec[k] = (rec[k] || 0) + v.increment;
          else rec[k] = v;
        }
        return rec;
      },
      async findMany() {
        return [...codes.values()].map((c) => ({
          ...c,
          ndas: ndas.filter((n) => n.accessCodeId === c.id && n.status !== "VOIDED"),
          _count: {
            sessions: [...sessions.values()].filter((s) => s.accessCodeId === c.id).length,
            questions: [...questions.values()].filter((q) => q.accessCodeId === c.id).length,
          },
        }));
      },
    },
    planViewSession: {
      async create({ data }) {
        const rec = { id: id("sess"), startedAt: new Date(), lastSeenAt: new Date(), totalSeconds: 0, ...data };
        sessions.set(rec.id, rec);
        return rec;
      },
      async findUnique({ where }) {
        const rec = sessions.get(where.id);
        if (!rec) return null;
        return { ...rec, accessCode: withNdas(codes.get(rec.accessCodeId)) };
      },
      async update({ where, data }) {
        const rec = sessions.get(where.id);
        if (data.totalSeconds?.increment) rec.totalSeconds += data.totalSeconds.increment;
        if (data.lastSeenAt) rec.lastSeenAt = data.lastSeenAt;
        if (data.events) rec.events = data.events;
        return rec;
      },
      async groupBy() {
        const out = new Map();
        for (const s of sessions.values()) out.set(s.accessCodeId, (out.get(s.accessCodeId) || 0) + s.totalSeconds);
        return [...out.entries()].map(([accessCodeId, total]) => ({ accessCodeId, _sum: { totalSeconds: total } }));
      },
    },
    planSectionView: {
      async findUnique({ where }) {
        return views.get(`${where.sessionId_sectionKey.sessionId}:${where.sessionId_sectionKey.sectionKey}`) || null;
      },
      async upsert({ where, create, update }) {
        const key = `${where.sessionId_sectionKey.sessionId}:${where.sessionId_sectionKey.sectionKey}`;
        const existing = views.get(key);
        if (existing) {
          existing.seconds += update.seconds.increment;
          existing.interactions += update.interactions.increment;
          if (update.targets) existing.targets = update.targets;
          return existing;
        }
        const rec = { id: id("view"), enteredAt: new Date(), ...create };
        views.set(key, rec);
        return rec;
      },
    },
    planQuestion: {
      async create({ data }) {
        const rec = { id: id("q"), createdAt: new Date(), answeredAt: null, answerBody: null, ...data };
        questions.set(rec.id, rec);
        return rec;
      },
      async count({ where }) {
        return [...questions.values()].filter((q) => q.accessCodeId === where.accessCodeId && (!where.createdAt?.gte || q.createdAt >= where.createdAt.gte)).length;
      },
      async findUnique({ where }) { return questions.get(where.id) || null; },
      async update({ where, data }) { const rec = questions.get(where.id); Object.assign(rec, data); return rec; },
    },
    planChatMessage: {
      async create({ data }) {
        const rec = { id: id("chat"), createdAt: new Date(Date.now() + chats.length), escalated: false, ...data };
        chats.push(rec);
        return rec;
      },
      async count({ where }) {
        return chats.filter((c) => (!where.sessionId || c.sessionId === where.sessionId)
          && (!where.accessCodeId || c.accessCodeId === where.accessCodeId)
          && (!where.role || c.role === where.role)
          && (!where.createdAt?.gte || c.createdAt >= where.createdAt.gte)
          && (!where.createdAt?.gt || c.createdAt > where.createdAt.gt)).length;
      },
      async findMany({ where, orderBy, take }) {
        let rows = chats.filter((c) => c.sessionId === where.sessionId && (!where.createdAt?.gt || c.createdAt > where.createdAt.gt));
        if (orderBy?.createdAt === "desc") rows = [...rows].reverse();
        return take ? rows.slice(0, take) : rows;
      },
    },
    planVisitSummary: {
      async findFirst({ where }) {
        const rows = summaries.filter((r) => r.sessionId === where.sessionId).sort((a, b) => b.visitEnd - a.visitEnd);
        return rows[0] || null;
      },
      async create({ data }) { const rec = { id: id("visit"), ...data }; summaries.push(rec); return rec; },
      async update({ where, data }) { const rec = summaries.find((r) => r.id === where.id); Object.assign(rec, data); return rec; },
    },
    planNda: {
      async findFirst({ where, orderBy }) {
        let rows = ndas.filter((n) => matchNda(n, where));
        if (orderBy?.createdAt === "desc") rows = [...rows].sort((a, b) => b.createdAt - a.createdAt || b.seq - a.seq);
        return rows[0] ? { ...rows[0] } : null;
      },
      async findMany({ where }) {
        return ndas.filter((n) => matchNda(n, where)).map((n) => ({ ...n }));
      },
      async findUnique({ where, include }) {
        const rec = ndas.find((n) => n.id === where.id);
        if (!rec) return null;
        return include?.accessCode ? { ...rec, accessCode: codes.get(rec.accessCodeId) } : { ...rec };
      },
      async create({ data }) {
        const rec = {
          id: id("nda"), seq: seq, createdAt: new Date(Date.now() + ndas.length), updatedAt: new Date(), status: "DRAFT",
          otpAttempts: 0, otpSendCount: 0, ...data,
        };
        ndas.push(rec);
        return { ...rec };
      },
      async update({ where, data }) {
        const rec = ndas.find((n) => n.id === where.id);
        applyNda(rec, data);
        return { ...rec };
      },
      async updateMany({ where, data }) {
        const rows = ndas.filter((n) => matchNda(n, where));
        for (const r of rows) applyNda(r, data);
        return { count: rows.length };
      },
    },
    planNdaCountersigner: {
      async findUnique() { return countersigner ? { ...countersigner } : null; },
      async upsert({ create, update }) {
        countersigner = countersigner ? { ...countersigner, ...update, updatedAt: new Date() } : { id: "default", adoptedAt: new Date(), updatedAt: new Date(), ...create };
        return { ...countersigner };
      },
      async deleteMany() { const had = countersigner ? 1 : 0; countersigner = null; return { count: had }; },
    },
  };
  return stub;
}
