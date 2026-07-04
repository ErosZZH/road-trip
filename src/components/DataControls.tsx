import { useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { DataStore, downloadCatalog } from '../store/DataStore';

const store = new DataStore();

/** Export / import controls for the catalog JSON (spec: data-store). */
export function DataControls() {
  const replaceAll = useAppStore((s) => s.replaceAll);
  const mergeIn = useAppStore((s) => s.mergeIn);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = async (): Promise<void> => {
    try {
      const json = await store.export();
      downloadCatalog(json);
    } catch (err) {
      setMessage(`导出失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleFile = async (file: File, mode: 'replace' | 'merge'): Promise<void> => {
    const text = await file.text();
    const result = store.parseImport(text);
    if (!result.ok || !result.data) {
      setMessage(`导入失败：${result.error}`);
      return;
    }
    try {
      if (mode === 'replace') {
        await replaceAll(result.data);
      } else {
        await mergeIn(result.data);
      }
      setMessage(`已导入 ${result.data.places.length} 个地点、${result.data.routes.length} 条道路。`);
    } catch (err) {
      setMessage(`导入失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  return (
    <div className="card stack">
      <p className="section-title">数据</p>
      <div className="row">
        <button type="button" onClick={() => void handleExport()}>
          导出 JSON
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          导入 JSON
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const mode = window.confirm('替换全部数据？（取消 = 合并）') ? 'replace' : 'merge';
            void handleFile(file, mode);
          }
          e.target.value = '';
        }}
      />
      {message && <p className="muted">{message}</p>}
    </div>
  );
}
