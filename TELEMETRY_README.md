# AI Toolkit Telemetry System

This document describes the production-grade telemetry system implemented for AI Toolkit training runs.

## Overview

The telemetry system provides comprehensive logging and monitoring capabilities for LoRA training, including:

- **JSONL/CSV logging** - Primary metrics storage in structured formats
- **Live dashboard** - Real-time monitoring via Streamlit
- **Safe control** - Dynamic log interval adjustment with safety guards
- **Optional integrations** - TensorBoard and W&B support
- **Anomaly detection** - Automatic detection of training issues

## Quick Start

### 1. Enable Telemetry in Config

Add the telemetry section to your training config:

```yaml
telemetry:
  enabled: true
  log_dir: "./logs"
  tensorboard: false  # Optional
  wandb: false       # Optional
```

### 2. Start Training

```bash
python run.py config/examples/train_lora_flux_24gb_with_telemetry.yaml
```

### 3. Launch Dashboard

```bash
python run_dashboard.py
```

The dashboard will be available at http://localhost:8501

## File Structure

When telemetry is enabled, each training run creates:

```
./logs/
└── <run_name>/
    ├── metrics.jsonl      # Primary log (JSON Lines)
    ├── metrics.csv        # Mirror in CSV format
    ├── control.json       # Dashboard control file
    └── tensorboard/       # TensorBoard logs (if enabled)
```

## Logged Metrics

### Startup Record
- Configuration snapshot
- LoRA metadata (rank, alpha, target modules)
- Model info (parameters, architecture)
- Training setup (batch size, optimizer, scheduler)

### Step Records (every log_every steps)
- `train_loss` - Training loss value
- `lr` - Current learning rate
- `grad_norm` - Gradient norm (if available)
- `samples_per_sec` - Training speed
- `sec_per_step` - Time per step
- `gpu_mem_allocated` - GPU memory usage (GB)
- `gpu_mem_reserved` - GPU memory reserved (GB)
- `cpu_mem_rss_mb` - CPU memory usage (MB)
- `nan_inf_detected` - Anomaly flag

### Epoch Records
- End-of-epoch metrics
- Validation loss (if available)

### Checkpoint Records
- Checkpoint save events
- File paths and metadata

## Dashboard Features

### Monitoring Panels
- **Run Overview** - Progress, current metrics, configuration
- **Loss Visualization** - Training loss with optional EMA smoothing
- **Learning Rate** - LR schedule visualization
- **System Metrics** - GPU/CPU usage, gradient norms, speed
- **Anomaly Detection** - Automatic issue detection and alerts

### Training Control
- **Log Interval Control** - Adjust logging frequency safely
- **Real-time Updates** - Auto-refresh every 5 seconds
- **Historical View** - Browse past training runs

### Diagnostics
The dashboard automatically detects:
- 🚨 NaN/Inf values in loss
- 📈 Loss plateaus
- 💥 Exploding gradients
- 🐌 Low GPU utilization
- 📊 Potential overfitting

## Safe Control System

The control system allows safe runtime adjustment of training parameters:

### Log Interval Control
- Adjust `log_every` parameter via dashboard
- 30-second debounce to prevent spam
- Value clamping (5 ≤ log_every ≤ 2000)
- Non-blocking operation (never interrupts training step)

### Control File Protocol
1. Dashboard writes `control.json` with new parameters
2. Training process polls file every 2-5 seconds
3. Changes applied between training steps with debounce
4. Control change logged to metrics

Example control file:
```json
{
  "log_every": 100,
  "timestamp": 1703123456.789
}
```

## Configuration Options

### Telemetry Config
```yaml
telemetry:
  enabled: true              # Enable/disable telemetry
  log_dir: "./logs"         # Log directory path
  tensorboard: false        # Enable TensorBoard integration
  wandb: false             # Enable W&B integration
```

### Integration with Existing Logging
The telemetry system works alongside existing logging:
- **TensorBoard** - Existing `log_dir` config still works
- **W&B** - Existing `logging.use_wandb` config still works
- **Console** - Standard progress bars and prints unchanged

## Performance Impact

The telemetry system is designed for minimal overhead:
- **Logging**: Append-only operations, async where possible
- **System metrics**: Lightweight sampling using psutil/torch
- **Control checking**: Only every 2-5 seconds with debounce
- **Target overhead**: <5% training slowdown

## Data Format

### JSONL Format
Each line is a complete JSON record:
```json
{"event": "start", "time": 1703123456.789, "run_name": "greyjacket", "lora_rank": 16, ...}
{"event": "step", "time": 1703123457.123, "global_step": 1, "train_loss": 0.1234, ...}
{"event": "checkpoint", "time": 1703123500.456, "checkpoint_path": "./output/model.safetensors", ...}
```

### CSV Format
Wide format with all possible columns, automatically expanded as new metrics appear.

## Troubleshooting

### No Data in Dashboard
1. Check that telemetry is enabled in config
2. Verify `./logs/` directory exists and has run folders
3. Ensure training has started (look for metrics.jsonl files)

### Control Not Working
1. Check that control.json is being written to run directory
2. Verify training process has file system access
3. Look for "control_change" events in metrics.jsonl

### Performance Issues
1. Reduce logging frequency (increase log_every)
2. Disable optional integrations (tensorboard, wandb)
3. Check disk space and I/O performance

### Missing Dependencies
Install dashboard requirements:
```bash
pip install -r dashboard_requirements.txt
```

## Advanced Usage

### Custom Metrics
The telemetry system can be extended to log custom metrics by modifying the `log_step()` calls in the training code.

### Integration with Monitoring Systems
The JSONL format can be easily ingested by monitoring systems like:
- Prometheus (via file-based exporters)
- ELK Stack (Elasticsearch/Logstash/Kibana)
- Custom monitoring solutions

### Batch Analysis
Use the CSV files for batch analysis:
```python
import pandas as pd
df = pd.read_csv('./logs/greyjacket/metrics.csv')
step_data = df[df['event'] == 'step']
# Analyze training dynamics...
```

## Architecture

### Components
- `toolkit/telemetry.py` - Core telemetry logger
- `dashboard.py` - Streamlit dashboard application
- `run_dashboard.py` - Dashboard launcher script
- Integration points in `BaseSDTrainProcess` and `SDTrainer`

### Design Principles
1. **Fail-safe**: Never crash training due to logging errors
2. **Non-blocking**: Minimal impact on training performance
3. **Structured**: Machine-readable formats for analysis
4. **Extensible**: Easy to add new metrics and integrations

## Example Usage

### Training with Telemetry
```bash
# Start training with telemetry
python run.py config/examples/train_lora_flux_24gb_with_telemetry.yaml

# In another terminal, start dashboard
python run_dashboard.py

# Open browser to http://localhost:8501
```

### Expected Output
```
[telemetry] run_name=greyjacket
[telemetry] Logging to ./logs/greyjacket/metrics.jsonl (and metrics.csv)
```

The system will create comprehensive logs and provide real-time monitoring capabilities for your LoRA training runs.
