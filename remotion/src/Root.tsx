import React from 'react';
import {Composition} from 'remotion';
import {DuaVideo, END_FRAMES, INTRO_FRAMES} from './DuaVideo';
import {StylePreview} from './StylePreview';
import {ThumbCard} from './ThumbCard';
import type {DuaManifest} from './types';

const manifestFiles = (require as any).context('./data', false, /\.json$/);

const manifests: DuaManifest[] = manifestFiles.keys()
  .filter((k: string) => !k.endsWith('ai_api_config.json'))
  .map((k: string) => {
  return manifestFiles(k) as DuaManifest;
});

export const compositionIdFor = (duaId: string) => duaId.replace(/_/g, '-');

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {manifests.map((data) => {
        const contentFrames = Math.ceil(data.totalDuration * data.fps);
        return (
          <Composition
            key={data.dua_id}
            id={compositionIdFor(data.dua_id)}
            component={DuaVideo}
            durationInFrames={INTRO_FRAMES + contentFrames + END_FRAMES - 14}
            fps={data.fps}
            width={data.width}
            height={data.height}
            defaultProps={{data}}
          />
        );
      })}
      <Composition
        id="StylePreview"
        component={StylePreview}
        durationInFrames={30}
        fps={45}
        width={1280}
        height={720}
        defaultProps={{template: 'dark'}}
      />
      <Composition
        id="thumbnail-card"
        component={ThumbCard}
        durationInFrames={1}
        fps={45}
        width={1080}
        height={1920}
        defaultProps={{data: manifests[0]}}
      />
    </>
  );
};
