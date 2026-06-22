import { describe, expect, it } from 'vitest';
import { locate, partitionBlock } from './kernel';

describe('locate — warp formation over the linearised tid', () => {
  it('1D block: lane increments along x, rolls into warp 1 at tid 32', () => {
    expect(locate(0, 0, { x: 64, y: 1 })).toEqual({ tid: 0, warpId: 0, lane: 0 });
    expect(locate(31, 0, { x: 64, y: 1 })).toEqual({ tid: 31, warpId: 0, lane: 31 });
    expect(locate(32, 0, { x: 64, y: 1 })).toEqual({ tid: 32, warpId: 1, lane: 0 });
  });

  // The hand-worked case from design: an 8x8 block linearises across rows, so
  // (tx=0, ty=4) is tid 32 — the first lane of warp 1. Getting this wrong makes
  // every 2D example silently lie.
  it('2D block 8x8: (0,4) is tid 32 = warp 1, lane 0', () => {
    expect(locate(0, 4, { x: 8, y: 8 })).toEqual({ tid: 32, warpId: 1, lane: 0 });
    expect(locate(7, 3, { x: 8, y: 8 })).toEqual({ tid: 31, warpId: 0, lane: 31 });
    expect(locate(7, 7, { x: 8, y: 8 })).toEqual({ tid: 63, warpId: 1, lane: 31 });
  });
});

describe('partitionBlock — warps, wasted lanes, tail occupancy', () => {
  it('exact multiple of 32: no waste, tail warp full', () => {
    expect(partitionBlock({ x: 8, y: 8 })).toEqual({
      threadsPerBlock: 64,
      warpsPerBlock: 2,
      wastedLanes: 0,
      tailWarpActive: 32,
    });
  });

  it('non-multiple of 32: 48 threads -> 2 warps, 16 wasted, tail has 16', () => {
    expect(partitionBlock({ x: 48, y: 1 })).toEqual({
      threadsPerBlock: 48,
      warpsPerBlock: 2,
      wastedLanes: 16,
      tailWarpActive: 16,
    });
  });

  it('single partial warp: 1 thread wastes 31 lanes', () => {
    expect(partitionBlock({ x: 1, y: 1 })).toEqual({
      threadsPerBlock: 1,
      warpsPerBlock: 1,
      wastedLanes: 31,
      tailWarpActive: 1,
    });
  });
});
