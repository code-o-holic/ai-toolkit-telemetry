// src/app/api/datasets/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getDatasetsRoot } from '@/server/settings';

export async function POST(request: NextRequest) {
  try {
    const datasetsPath = await getDatasetsRoot();
    if (!datasetsPath) {
      return NextResponse.json({ error: 'Datasets path not found' }, { status: 500 });
    }
    const formData = await request.formData();
    const files = formData.getAll('files');
    const datasetName = formData.get('datasetName') as string;
    const renamePattern = (formData.get('renamePattern') as string) || '';
    const conflictPolicy = (formData.get('conflictPolicy') as string) || 'skip';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Create upload directory if it doesn't exist
    const uploadDir = join(datasetsPath, datasetName);
    await mkdir(uploadDir, { recursive: true });

    const savedFiles: string[] = [];
    
    // Process files sequentially to avoid overwhelming the system
    let counter = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as any;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Build filename
      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const ext = originalName.includes('.') ? `.${originalName.split('.').pop()}` : '';
      let base = originalName.replace(new RegExp(`${ext}$`), '');

      let targetName = originalName;
      if (renamePattern) {
        // Support patterns like img_{000}, outfit_###, prefix/suffix around ###
        const padMatch = renamePattern.match(/(#+|\{0+,?\})/);
        const padLen = padMatch ? (padMatch[0].includes('#') ? padMatch[0].length : (padMatch[0].match(/0/g)?.length || 3)) : 3;
        const numberStr = String(counter + 1).padStart(padLen, '0');
        targetName = renamePattern
          .replace(/#+|\{0+,?\}/, numberStr)
          .replace(/[^a-zA-Z0-9._-]/g, '_');
        if (!targetName.endsWith(ext)) targetName = `${targetName}${ext}`;
      }

      let filePath = join(uploadDir, targetName);
      if (conflictPolicy === 'skip' && savedFiles.includes(targetName)) {
        counter++;
        continue;
      }
      await writeFile(filePath, buffer);
      savedFiles.push(targetName);
      counter++;
    }

    return NextResponse.json({
      message: 'Files uploaded successfully',
      files: savedFiles,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Error uploading files' }, { status: 500 });
  }
}

// Increase payload size limit (default is 4mb)
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};
