import type { AccessPattern, LaunchConfig, MemoryFramePayload, MemoryParams } from '../types';

interface Props {
  payload: MemoryFramePayload;
  cfg: LaunchConfig;
  params: MemoryParams;
  onParamsChange: (p: MemoryParams) => void;
}

export function MemoryView({ payload, cfg, params, onParamsChange }: Props) {
  const { phase, accesses, segmentsTouched, transactions, bytesRequested, bytesMoved, efficiency, segmentBytes } =
    payload;
  const revealed = phase === 'coalesce';
  const elementsPerSegment = Math.max(1, Math.floor(cfg.segmentBytes / cfg.elementBytes));

  // Stable colour per touched segment, by its order along memory.
  const order = new Map<number, number>();
  segmentsTouched.forEach((s, i) => order.set(s, i));
  const segColor = (seg: number) => `hsl(${((order.get(seg) ?? 0) * 67) % 360} 60% 55%)`;

  const lanesBySegment = segmentsTouched.map((seg) => ({
    seg,
    lanes: accesses.filter((a) => a.segment === seg).map((a) => a.lane),
  }));

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4">
      <Controls cfg={cfg} params={params} onParamsChange={onParamsChange} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="transactions"
          value={revealed ? transactions : '?'}
          warn={revealed && efficiency < 1}
        />
        <Stat
          label="bandwidth efficiency"
          value={revealed ? `${Math.round(efficiency * 100)}%` : '?'}
          warn={revealed && efficiency < 1}
        />
        <Stat label="bytes requested" value={`${bytesRequested} B`} />
        <Stat label="bytes moved" value={revealed ? `${bytesMoved} B` : '?'} />
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Model: {cfg.elementBytes} B elements · {segmentBytes} B segments (
        {elementsPerSegment} elements/segment). A warp request is split into the minimal set
        of segments covering the 32 addresses; that count is the transaction number.
      </p>

      {/* Lane → address row */}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
          32 threads issue 32 addresses {revealed && '— coloured by the segment they land in'}
        </h3>
        <div
          className="grid w-fit gap-1"
          style={{ gridTemplateColumns: 'repeat(8, minmax(0, 4.5rem))' }}
        >
          {accesses.map((a) => (
            <div
              key={a.lane}
              title={`lane ${a.lane} → addr ${a.addr} B → segment ${a.segment}`}
              className="flex flex-col items-center rounded-sm px-1 py-0.5 text-center font-mono transition-colors duration-300"
              style={{
                backgroundColor: revealed ? segColor(a.segment) : 'rgb(30 41 59)',
                color: revealed ? 'rgb(2 6 23)' : 'rgb(148 163 184)',
              }}
            >
              <span className="text-[9px] opacity-70">L{a.lane}</span>
              <span className="text-[11px]">{a.addr}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Segment boxes */}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
          Memory segments touched {revealed && `— ${transactions} transaction(s)`}
        </h3>
        <div className="flex flex-wrap gap-2">
          {lanesBySegment.map(({ seg, lanes }) => (
            <div
              key={seg}
              className={`rounded-md border p-2 transition ${
                revealed ? 'border-transparent' : 'border-slate-700 opacity-50'
              }`}
              style={{ backgroundColor: revealed ? `${segColor(seg)}33` : 'rgb(30 41 59 / 0.4)' }}
            >
              <div className="mb-1 font-mono text-[10px] text-slate-300">
                seg {seg} · {seg * segmentBytes}–{seg * segmentBytes + segmentBytes - 1} B
              </div>
              <div className="flex max-w-[10rem] flex-wrap gap-0.5">
                {lanes.map((l) => (
                  <span
                    key={l}
                    className="rounded-sm px-1 text-[9px] font-medium"
                    style={{
                      backgroundColor: revealed ? segColor(seg) : 'rgb(51 65 85)',
                      color: revealed ? 'rgb(2 6 23)' : 'rgb(148 163 184)',
                    }}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Caption pattern={params.pattern} revealed={revealed} efficiency={efficiency} />
      </section>
    </div>
  );
}

function Caption({
  pattern,
  revealed,
  efficiency,
}: {
  pattern: AccessPattern;
  revealed: boolean;
  efficiency: number;
}) {
  if (!revealed) {
    return (
      <p className="mt-2 text-xs text-slate-400">
        Each thread's address falls inside one segment. Step forward to coalesce them and count
        the transactions.
      </p>
    );
  }
  const pct = Math.round(efficiency * 100);
  const msg =
    pattern === 'coalesced'
      ? `Contiguous addresses pack into the fewest segments — ${pct}% of every fetched byte is used.`
      : pattern === 'strided'
        ? `Striding spreads the warp across more segments; each fetched segment is only partly used (${pct}%), so the hardware moves bytes it discards.`
        : `Scattered addresses hit many segments, each barely used (${pct}%) — the worst case for bandwidth.`;
  return <p className="mt-2 text-xs text-slate-400">{msg}</p>;
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`font-mono text-lg ${warn ? 'text-amber-400' : 'text-slate-100'}`}>
        {value}
      </div>
    </div>
  );
}

function Controls({
  cfg,
  params,
  onParamsChange,
}: {
  cfg: LaunchConfig;
  params: MemoryParams;
  onParamsChange: (p: MemoryParams) => void;
}) {
  void cfg;
  const set = (patch: Partial<MemoryParams>) => onParamsChange({ ...params, ...patch });
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        <span className="text-xs text-slate-400">Access pattern</span>
        <select
          value={params.pattern}
          onChange={(e) => set({ pattern: e.target.value as AccessPattern })}
          className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
        >
          <option value="coalesced">coalesced — base + i</option>
          <option value="strided">strided — base + i·stride</option>
          <option value="random">random</option>
        </select>
      </label>

      {params.pattern === 'strided' && (
        <NumField
          label="stride (elems)"
          value={params.stride}
          min={1}
          onChange={(v) => set({ stride: v })}
        />
      )}

      <NumField
        label="offset (B)"
        value={params.base}
        min={0}
        step={cfg.elementBytes}
        onChange={(v) => set({ base: v })}
      />

      {params.pattern === 'random' && (
        <button
          onClick={() => set({ seed: params.seed + 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
        >
          ↻ reshuffle (seed {params.seed})
        </button>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="w-28 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 font-mono text-sm text-slate-100"
      />
    </label>
  );
}
