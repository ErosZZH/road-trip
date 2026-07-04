import { useState } from 'react';
import type { BD09 } from '../types';
import { useGeocoder } from '../hooks/useGeocoder';
import type { GeocodeCandidate } from '../map/MapProvider';

interface LocationFieldProps {
  label: string;
  coord: BD09 | undefined;
  /** Called when the user picks a candidate: passes its coord and its name. */
  onResolved: (coord: BD09 | undefined, name?: string) => void;
}

/**
 * A single geocoded location input. The user searches a name, the field lists
 * ALL returned candidates, and picking one resolves both the coordinate and the
 * candidate's name to the parent (spec: place-catalog "search returns multiple
 * candidates" + auto-filled name). There is no manual coordinate entry — the
 * geometry always comes from a selected Baidu result.
 */
export function LocationField({ label, coord, onResolved }: LocationFieldProps) {
  const [query, setQuery] = useState('');
  const { state, run, reset } = useGeocoder();

  const pick = (c: GeocodeCandidate): void => {
    onResolved(c.coord, c.label);
    reset();
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
            <p className="muted">未找到匹配结果。请尝试更完整的名称或地址后重试。</p>
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
        </>
      )}
    </div>
  );
}
