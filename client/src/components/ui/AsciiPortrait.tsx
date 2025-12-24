import { useEffect, useState, useRef } from 'react';
import type { Animation } from '../../types';

interface AsciiPortraitProps {
  art: string;
  mood?: string;
  animation: Animation | null;
  onComplete: () => void;
}

type DisplayMode = 'AMBIENT' | 'ACTION';

// Helper function to calculate dynamic font size
function calculateStyle(artContent: string, mode: 'AMBIENT' | 'ACTION', containerWidth: number, containerHeight: number): { fontSize: string; lineHeight: string } {
  if (!artContent || artContent.trim().length === 0) {
    return { fontSize: '6px', lineHeight: mode === 'AMBIENT' ? '0.7' : '1.0' };
  }

  // Split by newlines to get rows and find max column width
  const lines = artContent.split('\n').filter(line => line.length > 0);
  if (lines.length === 0) {
    return { fontSize: '6px', lineHeight: mode === 'AMBIENT' ? '0.7' : '1.0' };
  }

  const cols = Math.max(...lines.map(line => line.length));
  const rows = lines.length;

  // VT323 font aspect ratio (width/height) ≈ 0.6
  const fontAspectRatio = 0.6;

  let fontSize: number;

  if (mode === 'AMBIENT') {
    // COVER MODE: Scale until smaller dimension matches container
    // Calculate art's effective dimensions (accounting for font aspect ratio)
    // Art width in pixels = cols * fontSize * fontAspectRatio
    // Art height in pixels = rows * fontSize * lineHeight
    
    // Calculate scale factors for both dimensions
    const lineHeight = 0.7; // AMBIENT line height
    const scaleForWidth = containerWidth / (cols * fontAspectRatio);
    const scaleForHeight = containerHeight / (rows * lineHeight);
    
    // Use the larger scale factor (so smaller dimension matches, larger overflows)
    fontSize = Math.max(scaleForWidth, scaleForHeight);
  } else {
    // CONTAIN MODE: Scale to fit with breathing room
    const lineHeight = 1.0; // ACTION line height
    const scaleForWidth = (containerWidth * 0.9) / (cols * fontAspectRatio);
    const scaleForHeight = (containerHeight * 0.9) / (rows * lineHeight);
    
    // Use the smaller scale factor (so it fits entirely)
    fontSize = Math.min(scaleForWidth, scaleForHeight);
  }

  // Ensure minimum readable size
  fontSize = Math.max(fontSize, 4);

  return {
    fontSize: `${fontSize}px`,
    lineHeight: mode === 'AMBIENT' ? '0.7' : '1.0',
  };
}

export function AsciiPortrait({ art, mood, animation, onComplete }: AsciiPortraitProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('AMBIENT');
  const [frameIndex, setFrameIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 240, height: 200 });
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const intervalRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);
  const completeTimeoutRef = useRef<number | null>(null);

  // Measure container size for accurate scaling
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Generate mood class safely
  const moodClass = mood 
    ? `mood-${mood.toLowerCase().trim().replace(/\s+/g, '-')}` 
    : '';

  // Effect 1: Handle animation trigger (fade out, switch mode, fade in)
  useEffect(() => {
    // If animation changed to a new non-null value
    if (animation && animation !== animationRef.current) {
      animationRef.current = animation;
      
      // Fade out
      setOpacity(0);
      
      // Wait 200ms, then switch to ACTION mode and fade in
      fadeTimeoutRef.current = window.setTimeout(() => {
        setDisplayMode('ACTION');
        setFrameIndex(0);
        setOpacity(1);
      }, 200);
    } else if (!animation && displayMode === 'ACTION') {
      // Animation completed, return to AMBIENT
      setOpacity(0);
      fadeTimeoutRef.current = window.setTimeout(() => {
        setDisplayMode('AMBIENT');
        setFrameIndex(0);
        setOpacity(1);
        animationRef.current = null;
      }, 200);
    }

    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [animation, displayMode]);

  // Effect 2: Playback logic for ACTION mode
  useEffect(() => {
    if (displayMode === 'ACTION' && animation && animation.frames && animation.frames.length > 0) {
      const fps = animation.fps || 2;
      const intervalTime = 1000 / fps;
      let currentLoopCount = 0;

      intervalRef.current = window.setInterval(() => {
        setFrameIndex((prev) => {
          const next = prev + 1;
          
          // If we've reached the end of frames
          if (next >= animation.frames.length) {
            currentLoopCount += 1;
            
            // If we've looped 3 times, complete the animation
            if (currentLoopCount >= 3) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              
              // Wait 1s, then call onComplete
              completeTimeoutRef.current = window.setTimeout(() => {
                onComplete();
              }, 1000);
              
              return 0; // Reset frame index
            }
            
            // Otherwise, loop back to start
            return 0;
          }
          
          return next;
        });
      }, intervalTime);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
        completeTimeoutRef.current = null;
      }
    };
  }, [displayMode, animation, onComplete]);

  // Determine what to display
  const displayContent = displayMode === 'AMBIENT' 
    ? art || '░░░░░░░░░░░░░░░░░░░░\n░░░░░░░░░░░░░░░░░░░░\n░░░░░░░░░░░░░░░░░░░░'
    : (animation?.frames?.[frameIndex] || '');

  // Determine which class to use
  const displayClass = displayMode === 'AMBIENT' 
    ? moodClass 
    : 'mood-action';

  // Calculate dynamic style based on content and mode
  const dynamicStyle = calculateStyle(displayContent, displayMode, containerSize.width, containerSize.height);

  return (
    <div
      ref={containerRef}
      className="ascii-portrait-container"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '200px',
        border: '4px double var(--hex-stroke)',
        background: '#000',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        className={`ascii-art-layer ${displayClass}`}
        style={{
          fontFamily: 'VT323, monospace',
          whiteSpace: 'pre',
          lineHeight: dynamicStyle.lineHeight,
          fontSize: dynamicStyle.fontSize,
          position: 'absolute',
          top: '50%',
          left: '50%',
          // Base transform for centering (animation will override in ACTION mode)
          transform: 'translate(-50%, -50%)',
          margin: 0,
          padding: 0,
          textAlign: 'center',
          opacity: opacity,
          // Don't transition transform in ACTION mode to avoid conflicts with animation
          transition: displayMode === 'ACTION' ? 'opacity 0.2s ease-in-out' : 'opacity 0.2s ease-in-out',
        }}
      >
        {displayContent}
      </div>
    </div>
  );
}
