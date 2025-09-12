import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDatasetsRoot } from '@/server/settings';
import { captionStatus } from '../../captions/util';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetName, identifier } = body as { datasetName: string; identifier: string };
    if (!datasetName || !identifier) return NextResponse.json({ error: 'datasetName and identifier required' }, { status: 400 });

    const datasetsPath = await getDatasetsRoot();
    const datasetFolder = path.join(datasetsPath, datasetName);
    if (!fs.existsSync(datasetFolder)) return NextResponse.json({ error: 'dataset not found' }, { status: 404 });

    const { total, captioned } = captionStatus(datasetFolder);
    if (total === 0) return NextResponse.json({ error: 'no images found' }, { status: 400 });

    const manifestPath = path.join(datasetFolder, '_dataset.json');
    const manifest = {
      identifier,
      datasetName,
      folderPath: datasetFolder,
      isLocked: true,
      totalImages: total,
      captionedImages: captioned,
      lockedAt: new Date().toISOString(),
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    return NextResponse.json({ ok: true, manifest });
  } catch (e) {
    console.error('lock dataset error', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}


