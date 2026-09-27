/** Apply a UI change now, commit it to the server, and roll back if that fails. */
export async function runOptimistic({ apply, revert, commit }: { apply: () => void; revert: () => void; commit: () => Promise<unknown> }): Promise<boolean> {
  apply();
  try { await commit(); return true; } catch { revert(); return false; }
}
