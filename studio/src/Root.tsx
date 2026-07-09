import "./index.css";
import React from "react";
import { Composition } from "remotion";
import { ComponentGallery } from "./templates/ComponentGallery";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ComponentGallery"
        component={ComponentGallery}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
