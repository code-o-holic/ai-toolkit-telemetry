## LoRA Dataset Captioner (Flet UI)

Rename images and generate .txt captions using LM Studio, Ollama, or OpenAI via a simple Flet UI.

### Quickstart
- Install: `pip install -r requirements.txt`
- Run: `python -m ui.flet_app`

### One-click on Windows
- Double-click `Start Dataset Captioner.bat` to launch the app.

### Providers
- LMStudio: host:port (default 127.0.0.1:1234), model name
- Ollama: host:port (default 127.0.0.1:11434), model like `llava`
- OpenAI: API key and model like `gpt-4o-mini`

### Notes
- Captions are saved next to images as `.txt`.
- Options to overwrite or skip existing `.txt`.

