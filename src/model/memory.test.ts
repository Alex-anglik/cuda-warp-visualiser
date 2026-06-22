import { describe, expect, it } from 'vitest';
import { computeMemoryModel } from './memory';
import type { LaunchConfig, MemoryParams } from '../types';

// float reads, 32-byte sectors → 8 elements per segment
const CFG: LaunchConfig = {
  gridDim: { x: 1, y: 1 },
  blockDim: { x: 32, y: 1 },
  elementBytes: 4,
  segmentBytes: 32,
};

const params = (p: Partial<MemoryParams>): MemoryParams => ({
  pattern: 'coalesced',
  stride: 2,
  base: 0,
  seed: 1,
  ...p,
});

describe('coalescing — transactions = distinct 32-byte segments (trap #2)', () => {
  it('coalesced aligned: 32 floats = 128 B = 4 sectors, 100% efficient', () => {
    const m = computeMemoryModel(CFG, params({ pattern: 'coalesced', base: 0 }));
    expect(m.transactions).toBe(4); // NOT 1 — falls out of the sector math
    expect(m.efficiency).toBeCloseTo(1);
    expect(m.bytesMoved).toBe(128);
  });

  it('coalesced but MISaligned by one element: spills into a 5th sector', () => {
    const m = computeMemoryModel(CFG, params({ pattern: 'coalesced', base: 4 }));
    expect(m.transactions).toBe(5); // alignment matters
    expect(m.efficiency).toBeCloseTo(128 / 160);
  });

  it('strided by 2: every other element → 8 sectors, 50% efficient', () => {
    const m = computeMemoryModel(CFG, params({ pattern: 'strided', stride: 2 }));
    expect(m.transactions).toBe(8);
    expect(m.efficiency).toBeCloseTo(0.5);
  });

  it('strided by 8 (one segment apart): worst case 32 sectors, 12.5%', () => {
    const m = computeMemoryModel(CFG, params({ pattern: 'strided', stride: 8 }));
    expect(m.transactions).toBe(32);
    expect(m.efficiency).toBeCloseTo(0.125);
  });

  it('stride 1 strided == coalesced', () => {
    const strided = computeMemoryModel(CFG, params({ pattern: 'strided', stride: 1 }));
    expect(strided.transactions).toBe(4);
  });
});

describe('random pattern — deterministic & bounded', () => {
  it('same seed → identical result (step-back safe)', () => {
    const a = computeMemoryModel(CFG, params({ pattern: 'random', seed: 42 }));
    const b = computeMemoryModel(CFG, params({ pattern: 'random', seed: 42 }));
    expect(a.accesses).toEqual(b.accesses);
  });

  it('transactions between 1 and 32, and worse than coalesced on average', () => {
    const m = computeMemoryModel(CFG, params({ pattern: 'random', seed: 7 }));
    expect(m.transactions).toBeGreaterThanOrEqual(1);
    expect(m.transactions).toBeLessThanOrEqual(32);
    expect(m.transactions).toBeGreaterThan(4);
  });
});
