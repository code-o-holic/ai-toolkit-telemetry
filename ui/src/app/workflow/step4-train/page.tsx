'use client';
import { Button } from '@headlessui/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';

export default function Step4Train() {
  const router = useRouter();
  const params = useSearchParams();
  const datasetIdentifier = params.get('dataset');
  const [resolved, setResolved] = useState<{ folderPath?: string; datasetName?: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!datasetIdentifier) return;
      try {
        const res = await apiClient.get('/api/datasets/byIdentifier', { params: { identifier: datasetIdentifier } });
        setResolved(res.data);
      } catch {}
    };
    load();
  }, [datasetIdentifier]);

  const createJob = () => {
    if (!datasetIdentifier) return;
    router.push(`/jobs/new?dataset=${encodeURIComponent(datasetIdentifier)}`);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">Step 4 – Configure & Train</h1>
      <p className="text-sm text-gray-300 mb-4">Open the training job creator prefilled with your dataset.</p>
      {resolved?.folderPath && (
        <div className="text-xs text-gray-400 mb-4">Resolved path: {resolved.folderPath}</div>
      )}
      <Button className="bg-green-700 text-white px-4 py-2 rounded-md" onClick={createJob} disabled={!datasetIdentifier}>Create Training Job</Button>
    </div>
  );
}


