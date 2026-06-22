import type { BranchPreset, DivPhase, DivergenceFramePayload, DivergenceParams } from '../types';
import { predicateLabel } from '../model/divergence';

interface Props {
  payload: DivergenceFramePayload;
  params: DivergenceParams;
  onParamsChange: (p: DivergenceParams) => void;
}

/** Colour for an *active* lane, by which path it's executing. */
function activeColor(phase: DivPhase): string {
  switch (phase) {
    case 'then':
      return 'bg-emerald-500 text-emerald-950';
    case 'else':
      return 'bg-amber-500 text-amber-950';
    default:
      return 'bg-sky-500 text-sky-950'; // evaluate / reconverge
  }
}

function phaseTitle(phase: DivPhase, phases: DivPhase[]): string {
  switch (phase) {
    case 'evaluate':
      return 'Evaluate';
    case 'then':
      return `Pass ${phases.indexOf('then')}: then`;
    case 'else':
      return `Pass ${phases.indexOf('else')}: else`;
    case 'reconverge':
      return 'Reconverge';
  }
}

export function DivergenceView({ payload, params, onParamsChange }: Props) {
  const { phase, phases, laneActive, passesRequired, activeCount, efficiency, divergent } =
    payload;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4">
      <Controls params={params} onParamsChange={onParamsChange} />

      {/* Condition as source */}
      <pre className="overflow-x-auto rounded-md border border-slate-700 bg-slate-950/70 p-3 font-mono text-sm text-slate-200">
        <span className="text-sky-400">if</span> ({predicateLabel(params.predicate)}) {'{'}
        {'\n'}    <span className="text-emerald-400">// then-branch</span>
        {'\n'}
        {'}'}
        {params.hasElse && (
          <>
            {' '}
            <span className="text-sky-400">else</span> {'{'}
            {'\n'}    <span className="text-amber-400">// else-branch</span>
            {'\n'}
            {'}'}
          </>
        )}
      </pre>

      {/* Cost indicators */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="passes required" value={passesRequired} warn={passesRequired >= 2} />
        <Stat label="warp efficiency" value={`${Math.round(efficiency * 100)}%`} />
        <div className="flex items-center justify-center rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              divergent
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {divergent ? 'Divergent' : 'Uniform — no divergence'}
          </span>
        </div>
      </div>

      {/* Serial timeline */}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
          Execution timeline — passes run left to right, one after another
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {phases.map((ph, i) => (
            <div key={ph} className="flex items-center gap-2">
              <div
                className={`rounded-md border px-3 py-2 text-sm transition ${
                  ph === phase
                    ? 'border-white bg-slate-700 text-white'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400'
                }`}
              >
                {phaseTitle(ph, phases)}
              </div>
              {i < phases.length - 1 && <span className="text-slate-600">→</span>}
            </div>
          ))}
        </div>
      </section>

      {/* Lane grid */}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
          Warp lanes (threadIdx.x 0–31) — {activeCount}/32 active this pass
        </h3>
        <div
          className="grid w-fit gap-1"
          style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1.75rem))' }}
        >
          {laneActive.map((active, lane) => (
            <div
              key={lane}
              title={`lane ${lane}${active ? ' — active' : ' — idle (masked off)'}`}
              className={`flex h-7 w-7 items-center justify-center rounded-sm font-mono text-[10px] transition-colors duration-300 ${
                active ? activeColor(phase) : 'bg-slate-800 text-slate-600'
              }`}
            >
              {lane}
            </div>
          ))}
        </div>
      </section>

      <Caption phase={phase} passesRequired={passesRequired} divergent={divergent} />
    </div>
  );
}

function Caption({
  phase,
  passesRequired,
  divergent,
}: {
  phase: DivPhase;
  passesRequired: number;
  divergent: boolean;
}) {
  let text: string;
  if (!divergent && passesRequired <= 1) {
    text =
      'All lanes agree, so the branch is uniform — the warp issues one path with no divergence penalty.';
  } else if (divergent && passesRequired >= 2) {
    text =
      'Lanes disagree and both bodies exist: the warp serialises the two paths, executing them one after the other. The greyed lanes in each pass are masked off, not running in parallel.';
  } else {
    text =
      'Lanes disagree but there is no else body, so there is one pass — the non-taking lanes simply idle (masked off) while the then-branch runs.';
  }
  return (
    <p className="text-xs text-slate-400">
      {text}{' '}
      <span className="text-slate-500">
        (Conceptual model. On Volta+ independent thread scheduling and short-branch predication
        change the details, but divergent paths still don't execute concurrently.)
      </span>
      {phase === 'reconverge' && passesRequired === 0 && (
        <span className="text-slate-500"> Here no lane takes the branch, so it costs nothing.</span>
      )}
    </p>
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
    <div className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`font-mono text-xl ${warn ? 'text-amber-400' : 'text-slate-100'}`}>
        {value}
      </div>
    </div>
  );
}

const PRESETS: { label: string; preset: BranchPreset }[] = [
  { label: 'threadIdx.x % 2 == 0', preset: { kind: 'mod', divisor: 2, eq: 0 } },
  { label: 'threadIdx.x % 4 == 0', preset: { kind: 'mod', divisor: 4, eq: 0 } },
  { label: 'threadIdx.x < 16', preset: { kind: 'lt', bound: 16 } },
  { label: 'threadIdx.x < 1  (1 lane)', preset: { kind: 'lt', bound: 1 } },
  { label: '(threadIdx.x / 8) % 2 == 0', preset: { kind: 'block', size: 8 } },
  { label: 'threadIdx.x < 32  (uniform)', preset: { kind: 'lt', bound: 32 } },
];

function presetKey(p: BranchPreset): string {
  switch (p.kind) {
    case 'mod':
      return `mod:${p.divisor}:${p.eq}`;
    case 'lt':
      return `lt:${p.bound}`;
    case 'block':
      return `block:${p.size}`;
  }
}

function Controls({
  params,
  onParamsChange,
}: {
  params: DivergenceParams;
  onParamsChange: (p: DivergenceParams) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <span className="text-slate-400">Condition</span>
        <select
          value={presetKey(params.predicate)}
          onChange={(e) => {
            const found = PRESETS.find((p) => presetKey(p.preset) === e.target.value);
            if (found) onParamsChange({ ...params, predicate: found.preset });
          }}
          className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 font-mono text-sm text-slate-100"
        >
          {PRESETS.map((p) => (
            <option key={presetKey(p.preset)} value={presetKey(p.preset)}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={params.hasElse}
          onChange={(e) => onParamsChange({ ...params, hasElse: e.target.checked })}
          className="h-4 w-4 accent-emerald-500"
        />
        include <code className="text-slate-400">else</code> branch
      </label>
    </div>
  );
}
