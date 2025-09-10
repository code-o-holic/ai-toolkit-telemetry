import json
import base64
import mimetypes
from pathlib import Path
from typing import Optional

import requests


def _b64_image_data_url(image_path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(image_path))
    if mime is None:
        mime = "image/png"
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{b64}"


class LMStudioProvider:
    def __init__(self, host: str = "127.0.0.1", port: int = 1234, model: str = "lmstudio", timeout_s: int = 120):
        self.api_url = f"http://{host}:{port}/v1/chat/completions"
        self.model = model
        self.timeout_s = timeout_s

    def generate_caption(self, image_path: Path, base_prompt: str, system_prompt: str) -> str:
        image_data_url = _b64_image_data_url(image_path)
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
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 256,
            "top_p": 0.9,
            "stream": False,
        }
        r = requests.post(
            self.api_url,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload),
            timeout=self.timeout_s,
        )
        r.raise_for_status()
        data = r.json()
        caption = data["choices"][0]["message"]["content"].strip()
        if not caption:
            raise ValueError("Empty caption from model.")
        return caption


