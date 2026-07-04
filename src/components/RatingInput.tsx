import type { Rating } from '../types';

interface RatingInputProps {
  value: Rating | undefined;
  disabled?: boolean;
  onChange: (rating: Rating | undefined) => void;
}

const STARS: Rating[] = [1, 2, 3, 4, 5];

/** 1–5 star rating control. Disabled (and cleared) when the place isn't visited. */
export function RatingInput({ value, disabled, onChange }: RatingInputProps) {
  return (
    <div className="row" role="group" aria-label="评分">
      {STARS.map((star) => {
        const filled = value !== undefined && star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            aria-label={`${star} 星`}
            aria-pressed={filled}
            onClick={() => onChange(value === star ? undefined : star)}
            style={{
              border: 'none',
              background: 'none',
              padding: '0 2px',
              fontSize: 22,
              lineHeight: 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: filled ? '#f59e0b' : '#d1d5db',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {filled ? '★' : '☆'}
          </button>
        );
      })}
      {value !== undefined && !disabled && (
        <button
          type="button"
          className="muted"
          onClick={() => onChange(undefined)}
          style={{ border: 'none', background: 'none' }}
        >
          清除
        </button>
      )}
    </div>
  );
}
