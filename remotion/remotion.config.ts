import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
// BATCH 1 quality pipeline: banding-free aurora/grain + crisp typography
Config.setJpegQuality(100);
Config.setCrf(15);
