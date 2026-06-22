import type { BlockPartition, Dim2, ThreadLocation } from '../types';
import { WARP_SIZE } from '../types';

/**
 * Linearise a 2D thread index within a block, then split into warps.
 *
 * NVIDIA's rule: tid = x + y*blockDim.x (+ z*blockDim.x*blockDim.y), and the
 * warp is floor(tid / 32) over that *linear* index — NOT per row of x. This is
 * the single most important correctness invariant in the whole tool.
 */
export function locate(tx: number, ty: number, blockDim: Dim2): ThreadLocation {
  const tid = tx + ty * blockDim.x;
  return { tid, warpId: Math.floor(tid / WARP_SIZE), lane: tid % WARP_SIZE };
}

export function partitionBlock(blockDim: Dim2): BlockPartition {
  const threadsPerBlock = blockDim.x * blockDim.y;
  if (threadsPerBlock <= 0) {
    return { threadsPerBlock: 0, warpsPerBlock: 0, wastedLanes: 0, tailWarpActive: 0 };
  }
  const warpsPerBlock = Math.ceil(threadsPerBlock / WARP_SIZE);
  const wastedLanes = warpsPerBlock * WARP_SIZE - threadsPerBlock;
  const tailWarpActive = threadsPerBlock - (warpsPerBlock - 1) * WARP_SIZE;
  return { threadsPerBlock, warpsPerBlock, wastedLanes, tailWarpActive };
}
