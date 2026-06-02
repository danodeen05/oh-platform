"use client";

import { useEffect, useRef } from "react";

/**
 * CSS-var-driven animated background for catering pages.
 * Renders soft bokeh orbs that drift gently — premium, not festive.
 * No CNY gold/red. All colors are derived from --brand-primary / --brand-bg.
 */
export default function ThemedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Read CSS vars for colors
    const style = getComputedStyle(document.documentElement);
    const rawPrimary = style.getPropertyValue("--brand-primary").trim() || "#C7A878";
    const rawBg = style.getPropertyValue("--brand-bg").trim() || "#0D0D0B";

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    type Orb = {
      x: number;
      y: number;
      r: number;
      dx: number;
      dy: number;
      alpha: number;
      dAlpha: number;
    };

    // Create soft orbs
    const orbs: Orb[] = Array.from({ length: 9 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 80 + Math.random() * 160,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.2,
      alpha: 0.03 + Math.random() * 0.06,
      dAlpha: (Math.random() - 0.5) * 0.0003,
    }));

    let animId: number;

    // Parse hex to r,g,b — fallback safe
    const hexToRgb = (hex: string): [number, number, number] => {
      const clean = hex.replace("#", "");
      if (clean.length !== 6) return [199, 168, 120];
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    };

    const [pr, pg, pb] = hexToRgb(rawPrimary);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const orb of orbs) {
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        grad.addColorStop(0, `rgba(${pr},${pg},${pb},${orb.alpha})`);
        grad.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();

        orb.x += orb.dx;
        orb.y += orb.dy;
        orb.alpha += orb.dAlpha;

        if (orb.alpha < 0.02 || orb.alpha > 0.1) orb.dAlpha *= -1;
        if (orb.x < -orb.r) orb.x = canvas.width + orb.r;
        if (orb.x > canvas.width + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r) orb.y = canvas.height + orb.r;
        if (orb.y > canvas.height + orb.r) orb.y = -orb.r;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        background: "var(--brand-bg, #0D0D0B)",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
