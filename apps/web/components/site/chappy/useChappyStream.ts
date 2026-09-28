"use client";

/**
 * The Chappy web chat client (Task E1).
 *
 * `useChappyStream({ locale }) -> { messages, send(text), status, reset(), retry() }`
 *
 * Identity (packages/api/src/chappy/routes.js, requireChappyIdentity): a
 * signed-in member sends `Authorization: Bearer <Clerk session token>`; a
 * guest sends its signed token as `x-chappy-guest` (guest.ts). Nothing else
 * is identity: no user id, email or session id is ever sent.
 *
 * Stable identity. The retired widget keyed its history effect on values
 * that flickered while Clerk loaded (a DB user id fetched by email, the
 * guest token state, the api helper), so it re-fetched history and dropped
 * the conversation on re-renders. Here the only effect dependency is one
 * string, `identityKey`: null until Clerk has loaded, then "guest" or
 * "member:<Clerk user id>". getToken and the identity are read through refs,
 * so the fetch helpers are stable too. Signing in changes the key: the
 * guest conversation is left behind (never merged) and the member's own
 * conversation loads. Signing out goes back to the guest one.
 *
 * Streaming: POST /chappy/chat is SSE over fetch, read from `response.body`
 * through a TextDecoderStream (stream.ts). Each event folds into the pending
 * assistant message (applyEvent). A turn that starts under one identity and
 * finishes after the identity changed (or after reset) is ignored.
 */
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { SITE_API_URL } from "@/lib/site/api";
import { ensureGuestToken, readGuestToken } from "./guest";
import { CHAPPY_MESSAGE_MAX, applyEvent, errorFromResponse, readSse, type ChatError, type ChatMessage } from "./stream";

export type ChappyStatus = "loading" | "idle" | "streaming";

export interface ChappyStream {
  messages: ChatMessage[];
  status: ChappyStatus;
  send: (text: string) => void;
  reset: () => void;
  /** Re-sends the last message after a retryable error. */
  retry: () => void;
  signedIn: boolean;
}

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

type Headers = Record<string, string>;

export function useChappyStream({ locale, apiBase = SITE_API_URL }: { locale: string; apiBase?: string }): ChappyStream {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const identityKey = !isLoaded ? null : isSignedIn && userId ? `member:${userId}` : "guest";

  const identityRef = useRef(identityKey);
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    identityRef.current = identityKey;
    getTokenRef.current = getToken;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChappyStatus>("loading");
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  /** Bumped on every identity change and reset: late results from an older generation are dropped. */
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  /** The caller's identity headers, or null when there is none to send. */
  const identityHeaders = useCallback(
    async ({ mint, fresh = false }: { mint: boolean; fresh?: boolean }): Promise<Headers | null> => {
      const key = identityRef.current;
      if (!key) return null;
      if (key.startsWith("member:")) {
        let token: string | null | undefined = null;
        try {
          token = await getTokenRef.current();
        } catch {
          token = null;
        }
        return token ? { Authorization: `Bearer ${token}` } : null;
      }
      const guest = mint || fresh ? await ensureGuestToken(apiBase, { fresh }) : readGuestToken();
      return guest ? { "x-chappy-guest": guest } : null;
    },
    [apiBase],
  );

  /** fetch with identity. A guest whose token the API refuses (401) gets one fresh token and one retry. */
  const request = useCallback(
    async (path: string, init: RequestInit, { mint }: { mint: boolean }): Promise<Response | null> => {
      const headers = await identityHeaders({ mint });
      if (!headers) return null;
      const call = (h: Headers) => fetch(`${apiBase}${path}`, { ...init, headers: { ...(init.headers as Headers), ...h } });
      const res = await call(headers);
      if (res.status === 401 && identityRef.current === "guest") {
        const fresh = await identityHeaders({ mint: true, fresh: true });
        if (fresh) return call(fresh);
      }
      return res;
    },
    [apiBase, identityHeaders],
  );

  // Identity changed (or first known): drop whatever was on screen and restore that identity's conversation.
  // Keyed on the identity string alone, and at most once per identity change
  // (a re-run with the same key, e.g. React's dev double-invoke, is a no-op).
  const loadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!identityKey || loadedKeyRef.current === identityKey) return;
    loadedKeyRef.current = identityKey;
    const gen = ++genRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setMessages([]);
    setStatus("loading");
    (async () => {
      try {
        // A guest with no token yet has nothing to restore; don't mint one just to look.
        const res = await request("/chappy/history", { cache: "no-store" }, { mint: false });
        if (!res?.ok || gen !== genRef.current) return;
        const data = await res.json();
        if (gen !== genRef.current || !Array.isArray(data?.messages)) return;
        setMessages(
          data.messages
            .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
            .map((m: any, i: number) => ({ id: `h-${i}`, role: m.role, text: m.content, cards: [] })),
        );
      } catch {
        /* no history is fine: start empty */
      } finally {
        if (gen === genRef.current) setStatus("idle");
      }
    })();
  }, [identityKey, request]);

  // Abort a running turn on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    (raw: string) => {
      const text = String(raw ?? "").trim();
      if (!text || busyRef.current || !identityRef.current) return;
      const gen = genRef.current;
      const assistantId = newId("a");
      const update = (fn: (m: ChatMessage) => ChatMessage) => {
        if (gen === genRef.current) setMessages((list) => list.map((m) => (m.id === assistantId ? fn(m) : m)));
      };
      const fail = (error: ChatError) => update((m) => ({ ...m, pending: false, tool: undefined, error }));

      setMessages((list) => [
        ...list,
        { id: newId("u"), role: "user", text, cards: [] },
        { id: assistantId, role: "assistant", text: "", cards: [], pending: true },
      ]);
      if (text.length > CHAPPY_MESSAGE_MAX) {
        fail({ code: "TOO_LONG" });
        return;
      }

      busyRef.current = true;
      setStatus("streaming");
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      (async () => {
        try {
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            fail({ code: "OFFLINE" });
            return;
          }
          const res = await request(
            "/chappy/chat",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
              body: JSON.stringify({ message: text, locale, channel: "web" }),
              signal: ctrl.signal,
            },
            { mint: true },
          );
          if (!res) {
            // No identity to send: a member whose session could not produce a
            // token, or a guest token the API would not issue.
            fail({ code: identityRef.current === "guest" ? "BUSY" : "SIGN_IN_REQUIRED" });
            return;
          }
          if (!res.ok || !res.body) {
            const body = await res.json().catch(() => null);
            fail(errorFromResponse(res.status, body));
            return;
          }
          let ended = false;
          for await (const event of readSse(res.body, ctrl.signal)) {
            update((m) => applyEvent(m, event));
            if (event.event === "done" || event.event === "error") ended = true;
          }
          // The connection closed without a terminal event: keep what arrived, say so.
          if (!ended && !ctrl.signal.aborted) update((m) => applyEvent(m, { event: "error", data: { code: "INTERNAL" } }));
        } catch {
          if (!ctrl.signal.aborted) fail({ code: "OFFLINE" });
        } finally {
          if (abortRef.current === ctrl) abortRef.current = null;
          if (gen === genRef.current) {
            busyRef.current = false;
            setStatus("idle");
          }
        }
      })();
    },
    [locale, request],
  );

  const retry = useCallback(() => {
    if (busyRef.current) return;
    const list = messagesRef.current;
    let i = list.length - 1;
    while (i >= 0 && list[i].role !== "user") i--;
    if (i < 0) return;
    const text = list[i].text;
    setMessages(list.slice(0, i));
    messagesRef.current = list.slice(0, i);
    send(text);
  }, [send]);

  const reset = useCallback(() => {
    genRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setMessages([]);
    setStatus("idle");
    request("/chappy/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, { mint: false }).catch(() => {});
  }, [request]);

  return { messages, status, send, reset, retry, signedIn: !!identityKey?.startsWith("member:") };
}
