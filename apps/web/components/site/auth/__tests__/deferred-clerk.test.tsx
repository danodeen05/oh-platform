// @vitest-environment jsdom
//
// Task G2a: (site) pages render from the server's signed-in answer and load
// Clerk later. These pin the SiteAuth contract DeferredClerk gives the page
// before and after Clerk (here a fake ClerkBridge) arrives.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { useSiteAuth, type SiteAuth } from "@/lib/site/auth";

// The fake bridge: records that it mounted and reports whatever `nextSnapshot` holds.
const bridge = vi.hoisted(() => ({
  mounted: 0,
  snapshot: null as null | Record<string, unknown>,
  report: null as null | ((s: unknown) => void),
}));
vi.mock("../ClerkBridge", () => ({
  ClerkBridge: ({ onSnapshot }: { onSnapshot: (s: unknown) => void }) => {
    const { useEffect } = require("react");
    useEffect(() => {
      bridge.mounted += 1;
      bridge.report = onSnapshot;
      if (bridge.snapshot) onSnapshot(bridge.snapshot);
    }, [onSnapshot]);
    return null;
  },
}));

import { DeferredClerk } from "../DeferredClerk";
import { SignedIn, SignedOut, SignInTrigger } from "../AuthTriggers";

let seen: SiteAuth | null = null;
function Probe() {
  seen = useSiteAuth();
  return null;
}

let root: Root | null = null;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  bridge.mounted = 0;
  bridge.snapshot = null;
  bridge.report = null;
  seen = null;
  host = document.createElement("div");
  document.body.appendChild(host);
  // Keep the "after load, when idle" path from firing on its own in these tests.
  Object.defineProperty(document, "readyState", { configurable: true, get: () => "loading" });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
});

async function mount(initialSignedIn: boolean, extra: React.ReactNode = null) {
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <DeferredClerk initialSignedIn={initialSignedIn} locale="en">
        <Probe />
        {extra}
      </DeferredClerk>,
    );
  });
}

const flush = () => act(async () => new Promise((r) => setTimeout(r, 20)));

function clerkSnapshot(over: Record<string, unknown> = {}) {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: "user_1",
    email: "a@b.c",
    name: "A",
    getToken: vi.fn(async () => "tok_live"),
    openSignIn: vi.fn(),
    openSignUp: vi.fn(),
    ...over,
  };
}

describe("DeferredClerk (Task G2a)", () => {
  it("signed out per the server: loaded at once, no token, and Clerk is not loaded for it", async () => {
    await mount(false);
    expect(seen!.isLoaded).toBe(true);
    expect(seen!.isSignedIn).toBe(false);
    await expect(seen!.getToken()).resolves.toBeNull();
    await flush();
    expect(bridge.mounted).toBe(0);
  });

  it("signed in per the server: signed in but not loaded until Clerk answers, and Clerk loads right away", async () => {
    bridge.snapshot = clerkSnapshot();
    await mount(true);
    await flush();
    expect(bridge.mounted).toBe(1);
    expect(seen!.isLoaded).toBe(true);
    expect(seen!.isSignedIn).toBe(true);
    expect(seen!.email).toBe("a@b.c");
    await expect(seen!.getToken()).resolves.toBe("tok_live");
  });

  it("a token request from a signed-in page waits for Clerk instead of returning nothing", async () => {
    await mount(true); // the bridge mounts, but Clerk hasn't answered yet
    let token: string | null | undefined;
    const pending = seen!.getToken().then((t) => (token = t));
    await flush();
    expect(bridge.mounted).toBe(1);
    expect(seen!.isLoaded).toBe(false);
    expect(token).toBeUndefined();
    await act(async () => bridge.report!(clerkSnapshot()));
    await pending;
    expect(token).toBe("tok_live");
    expect(seen!.isLoaded).toBe(true);
  });

  it("the sign-in trigger keeps the button's own onClick, loads Clerk, and opens the modal once it's ready", async () => {
    const snap = clerkSnapshot({ isSignedIn: false, userId: null });
    bridge.snapshot = snap;
    const own = vi.fn();
    await mount(false, createElement(SignInTrigger, null, createElement("button", { id: "si", onClick: own }, "Sign in")));
    expect(bridge.mounted).toBe(0);
    await act(async () => {
      (host.querySelector("#si") as HTMLButtonElement).click();
    });
    await flush();
    expect(own).toHaveBeenCalledTimes(1);
    expect(bridge.mounted).toBe(1);
    expect(snap.openSignIn).toHaveBeenCalledTimes(1);
  });

  it("server-renders the right variant from the server's answer (no flash on hydration)", () => {
    const tree = (signedIn: boolean) =>
      renderToString(
        <DeferredClerk initialSignedIn={signedIn} locale="en">
          <SignedIn>IN</SignedIn>
          <SignedOut>OUT</SignedOut>
        </DeferredClerk>,
      );
    expect(tree(true)).toContain("IN");
    expect(tree(true)).not.toContain("OUT");
    expect(tree(false)).toContain("OUT");
    expect(tree(false)).not.toContain("IN");
  });
});
