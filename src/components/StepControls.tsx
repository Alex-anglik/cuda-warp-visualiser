import type { StepController } from '../useStepController';

interface Props {
  step: StepController;
  label: string;
}

/** View-agnostic: only knows index / count / label and the methods. */
export function StepControls({ step, label }: Props) {
  const atStart = step.index <= 0;
  const atEnd = step.index >= step.count - 1;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <div className="flex items-center gap-2">
        <Btn onClick={step.first} disabled={atStart} title="First">
          ⏮
        </Btn>
        <Btn onClick={step.prev} disabled={atStart} title="Step back">
          ◀
        </Btn>
        <Btn onClick={step.togglePlay} disabled={step.count <= 1} title="Play / pause" wide>
          {step.playing ? '❚❚ Pause' : '▶ Play'}
        </Btn>
        <Btn onClick={step.next} disabled={atEnd} title="Step forward">
          ▶
        </Btn>
        <Btn onClick={step.last} disabled={atEnd} title="Last">
          ⏭
        </Btn>
        <span className="ml-2 font-mono text-sm text-slate-400">
          step {step.count === 0 ? 0 : step.index + 1} / {step.count}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, step.count - 1)}
        value={step.index}
        onChange={(e) => step.seek(Number(e.target.value))}
        className="w-full accent-emerald-400"
      />

      <div className="font-mono text-sm text-emerald-300">{label}</div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  title,
  wide,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${wide ? 'px-3' : 'px-2.5'} rounded-md border border-slate-600 bg-slate-800 py-1.5 text-sm text-slate-200 transition enabled:hover:bg-slate-700 disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
