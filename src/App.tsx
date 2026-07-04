import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MapArea } from './components/MapArea';
import { SidePanel } from './components/SidePanel';
import { useAppStore } from './store/appStore';

/**
 * Top-level app shell: a full-viewport two-column layout with a scrollable
 * side panel (catalog + trip planner) on the left and the map on the right.
 */
export function App() {
  const init = useAppStore((s) => s.init);
  const loaded = useAppStore((s) => s.loaded);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <ErrorBoundary>
      <div className="app-shell">
        {loaded ? <SidePanel /> : <aside className="side-panel">加载中…</aside>}
        <MapArea />
      </div>
    </ErrorBoundary>
  );
}
