import { useAppStore } from '../store/appStore';
import type { Place } from '../types';

/** Floating detail card for the currently-selected place (shown over the map). */
export function PlaceDetail() {
  const selectedId = useAppStore((s) => s.selectedPlaceId);
  const place = useAppStore((s) => s.places.find((p) => p.id === s.selectedPlaceId));
  const selectPlace = useAppStore((s) => s.selectPlace);
  const addToTrip = useAppStore((s) => s.addToTrip);
  const removeFromTrip = useAppStore((s) => s.removeFromTrip);
  const inTrip = useAppStore((s) => (selectedId ? s.tripSelection.includes(selectedId) : false));

  if (!place) return null;

  return (
    <div className="place-detail card stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>
          {place.kind === 'road' ? '🛣 ' : '📍 '}
          {place.name}
        </strong>
        <button
          type="button"
          aria-label="关闭"
          onClick={() => selectPlace(null)}
          style={{ border: 'none', background: 'none' }}
        >
          ×
        </button>
      </div>

      <div className="muted">
        {place.status === 'visited' ? `去过 · ★ ${place.rating ?? '–'}/5` : '想去'}
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

      {place.notes && <p className="muted">{place.notes}</p>}

      <CoordSummary place={place} />

      <div className="row">
        <button
          type="button"
          className={inTrip ? '' : 'primary'}
          onClick={() => (inTrip ? removeFromTrip(place.id) : addToTrip(place.id))}
        >
          {inTrip ? '移出行程' : '加入行程'}
        </button>
      </div>
    </div>
  );
}

function CoordSummary({ place }: { place: Place }) {
  if (place.kind === 'destination') {
    return (
      <span className="muted">
        {place.coord.lng.toFixed(4)}, {place.coord.lat.toFixed(4)}
      </span>
    );
  }
  return (
    <span className="muted">
      起点 {place.entry.lng.toFixed(3)},{place.entry.lat.toFixed(3)} → 终点{' '}
      {place.exit.lng.toFixed(3)},{place.exit.lat.toFixed(3)}
    </span>
  );
}
