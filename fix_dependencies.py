#!/usr/bin/env python3
"""
Script to fix dependency issues with diffusers and Qwen Image support.
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Run a command and handle errors."""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"Error: {e.stderr}")
        return False

def main():
    """Main function to fix dependencies."""
    print("🔧 Fixing AI Toolkit dependencies...")
    
    # Check if we're in a virtual environment
    if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("⚠️  Warning: It appears you're not in a virtual environment.")
        print("   Consider creating one: python -m venv env && source env/bin/activate")
    
    # Update pip
    if not run_command("python -m pip install --upgrade pip", "Updating pip"):
        return False
    
    # Install/upgrade diffusers to a version that supports Qwen Image
    if not run_command("pip install --upgrade diffusers>=0.28.0", "Installing diffusers with Qwen Image support"):
        return False
    
    # Install other requirements
    if not run_command("pip install -r requirements.txt", "Installing other requirements"):
        return False
    
    # Test the import
    print("🧪 Testing Qwen Image import...")
    try:
        import diffusers
        print(f"✅ diffusers version: {diffusers.__version__}")
        
        # Try to import Qwen Image components
        try:
            from diffusers import QwenImagePipeline, QwenImageTransformer2DModel, AutoencoderKLQwenImage
            print("✅ Qwen Image components are available!")
        except ImportError:
            print("⚠️  Qwen Image components are not available in this diffusers version")
            print("   This is normal if you don't need Qwen Image support")
            
    except ImportError as e:
        print(f"❌ Failed to import diffusers: {e}")
        return False
    
    print("\n🎉 Dependency fix completed!")
    print("You can now run your training commands.")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

