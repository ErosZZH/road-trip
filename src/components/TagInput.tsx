import { useMemo, useState } from 'react';

interface TagInputProps {
  value: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Tag entry with autocomplete from existing catalog tags (spec: place-catalog
 * "Reuse existing tags"). Type and press Enter/comma to add; click × to remove.
 */
export function TagInput({ value, suggestions, onChange }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && !value.includes(s))
      .slice(0, 6);
  }, [draft, suggestions, value]);

  const addTag = (tag: string): void => {
    const t = tag.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };

  const removeTag = (tag: string): void => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {value.map((t) => (
          <span key={t} className="tag-chip">
            {t}{' '}
            <button
              type="button"
              aria-label={`移除 ${t}`}
              onClick={() => removeTag(t)}
              style={{ border: 'none', padding: 0, background: 'none', color: 'inherit' }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        placeholder="输入标签（例如：漂流）后按回车"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            removeTag(value[value.length - 1]!);
          }
        }}
      />
      {matches.length > 0 && (
        <div className="tag-suggestions">
          {matches.map((m) => (
            <button
              type="button"
              key={m}
              className="tag-chip"
              onClick={() => addTag(m)}
              style={{ cursor: 'pointer' }}
            >
              + {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
