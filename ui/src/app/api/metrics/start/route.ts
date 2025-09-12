import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const STATE_FILE = path.resolve(process.cwd(), '.streamlit_state.json');

async function isUp(url: string, timeoutMs = 800) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}

function readState(): { pid?: number; url?: string } {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {} as any;
  }
}

function writeState(state: { pid?: number; url?: string }) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8'); } catch {}
}

export async function GET(request: NextRequest) {
  const base = process.env.STREAMLIT_URL || 'http://localhost:8501';
  const running = await isUp(base);
  if (running) return NextResponse.json({ ok: true, url: base, running: true, pid: readState().pid || null });

  // Attempt to start
  const scriptPath = path.resolve(process.cwd(), '..', 'dashboard.py');
  const port = process.env.STREAMLIT_PORT || '8501';

  // Prefer python -m streamlit, fallback to streamlit
  let child = spawn('python', ['-m', 'streamlit', 'run', scriptPath, '--server.port', port, '--server.address', '0.0.0.0'], {
    cwd: path.resolve(process.cwd(), '..'),
    detached: true,
    stdio: 'ignore',
    shell: false,
  });
  let pid = child.pid;
  if (!pid) {
    child = spawn('streamlit', ['run', scriptPath, '--server.port', port, '--server.address', '0.0.0.0'], {
      cwd: path.resolve(process.cwd(), '..'),
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    pid = child.pid;
  }
  try { child.unref(); } catch {}
  if (pid) writeState({ pid, url: base });

  // Return quickly; caller may retry open shortly
  return NextResponse.json({ ok: true, url: base, running: false, pid: pid || null });
}


