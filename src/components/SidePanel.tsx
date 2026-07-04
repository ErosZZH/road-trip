import { useState } from 'react';
import { hasBaiduAk } from '../config/home';
import { useAppStore, selectFilteredPlaces } from '../store/appStore';
import { PlaceForm } from './PlaceForm';
import { PlaceList } from './PlaceList';
import { Filters } from './Filters';
import { TripPlanner } from './TripPlanner';
import { DataControls } from './DataControls';

/** Left panel: header, add-place form, filters, catalog list, trip planner, data I/O. */
export function SidePanel() {
  const [adding, setAdding] = useState(false);
  const filteredPlaces = useAppStore(selectFilteredPlaces);
  const totalPlaces = useAppStore((s) => s.places.length);

  return (
    <aside className="side-panel">
      <div>
        <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>自驾路线规划</h1>
        <p className="muted">皖南 · 浙北 · 自驾环线</p>
      </div>

      {!hasBaiduAk() && (
        <div className="card">
          <p className="section-title">设置</p>
          <p className="muted">
            请在 <code>.env.local</code> 中设置 <code>VITE_BAIDU_AK</code>，以启用地图与地址搜索。
          </p>
        </div>
      )}

      {adding ? (
        <PlaceForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="primary" onClick={() => setAdding(true)}>
          + 添加地点
        </button>
      )}

      <TripPlanner />

      <Filters />

      <div className="stack">
        <p className="section-title">
          地点（{filteredPlaces.length}
          {filteredPlaces.length !== totalPlaces ? ` / ${totalPlaces}` : ''}）
        </p>
        <PlaceList places={filteredPlaces} />
      </div>

      <DataControls />
    </aside>
  );
}
