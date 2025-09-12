import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { defaultTrainFolder, defaultDatasetsFolder } from '@/paths';
import { flushCache } from '@/server/settings';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const settings = await prisma.settings.findMany();
    const settingsObject = settings.reduce((acc: any, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
    // if TRAINING_FOLDER is not set, use default
    if (!settingsObject.TRAINING_FOLDER || settingsObject.TRAINING_FOLDER === '') {
      settingsObject.TRAINING_FOLDER = defaultTrainFolder;
    }
    // if DATASETS_FOLDER is not set, use default
    if (!settingsObject.DATASETS_FOLDER || settingsObject.DATASETS_FOLDER === '') {
      settingsObject.DATASETS_FOLDER = defaultDatasetsFolder;
    }
    return NextResponse.json(settingsObject);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { HF_TOKEN, TRAINING_FOLDER, DATASETS_FOLDER, CAPTION_PROVIDER, CAPTION_BASE_URL, CAPTION_API_KEY, CAPTION_MODEL } = body as any;

    // Upsert both settings
    const ops: any[] = [
      prisma.settings.upsert({
        where: { key: 'HF_TOKEN' },
        update: { value: HF_TOKEN },
        create: { key: 'HF_TOKEN', value: HF_TOKEN },
      }),
      prisma.settings.upsert({
        where: { key: 'TRAINING_FOLDER' },
        update: { value: TRAINING_FOLDER },
        create: { key: 'TRAINING_FOLDER', value: TRAINING_FOLDER },
      }),
      prisma.settings.upsert({
        where: { key: 'DATASETS_FOLDER' },
        update: { value: DATASETS_FOLDER },
        create: { key: 'DATASETS_FOLDER', value: DATASETS_FOLDER },
      }),
    ];
    if (typeof CAPTION_PROVIDER !== 'undefined') {
      ops.push(prisma.settings.upsert({ where: { key: 'CAPTION_PROVIDER' }, update: { value: CAPTION_PROVIDER }, create: { key: 'CAPTION_PROVIDER', value: CAPTION_PROVIDER } }));
    }
    if (typeof CAPTION_BASE_URL !== 'undefined') {
      ops.push(prisma.settings.upsert({ where: { key: 'CAPTION_BASE_URL' }, update: { value: CAPTION_BASE_URL }, create: { key: 'CAPTION_BASE_URL', value: CAPTION_BASE_URL } }));
    }
    if (typeof CAPTION_API_KEY !== 'undefined') {
      ops.push(prisma.settings.upsert({ where: { key: 'CAPTION_API_KEY' }, update: { value: CAPTION_API_KEY }, create: { key: 'CAPTION_API_KEY', value: CAPTION_API_KEY } }));
    }
    if (typeof CAPTION_MODEL !== 'undefined') {
      ops.push(prisma.settings.upsert({ where: { key: 'CAPTION_MODEL' }, update: { value: CAPTION_MODEL }, create: { key: 'CAPTION_MODEL', value: CAPTION_MODEL } }));
    }

    await Promise.all(ops);

    flushCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
