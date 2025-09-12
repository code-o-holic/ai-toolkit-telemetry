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
  const [trainingFolder, setTrainingFolder] = useState<string>('');

  useEffect(() => {
    apiClient.get('/api/metrics/runs').then(r => {
      setRuns(r.data?.runs || []);
      const qp = new URLSearchParams(window.location.search);
      const qRun = qp.get('run');
      const names = (r.data?.runs || []).map((x: RunInfo) => x.name);
      if (qRun && names.includes(qRun)) setPrimary(qRun);
      else if (names.length) setPrimary(names[0]);
    });
    // fetch settings for TRAINING_FOLDER to resolve samples dir fallback
    apiClient.get('/api/settings').then(r => {
      if (r.data?.TRAINING_FOLDER) setTrainingFolder(r.data.TRAINING_FOLDER);
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
            <SamplesTimeline data={data} startMeta={startMeta} runName={primary} trainingFolder={trainingFolder} promptIndex={promptIndex} setPromptIndex={setPromptIndex} title="Samples Timeline" />
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

  // Domains and interactions
  const pad = 36; // padding for axes
  const width = 800;
  const height = 220;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const xsAll = primaryPts.map(p=>p.x);
  const ysAll = primaryPts.map(p=>Number(p.y)||0);
  const minXAll = xsAll.length?Math.min(...xsAll):0;
  const maxXAll = xsAll.length?Math.max(...xsAll):1;
  let minYAll = ysAll.length?Math.min(...ysAll):0;
  let maxYAll = ysAll.length?Math.max(...ysAll):1;
  if (logScale) {
    const safe = ysAll.map(v=>v<=0? Number.MIN_VALUE : v);
    minYAll = safe.length?Math.min(...safe):Number.MIN_VALUE;
    maxYAll = safe.length?Math.max(...safe):1;
  }

  const [xDomain, setXDomain] = useState<[number, number]>([minXAll, maxXAll]);
  const [yDomain, setYDomain] = useState<[number, number]>([minYAll, maxYAll]);
  useEffect(()=>{ setXDomain([minXAll, maxXAll]); setYDomain([minYAll, maxYAll]); }, [minXAll,maxXAll,minYAll,maxYAll,logScale]);

  const scaleX = (x:number) => (xDomain[1]===xDomain[0]?0:((x - xDomain[0])/(xDomain[1]-xDomain[0]))*innerW)+pad;
  const invX = (px:number) => xDomain[0] + ((px-pad)/innerW)*(xDomain[1]-xDomain[0]);
  const scaleY = (y:number) => {
    if (logScale) {
      const vy = y<=0? Number.MIN_VALUE : y;
      const minL = Math.log(yDomain[0]);
      const maxL = Math.log(yDomain[1]);
      const yL = Math.log(vy);
      const t = maxL===minL ? 0.5 : (yL - minL) / (maxL - minL);
      return height - pad - t*innerH;
    }
    return height - pad - (yDomain[1]===yDomain[0]?0:((y - yDomain[0])/(yDomain[1]-yDomain[0]))*innerH);
  };

  const toPoints = (pts:{x:number;y:number}[]) => pts.map(p=>`${scaleX(p.x)},${scaleY(Number(p.y)||0)}`).join(' ');

  // Ticks
  const xTicks = niceTicks(xDomain[0], xDomain[1], 6);
  const yTicks = niceTicks(yDomain[0], yDomain[1], 5, logScale);

  // Hover & zoom/pan
  const [hover, setHover] = useState<{x:number;y:number;nearest?:{x:number;y:number}}|null>(null);
  const [drag, setDrag] = useState<{startX:number; lastX:number}|null>(null);
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY<0 ? 0.9 : 1.1;
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const cx = invX(mx);
    const [a,b] = xDomain;
    const na = cx + (a-cx)*factor;
    const nb = cx + (b-cx)*factor;
    if (nb-na > 1e-9) setXDomain([na, nb]);
  };
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const dataX = invX(mx);
    const nearest = nearestPoint(primaryPts, dataX);
    setHover({ x: mx, y: my, nearest });
    if (drag) {
      const dx = mx - drag.lastX;
      const dData = (dx/innerW)*(xDomain[1]-xDomain[0]);
      setXDomain([xDomain[0]-dData, xDomain[1]-dData]);
      setDrag({ startX: drag.startX, lastX: mx });
    }
  };
  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left; setDrag({ startX: mx, lastX: mx });
  };
  const onMouseUp = () => setDrag(null);
  const onMouseLeave = () => { setHover(null); setDrag(null); };

  return (
    <div className="w-full bg-gray-900 rounded p-2 border border-gray-800">
      <svg className="w-full h-56" viewBox={`0 0 ${width} ${height}`} onWheel={onWheel} onMouseMove={onMouseMove} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}>
        {/* Axes */}
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#374151" strokeWidth="1" />
        <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="#374151" strokeWidth="1" />
        {xTicks.map((t,i)=> (
          <g key={i}>
            <line x1={scaleX(t)} y1={height-pad} x2={scaleX(t)} y2={height-pad+4} stroke="#4b5563" />
            <text x={scaleX(t)} y={height-pad+14} fill="#9ca3af" fontSize="10" textAnchor="middle">{formatTick(t)}</text>
          </g>
        ))}
        {yTicks.map((t,i)=> (
          <g key={i}>
            <line x1={pad-4} y1={scaleY(t)} x2={pad} y2={scaleY(t)} stroke="#4b5563" />
            <text x={pad-6} y={scaleY(t)+3} fill="#9ca3af" fontSize="10" textAnchor="end">{formatTick(t)}</text>
            <line x1={pad} y1={scaleY(t)} x2={width-pad} y2={scaleY(t)} stroke="#111827" opacity="0.4" />
          </g>
        ))}

        {/* Series */}
        <polyline fill="none" stroke={colors[0]} strokeWidth="2" points={toPoints(primaryPts)} />
        {Object.entries(overlays).map(([name, arr], idx) => {
          const ptsRaw = (arr || []).filter(e => e.event === 'step' && typeof (e as any)[field] !== 'undefined').map(e => ({ x: e.global_step || 0, y: (e as any)[field] }));
          const pts = useSmoothing ? smoothPoints(ptsRaw) : ptsRaw;
          const color = colors[(idx+1)%colors.length];
          return <polyline key={name} fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" points={toPoints(pts)} />
        })}

        {/* Hover */}
        {hover?.nearest && (
          <g>
            <circle cx={scaleX(hover.nearest.x)} cy={scaleY(Number(hover.nearest.y)||0)} r={3} fill="#f59e0b" />
            <rect x={scaleX(hover.nearest.x)+6} y={scaleY(Number(hover.nearest.y)||0)-18} width="120" height="16" fill="#111827" stroke="#374151" />
            <text x={scaleX(hover.nearest.x)+10} y={scaleY(Number(hover.nearest.y)||0)-6} fill="#e5e7eb" fontSize="10">{`step ${formatTick(hover.nearest.x)}  y ${formatTick(Number(hover.nearest.y)||0)}`}</text>
          </g>
        )}
      </svg>
      <div className="text-[10px] text-gray-500 mt-1">Scroll to zoom X. Drag to pan.</div>
    </div>
  );
}

function smoothPoints(points: { x:number;y:number }[]): { x:number;y:number }[] {
  const ys = points.map(p=>p.y as number);
  const sm = ema(ys, 0.1);
  return points.map((p,i)=>({ x:p.x, y: sm[i] }));
}

function niceTicks(min:number, max:number, count:number, log=false): number[] {
  if (!isFinite(min) || !isFinite(max)) return [];
  if (min===max) return [min];
  if (log) {
    const minL = Math.log(min<=0? Number.MIN_VALUE : min);
    const maxL = Math.log(max<=0? 1 : max);
    const step = (maxL-minL)/Math.max(1,count-1);
    return Array.from({length:count},(_,i)=>Math.exp(minL + step*i));
  }
  const step = (max-min)/Math.max(1,count-1);
  return Array.from({length:count},(_,i)=>min + step*i);
}

function formatTick(v:number): string { 
  const a = Math.abs(v);
  if (a>=1000 || (a>0 && a<0.001)) return v.toExponential(2);
  if (a>=1) return v.toFixed(2);
  return v.toPrecision(2);
}

function nearestPoint(pts:{x:number;y:number}[], x:number): {x:number;y:number} | undefined {
  if (!pts.length) return undefined;
  let best = pts[0]; let bestD = Math.abs(pts[0].x - x);
  for (let i=1;i<pts.length;i++){ const d = Math.abs(pts[i].x - x); if (d<bestD){ best=pts[i]; bestD=d; } }
  return best;
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

function SamplesTimeline({ data, startMeta, runName, trainingFolder, promptIndex, setPromptIndex, title }: { data: any[]; startMeta: any; runName: string; trainingFolder: string; promptIndex: number; setPromptIndex: (i:number)=>void; title: string }) {
  const sampleEvents = (data||[]).filter((e:any)=>e?.event==='sample');
  const prompts: string[] = (startMeta?.sample_prompts || []) as string[];
  const samplesDir = (startMeta?.samples_dir as string | undefined) || (trainingFolder && runName ? `${trainingFolder.replace(/\\+$/,'')}/${runName}/samples` : undefined);
  const [fallbackFiles, setFallbackFiles] = useState<string[]>([] as string[]);
  useEffect(() => {
    // fallback scan when no event paths present
    const hasEventPaths = sampleEvents.some(ev => (ev?.items||[]).some((it:any)=>!!it?.path));
    if (!hasEventPaths && samplesDir) {
      apiClient.get('/api/files/list', { params: { dir: samplesDir } }).then(res => setFallbackFiles(res.data?.files||[])).catch(()=>setFallbackFiles([]));
    } else {
      setFallbackFiles([]);
    }
  }, [JSON.stringify(sampleEvents), samplesDir]);
  const mapping = useMemo(()=>buildStepToPathFromEventsAndDir(sampleEvents, samplesDir, promptIndex, fallbackFiles), [JSON.stringify(sampleEvents), samplesDir, promptIndex, JSON.stringify(fallbackFiles)]);
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

function buildStepToPathFromEventsAndDir(sampleEvents: any[], sdir?: string, prompt_index=0, fallbackFiles: string[] = []): Record<number,string> {
  const mapping: Record<number,string> = {};
  for (const ev of sampleEvents) {
    const step = ev?.global_step;
    for (const item of (ev?.items || [])) {
      if (item?.prompt_index === prompt_index && item?.path) mapping[step] = item.path;
    }
  }
  if (!Object.keys(mapping).length && sdir && fallbackFiles.length) {
    try {
      const re = /__([0-9]{1,9})_([0-9]+)\.(jpg|jpeg|png|webp)$/i;
      for (const p of fallbackFiles) {
        const fname = p.split(/\\\//).pop() as string;
        const m = fname.match(re);
        if (!m) continue;
        const stepVal = parseInt(m[1]);
        const idxVal = parseInt(m[2]);
        if (idxVal === prompt_index) mapping[stepVal] = p;
      }
    } catch {}
  }
  return mapping;
}


