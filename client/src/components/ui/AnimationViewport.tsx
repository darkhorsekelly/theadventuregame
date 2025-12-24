import { useEffect, useState, useRef } from 'react';
import type { Animation } from '../../types';

interface AnimationViewportProps {
  animation: Animation;
  onComplete: () => void;
}

export function AnimationViewport({ animation, onComplete }: AnimationViewportProps) {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const animationIdRef = useRef<string>('');

  // Debug logging
  useEffect(() => {
    console.log('Animation Playback:', {
      fps: animation.fps,
      totalFrames: animation.frames?.length || 0,
      frames: animation.frames,
      frameTypes: animation.frames?.map((f, i) => ({ index: i, type: typeof f, length: f?.length || 0 })),
    });
  }, [animation]);

  // Reset when animation changes
  useEffect(() => {
    animationIdRef.current = animation.id;
    setCurrentFrameIndex(0);
    setIsComplete(false);
  }, [animation.id]);

  // Frame playback timer
  useEffect(() => {
    // Safety check: ensure frames is an array
    if (!Array.isArray(animation.frames) || animation.frames.length === 0) {
      console.error('Animation frames is not a valid array:', animation.frames);
      setIsComplete(true);
      return;
    }

    // If already complete, hold final frame then call onComplete
    if (isComplete) {
      const timeout = setTimeout(() => {
        // Only call onComplete if this is still the current animation
        if (animationIdRef.current === animation.id) {
          onComplete();
        }
      }, 1000);
      return () => clearTimeout(timeout);
    }

    // Calculate interval time from fps
    const intervalTime = 1000 / animation.fps;
    
    // Use setInterval for frame-by-frame playback
    const interval = setInterval(() => {
      // Check if this is still the current animation
      if (animationIdRef.current !== animation.id) {
        clearInterval(interval);
        return;
      }

      setCurrentFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= animation.frames.length) {
          setIsComplete(true);
          clearInterval(interval);
          return prev; // Stay on last frame
        }
        return next;
      });
    }, intervalTime);

    return () => {
      clearInterval(interval);
    };
  }, [animation.id, animation.fps, animation.frames.length, isComplete, onComplete]);

  // Safety check: don't render if frames is invalid
  if (!Array.isArray(animation.frames) || animation.frames.length === 0) {
    return null;
  }

  // Get current frame - ensure we don't go out of bounds
  const currentFrame = animation.frames[Math.min(currentFrameIndex, animation.frames.length - 1)] || '';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--terminal-bg)',
        border: '4px double var(--hex-stroke)',
        zIndex: 9999,
        padding: '2rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--terminal-bg)',
          padding: '1rem',
        }}
      >
        <pre
          style={{
            whiteSpace: 'pre',
            fontFamily: 'VT323, monospace',
            fontSize: '14px',
            lineHeight: '1.2',
            color: 'var(--text-primary)',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {currentFrame}
        </pre>
      </div>
    </div>
  );
}

