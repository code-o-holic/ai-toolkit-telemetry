#!/usr/bin/env python3
"""
Quick fix for the Qwen Image import error.
Run this script to resolve the immediate issue.
"""

import sys
import subprocess

def main():
    print("🔧 Quick fix for Qwen Image import error...")
    
    # Try to upgrade diffusers
    try:
        print("📦 Upgrading diffusers...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "diffusers>=0.28.0"])
        print("✅ diffusers upgraded successfully")
    except subprocess.CalledProcessError:
        print("⚠️  Failed to upgrade diffusers, but continuing...")
    
    # Test if the import works now
    try:
        from diffusers import QwenImagePipeline
        print("✅ QwenImagePipeline import successful!")
        print("🎉 The issue is resolved! You can now run your training commands.")
    except ImportError:
        print("⚠️  QwenImagePipeline still not available, but the code will handle this gracefully.")
        print("   The training will work for other models, just not Qwen Image models.")
        print("   If you need Qwen Image support, try: pip install diffusers --upgrade")

if __name__ == "__main__":
    main()

