#!/bin/bash

# Development startup script for Electron with ICU and GPU fixes
# Based on recognized solutions for macOS Big Sur+ issues

echo "Starting Electron with ICU and GPU fixes..."

# Set environment variables to suppress warnings
export ELECTRON_DISABLE_SECURITY_WARNINGS=true
export ELECTRON_NO_ATTACH_CONSOLE=true

# Set Electron flags via environment variable
export ELECTRON_FLAGS="--disable-gpu-sandbox --no-sandbox"

# Run Electron Forge start and filter out ICU/GPU errors
npx electron-forge start 2>&1 | grep -v "ERROR:icu_util.cc" | grep -v "ERROR:gpu_process_host.cc" | grep -v "ERROR:network_service_instance_impl.cc"