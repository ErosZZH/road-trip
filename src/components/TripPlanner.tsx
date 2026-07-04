import { useState } from 'react';
import { useAppStore, selectAllTags } from '../store/appStore';
import type { RouteMetrics } from '../types';

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} 公里`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} 小时 ${m} 分钟` : `${m} 分钟`;
}

function Metrics({ metrics }: { metrics: RouteMetrics }) {
  const places = useAppStore((s) => s.places);
  const label = (id: string): string =>
    id === '@home' ? '🏠 家' : (places.find((p) => p.id === id)?.name ?? id);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>{formatKm(metrics.totalDistanceMeters)}</strong>
        <span className="muted">约 {formatDuration(metrics.totalDurationSeconds)} 车程</span>
      </div>
      <ol className="stack" style={{ margin: 0, paddingLeft: 18 }}>
        {metrics.legs.map((leg, i) => (
          <li key={i} className="muted">
            {label(leg.fromId)} → {label(leg.toId)} · {formatKm(leg.distanceMeters)}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Trip planning panel: selection, constraints, optimize, metrics, save/open. */
export function TripPlanner() {
  const selection = useAppStore((s) => s.tripSelection);
  const places = useAppStore((s) => s.places);
  const constraints = useAppStore((s) => s.constraints);
  const allTags = useAppStore(selectAllTags);
  const planning = useAppStore((s) => s.planning);
  const planError = useAppStore((s) => s.planError);
  const route = useAppStore((s) => s.activeRoute);
  const trips = useAppStore((s) => s.trips);

  const planTrip = useAppStore((s) => s.planTrip);
  const addConstraint = useAppStore((s) => s.addConstraint);
  const removeConstraint = useAppStore((s) => s.removeConstraint);
  const removeFromTrip = useAppStore((s) => s.removeFromTrip);
  const clearTripSelection = useAppStore((s) => s.clearTripSelection);
  const saveTrip = useAppStore((s) => s.saveTrip);
  const openTrip = useAppStore((s) => s.openTrip);
  const deleteTrip = useAppStore((s) => s.deleteTrip);

  const [tripName, setTripName] = useState('');
  const [constraintTag, setConstraintTag] = useState('');

  const selectedPlaces = selection
    .map((id) => places.find((p) => p.id === id))
    .filter(Boolean);

  return (
    <div className="card stack">
      <p className="section-title">行程规划</p>

      {selection.length === 0 ? (
        <p className="muted">从列表或地图中加入地点，即可规划环线。</p>
      ) : (
        <div className="stack">
          {selectedPlaces.map((p) => (
            <div key={p!.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>
                {p!.kind === 'road' ? '🛣 ' : '📍 '}
                {p!.name}
              </span>
              <button type="button" onClick={() => removeFromTrip(p!.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Constraints */}
      <div className="stack">
        <label className="field-label">必须包含标签</label>
        <div className="row">
          <input
            list="constraint-tags"
            value={constraintTag}
            placeholder="例如：漂流"
            onChange={(e) => setConstraintTag(e.target.value)}
          />
          <datalist id="constraint-tags">
            {allTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => {
              if (constraintTag.trim()) {
                addConstraint(constraintTag.trim());
                setConstraintTag('');
              }
            }}
          >
            添加
          </button>
        </div>
        {constraints.length > 0 && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {constraints.map((c) => (
              <span key={c.tag} className="tag-chip">
                ≥{c.min} {c.tag}{' '}
                <button
                  type="button"
                  onClick={() => removeConstraint(c.tag)}
                  style={{ border: 'none', background: 'none', color: 'inherit', padding: 0 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={planning || selection.length === 0}
          onClick={() => void planTrip()}
        >
          {planning ? '规划中…' : '规划环线'}
        </button>
        {selection.length > 0 && (
          <button type="button" onClick={clearTripSelection}>
            清空
          </button>
        )}
      </div>

      {planError && (
        <p className="muted" style={{ color: 'var(--danger)' }}>
          {planError}
        </p>
      )}

      {route && route.legs.length > 0 && (
        <>
          <Metrics metrics={route} />
          <div className="row">
            <input
              value={tripName}
              placeholder="行程名称"
              onChange={(e) => setTripName(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                saveTrip(tripName);
                setTripName('');
              }}
            >
              保存
            </button>
          </div>
        </>
      )}

      {/* Saved trips */}
      {trips.length > 0 && (
        <div className="stack">
          <label className="field-label">已保存行程</label>
          {trips.map((t) => (
            <div key={t.id} className="row" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => openTrip(t.id)}
                style={{ border: 'none', background: 'none', textAlign: 'left', padding: 0 }}
              >
                {t.name}
                {t.needsReview ? <span className="badge-wishlist"> · 待检查</span> : null}
              </button>
              <button type="button" className="danger" onClick={() => deleteTrip(t.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
