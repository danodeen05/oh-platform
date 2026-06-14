"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ThemedBackground from "@/components/catering/ThemedBackground";
import { fetchCateringMenu, type CateringMenu, type CateringMenuItem } from "@/lib/catering/api";
import { getMenuItemImage, isNoNoodlesItem } from "@/lib/menu-images";

interface PageProps {
  params: Promise<{ locale: string }>;
}

const THEME = {
  "--brand-primary": "#E0C38C",
  "--brand-secondary": "#8A7055",
  "--brand-bg": "#0D0D0B",
  "--brand-on-primary": "#1A1612",
  "--brand-surface": "rgba(199,168,120,0.08)",
  "--brand-border": "rgba(199,168,120,0.2)",
} as React.CSSProperties;

const FONT = "'Raleway', sans-serif";

// What guests get when you cater with Oh!. Each is a real, working feature of
// the attendee experience, surfaced here as the marketing highlight reel.
const INCLUDED: { title: string; body: string; icon: string }[] = [
  {
    title: "Everyone builds their own bowl",
    body: "Each guest RSVPs and customizes their own bowl from their phone. No clipboards, no guessing, no wrong orders.",
    icon: "🍜",
  },
  {
    title: "A digital fortune cookie",
    body: "Lucky numbers, a Chinese character to learn, and a this-day-in-history fact. A small moment of delight for every guest.",
    icon: "🥠",
  },
  {
    title: "A personal zodiac reading",
    body: "Add a birthdate at RSVP and we reveal each guest's Chinese zodiac, woven into a warm personal greeting.",
    icon: "🐲",
  },
  {
    title: "Live updates from the kitchen",
    body: "Guests watch their bowl move from queued to ready in real time, so the line stays relaxed and nobody hovers.",
    icon: "🔥",
  },
  {
    title: "A feedback form they will actually use",
    body: "A quick, beautiful post-event survey lets guests rate the food and the experience right from their phones.",
    icon: "⭐",
  },
  {
    title: "An event page in your colors",
    body: "We co-brand the whole experience with your logo and colors, so it feels like your event, powered by Oh!.",
    icon: "🎨",
  },
];

const STEPS: { n: number; title: string; body: string }[] = [
  { n: 1, title: "Book your date", body: "Pick a date, a lunch or dinner slot, and your headcount. Minimum 10 bowls." },
  { n: 2, title: "We co-brand your event", body: "Share your details and we build a custom, branded event page for your guests." },
  { n: 3, title: "Guests RSVP and order", body: "Everyone builds their own bowl, gets their fortune, and watches the kitchen." },
  { n: 4, title: "We arrive and serve fresh", body: "Our team brings the 48-hour broth to you and serves every bowl made to order." },
];

export default function CateringLandingPage({ params }: PageProps) {
  const { locale } = use(params);
  const [menu, setMenu] = useState<CateringMenu | null>(null);

  useEffect(() => {
    fetchCateringMenu()
      .then(setMenu)
      .catch(() => setMenu(null));
  }, []);

  const bookHref = `/${locale}/catering/book`;

  return (
    // flexShrink: 0 is required: the locale <body> is a fixed-height flex column,
    // so without it this tall page is shrunk to one viewport and the light body
    // shows through past the fold. See memory: web-fullpage-dark-bg.
    <div style={{ ...THEME, background: "var(--brand-bg)", minHeight: "100vh", flexShrink: 0 }}>
      <ThemedBackground />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* ---- Hero ---- */}
        <section
          style={{
            flexShrink: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "56px 24px 48px",
            gap: "20px",
          }}
        >
          <div style={{ animation: "ohLogoFloat 3.5s ease-in-out infinite" }}>
            <Image src="/Oh_Logo_Mark_Light.png" alt="Oh! Beef Noodle Soup" width={110} height={110} priority style={{ objectFit: "contain" }} />
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 8vw, 3rem)", fontWeight: 700, color: "var(--brand-primary)", fontFamily: FONT, letterSpacing: "1px" }}>
            Catering by Oh!
          </h1>
          <p style={{ margin: 0, maxWidth: "560px", fontSize: "clamp(1rem, 2.4vw, 1.2rem)", lineHeight: 1.7, color: "var(--brand-primary)", opacity: 0.85, fontFamily: FONT }}>
            Our 30-year family recipe, brought to your event. A rich, aromatic broth simmered for 48 hours, made fresh and served with care. For family gatherings, corporate events, and any occasion from 10 to 200 guests.
          </p>
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
            <Link href={bookHref} style={primaryBtn}>
              Book Catering
            </Link>
            <a href="#how-it-works" style={ghostBtn}>
              How it works
            </a>
          </div>
        </section>

        {/* ---- What's Included ---- */}
        <section style={{ ...sectionStyle, paddingTop: "16px" }}>
          <SectionHeading kicker="What's included" title="More than a meal" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
              width: "100%",
              maxWidth: "880px",
            }}
          >
            {INCLUDED.map((f) => (
              <div key={f.title} style={cardStyle}>
                <div style={{ fontSize: "1.8rem", lineHeight: 1 }}>{f.icon}</div>
                <p style={{ margin: "12px 0 6px", fontSize: "1.05rem", fontWeight: 700, color: "var(--brand-primary)", fontFamily: FONT }}>
                  {f.title}
                </p>
                <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "var(--brand-primary)", opacity: 0.7, fontFamily: FONT }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- The Menu ---- */}
        {menu && (
          <section style={sectionStyle}>
            <SectionHeading kicker="The menu" title="What's in the bowl" />
            <p style={{ margin: "0 0 8px", maxWidth: "560px", textAlign: "center", fontSize: "0.92rem", lineHeight: 1.6, color: "var(--brand-primary)", opacity: 0.7, fontFamily: FONT }}>
              Every guest builds their own. Choose a soup, pick your noodles, and finish with fresh toppings.
            </p>
            <div style={{ width: "100%", maxWidth: "720px", display: "flex", flexDirection: "column", gap: "28px" }}>
              <MenuGroup label="Soups" items={menu.soups} />
              <MenuGroup label="Noodles" items={menu.noodles} />
              <MenuGroup label="Fresh Toppings" items={menu.sliders} />
            </div>
            <p style={{ margin: "20px 0 0", fontSize: "0.82rem", color: "var(--brand-primary)", opacity: 0.6, fontFamily: FONT, textAlign: "center" }}>
              Cilantro, green onions, pickled mustard greens, and chili oil are always available on the side.
            </p>
          </section>
        )}

        {/* ---- How It Works ---- */}
        <section id="how-it-works" style={sectionStyle}>
          <SectionHeading kicker="How it works" title="From booking to bowls" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              width: "100%",
              maxWidth: "880px",
            }}
          >
            {STEPS.map((s) => (
              <div key={s.n} style={cardStyle}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: "var(--brand-primary)",
                    color: "var(--brand-on-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontFamily: FONT,
                    fontSize: "1.05rem",
                  }}
                >
                  {s.n}
                </div>
                <p style={{ margin: "12px 0 6px", fontSize: "1.05rem", fontWeight: 700, color: "var(--brand-primary)", fontFamily: FONT }}>
                  {s.title}
                </p>
                <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "var(--brand-primary)", opacity: 0.7, fontFamily: FONT }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Mission strip ---- */}
        <section style={{ ...sectionStyle, paddingTop: "8px", paddingBottom: "8px", gap: "14px" }}>
          <a
            href="https://www.oneredstepatatime.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#ffffff",
              padding: "10px 16px",
              borderRadius: "12px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/redsock-logo-horizontal.png"
              alt="One Red Step Foundation"
              style={{ height: "36px", width: "auto", display: "block" }}
            />
          </a>
          <p style={{ margin: 0, maxWidth: "600px", textAlign: "center", fontSize: "0.9rem", lineHeight: 1.7, color: "var(--brand-primary)", opacity: 0.7, fontFamily: FONT }}>
            A portion of every Oh! experience supports the One Red Step Foundation, our 501(c)(3) raising mental-health awareness one red step at a time.
          </p>
        </section>

        {/* ---- Final CTA ---- */}
        <section
          style={{
            flexShrink: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "32px 24px 72px",
            gap: "16px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "clamp(1.4rem, 5vw, 2rem)", fontWeight: 700, color: "var(--brand-primary)", fontFamily: FONT }}>
            Ready to cater with Oh!?
          </h2>
          <p style={{ margin: 0, color: "var(--brand-primary)", opacity: 0.75, fontFamily: FONT, fontSize: "0.95rem" }}>
            Check your date and reserve in minutes. Minimum 10 bowls.
          </p>
          <Link href={bookHref} style={primaryBtn}>
            Book Catering
          </Link>
        </section>
      </div>
    </div>
  );
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: "24px" }}>
      <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "2.5px", textTransform: "uppercase", color: "var(--brand-secondary)", fontFamily: FONT, fontWeight: 700 }}>
        {kicker}
      </p>
      <h2 style={{ margin: "8px 0 0", fontSize: "clamp(1.5rem, 5vw, 2.1rem)", fontWeight: 700, color: "var(--brand-primary)", fontFamily: FONT }}>
        {title}
      </h2>
    </div>
  );
}

function MenuGroup({ label, items }: { label: string; items: CateringMenuItem[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: "0.72rem", letterSpacing: "2px", textTransform: "uppercase", color: "var(--brand-secondary)", fontFamily: FONT, fontWeight: 700 }}>
        {label}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {items.map((item) => (
          <MenuRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function MenuRow({ item }: { item: CateringMenuItem }) {
  const imgSrc = getMenuItemImage(item.name);
  const noNoodles = isNoNoodlesItem(item.name);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "14px",
        background: "var(--brand-surface)",
        border: "1.5px solid var(--brand-border)",
        borderRadius: "16px",
      }}
    >
      {noNoodles ? (
        <div style={{ position: "relative", width: "64px", height: "64px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "#f5f5f5" }}>
          <Image src="/menu images/Ramen Noodles.png" alt="No Noodles" width={64} height={64} style={{ objectFit: "cover", opacity: 0.4, filter: "grayscale(100%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "140%", height: 3, background: "#dc2626", transform: "rotate(-45deg)" }} />
          </div>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "140%", height: 3, background: "#dc2626", transform: "rotate(45deg)" }} />
          </div>
        </div>
      ) : (
        imgSrc && (
          <div style={{ width: "64px", height: "64px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "#f5f5f5" }}>
            <Image src={imgSrc} alt={item.name} width={64} height={64} style={{ objectFit: "cover" }} />
          </div>
        )
      )}
      <div>
        <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--brand-primary)", fontFamily: FONT }}>
          {item.name}
        </p>
        {item.description && (
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", lineHeight: 1.5, color: "var(--brand-primary)", opacity: 0.7, fontFamily: FONT }}>
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  flexShrink: 0,
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "40px 24px",
};

const cardStyle: React.CSSProperties = {
  background: "var(--brand-surface)",
  border: "1.5px solid var(--brand-border)",
  borderRadius: "18px",
  padding: "22px",
};

const primaryBtn: React.CSSProperties = {
  padding: "16px 48px",
  background: "var(--brand-primary)",
  color: "var(--brand-on-primary)",
  border: "none",
  borderRadius: "50px",
  fontFamily: FONT,
  fontWeight: 700,
  fontSize: "1rem",
  letterSpacing: "1.5px",
  textDecoration: "none",
  display: "inline-block",
};

const ghostBtn: React.CSSProperties = {
  padding: "16px 36px",
  background: "transparent",
  color: "var(--brand-primary)",
  border: "1.5px solid var(--brand-border)",
  borderRadius: "50px",
  fontFamily: FONT,
  fontWeight: 600,
  fontSize: "1rem",
  letterSpacing: "1px",
  textDecoration: "none",
  display: "inline-block",
};
