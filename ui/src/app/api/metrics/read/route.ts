import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const run = searchParams.get('run');
    if (!run) return NextResponse.json({ data: [] });
    const logsDir = path.resolve(process.cwd(), '..', 'logs');
    const filePath = path.join(logsDir, run, 'metrics.jsonl');
    if (!fs.existsSync(filePath)) return NextResponse.json({ data: [] });
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const data: any[] = [];
    for (const line of lines) {
      try { data.push(JSON.parse(line)); } catch {}
    }
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ data: [] });
  }
}


