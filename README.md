# CUDA Warp Visualiser

An interactive, browser-based visualiser for the **GPU (CUDA) execution model**. It turns abstract concepts — warp formation, branch divergence, and memory coalescing — into things you can watch, step through, and manipulate.

> It simulates the *conceptual* execution model. It does **not** run real CUDA and needs **no GPU**. The goal is teaching and intuition, so the model is kept deliberately, verifiably correct rather than cycle-accurate.

## Views

| View | What it shows |
| --- | --- |
| **Grid / Block / Warp** | How a launch partitions into blocks → warps of 32 → lanes. Threads are coloured by warp over the *linearised* thread index (`tid = x + y·blockDim.x`), so you can see how a 2D block snakes into warps. When `blockDim` isn't a multiple of 32, the wasted tail-warp lanes are shown explicitly. |
| **Warp Divergence** *(in progress)* | A branch animated across 32 lanes, executing the `then` and `else` paths **sequentially** (not concurrently), with a "passes required" and warp-efficiency cost indicator. |
| **Memory Access** *(planned)* | A warp's 32 accesses under coalesced / strided / random patterns, coalesced into 32-byte segments, with a live transaction count and bandwidth-efficiency figure. |

All three views share one **step forward / step back / play / scrub** control model.

## How it works

Each view is a pure function `generateFrames(params) → Frame[]`. Animation state is just an index into that array — stepping never mutates simulation state, it re-reads `frames[index]`. This makes the views deterministic, trivially reversible, and unit-testable without React.

The warp-formation arithmetic (`locate` / `partitionBlock`) is the correctness foundation of the whole tool and is covered by unit tests.

## Tech stack

React 19 · TypeScript · Vite 7 · Tailwind CSS v4 · Vitest. Fully client-side, no backend, all state in memory.

> **Node version:** pinned to Vite 7 (rollup-based). Vite 8 uses rolldown, which needs Node ≥ 22.12 and a native binary. If you're on an older Node, Vite 7 just works.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm test         # run the unit tests
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Project structure

```
src/
├─ types.ts                 # shared data contracts (no React)
├─ useStepController.ts     # shared step / play / scrub controller
├─ model/
│  ├─ kernel.ts             # locate() + partitionBlock() — tested foundation
│  ├─ kernel.test.ts
│  └─ gridFrames.ts         # frame generator for the grid view
├─ components/              # LaunchConfigPanel, ViewTabs, StepControls
└─ views/                   # GridView (+ DivergenceView, MemoryView to come)
```

## Deploying to Vercel

Import the repo in Vercel. It auto-detects Vite — build command `npm run build`, output directory `dist`. No environment variables or backend required.

## Status

- [x] Grid / Block / Warp view
- [ ] Warp Divergence view
- [ ] Memory Access view
- [ ] Stretch: occupancy calculator, preset kernels, transpose comparison

## Licence

MIT
