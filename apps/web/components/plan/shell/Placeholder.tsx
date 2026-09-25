/** Phase 3 stand-in for module content. Replaced section by section in Phase 4. */
export function Placeholder({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-oh-stone bg-oh-ink/40 px-6 py-10 text-center text-[0.9rem] text-oh-mute">
      {text}
    </div>
  );
}
