# datasetcreator_llm.py
import os
import sys
import time
import json
import base64
import mimetypes
from pathlib import Path
import requests

SUPPORTED_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
DEFAULT_API_URL = "http://127.0.0.1:1234/v1/chat/completions"
DEFAULT_MODEL = os.getenv("LMSTUDIO_MODEL", "lmstudio")

SYSTEM_PROMPT = (
    "You are a strict captioning system for LoRA dataset preparation.\n"
    "Follow the user’s prompt directly and generate a single concise caption or description for the given image.\n"
    "Rules:\n"
    "1) Only output captions/descriptions relevant to the image.\n"
    "2) No questions, no explanations, no meta commentary.\n"
    "3) Keep it one coherent paragraph, descriptive, and high-signal.\n"
    "5) Avoid hallucinations, irrelevant filler, or anything outside the caption.\n"
)

def b64_image_data_url(image_path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(image_path))
    if mime is None:
        mime = "image/png"
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{b64}"

def call_llm_for_caption(api_url: str, model: str, system_prompt: str, base_prompt: str, image_path: Path, timeout_s: int = 120) -> str:
    image_data_url = b64_image_data_url(image_path)

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": base_prompt.strip()},
                {"type": "image_url", "image_url": {"url": image_data_url}},
            ],
        },
    ]

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 256,
        "top_p": 0.9,
        "stream": False,
    }

    try:
        r = requests.post(
            api_url,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload),
            timeout=timeout_s,
        )
        r.raise_for_status()
        data = r.json()
        caption = data["choices"][0]["message"]["content"].strip()
        if not caption:
            raise ValueError("Empty caption from model.")
        return caption
    except Exception as e:
        print(f"⚠️  LLM caption failed for {image_path.name}: {e}")
        return base_prompt  # fallback

def main():
    print("🗂️ LoRA Dataset Prep + LLM Captioner\n")

    folder = input("📁 Enter the full folder path containing images: ").strip().strip('"')
    keyword = input("🔑 Enter the keyword/prefix for renaming (e.g., girl, shirt, scene): ").strip()
    base_prompt = input("✍️ Enter the base prompt (guidance for captions): ").strip()

    api_url = input(f"🔌 LLM API URL [{DEFAULT_API_URL}]: ").strip() or DEFAULT_API_URL
    model = input(f"🧠 Model name [{DEFAULT_MODEL}]: ").strip() or DEFAULT_MODEL

    folder_path = Path(folder)
    if not folder_path.is_dir():
        print("❌ Error: The provided folder does not exist.")
        sys.exit(1)

    images = [p for p in folder_path.iterdir() if p.suffix.lower() in SUPPORTED_EXTS]
    images.sort(key=lambda p: p.name.lower())

    if not images:
        print("⚠️ No image files found in the folder.")
        sys.exit(0)

    renamed = 0
    created_txt = 0

    for idx, img_path in enumerate(images, start=1):
        ext = img_path.suffix.lower()
        new_stem = f"{keyword}{idx}"
        new_img_path = img_path.with_name(new_stem + ext)

        try:
            os.rename(img_path, new_img_path)
            renamed += 1
        except Exception as e:
            print(f"❌ Failed to rename {img_path.name} → {new_img_path.name}: {e}")
            continue

        caption = call_llm_for_caption(api_url, model, SYSTEM_PROMPT, base_prompt, new_img_path)
        txt_path = new_img_path.with_suffix(".txt")
        try:
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(caption)
            created_txt += 1
        except Exception as e:
            print(f"❌ Failed writing caption for {new_img_path.name}: {e}")

        time.sleep(0.05)

    print(f"\n✅ Done! Renamed {renamed} image(s) and created {created_txt} .txt caption(s).")
    print(f"📍 Output: {folder_path}")

if __name__ == "__main__":
    main()
