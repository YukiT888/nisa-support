export function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col rounded-xl bg-white/5 px-3 py-2 text-xs">
      <span className="text-[10px] uppercase tracking-widest text-white/60">{label}</span>
      <span className="font-semibold text-kachi-textdark">{value}</span>
    </div>
  );
}
