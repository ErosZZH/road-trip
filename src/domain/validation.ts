import type { BD09, CatalogEntity, PlaceStatus, Rating, TagConstraint } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ok: ValidationResult = { valid: true, errors: [] };

export function isValidRating(value: unknown): value is Rating {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isValidCoord(coord: unknown): coord is BD09 {
  if (typeof coord !== 'object' || coord === null) return false;
  const c = coord as Record<string, unknown>;
  return (
    typeof c.lng === 'number' &&
    typeof c.lat === 'number' &&
    Number.isFinite(c.lng) &&
    Number.isFinite(c.lat) &&
    c.lng >= -180 &&
    c.lng <= 180 &&
    c.lat >= -90 &&
    c.lat <= 90
  );
}

/**
 * Validate a place or route before it is stored.
 * Rules (from specs/place-catalog):
 *  - name is required
 *  - a rating may only exist when status === 'visited', and must be 1..5
 *  - a destination requires a valid coord
 *  - a route requires both a valid entry and exit
 */
export function validatePlace(place: Partial<CatalogEntity>): ValidationResult {
  const errors: string[] = [];

  if (!place.name || place.name.trim().length === 0) {
    errors.push('名称为必填项。');
  }

  if (place.status !== 'visited' && place.status !== 'wishlist') {
    errors.push('状态必须为“去过”或“想去”。');
  }

  if (place.rating !== undefined) {
    if (place.status !== 'visited') {
      errors.push('仅“去过”的地点可以评分。');
    } else if (!isValidRating(place.rating)) {
      errors.push('评分必须是 1 到 5 的整数。');
    }
  }

  if (place.kind === 'destination') {
    if (!isValidCoord(place.coord)) {
      errors.push('目的地需要有效的坐标。');
    }
  } else if (place.kind === 'road') {
    if (!isValidCoord(place.entry)) {
      errors.push('道路需要有效的起点。');
    }
    if (!isValidCoord(place.exit)) {
      errors.push('道路需要有效的终点。');
    }
  } else {
    errors.push('地点类型必须为“目的地”或“道路”。');
  }

  return errors.length === 0 ? ok : { valid: false, errors };
}

/**
 * Normalize a rating for a given status: strip any rating when not visited,
 * and reject out-of-range values by returning the provided fallback.
 */
export function normalizeRating(
  status: PlaceStatus,
  rating: unknown,
  fallback?: Rating,
): Rating | undefined {
  if (status !== 'visited') return undefined;
  if (rating === undefined) return fallback;
  return isValidRating(rating) ? rating : fallback;
}

/** Check a selection of places/routes against a single tag constraint. */
export function constraintSatisfied(
  entities: CatalogEntity[],
  constraint: TagConstraint,
): boolean {
  if (constraint.type !== 'includesTag') return true;
  const count = entities.filter((p) => p.tags.includes(constraint.tag)).length;
  return count >= constraint.min;
}

/** Returns the constraints a selection fails to satisfy (empty = all satisfied). */
export function unsatisfiedConstraints(
  entities: CatalogEntity[],
  constraints: TagConstraint[],
): TagConstraint[] {
  return constraints.filter((c) => !constraintSatisfied(entities, c));
}
