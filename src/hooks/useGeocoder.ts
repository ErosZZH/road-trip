import { useState, useCallback } from 'react';
import { getMapProvider } from '../map';
import type { GeocodeCandidate } from '../map/MapProvider';

type GeocodeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; candidates: GeocodeCandidate[] }
  | { status: 'error'; message: string };

/**
 * Hook wrapping the map provider's geocode(). Exposes a run() to resolve a
 * query into candidates, plus loading/error state for the form UX.
 */
export function useGeocoder() {
  const [state, setState] = useState<GeocodeState>({ status: 'idle' });

  const run = useCallback(async (query: string): Promise<GeocodeCandidate[]> => {
    if (!query.trim()) {
      setState({ status: 'idle' });
      return [];
    }
    setState({ status: 'loading' });
    try {
      const candidates = await getMapProvider().geocode(query);
      setState({ status: 'done', candidates });
      return candidates;
    } catch (err) {
      const message = err instanceof Error ? err.message : '地址解析失败。';
      setState({ status: 'error', message });
      return [];
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, run, reset };
}
