#!/bin/bash
# Bundle Python virtual environment for Electron app
# Target: <100MB compressed size
#
# Usage: ./bundle-python.sh
#
# What it does:
# 1. Validates that the Python virtual environment exists
# 2. Cleans unnecessary files to reduce bundle size:
#    - __pycache__ directories
#    - .pyc and .pyo bytecode files
#    - test directories
#    - documentation directories
#    - .dist-info RECORD files
#    - .egg-info directories
# 3. Reports size reduction statistics
#
# Requirements:
# - Python virtual environment must exist at ../ai-service-v2/.venv
# - Run from autosteer/scripts directory

set -e  # Exit on error

VENV_PATH="../ai-service-v2/.venv"

echo "🐍 Python Runtime Bundler"
echo "========================"

# Check if venv exists
if [ ! -d "$VENV_PATH" ]; then
    echo "❌ Error: Virtual environment not found at $VENV_PATH"
    echo "Run: cd ai-service-v2 && poetry install"
    exit 1
fi

# Get initial size
INITIAL_SIZE=$(du -sh "$VENV_PATH" | cut -f1)
echo "📊 Initial size: $INITIAL_SIZE"

# Clean unnecessary files
echo "🧹 Cleaning unnecessary files..."

# Remove __pycache__ directories
find "$VENV_PATH" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Remove .pyc and .pyo files
find "$VENV_PATH" -type f -name "*.pyc" -delete 2>/dev/null || true
find "$VENV_PATH" -type f -name "*.pyo" -delete 2>/dev/null || true

# Remove test directories
find "$VENV_PATH" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "$VENV_PATH" -type d -name "test" -exec rm -rf {} + 2>/dev/null || true

# Remove docs
find "$VENV_PATH" -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true

# Remove .dist-info RECORD files (safe to remove)
find "$VENV_PATH" -path "*dist-info/RECORD" -delete 2>/dev/null || true

# Remove .egg-info
find "$VENV_PATH" -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

# Get final size
FINAL_SIZE=$(du -sh "$VENV_PATH" | cut -f1)
echo "✅ Final size: $FINAL_SIZE"
echo "📦 Bundle ready at: $VENV_PATH"
