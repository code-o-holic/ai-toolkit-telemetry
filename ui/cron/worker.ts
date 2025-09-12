import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

class CronWorker {
  interval: number;
  is_running: boolean;
  intervalId: NodeJS.Timeout;
  prisma: PrismaClient;
  constructor() {
    this.interval = 1000; // Default interval of 1 second
    this.is_running = false;
    this.intervalId = setInterval(() => {
      this.run();
    }, this.interval);
    this.prisma = new PrismaClient();
  }
  async run() {
    if (this.is_running) {
      return;
    }
    this.is_running = true;
    try {
      // Loop logic here
      await this.loop();
    } catch (error) {
      console.error('Error in cron worker loop:', error);
    }
    this.is_running = false;
  }

  async loop() {
    // Scan datasets for caption state files and process one at a time
    const datasetsPath = await this.getDatasetsRootLocal();
    const dirs = fs.readdirSync(datasetsPath, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const folder = path.join(datasetsPath, dir.name);
      const statePath = path.join(folder, '_caption_state.json');
      if (!fs.existsSync(statePath)) continue;
      let state: any;
      try { state = JSON.parse(fs.readFileSync(statePath, 'utf-8')); } catch { continue; }
      if (state.status !== 'running') continue;

      // Find next image without caption
      const next = this.findNextUncaptioned(folder);
      if (!next) {
        state.status = 'completed';
        state.updatedAt = new Date().toISOString();
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
        continue;
      }

      try {
        const caption = await this.generateCaption(next, state);
        const txtPath = next.replace(/\.[^/.]+$/, '') + '.txt';
        fs.writeFileSync(txtPath, (caption || '').trim(), 'utf-8');
      } catch (e) {
        // swallow and move on; could log errors per file
      }

      // Update progress
      const { total, captioned } = this.captionStatus(folder);
      state.total = total;
      state.progress = captioned;
      state.updatedAt = new Date().toISOString();
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
      break; // process one item per tick
    }
  }

  captionStatus(datasetFolder: string): { total: number; captioned: number } {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    let total = 0;
    let captioned = 0;
    const walk = (dir: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item.startsWith('.')) continue;
        if (item === '_controls') continue;
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          walk(itemPath);
        } else {
          const ext = path.extname(itemPath).toLowerCase();
          if (imageExtensions.includes(ext)) {
            total++;
            const captionPath = itemPath.replace(/\.[^/.]+$/, '') + '.txt';
            if (fs.existsSync(captionPath) && fs.readFileSync(captionPath, 'utf-8').trim().length > 0) captioned++;
          }
        }
      }
    };
    walk(datasetFolder);
    return { total, captioned };
  }

  findNextUncaptioned(datasetFolder: string): string | null {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    let candidate: string | null = null;
    const walk = (dir: string) => {
      if (candidate) return;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          if (item.startsWith('.')) continue;
          if (item === '_controls') continue;
          walk(itemPath);
          if (candidate) return;
        } else {
          const ext = path.extname(itemPath).toLowerCase();
          if (!imageExtensions.includes(ext)) continue;
          const captionPath = itemPath.replace(/\.[^/.]+$/, '') + '.txt';
          if (!fs.existsSync(captionPath) || fs.readFileSync(captionPath, 'utf-8').trim().length === 0) {
            candidate = itemPath;
            return;
          }
        }
      }
    };
    walk(datasetFolder);
    return candidate;
  }

  async generateCaption(imagePath: string, state: any): Promise<string> {
    const provider = state.provider || '';
    const baseUrl = state.baseUrl || process.env.CAPTION_BASE_URL || 'http://localhost:11434';
    const model = state.model || 'llava';
    const prompt = state.prompt || 'Describe the image.';
    const apiKey = process.env.CAPTION_API_KEY || '';

    const imageB64 = fs.readFileSync(imagePath).toString('base64');
    // Provider-specific minimal implementations
    if (provider === 'ollama') {
      const res = await axios.post(`${baseUrl}/api/generate`, {
        model,
        prompt: `${prompt}`,
        images: [imageB64],
        stream: false,
      }, { timeout: 120000 });
      return res.data?.response || '';
    }
    if (provider === 'lmstudio') {
      const res = await axios.post(`${baseUrl}/v1/chat/completions`, {
        model,
        messages: [
          { role: 'system', content: 'You describe images succinctly for dataset captions.' },
          { role: 'user', content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_data: imageB64 },
          ]},
        ],
      }, { timeout: 120000 });
      return res.data?.choices?.[0]?.message?.content || '';
    }
    // Default: write empty to avoid blocking
    return '';
  }

  async getDatasetsRootLocal(): Promise<string> {
    try {
      const row = await this.prisma.settings.findFirst({ where: { key: 'DATASETS_FOLDER' } });
      if (row?.value && row.value !== '') return row.value;
    } catch {}
    // fallback to repo datasets folder: ui/../datasets
    return path.resolve(process.cwd(), '..', 'datasets');
  }
}

// it automatically starts the loop
const cronWorker = new CronWorker();
console.log('Cron worker started with interval:', cronWorker.interval, 'ms');
