import { hasBaiduAk } from '../config/home';
import { useAppStore, selectFilteredPlaces } from '../store/appStore';
import { useMap } from '../hooks/useMap';
import { PlaceDetail } from './PlaceDetail';

/**
 * Map region. Renders the live Baidu map with markers/polylines for filtered
 * places and the active trip route. Falls back to a clear notice when no AK is
 * configured (spec: map-visualization — "Baidu API key missing").
 */
export function MapArea() {
  if (!hasBaiduAk()) {
    return <AkRequiredNotice />;
  }
  return <LiveMap />;
}

function LiveMap() {
  const places = useAppStore(selectFilteredPlaces);
  const selectPlace = useAppStore((s) => s.selectPlace);
  const selectedId = useAppStore((s) => s.selectedPlaceId);
  const route = useAppStore((s) => s.activeRoute);
  const { containerRef, error } = useMap(places, selectPlace, route ?? null, selectedId);

  return (
    <div className="map-area">
      <div className="map-canvas" ref={containerRef} />
      {error && (
        <div className="map-notice" role="alert">
          <h2>地图加载出错</h2>
          <p>{error}</p>
        </div>
      )}
      <PlaceDetail />
    </div>
  );
}

function AkRequiredNotice() {
  return (
    <div className="map-area">
      <div className="map-notice" role="status">
        <h2>需要百度地图密钥</h2>
        <p>
          本工具基于百度地图渲染。请在{' '}
          <a href="https://lbsyun.baidu.com/" target="_blank" rel="noreferrer">
            lbsyun.baidu.com
          </a>{' '}
          创建浏览器端应用密钥（AK），在 <code>.env.local</code> 中设置{' '}
          <code>VITE_BAIDU_AK</code>，然后重启开发服务器。
        </p>
      </div>
    </div>
  );
}
