# Local OpenCV Setup

## Purpose

Collie Video is preparing for visual duplicate detection that can use local OpenCV-based video and frame analysis. This setup is the local Python/OpenCV foundation plus a main-process-only fingerprint prototype. It does not add duplicate grouping, renderer UI, IPC, preload APIs, cache files, or app workflow integration.

OpenCV is local, free, and open source. This setup does not call a hosted AI service.

## Setup

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-opencv.txt
```

The npm helper uses the project-local `.venv/bin/python` interpreter:

```bash
npm run opencv:install
```

## Verify OpenCV

```bash
npm run opencv:verify
```

The verification script prints JSON with the OpenCV version, NumPy version, Python executable path, and Python version.

## Fingerprint Smoke Test

```bash
npm run opencv:fingerprint -- "/path/to/video.mp4" 5
```

This smoke test verifies that OpenCV can open a local video file, sample frames, and print a JSON `dhash-v1` visual fingerprint with timestamps, frame hashes, basic frame quality metrics, dimensions, duration, and warnings. It does not compare videos, create duplicate groups, or write persistent cache files.

The older metadata alias still points at the same helper:

```bash
npm run opencv:metadata -- "/path/to/video.mp4" 5
```

## Integration Boundary

The helper is callable from Electron main-process services only. Renderer code should not execute these scripts directly and should only interact with future functionality through typed preload IPC.
