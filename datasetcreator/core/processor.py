import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

from core.constants import SUPPORTED_EXTS, SYSTEM_PROMPT
from providers.base import CaptionProvider


@dataclass
class ProcessorOptions:
    rename_prefix: str
    base_prompt: str
    system_prompt: str = SYSTEM_PROMPT
    overwrite_txt: bool = True
    skip_if_txt_exists: bool = False
    delay_between_s: float = 0.05


def list_images(folder: Path) -> List[Path]:
    images = [p for p in folder.iterdir() if p.suffix.lower() in SUPPORTED_EXTS]
    images.sort(key=lambda p: p.name.lower())
    return images


def ensure_unique_name(target_path: Path) -> Path:
    if not target_path.exists():
        return target_path
    stem = target_path.stem
    suffix = target_path.suffix
    parent = target_path.parent
    i = 2
    while True:
        candidate = parent / f"{stem}_{i}{suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def process_folder(folder: Path, provider: CaptionProvider, options: ProcessorOptions, progress_cb=None) -> Tuple[int, int, int]:
    if not folder.is_dir():
        raise ValueError("Folder does not exist")

    images = list_images(folder)
    total = len(images)
    renamed = 0
    created_txt = 0
    skipped = 0

    for idx, img_path in enumerate(images, start=1):
        ext = img_path.suffix.lower()
        new_stem = f"{options.rename_prefix}{idx}"
        new_img_path = img_path.with_name(new_stem + ext)

        if options.skip_if_txt_exists:
            existing_txt = new_img_path.with_suffix(".txt")
            if existing_txt.exists():
                skipped += 1
                if progress_cb:
                    progress_cb(idx, total, f"Skip existing caption for {existing_txt.name}")
                continue

        # Avoid clobbering existing files when renaming
        new_img_path = ensure_unique_name(new_img_path)
        try:
            os.rename(img_path, new_img_path)
            renamed += 1
        except Exception as e:
            if progress_cb:
                progress_cb(idx, total, f"Rename failed: {img_path.name} → {new_img_path.name}: {e}")
            continue

        txt_path = new_img_path.with_suffix(".txt")
        if txt_path.exists() and not options.overwrite_txt:
            skipped += 1
            if progress_cb:
                progress_cb(idx, total, f"Exists, not overwriting: {txt_path.name}")
            continue

        try:
            caption = provider.generate_caption(new_img_path, options.base_prompt, options.system_prompt)
        except Exception as e:
            # On provider failure, write base prompt as fallback
            caption = options.base_prompt
            if progress_cb:
                progress_cb(idx, total, f"Caption failed for {new_img_path.name}: {e}")

        try:
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(caption)
            created_txt += 1
            if progress_cb:
                progress_cb(idx, total, f"Captioned {new_img_path.name}")
        except Exception as e:
            if progress_cb:
                progress_cb(idx, total, f"Write failed for {new_img_path.name}: {e}")

        time.sleep(options.delay_between_s)

    return renamed, created_txt, skipped


