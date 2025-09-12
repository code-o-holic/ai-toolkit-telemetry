'use client';
import { useEffect, useState } from 'react';
import { Button } from '@headlessui/react';
import { TextInput } from '@/components/formInputs';
import { openImagesModal } from '@/components/AddImagesModal';
import { apiClient } from '@/utils/api';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function Step1Upload() {
  const params = useSearchParams();
  const [datasetName, setDatasetName] = useState('');
  const [renamePattern, setRenamePattern] = useState('img_{000}');
  const [created, setCreated] = useState(false);

  // hydrate from query/localStorage so values persist across steps
  useEffect(() => {
    const dsFromQuery = params.get('dataset');
    const dsFromStorage = typeof window !== 'undefined' ? localStorage.getItem('workflowDataset') : null;
    const rpFromStorage = typeof window !== 'undefined' ? localStorage.getItem('workflowRenamePattern') : null;
    if (dsFromQuery) {
      setDatasetName(dsFromQuery);
      setCreated(true);
    } else if (dsFromStorage) {
      setDatasetName(dsFromStorage);
      setCreated(true);
    }
    if (rpFromStorage) setRenamePattern(rpFromStorage);
  }, [params]);

  const createAndUpload = async () => {
    if (!datasetName) return;
    await apiClient.post('/api/datasets/create', { name: datasetName });
    setCreated(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('workflowDataset', datasetName);
        localStorage.setItem('workflowRenamePattern', renamePattern);
      }
    } catch {}
    openImagesModal(datasetName, () => {}, { renamePattern });
  };

  const resetFields = () => {
    setDatasetName('');
    setRenamePattern('img_{000}');
    setCreated(false);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('workflowDataset');
        localStorage.removeItem('workflowRenamePattern');
      }
    } catch {}
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">Step 1 – Upload & Rename</h1>
      <div className="grid grid-cols-1 gap-4">
        <TextInput label="Dataset Name" value={datasetName} onChange={setDatasetName} />
        <TextInput label="Rename Pattern (preview only for now)" value={renamePattern} onChange={setRenamePattern} />
        <div className="flex gap-3 items-center">
          <Button className="bg-slate-600 text-gray-200 px-4 py-2 rounded-md" onClick={createAndUpload}>Create & Upload Files</Button>
          {created && (
            <Link href={`/workflow/step2-caption?dataset=${encodeURIComponent(datasetName)}`} className="bg-blue-700 text-white px-4 py-2 rounded-md">Next: Captioning</Link>
          )}
          <Button className="bg-gray-700 text-gray-200 px-4 py-2 rounded-md" onClick={resetFields}>Reset</Button>
        </div>
        <div className="text-sm text-gray-400">Examples: outfit_{'{'}000{'}'}, img_###, custom prefix/suffix. We will apply this on upload in a later step.</div>
      </div>
    </div>
  );
}


