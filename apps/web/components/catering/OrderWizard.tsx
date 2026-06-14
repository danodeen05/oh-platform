"use client";

import Image from "next/image";
import { useState } from "react";
import { type CateringEvent, type OrderItem } from "@/lib/catering/api";
import { getMenuItemImage, isNoNoodlesItem } from "@/lib/menu-images";

const SLIDER_LABELS = ["None", "Light", "Normal", "Extra"] as const;
type SliderLabel = typeof SLIDER_LABELS[number];

interface OrderWizardProps {
  event: CateringEvent;
  guestName: string;
  onSubmit: (items: OrderItem[]) => Promise<void>;
  isSubmitting: boolean;
  error: string;
}

function MenuCard({
  item,
  selected,
  displayName,
  description,
  onSelect,
}: {
  item: { id: string; name: string };
  selected: boolean;
  displayName: string;
  description: string;
  onSelect: () => void;
}) {
  const imgSrc = getMenuItemImage(item.name);
  const noNoodles = isNoNoodlesItem(item.name);
  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "16px",
        background: selected
          ? "var(--brand-surface)"
          : "rgba(255,255,255,0.04)",
        border: selected
          ? "2px solid var(--brand-primary)"
          : "1.5px solid var(--brand-border)",
        borderRadius: "16px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        width: "100%",
        textAlign: "left",
      }}
    >
      {noNoodles ? (
        // Same crossed-out treatment as the regular ordering flow: grayed noodle
        // image with a red diagonal cross.
        <div style={{ position: "relative", width: "72px", height: "72px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "#f5f5f5" }}>
          <Image src="/menu images/Ramen Noodles.png" alt="No Noodles" width={72} height={72} style={{ objectFit: "cover", opacity: 0.4, filter: "grayscale(100%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "140%", height: 3, background: "#dc2626", transform: "rotate(-45deg)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
          </div>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "140%", height: 3, background: "#dc2626", transform: "rotate(45deg)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
          </div>
        </div>
      ) : imgSrc && (
        <div style={{ width: "72px", height: "72px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "#f5f5f5" }}>
          <Image src={imgSrc} alt={displayName} width={72} height={72} style={{ objectFit: "cover" }} />
        </div>
      )}
      <div>
        <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
          {displayName}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--brand-primary)", opacity: 0.65, fontFamily: "'Raleway', sans-serif" }}>
          {description}
        </p>
      </div>
    </button>
  );
}

/**
 * 3-step catering order wizard.
 *
 * Step 1: Choose Your Soup  (from event.menu.soups)
 * Step 2: Choose Your Noodles (from event.menu.noodles) + condiment info
 * Step 3: Customize (bok choy + sprouts sliders) + summary + submit
 *
 * No pricing. No spice/richness sliders. Pure CSS-var theming.
 */
export default function OrderWizard({
  event,
  guestName,
  onSubmit,
  isSubmitting,
  error,
}: OrderWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedSoupId, setSelectedSoupId] = useState<string | null>(null);
  const [selectedNoodleId, setSelectedNoodleId] = useState<string | null>(null);

  // Sliders: only bok choy + sprouts
  const defaultSliders: Record<string, number> = {};
  for (const s of event.menu.sliders) {
    defaultSliders[s.id] = 2; // default: Normal
  }
  const [sliders, setSliders] = useState<Record<string, number>>(defaultSliders);

  const firstName = guestName.split(" ")[0];

  // Derive display name for soup items
  const getSoupDisplay = (name: string) => {
    if (name.toLowerCase().includes("no beef")) return { display: "Classic Beef Noodle Soup (no meat)", desc: "Rich, slow-simmered broth with noodles — no meat" };
    return { display: "Classic Beef Noodle Soup", desc: "Slow-braised beef, signature broth, noodles" };
  };

  const getNoodleDisplay = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("no noodle")) return { display: "No Noodles", desc: "Just the broth and toppings — skip the noodles" };
    if (n.includes("gluten free")) return { display: "Wide Noodles (Gluten Free)", desc: "Broad, chewy noodles — certified gluten free" };
    if (n.includes("thin") || n.includes("flat")) return { display: "Thin & Flat Noodles", desc: "Silky, delicate ribbon noodles" };
    return { display: "Wide Noodles", desc: "Classic broad, satisfying noodles" };
  };

  const selectedSoup = event.menu.soups.find(s => s.id === selectedSoupId);
  const selectedNoodle = event.menu.noodles.find(n => n.id === selectedNoodleId);

  // Only show bok choy + sprouts in sliders
  const relevantSliders = event.menu.sliders.filter(s =>
    s.name.toLowerCase().includes("bok choy") || s.name.toLowerCase().includes("sprout")
  );

  const buildItems = (): OrderItem[] => {
    const items: OrderItem[] = [];
    if (selectedSoupId) items.push({ menuItemId: selectedSoupId, quantity: 1 });
    if (selectedNoodleId) items.push({ menuItemId: selectedNoodleId, quantity: 1 });
    for (const slider of relevantSliders) {
      const val = sliders[slider.id] ?? 2;
      items.push({
        menuItemId: slider.id,
        quantity: val,
        selectedValue: SLIDER_LABELS[val],
      });
    }
    return items;
  };

  return (
    <div style={{ width: "100%", maxWidth: "400px", margin: "0 auto" }}>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "20px" }}>
        {[1, 2, 3].map(s => (
          <div
            key={s}
            style={{
              width: "10px", height: "10px", borderRadius: "50%",
              background: s === step ? "var(--brand-primary)" : "var(--brand-border)",
              transition: "background 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Step title */}
      <h2 style={{
        textAlign: "center",
        margin: "0 0 20px",
        fontSize: "clamp(1.2rem, 5vw, 1.5rem)",
        fontWeight: 700,
        color: "var(--brand-primary)",
        fontFamily: "'Raleway', sans-serif",
      }}>
        {step === 1 && "Choose Your Soup"}
        {step === 2 && "Choose Your Noodles"}
        {step === 3 && (firstName ? `${firstName}'s Order` : "Review Your Order")}
      </h2>

      {/* ---- Step 1: Soup ---- */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {event.menu.soups.map(soup => {
            const { display, desc } = getSoupDisplay(soup.name);
            return (
              <MenuCard
                key={soup.id}
                item={soup}
                selected={selectedSoupId === soup.id}
                displayName={display}
                description={soup.description || desc}
                onSelect={() => setSelectedSoupId(soup.id)}
              />
            );
          })}

          <button
            onClick={() => setStep(2)}
            disabled={!selectedSoupId}
            style={{
              marginTop: "12px",
              padding: "14px",
              background: selectedSoupId ? "var(--brand-primary)" : "var(--brand-border)",
              color: selectedSoupId ? "var(--brand-on-primary)" : "var(--brand-primary)",
              border: "none",
              borderRadius: "50px",
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 700,
              fontSize: "0.95rem",
              letterSpacing: "1px",
              cursor: selectedSoupId ? "pointer" : "default",
              opacity: selectedSoupId ? 1 : 0.5,
              transition: "all 0.2s ease",
            }}
          >
            Choose Noodles
          </button>
        </div>
      )}

      {/* ---- Step 2: Noodles ---- */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {event.menu.noodles.map(noodle => {
            const { display, desc } = getNoodleDisplay(noodle.name);
            return (
              <MenuCard
                key={noodle.id}
                item={noodle}
                selected={selectedNoodleId === noodle.id}
                displayName={display}
                description={noodle.description || desc}
                onSelect={() => setSelectedNoodleId(noodle.id)}
              />
            );
          })}

          {/* Condiment info */}
          <div style={{
            marginTop: "8px",
            padding: "12px 16px",
            background: "var(--brand-surface)",
            border: "1px solid var(--brand-border)",
            borderRadius: "12px",
          }}>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif", lineHeight: 1.5, opacity: 0.8 }}>
              Cilantro, Green Onions, Pickled Mustard Greens & Chili Oil are available at the event. Help yourself!
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
            <button
              onClick={() => setStep(3)}
              disabled={!selectedNoodleId}
              style={{
                padding: "14px",
                background: selectedNoodleId ? "var(--brand-primary)" : "var(--brand-border)",
                color: selectedNoodleId ? "var(--brand-on-primary)" : "var(--brand-primary)",
                border: "none",
                borderRadius: "50px",
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 700,
                fontSize: "0.95rem",
                letterSpacing: "1px",
                cursor: selectedNoodleId ? "pointer" : "default",
                opacity: selectedNoodleId ? 1 : 0.5,
                transition: "all 0.2s ease",
              }}
            >
              Customize Bowl
            </button>
            <button
              onClick={() => setStep(1)}
              style={{ background: "transparent", border: "none", color: "var(--brand-primary)", opacity: 0.55, cursor: "pointer", fontFamily: "'Raleway', sans-serif", fontSize: "0.82rem", padding: "6px" }}
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* ---- Step 3: Sliders + Summary ---- */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Slider section */}
          {relevantSliders.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {relevantSliders.map(slider => {
                const current = sliders[slider.id] ?? 2;
                const imgSrc = getMenuItemImage(slider.name);
                return (
                  <div
                    key={slider.id}
                    style={{
                      background: "var(--brand-surface)",
                      border: "1px solid var(--brand-border)",
                      borderRadius: "12px",
                      padding: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      {imgSrc && (
                        <div style={{ width: "44px", height: "44px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                          <Image src={imgSrc} alt={slider.name} width={44} height={44} style={{ objectFit: "cover" }} />
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
                        {slider.name}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {SLIDER_LABELS.map((label, idx) => (
                        <button
                          key={label}
                          onClick={() => setSliders(prev => ({ ...prev, [slider.id]: idx }))}
                          style={{
                            flex: 1,
                            padding: "7px 3px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            fontFamily: "'Raleway', sans-serif",
                            background: current === idx ? "var(--brand-primary)" : "var(--brand-surface)",
                            color: current === idx ? "var(--brand-on-primary)" : "var(--brand-primary)",
                            border: "1.5px solid var(--brand-border)",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Order summary */}
          <div style={{
            background: "var(--brand-surface)",
            border: "1px solid var(--brand-border)",
            borderRadius: "12px",
            padding: "16px 20px",
          }}>
            <p style={{ margin: "0 0 10px", fontSize: "0.7rem", color: "var(--brand-primary)", opacity: 0.55, fontFamily: "'Raleway', sans-serif", textTransform: "uppercase", letterSpacing: "1px" }}>
              Your Bowl
            </p>
            {selectedSoup && (
              <p style={{ margin: "6px 0", fontSize: "0.9rem", color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif", fontWeight: 600 }}>
                {getSoupDisplay(selectedSoup.name).display}
              </p>
            )}
            {selectedNoodle && (
              <p style={{ margin: "6px 0", fontSize: "0.9rem", color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
                {getNoodleDisplay(selectedNoodle.name).display}
              </p>
            )}
            {relevantSliders.map(slider => (
              <p key={slider.id} style={{ margin: "6px 0", display: "flex", justifyContent: "space-between", fontSize: "0.88rem", color: "var(--brand-primary)", opacity: 0.8, fontFamily: "'Raleway', sans-serif" }}>
                <span>{slider.name}</span>
                <span style={{ fontWeight: 600 }}>{SLIDER_LABELS[sliders[slider.id] ?? 2]}</span>
              </p>
            ))}
          </div>

          {error && (
            <div style={{
              padding: "12px 16px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
            }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#ef4444", fontFamily: "'Raleway', sans-serif", lineHeight: 1.4 }}>
                {error}
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
            <button
              onClick={() => onSubmit(buildItems())}
              disabled={isSubmitting}
              style={{
                padding: "15px",
                background: "var(--brand-primary)",
                color: "var(--brand-on-primary)",
                border: "none",
                borderRadius: "50px",
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 700,
                fontSize: "1rem",
                letterSpacing: "1px",
                cursor: isSubmitting ? "default" : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
                transition: "all 0.2s ease",
              }}
            >
              {isSubmitting ? "Placing Order..." : "Place My Order"}
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={isSubmitting}
              style={{ background: "transparent", border: "none", color: "var(--brand-primary)", opacity: 0.55, cursor: "pointer", fontFamily: "'Raleway', sans-serif", fontSize: "0.82rem", padding: "6px" }}
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
