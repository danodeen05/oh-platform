"use client";

/**
 * Task C3 (motion kit) lab. One instance of every primitive, in scroll
 * order, so a Playwright scroll-through can watch for jank (long tasks)
 * and a human can eyeball the result on a phone.
 */
import { useState } from "react";
import { CountUp } from "@/components/site/motion/CountUp";
import { FrameSequence } from "@/components/site/motion/FrameSequence";
import { ParallaxLayer } from "@/components/site/motion/ParallaxLayer";
import { PinnedStory } from "@/components/site/motion/PinnedStory";
import { Reveal } from "@/components/site/motion/Reveal";
import { Sheet } from "@/components/site/motion/Sheet";
import { SnapRail } from "@/components/site/motion/SnapRail";

// 16 small inline-SVG "frames" standing in for a real photographed
// sequence, a ring that fills in as the sequence progresses.
const FRAME_COUNT = 16;
function frameSvg(index: number): string {
  const pct = index / (FRAME_COUNT - 1);
  const angle = Math.round(pct * 359);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
    <rect width="320" height="320" fill="#EDE6DA"/>
    <circle cx="160" cy="160" r="120" fill="none" stroke="#8A8178" stroke-width="16"/>
    <path d="M160 160 L160 40 A120 120 0 ${angle > 180 ? 1 : 0} 1 ${
    160 + 120 * Math.sin((angle * Math.PI) / 180)
  } ${160 - 120 * Math.cos((angle * Math.PI) / 180)} Z" fill="#A94422"/>
    <text x="160" y="170" text-anchor="middle" font-size="28" fill="#1C1B19" font-family="sans-serif">${index + 1}/${FRAME_COUNT}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const FRAMES = Array.from({ length: FRAME_COUNT }, (_, i) => frameSvg(i));

const RAIL_ITEMS = ["Beef Noodle", "Spicy Beef", "Veggie Bowl", "Dumplings", "Cold Noodle", "Milk Tea"];

export function MotionLabClient() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <main data-testid="motion-lab" style={{ background: "var(--color-oh-paper)", color: "var(--color-oh-ink)" }}>
      <section style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24 }}>
        <div>
          <p>Motion kit lab (dev only)</p>
          <p>Scroll down.</p>
        </div>
      </section>

      <section style={{ padding: "80px 24px", display: "grid", gap: 40 }}>
        <Reveal from="up">
          <h2>Reveal: up</h2>
        </Reveal>
        <Reveal from="fade" delay={100}>
          <h2>Reveal: fade</h2>
        </Reveal>
        <Reveal from="scale" delay={200}>
          <h2>Reveal: scale</h2>
        </Reveal>
      </section>

      <PinnedStory screens={3}>
        {(progressVar) => (
          <div style={{ textAlign: "center" }}>
            <p>PinnedStory progress</p>
            <div
              style={{
                width: 240,
                height: 12,
                background: "var(--color-oh-ash)",
                borderRadius: 6,
                overflow: "hidden",
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "var(--color-oh-ember-deep)",
                  width: `calc(${progressVar} * 100%)`,
                }}
              />
            </div>
          </div>
        )}
      </PinnedStory>

      <section style={{ padding: "80px 24px" }}>
        <h2>FrameSequence</h2>
        <div style={{ maxWidth: 320, margin: "0 auto" }}>
          <FrameSequence frames={FRAMES} alt="Loading ring filling in as you scroll" poster={FRAMES[0]} />
        </div>
      </section>

      <section style={{ padding: "80px 24px", position: "relative", minHeight: "60svh", overflow: "hidden" }}>
        <ParallaxLayer speed={0.4} offset={60} className="oh-lab-parallax">
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 24,
              background: "var(--color-oh-olive-light)",
              margin: "0 auto",
            }}
          />
        </ParallaxLayer>
        <p style={{ textAlign: "center" }}>ParallaxLayer</p>
      </section>

      <section style={{ padding: "80px 24px" }}>
        <h2>SnapRail</h2>
        <SnapRail label="Sample menu items">
          {RAIL_ITEMS.map((item) => (
            <div
              key={item}
              style={{
                width: 200,
                height: 120,
                background: "var(--color-oh-linen)",
                borderRadius: 16,
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
              }}
            >
              {item}
            </div>
          ))}
        </SnapRail>
      </section>

      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <h2>CountUp</h2>
        <p style={{ fontSize: 48 }}>
          <CountUp to={1280} suffix=" bowls" />
        </p>
      </section>

      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <h2>Sheet</h2>
        <button type="button" onClick={() => setSheetOpen(true)}>
          Open sheet
        </button>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="Order details" snapPoints={[0.5, 1]}>
          <h3>Order details</h3>
          <p>Drag down, tap outside, or press Esc to close.</p>
          <button type="button" onClick={() => setSheetOpen(false)}>
            Close
          </button>
        </Sheet>
      </section>

      <section style={{ minHeight: "100svh", display: "grid", placeItems: "center" }}>
        <p>End of lab.</p>
      </section>
    </main>
  );
}
