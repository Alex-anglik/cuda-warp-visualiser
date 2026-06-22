import { useMemo, useState } from 'react';
import type {
  DivergenceFramePayload,
  DivergenceParams,
  Frame,
  GridFramePayload,
  GridParams,
  LaunchConfig,
  MemoryFramePayload,
  MemoryParams,
  ViewKind,
  ViewParams,
} from './types';
import { useStepController } from './useStepController';
import { generateGridFrames } from './model/gridFrames';
import { generateDivergenceFrames } from './model/divergence';
import { generateMemoryFrames } from './model/memory';
import { LaunchConfigPanel } from './components/LaunchConfigPanel';
import { ViewTabs } from './components/ViewTabs';
import { StepControls } from './components/StepControls';
import { GridView } from './views/GridView';
import { DivergenceView } from './views/DivergenceView';
import { MemoryView } from './views/MemoryView';

const DEFAULT_CONFIG: LaunchConfig = {
  gridDim: { x: 2, y: 1 },
  blockDim: { x: 8, y: 8 },
  elementBytes: 4,
  segmentBytes: 32,
};

const DEFAULT_PARAMS: ViewParams = {
  grid: { selectedBlock: { x: 0, y: 0 } },
  divergence: { predicate: { kind: 'mod', divisor: 2, eq: 0 }, hasElse: true },
  memory: { pattern: 'coalesced', stride: 2, base: 0, seed: 1 },
};

export default function App() {
  const [config, setConfig] = useState<LaunchConfig>(DEFAULT_CONFIG);
  const [activeView, setActiveView] = useState<ViewKind>('grid');
  const [viewParams, setViewParams] = useState<ViewParams>(DEFAULT_PARAMS);

  const setGridParams = (p: GridParams) =>
    setViewParams((prev) => ({ ...prev, grid: p }));
  const setDivergenceParams = (p: DivergenceParams) =>
    setViewParams((prev) => ({ ...prev, divergence: p }));
  const setMemoryParams = (p: MemoryParams) =>
    setViewParams((prev) => ({ ...prev, memory: p }));

  const frames = useMemo<Frame<unknown>[]>(() => {
    if (activeView === 'grid') return generateGridFrames(config, viewParams.grid);
    if (activeView === 'divergence') return generateDivergenceFrames(viewParams.divergence);
    return generateMemoryFrames(config, viewParams.memory);
  }, [activeView, config, viewParams.grid, viewParams.divergence, viewParams.memory]);

  const step = useStepController(frames.length);
  const frame = frames[Math.min(step.index, frames.length - 1)];

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">CUDA Warp Visualiser</h1>
        <p className="text-sm text-slate-400">
          A conceptual model of the GPU execution model — no GPU required.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-4">
          <LaunchConfigPanel config={config} onChange={setConfig} />
        </aside>

        <main className="flex flex-col gap-4">
          <ViewTabs active={activeView} onChange={setActiveView} />

          {activeView === 'grid' && frame && (
            <GridView
              payload={frame.payload as GridFramePayload}
              cfg={config}
              params={viewParams.grid}
              onParamsChange={setGridParams}
            />
          )}
          {activeView === 'divergence' && frame && (
            <DivergenceView
              payload={frame.payload as DivergenceFramePayload}
              params={viewParams.divergence}
              onParamsChange={setDivergenceParams}
            />
          )}
          {activeView === 'memory' && frame && (
            <MemoryView
              payload={frame.payload as MemoryFramePayload}
              cfg={config}
              params={viewParams.memory}
              onParamsChange={setMemoryParams}
            />
          )}

          <StepControls step={step} label={frame?.label ?? ''} />
        </main>
      </div>
    </div>
  );
}
