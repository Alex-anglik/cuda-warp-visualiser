import { useCallback, useEffect, useState } from 'react';

export interface StepController {
  index: number;
  playing: boolean;
  count: number;
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;
  togglePlay: () => void;
  seek: (i: number) => void;
}

/**
 * Owns the animation index. Stepping never mutates simulation state — the view
 * just re-reads frames[index]. Resets to 0 whenever frameCount changes so a
 * config edit can never leave the index pointing past the end.
 */
export function useStepController(frameCount: number, speedMs = 700): StepController {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Reset when the frame set changes (e.g. config edit). Adjusting state during
  // render — React's recommended pattern — rather than in an effect.
  const [prevCount, setPrevCount] = useState(frameCount);
  if (frameCount !== prevCount) {
    setPrevCount(frameCount);
    setIndex(0);
    setPlaying(false);
  }

  const last = frameCount - 1;

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const first = useCallback(() => setIndex(0), []);
  const goLast = useCallback(() => setIndex(last), [last]);
  const seek = useCallback(
    (i: number) => setIndex(Math.max(0, Math.min(i, last))),
    [last],
  );
  const togglePlay = useCallback(() => {
    // Pressing play at the end restarts from the beginning.
    if (!playing && index >= last) setIndex(0);
    setPlaying((p) => !p);
  }, [playing, index, last]);

  // Play loop: advance on a timer, stopping at the end. setState happens only in
  // the async callback, never synchronously in the effect body.
  useEffect(() => {
    if (!playing || index >= last) return;
    const t = setTimeout(() => {
      setIndex((i) => Math.min(i + 1, last));
      if (index + 1 >= last) setPlaying(false);
    }, speedMs);
    return () => clearTimeout(t);
  }, [playing, index, last, speedMs]);

  return {
    index,
    playing,
    count: frameCount,
    next,
    prev,
    first,
    last: goLast,
    togglePlay,
    seek,
  };
}
