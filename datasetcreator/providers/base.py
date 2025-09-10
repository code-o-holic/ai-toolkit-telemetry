from pathlib import Path
from typing import Protocol


class CaptionProvider(Protocol):
    def generate_caption(self, image_path: Path, base_prompt: str, system_prompt: str) -> str:
        """
        Generate a caption string for the given image using the provider's LLM.

        Implementations must raise an Exception with a helpful message on failure.
        """
        ...


