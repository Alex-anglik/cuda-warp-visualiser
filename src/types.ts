// ---------------------------------------------------------------------------
// Core model contracts. Pure data — no React in here.
// ---------------------------------------------------------------------------

/** A real hardware constant, not a config knob. */
export const WARP_SIZE = 32;

/** 2D extent; z deliberately omitted in v1 (scope cut). */
export interface Dim2 {
  x: number;
  y: number;
}

export interface LaunchConfig {
  gridDim: Dim2; // blocks per grid
  blockDim: Dim2; // threads per block
  // Physical constants of the simulated device, shared by the memory view:
  elementBytes: number; // bytes per thread access (default 4 = float)
  segmentBytes: number; // coalescing granularity (default 32 = sector)
}

// --- kernel-model helper outputs ------------------------------------------

export interface ThreadLocation {
  tid: number; // linearized index within the block
  warpId: number; // tid / 32
  lane: number; // tid % 32
}

export interface BlockPartition {
  threadsPerBlock: number;
  warpsPerBlock: number; // ceil(tpb / 32)
  wastedLanes: number; // 32*warpsPerBlock - tpb
  tailWarpActive: number; // lane occupancy of the tail warp
}

// --- generic frame + step model -------------------------------------------

export type ViewKind = 'grid' | 'divergence' | 'memory';

export interface Frame<P> {
  index: number;
  label: string; // caption shown under the controls
  payload: P;
}

// --- per-view scenario params ---------------------------------------------

export type BranchPreset =
  | { kind: 'mod'; divisor: number; eq: number } // lane % divisor == eq
  | { kind: 'lt'; bound: number } // lane < bound
  | { kind: 'block'; size: number }; // (lane / size) % 2 == 0

export interface DivergenceParams {
  predicate: BranchPreset;
  hasElse: boolean; // if/else (2 passes) vs if-only (1 pass + idle lanes)
}

export type AccessPattern = 'coalesced' | 'strided' | 'random';

export interface MemoryParams {
  pattern: AccessPattern;
  stride: number; // in elements; only used when pattern === 'strided'
  base: number; // byte offset
  seed: number; // seeded PRNG -> deterministic 'random'
}

export interface GridParams {
  selectedBlock: Dim2; // which block's warps we walk
}

export interface ViewParams {
  grid: GridParams;
  divergence: DivergenceParams;
  memory: MemoryParams;
}

// --- frame payloads --------------------------------------------------------

/** A real thread, placed in the 2D block — drives the linearisation map. */
export interface ThreadCell {
  tx: number;
  ty: number;
  tid: number;
  warpId: number;
  lane: number;
}

/** One of the 32 lane slots of a warp; tid === null means a wasted lane. */
export interface LaneSlot {
  warpId: number;
  lane: number;
  tid: number | null;
  wasted: boolean; // tail-warp slot with no thread (tid >= tpb)
}

export interface GridFramePayload {
  blockDim: Dim2;
  threads: ThreadCell[]; // real threads, for the 2D map
  laneStrip: LaneSlot[]; // warpsPerBlock * 32 slots, for the lane view
  highlightWarp: number; // advances per frame — the snake-fill reveal
  partition: BlockPartition;
}

export type DivPhase = 'evaluate' | 'then' | 'else' | 'reconverge';

export interface DivergenceFramePayload {
  phase: DivPhase;
  phases: DivPhase[]; // ordered sequence that actually occurs — for the timeline
  laneActive: boolean[]; // length 32; which lanes execute THIS frame
  passesRequired: number; // 0 | 1 | 2 — distinct non-empty bodies in THIS warp
  activeCount: number; // lanes active in the current frame
  efficiency: number; // Σ active over executed passes / (32 * passes)
  divergent: boolean; // some lanes take then AND some take else
}

export interface LaneAccess {
  lane: number;
  addr: number; // byte address
  segment: number; // floor(addr / segmentBytes)
}

export type MemPhase = 'issue' | 'coalesce';

export interface MemoryFramePayload {
  phase: MemPhase;
  accesses: LaneAccess[]; // length 32
  segmentsTouched: number[]; // sorted distinct segment ids
  transactions: number; // = segmentsTouched.length — never hardcoded
  bytesRequested: number; // 32 * elementBytes
  bytesMoved: number; // transactions * segmentBytes
  efficiency: number; // bytesRequested / bytesMoved
  segmentBytes: number; // echoed so the view can show the assumption
}
