"""
Streamlit dashboard for monitoring AI Toolkit training runs.
Provides live metrics visualization and safe log interval control.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import streamlit.components.v1 as components
from PIL import Image
try:
    from streamlit_autorefresh import st_autorefresh
except Exception:
    st_autorefresh = None
import json
import os
import time
from pathlib import Path
from datetime import datetime, timedelta
import numpy as np

# Page config
st.set_page_config(
    page_title="AI Toolkit Training Dashboard",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="expanded"
)

# Minimal, professional UI styling overrides (non-invasive)
st.markdown(
    """
    <style>
      /* Reduce top padding added by Streamlit */
      section.main > div { padding-top: 1rem; }
      /* Tidy up headers */
      h1, h2, h3 { letter-spacing: 0.2px; }
      /* Softer table/grid corners */
      .block-container { padding-top: 1rem; }
      /* Compact sidebar controls */
      [data-testid="stSidebar"] .stButton>button { width: 100%; }
      [data-testid="stSidebar"] .stSelectbox, 
      [data-testid="stSidebar"] .stMultiSelect { margin-bottom: .5rem; }
      /* Subheader icon row spacing fix */
      .stSubheader { margin-top: .75rem; margin-bottom: .5rem; }
    </style>
    """,
    unsafe_allow_html=True,
)

def load_jsonl_data(file_path):
    """Load data from JSONL file."""
    data = []
    try:
        with open(file_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        data.append(json.loads(line))
                    except json.JSONDecodeError:
                        # Skip malformed lines (partially written)
                        continue
    except FileNotFoundError:
        pass
    return data

def get_available_runs():
    """Get list of available training runs."""
    logs_dir = Path("./logs")
    if not logs_dir.exists():
        return []
    
    runs = []
    for run_dir in logs_dir.iterdir():
        if run_dir.is_dir():
            metrics_file = run_dir / "metrics.jsonl"
            if metrics_file.exists():
                # Get run info from first record
                data = load_jsonl_data(metrics_file)
                if data:
                    start_record = next((r for r in data if r.get("event") == "start"), None)
                    if start_record:
                        runs.append({
                            "name": run_dir.name,
                            "path": str(metrics_file),
                            "start_time": start_record.get("timestamp", "Unknown"),
                            "config_name": start_record.get("config_name", "Unknown"),
                            "process_type": start_record.get("process_type", "Unknown")
                        })
    
    return sorted(runs, key=lambda x: x["start_time"], reverse=True)

def apply_ema_smoothing(values, alpha=0.1):
    """Apply exponential moving average smoothing."""
    if not values:
        return values
    
    smoothed = [values[0]]
    for i in range(1, len(values)):
        smoothed.append(alpha * values[i] + (1 - alpha) * smoothed[i-1])
    return smoothed

def detect_training_issues(data):
    """Detect potential training issues."""
    issues = []
    
    # Get step records
    step_records = [r for r in data if r.get("event") == "step"]
    if not step_records:
        return issues
    
    recent_steps = step_records[-50:]  # Last 50 steps
    
    # Check for NaN/Inf
    nan_count = sum(1 for r in recent_steps if r.get("nan_inf_detected", False))
    if nan_count > 0:
        issues.append(f"🚨 NaN/Inf detected in {nan_count} recent steps")
    
    # Check for loss plateau
    losses = [r.get("train_loss", 0) for r in recent_steps if r.get("train_loss") is not None]
    if len(losses) > 20:
        recent_losses = losses[-20:]
        loss_std = np.std(recent_losses)
        loss_mean = np.mean(recent_losses)
        if loss_std < 0.01 * abs(loss_mean) and loss_mean > 0.001:
            issues.append("📈 Potential loss plateau detected")
    
    # Check for exploding gradients
    grad_norms = [r.get("grad_norm") for r in recent_steps if r.get("grad_norm") is not None]
    if grad_norms:
        max_grad = max(grad_norms)
        if max_grad > 10.0:
            issues.append(f"💥 High gradient norm detected: {max_grad:.2f}")
    
    # Check for low GPU utilization (if VRAM usage is very low)
    gpu_usage = [r.get("gpu_mem_allocated", 0) for r in recent_steps]
    if gpu_usage and max(gpu_usage) < 1.0:  # Less than 1GB
        issues.append("🐌 Potentially low GPU utilization")
    
    # Check for overfitting (if validation loss available and increasing)
    val_losses = [r.get("val_loss") for r in step_records if r.get("val_loss") is not None]
    if len(val_losses) > 10:
        recent_val = val_losses[-5:]
        earlier_val = val_losses[-10:-5]
        if len(recent_val) == 5 and len(earlier_val) == 5:
            if np.mean(recent_val) > np.mean(earlier_val) * 1.1:
                issues.append("📊 Potential overfitting detected")
    
    return issues

def write_control_file(run_path, control_data):
    """Write control file for run."""
    run_dir = Path(run_path).parent
    control_file = run_dir / "control.json"
    
    control_data["timestamp"] = time.time()
    
    try:
        with open(control_file, 'w') as f:
            json.dump(control_data, f, indent=2)
        return True
    except Exception as e:
        st.error(f"Failed to write control file: {e}")
        return False

def main():
    # helper to render fixed-size thumbnails
    def render_thumb(img_path: str, caption: str):
        try:
            # Let Streamlit manage scaling via the column width; no server-side resize.
            # This keeps original pixel data so fullscreen shows full-resolution.
            st.image(img_path, caption=caption, use_container_width=True)
        except Exception:
            st.caption(img_path)
    st.title("AI Toolkit Training Dashboard")
    st.markdown("Real-time monitoring and control for AI Toolkit training runs")
    
    # Sidebar - Run selection
    st.sidebar.header("Training Runs")
    
    runs = get_available_runs()
    if not runs:
        st.warning("No training runs found in ./logs/ directory")
        st.info("Start a training run with telemetry enabled to see data here.")
        return
    
    # Run selector (single + multi for overlay)
    run_labels = [f"{r['name']} ({r['config_name']})" for r in runs]
    selected_idx = st.sidebar.selectbox("Primary run:", range(len(run_labels)), format_func=lambda x: run_labels[x])
    selected_run = runs[selected_idx]
    overlay_idx = st.sidebar.multiselect("Overlay runs (optional)", options=[i for i in range(len(run_labels)) if i != selected_idx], format_func=lambda x: run_labels[x])
    
    # Color palette selection (bold, high-contrast palettes)
    st.sidebar.subheader("Colors")
    available_palettes = {
        "Bold": px.colors.qualitative.Bold,
        "Vivid": px.colors.qualitative.Vivid if hasattr(px.colors.qualitative, 'Vivid') else px.colors.qualitative.Set1,
        "Set1": px.colors.qualitative.Set1,
        "Set3": px.colors.qualitative.Set3,
        "D3": px.colors.qualitative.D3,
        "Dark24": px.colors.qualitative.Dark24,
        "Light24": px.colors.qualitative.Light24,
        "Alphabet": px.colors.qualitative.Alphabet,
        "Prism": px.colors.qualitative.Prism if hasattr(px.colors.qualitative, 'Prism') else px.colors.qualitative.Set2,
        "Safe": px.colors.qualitative.Safe if hasattr(px.colors.qualitative, 'Safe') else px.colors.qualitative.Set2,
    }
    palette_name = st.sidebar.selectbox("Palette", list(available_palettes.keys()), index=0)
    reverse_palette = st.sidebar.checkbox("Reverse colors", value=False)
    
    # Auto-refresh toggle (non-blocking) with interval control
    auto_refresh = st.sidebar.checkbox("Auto-refresh", value=True)
    refresh_sec = st.sidebar.slider("Interval (seconds)", min_value=2, max_value=60, value=5, step=1)
    if auto_refresh and st_autorefresh is not None:
        st_autorefresh(interval=int(refresh_sec * 1000), limit=None, key="aitk_auto_refresh")
    elif auto_refresh and st_autorefresh is None:
        # Fallback: JS-based non-blocking refresh without dimming
        components.html(
            f"""
            <script>
              setTimeout(function() {{
                if (window && window.parent) {{ window.parent.location.reload(); }} else {{ window.location.reload(); }}
              }}, {int(refresh_sec * 1000)});
            </script>
            """,
            height=0,
        )
        st.sidebar.caption("Using JS fallback refresh. For smoother refresh, install: pip install streamlit-autorefresh")
    
    # Manual refresh button
    if st.sidebar.button("🔄 Refresh Now"):
        st.rerun()
    
    # Load data
    data = load_jsonl_data(selected_run["path"])
    if not data:
        st.error("No data available for selected run yet. Waiting for logs...")
        # still render skeleton and rely on auto-refresh
    
    # Run info
    start_record = next((r for r in data if r.get("event") == "start"), None)
    step_records = [r for r in data if r.get("event") == "step"]

    # Debug counters (always visible)
    st.caption(f"Loaded records: total={len(data)} | steps={len(step_records)} | start_events={(1 if start_record else 0)}")
    
    st.header(f"{selected_run['name']}")
    
    # Run summary
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        if start_record:
            st.metric("Config", start_record.get("config_name", "Unknown"))
        else:
            st.metric("Config", "Unknown")
    
    with col2:
        if step_records:
            current_step = step_records[-1].get("global_step", 0)
            max_steps = start_record.get("max_steps", "Unknown") if start_record else "Unknown"
            st.metric("Progress", f"{current_step}/{max_steps}")
        else:
            st.metric("Progress", "0/Unknown")
    
    with col3:
        if step_records:
            current_loss = step_records[-1].get("train_loss", 0)
            st.metric("Current Loss", f"{current_loss:.4f}")
        else:
            st.metric("Current Loss", "N/A")
    
    with col4:
        if step_records:
            current_lr = step_records[-1].get("lr", 0)
            st.metric("Learning Rate", f"{current_lr:.2e}")
        else:
            st.metric("Learning Rate", "N/A")
    
    # Training issues
    issues = detect_training_issues(data)
    if issues:
        st.error("**Training Issues Detected:**")
        for issue in issues:
            st.write(f"- {issue}")
    else:
        st.success("✅ No training issues detected")
    
    # Control panel
    st.sidebar.header("⚙️ Training Control")
    
    current_log_every = 100  # Default
    if step_records:
        # Try to infer current log_every from step intervals
        steps = [r.get("global_step", 0) for r in step_records[-10:]]
        if len(steps) > 1:
            intervals = [steps[i] - steps[i-1] for i in range(1, len(steps))]
            if intervals:
                current_log_every = max(set(intervals), key=intervals.count)
    
    new_log_every = st.sidebar.slider(
        "Log Every (steps)",
        min_value=5,
        max_value=2000,
        value=current_log_every,
        step=5,
        help="Adjust logging frequency. Changes apply after 30s debounce."
    )
    
    if st.sidebar.button("📝 Apply Log Interval"):
        if write_control_file(selected_run["path"], {"log_every": new_log_every}):
            st.sidebar.success(f"Set log_every to {new_log_every}")
        else:
            st.sidebar.error("Failed to apply setting")
    
    # Charts
    if not step_records:
        st.warning("No step data available yet. Waiting for first step logs...")
        return
    
    # Prepare data for charts
    df = pd.DataFrame(step_records)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Smoothing option
    use_smoothing = st.checkbox("📈 Apply EMA smoothing", value=True)
    
    # Color palette mapped per run for consistent coloring
    selected_palette = available_palettes.get(palette_name, px.colors.qualitative.Bold)
    if reverse_palette:
        selected_palette = list(reversed(selected_palette))
    # extend palette to cover many runs
    palette = (selected_palette * 10)  # repeat to ensure enough colors
    run_order = [selected_run['name']] + [runs[i]['name'] for i in overlay_idx]
    color_map = {name: palette[i % len(palette)] for i, name in enumerate(run_order)}

    # Loss plot with overlay
    st.subheader("Training Loss")
    fig_loss = go.Figure()

    # normalise columns
    if 'train_loss' not in df.columns and 'loss' in df.columns:
        df['train_loss'] = df['loss']

    def add_loss_trace(plot_df, name, color=None, smooth=use_smoothing, raw_alpha=0.3):
        if 'train_loss' not in plot_df.columns:
            return
        losses = plot_df['train_loss'].fillna(0)
        if smooth:
            losses_smooth = apply_ema_smoothing(losses.tolist())
            fig_loss.add_trace(go.Scatter(x=plot_df['global_step'], y=losses_smooth, mode='lines', name=f'{name} (smoothed)', line=dict(color=color)))
            fig_loss.add_trace(go.Scatter(x=plot_df['global_step'], y=losses, mode='lines', name=f'{name} (raw)', line=dict(color=color, width=1), opacity=raw_alpha))
        else:
            fig_loss.add_trace(go.Scatter(x=plot_df['global_step'], y=losses, mode='lines', name=name, line=dict(color=color)))

    add_loss_trace(df, selected_run['name'], color=color_map[selected_run['name']])
    # overlay runs
    for i, idx in enumerate(overlay_idx):
        r = runs[idx]
        other = load_jsonl_data(r['path'])
        other_steps = [e for e in other if e.get('event') == 'step']
        odf = pd.DataFrame(other_steps)
        if 'train_loss' not in odf.columns and 'loss' in odf.columns:
            odf['train_loss'] = odf['loss']
        add_loss_trace(odf, r['name'], color=color_map[r['name']])
    
    fig_loss.update_layout(
        xaxis_title="Step",
        yaxis_title="Loss",
        yaxis_type="log" if st.checkbox("Log scale", key="loss_log") else "linear",
        height=400
    )
    st.plotly_chart(fig_loss, use_container_width=True)
    
    # Learning rate plot
    st.subheader("Learning Rate")
    fig_lr = go.Figure()
    if 'lr' not in df.columns and 'learning_rate' in df.columns:
        df['lr'] = df['learning_rate']
    if 'lr' in df.columns:
        fig_lr.add_trace(go.Scatter(x=df['global_step'], y=df['lr'], mode='lines', name=selected_run['name'], line=dict(color=color_map[selected_run['name']])))
    for i, idx in enumerate(overlay_idx):
        r = runs[idx]
        other = load_jsonl_data(r['path'])
        other_steps = [e for e in other if e.get('event') == 'step']
        odf = pd.DataFrame(other_steps)
        if 'lr' not in odf.columns and 'learning_rate' in odf.columns:
            odf['lr'] = odf['learning_rate']
        if 'lr' in odf.columns:
            fig_lr.add_trace(go.Scatter(x=odf['global_step'], y=odf['lr'], mode='lines', name=r['name'], line=dict(color=color_map[r['name']])))
    
    fig_lr.update_layout(
        xaxis_title="Step",
        yaxis_title="Learning Rate",
        height=300
    )
    st.plotly_chart(fig_lr, use_container_width=True)
    
    # Multi-metric plot
    st.subheader("Training Metrics")
    
    # Create subplot
    fig_multi = make_subplots(
        rows=2, cols=2,
        subplot_titles=('Gradient Norm', 'GPU Memory (GB)', 'Speed (samples/sec)', 'CPU Memory (MB)'),
        vertical_spacing=0.1
    )
    
    # Gradient norm
    if 'grad_norm' in df.columns:
        grad_norms = df['grad_norm'].fillna(0)
        fig_multi.add_trace(
            go.Scatter(x=df['global_step'], y=grad_norms, mode='lines', name=f"{selected_run['name']} Grad", line=dict(color=color_map[selected_run['name']])),
            row=1, col=1
        )
    
    # GPU memory
    if 'gpu_mem_allocated' in df.columns:
        gpu_mem = df['gpu_mem_allocated'].fillna(0)
        fig_multi.add_trace(
            go.Scatter(x=df['global_step'], y=gpu_mem, mode='lines', name=f"{selected_run['name']} GPU", line=dict(color=color_map[selected_run['name']])) ,
            row=1, col=2
        )
    
    # Speed
    if 'samples_per_sec' in df.columns:
        speed = df['samples_per_sec'].fillna(0)
        fig_multi.add_trace(
            go.Scatter(x=df['global_step'], y=speed, mode='lines', name=f"{selected_run['name']} Speed", line=dict(color=color_map[selected_run['name']])) ,
            row=2, col=1
        )
    
    # CPU memory
    if 'cpu_mem_rss_mb' in df.columns:
        cpu_mem = df['cpu_mem_rss_mb'].fillna(0)
        fig_multi.add_trace(
            go.Scatter(x=df['global_step'], y=cpu_mem, mode='lines', name=f"{selected_run['name']} CPU", line=dict(color=color_map[selected_run['name']])) ,
            row=2, col=2
        )
    
    # Overlay metrics for selected runs
    for i, idx in enumerate(overlay_idx):
        r = runs[idx]
        other = load_jsonl_data(r['path'])
        other_steps = [e for e in other if e.get('event') == 'step']
        odf = pd.DataFrame(other_steps)
        color = color_map[r['name']]
        if 'grad_norm' in odf.columns:
            gn = odf['grad_norm'].fillna(0)
            fig_multi.add_trace(go.Scatter(x=odf['global_step'], y=gn, mode='lines', name=f"{r['name']} Grad", line=dict(color=color)), row=1, col=1)
        if 'gpu_mem_allocated' in odf.columns:
            gm = odf['gpu_mem_allocated'].fillna(0)
            fig_multi.add_trace(go.Scatter(x=odf['global_step'], y=gm, mode='lines', name=f"{r['name']} GPU", line=dict(color=color)), row=1, col=2)
        if 'samples_per_sec' in odf.columns:
            spd = odf['samples_per_sec'].fillna(0)
            fig_multi.add_trace(go.Scatter(x=odf['global_step'], y=spd, mode='lines', name=f"{r['name']} Speed", line=dict(color=color)), row=2, col=1)
        if 'cpu_mem_rss_mb' in odf.columns:
            cm = odf['cpu_mem_rss_mb'].fillna(0)
            fig_multi.add_trace(go.Scatter(x=odf['global_step'], y=cm, mode='lines', name=f"{r['name']} CPU", line=dict(color=color)), row=2, col=2)

    # Per-plot controls
    with st.expander("Chart controls", expanded=False):
        log_grad = st.checkbox("Grad log-y", value=False, key='log_grad')
        log_gpu = st.checkbox("GPU log-y", value=False, key='log_gpu')
        log_speed = st.checkbox("Speed log-y", value=False, key='log_speed')
        log_cpu = st.checkbox("CPU log-y", value=False, key='log_cpu')
    fig_multi.update_yaxes(type='log' if log_grad else 'linear', row=1, col=1)
    fig_multi.update_yaxes(type='log' if log_gpu else 'linear', row=1, col=2)
    fig_multi.update_yaxes(type='log' if log_speed else 'linear', row=2, col=1)
    fig_multi.update_yaxes(type='log' if log_cpu else 'linear', row=2, col=2)

    fig_multi.update_layout(height=600, showlegend=True)
    st.plotly_chart(fig_multi, use_container_width=True)
    
    # Samples timeline per prompt (primary + overlays)
    st.subheader("Samples Timeline")
    sample_events = [r for r in data if r.get('event') == 'sample']
    start_meta = start_record or {}
    samples_dir = start_meta.get('samples_dir')
    # independent prompt selectors
    prompt_list = start_meta.get('sample_prompts', [])
    prompt_idx = st.selectbox("Prompt index (primary)", options=range(max(1, len(prompt_list) or 1)), format_func=lambda i: prompt_list[i] if prompt_list and i < len(prompt_list) else f"Prompt {i}")

    def build_step_to_path_from_events_and_dir(sample_events_list, sdir, prompt_index):
        mapping = {}
        for ev in sample_events_list:
            step_ev = ev.get('global_step')
            for item in ev.get('items', []):
                if item.get('prompt_index') == prompt_index and item.get('path'):
                    mapping[step_ev] = item.get('path')
        if (not mapping) and sdir and os.path.isdir(sdir):
            try:
                import re
                for fname in sorted(os.listdir(sdir)):
                    m = re.search(r"__([0-9]{1,9})_([0-9]+)\.(jpg|jpeg|png|webp)$", fname, re.IGNORECASE)
                    if not m:
                        continue
                    step_val = int(m.group(1)) if len(m.group(1)) < 9 else int(m.group(1))
                    idx_val = int(m.group(2))
                    if idx_val == prompt_index:
                        mapping[step_val] = os.path.join(sdir, fname)
            except Exception:
                pass
        return mapping

    # primary run block
    primary_step_to_path = build_step_to_path_from_events_and_dir(sample_events, samples_dir, prompt_idx)
    if primary_step_to_path:
        ordered_steps = sorted(primary_step_to_path.keys())
        # fixed-size grid: 6 columns, uniform image height
        cols = st.columns(6)
        for i, step in enumerate(ordered_steps):
            with cols[i % 6]:
                render_thumb(primary_step_to_path[step], caption=f"{selected_run['name']} · step {step}")
    else:
        st.caption("No sample images recorded yet for this prompt.")

    # overlay blocks
    if overlay_idx:
        st.subheader("Samples Timeline (Overlays)")
        for idx in overlay_idx:
            r = runs[idx]
            r_data = load_jsonl_data(r['path'])
            r_start = next((e for e in r_data if e.get('event') == 'start'), None) or {}
            r_samples_dir = r_start.get('samples_dir')
            r_sample_events = [e for e in r_data if e.get('event') == 'sample']
            r_prompts = r_start.get('sample_prompts', [])
            r_prompt_idx = st.selectbox(f"Prompt index ({r['name']})", options=range(max(1, len(r_prompts) or 1)), key=f"prompt_idx_{r['name']}", format_func=lambda i: r_prompts[i] if r_prompts and i < len(r_prompts) else f"Prompt {i}")
            r_step_to_path = build_step_to_path_from_events_and_dir(r_sample_events, r_samples_dir, r_prompt_idx)
            st.markdown(f"**{r['name']}**")
            if r_step_to_path:
                r_ordered_steps = sorted(r_step_to_path.keys())
                cols = st.columns(6)
                for i, step in enumerate(r_ordered_steps):
                    with cols[i % 6]:
                        render_thumb(r_step_to_path[step], caption=f"{r['name']} · step {step}")
            else:
                st.caption(f"No sample images found for {r['name']}.")

    # Recent events table
    st.subheader("Recent Events")
    
    recent_events = data[-20:]  # Last 20 events
    events_df = pd.DataFrame([
        {
            "Time": datetime.fromisoformat(r["timestamp"]).strftime("%H:%M:%S"),
            "Event": r.get("event", "unknown"),
            "Step": r.get("global_step", "N/A"),
            "Details": str({k: v for k, v in r.items() if k not in ["timestamp", "event", "global_step", "time"]})[:100] + "..."
        }
        for r in reversed(recent_events)
    ])
    
    st.dataframe(events_df, use_container_width=True, height=300)
    
    # Training configuration comparison
    if start_record:
        st.header("⚙️ Training Configuration")
        
        # Extract ALL hyperparameters for comparison with priority ordering
        def extract_all_params(config):
            """Extract ALL training parameters with priority ordering."""
            params = {}
            
            def flatten_dict(d, parent_key='', sep='_'):
                """Flatten nested dictionary for comprehensive parameter extraction."""
                items = []
                for k, v in d.items():
                    new_key = f"{parent_key}{sep}{k}" if parent_key else k
                    if isinstance(v, dict):
                        items.extend(flatten_dict(v, new_key, sep=sep).items())
                    elif isinstance(v, list):
                        # Handle lists by converting to string representation
                        items.append((new_key, str(v)))
                    else:
                        items.append((new_key, v))
                return dict(items)
            
            # Flatten the entire config
            flat_config = flatten_dict(config)
            
            # PRIORITY PARAMETERS (user specified focus)
            priority_params = {}
            
            # 1. LoRA Linear & Linear Alpha (TOP PRIORITY)
            if 'network' in config and isinstance(config['network'], dict):
                network = config['network']
                priority_params['🔥 LoRA Linear (Rank)'] = network.get('linear', network.get('rank', 'N/A'))
                priority_params['🔥 LoRA Linear Alpha'] = network.get('linear_alpha', network.get('alpha', 'N/A'))
            
            # 2. Steps (TOP PRIORITY)
            priority_params['🔥 Max Steps'] = config.get('max_steps', 'N/A')
            
            # 3. Learning Rate (TOP PRIORITY)
            priority_params['🔥 Learning Rate'] = config.get('learning_rate', config.get('lr', 'N/A'))
            
            # 4. Scheduler (TOP PRIORITY)
            if 'lr_scheduler' in config and isinstance(config['lr_scheduler'], dict):
                sched = config['lr_scheduler']
                priority_params['🔥 LR Scheduler'] = sched.get('name', 'N/A')
                if 'params' in sched and isinstance(sched['params'], dict):
                    for k, v in sched['params'].items():
                        priority_params[f'🔥 Scheduler {k}'] = v
            
            # 5. Model (TOP PRIORITY)
            if 'model' in config and isinstance(config['model'], dict):
                priority_params['🔥 Model Name'] = config['model'].get('name_or_path', 'N/A')
                priority_params['🔥 Model Quantize'] = config['model'].get('quantize', 'N/A')
            else:
                priority_params['🔥 Model Name'] = config.get('model', 'N/A')
            
            # Add priority params first
            params.update(priority_params)
            
            # IMPORTANT SECONDARY PARAMETERS
            secondary_params = {}
            
            # Training core parameters
            secondary_params['📈 Batch Size'] = config.get('batch_size', 'N/A')
            secondary_params['📈 Epochs'] = config.get('epochs', 'N/A')
            secondary_params['📈 Gradient Accumulation'] = config.get('gradient_accumulation_steps', 'N/A')
            secondary_params['📈 Mixed Precision'] = config.get('mixed_precision', 'N/A')
            secondary_params['📈 Gradient Clipping'] = config.get('max_grad_norm', 'N/A')
            secondary_params['📈 Resolution'] = config.get('resolution', config.get('sample_resolution', 'N/A'))
            
            # LoRA additional parameters
            if 'network' in config and isinstance(config['network'], dict):
                network = config['network']
                secondary_params['📈 LoRA Dropout'] = network.get('dropout', 'N/A')
                secondary_params['📈 LoRA Conv'] = network.get('conv', 'N/A')
                secondary_params['📈 LoRA Conv Alpha'] = network.get('conv_alpha', 'N/A')
            
            # Optimizer parameters
            if 'optimizer' in config and isinstance(config['optimizer'], dict):
                opt = config['optimizer']
                secondary_params['📈 Optimizer'] = opt.get('name', 'N/A')
                if 'params' in opt and isinstance(opt['params'], dict):
                    for k, v in opt['params'].items():
                        secondary_params[f'📈 Opt {k}'] = v
            
            # Add secondary params
            params.update(secondary_params)
            
            # ALL OTHER PARAMETERS (comprehensive)
            other_params = {}
            
            # Skip parameters we've already included
            skip_keys = set()
            for key in params.keys():
                # Extract the actual config key from our formatted key
                if key.startswith('🔥 ') or key.startswith('📈 '):
                    clean_key = key[2:].lower().replace(' ', '_')
                    skip_keys.add(clean_key)
            
            # Add all remaining flattened parameters
            for key, value in flat_config.items():
                # Skip if we've already included this parameter
                if any(skip in key.lower() for skip in ['linear', 'alpha', 'max_steps', 'learning_rate', 'lr_scheduler', 'model', 'batch_size', 'epochs', 'gradient_accumulation', 'mixed_precision', 'max_grad_norm', 'resolution', 'dropout', 'conv', 'optimizer']):
                    continue
                
                # Format key nicely
                formatted_key = f"⚙️ {key.replace('_', ' ').title()}"
                other_params[formatted_key] = value
            
            # Add all other params
            params.update(other_params)
            
            return params
        
        if overlay_idx:
            # Compare configurations across multiple runs
            st.subheader("Hyperparameter Comparison")
            
            # Collect all configs
            all_configs = {}
            run_names = []
            
            # Primary run
            primary_config = {k: v for k, v in start_record.items() if k not in ["event", "timestamp", "time"]}
            all_configs[selected_run['name']] = primary_config
            run_names.append(selected_run['name'])
            
            # Overlay runs
            for idx in overlay_idx:
                overlay_run = runs[idx]
                overlay_data = load_jsonl_data(overlay_run["path"])
                overlay_start = next((r for r in overlay_data if r.get("event") == "start"), None)
                if overlay_start:
                    overlay_config = {k: v for k, v in overlay_start.items() if k not in ["event", "timestamp", "time"]}
                    all_configs[overlay_run['name']] = overlay_config
                    run_names.append(overlay_run['name'])
            
            # Create comparison table
            comparison_data = {}
            param_names = set()
            
            # Extract parameters from all configs
            for run_name in run_names:
                if run_name in all_configs:
                    params = extract_all_params(all_configs[run_name])
                    comparison_data[run_name] = params
                    param_names.update(params.keys())
            
            # Build the comparison DataFrame with priority ordering
            comparison_rows = []
            
            # Custom sorting to prioritize parameters
            def param_sort_key(param_name):
                if param_name.startswith('🔥 '):
                    return f"0_{param_name}"  # Top priority
                elif param_name.startswith('📈 '):
                    return f"1_{param_name}"  # Secondary priority
                else:
                    return f"2_{param_name}"  # All other parameters
            
            sorted_params = sorted(param_names, key=param_sort_key)
            
            for param in sorted_params:
                row = {'Parameter': param}
                for run_name in run_names:
                    if run_name in comparison_data:
                        value = comparison_data[run_name].get(param, 'N/A')
                        # Format the value nicely
                        if isinstance(value, float):
                            if value < 0.01:
                                value = f"{value:.2e}"
                            else:
                                value = f"{value:.4f}"
                        row[run_name] = str(value)
                    else:
                        row[run_name] = 'N/A'
                comparison_rows.append(row)
            
            if comparison_rows:
                comparison_df = pd.DataFrame(comparison_rows)
                
                # Display the table with highlighting
                st.dataframe(comparison_df, use_container_width=True, hide_index=True)
                
                # Find and highlight differences
                differences = []
                for i, row in comparison_df.iterrows():
                    values = [str(row[col]) for col in comparison_df.columns[1:]]  # Skip 'Parameter' column
                    unique_values = set(v for v in values if v != 'N/A')
                    if len(unique_values) > 1:
                        differences.append(row['Parameter'])
                
                if differences:
                    st.info(f"📊 **Parameters that differ:** {', '.join(differences)}")
                else:
                    st.success("✅ All parameters match across runs")
            else:
                st.info("No configuration data available for comparison")
        else:
            # Single run - show key parameters in a nice table
            config_data = {k: v for k, v in start_record.items() if k not in ["event", "timestamp", "time"]}
            
            # Extract ALL parameters for single run view
            all_params = extract_all_params(config_data)
            
            # Sort parameters by priority for single run display
            def param_sort_key(param_name):
                if param_name.startswith('🔥 '):
                    return f"0_{param_name}"  # Top priority
                elif param_name.startswith('📈 '):
                    return f"1_{param_name}"  # Secondary priority
                else:
                    return f"2_{param_name}"  # All other parameters
            
            sorted_param_items = sorted(all_params.items(), key=lambda x: param_sort_key(x[0]))
            
            # Display as a clean 2-column table
            params_df = pd.DataFrame(sorted_param_items, columns=['Parameter', 'Value'])
            st.dataframe(params_df, use_container_width=True, hide_index=True)
            
            # Display full config as expandable JSON
            with st.expander("View full configuration"):
                st.json(config_data)

    # No blocking sleep/rerun here; st_autorefresh handles periodic refresh

if __name__ == "__main__":
    main()
