import json
import base64
import mimetypes
from pathlib import Path

import requests


def _b64_image(image_path: Path) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


class OllamaProvider:
    def __init__(self, host: str = "127.0.0.1", port: int = 11434, model: str = "llava", timeout_s: int = 120):
        self.api_url = f"http://{host}:{port}/api/chat"
        self.model = model
        self.timeout_s = timeout_s

    def generate_caption(self, image_path: Path, base_prompt: str, system_prompt: str) -> str:
        image_b64 = _b64_image(image_path)
        # Ollama chat format for vision models (llava variants)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": base_prompt.strip(), "images": [image_b64]},
        ]
        payload = {"model": self.model, "messages": messages, "stream": False}
        r = requests.post(
            self.api_url,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload),
            timeout=self.timeout_s,
        )
        r.raise_for_status()
        data = r.json()
        # Response varies by version; prefer message.content, fallback to response
        caption = (
            (data.get("message") or {}).get("content")
            or data.get("response")
            or ""
        ).strip()
        if not caption:
            raise ValueError("Empty caption from model.")
        return caption


