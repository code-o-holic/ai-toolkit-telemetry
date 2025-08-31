"""
Streamlit dashboard for monitoring AI Toolkit training runs.
Provides live metrics visualization and safe log interval control.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import json
import os
import time
from pathlib import Path
from datetime import datetime, timedelta
import numpy as np

# Page config
st.set_page_config(
    page_title="AI Toolkit Training Dashboard",
    page_icon="🚀",
    layout="wide",
    initial_sidebar_state="expanded"
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
    st.title("🚀 AI Toolkit Training Dashboard")
    st.markdown("Real-time monitoring and control for AI Toolkit training runs")
    
    # Sidebar - Run selection
    st.sidebar.header("Training Runs")
    
    runs = get_available_runs()
    if not runs:
        st.warning("No training runs found in ./logs/ directory")
        st.info("Start a training run with telemetry enabled to see data here.")
        return
    
    # Run selector
    run_options = [f"{r['name']} ({r['config_name']})" for r in runs]
    selected_idx = st.sidebar.selectbox(
        "Select training run:",
        range(len(run_options)),
        format_func=lambda x: run_options[x]
    )
    
    selected_run = runs[selected_idx]
    
    # Auto-refresh toggle
    auto_refresh = st.sidebar.checkbox("Auto-refresh (5s)", value=True)
    if auto_refresh:
        time.sleep(5)
        st.rerun()
    
    # Manual refresh button
    if st.sidebar.button("🔄 Refresh Now"):
        st.rerun()
    
    # Load data
    data = load_jsonl_data(selected_run["path"])
    if not data:
        st.error("No data available for selected run")
        return
    
    # Run info
    start_record = next((r for r in data if r.get("event") == "start"), None)
    step_records = [r for r in data if r.get("event") == "step"]
    
    st.header(f"📊 {selected_run['name']}")
    
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
        st.warning("No step data available yet")
        return
    
    # Prepare data for charts
    df = pd.DataFrame(step_records)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Smoothing option
    use_smoothing = st.checkbox("📈 Apply EMA smoothing", value=True)
    
    # Loss plot
    st.subheader("📉 Training Loss")
    fig_loss = go.Figure()
    
    if 'train_loss' in df.columns:
        losses = df['train_loss'].fillna(0)
        if use_smoothing:
            losses_smooth = apply_ema_smoothing(losses.tolist())
            fig_loss.add_trace(go.Scatter(
                x=df['global_step'],
                y=losses_smooth,
                mode='lines',
                name='Loss (smoothed)',
                line=dict(color='blue')
            ))
            fig_loss.add_trace(go.Scatter(
                x=df['global_step'],
                y=losses,
                mode='lines',
                name='Loss (raw)',
                line=dict(color='lightblue', width=1),
                opacity=0.3
            ))
        else:
            fig_loss.add_trace(go.Scatter(
                x=df['global_step'],
                y=losses,
                mode='lines',
                name='Loss',
                line=dict(color='blue')
            ))
    
    fig_loss.update_layout(
        xaxis_title="Step",
        yaxis_title="Loss",
        yaxis_type="log" if st.checkbox("Log scale", key="loss_log") else "linear",
        height=400
    )
    st.plotly_chart(fig_loss, use_container_width=True)
    
    # Learning rate plot
    st.subheader("📊 Learning Rate")
    fig_lr = go.Figure()
    
    if 'lr' in df.columns:
        fig_lr.add_trace(go.Scatter(
            x=df['global_step'],
            y=df['lr'],
            mode='lines',
            name='Learning Rate',
            line=dict(color='green')
        ))
    
    fig_lr.update_layout(
        xaxis_title="Step",
        yaxis_title="Learning Rate",
        height=300
    )
    st.plotly_chart(fig_lr, use_container_width=True)
    
    # Multi-metric plot
    st.subheader("📈 Training Metrics")
    
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
            go.Scatter(x=df['global_step'], y=grad_norms, mode='lines', name='Grad Norm'),
            row=1, col=1
        )
    
    # GPU memory
    if 'gpu_mem_allocated' in df.columns:
        gpu_mem = df['gpu_mem_allocated'].fillna(0)
        fig_multi.add_trace(
            go.Scatter(x=df['global_step'], y=gpu_mem, mode='lines', name='GPU Mem', line=dict(color='red')),
            row=1, col=2
        )
    
    # Speed
    if 'samples_per_sec' in df.columns:
        speed = df['samples_per_sec'].fillna(0)
        fig_multi.add_trace(
            go.Scatter(x=df['global_step'], y=speed, mode='lines', name='Speed', line=dict(color='purple')),
            row=2, col=1
        )
    
    # CPU memory
    if 'cpu_mem_rss_mb' in df.columns:
        cpu_mem = df['cpu_mem_rss_mb'].fillna(0)
        fig_multi.add_trace(
            go.Scatter(x=df['global_step'], y=cpu_mem, mode='lines', name='CPU Mem', line=dict(color='orange')),
            row=2, col=2
        )
    
    fig_multi.update_layout(height=600, showlegend=False)
    st.plotly_chart(fig_multi, use_container_width=True)
    
    # Recent events table
    st.subheader("📋 Recent Events")
    
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
    
    # Configuration info
    if start_record:
        with st.expander("⚙️ Training Configuration"):
            config_data = {k: v for k, v in start_record.items() if k not in ["event", "timestamp", "time"]}
            st.json(config_data)

if __name__ == "__main__":
    main()
