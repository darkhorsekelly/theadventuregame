import type { PaletteName } from '../constants/palettes';
import { PALETTES } from '../constants/palettes';

export interface PixelateOptions {
  pixelSize?: number; // Default 16
  outputSize?: number; // Default 64
  palette?: PaletteName; // Default 'pico8'
}

type EmojiCache = Map<string, HTMLCanvasElement>;

// Global cache for pixelated emojis
const emojiCache: EmojiCache = new Map();

/**
 * Get Twemoji URL for an emoji
 */
function getTwemojiUrl(emoji: string): string {
  const codePoints: string[] = [];
  for (const char of emoji) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined) {
      codePoints.push(codePoint.toString(16).padStart(4, '0'));
    }
  }
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${codePoints.join('-')}.png`;
}

/**
 * Find the closest color in the palette to a given RGB color
 */
function findClosestPaletteColor(r: number, g: number, b: number, palette: readonly string[]): string {
  let minDistance = Infinity;
  let closestColor = palette[0];

  for (const color of palette) {
    // Parse hex color
    const hex = color.replace('#', '');
    const pr = parseInt(hex.substring(0, 2), 16);
    const pg = parseInt(hex.substring(2, 4), 16);
    const pb = parseInt(hex.substring(4, 6), 16);

    // Calculate Euclidean distance in RGB space
    const distance = Math.sqrt(
      Math.pow(r - pr, 2) + Math.pow(g - pg, 2) + Math.pow(b - pb, 2),
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }

  return closestColor;
}

/**
 * Quantize image data to a retro palette
 */
function quantizeToPalette(
  imageData: ImageData,
  palette: readonly string[],
): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent pixels
    if (a === 0) {
      continue;
    }

    // Find closest palette color
    const closestColor = findClosestPaletteColor(r, g, b, palette);
    const hex = closestColor.replace('#', '');
    data[i] = parseInt(hex.substring(0, 2), 16); // R
    data[i + 1] = parseInt(hex.substring(2, 4), 16); // G
    data[i + 2] = parseInt(hex.substring(4, 6), 16); // B
    // Alpha stays the same
  }

  return new ImageData(data, width, height);
}

/**
 * Load an image from a URL (with fallback)
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Render emoji to canvas using native text rendering (fallback)
 */
function renderEmojiNative(
  canvas: HTMLCanvasElement,
  emoji: string,
  size: number,
): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${size}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, canvas.width / 2, canvas.height / 2);
}

/**
 * Pixelate an emoji using Twemoji and retro palette quantization
 */
export async function pixelateEmoji(
  emoji: string,
  options: PixelateOptions = {},
): Promise<HTMLCanvasElement> {
  const {
    pixelSize = 16,
    outputSize = 64,
    palette: paletteName = 'pico8',
  } = options;

  const palette = PALETTES[paletteName];
  const cacheKey = `${emoji}-${paletteName}-${pixelSize}-${outputSize}`;

  // Check cache first
  if (emojiCache.has(cacheKey)) {
    return emojiCache.get(cacheKey)!;
  }

  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputSize;
  outputCanvas.height = outputSize;
  const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!outputCtx) {
    throw new Error('Failed to get 2d context');
  }

  // Disable smoothing for pixelated look
  outputCtx.imageSmoothingEnabled = false;

  try {
    // Step 1: Load emoji image via Twemoji
    const twemojiUrl = getTwemojiUrl(emoji);
    const sourceImage = await loadImage(twemojiUrl);

    // Step 2: Render to high-res canvas (128x128)
    const highResCanvas = document.createElement('canvas');
    highResCanvas.width = 128;
    highResCanvas.height = 128;
    const highResCtx = highResCanvas.getContext('2d', { willReadFrequently: true });
    if (!highResCtx) {
      throw new Error('Failed to get 2d context');
    }

    highResCtx.clearRect(0, 0, 128, 128);
    highResCtx.drawImage(sourceImage, 0, 0, 128, 128);

    // Step 3: Downscale to pixel size (16x16) with nearest-neighbor
    const pixelCanvas = document.createElement('canvas');
    pixelCanvas.width = pixelSize;
    pixelCanvas.height = pixelSize;
    const pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: true });
    if (!pixelCtx) {
      throw new Error('Failed to get 2d context');
    }

    pixelCtx.imageSmoothingEnabled = false;
    pixelCtx.drawImage(highResCanvas, 0, 0, pixelSize, pixelSize);

    // Step 4: Quantize colors to palette
    const pixelData = pixelCtx.getImageData(0, 0, pixelSize, pixelSize);
    const quantizedData = quantizeToPalette(pixelData, palette);
    pixelCtx.putImageData(quantizedData, 0, 0);

    // Step 5: Upscale to output size with nearest-neighbor
    outputCtx.drawImage(pixelCanvas, 0, 0, outputSize, outputSize);

    // Cache the result
    emojiCache.set(cacheKey, outputCanvas);

    return outputCanvas;
  } catch (error) {
    // Fallback to native text rendering
    console.warn('Twemoji loading failed, using native rendering:', error);
    
    // Create high-res canvas for native rendering
    const highResCanvas = document.createElement('canvas');
    highResCanvas.width = 128;
    highResCanvas.height = 128;
    renderEmojiNative(highResCanvas, emoji, 128);
    
    // Continue with downscale and quantization
    const pixelCanvas = document.createElement('canvas');
    pixelCanvas.width = pixelSize;
    pixelCanvas.height = pixelSize;
    const pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: true });
    if (!pixelCtx) {
      throw new Error('Failed to get 2d context');
    }

    pixelCtx.imageSmoothingEnabled = false;
    pixelCtx.drawImage(highResCanvas, 0, 0, pixelSize, pixelSize);

    const pixelData = pixelCtx.getImageData(0, 0, pixelSize, pixelSize);
    const quantizedData = quantizeToPalette(pixelData, palette);
    pixelCtx.putImageData(quantizedData, 0, 0);

    outputCtx.drawImage(pixelCanvas, 0, 0, outputSize, outputSize);

    // Cache the fallback result
    emojiCache.set(cacheKey, outputCanvas);

    return outputCanvas;
  }
}

