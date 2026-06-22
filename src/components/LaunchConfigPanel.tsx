import type { Dim2, LaunchConfig } from '../types';

interface Props {
  config: LaunchConfig;
  onChange: (c: LaunchConfig) => void;
}

export function LaunchConfigPanel({ config, onChange }: Props) {
  const set = (patch: Partial<LaunchConfig>) => onChange({ ...config, ...patch });
  const setDim = (key: 'gridDim' | 'blockDim', axis: keyof Dim2, v: number) =>
    set({ [key]: { ...config[key], [axis]: clamp(v) } } as Partial<LaunchConfig>);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <h2 className="text-sm font-semibold tracking-wide text-slate-300">Launch config</h2>

      <DimRow
        label="gridDim"
        dim={config.gridDim}
        onChange={(axis, v) => setDim('gridDim', axis, v)}
      />
      <DimRow
        label="blockDim"
        dim={config.blockDim}
        onChange={(axis, v) => setDim('blockDim', axis, v)}
      />

      <div className="grid grid-cols-2 gap-2">
        <NumField
          label="elementBytes"
          value={config.elementBytes}
          onChange={(v) => set({ elementBytes: clamp(v, 1) })}
        />
        <NumField
          label="segmentBytes"
          value={config.segmentBytes}
          onChange={(v) => set({ segmentBytes: clamp(v, 1) })}
        />
      </div>
    </div>
  );
}

function DimRow({
  label,
  dim,
  onChange,
}: {
  label: string;
  dim: Dim2;
  onChange: (axis: keyof Dim2, v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 font-mono text-xs text-slate-400">{label}</span>
      <NumField label="x" value={dim.x} onChange={(v) => onChange('x', v)} compact />
      <span className="text-slate-600">×</span>
      <NumField label="y" value={dim.y} onChange={(v) => onChange('y', v)} compact />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  compact,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <label className="flex items-center gap-1">
      <span className="font-mono text-xs text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        min={1}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${compact ? 'w-14' : 'w-full'} rounded-md border border-slate-600 bg-slate-800 px-2 py-1 font-mono text-sm text-slate-100`}
      />
    </label>
  );
}

function clamp(v: number, min = 1, max = 1024): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(Math.floor(v), max));
}
