const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const DEFAULT_WORLD_WIDTH = 4600;
const BACKGROUNDS = LEVELS.map(level => level.worldKey || (level.id === 'kajo' ? 'martinstor' : level.id));

/**
 * One illustration is the entire level, including its fighting lane.
 * Camera distance is measured in world pixels, exactly like the fighters.
 * Only the visible source rectangle is submitted to the canvas; no section
 * is tiled, mirrored, independently panned, or drawn a second time.
 */
export function worldSceneGeometry(image, camera = 0, worldWidth = DEFAULT_WORLD_WIDTH) {
  const imageWidth = Number(image?.naturalWidth || image?.width);
  const imageHeight = Number(image?.naturalHeight || image?.height);
  if (!(imageWidth > 0 && imageHeight > 0 && Number.isFinite(imageWidth) && Number.isFinite(imageHeight))) return null;

  const width = Number.isFinite(worldWidth) ? Math.max(VIEW_WIDTH, worldWidth) : DEFAULT_WORLD_WIDTH;
  const maxCamera = width - VIEW_WIDTH;
  const position = Math.max(0, Math.min(maxCamera, Number(camera) || 0));
  const pixelsPerWorldUnit = imageWidth / width;
  return {
    camera: position,
    worldWidth: width,
    maxCamera,
    source: {
      x: position * pixelsPerWorldUnit,
      y: 0,
      width: VIEW_WIDTH * pixelsPerWorldUnit,
      height: imageHeight,
    },
    destination: { x: 0, y: 0, width: VIEW_WIDTH, height: VIEW_HEIGHT },
  };
}

export function drawWorldScene(renderer, level) {
  const c = renderer.c;
  const key = renderer.game?.level?.worldKey || BACKGROUNDS[level] || BACKGROUNDS[0];
  const image = renderer.assets[key];
  const view = worldSceneGeometry(image, renderer.camera, renderer.game?.level?.width);
  c.save();
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#0b1521';
  c.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  if (view) {
    const s = view.source, d = view.destination;
    c.drawImage(image, s.x, s.y, s.width, s.height, d.x, d.y, d.width, d.height);
  }
  c.restore();
  return view;
}
import { LEVELS } from './data.js';
