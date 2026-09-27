import { Button } from "./Button";
import { Icon } from "./icons";

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section role="alert" className="flex items-start gap-3 rounded-card border border-oh-ember/25 bg-oh-cream p-4 shadow-card">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oh-ember/10 text-oh-ember-deep" aria-hidden="true">
        <Icon name="alert" size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="pt-1.5 text-[15px] font-semibold text-oh-charcoal">{message}</p>
        {onRetry && (
          <Button size="sm" icon="undo" className="-ml-1 mt-2" variant="ghost" onClick={onRetry}>Try again</Button>
        )}
      </div>
    </section>
  );
}
