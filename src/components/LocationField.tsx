import { useState } from 'react';
import type { BD09 } from '../types';
import { useGeocoder } from '../hooks/useGeocoder';
import type { GeocodeCandidate } from '../map/MapProvider';

interface LocationFieldProps {
  label: string;
  coord: BD09 | undefined;
  onResolved: (coord: BD09 | undefined) => void;
}

/**
 * A single geocoded location input. Handles: resolve → pick among candidates,
 * geocode failure (retry / manual coord), and a resolved-state summary.
 * (spec: place-catalog "Geocoding returns multiple candidates" / "Geocoding fails")
 */
export function LocationField({ label, coord, onResolved }: LocationFieldProps) {
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState(false);
  const [manualLng, setManualLng] = useState('');
  const [manualLat, setManualLat] = useState('');
  const { state, run, reset } = useGeocoder();

  const pick = (c: GeocodeCandidate): void => {
    onResolved(c.coord);
    reset();
  };

  const applyManual = (): void => {
    const lng = Number(manualLng);
    const lat = Number(manualLat);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      onResolved({ lng, lat });
      setManual(false);
    }
  };

  return (
    <div className="stack">
      <label className="field-label">{label}</label>

      {coord ? (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">
            ✓ {coord.lng.toFixed(5)}, {coord.lat.toFixed(5)}
          </span>
          <button type="button" onClick={() => onResolved(undefined)}>
            修改
          </button>
        </div>
      ) : (
        <>
          <div className="row">
            <input
              type="text"
              value={query}
              placeholder="搜索名称或地址"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void run(query);
                }
              }}
            />
            <button type="button" onClick={() => void run(query)} disabled={state.status === 'loading'}>
              {state.status === 'loading' ? '…' : '搜索'}
            </button>
          </div>

          {state.status === 'done' && state.candidates.length === 0 && (
            <p className="muted">未找到匹配结果。请尝试更完整的地址，或手动输入坐标。</p>
          )}

          {state.status === 'done' && state.candidates.length > 0 && (
            <div className="stack">
              {state.candidates.map((c, i) => (
                <button type="button" key={i} onClick={() => pick(c)} style={{ textAlign: 'left' }}>
                  {c.label}
                  {c.context ? <span className="muted"> · {c.context}</span> : null}
                </button>
              ))}
            </div>
          )}

          {state.status === 'error' && (
            <p className="muted" style={{ color: 'var(--danger)' }}>
              {state.message}
            </p>
          )}

          <button
            type="button"
            className="muted"
            style={{ border: 'none', background: 'none', textAlign: 'left', padding: 0 }}
            onClick={() => setManual((m) => !m)}
          >
            {manual ? '隐藏手动输入' : '手动输入坐标'}
          </button>

          {manual && (
            <div className="row">
              <input
                type="number"
                step="0.00001"
                placeholder="经度"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
              />
              <input
                type="number"
                step="0.00001"
                placeholder="纬度"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
              />
              <button type="button" onClick={applyManual}>
                确定
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
