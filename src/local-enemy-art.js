/** Remove pure key colour and connected spill, retaining other wardrobe greens. */
export function keyLocalEnemySheet(image, { columns = 4, rows = 4 } = {}) {
  const width = image.width, height = image.height;
  const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const c = canvas.getContext('2d', { willReadFrequently: true }); c.drawImage(image, 0, 0);
  const pixels = c.getImageData(0, 0, width, height), data = pixels.data;
  const background = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const visit = pixel => {
    if (background[pixel]) return;
    const at = pixel * 4, r = data[at], g = data[at + 1], b = data[at + 2];
    if (data[at + 3] > 0 && !(g > 180 && r < 100 && b < 100 && g - Math.max(r, b) > 100)) return;
    background[pixel] = 1; queue[tail++] = pixel;
  };
  // Pure green also seeds enclosed arm/torso gaps and bicycle spokes. Broader
  // green shades are removed only when connected to one of these background seeds.
  for (let pixel = 0; pixel < background.length; pixel++) {
    const at = pixel * 4;
    if (data[at] < 100 && data[at + 1] >= 240 && data[at + 2] < 100) visit(pixel);
  }
  for (let division = 0; division <= columns; division++) {
    const x = Math.min(width - 1, Math.floor(width * division / columns));
    for (let row = 0; row < height; row++) { visit(row * width + x); if (x > 0) visit(row * width + x - 1); }
  }
  for (let division = 0; division <= rows; division++) {
    const y = Math.min(height - 1, Math.floor(height * division / rows));
    for (let col = 0; col < width; col++) { visit(y * width + col); if (y > 0) visit((y - 1) * width + col); }
  }
  while (head < tail) {
    const pixel = queue[head++], x = pixel % width;
    if (x > 0) visit(pixel - 1); if (x + 1 < width) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width); if (pixel + width < background.length) visit(pixel + width);
  }
  for (let pixel = 0; pixel < background.length; pixel++) {
    const at = pixel * 4;
    if (background[pixel]) { data[at + 3] = 0; continue; }
    const x = pixel % width;
    const edge = x > 0 && background[pixel - 1] || x + 1 < width && background[pixel + 1] || pixel >= width && background[pixel - width] || pixel + width < background.length && background[pixel + width];
    // Despill only the immediate silhouette edge; interior wardrobe hues stay intact.
    const neutral = Math.max(data[at], data[at + 2]), greenSpill = data[at + 1] - neutral;
    if (edge && (data[at + 1] > 160 && neutral < 120 && greenSpill > 70 || neutral < 65 && greenSpill > 25)) data[at + 1] = neutral + 10;
  }
  c.putImageData(pixels, 0, 0); return canvas;
}
