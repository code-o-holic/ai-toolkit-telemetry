import flet as ft
from pathlib import Path
import os
import base64

from core.constants import SYSTEM_PROMPT, SUPPORTED_EXTS
from core.processor import ProcessorOptions, process_folder, list_images
from providers.lmstudio import LMStudioProvider
from providers.ollama import OllamaProvider
from providers.openai_api import OpenAIProvider


def main(page: ft.Page):
    page.title = "LoRA Dataset Captioner"
    page.window_width = 1400
    page.window_height = 900
    page.theme_mode = ft.ThemeMode.DARK
    
    # Neumorphic dark theme colors
    bg_color = "#1a1a1a"
    surface_color = "#2a2a2a"
    accent_color = "#4a9eff"
    text_color = "#e0e0e0"
    text_secondary = "#a0a0a0"
    
    page.bgcolor = bg_color
    
    # State
    loaded_images = []
    current_captions = {}
    
    # Left panel - Image preview and dataset
    def create_neumorphic_container(content, width=None, height=None, padding=20):
        return ft.Container(
            content=content,
            width=width,
            height=height,
            padding=padding,
            bgcolor=surface_color,
            border_radius=15,
            shadow=ft.BoxShadow(
                spread_radius=1,
                blur_radius=10,
                color="#30000000",
                offset=ft.Offset(4, 4)
            ),
            border=ft.border.all(1, "#1affffff")
        )
    
    def create_neumorphic_button(text, on_click, width=None, icon=None):
        return ft.Container(
            content=ft.TextButton(
                text=text,
                icon=icon,
                on_click=on_click,
                style=ft.ButtonStyle(
                    color=text_color,
                    bgcolor="#1a4a9eff",
                    overlay_color="#334a9eff",
                    shape=ft.RoundedRectangleBorder(radius=10),
                )
            ),
            width=width,
            border_radius=10,
            shadow=ft.BoxShadow(
                spread_radius=1,
                blur_radius=5,
                color="#33000000",
                offset=ft.Offset(2, 2)
            )
        )
    
    def create_neumorphic_input(label, value="", width=None, multiline=False, password=False):
        return ft.TextField(
            label=label,
            value=value,
            width=width,
            multiline=multiline,
            password=password,
            can_reveal_password=password,
            bgcolor="#0de0e0e0",
            border_color="#4de0e0e0",
            focused_border_color=accent_color,
            label_style=ft.TextStyle(color=text_secondary),
            text_style=ft.TextStyle(color=text_color),
            border_radius=10
        )
    
    # Image list view
    image_list = ft.ListView(expand=True, spacing=8, padding=10)
    dataset_info = ft.Text("No dataset loaded", color=text_secondary, size=14)
    
    def load_dataset():
        folder = Path(folder_field.value.strip().strip('"'))
        if not folder.is_dir():
            dataset_info.value = "Invalid folder path"
            dataset_info.color = "#ef5350"
            page.update()
            return
            
        images = list_images(folder)
        loaded_images.clear()
        loaded_images.extend(images)
        current_captions.clear()
        
        # Load existing captions
        for img in images:
            txt_path = img.with_suffix('.txt')
            if txt_path.exists():
                try:
                    with open(txt_path, 'r', encoding='utf-8') as f:
                        current_captions[str(img)] = f.read().strip()
                except:
                    current_captions[str(img)] = ""
            else:
                current_captions[str(img)] = ""
        
        # Update UI
        dataset_info.value = f"Loaded {len(images)} images"
        dataset_info.color = accent_color
        
        # Populate image list
        image_list.controls.clear()
        for i, img in enumerate(images):
            img_item = create_image_item(img, i)
            image_list.controls.append(img_item)
        
        page.update()
    
    def create_image_item(img_path, index):
        def save_caption(e):
            caption_field = e.control.data
            current_captions[str(img_path)] = caption_field.value
            txt_path = img_path.with_suffix('.txt')
            try:
                with open(txt_path, 'w', encoding='utf-8') as f:
                    f.write(caption_field.value)
                # Visual feedback
                e.control.bgcolor = ft.colors.with_opacity(0.3, ft.colors.GREEN)
                page.update()
                # Reset color after 1 second
                page.after(1000, lambda: setattr(e.control, 'bgcolor', ft.colors.with_opacity(0.1, accent_color)) or page.update())
            except Exception as ex:
                e.control.bgcolor = ft.colors.with_opacity(0.3, ft.colors.RED)
                page.update()
        
        caption_field = create_neumorphic_input(
            f"Caption for {img_path.name}",
            current_captions.get(str(img_path), ""),
            width=320,
            multiline=True
        )
        
        save_btn = ft.IconButton(
            icon="save",
            tooltip="Save caption",
            on_click=save_caption,
            icon_color=accent_color,
            bgcolor="#1a4a9eff"
        )
        save_btn.data = caption_field
        
        # Try to create image preview
        try:
            img_preview = ft.Image(
                src=str(img_path),
                width=80,
                height=80,
                fit=ft.ImageFit.COVER,
                border_radius=8
            )
        except:
            img_preview = ft.Icon("image", size=40, color=text_secondary)
        
        return create_neumorphic_container(
            ft.Column([
                ft.Row([
                    img_preview,
                    ft.Column([
                        ft.Text(f"{index+1}. {img_path.name}", color=text_color, size=12, weight=ft.FontWeight.BOLD),
                        ft.Text(f"Size: {img_path.stat().st_size // 1024}KB", color=text_secondary, size=10)
                    ], expand=True),
                ]),
                ft.Row([caption_field, save_btn], alignment=ft.MainAxisAlignment.SPACE_BETWEEN)
            ], spacing=8),
            width=380,
            height=180,
            padding=15
        )
    
    # Right panel - Controls
    folder_field = create_neumorphic_input("Folder path", width=400)
    
    def pick_folder(e):
        def on_result(r: ft.FilePickerResultEvent):
            if r.path:
                folder_field.value = r.path
                page.update()
        picker = ft.FilePicker(on_result=on_result)
        page.overlay.append(picker)
        page.update()
        picker.get_directory_path()

    pick_btn = create_neumorphic_button("Choose Folder", pick_folder, width=150, icon="folder_open")
    load_btn = create_neumorphic_button("Load Dataset", lambda e: load_dataset(), width=150, icon="refresh")
    
    rename_prefix = create_neumorphic_input("Rename prefix", "image_", width=200)
    base_prompt = create_neumorphic_input("Base prompt", width=500, multiline=True)
    system_prompt = create_neumorphic_input("System prompt", SYSTEM_PROMPT, width=500, multiline=True)

    provider_dd = ft.Dropdown(
        label="Provider",
        options=[
            ft.dropdown.Option("LMStudio"),
            ft.dropdown.Option("Ollama"),
            ft.dropdown.Option("OpenAI"),
        ],
        value="LMStudio",
        width=150,
        bgcolor="#0de0e0e0",
        border_color="#4de0e0e0",
        focused_border_color=accent_color,
        text_style=ft.TextStyle(color=text_color),
        border_radius=10
    )

    # Provider-specific fields
    host = create_neumorphic_input("Host", "127.0.0.1", width=120)
    port = create_neumorphic_input("Port", "1234", width=80)
    model = create_neumorphic_input("Model", "lmstudio", width=150)
    openai_key = create_neumorphic_input("OpenAI API Key", width=250, password=True)

    overwrite_txt = ft.Switch(
        label="Overwrite existing .txt",
        value=True,
        active_color=accent_color,
        label_style=ft.TextStyle(color=text_color)
    )
    skip_existing = ft.Switch(
        label="Skip if .txt exists",
        value=False,
        active_color=accent_color,
        label_style=ft.TextStyle(color=text_color)
    )

    progress = ft.ProgressBar(
        width=500,
        color=accent_color,
        bgcolor="#33e0e0e0"
    )
    status_text = ft.Text("Ready to process", color=text_color, size=14)
    
    # Log area
    log = ft.ListView(expand=True, spacing=4, padding=8, auto_scroll=True)

    def on_provider_change(e):
        if provider_dd.value == "LMStudio":
            host.value = "127.0.0.1"
            port.value = "1234"
            model.value = "lmstudio"
            openai_key.visible = False
            host.visible = True
            port.visible = True
            model.visible = True
        elif provider_dd.value == "Ollama":
            host.value = "127.0.0.1"
            port.value = "11434"
            model.value = "llava"
            openai_key.visible = False
            host.visible = True
            port.visible = True
            model.visible = True
        else:  # OpenAI
            openai_key.visible = True
            host.visible = False
            port.visible = False
            model.visible = True
            if model.value == "lmstudio":
                model.value = "gpt-4o-mini"
        page.update()

    provider_dd.on_change = on_provider_change

    def append_log(message: str):
        log.controls.append(ft.Text(message, color=text_color, size=12))
        if len(log.controls) > 100:  # Limit log size
            log.controls.pop(0)
        page.update()

    def progress_cb(i, total, msg):
        progress.value = i / max(total, 1)
        status_text.value = msg
        append_log(msg)

    def start_processing(e):
        folder = Path(folder_field.value.strip().strip('"'))
        if not folder.is_dir():
            append_log("❌ Invalid folder.")
            return
            
        if not loaded_images:
            append_log("⚠️ Load dataset first.")
            return
            
        # Choose provider
        try:
            if provider_dd.value == "LMStudio":
                prov = LMStudioProvider(host=host.value, port=int(port.value), model=model.value)
            elif provider_dd.value == "Ollama":
                prov = OllamaProvider(host=host.value, port=int(port.value), model=model.value)
            else:
                if not openai_key.value:
                    append_log("❌ OpenAI key required.")
                    return
                prov = OpenAIProvider(api_key=openai_key.value, model=model.value)
        except Exception as ex:
            append_log(f"❌ Provider init failed: {ex}")
            return

        options = ProcessorOptions(
            rename_prefix=rename_prefix.value.strip(),
            base_prompt=base_prompt.value.strip(),
            system_prompt=system_prompt.value,
            overwrite_txt=overwrite_txt.value,
            skip_if_txt_exists=skip_existing.value,
        )

        progress.value = 0
        page.update()

        try:
            renamed, created, skipped = process_folder(folder, prov, options, progress_cb=progress_cb)
            append_log(f"✅ Done! Renamed {renamed}, captioned {created}, skipped {skipped}.")
            load_dataset()  # Refresh the dataset view
        except Exception as ex:
            append_log(f"❌ Processing failed: {ex}")

    run_btn = create_neumorphic_button("🚀 Start Processing", start_processing, width=200)

    # Layout
    left_panel = create_neumorphic_container(
        ft.Column([
            ft.Row([
                ft.Text("📸 Dataset Preview", size=18, weight=ft.FontWeight.BOLD, color=text_color),
                dataset_info
            ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
            ft.Divider(color="#4de0e0e0"),
            image_list
        ], expand=True),
        width=420,
        padding=20
    )
    
    right_panel = ft.Column([
        # Header
        create_neumorphic_container(
            ft.Text("⚡ LoRA Dataset Captioner", size=24, weight=ft.FontWeight.BOLD, color=accent_color),
            width=520,
            height=70,
            padding=15
        ),
        
        # Folder selection
        create_neumorphic_container(
            ft.Column([
                ft.Text("📁 Folder Selection", size=16, weight=ft.FontWeight.BOLD, color=text_color),
                ft.Row([folder_field]),
                ft.Row([pick_btn, load_btn], spacing=10)
            ], spacing=10),
            width=520,
            padding=20
        ),
        
        # Settings
        create_neumorphic_container(
            ft.Column([
                ft.Text("⚙️ Settings", size=16, weight=ft.FontWeight.BOLD, color=text_color),
                ft.Row([rename_prefix]),
                base_prompt,
                system_prompt,
                ft.Row([provider_dd, host, port, model], spacing=10),
                ft.Row([openai_key]) if openai_key.visible else ft.Container(),
                ft.Row([overwrite_txt, skip_existing], spacing=20)
            ], spacing=10),
            width=520,
            padding=20
        ),
        
        # Processing
        create_neumorphic_container(
            ft.Column([
                ft.Text("🔄 Processing", size=16, weight=ft.FontWeight.BOLD, color=text_color),
                progress,
                status_text,
                run_btn
            ], spacing=10),
            width=520,
            padding=20
        ),
        
        # Log
        create_neumorphic_container(
            ft.Column([
                ft.Text("📋 Log", size=16, weight=ft.FontWeight.BOLD, color=text_color),
                ft.Container(log, height=200)
            ], spacing=10),
            width=520,
            padding=20
        )
    ], spacing=15, scroll=ft.ScrollMode.AUTO)

    # Main layout
    main_row = ft.Row([
        left_panel,
        ft.VerticalDivider(color="#4de0e0e0"),
        right_panel
    ], expand=True, spacing=20)
    
    page.add(
        ft.Container(
            main_row,
            padding=20,
            expand=True
        )
    )


if __name__ == "__main__":
    ft.app(target=main)


