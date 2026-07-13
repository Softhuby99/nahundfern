type Props = {
  fromDate: string;
  toDate: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onReset: () => void;
};

export function TimelineFilters({ fromDate, toDate, onFromChange, onToChange, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Von</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromChange(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Bis</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToChange(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
        />
      </label>
      {(fromDate || toDate) && (
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-primary hover:underline underline-offset-4 pb-1.5"
        >
          Zurücksetzen
        </button>
      )}
    </div>
  );
}
