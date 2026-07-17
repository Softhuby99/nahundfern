type Props = {
  hasNewer: boolean;
  hasOlder: boolean;
  onNewer: () => void;
  onOlder: () => void;
  rangeLabel: string;
};

export function TimelinePagination({ hasNewer, hasOlder, onNewer, onOlder, rangeLabel }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onNewer}
        disabled={!hasNewer}
        className="px-4 py-2 rounded-full border border-border bg-card text-sm hover:border-primary hover:text-primary disabled:opacity-30 transition-colors"
        aria-label="Neuere Reisen anzeigen"
      >
        ← Neuere
      </button>
      <span className="text-xs text-muted-foreground min-w-[80px] text-center">{rangeLabel}</span>
      <button
        type="button"
        onClick={onOlder}
        disabled={!hasOlder}
        className="px-4 py-2 rounded-full border border-border bg-card text-sm hover:border-primary hover:text-primary disabled:opacity-30 transition-colors"
        aria-label="Ältere Reisen anzeigen"
      >
        Ältere →
      </button>
    </div>
  );
}
