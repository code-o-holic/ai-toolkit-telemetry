'use client';
import { useEffect, useMemo, useState } from 'react';
import { TopBar, MainContent } from '@/components/layout';
import { Button } from '@headlessui/react';
import { openSampleImage } from '@/components/SampleImageModal';
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
  const [useSmoothing, setUseSmoothing] = useState<boolean>(true);
  const [logLoss, setLogLoss] = useState<boolean>(true);
  const [logGrad, setLogGrad] = useState<boolean>(false);
  const [logGpu, setLogGpu] = useState<boolean>(false);
  const [logSpeed, setLogSpeed] = useState<boolean>(false);
  const [data, setData] = useState<any[]>([]);
  const [overlayData, setOverlayData] = useState<Record<string, any[]>>({});
  const [startMeta, setStartMeta] = useState<any | null>(null);

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
      const arr = res.data?.data || [];
      setData(arr);
      const start = arr.find((e: any) => e?.event === 'start') || null;
      setStartMeta(start);
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
              <div className="flex items-center gap-4 mb-2 text-xs">
                <label className="flex items-center gap-2"><input type="checkbox" checked={useSmoothing} onChange={e=>setUseSmoothing(e.target.checked)} /> EMA smoothing</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={logLoss} onChange={e=>setLogLoss(e.target.checked)} /> Log scale</label>
              </div>
              <MetricLine data={steps} field="train_loss" overlays={overlayData} primaryName={primary} useSmoothing={useSmoothing} logScale={logLoss} paletteName={palette} reverse={reverse} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="text-md mb-2">Learning Rate</h2>
                <MetricLine data={steps} field="lr" overlays={overlayData} primaryName={primary} useSmoothing={false} logScale={false} paletteName={palette} reverse={reverse} />
              </div>
              <div>
                <h2 className="text-md mb-2">Grad Norm</h2>
                <div className="flex items-center gap-4 mb-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={logGrad} onChange={e=>setLogGrad(e.target.checked)} /> Log scale</label></div>
                <MetricLine data={steps} field="grad_norm" overlays={overlayData} primaryName={primary} useSmoothing={false} logScale={logGrad} paletteName={palette} reverse={reverse} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="text-md mb-2">GPU Mem (GB)</h2>
                <div className="flex items-center gap-4 mb-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={logGpu} onChange={e=>setLogGpu(e.target.checked)} /> Log scale</label></div>
                <MetricLine data={steps} field="gpu_mem_allocated" overlays={overlayData} primaryName={primary} useSmoothing={false} logScale={logGpu} paletteName={palette} reverse={reverse} />
              </div>
              <div>
                <h2 className="text-md mb-2">Samples/sec</h2>
                <div className="flex items-center gap-4 mb-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={logSpeed} onChange={e=>setLogSpeed(e.target.checked)} /> Log scale</label></div>
                <MetricLine data={steps} field="samples_per_sec" overlays={overlayData} primaryName={primary} useSmoothing={false} logScale={logSpeed} paletteName={palette} reverse={reverse} />
              </div>
            </div>
            <SamplesTimeline data={data} startMeta={startMeta} promptIndex={promptIndex} setPromptIndex={setPromptIndex} title="Samples Timeline" />
          </div>
        </div>
      </MainContent>
    </>
  );
}

function ema(values: number[], alpha = 0.1): number[] {
  if (!values.length) return values;
  const out = [values[0]];
  for (let i=1;i<values.length;i++) out.push(alpha*values[i] + (1-alpha)*out[i-1]);
  return out;
}

function MetricLine({ data, field, overlays, primaryName, useSmoothing, logScale, paletteName, reverse }: { data: any[]; field: string; overlays: Record<string, any[]>; primaryName: string; useSmoothing: boolean; logScale: boolean; paletteName: string; reverse: boolean }) {
  const primaryPtsRaw = (data || []).filter(d => d && typeof d[field] !== 'undefined').map(d => ({ x: d.global_step || 0, y: d[field] }));
  const primaryPts = useSmoothing ? smoothPoints(primaryPtsRaw) : primaryPtsRaw;
  const colors = getPalette(paletteName, reverse);
  return (
    <div className="w-full bg-gray-900 rounded p-2 border border-gray-800">
      <svg className="w-full h-48">
        <polyline fill="none" stroke={colors[0]} strokeWidth="2" points={toPolyline(primaryPts, logScale)} />
        {Object.entries(overlays).map(([name, arr], idx) => {
          const ptsRaw = (arr || []).filter(e => e.event === 'step' && typeof (e as any)[field] !== 'undefined').map(e => ({ x: e.global_step || 0, y: (e as any)[field] }));
          const pts = useSmoothing ? smoothPoints(ptsRaw) : ptsRaw;
          const color = colors[(idx+1)%colors.length];
          return <polyline key={name} fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" points={toPolyline(pts, logScale)} />
        })}
      </svg>
    </div>
  );
}

function smoothPoints(points: { x:number;y:number }[]): { x:number;y:number }[] {
  const ys = points.map(p=>p.y as number);
  const sm = ema(ys, 0.1);
  return points.map((p,i)=>({ x:p.x, y: sm[i] }));
}

function toPolyline(points: { x: number; y: number }[], logScale=false): string {
  if (!points.length) return '';
  const xs = points.map(p => p.x);
  const ys = points.map(p => (typeof p.y === 'number' ? p.y : 0));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (logScale) {
    const safe = ys.map(v => (v<=0? Number.MIN_VALUE : v));
    minY = Math.min(...safe);
    maxY = Math.max(...safe);
  }
  const pad = 8;
  const width = 800 - pad * 2;
  const height = 180 - pad * 2;
  const scaleX = (x: number) => (maxX === minX ? 0 : ((x - minX) / (maxX - minX)) * width) + pad;
  const scaleY = (y: number) => {
    if (logScale) {
      const vy = y<=0? Number.MIN_VALUE : y;
      const minL = Math.log(minY);
      const maxL = Math.log(maxY);
      const yL = Math.log(vy);
      const t = maxL===minL ? 0.5 : (yL - minL) / (maxL - minL);
      return height - t*height + pad;
    }
    return (maxY === minY ? height / 2 : height - ((y - minY) / (maxY - minY)) * height) + pad;
  };
  return points.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ');
}

function getPalette(name: string, reverse=false): string[] {
  const maps: Record<string,string[]> = {
    Bold: ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'],
    Vivid: ['#e6194B','#3cb44b','#ffe119','#0082c8','#f58231','#911eb4','#46f0f0','#f032e6','#d2f53c','#fabebe'],
    Set1: ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999'],
    Set3: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd'],
    D3: ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'],
    Dark24: ['#2a9d8f','#e76f51','#264653','#e9c46a','#f4a261','#a8dadc','#457b9d','#1d3557','#e71d36','#ff9f1c'],
    Light24: ['#a6cee3','#b2df8a','#fb9a99','#fdbf6f','#cab2d6','#ffff99','#1f78b4','#33a02c','#e31a1c','#ff7f00'],
    Alphabet: ['#f94144','#f3722c','#f8961e','#f9844a','#f9c74f','#90be6d','#43aa8b','#577590','#277da1','#4d908e'],
    Prism: ['#264653','#2a9d8f','#e9c46a','#f4a261','#e76f51','#a8dadc','#457b9d','#1d3557'],
    Safe: ['#88CCEE','#DDCC77','#CC6677','#117733','#332288','#AA4499','#44AA99','#999933','#882255','#661100'],
  };
  const arr = maps[name] || maps['Bold'];
  return reverse ? [...arr].reverse() : arr;
}

function SamplesTimeline({ data, startMeta, promptIndex, setPromptIndex, title }: { data: any[]; startMeta: any; promptIndex: number; setPromptIndex: (i:number)=>void; title: string }) {
  const sampleEvents = (data||[]).filter((e:any)=>e?.event==='sample');
  const prompts: string[] = (startMeta?.sample_prompts || []) as string[];
  const samplesDir = startMeta?.samples_dir as string | undefined;
  const mapping = useMemo(()=>buildStepToPathFromEventsAndDir(sampleEvents, samplesDir, promptIndex), [JSON.stringify(sampleEvents), samplesDir, promptIndex]);
  const orderedSteps = Object.keys(mapping).map(k=>parseInt(k)).sort((a,b)=>a-b);
  const thumbs: string[] = orderedSteps.map(step => mapping[step]);
  const cols = 6;
  return (
    <div>
      <h2 className="text-md mb-2">{title}</h2>
      <div className="flex items-center gap-3 mb-3 text-sm">
        <label>Prompt</label>
        <select className="bg-gray-800 px-2 py-1 rounded" value={promptIndex} onChange={e=>setPromptIndex(parseInt(e.target.value))}>
          {(prompts?.length?prompts:[`Prompt 0`]).map((p,i)=>(<option key={i} value={i}>{prompts?.[i]||`Prompt ${i}`}</option>))}
        </select>
      </div>
      {thumbs.length>0 ? (
        <div className="grid grid-cols-6 gap-2">
          {thumbs.map((p, i) => (
            <div key={i} className="bg-gray-900 rounded border border-gray-800 cursor-pointer" onClick={() => openSampleImage({ imgPath: p, numSamples: prompts?.length || 1, sampleImages: thumbs })}>
              <img src={`/api/files/${encodeURIComponent(p)}`} className="w-full h-28 object-cover" />
              <div className="text-[10px] p-1 text-gray-300 truncate">{p.split('/').pop()}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400">No sample images recorded yet for this prompt.</div>
      )}
    </div>
  );
}

function buildStepToPathFromEventsAndDir(sampleEvents: any[], sdir?: string, prompt_index=0): Record<number,string> {
  const mapping: Record<number,string> = {};
  for (const ev of sampleEvents) {
    const step = ev?.global_step;
    for (const item of (ev?.items || [])) {
      if (item?.prompt_index === prompt_index && item?.path) mapping[step] = item.path;
    }
  }
  return mapping;
}


