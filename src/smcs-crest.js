// Extracted circular St. Michael's Choir School crest (text stripped cleanly from logo_smcs_line.svg)
// Pre-rasterized onto an offscreen canvas so the 360-degree 16-bit boot spin renders crisp at 0ms latency.

const GOLD_RING_PATH =
  'M50.7 83.7c21.5 0 38.9-17.1 38.9-38.3S72.2 7.2 50.7 7.2 11.8 24.3 11.8 45.5s17.4 38.3 38.9 38.3Z';
const MAROON_INNER_PATH =
  'M50.7 79.3c19 0 34.4-15.1 34.4-33.8S69.7 11.6 50.7 11.6 16.3 26.8 16.3 45.5s15.4 33.8 34.4 33.8Z';
const WHITE_MONOGRAM_PATH =
  'm67.3 34.9 2.9-4.4h-1.1c-.2.2-.5.3-.8.3H53.6c5-2.4 7.9-7 6.4-10.2-.6-1.2-1.7-2.4-3.6-2.9L46.5 23v.5s1.2 0 1.2 1.1V31H32.5l-2.9 4.4h1.1c.2-.2.5-.3.9-.3h14c-4.7 2.4-8.5 7.6-7.9 12.8.8 5.6 5.3 9.4 10.2 10.7v9.9c-.2.8-.3 1.7-.8 2.9-.6 1.4-1.4 2.3-2 2.7l.6.3c1.9-1.2 4.3-3 6.4-4.3V59c4.8-.3 9.8-3.4 11.3-7.8.8-2.1.9-5.2-.2-7.6-1.1-2.3-2.6-3.5-3.6-4l-5.4 2.6c.8.2 2.8.9 4 2.7 2 2.9 1.4 7-.9 9.3-1.7 1.8-4 2.1-4.7 2.1H52V34.8h15.2ZM47.8 55.7c-2.3-1.1-3.7-2.6-3.9-2.9-4-4.6-2.2-10.5-1.9-11.1.9-2.7 3.3-5.2 5.9-6.9l-.2 20.9Zm4.1-35.4c.5 0 2.2-.2 3.4 1.1 1.2 1.2 1.1 2.9 1.1 3.7-.3 3.5-3.7 5.5-4.3 5.9V20.3h-.2Z';

let cachedCrestCanvas = null;

function getCrestCanvas() {
  if (cachedCrestCanvas) return cachedCrestCanvas;
  if (typeof document === 'undefined' || typeof Path2D === 'undefined') return null;

  const size = 96;
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const octx = off.getContext('2d');
  octx.save();
  // Map viewBox (10, 5, 81.4, 81) centered cleanly into 96x96
  const scale = size / 84;
  octx.translate(size / 2, size / 2);
  octx.scale(scale, scale);
  octx.translate(-50.7, -45.45);

  octx.fillStyle = '#d0ad67';
  octx.fill(new Path2D(GOLD_RING_PATH));
  octx.fillStyle = '#862633';
  octx.fill(new Path2D(MAROON_INNER_PATH));
  octx.fillStyle = '#ffffff';
  octx.fill(new Path2D(WHITE_MONOGRAM_PATH));
  octx.restore();

  cachedCrestCanvas = off;
  return off;
}

// Draw the circular SMCS crest spinning in 3D (0..2*PI full 360-degree EA Sports-style medallion spin!)
export function drawSpinningSmcsCrest(ctx, cx, cy, radius, angleRad, sheenProgress = -1) {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const scaleX = Math.abs(cosA);
  const rimThickness = Math.max(0, Math.abs(sinA) * 7);

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));

  // Soft dramatic golden floor/aura glow behind medallion
  ctx.fillStyle = 'rgba(208, 173, 103, 0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 0, radius + 12, radius + 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3D metallic gold circular coin edge (strictly elliptical — zero protruding square corners!)
  if (rimThickness > 0.6) {
    const edgeSign = sinA >= 0 ? 1 : -1;
    const ringScale = 0.926; // Exact outer radius of the gold ring inside the 96x96 crest sprite (38.9 / 42)
    const rx = Math.max(1.8, radius * ringScale * scaleX);
    const ry = radius * ringScale;
    ctx.fillStyle = '#9e7c36';
    ctx.beginPath();
    ctx.ellipse(edgeSign * rimThickness * 0.55, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e6c57a';
    ctx.beginPath();
    ctx.ellipse(edgeSign * rimThickness * 0.25, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Front / back circular crest face scaled horizontally by cos(angle) for authentic 360° spin
  if (scaleX > 0.04) {
    const drawW = Math.max(2, Math.round(radius * 2 * scaleX));
    const drawH = Math.round(radius * 2);
    const crestImg = getCrestCanvas();
    ctx.save();
    // Flip horizontally when showing the reverse side during 90°..270°
    if (cosA < 0) ctx.scale(-1, 1);

    if (crestImg) {
      ctx.drawImage(crestImg, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      // Fallback circle if offscreen canvas unavailable
      ctx.fillStyle = '#d0ad67';
      ctx.beginPath();
      ctx.ellipse(0, 0, drawW / 2, drawH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#862633';
      ctx.beginPath();
      ctx.ellipse(0, 0, drawW * 0.44, drawH * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Slight lighting shade as it turns away from the camera
    const shadeAlpha = (1 - scaleX) * 0.42;
    if (shadeAlpha > 0.02) {
      ctx.fillStyle = `rgba(12, 8, 18, ${shadeAlpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, drawW / 2, drawH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Iconic 16-bit diagonal gold glint sweep right after completing the 360° spin!
  if (sheenProgress >= 0 && sheenProgress <= 1) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
    ctx.clip();
    const sweepX = -radius * 1.6 + sheenProgress * radius * 3.2;
    ctx.fillStyle = 'rgba(255, 248, 210, 0.58)';
    ctx.beginPath();
    ctx.moveTo(sweepX - 10, -radius);
    ctx.lineTo(sweepX + 8, -radius);
    ctx.lineTo(sweepX - 14, radius);
    ctx.lineTo(sweepX - 32, radius);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}
