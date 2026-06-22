import type {
  Frame,
  GridFramePayload,
  GridParams,
  LaunchConfig,
  LaneSlot,
  ThreadCell,
} from '../types';
import { WARP_SIZE } from '../types';
import { locate, partitionBlock } from './kernel';

/**
 * One frame per warp. Frame k highlights warp k; the view fills warps 0..k in
 * linearised order, so stepping forward "snakes" the colouring through the
 * block. Partition is identical for every block in the grid, so selectedBlock
 * only affects labelling (global block id), not the warp arithmetic.
 */
export function generateGridFrames(
  cfg: LaunchConfig,
  params: GridParams,
): Frame<GridFramePayload>[] {
  const { blockDim, gridDim } = cfg;
  const partition = partitionBlock(blockDim);

  const threads: ThreadCell[] = [];
  for (let ty = 0; ty < blockDim.y; ty++) {
    for (let tx = 0; tx < blockDim.x; tx++) {
      const { tid, warpId, lane } = locate(tx, ty, blockDim);
      threads.push({ tx, ty, tid, warpId, lane });
    }
  }

  const laneStrip: LaneSlot[] = [];
  for (let w = 0; w < partition.warpsPerBlock; w++) {
    for (let l = 0; l < WARP_SIZE; l++) {
      const tid = w * WARP_SIZE + l;
      const real = tid < partition.threadsPerBlock;
      laneStrip.push({ warpId: w, lane: l, tid: real ? tid : null, wasted: !real });
    }
  }

  const blockId = params.selectedBlock.y * gridDim.x + params.selectedBlock.x;

  const frames: Frame<GridFramePayload>[] = [];
  for (let k = 0; k < partition.warpsPerBlock; k++) {
    const firstTid = k * WARP_SIZE;
    const lastTid = Math.min(firstTid + WARP_SIZE - 1, partition.threadsPerBlock - 1);
    const isTail = k === partition.warpsPerBlock - 1 && partition.wastedLanes > 0;
    const label =
      `Block ${blockId} · Warp ${k}: tid ${firstTid}–${lastTid}` +
      (isTail ? ` · ${partition.wastedLanes} lanes wasted` : '');

    frames.push({
      index: k,
      label,
      payload: { blockDim, threads, laneStrip, highlightWarp: k, partition },
    });
  }

  return frames;
}
