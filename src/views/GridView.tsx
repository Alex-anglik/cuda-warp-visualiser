import type { GridFramePayload, GridParams, LaunchConfig } from '../types';

/** Stable, visually distinct colour per warp. */
function warpColor(warpId: number): string {
  return `hsl(${(warpId * 67) % 360} 60% 55%)`;
}

interface Props {
  payload: GridFramePayload;
  cfg: LaunchConfig;
  params: GridParams;
  onParamsChange: (p: GridParams) => void;
}

export function GridView({ payload, cfg, params, onParamsChange }: Props) {
  const { blockDim, threads, laneStrip, highlightWarp, partition } = payload;
  const totalBlocks = cfg.gridDim.x * cfg.gridDim.y;
  const wastePct = partition.threadsPerBlock
    ? (partition.wastedLanes / (partition.warpsPerBlock * 32)) * 100
    : 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4">
      <Stats
        partition={partition}
        totalBlocks={totalBlocks}
        totalWarps={totalBlocks * partition.warpsPerBlock}
        wastePct={wastePct}
      />

      {totalBlocks > 1 && (
        <BlockSelector cfg={cfg} params={params} onParamsChange={onParamsChange} />
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
          Block threads — coloured by warp ({blockDim.x}×{blockDim.y}, linearised x-fastest)
        </h3>
        <div
          className="grid w-fit gap-1"
          style={{ gridTemplateColumns: `repeat(${blockDim.x}, minmax(0, 1.4rem))` }}
        >
          {threads.map((t) => {
            const revealed = t.warpId <= highlightWarp;
            const current = t.warpId === highlightWarp;
            return (
              <div
                key={t.tid}
                title={`tid ${t.tid} · warp ${t.warpId} · lane ${t.lane}  (x=${t.tx}, y=${t.ty})`}
                className={`aspect-square rounded-sm transition-colors duration-300 ${
                  current ? 'ring-2 ring-white' : ''
                } ${revealed ? '' : 'border border-slate-700/70'}`}
                style={{
                  backgroundColor: revealed ? warpColor(t.warpId) : 'transparent',
                  opacity: revealed && !current ? 0.85 : 1,
                }}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
          Warp lane occupancy — each row is 32 lanes
        </h3>
        <div className="flex flex-col gap-1 overflow-x-auto">
          {Array.from({ length: partition.warpsPerBlock }, (_, w) => (
            <div key={w} className="flex items-center gap-2">
              <span
                className={`w-14 shrink-0 font-mono text-xs ${
                  w === highlightWarp ? 'text-white' : 'text-slate-500'
                }`}
              >
                warp {w}
              </span>
              <div className="flex gap-0.5">
                {laneStrip
                  .filter((s) => s.warpId === w)
                  .map((s) => {
                    const revealed = s.warpId <= highlightWarp;
                    const current = s.warpId === highlightWarp;
                    if (s.wasted) {
                      return (
                        <div
                          key={s.lane}
                          title={`warp ${s.warpId} · lane ${s.lane} — wasted (no thread)`}
                          className="flex h-4 w-4 items-center justify-center rounded-sm border border-dashed border-slate-600 bg-slate-800/40 text-[8px] text-slate-600"
                        >
                          ×
                        </div>
                      );
                    }
                    return (
                      <div
                        key={s.lane}
                        title={`tid ${s.tid} · warp ${s.warpId} · lane ${s.lane}`}
                        className={`h-4 w-4 rounded-sm transition-colors duration-300 ${
                          current ? 'ring-1 ring-white' : ''
                        } ${revealed ? '' : 'border border-slate-700/70'}`}
                        style={{
                          backgroundColor: revealed ? warpColor(s.warpId) : 'transparent',
                          opacity: revealed && !current ? 0.85 : 1,
                        }}
                      />
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
        {partition.wastedLanes > 0 && (
          <p className="mt-2 text-xs text-amber-400/90">
            blockDim ({partition.threadsPerBlock} threads) isn't a multiple of 32 — the tail
            warp still occupies a full warp slot, wasting {partition.wastedLanes} lanes of
            throughput.
          </p>
        )}
      </section>
    </div>
  );
}

function Stats({
  partition,
  totalBlocks,
  totalWarps,
  wastePct,
}: {
  partition: GridFramePayload['partition'];
  totalBlocks: number;
  totalWarps: number;
  wastePct: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <Stat label="threads/block" value={partition.threadsPerBlock} />
      <Stat label="warps/block" value={partition.warpsPerBlock} />
      <Stat label="total blocks" value={totalBlocks} />
      <Stat label="total warps" value={totalWarps} />
      <Stat
        label="wasted lanes"
        value={`${partition.wastedLanes} (${wastePct.toFixed(0)}%)`}
        warn={partition.wastedLanes > 0}
      />
    </div>
  );
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
    <div className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`font-mono text-lg ${warn ? 'text-amber-400' : 'text-slate-100'}`}>
        {value}
      </div>
    </div>
  );
}

function BlockSelector({
  cfg,
  params,
  onParamsChange,
}: {
  cfg: LaunchConfig;
  params: GridParams;
  onParamsChange: (p: GridParams) => void;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
        Grid of blocks — select one to inspect ({cfg.gridDim.x}×{cfg.gridDim.y})
      </h3>
      <div
        className="grid w-fit gap-1"
        style={{ gridTemplateColumns: `repeat(${cfg.gridDim.x}, minmax(0, 1.6rem))` }}
      >
        {Array.from({ length: cfg.gridDim.y }, (_, by) =>
          Array.from({ length: cfg.gridDim.x }, (_, bx) => {
            const selected =
              params.selectedBlock.x === bx && params.selectedBlock.y === by;
            return (
              <button
                key={`${bx},${by}`}
                title={`block (${bx}, ${by})`}
                onClick={() => onParamsChange({ selectedBlock: { x: bx, y: by } })}
                className={`aspect-square rounded-sm text-[9px] transition ${
                  selected
                    ? 'bg-emerald-500/80 text-slate-900'
                    : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {by * cfg.gridDim.x + bx}
              </button>
            );
          }),
        )}
      </div>
    </section>
  );
}
