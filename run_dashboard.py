#!/usr/bin/env python3
"""
Launch script for the AI Toolkit Training Dashboard.
"""

import subprocess
import sys
import os
from pathlib import Path

def check_requirements():
    """Check if required packages are installed."""
    try:
        import streamlit
        import plotly
        import pandas
        import numpy
        return True
    except ImportError as e:
        print(f"Missing required package: {e}")
        print("Please install dashboard requirements:")
        print("pip install -r dashboard_requirements.txt")
        return False

def main():
    """Launch the Streamlit dashboard."""
    if not check_requirements():
        sys.exit(1)
    
    # Check if logs directory exists
    logs_dir = Path("./logs")
    if not logs_dir.exists():
        print("Creating logs directory...")
        logs_dir.mkdir(exist_ok=True)
        print("Logs directory created. Start a training run with telemetry enabled to see data.")
    
    # Launch Streamlit
    print("Starting AI Toolkit Training Dashboard...")
    print("Dashboard will be available at: http://localhost:8501")
    print("Press Ctrl+C to stop the dashboard")
    
    try:
        subprocess.run([
            sys.executable, "-m", "streamlit", "run", "dashboard.py",
            "--server.port", "8501",
            "--server.address", "localhost",
            "--browser.gatherUsageStats", "false"
        ])
    except KeyboardInterrupt:
        print("\nDashboard stopped.")

if __name__ == "__main__":
    main()
