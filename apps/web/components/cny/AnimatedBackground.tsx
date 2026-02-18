"use client";

import { useEffect, useState, useMemo } from "react";
import "./AnimatedBackground.css";

interface AnimatedBackgroundProps {
  /** Color theme - affects bokeh and light colors */
  theme?: "red" | "gold";
  /** Show floating bokeh circles */
  showBokeh?: boolean;
  /** Show swirling smoke effect */
  showSmoke?: boolean;
  /** Show floating light particles */
  showLights?: boolean;
  /** Show fireworks/firecrackers */
  showFireworks?: boolean;
  /** Intensity of effects (0-1) */
  intensity?: number;
}

// Seeded random for consistent positions across renders
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function AnimatedBackground({
  theme = "red",
  showBokeh = true,
  showSmoke = true,
  showLights = true,
  showFireworks = true,
  intensity = 1,
}: AnimatedBackgroundProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate random positions for lights - truly scattered
  const lightPositions = useMemo(() => {
    const random = seededRandom(42);
    return Array.from({ length: 50 }).map((_, i) => ({
      left: random() * 90 + 5, // 5% to 95%
      top: random() * 80 + 10, // 10% to 90%
      delay: random() * 6,
      size: random() * 6 + 4, // 4-10px (bigger)
      animationType: Math.floor(random() * 5) + 1,
    }));
  }, []);

  // Generate random positions for fireworks
  const fireworkPositions = useMemo(() => {
    const random = seededRandom(123);
    return Array.from({ length: 18 }).map((_, i) => ({
      left: random() * 80 + 10, // 10% to 90%
      top: random() * 60 + 10, // 10% to 70%
      delay: random() * 8 + i * 0.8, // More frequent
      scale: random() * 0.8 + 1.0, // 1.0-1.8 scale (bigger)
      burstType: Math.floor(random() * 3) + 1,
    }));
  }, []);

  if (!mounted) return null;

  return (
    <div className="cny-animated-bg" style={{ opacity: intensity }}>
      {/* Bokeh Layer - Floating blurred circles */}
      {showBokeh && (
        <div className="cny-bokeh-container">
          {/* Large bokeh circles */}
          <div
            className={`cny-bokeh cny-bokeh-1 ${theme === "red" ? "cny-bokeh-gold" : "cny-bokeh-red"}`}
          />
          <div
            className={`cny-bokeh cny-bokeh-2 ${theme === "red" ? "cny-bokeh-gold" : "cny-bokeh-red"}`}
          />
          <div
            className={`cny-bokeh cny-bokeh-3 ${theme === "red" ? "cny-bokeh-gold" : "cny-bokeh-red"}`}
          />
          {/* Medium bokeh circles */}
          <div
            className={`cny-bokeh cny-bokeh-4 ${theme === "red" ? "cny-bokeh-gold-soft" : "cny-bokeh-red-soft"}`}
          />
          <div
            className={`cny-bokeh cny-bokeh-5 ${theme === "red" ? "cny-bokeh-gold-soft" : "cny-bokeh-red-soft"}`}
          />
          <div
            className={`cny-bokeh cny-bokeh-6 ${theme === "red" ? "cny-bokeh-gold" : "cny-bokeh-red"}`}
          />
          {/* Small bokeh circles */}
          <div
            className={`cny-bokeh cny-bokeh-7 ${theme === "red" ? "cny-bokeh-gold-soft" : "cny-bokeh-red-soft"}`}
          />
          <div
            className={`cny-bokeh cny-bokeh-8 ${theme === "red" ? "cny-bokeh-gold" : "cny-bokeh-red"}`}
          />
        </div>
      )}

      {/* Smoke Layer - Swirling wisps */}
      {showSmoke && (
        <div className="cny-smoke-container">
          <div className={`cny-smoke cny-smoke-1 ${theme === "red" ? "cny-smoke-light" : "cny-smoke-dark"}`} />
          <div className={`cny-smoke cny-smoke-2 ${theme === "red" ? "cny-smoke-light" : "cny-smoke-dark"}`} />
          <div className={`cny-smoke cny-smoke-3 ${theme === "red" ? "cny-smoke-light" : "cny-smoke-dark"}`} />
        </div>
      )}

      {/* Floating Lights Layer - Randomly scattered sparkles */}
      {showLights && (
        <div className="cny-lights-container">
          {lightPositions.map((light, i) => (
            <div
              key={i}
              className={`cny-light cny-light-${light.animationType} ${theme === "red" ? "cny-light-gold" : "cny-light-red"}`}
              style={{
                left: `${light.left}%`,
                top: `${light.top}%`,
                animationDelay: `${light.delay}s`,
                width: `${light.size}px`,
                height: `${light.size}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Fireworks Layer - Bursting particles */}
      {showFireworks && (
        <div className="cny-fireworks-container">
          {fireworkPositions.map((fw, i) => (
            <div
              key={i}
              className={`cny-firework cny-firework-burst-${fw.burstType}`}
              style={{
                left: `${fw.left}%`,
                top: `${fw.top}%`,
                animationDelay: `${fw.delay}s`,
                transform: `scale(${fw.scale})`,
              }}
            >
              {/* Firework particles - radiating outward */}
              {Array.from({ length: 12 }).map((_, j) => (
                <div
                  key={j}
                  className={`cny-firework-particle ${theme === "red" ? "cny-firework-gold" : "cny-firework-red"}`}
                  style={{
                    transform: `rotate(${j * 30}deg)`,
                  }}
                />
              ))}
              {/* Inner glow */}
              <div className={`cny-firework-glow ${theme === "red" ? "cny-firework-glow-gold" : "cny-firework-glow-red"}`} />
            </div>
          ))}
        </div>
      )}

      {/* Sparkle trails - for extra festive feel */}
      {showFireworks && (
        <div className="cny-sparkle-container">
          {Array.from({ length: 35 }).map((_, i) => {
            const random = seededRandom(i * 7);
            return (
              <div
                key={i}
                className={`cny-sparkle ${theme === "red" ? "cny-sparkle-gold" : "cny-sparkle-red"}`}
                style={{
                  left: `${random() * 100}%`,
                  animationDelay: `${random() * 5}s`,
                  animationDuration: `${2.5 + random() * 1.5}s`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
