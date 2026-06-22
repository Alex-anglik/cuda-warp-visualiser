import type { Frame } from '../types';

/**
 * Placeholder shown while a view is unimplemented. Proves the shared step
 * controller is driving this view: the panel reflects the current frame.
 */
export function ViewStub({
  name,
  frame,
  note,
}: {
  name: string;
  frame: Frame<unknown>;
  note?: string;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center">
      <div className="text-lg font-semibold text-slate-200">{name}</div>
      <div className="font-mono text-sm text-slate-400">not implemented yet</div>
      <div className="mt-4 rounded-md bg-slate-800 px-4 py-2 font-mono text-sm text-emerald-300">
        frame {frame.index}: {frame.label}
      </div>
      {note && <div className="max-w-md text-xs text-slate-500">{note}</div>}
    </div>
  );
}
