#!/usr/bin/env python3
import json
import platform
import sys


def print_json(payload):
    print(json.dumps(payload, indent=2))


def main():
    try:
        import cv2
        import numpy
    except Exception as exc:
        print_json(
            {
                "ok": False,
                "error": f"{type(exc).__name__}: {exc}",
                "pythonExecutable": sys.executable,
                "pythonVersion": platform.python_version(),
            }
        )
        return 1

    print_json(
        {
            "ok": True,
            "opencvVersion": cv2.__version__,
            "numpyVersion": numpy.__version__,
            "pythonExecutable": sys.executable,
            "pythonVersion": platform.python_version(),
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
