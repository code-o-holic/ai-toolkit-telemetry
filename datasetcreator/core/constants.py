from pathlib import Path


SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

SYSTEM_PROMPT = (
    "You are a strict captioning system for LoRA dataset preparation.\n"
    "Follow the user’s prompt directly and generate a single concise caption or description for the given image.\n"
    "Rules:\n"
    "1) Only output captions/descriptions relevant to the image.\n"
    "2) No questions, no explanations, no meta commentary.\n"
    "3) Keep it one coherent paragraph, descriptive, and high-signal.\n"
    "5) Avoid hallucinations, irrelevant filler, or anything outside the caption.\n"
)


