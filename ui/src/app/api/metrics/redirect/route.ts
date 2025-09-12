import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const base = process.env.STREAMLIT_URL || 'http://localhost:8501';
    if (!jobId) return NextResponse.redirect(base);

    // We’ll try to map job name to a run directory inside ./logs/<job.name>
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.redirect(base);

    // The streamlit app scans ./logs/; most convenient is to pass the run name via query so the app can auto-select.
    // We assume run dir = job.name, metrics at ./logs/<job.name>/metrics.jsonl created by trainer with telemetry.
    const runName = encodeURIComponent(job.name);
    const streamlitUrl = `${base}/?run=${runName}`;
    return NextResponse.redirect(streamlitUrl);
  } catch (e) {
    const base = process.env.STREAMLIT_URL || 'http://localhost:8501';
    return NextResponse.redirect(base);
  }
}


