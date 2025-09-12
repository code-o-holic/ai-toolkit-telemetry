'use client';
import { useEffect, useMemo, useState } from 'react';
import { TopBar, MainContent } from '@/components/layout';
import { SelectInput, TextInput } from '@/components/formInputs';
import { Button } from '@headlessui/react';
import { apiClient } from '@/utils/api';

type RunInfo = { name: string; path: string; start_time?: string|null; config_name?: string|null; process_type?: string|null };

export default function MetricsPage() {
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [primary, setPrimary] = useState<string>('');
  const [overlays, setOverlays] = useState<string[]>([]);
  const [palette, setPalette] = useState<string>('Bold');
  const [reverse, setReverse] = useState<boolean>(false);
  const [auto, setAuto] = useState<boolean>(true);
  const [intervalMs, setIntervalMs] = useState<number>(5000);
  const [promptIndex, setPromptIndex] = useState<number>(0);
  const [data, setData] = useState<any[]>([]);
  const [overlayData, setOverlayData] = useState<Record<string, any[]>>({});

  useEffect(() => {
    apiClient.get('/api/metrics/runs').then(r => {
      setRuns(r.data?.runs || []);
      const qp = new URLSearchParams(window.location.search);
      const qRun = qp.get('run');
      const names = (r.data?.runs || []).map((x: RunInfo) => x.name);
      if (qRun && names.includes(qRun)) setPrimary(qRun);
      else if (names.length) setPrimary(names[0]);
    });
  }, []);

  useEffect(() => {
    let t: any;
    const fetchAll = async () => {
      if (!primary) return;
      const res = await apiClient.get('/api/metrics/read', { params: { run: primary } });
      setData(res.data?.data || []);
      const out: Record<string, any[]> = {};
      for (const ov of overlays) {
        const rr = await apiClient.get('/api/metrics/read', { params: { run: ov } });
        out[ov] = rr.data?.data || [];
      }
      setOverlayData(out);
    };
    fetchAll();
    if (auto) {
      t = setInterval(fetchAll, intervalMs);
    }
    return () => t && clearInterval(t);
  }, [primary, overlays, auto, intervalMs]);

  const steps = useMemo(() => (data || []).filter((e: any) => e.event === 'step'), [data]);

  return (
    <>
      <TopBar>
        <div>
          <h1 className="text-lg">Metrics</h1>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 pr-2">
          <label className="text-sm text-gray-300">Auto</label>
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
          <label className="text-sm text-gray-300 ml-3">Interval (ms)</label>
          <input type="number" className="w-24 bg-gray-800 px-2 py-1 rounded" value={intervalMs} onChange={e => setIntervalMs(parseInt(e.target.value||'0')||0)} />
        </div>
      </TopBar>
      <MainContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1 space-y-3">
            <div>
              <label className="text-sm text-gray-400">Primary run</label>
              <select className="w-full bg-gray-800 px-3 py-2 rounded" value={primary} onChange={e => setPrimary(e.target.value)}>
                {runs.map(r => <option key={r.name} value={r.name}>{r.name} ({r.config_name || 'Unknown'})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400">Overlay runs</label>
              <select multiple className="w-full bg-gray-800 px-3 py-2 rounded min-h-[120px]" value={overlays} onChange={e => setOverlays(Array.from(e.target.selectedOptions).map(o => o.value))}>
                {runs.filter(r => r.name !== primary).map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm text-gray-400">Palette</label>
                <select className="w-full bg-gray-800 px-2 py-2 rounded" value={palette} onChange={e => setPalette(e.target.value)}>
                  {['Bold','Vivid','Set1','Set3','D3','Dark24','Light24','Alphabet','Prism','Safe'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <label className="text-sm text-gray-300 mr-2">Reverse</label>
                <input type="checkbox" checked={reverse} onChange={e => setReverse(e.target.checked)} />
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h2 className="text-md mb-2">Training Loss</h2>
              <MetricLine data={steps} field="train_loss" overlays={overlayData} primaryName={primary} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="text-md mb-2">Learning Rate</h2>
                <MetricLine data={steps} field="lr" overlays={overlayData} primaryName={primary} />
              </div>
              <div>
                <h2 className="text-md mb-2">Grad Norm</h2>
                <MetricLine data={steps} field="grad_norm" overlays={overlayData} primaryName={primary} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="text-md mb-2">GPU Mem (GB)</h2>
                <MetricLine data={steps} field="gpu_mem_allocated" overlays={overlayData} primaryName={primary} />
              </div>
              <div>
                <h2 className="text-md mb-2">Samples/sec</h2>
                <MetricLine data={steps} field="samples_per_sec" overlays={overlayData} primaryName={primary} />
              </div>
            </div>
          </div>
        </div>
      </MainContent>
    </>
  );
}

function MetricLine({ data, field, overlays, primaryName }: { data: any[]; field: string; overlays: Record<string, any[]>; primaryName: string }) {
  const points = (data || []).filter(d => d && typeof d[field] !== 'undefined').map(d => ({ x: d.global_step || 0, y: d[field] }));
  return (
    <div className="w-full bg-gray-900 rounded p-2 border border-gray-800">
      <svg className="w-full h-48">
        <polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={toPolyline(points)} />
        {Object.entries(overlays).map(([name, arr], idx) => {
          const pts = (arr || []).filter(e => e.event === 'step' && typeof (e as any)[field] !== 'undefined').map(e => ({ x: e.global_step || 0, y: (e as any)[field] }));
          const color = overlayColor(idx);
          return <polyline key={name} fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" points={toPolyline(pts)} />
        })}
      </svg>
    </div>
  );
}

function toPolyline(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 8;
  const width = 800 - pad * 2;
  const height = 180 - pad * 2;
  const scaleX = (x: number) => (maxX === minX ? 0 : ((x - minX) / (maxX - minX)) * width) + pad;
  const scaleY = (y: number) => (maxY === minY ? height / 2 : height - ((y - minY) / (maxY - minY)) * height) + pad;
  return points.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ');
}

function overlayColor(i: number): string {
  const palette = ['#f87171','#fbbf24','#34d399','#22d3ee','#a78bfa','#f472b6','#fb923c','#93c5fd'];
  return palette[i % palette.length];
}


