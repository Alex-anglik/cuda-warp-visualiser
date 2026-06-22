import { useCallback, useEffect, useRef, useState } from 'react';

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

  // Clamp + reset when the frame set changes (e.g. config edit).
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [frameCount]);

  const last = frameCount - 1;

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const first = useCallback(() => setIndex(0), []);
  const goLast = useCallback(() => setIndex(last), [last]);
  const seek = useCallback(
    (i: number) => setIndex(Math.max(0, Math.min(i, last))),
    [last],
  );
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  // Play loop: advance on a timer, stop at the end.
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => {
      if (playingRef.current) setIndex((i) => Math.min(i + 1, last));
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
