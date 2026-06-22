import type {
  Frame,
  LaneAccess,
  LaunchConfig,
  MemoryFramePayload,
  MemoryParams,
} from '../types';
import { WARP_SIZE } from '../types';

/** Small deterministic PRNG so the 'random' pattern is reproducible (step-back safe). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MemoryModel {
  accesses: LaneAccess[];
  segmentsTouched: number[];
  transactions: number;
  bytesRequested: number;
  bytesMoved: number;
  efficiency: number;
  elementsPerSegment: number;
}

/**
 * Generate the 32 lane addresses for a pattern and coalesce them. The key
 * invariant: transactions is the count of DISTINCT segments touched, derived
 * from floor(addr / segmentBytes) — never special-cased per pattern. Assumes
 * each elementBytes access is aligned within a single segment (true for the
 * power-of-two defaults; element straddling is out of scope for v1).
 */
export function computeMemoryModel(cfg: LaunchConfig, params: MemoryParams): MemoryModel {
  const { elementBytes, segmentBytes } = cfg;
  const { pattern, stride, base, seed } = params;

  const elementsPerSegment = Math.max(1, Math.floor(segmentBytes / elementBytes));
  const spanElements = WARP_SIZE * elementsPerSegment; // range for random scatter
  const rng = mulberry32(seed);

  const accesses: LaneAccess[] = [];
  for (let lane = 0; lane < WARP_SIZE; lane++) {
    let elementOffset: number;
    if (pattern === 'coalesced') elementOffset = lane;
    else if (pattern === 'strided') elementOffset = lane * stride;
    else elementOffset = Math.floor(rng() * spanElements);

    const addr = base + elementOffset * elementBytes;
    accesses.push({ lane, addr, segment: Math.floor(addr / segmentBytes) });
  }

  const segmentsTouched = [...new Set(accesses.map((a) => a.segment))].sort((x, y) => x - y);
  const transactions = segmentsTouched.length;
  const bytesRequested = WARP_SIZE * elementBytes;
  const bytesMoved = transactions * segmentBytes;
  const efficiency = bytesMoved > 0 ? bytesRequested / bytesMoved : 0;

  return {
    accesses,
    segmentsTouched,
    transactions,
    bytesRequested,
    bytesMoved,
    efficiency,
    elementsPerSegment,
  };
}

export function generateMemoryFrames(
  cfg: LaunchConfig,
  params: MemoryParams,
): Frame<MemoryFramePayload>[] {
  const m = computeMemoryModel(cfg, params);
  const { elementBytes, segmentBytes } = cfg;

  const issueLabel =
    params.pattern === 'coalesced'
      ? `Issue addresses: base + lane × ${elementBytes} B (contiguous)`
      : params.pattern === 'strided'
        ? `Issue addresses: base + lane × ${params.stride} × ${elementBytes} B (stride ${params.stride})`
        : `Issue addresses: random scatter (seed ${params.seed})`;

  const base = {
    accesses: m.accesses,
    segmentsTouched: m.segmentsTouched,
    transactions: m.transactions,
    bytesRequested: m.bytesRequested,
    bytesMoved: m.bytesMoved,
    efficiency: m.efficiency,
    segmentBytes,
  };

  return [
    { index: 0, label: issueLabel, payload: { ...base, phase: 'issue' } },
    {
      index: 1,
      label: `Coalesce → ${m.transactions} transaction${m.transactions === 1 ? '' : 's'}, ${Math.round(
        m.efficiency * 100,
      )}% bandwidth efficiency`,
      payload: { ...base, phase: 'coalesce' },
    },
  ];
}
