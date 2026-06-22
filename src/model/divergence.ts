import type {
  BranchPreset,
  DivPhase,
  DivergenceFramePayload,
  DivergenceParams,
  Frame,
} from '../types';
import { WARP_SIZE } from '../types';

/** Evaluate the branch predicate for a single lane (== threadIdx.x in warp 0). */
export function evalPredicate(p: BranchPreset, lane: number): boolean {
  switch (p.kind) {
    case 'mod':
      return lane % Math.max(1, p.divisor) === p.eq;
    case 'lt':
      return lane < p.bound;
    case 'block':
      return Math.floor(lane / Math.max(1, p.size)) % 2 === 0;
  }
}

/** Source-like rendering of the condition for display. */
export function predicateLabel(p: BranchPreset): string {
  switch (p.kind) {
    case 'mod':
      return `threadIdx.x % ${p.divisor} == ${p.eq}`;
    case 'lt':
      return `threadIdx.x < ${p.bound}`;
    case 'block':
      return `(threadIdx.x / ${p.size}) % 2 == 0`;
  }
}

const all = (v: boolean) => Array.from({ length: WARP_SIZE }, () => v);

export function generateDivergenceFrames(
  params: DivergenceParams,
): Frame<DivergenceFramePayload>[] {
  const { predicate, hasElse } = params;

  const thenMask = Array.from({ length: WARP_SIZE }, (_, l) =>
    evalPredicate(predicate, l),
  );
  const elseMask = thenMask.map((b) => !b);
  const thenCount = thenMask.filter(Boolean).length;
  const elseCount = WARP_SIZE - thenCount;

  // A path is an executed pass only if at least one lane takes it. The else
  // body only exists when hasElse — an if-only branch never adds a second pass;
  // its non-taking lanes simply idle during the then pass.
  const thenTaken = thenCount > 0;
  const elseExecuted = hasElse && elseCount > 0;
  const passesRequired = (thenTaken ? 1 : 0) + (elseExecuted ? 1 : 0);

  // Divergence (intra-warp) = lanes disagree. True even for an if-only branch
  // with idle lanes; false when the whole warp agrees (a uniform branch).
  const divergent = thenCount > 0 && elseCount > 0;

  const sumActive = (thenTaken ? thenCount : 0) + (elseExecuted ? elseCount : 0);
  const efficiency = passesRequired > 0 ? sumActive / (WARP_SIZE * passesRequired) : 1;

  // The phases that actually occur, in execution order.
  const phases: DivPhase[] = ['evaluate'];
  if (thenTaken) phases.push('then');
  if (elseExecuted) phases.push('else');
  phases.push('reconverge');

  const base = { phases, passesRequired, efficiency, divergent };

  // 'evaluate' is at index 0, so a path's index in `phases` is its 1-based pass number.
  const passOf = (phase: 'then' | 'else') => phases.indexOf(phase);
  const frames: Frame<DivergenceFramePayload>[] = phases.map((phase, index) => {
    let laneActive: boolean[];
    let label: string;
    switch (phase) {
      case 'evaluate':
        laneActive = all(true);
        label = 'Evaluate condition — all 32 lanes test the predicate together';
        break;
      case 'then':
        laneActive = thenMask;
        label = `Pass ${passOf('then')}/${passesRequired}: then-branch — ${thenCount}/32 lanes active`;
        break;
      case 'else':
        laneActive = elseMask;
        label = `Pass ${passOf('else')}/${passesRequired}: else-branch — ${elseCount}/32 lanes active`;
        break;
      case 'reconverge':
        laneActive = all(true);
        label =
          passesRequired === 0
            ? 'Whole warp skips the branch — no lanes take it, 0 passes'
            : 'Reconverge — all 32 lanes active again';
        break;
    }
    return {
      index,
      label,
      payload: { ...base, phase, laneActive, activeCount: laneActive.filter(Boolean).length },
    };
  });

  return frames;
}
