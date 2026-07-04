import { useState } from 'react';
import type { CatalogEntity } from '../types';
import { useAppStore } from '../store/appStore';
import { PlaceForm } from './PlaceForm';

function StatusBadge({ place }: { place: CatalogEntity }) {
  if (place.status === 'visited') {
    return (
      <span className="badge-visited">
        ★ {place.rating ?? '–'}/5
      </span>
    );
  }
  return <span className="badge-wishlist">想去</span>;
}

function PlaceRow({ place }: { place: CatalogEntity }) {
  const [editing, setEditing] = useState(false);
  const removePlace = useAppStore((s) => s.removePlace);
  const removeRoute = useAppStore((s) => s.removeRoute);
  const selectPlace = useAppStore((s) => s.selectPlace);
  const addToTrip = useAppStore((s) => s.addToTrip);
  const inTrip = useAppStore(
    (s) => s.tripSelection.includes(place.id) || s.tripRouteSelection.includes(place.id),
  );

  const handleDelete = (): void => {
    const idKey = place.kind === 'road' ? 'routeIds' : 'placeIds';
    const trips = useAppStore.getState().trips.filter((t) => t[idKey].includes(place.id));
    const msg =
      trips.length > 0
        ? `“${place.name}”被 ${trips.length} 个行程使用。删除它并将这些行程标记为待检查？`
        : `删除“${place.name}”？`;
    if (window.confirm(msg)) {
      if (place.kind === 'road') {
        void removeRoute(place.id);
      } else {
        void removePlace(place.id);
      }
    }
  };

  if (editing) {
    return <PlaceForm editing={place} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="card stack" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={() => selectPlace(place.id)}
          style={{ border: 'none', background: 'none', fontWeight: 600, textAlign: 'left', padding: 0 }}
        >
          {place.kind === 'road' ? '🛣 ' : '📍 '}
          {place.name}
        </button>
        <StatusBadge place={place} />
      </div>

      {place.tags.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {place.tags.map((t) => (
            <span key={t} className="tag-chip">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="row">
        <button
          type="button"
          className={inTrip ? '' : 'primary'}
          onClick={() => (inTrip ? useAppStore.getState().removeFromTrip(place.id) : addToTrip(place.id))}
        >
          {inTrip ? '已加入 ✓' : '加入行程'}
        </button>
        <button type="button" onClick={() => setEditing(true)}>
          编辑
        </button>
        <button type="button" className="danger" onClick={handleDelete}>
          删除
        </button>
      </div>
    </div>
  );
}

/** Renders the catalog as a list of place/route cards. `places` is pre-filtered by the caller. */
export function PlaceList({ places }: { places: CatalogEntity[] }) {
  if (places.length === 0) {
    return <p className="muted">还没有地点。在上方添加一个，即可在地图上显示。</p>;
  }
  return (
    <div className="stack">
      {places.map((p) => (
        <PlaceRow key={p.id} place={p} />
      ))}
    </div>
  );
}
