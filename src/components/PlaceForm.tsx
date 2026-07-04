import { useMemo, useState } from 'react';
import type { BD09, CatalogEntity, PlaceKind, PlaceStatus, Rating } from '../types';
import { validatePlace, normalizeRating } from '../domain/validation';
import {
  useAppStore,
  selectAllTags,
  type NewPlaceInput,
  type NewRouteInput,
} from '../store/appStore';
import { getMapProvider } from '../map';
import { TagInput } from './TagInput';
import { RatingInput } from './RatingInput';
import { LocationField } from './LocationField';

interface PlaceFormProps {
  /** When provided, the form edits this place/route; otherwise it adds a new one. */
  editing?: CatalogEntity;
  onDone: () => void;
}

/**
 * Add/edit a place (destination) or route (scenic road). Locations are chosen by
 * searching and picking a Baidu candidate — the name auto-fills from the pick and
 * coordinates are never hand-entered (spec: place-catalog). For a route, the
 * driving-path geometry between entry and exit is computed and stored on save.
 */
export function PlaceForm({ editing, onDone }: PlaceFormProps) {
  const addPlace = useAppStore((s) => s.addPlace);
  const updatePlace = useAppStore((s) => s.updatePlace);
  const addRoute = useAppStore((s) => s.addRoute);
  const updateRoute = useAppStore((s) => s.updateRoute);
  const tagSuggestions = useAppStore(selectAllTags);

  const [kind, setKind] = useState<PlaceKind>(editing?.kind ?? 'destination');
  const [name, setName] = useState(editing?.name ?? '');
  const [status, setStatus] = useState<PlaceStatus>(editing?.status ?? 'wishlist');
  const [rating, setRating] = useState<Rating | undefined>(editing?.rating);
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const [notes, setNotes] = useState(editing?.notes ?? '');

  const [coord, setCoord] = useState<BD09 | undefined>(
    editing?.kind === 'destination' ? editing.coord : undefined,
  );
  const [entry, setEntry] = useState<BD09 | undefined>(
    editing?.kind === 'road' ? editing.entry : undefined,
  );
  const [exit, setExit] = useState<BD09 | undefined>(
    editing?.kind === 'road' ? editing.exit : undefined,
  );

  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Preserve existing waypoints when editing a road so renaming doesn't strip
  // its pinned path. The stored `path` is recomputed on save when endpoints change.
  const existingWaypoints = editing?.kind === 'road' ? editing.waypoints : undefined;
  const existingEntry = editing?.kind === 'road' ? editing.entry : undefined;
  const existingExit = editing?.kind === 'road' ? editing.exit : undefined;
  const existingPath = editing?.kind === 'road' ? editing.path : undefined;

  /** Fill the name from a picked candidate only when the user hasn't typed one. */
  const applyResolvedName = (candidateName?: string): void => {
    if (candidateName && !name.trim()) setName(candidateName);
  };

  const draft = useMemo((): NewPlaceInput | NewRouteInput => {
    const base = {
      name,
      status,
      rating: normalizeRating(status, rating),
      tags,
      notes: notes.trim() || undefined,
    };
    return kind === 'destination'
      ? { ...base, kind: 'destination', coord: coord as BD09 }
      : {
          ...base,
          kind: 'road',
          entry: entry as BD09,
          exit: exit as BD09,
          waypoints: existingWaypoints,
        };
  }, [kind, name, status, rating, tags, notes, coord, entry, exit, existingWaypoints]);

  /** Resolve a road's driving-path geometry (entry → waypoints → exit). */
  const resolvePath = async (
    routeEntry: BD09,
    routeExit: BD09,
    waypoints: BD09[] | undefined,
  ): Promise<BD09[]> => {
    const provider = getMapProvider();
    const pins = [routeEntry, ...(waypoints ?? []), routeExit];
    const full: BD09[] = [];
    for (let i = 0; i < pins.length - 1; i += 1) {
      try {
        const res = await provider.drivingRoute(pins[i]!, pins[i + 1]!);
        const seg = res.path.length >= 2 ? res.path : [pins[i]!, pins[i + 1]!];
        full.push(...(i === 0 ? seg : seg.slice(1)));
      } catch {
        // Routing unavailable for this segment — fall back to a straight line.
        full.push(...(i === 0 ? [pins[i]!, pins[i + 1]!] : [pins[i + 1]!]));
      }
    }
    return full.length >= 2 ? full : [routeEntry, routeExit];
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const result = validatePlace(draft);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    void (async () => {
      setSaving(true);
      try {
        if (draft.kind === 'destination') {
          if (editing) await updatePlace(editing.id, draft);
          else await addPlace(draft);
        } else {
          // Recompute geometry only when endpoints changed (or none stored yet).
          const endpointsUnchanged =
            existingEntry &&
            existingExit &&
            sameCoord(draft.entry, existingEntry) &&
            sameCoord(draft.exit, existingExit);
          const path =
            endpointsUnchanged && existingPath && existingPath.length >= 2
              ? existingPath
              : await resolvePath(draft.entry, draft.exit, draft.waypoints);
          const routeDraft: NewRouteInput = { ...draft, path };
          if (editing) await updateRoute(editing.id, routeDraft);
          else await addRoute(routeDraft);
        }
        onDone();
      } catch (err) {
        setErrors([err instanceof Error ? err.message : '保存失败。']);
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <p className="section-title">{editing ? '编辑地点' : '添加地点'}</p>

      <div className="row">
        <label className="row" style={{ width: 'auto' }}>
          <input
            type="radio"
            name="kind"
            checked={kind === 'destination'}
            onChange={() => setKind('destination')}
            style={{ width: 'auto' }}
          />
          目的地
        </label>
        <label className="row" style={{ width: 'auto' }}>
          <input
            type="radio"
            name="kind"
            checked={kind === 'road'}
            onChange={() => setKind('road')}
            style={{ width: 'auto' }}
          />
          风景道路
        </label>
      </div>

      <div>
        <label className="field-label">名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="搜索位置后自动填入，可修改"
        />
      </div>

      {kind === 'destination' ? (
        <LocationField
          label="位置"
          coord={coord}
          onResolved={(c, resolvedName) => {
            setCoord(c);
            applyResolvedName(resolvedName);
          }}
        />
      ) : (
        <>
          <LocationField
            label="起点"
            coord={entry}
            onResolved={(c, resolvedName) => {
              setEntry(c);
              applyResolvedName(resolvedName);
            }}
          />
          <LocationField label="终点" coord={exit} onResolved={(c) => setExit(c)} />
        </>
      )}

      <div>
        <label className="field-label">标签</label>
        <TagInput value={tags} suggestions={tagSuggestions} onChange={setTags} />
      </div>

      <div className="row">
        <label className="row" style={{ width: 'auto' }}>
          <input
            type="checkbox"
            checked={status === 'visited'}
            onChange={(e) => {
              const next = e.target.checked ? 'visited' : 'wishlist';
              setStatus(next);
              if (next !== 'visited') setRating(undefined);
            }}
            style={{ width: 'auto' }}
          />
          我去过这里
        </label>
      </div>

      <div>
        <label className="field-label">评分</label>
        <RatingInput value={rating} disabled={status !== 'visited'} onChange={setRating} />
      </div>

      <div>
        <label className="field-label">备注</label>
        <textarea value={notes} rows={2} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {errors.length > 0 && (
        <ul style={{ color: 'var(--danger)', margin: 0, paddingLeft: 18 }}>
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <div className="row">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? '保存中…' : editing ? '保存修改' : '添加地点'}
        </button>
        <button type="button" onClick={onDone} disabled={saving}>
          取消
        </button>
      </div>
    </form>
  );
}

function sameCoord(a: BD09, b: BD09): boolean {
  return Math.abs(a.lng - b.lng) < 1e-9 && Math.abs(a.lat - b.lat) < 1e-9;
}
