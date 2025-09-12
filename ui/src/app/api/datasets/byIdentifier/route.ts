import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDatasetsRoot } from '@/server/settings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('identifier');
    if (!identifier) return NextResponse.json({ error: 'identifier required' }, { status: 400 });
    const datasetsPath = await getDatasetsRoot();
    const entries = fs.readdirSync(datasetsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folder = path.join(datasetsPath, entry.name);
      const manifestPath = path.join(folder, '_dataset.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          if (manifest.identifier === identifier && manifest.isLocked) {
            return NextResponse.json({ folderPath: manifest.folderPath, datasetName: manifest.datasetName });
          }
        } catch {}
      }
    }
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}


