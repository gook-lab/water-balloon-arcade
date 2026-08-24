import React, { forwardRef } from 'react';

/** ref로 canvas를 노출하는 픽셀아트용 캔버스. image-rendering: pixelated 고정. */
const PixelCanvas = forwardRef(function PixelCanvas({ style, ...props }, ref) {
  return <canvas ref={ref} {...props} style={{ imageRendering: 'pixelated', ...style }} />;
});

export default PixelCanvas;
