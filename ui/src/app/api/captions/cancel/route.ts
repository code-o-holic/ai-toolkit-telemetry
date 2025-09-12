import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDatasetsRoot } from '@/server/settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dataset } = body as { dataset: string };
    if (!dataset) return NextResponse.json({ error: 'dataset required' }, { status: 400 });
    const datasetsPath = await getDatasetsRoot();
    const datasetFolder = path.join(datasetsPath, dataset);
    const statePath = path.join(datasetFolder, '_caption_state.json');
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}


