import type { User, Item } from '../types';

interface HUDProps {
  player: User | null;
  inventory: Item[];
}

export function HUD({ player, inventory }: HUDProps) {
  if (!player) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '0.75rem 1rem',
        backgroundColor: 'var(--terminal-bg)',
        border: '1px solid var(--hex-stroke)',
        fontFamily: 'VT323, monospace',
        fontSize: '14px',
        color: 'var(--text-primary)',
        zIndex: 100,
        minWidth: '200px',
      }}
    >
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ color: 'var(--color-gold)' }}>Gold:</span> {player.gold}
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ color: 'var(--color-red)' }}>HP:</span> {player.hp}/{player.max_hp}
      </div>
      <div>
        <div style={{ color: 'var(--color-cyan)', marginBottom: '0.25rem' }}>Inventory:</div>
        {inventory.length > 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--color-grey)' }}>
            {inventory.map((item) => item.name).join(', ')}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--color-grey)' }}>Empty</div>
        )}
      </div>
    </div>
  );
}

