#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path


ALGORITHM = "dhash-v1"
ALGORITHM_VERSION = "1"
LOW_MEAN_THRESHOLD = 5.0
HIGH_MEAN_THRESHOLD = 250.0
LOW_STDDEV_THRESHOLD = 2.0


def print_json(payload):
    print(json.dumps(payload, indent=2))


class JsonArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        print_json({"ok": False, "error": message})
        raise SystemExit(2)


def parse_args():
    parser = JsonArgumentParser(
        description="Generate a prototype OpenCV perceptual fingerprint for one local video."
    )
    parser.add_argument("file_path", help="Path to a local video file.")
    parser.add_argument(
        "sample_interval_seconds",
        nargs="?",
        type=float,
        default=5.0,
        help="Seconds between requested samples.",
    )
    parser.add_argument(
        "--max-samples",
        type=int,
        default=240,
        help="Maximum number of frame samples to include.",
    )
    parser.add_argument(
        "--profile",
        choices=["fast", "deep"],
        default="fast",
        help="Scan profile recorded in the output fingerprint.",
    )
    parser.add_argument(
        "--algorithm",
        choices=[ALGORITHM],
        default=ALGORITHM,
        help="Fingerprint algorithm to use.",
    )
    return parser.parse_args()


def normalize_path(file_path):
    return Path(file_path).expanduser().resolve()


def get_duration_seconds(fps, frame_count):
    if fps and fps > 0 and frame_count > 0:
        return frame_count / fps
    return None


def build_sample_times(duration_seconds, sample_interval_seconds, max_samples):
    if duration_seconds is None or duration_seconds <= 0:
        return [0.0]

    start_seconds = 1.0 if duration_seconds > 2.5 else 0.0
    end_seconds = (
        duration_seconds - 1.0
        if duration_seconds > 2.5
        else max(0.0, duration_seconds - min(0.1, duration_seconds / 10.0))
    )

    if end_seconds <= start_seconds:
        return [max(0.0, duration_seconds / 2.0)]

    times = []
    current = start_seconds
    epsilon = min(0.001, sample_interval_seconds / 1000.0)

    while current <= end_seconds + epsilon:
        times.append(min(current, end_seconds))
        current += sample_interval_seconds

    if len(times) < 3 and duration_seconds >= 1.0:
        wanted = min(3, max_samples)
        if wanted > len(times):
            times = evenly_spaced_times(start_seconds, end_seconds, wanted)

    if len(times) > max_samples:
        times = evenly_spaced_times(start_seconds, end_seconds, max_samples)

    return dedupe_times(times)


def evenly_spaced_times(start_seconds, end_seconds, count):
    if count <= 1:
        return [round((start_seconds + end_seconds) / 2.0, 3)]

    step = (end_seconds - start_seconds) / (count - 1)
    return [round(start_seconds + (step * index), 3) for index in range(count)]


def dedupe_times(times):
    seen = set()
    deduped = []
    for time_seconds in times:
        rounded = round(max(0.0, float(time_seconds)), 3)
        if rounded in seen:
            continue
        seen.add(rounded)
        deduped.append(rounded)
    return deduped


def dhash_hex(grayscale_frame, cv2):
    resized = cv2.resize(grayscale_frame, (9, 8), interpolation=cv2.INTER_AREA)
    diff = resized[:, 1:] > resized[:, :-1]

    value = 0
    for bit in diff.flatten():
        value = (value << 1) | int(bool(bit))

    return f"{value:016x}"


def sample_frame(capture, time_seconds, cv2):
    capture.set(cv2.CAP_PROP_POS_MSEC, max(0.0, time_seconds) * 1000.0)
    ok, frame = capture.read()

    if not ok or frame is None:
        return None

    grayscale = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    mean = float(grayscale.mean())
    stddev = float(grayscale.std())
    is_low_information = (
        mean <= LOW_MEAN_THRESHOLD
        or mean >= HIGH_MEAN_THRESHOLD
        or stddev <= LOW_STDDEV_THRESHOLD
    )

    return {
        "timeSeconds": round(float(time_seconds), 3),
        "hash": dhash_hex(grayscale, cv2),
        "frameMean": round(mean, 3),
        "frameStdDev": round(stddev, 3),
        "isLowInformation": is_low_information,
    }


def main():
    args = parse_args()

    if not math.isfinite(args.sample_interval_seconds) or args.sample_interval_seconds <= 0:
        print_json({"ok": False, "error": "sample_interval_seconds must be greater than 0"})
        return 2

    if args.max_samples <= 0:
        print_json({"ok": False, "error": "max_samples must be greater than 0"})
        return 2

    video_path = normalize_path(args.file_path)
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
        duration_seconds = get_duration_seconds(fps, frame_count)
        sample_times = build_sample_times(
            duration_seconds,
            args.sample_interval_seconds,
            args.max_samples,
        )

        samples = []
        warnings = []
        for time_seconds in sample_times:
            sample = sample_frame(capture, time_seconds, cv2)
            if sample is None:
                warnings.append(f"Could not read frame at {time_seconds:.3f}s.")
                continue
            samples.append(sample)

        if not samples:
            print_json(
                {
                    "ok": False,
                    "error": "No frames could be sampled.",
                    "filePath": str(video_path),
                    "warnings": warnings,
                }
            )
            return 1

        stat = video_path.stat()
        print_json(
            {
                "ok": True,
                "filePath": str(video_path),
                "fileName": video_path.name,
                "directory": str(video_path.parent),
                "sizeBytes": stat.st_size,
                "modifiedTimeMs": int(stat.st_mtime * 1000),
                "durationSeconds": duration_seconds,
                "width": width if width > 0 else None,
                "height": height if height > 0 else None,
                "frameRate": fps if fps and fps > 0 else None,
                "frameCount": frame_count,
                "profile": args.profile,
                "sampleIntervalSeconds": args.sample_interval_seconds,
                "algorithm": args.algorithm,
                "algorithmVersion": ALGORITHM_VERSION,
                "samples": samples,
                "warnings": warnings,
            }
        )
        return 0
    finally:
        capture.release()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print_json({"ok": False, "error": "Operation canceled."})
        raise SystemExit(130)
