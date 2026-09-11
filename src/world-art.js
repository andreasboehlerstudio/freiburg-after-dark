import { loadImage as loadAssetImage, yieldForPaint } from './asset-loading.js';
/**
 * Art direction for the three unique, left-to-right paintings of each level.
 * `ground` is the source image's normalized horizon/fighting-lane boundary.
 * `align` chooses the horizontal crop: 0 = left, .5 = center, 1 = right.
 * The final crop favors the right side so the destination landmark survives.
 * These values are curated against the actual generated images, not their
 * requested dimensions; architecture is always scaled uniformly.
 */
export const WORLD_ART = {
  martinstor: [
    { ground: .80, align: .5 },
    { ground: .80, align: .5 },
    { ground: .84, align: 1 },
  ],
  stuehlinger: [
    { ground: .77, align: .5 },
    { ground: .72, align: .5 },
    { ground: .72, align: 1 },
  ],
  park: [
    { ground: .74, align: .5 },
    { ground: .74, align: .5 },
    { ground: .77, align: 1 },
  ],
  haslach: [{ ground: .76, align: .5 }, { ground: .77, align: .5 }, { ground: .77, align: 1 }],
  wiehre: [{ ground: .77, align: .5 }, { ground: .735, align: .5 }, { ground: .775, align: 1 }],
  // Lower curb edges measured in the selected 725 px paintings: 589/572/584.
  bermuda: [{ ground: .812, align: .5 }, { ground: .79, align: .5 }, { ground: .806, align: 1 }],
};

const WORLD_WIDTH = 4600, HEIGHT = 720;
const PANEL_WIDTH = 1600, PANEL_STEP = 1500, OVERLAP = 100;
const GROUND_Y = 458;

/** Pure crop geometry, also usable for checking real PNG dimensions in QA. */
export function worldArtSectionGeometry(image, { ground = .80, align = .5 } = {}) {
  const width = Number(image?.naturalWidth || image?.width);
  const height = Number(image?.naturalHeight || image?.height);
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) {
    throw new Error('World artwork must have valid image dimensions.');
  }
  if (!(Number.isFinite(ground) && ground > 0 && ground < 1)) {
    throw new Error('The artwork ground boundary must lie strictly inside its source image.');
  }
  const groundSourceY = height * ground;
  const scale = Math.max(GROUND_Y / groundSourceY, PANEL_WIDTH / width);
  const sourceWidth = Math.min(width, PANEL_WIDTH / scale);
  const sourceHeight = GROUND_Y / scale;
  const alignment = Number.isFinite(align) ? Math.max(0, Math.min(1, align)) : .5;
  const sourceX = (width - sourceWidth) * alignment;
  return {
    scale,
    architecture: {
      source: { x: sourceX, y: Math.max(0, groundSourceY - sourceHeight), width: sourceWidth, height: sourceHeight },
      destination: { x: 0, y: 0, width: PANEL_WIDTH, height: GROUND_Y },
    },
    floor: {
      source: { x: sourceX, y: groundSourceY, width: sourceWidth, height: height - groundSourceY },
      destination: { x: 0, y: GROUND_Y, width: PANEL_WIDTH, height: HEIGHT - GROUND_Y },
    },
  };
}

function createSurface(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Keep successful panels only until their world compiles, so retries reuse them
// without retaining all 18 decoded paintings for the full campaign.
const panels = new Map();
async function loadImage(url) {
  if(panels.has(url.href))return panels.get(url.href);
  try {
    const image=await loadAssetImage(url,import.meta.url);
    panels.set(url.href,image);return image;
  } catch(cause) {
    throw new Error(`World artwork could not be loaded: ${url.pathname}`,{cause});
  }
}

function drawRegion(context, image, region) {
  const s = region.source, d = region.destination;
  context.drawImage(image, s.x, s.y, s.width, s.height, d.x, d.y, d.width, d.height);
}

/**
 * Load assets/worlds/<key>-0.png, -1.png and -2.png into one 4600 x 720
 * canvas. The three unique sections start at world x = 0, 1500 and 3000.
 * The leftmost 100 px of later sections fade over the preceding painting;
 * all remaining pixels stay opaque. Sections are never mirrored or reused.
 *
 * `sections` optionally overrides WORLD_ART[key] with three {ground, align}
 * records. Missing images or invalid art metadata reject the whole load.
 * The returned native canvas is directly usable as renderer.assets[key].
 * This compilation happens once at load time, not on each rendered frame.
 */
export async function loadWorldArt(key, { sections = WORLD_ART[key] } = {}) {
  if (!Object.hasOwn(WORLD_ART, key)) throw new Error(`Unknown world artwork: ${key}`);
  if (!Array.isArray(sections) || sections.length !== 3) {
    throw new Error('A complete world requires exactly three unique artwork sections.');
  }
  const urls = sections.map((_, index) => new URL(`../assets/worlds/${key}-${index}.png`, import.meta.url));
  const loaded = await Promise.allSettled(urls.map(loadImage));
  const failed = loaded.find(value => value.status === 'rejected');
  if(failed)throw failed.reason;
  const images = loaded.map(value => value.value);
  await yieldForPaint();
  const geometry = images.map((image, index) => worldArtSectionGeometry(image, sections[index]));
  const atlas = createSurface(WORLD_WIDTH, HEIGHT);
  const output = atlas.getContext('2d', { alpha: false });
  const panel = createSurface(PANEL_WIDTH, HEIGHT);
  const context = panel.getContext('2d');
  if (!output || !context) throw new Error('A 2D canvas is required to assemble the world artwork.');
  output.fillStyle = '#0b1521';
  output.fillRect(0, 0, WORLD_WIDTH, HEIGHT);
  output.imageSmoothingEnabled = context.imageSmoothingEnabled = true;
  output.imageSmoothingQuality = context.imageSmoothingQuality = 'high';

  for (let index = 0; index < images.length; index++) {
    context.clearRect(0, 0, PANEL_WIDTH, HEIGHT);
    drawRegion(context, images[index], geometry[index].architecture);
    drawRegion(context, images[index], geometry[index].floor);
    if (index > 0) {
      context.save();
      context.globalCompositeOperation = 'destination-in';
      const feather = context.createLinearGradient(0, 0, OVERLAP, 0);
      feather.addColorStop(0, 'rgba(0,0,0,0)');
      feather.addColorStop(1, 'rgba(0,0,0,1)');
      context.fillStyle = feather;
      context.fillRect(0, 0, PANEL_WIDTH, HEIGHT);
      context.restore();
    }
    output.drawImage(panel, index * PANEL_STEP, 0);
  }
  for(const url of urls)panels.delete(url.href);
  return atlas;
}
