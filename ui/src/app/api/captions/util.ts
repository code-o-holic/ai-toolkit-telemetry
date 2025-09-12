import fs from 'fs';
import path from 'path';

export function captionStatus(datasetFolder: string): { total: number; captioned: number } {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.m4v', '.flv'];
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

export function findImagesRecursively(dir: string): string[] {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.m4v', '.flv'];
  let results: string[] = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory() && item !== '_controls' && !item.startsWith('.')) {
      results = results.concat(findImagesRecursively(itemPath));
    } else {
      const ext = path.extname(itemPath).toLowerCase();
      if (imageExtensions.includes(ext)) {
        results.push(itemPath);
      }
    }
  }
  return results;
}


