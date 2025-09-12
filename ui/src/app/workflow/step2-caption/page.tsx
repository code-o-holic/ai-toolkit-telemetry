'use client';
import { useEffect, useState } from 'react';
import { Button, Switch } from '@headlessui/react';
import { TextInput, SelectInput } from '@/components/formInputs';
import { apiClient } from '@/utils/api';
import { useSearchParams } from 'next/navigation';

export default function Step2Caption() {
  const [useAI, setUseAI] = useState(true);
  const [prompt, setPrompt] = useState('Describe the image succinctly for training.');
  const [provider, setProvider] = useState('lmstudio');
  const [model, setModel] = useState('llava');
  const [status, setStatus] = useState<'idle'|'running'|'completed'|'error'>('idle');
  const [progress, setProgress] = useState<{progress:number,total:number}>({progress:0,total:0});
  const params = useSearchParams();
  const dataset = (params.get('dataset') || (typeof window !== 'undefined' ? localStorage.getItem('workflowDataset') || '' : '')) as string;

  useEffect(() => {
    apiClient.get('/api/settings').then(r => {
      if (r.data?.CAPTION_PROVIDER) setProvider(r.data.CAPTION_PROVIDER);
      if (r.data?.CAPTION_MODEL) setModel(r.data.CAPTION_MODEL);
    });
  }, []);

  useEffect(() => {
    let interval: any;
    if (status === 'running') {
      interval = setInterval(async () => {
        try {
          const res = await apiClient.get(`/api/captions/status`, { params: { dataset } });
          const s = res.data?.status as 'running'|'completed'|'error'|'idle';
          if (s) setStatus(s);
          if (typeof res.data?.progress === 'number' && typeof res.data?.total === 'number') {
            setProgress({ progress: res.data.progress, total: res.data.total });
          }
        } catch (e) {}
      }, 1500);
    }
    return () => interval && clearInterval(interval);
  }, [status, dataset]);

  const start = async () => {
    if (!dataset) return;
    setStatus('running');
    try {
      await apiClient.post('/api/captions/start', { dataset, mode: useAI ? 'ai' : 'manual', provider, model, prompt });
      try { if (typeof window !== 'undefined') localStorage.setItem('workflowDataset', dataset); } catch {}
    } catch (e) {
      setStatus('error');
    }
  };

  const cancel = async () => {
    try { await apiClient.post('/api/captions/cancel', { dataset }); } catch {}
    setStatus('idle');
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">Step 2 – Captioning Setup</h1>
      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center gap-3">
          <span className="text-gray-300">AI-assisted captions</span>
          <Switch checked={useAI} onChange={setUseAI} className={`inline-flex h-6 w-11 items-center rounded-full ${useAI ? 'bg-green-600' : 'bg-gray-600'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${useAI ? 'translate-x-6' : 'translate-x-1'}`} />
          </Switch>
        </div>
        <TextInput label="Prompt" value={prompt} onChange={setPrompt} disabled={!useAI} />
        <div className="grid grid-cols-2 gap-4">
          <SelectInput label="Provider" value={provider} onChange={setProvider} options={[{ value: 'lmstudio', label: 'LM Studio' }, { value: 'ollama', label: 'Ollama' }, { value: 'openai', label: 'OpenAI' }, { value: 'anthropic', label: 'Anthropic' }]} />
          <TextInput label="Model" value={model} onChange={setModel} disabled={!useAI} />
        </div>
        <div className="flex gap-3">
          <Button className="bg-slate-600 text-gray-200 px-4 py-2 rounded-md" onClick={start}>Start Captioning</Button>
          <Button className="bg-gray-700 text-gray-200 px-4 py-2 rounded-md" onClick={cancel}>Cancel</Button>
        </div>
        <div className="text-sm text-gray-400">Status: {status} {progress.total>0 ? `(${progress.progress}/${progress.total})` : ''}</div>
      </div>
    </div>
  );
}


