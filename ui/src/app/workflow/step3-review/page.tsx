'use client';
import { useEffect, useState } from 'react';
import { Button } from '@headlessui/react';
import { useRouter, useSearchParams } from 'next/navigation';
import DatasetImageCard from '@/components/DatasetImageCard';
import { apiClient } from '@/utils/api';

export default function Step3Review() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const datasetName = (searchParams.get('dataset') || (typeof window !== 'undefined' ? localStorage.getItem('workflowDataset') || '' : '')) as string;
  const [identifier, setIdentifier] = useState('');
  const [lockError, setLockError] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!datasetName) return;
      const res = await apiClient.post('/api/datasets/listImages', { datasetName });
      const images = (res.data?.images || []).map((x: any) => x.img_path);
      setImages(images);
    };
    load();
  }, [datasetName]);

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-semibold mb-4">Step 3 – Review & Lock</h1>
      <div className="text-sm text-gray-400 mb-4">Dataset: {datasetName || '(not selected)'} </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map(img => (
          <DatasetImageCard key={img} imageUrl={img} alt="image" />
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <input className="bg-gray-800 text-gray-200 px-3 py-2 rounded-md w-72" placeholder="Dataset Identifier" value={identifier} onChange={e => setIdentifier(e.target.value)} />
        <Button className="bg-slate-600 text-gray-200 px-4 py-2 rounded-md disabled:opacity-50" disabled={isLocking || !identifier} onClick={async () => {
          setLockError(null);
          if (!datasetName || !identifier) {
            setLockError('Dataset and identifier are required');
            return;
          }
          setIsLocking(true);
          try {
            await apiClient.post('/api/datasets/lock', { datasetName, identifier });
            try {
              if (typeof window !== 'undefined') {
                localStorage.setItem('workflowDataset', datasetName);
                localStorage.setItem('workflowIdentifier', identifier);
              }
            } catch {}
            setLocked(true);
            setTimeout(() => router.push(`/workflow/step4-train?dataset=${encodeURIComponent(identifier)}`), 400);
          } catch (e: any) {
            const data = e?.response?.data;
            setLockError(data?.error || 'Failed to lock');
          } finally {
            setIsLocking(false);
          }
        }}>Lock Dataset</Button>
        {lockError && <div className="text-sm text-red-400">{lockError}</div>}
        {locked && <div className="text-sm text-green-400">Locked ✓ Redirecting…</div>}
      </div>
    </div>
  );
}


