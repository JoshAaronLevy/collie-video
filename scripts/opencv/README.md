# OpenCV Helper Scripts

This folder contains local helper scripts for OpenCV-powered video analysis in Collie Video.

The visual fingerprint helper can be called by Electron main-process services only. It is not exposed to the renderer, preload API, or duplicate review UI yet.

Use a project-local virtual environment at `.venv/`, and install dependencies from the repo-root `requirements-opencv.txt` file.

The renderer should not call these scripts directly. Any future renderer access should happen only through typed preload IPC.
