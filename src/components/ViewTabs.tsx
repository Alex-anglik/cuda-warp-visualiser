import type { ViewKind } from '../types';

const TABS: { kind: ViewKind; label: string }[] = [
  { kind: 'grid', label: 'Grid / Block / Warp' },
  { kind: 'divergence', label: 'Warp Divergence' },
  { kind: 'memory', label: 'Memory Access' },
];

interface Props {
  active: ViewKind;
  onChange: (v: ViewKind) => void;
}

export function ViewTabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/60 p-1">
      {TABS.map((t) => (
        <button
          key={t.kind}
          onClick={() => onChange(t.kind)}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
            active === t.kind
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
