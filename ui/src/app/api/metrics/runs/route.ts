import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function loadJsonl(filePath: string): any[] {
  const data: any[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      try { data.push(JSON.parse(line)); } catch {}
    }
  } catch {}
  return data;
}

export async function GET() {
  try {
    const logsDir = path.resolve(process.cwd(), '..', 'logs');
    if (!fs.existsSync(logsDir)) return NextResponse.json({ runs: [] });
    const runs: any[] = [];
    for (const entry of fs.readdirSync(logsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const runDir = path.join(logsDir, entry.name);
      const metrics = path.join(runDir, 'metrics.jsonl');
      if (!fs.existsSync(metrics)) continue;
      const arr = loadJsonl(metrics);
      const start = arr.find(r => r?.event === 'start') || {};
      runs.push({
        name: entry.name,
        path: metrics,
        start_time: start.timestamp || null,
        config_name: start.config_name || null,
        process_type: start.process_type || null,
      });
    }
    runs.sort((a, b) => String(b.start_time).localeCompare(String(a.start_time)));
    return NextResponse.json({ runs });
  } catch (e) {
    return NextResponse.json({ runs: [] });
  }
}


