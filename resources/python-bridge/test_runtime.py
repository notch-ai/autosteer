#!/usr/bin/env python3
"""
Python Runtime Test Script

Tests the Python runtime environment and claude-code-sdk import capability.
Outputs JSON-formatted test results to stdout for consumption by PythonRuntimeService.

Output Format:
{
  "success": bool,
  "pythonVersion": str,
  "sdkVersion": str,
  "importStatus": "SUCCESS" | "FAILURE",
  "error": str | null,
  "timestamp": int
}
"""

import json
import sys
import time


def test_runtime():
    """Test Python runtime and claude-code-sdk import."""
    result = {
        "success": False,
        "pythonVersion": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "sdkVersion": "unknown",
        "importStatus": "FAILURE",
        "error": None,
        "timestamp": int(time.time() * 1000),
    }

    try:
        import claude_code_sdk

        if hasattr(claude_code_sdk, "__version__"):
            result["sdkVersion"] = claude_code_sdk.__version__
        else:
            try:
                import pkg_resources

                result["sdkVersion"] = pkg_resources.get_distribution(
                    "claude-code-sdk"
                ).version
            except:
                result["sdkVersion"] = "unknown"

        result["success"] = True
        result["importStatus"] = "SUCCESS"
    except ImportError as e:
        result["error"] = f"ImportError: {str(e)}"
        result["importStatus"] = "FAILURE"
    except Exception as e:
        result["error"] = f"Error: {str(e)}"
        result["importStatus"] = "FAILURE"

    print(json.dumps(result))


if __name__ == "__main__":
    test_runtime()
