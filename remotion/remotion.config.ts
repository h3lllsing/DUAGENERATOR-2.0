import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
// PHASE 1 P0: hardware GPU path. NOTE: Remotion 4.0.370 already auto-injects
// `--disable-dev-shm-usage` and `--ignore-gpu-blocklist` in its Chrome
// launcher (renderer dist/open-browser.js) — no raw-flag API exists
// (`setChromiumFlags` is not part of this version). The supported knob for
// GPU-accelerated rasterization is the OpenGL backend: forcing ANGLE engages
// the D3D11 hardware GPU path on Windows (revert with --gl=swangle or remove).
Config.setChromiumOpenGlRenderer('angle');
// PHASE 1 P0: quality/size rebalance — JPEG 90 + CRF 18 retain banding-free
// aurora/grain but cut intermediate + final file sizes vs 100/15.
Config.setJpegQuality(90);
Config.setCrf(18);
