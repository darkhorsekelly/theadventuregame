import type { ReactNode } from 'react';

interface RetroBoxProps {
  label?: string;
  children: ReactNode;
  type?: 'default' | 'success' | 'danger';
  compact?: boolean; // For smaller padding (prompts)
}

export function RetroBox({ label, children, type = 'default', compact = false }: RetroBoxProps) {
  const borderColor = type === 'danger' ? 'var(--color-red)' : 'var(--hex-stroke)';
  const labelColor = type === 'danger' ? 'var(--color-red)' : 'var(--color-gold)';
  const padding = compact ? '0.75rem' : '1.5rem';

  return (
    <div
      style={{
        position: 'relative',
        border: `1px solid ${borderColor}`,
        padding: padding,
        backgroundColor: 'var(--terminal-bg)',
      }}
    >
      {label && (
        <div
          style={{
            position: 'absolute',
            top: '-0.8em',
            left: '1rem',
            background: 'var(--terminal-bg)',
            padding: '0 0.5rem',
            color: labelColor,
            fontWeight: 'bold',
            fontSize: '0.9em',
            fontFamily: 'VT323, monospace',
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          fontFamily: 'VT323, monospace',
        }}
      >
        {children}
      </div>
    </div>
  );
}

