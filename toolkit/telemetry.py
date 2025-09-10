"""
Production-grade telemetry system for AI Toolkit training runs.
Provides JSONL/CSV logging with optional TensorBoard/W&B integration.
"""

import json
import csv
import os
import time
import threading
from datetime import datetime
from typing import Dict, Any, Optional, Union, List
from pathlib import Path
import psutil
import torch

class TelemetryLogger:
    """Production-grade telemetry logger with JSONL/CSV output and optional integrations."""
    
    def __init__(self, run_name: str, log_dir: str = "./logs", enable_tensorboard: bool = False, enable_wandb: bool = False):
        self.run_name = run_name
        self.log_dir = Path(log_dir)
        self.run_log_dir = self.log_dir / run_name
        self.enable_tensorboard = enable_tensorboard
        self.enable_wandb = enable_wandb
        
        # Create log directory
        self.run_log_dir.mkdir(parents=True, exist_ok=True)
        
        # Log files
        self.jsonl_path = self.run_log_dir / "metrics.jsonl"
        self.csv_path = self.run_log_dir / "metrics.csv"
        self.control_path = self.run_log_dir / "control.json"
        
        # CSV writer and fieldnames
        self.csv_file = None
        self.csv_writer = None
        self.csv_fieldnames = set()
        
        # Optional integrations
        self.tb_writer = None
        self.wandb_run = None
        
        # Control file monitoring
        self.control_lock = threading.Lock()
        self.last_control_check = 0
        self.control_debounce = 30  # 30 second debounce
        
        # Initialize integrations
        self._init_tensorboard()
        self._init_wandb()
        
        print(f"[telemetry] run_name={run_name}")
        print(f"[telemetry] Logging to {self.jsonl_path} (and {self.csv_path})")
    
    def _init_tensorboard(self):
        """Initialize TensorBoard writer if enabled."""
        if self.enable_tensorboard:
            try:
                from torch.utils.tensorboard import SummaryWriter
                tb_dir = self.run_log_dir / "tensorboard"
                self.tb_writer = SummaryWriter(tb_dir)
            except ImportError:
                print("[telemetry] TensorBoard requested but not available. Install with: pip install tensorboard")
                self.enable_tensorboard = False
    
    def _init_wandb(self):
        """Initialize W&B if enabled."""
        if self.enable_wandb:
            try:
                import wandb
                self.wandb_run = wandb.init(
                    name=self.run_name,
                    project="ai-toolkit",
                    dir=str(self.run_log_dir)
                )
            except ImportError:
                print("[telemetry] W&B requested but not available. Install with: pip install wandb")
                self.enable_wandb = False
    
    def _get_system_metrics(self) -> Dict[str, Any]:
        """Get current system metrics."""
        metrics = {}
        
        # CPU memory
        try:
            process = psutil.Process()
            metrics["cpu_mem_rss_mb"] = process.memory_info().rss / 1024 / 1024
        except:
            metrics["cpu_mem_rss_mb"] = None
        
        # GPU memory
        if torch.cuda.is_available():
            try:
                metrics["gpu_mem_allocated"] = torch.cuda.memory_allocated() / 1024 / 1024 / 1024  # GB
                metrics["gpu_mem_reserved"] = torch.cuda.memory_reserved() / 1024 / 1024 / 1024  # GB
            except:
                metrics["gpu_mem_allocated"] = None
                metrics["gpu_mem_reserved"] = None
        else:
            metrics["gpu_mem_allocated"] = None
            metrics["gpu_mem_reserved"] = None
            
        return metrics
    
    def _detect_anomalies(self, metrics: Dict[str, Any]) -> Dict[str, bool]:
        """Detect training anomalies."""
        anomalies = {}
        
        # Check for NaN/Inf in loss
        loss = metrics.get("train_loss")
        if loss is not None:
            anomalies["nan_inf_detected"] = not (isinstance(loss, (int, float)) and 
                                               not (loss != loss or abs(loss) == float('inf')))
        else:
            anomalies["nan_inf_detected"] = False
            
        return anomalies
    
    def _write_jsonl(self, record: Dict[str, Any]):
        """Write record to JSONL file."""
        try:
            with open(self.jsonl_path, 'a', encoding='utf-8') as f:
                json.dump(record, f, ensure_ascii=False)
                f.write('\n')
                f.flush()
        except Exception as e:
            print(f"[telemetry] Error writing JSONL: {e}")
    
    def _init_csv_writer(self, fieldnames: List[str]):
        """Initialize CSV writer with given fieldnames."""
        try:
            self.csv_file = open(self.csv_path, 'w', newline='', encoding='utf-8')
            self.csv_writer = csv.DictWriter(self.csv_file, fieldnames=fieldnames)
            self.csv_writer.writeheader()
            self.csv_file.flush()
        except Exception as e:
            print(f"[telemetry] Error initializing CSV: {e}")
    
    def _write_csv(self, record: Dict[str, Any]):
        """Write record to CSV file."""
        try:
            if self.csv_writer is None:
                # First record - initialize CSV with all fields
                fieldnames = sorted(record.keys())
                self._init_csv_writer(fieldnames)
                self.csv_fieldnames.update(fieldnames)
            else:
                # Check if we need to add new fields
                new_fields = set(record.keys()) - self.csv_fieldnames
                if new_fields:
                    # Need to recreate CSV with new fields
                    self.csv_file.close()
                    self.csv_fieldnames.update(new_fields)
                    fieldnames = sorted(self.csv_fieldnames)
                    
                    # Read existing data
                    existing_data = []
                    if self.csv_path.exists():
                        with open(self.csv_path, 'r', encoding='utf-8') as f:
                            reader = csv.DictReader(f)
                            existing_data = list(reader)
                    
                    # Recreate CSV with new fields
                    self._init_csv_writer(fieldnames)
                    for row in existing_data:
                        self.csv_writer.writerow(row)
            
            # Write the record
            if self.csv_writer:
                self.csv_writer.writerow(record)
                self.csv_file.flush()
        except Exception as e:
            print(f"[telemetry] Error writing CSV: {e}")
    
    def _write_tensorboard(self, record: Dict[str, Any]):
        """Write metrics to TensorBoard."""
        if not self.tb_writer:
            return
            
        try:
            step = record.get("global_step", 0)
            for key, value in record.items():
                if isinstance(value, (int, float)) and key not in ["global_step", "epoch", "time"]:
                    self.tb_writer.add_scalar(key, value, step)
            self.tb_writer.flush()
        except Exception as e:
            print(f"[telemetry] Error writing TensorBoard: {e}")
    
    def _write_wandb(self, record: Dict[str, Any]):
        """Write metrics to W&B."""
        if not self.wandb_run:
            return
            
        try:
            step = record.get("global_step")
            wandb_record = {k: v for k, v in record.items() 
                           if isinstance(v, (int, float, str)) and k not in ["time"]}
            self.wandb_run.log(wandb_record, step=step)
        except Exception as e:
            print(f"[telemetry] Error writing W&B: {e}")
    
    def log_start(self, config: Dict[str, Any], lora_config: Dict[str, Any], 
                  model_info: Dict[str, Any], training_info: Dict[str, Any]):
        """Log training start with configuration."""
        record = {
            "event": "start",
            "time": time.time(),
            "timestamp": datetime.now().isoformat(),
            "run_name": self.run_name,
            **config,
            **lora_config,
            **model_info,
            **training_info
        }
        
        self._write_jsonl(record)
        self._write_csv(record)
        
        if self.enable_tensorboard:
            self._write_tensorboard(record)
        if self.enable_wandb:
            self._write_wandb(record)
    
    def log_step(self, global_step: int, epoch: int, metrics: Dict[str, Any]):
        """Log training step metrics."""
        # Add system metrics and anomaly detection
        system_metrics = self._get_system_metrics()
        anomalies = self._detect_anomalies(metrics)
        
        record = {
            "event": "step",
            "time": time.time(),
            "timestamp": datetime.now().isoformat(),
            "global_step": global_step,
            "epoch": epoch,
            **metrics,
            **system_metrics,
            **anomalies
        }
        
        self._write_jsonl(record)
        self._write_csv(record)
        
        if self.enable_tensorboard:
            self._write_tensorboard(record)
        if self.enable_wandb:
            self._write_wandb(record)
    
    def log_epoch(self, epoch: int, metrics: Dict[str, Any]):
        """Log epoch-end metrics."""
        record = {
            "event": "epoch",
            "time": time.time(),
            "timestamp": datetime.now().isoformat(),
            "epoch": epoch,
            **metrics
        }
        
        self._write_jsonl(record)
        self._write_csv(record)
        
        if self.enable_tensorboard:
            self._write_tensorboard(record)
        if self.enable_wandb:
            self._write_wandb(record)
    
    def log_checkpoint(self, global_step: int, checkpoint_path: str, is_best: bool = False):
        """Log checkpoint save."""
        record = {
            "event": "checkpoint",
            "time": time.time(),
            "timestamp": datetime.now().isoformat(),
            "global_step": global_step,
            "checkpoint_path": checkpoint_path,
            "is_best": is_best
        }
        
        self._write_jsonl(record)
        self._write_csv(record)
    
    def log_eval(self, global_step: int, metrics: Dict[str, Any]):
        """Log evaluation metrics."""
        record = {
            "event": "eval",
            "time": time.time(),
            "timestamp": datetime.now().isoformat(),
            "global_step": global_step,
            **{f"eval/{k}": v for k, v in metrics.items()}
        }
        
        self._write_jsonl(record)
        self._write_csv(record)
        
        if self.enable_tensorboard:
            self._write_tensorboard(record)
        if self.enable_wandb:
            self._write_wandb(record)
    
    def check_control_file(self) -> Optional[Dict[str, Any]]:
        """Check for control file changes with debouncing."""
        current_time = time.time()
        
        with self.control_lock:
            if current_time - self.last_control_check < 2:  # Check every 2 seconds
                return None
            
            self.last_control_check = current_time
            
            if not self.control_path.exists():
                return None
                
            try:
                with open(self.control_path, 'r') as f:
                    control_data = json.load(f)
                
                # Check if enough time has passed since last change
                change_time = control_data.get('timestamp', 0)
                if current_time - change_time < self.control_debounce:
                    return None
                    
                return control_data
            except Exception as e:
                print(f"[telemetry] Error reading control file: {e}")
                return None
    
    def log_control_change(self, old_value: Any, new_value: Any, source: str = "dashboard"):
        """Log control parameter change."""
        record = {
            "event": "control_change",
            "time": time.time(),
            "timestamp": datetime.now().isoformat(),
            "old": old_value,
            "new": new_value,
            "source": source
        }
        
        self._write_jsonl(record)
        self._write_csv(record)
    
    def close(self):
        """Clean up resources."""
        try:
            if self.csv_file:
                self.csv_file.close()
            if self.tb_writer:
                self.tb_writer.close()
            if self.wandb_run:
                self.wandb_run.finish()
        except Exception as e:
            print(f"[telemetry] Error during cleanup: {e}")


def get_run_name(config: Dict[str, Any]) -> str:
    """Generate run name from config or timestamp."""
    # Prefer the training/LORA name if present
    name = config.get('config', {}).get('name') or config.get('name')
    if name:
        return name
    
    # Fall back to timestamp
    now = datetime.now()
    return f"run-{now.strftime('%Y%m%d_%H%M%S')}"


def extract_lora_metadata(network_config: Dict[str, Any]) -> Dict[str, Any]:
    """Extract LoRA metadata from network config."""
    metadata = {}
    
    if network_config:
        metadata.update({
            "lora_type": network_config.get("type", "lora"),
            "lora_rank": network_config.get("linear", network_config.get("rank", 4)),
            "lora_alpha": network_config.get("linear_alpha", network_config.get("alpha", 1.0)),
            "lora_conv_rank": network_config.get("conv"),
            "lora_conv_alpha": network_config.get("conv_alpha"),
            "lora_dropout": network_config.get("dropout"),
        })
        
        # Extract target modules info
        network_kwargs = network_config.get("network_kwargs", {})
        if "only_if_contains" in network_kwargs:
            metadata["lora_target_modules"] = network_kwargs["only_if_contains"]
        if "ignore_if_contains" in network_kwargs:
            metadata["lora_ignore_modules"] = network_kwargs["ignore_if_contains"]
    
    return metadata


def extract_model_info(model_config: Dict[str, Any], sd_model=None) -> Dict[str, Any]:
    """Extract model information."""
    info = {
        "model_name_or_path": model_config.get("name_or_path"),
        "is_flux": model_config.get("is_flux", False),
        "is_sdxl": model_config.get("is_sdxl", False),
        "is_v2": model_config.get("is_v2", False),
        "quantize": model_config.get("quantize", False),
        "low_vram": model_config.get("low_vram", False),
    }
    
    # Try to get parameter counts if model is available
    if sd_model and hasattr(sd_model, 'network'):
        try:
            network = sd_model.network
            if network:
                trainable_params = sum(p.numel() for p in network.parameters() if p.requires_grad)
                total_params = sum(p.numel() for p in network.parameters())
                info.update({
                    "trainable_params": trainable_params,
                    "total_params": total_params,
                })
        except:
            pass
    
    return info


def extract_training_info(train_config: Dict[str, Any]) -> Dict[str, Any]:
    """Extract training configuration info."""
    return {
        "batch_size": train_config.get("batch_size", 1),
        "gradient_accumulation_steps": train_config.get("gradient_accumulation_steps", 1),
        "effective_batch_size": train_config.get("batch_size", 1) * train_config.get("gradient_accumulation_steps", 1),
        "learning_rate": train_config.get("lr", 1e-4),
        "optimizer": train_config.get("optimizer", "adamw"),
        "scheduler": train_config.get("scheduler", "constant"),
        "warmup_steps": train_config.get("warmup_steps", 0),
        "max_steps": train_config.get("steps", 1000),
        "dtype": train_config.get("dtype", "float32"),
        "gradient_checkpointing": train_config.get("gradient_checkpointing", False),
        "noise_scheduler": train_config.get("noise_scheduler", "ddpm"),
    }
