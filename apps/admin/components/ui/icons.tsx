/** In-house icon set: 24px grid, 1.5px stroke, round caps. No icon libraries. */

/** A small solid-looking dot (a 1.2px circle, thickened by the stroke). */
const dot = (x: number, y: number) => `M${x - 0.6} ${y}a.6.6 0 1 0 1.2 0a.6.6 0 1 0-1.2 0z`;
const FRAME = "M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M8 3v4M16 3v4";

const PATHS = {
  today: `${FRAME}M8.5 13.5h4v3.5h-4z`,
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  bowl: "M3 11h18a9 9 0 0 1-18 0zM8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5",
  more: "M6 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM20 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0z",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4",
  close: "M6 6l12 12M18 6L6 18",
  "chevron-right": "M9 5l7 7-7 7",
  "chevron-left": "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  alert: `M12 8.5v4.5${dot(12, 16.5)}M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z`,
  tag: `M3.5 4.5v6.6a1 1 0 0 0 .3.7l8.4 8.4a1 1 0 0 0 1.4 0l6.6-6.6a1 1 0 0 0 0-1.4L11.8 3.8a1 1 0 0 0-.7-.3H4.5a1 1 0 0 0-1 1z${dot(8, 8)}`,
  gift: "M4.5 11h15v9h-15zM3.5 7.5h17V11h-17zM12 7.5V20M12 7.5C10.5 4.5 7 4 7 6s3 1.5 5 1.5zM12 7.5c1.5-3 5-3.5 5-1.5s-3 1.5-5 1.5z",
  bag: "M5 8h14l-1 12.5H6zM9 10.5V7a3 3 0 0 1 6 0v3.5",
  calendar: `${FRAME}${dot(8, 14)}${dot(12, 14)}${dot(16, 14)}${dot(8, 17)}${dot(12, 17)}`,
  flame: "M12 21c-3.9 0-7-2.7-7-6.5 0-3.3 2.3-5.4 3.7-7.6.4 1.9 1.5 3.1 2.8 3.6C11.5 7 12.5 4.5 14.5 3c.5 3 4.5 5.5 4.5 11.5 0 3.8-3.1 6.5-7 6.5zM12 21c-1.7 0-3-1.2-3-2.9 0-1.8 1.4-2.8 2.2-4.1.9 1.3 3.8 2.3 3.8 4.1 0 1.7-1.3 2.9-3 2.9z",
  sparkle: "M10 6c.6 3.8 3.2 6.4 7 7-3.8.6-6.4 3.2-7 7-.6-3.8-3.2-6.4-7-7 3.8-.6 6.4-3.2 7-7zM18 3c.3 1.6 1.4 2.7 3 3-1.6.3-2.7 1.4-3 3-.3-1.6-1.4-2.7-3-3 1.6-.3 2.7-1.4 3-3z",
  seat: "M8 3.5h8a1 1 0 0 1 1 1V12H7V4.5a1 1 0 0 1 1-1zM5 12h14v3H5zM7 15v5.5M17 15v5.5",
  chart: "M4 20h16M7 17v-5M12 17V6M17 17V9",
  key: "M8 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 12h8.5M17 12v3M20 12v2.5",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z",
  tablet: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 17.5h2",
  settings: "M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20M15 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM9 19.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z",
  users: "M9 11a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.8 3.1 2.6 3.5 5.2",
  copy: "M9 8h10a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM16 8V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  edit: "M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5zM13.5 7l3 3",
  filter: "M4 5h16l-6 7.5V19l-4 2v-8.5z",
  logout: "M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9",
  undo: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  switch: "M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7",
  phone: "M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
  mail: "M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4.5 6.5l7.5 6 7.5-6",
  clock: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 7v5l3 2",
  money: "M12 2v20M16.5 7c0-1.8-2-3-4.5-3S7.5 5.2 7.5 7c0 3 9 1.5 9 5.5 0 1.8-2 3.2-4.5 3.2S7.5 14.5 7.5 12.5",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.2 2.4 3.5 5.6 3.5 9s-1.3 6.6-3.5 9c-2.2-2.4-3.5-5.6-3.5-9s1.3-6.6 3.5-9z",
  trophy: "M8 4h8v3a4 4 0 0 1-8 0zM8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5M12 11v4M9 20h6M10 16h4v4h-4z",
  badge: "M12 2.5l2.6 5.3 5.8.6-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.6z",
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function Icon({ name, size = 22, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}
