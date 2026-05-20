# Local OpenCV Setup

## Purpose

Collie Video is preparing for future visual duplicate detection that can use local OpenCV-based video and frame analysis. This setup is only the local Python/OpenCV foundation. It does not add duplicate detection behavior, renderer UI, IPC, preload APIs, cache files, or app workflow integration.

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

## Metadata Smoke Test

```bash
npm run opencv:metadata -- "/path/to/video.mp4" 5
```

This smoke test only verifies that OpenCV can open a local video file and read basic metadata such as FPS, frame count, approximate duration, width, and height. It does not hash frames, compare videos, create duplicate groups, or write persistent cache files.

## Integration Boundary

These helper scripts are not integrated into the Electron app yet. Future app integration should call Python/OpenCV only from Electron main-process helpers. Renderer code should not execute these scripts directly and should only interact with future functionality through typed preload IPC.
