import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDatasetsRoot, getTrainingFolder, getDataRoot } from '@/server/settings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dirParam = searchParams.get('dir');
    if (!dirParam) return NextResponse.json({ files: [] });
    const dir = decodeURIComponent(dirParam);

    const datasetRoot = await getDatasetsRoot();
    const trainingRoot = await getTrainingFolder();
    const dataRoot = await getDataRoot();
    const allowed = [datasetRoot, trainingRoot, dataRoot];
    const isAllowed = allowed.some(d => dir.startsWith(d)) && !dir.includes('..');
    if (!isAllowed) return NextResponse.json({ files: [] }, { status: 403 });

    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return NextResponse.json({ files: [] });
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => path.join(dir, e.name)).sort();
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json({ files: [] }, { status: 500 });
  }
}


