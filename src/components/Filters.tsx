import { useAppStore, selectAllTags } from '../store/appStore';

/** Tag + status filters that drive which places show on the map and list. */
export function Filters() {
  const allTags = useAppStore(selectAllTags);
  const filterTags = useAppStore((s) => s.filterTags);
  const filterStatus = useAppStore((s) => s.filterStatus);
  const setFilterTags = useAppStore((s) => s.setFilterTags);
  const setFilterStatus = useAppStore((s) => s.setFilterStatus);

  const toggleTag = (tag: string): void => {
    setFilterTags(
      filterTags.includes(tag) ? filterTags.filter((t) => t !== tag) : [...filterTags, tag],
    );
  };

  return (
    <div className="card stack">
      <p className="section-title">筛选</p>

      <div className="row">
        {(['all', 'visited', 'wishlist'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={filterStatus === s ? 'primary' : ''}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'all' ? '全部' : s === 'visited' ? '去过' : '想去'}
          </button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              className="tag-chip"
              onClick={() => toggleTag(t)}
              style={{
                cursor: 'pointer',
                outline: filterTags.includes(t) ? '2px solid var(--accent)' : 'none',
              }}
            >
              {t}
            </button>
          ))}
          {filterTags.length > 0 && (
            <button type="button" className="muted" onClick={() => setFilterTags([])}>
              清除标签
            </button>
          )}
        </div>
      )}
    </div>
  );
}
