"use client";

/**
 * Task C3 (motion kit): scrubs a canvas through an image sequence as it
 * crosses the viewport (0 = its top just entered at the bottom of the
 * viewport, 1 = its bottom just left at the top), the "scroll-scrubbed
 * hero" pattern.
 *
 * There's no CSS-only way to paint an arbitrary frame onto a canvas, so
 * this one always needs JS -- native-first here means "as cheap as
 * possible": an IntersectionObserver gates a scroll listener on/off (no
 * work at all while off-screen) and the listener itself is rAF-throttled.
 *
 * The first 8 frames preload eagerly (so the sequence is ready by the time
 * it can plausibly enter view); the rest load during idle time.
 *
 * Reduced motion renders the poster image and does no scrubbing.
 */
import { useEffect, useRef } from "react";
import "./motion.css";
import { useReducedMotion } from "./useReducedMotion";

export interface FrameSequenceProps {
  frames: string[];
  alt: string;
  poster: string;
  className?: string;
}

const EAGER_PRELOAD_COUNT = 8;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function idleLoad(task: () => void) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(task);
  } else {
    setTimeout(task, 32);
  }
}

export function FrameSequence({ frames, alt, poster, className }: FrameSequenceProps) {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Array<HTMLImageElement | null>>([]);
  const currentIndexRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  function draw(index: number) {
    const canvas = canvasRef.current;
    const img = imagesRef.current[index];
    const ctx = canvas?.getContext("2d");
    if (!canvas || !img || !ctx) return;
    if (canvas.width !== img.naturalWidth) canvas.width = img.naturalWidth;
    if (canvas.height !== img.naturalHeight) canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  }

  // Preload: first N eagerly, the rest during idle time.
  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    imagesRef.current = new Array(frames.length).fill(null);

    async function preload() {
      const eager = frames.slice(0, EAGER_PRELOAD_COUNT);
      const loaded = await Promise.all(eager.map(loadImage));
      if (cancelled) return;
      loaded.forEach((img, i) => {
        imagesRef.current[i] = img;
      });
      draw(currentIndexRef.current);

      let i = EAGER_PRELOAD_COUNT;
      const step = () => {
        if (cancelled || i >= frames.length) return;
        const index = i;
        i += 1;
        loadImage(frames[index]).then((img) => {
          if (cancelled) return;
          imagesRef.current[index] = img;
          idleLoad(step);
        });
      };
      idleLoad(step);
    }

    preload();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames.join("|"), reducedMotion]);

  // Scrub: only listens while the canvas is actually on/near screen.
  useEffect(() => {
    if (reducedMotion) return;
    const node = canvasRef.current;
    if (!node) return;

    let active = false;

    function measure() {
      rafRef.current = null;
      if (!active || !node) return;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;
      const total = viewport + rect.height;
      const traveled = viewport - rect.top;
      const progress = Math.min(1, Math.max(0, total > 0 ? traveled / total : 0));
      const index = Math.min(frames.length - 1, Math.max(0, Math.round(progress * (frames.length - 1))));
      if (index !== currentIndexRef.current) {
        currentIndexRef.current = index;
      }
      draw(index);
    }

    function onScroll() {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(measure);
    }

    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            for (const entry of entries) {
              active = entry.isIntersecting;
              if (active) onScroll();
            }
          })
        : null;

    if (observer) {
      observer.observe(node);
    } else {
      active = true;
      onScroll();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [frames.length, reducedMotion]);

  if (reducedMotion) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt={alt} className={className} />;
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={alt}
      className={["oh-frame-sequence", className].filter(Boolean).join(" ")}
    />
  );
}
