import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {z} from 'zod';
import {getBrand} from '../lib/brand';
import {loadBrandFonts} from '../lib/fonts';
import {NobanMark} from '../brands/NobanMark';
import {FloatBar} from '../components/FloatBar';
import {DemoCursor} from '../components/DemoCursor';
import {Caption} from '../components/Caption';
import {telemetrySchema, clicks, steps} from '../lib/telemetry';
import {cameraAt} from '../lib/camera';

export const productDemoSchema = z.object({
  brandId: z.string(),
  video: z.string().nullable(),
  cta: z.string(),
  telemetry: telemetrySchema.nullable(),
});

type Props = z.infer<typeof productDemoSchema>;

const STAGE_SCALE = 0.82; // 1600x1000 stage inside 1920x1080 with caption room

const EndCard: React.FC<{cta: string}> = ({cta}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const brand = getBrand('noban');
  const fonts = loadBrandFonts();
  const s = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill
      style={{justifyContent: 'center', alignItems: 'center', gap: 32, opacity: s}}
    >
      <NobanMark size={110} color={brand.colors.brand} />
      <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: 96, color: brand.colors.ink}}>
        {brand.name}
      </div>
      <div style={{fontFamily: fonts.mono, fontSize: 34, letterSpacing: '0.2em', color: brand.colors.profit}}>
        {cta.toUpperCase()}
      </div>
    </AbsoluteFill>
  );
};

export const ProductDemo: React.FC<Props> = ({video, cta, telemetry}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const brand = getBrand('noban');
  const timeMs = (frame / fps) * 1000;

  const clickList = telemetry ? clicks(telemetry) : [];
  const stepList = telemetry ? steps(telemetry) : [];
  const activeStep = [...stepList].reverse().find((s) => s.t <= timeMs);
  const vp = telemetry?.viewport ?? {width: 1600, height: 1000};
  const cam = cameraAt(clickList, timeMs, vp);
  const bodyFrames = telemetry
    ? Math.ceil((telemetry.durationMs / 1000) * fps)
    : durationInFrames - 60;

  return (
    <AbsoluteFill style={{backgroundColor: brand.colors.bg}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 50% at 50% 30%, ${brand.colors.brand}22, transparent 70%)`,
        }}
      />
      <Sequence durationInFrames={bodyFrames}>
        {/* stage: viewport-sized panel, scaled to fit with caption room */}
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          <div
            style={{
              width: vp.width,
              height: vp.height,
              transform: `scale(${STAGE_SCALE}) translateY(-36px)`,
              borderRadius: 14,
              border: `1px solid ${brand.colors.line}`,
              background: brand.colors.surface,
              overflow: 'hidden',
              boxShadow: `0 40px 120px ${brand.colors.bg}`,
              position: 'relative',
            }}
          >
            {/* camera: zooms video and cursor together */}
            <div
              style={{
                width: '100%',
                height: '100%',
                transform: `scale(${cam.scale})`,
                transformOrigin: `${cam.originX}px ${cam.originY}px`,
                position: 'relative',
              }}
            >
              {video ? (
                <OffthreadVideo
                  src={staticFile(video)}
                  style={{width: '100%', height: '100%', display: 'block'}}
                  muted
                />
              ) : (
                <AbsoluteFill
                  style={{background: brand.colors.surface2, justifyContent: 'center', alignItems: 'center'}}
                >
                  <NobanMark size={120} color={brand.colors.line} />
                </AbsoluteFill>
              )}
              {telemetry ? (
                <DemoCursor clickList={clickList} timeMs={timeMs} brand={brand} />
              ) : null}
            </div>
          </div>
          {activeStep ? (
            <div style={{position: 'absolute', bottom: 108}}>
              <Caption
                label={activeStep.label}
                brand={brand}
                enteredMsAgo={timeMs - activeStep.t}
              />
            </div>
          ) : null}
        </AbsoluteFill>
      </Sequence>
      <Sequence from={bodyFrames}>
        <EndCard cta={cta} />
      </Sequence>
      <div style={{position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <FloatBar progress={frame / (durationInFrames - 1)} brand={brand} width={640} />
      </div>
    </AbsoluteFill>
  );
};
