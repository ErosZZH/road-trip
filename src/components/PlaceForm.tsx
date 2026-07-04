import { useMemo, useState } from 'react';
import type { BD09, Place, PlaceKind, PlaceStatus, Rating } from '../types';
import { validatePlace, normalizeRating } from '../domain/validation';
import { useAppStore, selectAllTags, type NewPlaceInput } from '../store/appStore';
import { TagInput } from './TagInput';
import { RatingInput } from './RatingInput';
import { LocationField } from './LocationField';

interface PlaceFormProps {
  /** When provided, the form edits this place; otherwise it adds a new one. */
  editing?: Place;
  onDone: () => void;
}

/**
 * Add/edit a place. Supports kind = destination (single location) or road
 * (entry + exit). Enforces validation before persisting via the store.
 */
export function PlaceForm({ editing, onDone }: PlaceFormProps) {
  const addPlace = useAppStore((s) => s.addPlace);
  const updatePlace = useAppStore((s) => s.updatePlace);
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

  // Waypoints aren't edited via this form; preserve any existing ones so
  // editing a road (e.g. renaming) doesn't strip its real path geometry.
  const existingWaypoints = editing?.kind === 'road' ? editing.waypoints : undefined;

  const draft = useMemo((): NewPlaceInput => {
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

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const result = validatePlace(draft);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    if (editing) {
      updatePlace(editing.id, draft);
    } else {
      addPlace(draft);
    }
    onDone();
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：宏村" />
      </div>

      {kind === 'destination' ? (
        <LocationField label="位置" coord={coord} onResolved={setCoord} />
      ) : (
        <>
          <LocationField label="起点" coord={entry} onResolved={setEntry} />
          <LocationField label="终点" coord={exit} onResolved={setExit} />
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
        <button type="submit" className="primary">
          {editing ? '保存修改' : '添加地点'}
        </button>
        <button type="button" onClick={onDone}>
          取消
        </button>
      </div>
    </form>
  );
}
