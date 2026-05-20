# OpenCV Helper Scripts

This folder contains local helper scripts for future OpenCV-powered video analysis in Collie Video.

These scripts are not currently wired into the Electron app. They are intended to keep Python/OpenCV setup and smoke testing reproducible while the visual duplicate detection feature is still in preparation.

Use a project-local virtual environment at `.venv/`, and install dependencies from the repo-root `requirements-opencv.txt` file.

The renderer should not call these scripts directly. Future app integration should happen through Electron main-process helpers, with any renderer access exposed only through typed preload IPC.
