import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDatasetsRoot } from '@/server/settings';
import { captionStatus } from '../util';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataset = searchParams.get('dataset');
    if (!dataset) return NextResponse.json({ error: 'dataset required' }, { status: 400 });
    const datasetsPath = await getDatasetsRoot();
    const datasetFolder = path.join(datasetsPath, dataset);
    const statePath = path.join(datasetFolder, '_caption_state.json');
    let state: any = { status: 'idle', progress: 0, total: 0 };
    if (fs.existsSync(statePath)) {
      try { state = JSON.parse(fs.readFileSync(statePath, 'utf-8')); } catch {}
    }
    const { total, captioned } = captionStatus(datasetFolder);
    state.total = total;
    state.progress = captioned;
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}


