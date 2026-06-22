import { describe, expect, it } from 'vitest';
import { evalPredicate, generateDivergenceFrames } from './divergence';
import type { DivergenceParams } from '../types';

const run = (p: DivergenceParams) => {
  const frames = generateDivergenceFrames(p);
  return frames[0].payload; // base fields (passes/efficiency/divergent) are constant
};

describe('evalPredicate', () => {
  it('mod / lt / block', () => {
    expect(evalPredicate({ kind: 'mod', divisor: 2, eq: 0 }, 4)).toBe(true);
    expect(evalPredicate({ kind: 'mod', divisor: 2, eq: 0 }, 5)).toBe(false);
    expect(evalPredicate({ kind: 'lt', bound: 16 }, 15)).toBe(true);
    expect(evalPredicate({ kind: 'lt', bound: 16 }, 16)).toBe(false);
    // (lane/8)%2==0 → lanes 0-7 true, 8-15 false, 16-23 true …
    expect(evalPredicate({ kind: 'block', size: 8 }, 7)).toBe(true);
    expect(evalPredicate({ kind: 'block', size: 8 }, 8)).toBe(false);
  });
});

describe('generateDivergenceFrames — pass counting (traps #2/#3)', () => {
  it('if/else, half and half: 2 passes, divergent, 50% efficiency', () => {
    const p = run({ predicate: { kind: 'mod', divisor: 2, eq: 0 }, hasElse: true });
    expect(p.passesRequired).toBe(2);
    expect(p.divergent).toBe(true);
    expect(p.efficiency).toBeCloseTo(0.5);
  });

  it('if-ONLY, half take it: 1 pass (else lanes just idle), still divergent', () => {
    const p = run({ predicate: { kind: 'mod', divisor: 2, eq: 0 }, hasElse: false });
    expect(p.passesRequired).toBe(1); // NOT 2 — no else body exists
    expect(p.divergent).toBe(true); // lanes still disagree → idle lanes
    expect(p.efficiency).toBeCloseTo(0.5); // 16 active / 32
  });

  it('uniform true (all lanes take then), with else: 1 pass, NOT divergent, 100%', () => {
    const p = run({ predicate: { kind: 'lt', bound: 32 }, hasElse: true });
    expect(p.passesRequired).toBe(1); // else has no lanes
    expect(p.divergent).toBe(false); // a uniform branch is free
    expect(p.efficiency).toBeCloseTo(1);
  });

  it('uniform false, if-only: 0 passes — the whole warp skips the branch', () => {
    const p = run({ predicate: { kind: 'lt', bound: 0 }, hasElse: false });
    expect(p.passesRequired).toBe(0);
    expect(p.divergent).toBe(false);
  });

  it('uniform false, if/else: only the else runs → 1 pass, not divergent', () => {
    const p = run({ predicate: { kind: 'lt', bound: 0 }, hasElse: true });
    expect(p.passesRequired).toBe(1);
    expect(p.divergent).toBe(false);
    expect(p.efficiency).toBeCloseTo(1); // 32 else lanes / 32
  });
});

describe('generateDivergenceFrames — frame sequence', () => {
  it('if/else divergent: evaluate, then, else, reconverge', () => {
    const frames = generateDivergenceFrames({
      predicate: { kind: 'mod', divisor: 2, eq: 0 },
      hasElse: true,
    });
    expect(frames.map((f) => f.payload.phase)).toEqual([
      'evaluate',
      'then',
      'else',
      'reconverge',
    ]);
  });

  it('uniform-false if-only collapses to evaluate, reconverge', () => {
    const frames = generateDivergenceFrames({
      predicate: { kind: 'lt', bound: 0 },
      hasElse: false,
    });
    expect(frames.map((f) => f.payload.phase)).toEqual(['evaluate', 'reconverge']);
  });
});
