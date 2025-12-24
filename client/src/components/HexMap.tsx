import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { User, Room } from '../types';
import { pixelateEmoji } from '../utils/pixelateEmoji';

interface HexMapProps {
  player: User | null;
  room: Room | null;
  visibleRooms: Room[];
}

const HEX_SIZE = 25;
const EMOJI_OUTPUT_SIZE = 32; // Size of pixelated emoji sprite (fits comfortably in hex)

export function HexMap({ player, room, visibleRooms }: HexMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 300 });
  // Cache for pixelated emoji canvases: Map<emoji, HTMLCanvasElement>
  const emojiCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [loadedEmojis, setLoadedEmojis] = useState<Set<string>>(new Set());

  // Track container size for High-DPI scaling
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Pre-load pixelated emojis for visible rooms
  useEffect(() => {
    const loadEmojis = async () => {
      const emojiPromises: Promise<void>[] = [];
      const newLoadedEmojis = new Set<string>();

      for (const room of visibleRooms) {
        if (room.symbol) {
          // Always check cache - if not present, load it
          if (!emojiCacheRef.current.has(room.symbol)) {
            const promise = pixelateEmoji(room.symbol, {
              pixelSize: 16,
              outputSize: EMOJI_OUTPUT_SIZE,
              palette: 'pico8',
            })
              .then((canvas) => {
                emojiCacheRef.current.set(room.symbol!, canvas);
                newLoadedEmojis.add(room.symbol!);
              })
              .catch((error) => {
                console.error(`Failed to pixelate emoji ${room.symbol}:`, error);
              });

            emojiPromises.push(promise);
          } else {
            // Already cached
            newLoadedEmojis.add(room.symbol);
          }
        }
      }

      await Promise.all(emojiPromises);
      setLoadedEmojis(newLoadedEmojis);
    };

    loadEmojis();
  }, [visibleRooms]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI setup
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;

    // Set actual canvas size in pixels
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    // Set CSS size (logical pixels)
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Scale context to match device pixel ratio
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    // Clear canvas at start of every render
    ctx.clearRect(0, 0, width, height);

    if (!player) {
      ctx.fillStyle = '#1a1c2c';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#8b9bb4';
      ctx.font = '20px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Connecting...', width / 2, height / 2);
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;

    // Flat-topped axial to pixel conversion
    // x = HEX_SIZE * (3/2) * q
    // y = HEX_SIZE * Math.sqrt(3) * (r + q/2)
    const axialToPixel = (q: number, r: number) => {
      const x = HEX_SIZE * (3 / 2) * q;
      const y = HEX_SIZE * Math.sqrt(3) * (r + q / 2);
      return {
        x: centerX + x,
        y: centerY + y,
      };
    };

    // Draw background (Deep slate)
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(0, 0, width, height);

    // LAYER 1: Draw all unexplored hexes (grid lines only)
    for (let dq = -5; dq <= 5; dq++) {
      for (let dr = -5; dr <= 5; dr++) {
        const hQ = player.current_q + dq;
        const hR = player.current_r + dr;
        const { x, y } = axialToPixel(dq, dr);

        // Check if a room exists at this coordinate
        const roomExists = visibleRooms.find((r) => r.q === hQ && r.r === hR);

        // Only draw grid for unexplored hexes
        if (!roomExists) {
          ctx.lineWidth = 1;
          ctx.lineJoin = 'bevel';
          drawFlatHex(ctx, x, y, HEX_SIZE, '#333', undefined, false);
        }
      }
    }

    // LAYER 2: Draw all explored room hexes (filled backgrounds)
    for (let dq = -5; dq <= 5; dq++) {
      for (let dr = -5; dr <= 5; dr++) {
        const hQ = player.current_q + dq;
        const hR = player.current_r + dr;
        const { x, y } = axialToPixel(dq, dr);

        // Check if a room exists at this coordinate
        const roomExists = visibleRooms.find((r) => r.q === hQ && r.r === hR);

        if (roomExists) {
          // Draw defined room (Dark Blue-Grey fill, brighter stroke)
          ctx.lineWidth = 3;
          ctx.lineJoin = 'bevel';
          drawFlatHex(ctx, x, y, HEX_SIZE, '#6d70a7', '#2a2d45', true);
        }
      }
    }

    // LAYER 3: Draw current player hex (highlight on top)
    const playerPos = axialToPixel(0, 0);
    ctx.lineWidth = 4;
    ctx.lineJoin = 'bevel';
    drawFlatHex(ctx, playerPos.x, playerPos.y, HEX_SIZE, '#ffcc00', '#ffcc00', true);

    // LAYER 4: Draw symbols/coordinates on top of everything
    for (let dq = -5; dq <= 5; dq++) {
      for (let dr = -5; dr <= 5; dr++) {
        const hQ = player.current_q + dq;
        const hR = player.current_r + dr;
        const { x, y } = axialToPixel(dq, dr);

        const room = visibleRooms.find((r) => r.q === hQ && r.r === hR);
        if (room?.symbol) {
          const pixelatedCanvas = emojiCacheRef.current.get(room.symbol);
          if (pixelatedCanvas) {
            // Draw pixelated emoji sprite centered in hex
            const spriteSize = EMOJI_OUTPUT_SIZE;
            ctx.drawImage(
              pixelatedCanvas,
              x - spriteSize / 2,
              y - spriteSize / 2,
              spriteSize,
              spriteSize,
            );
          } else {
            // Fallback: draw text while emoji is loading
            ctx.fillStyle = '#5d6087';
            ctx.font = '10px VT323, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(room.symbol, x, y);
          }
        } else {
          // No symbol: draw coordinates (only for unexplored)
          const roomExists = visibleRooms.find((r) => r.q === hQ && r.r === hR);
          if (!roomExists) {
            ctx.fillStyle = '#5d6087';
            ctx.font = '10px VT323, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${hQ},${hR}`, x, y);
          }
        }
      }
    }
  }, [player, room, player?.current_q, player?.current_r, visibleRooms, dimensions, loadedEmojis]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#1a1c2c',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}

// Draw flat-topped hexagon
// Corners at: 0°, 60°, 120°, 180°, 240°, 300°
function drawFlatHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  strokeStyle: string,
  fillStyle?: string,
  filled = false,
) {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    // Flat-topped: angles start at 0° (not -30°)
    const angle = (Math.PI / 180) * (60 * i);
    corners.push({
      x: x + size * Math.cos(angle),
      y: y + size * Math.sin(angle),
    });
  }

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();

  if (filled && fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
}
