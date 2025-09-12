import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDatasetsRoot } from '@/server/settings';
import { captionStatus, findImagesRecursively } from '../util';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dataset, mode, provider, model, prompt } = body as { dataset: string; mode: 'ai'|'manual'; provider?: string; model?: string; prompt?: string };
    if (!dataset) return NextResponse.json({ error: 'dataset required' }, { status: 400 });

    const datasetsPath = await getDatasetsRoot();
    const datasetFolder = path.join(datasetsPath, dataset);
    if (!fs.existsSync(datasetFolder)) return NextResponse.json({ error: 'dataset not found' }, { status: 404 });

    const { total, captioned } = captionStatus(datasetFolder);
    const state = {
      status: mode === 'ai' ? 'running' : 'idle',
      progress: captioned,
      total,
      provider: provider || null,
      model: model || null,
      prompt: prompt || null,
      updatedAt: new Date().toISOString(),
    };
    const statePath = path.join(datasetFolder, '_caption_state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');

    // If manual mode, pre-create empty caption files next to every image
    if (mode === 'manual') {
      const images = findImagesRecursively(datasetFolder);
      for (const img of images) {
        const txt = img.replace(/\.[^/.]+$/, '') + '.txt';
        if (!fs.existsSync(txt)) {
          fs.writeFileSync(txt, '', 'utf-8');
        }
      }
    }

    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}


