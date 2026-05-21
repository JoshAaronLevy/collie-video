# Improved Duplicate Detection Stage 8 Verification

Date: 2026-05-21

## Scope

Stage 8 tuned and hardened the improved duplicate scanner without changing the destructive-action model. Exact filename scans remain available without OpenCV. Visual and contained-clip modes now require the project-local `.venv` OpenCV helper before a scan can start.

## Implemented Hardening

- Centralized Fast/Deep duplicate scan profile defaults and matcher thresholds in `src/shared/types/duplicateScan.ts`.
- Added OpenCV/Python diagnostics to the existing diagnostics flow.
- Added preflight blocking for visual duplicate modes when the project-local Python/OpenCV helper is unavailable.
- Added duplicate fingerprint cache stats and a scoped clear action that only removes `userData/duplicate-fingerprints/fingerprints-v1`.
- Added per-profile result caps for visual and contained-clip candidate groups, with scan warnings when caps are applied.
- Expanded scan warning display in duplicate review so helper/decode/cache warnings are visible without opening developer tools.

## Known Limitations

- Thresholds are still first-pass `dhash-v1` values and should be tuned against real libraries.
- Cache clear is intentionally manual; there is no automatic pruning policy yet.
- OpenCV diagnostics verify local Python imports, not every video codec that OpenCV may encounter later.
- Low-information/static/title-card filtering is still hash-sample based and can miss some false positives.
- Exact filename scan behavior is intentionally preserved and does not require or check OpenCV.

## Suggested Manual Checks

- Run Diagnostics with `.venv` present and absent, and confirm ffmpeg/ffprobe plus Python/OpenCV status display correctly.
- Start an exact filename-only scan with OpenCV unavailable and confirm it still starts.
- Start a visual or contained-clip scan with OpenCV unavailable and confirm the scan is blocked with an actionable message.
- Run a visual scan with OpenCV available and confirm cache hit/miss counts still update.
- Use Duplicate Scan fingerprint cache Refresh and Clear, then confirm audit rows and media previews remain intact.
