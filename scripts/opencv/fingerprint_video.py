#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path


def print_json(payload):
    print(json.dumps(payload, indent=2))


class JsonArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        print_json({"ok": False, "error": message})
        raise SystemExit(2)


def parse_args():
    parser = JsonArgumentParser(
        description=(
            "Prototype-safe OpenCV metadata probe. This does not create "
            "fingerprints, compare videos, or write cache files."
        )
    )
    parser.add_argument("file_path", help="Path to a local video file.")
    parser.add_argument(
        "sample_interval_seconds",
        nargs="?",
        type=float,
        default=5,
        help="Reserved sample interval for future frame analysis.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if args.sample_interval_seconds <= 0:
        print_json({"ok": False, "error": "sample_interval_seconds must be greater than 0"})
        return 2

    video_path = Path(args.file_path).expanduser()
    if not video_path.exists():
        print_json({"ok": False, "error": "Video file does not exist", "filePath": str(video_path)})
        return 1

    if not video_path.is_file():
        print_json({"ok": False, "error": "Path is not a file", "filePath": str(video_path)})
        return 1

    try:
        import cv2
    except Exception as exc:
        print_json({"ok": False, "error": f"{type(exc).__name__}: {exc}"})
        return 1

    capture = cv2.VideoCapture(str(video_path))
    try:
        if not capture.isOpened():
            print_json({"ok": False, "error": "Could not open video file", "filePath": str(video_path)})
            return 1

        fps = capture.get(cv2.CAP_PROP_FPS)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        duration_seconds = frame_count / fps if fps and fps > 0 else None

        print_json(
            {
                "ok": True,
                "filePath": str(video_path),
                "fps": fps if fps and fps > 0 else None,
                "frameCount": frame_count,
                "durationSeconds": duration_seconds,
                "width": width,
                "height": height,
                "sampleIntervalSeconds": args.sample_interval_seconds,
            }
        )
        return 0
    finally:
        capture.release()


if __name__ == "__main__":
    raise SystemExit(main())
