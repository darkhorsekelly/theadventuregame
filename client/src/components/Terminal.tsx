import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { User, Room, Item, Animation, CombatUpdatePayload } from '../types';
import { RetroBox } from './ui/RetroBox';
import { AsciiPortrait } from './ui/AsciiPortrait';
import { CombatDashboard } from './combat/CombatDashboard';

type LogType = 'info' | 'error' | 'chat' | 'room-title' | 'room-desc' | 'room-items' | 'prompt';

export interface LogEntry {
  text: string;
  type: LogType;
  label?: string; // For prompt type
}

interface TerminalProps {
  history: LogEntry[];
  onCommand: (command: string) => void;
  player: User | null;
  room: Room | null;
  roomItems: Item[];
  playersInRoom: string[];
  roomTapestry: Animation | null;
  activeAnimation: Animation | null;
  onAnimationComplete: () => void;
  inCombat?: boolean;
  combatData?: CombatUpdatePayload | null;
  enemyName?: string;
  onEnemyNameChange?: (name: string) => void;
  onRetreat?: () => void;
}

export function Terminal({ 
  history, 
  onCommand, 
  player, 
  room, 
  roomItems, 
  playersInRoom, 
  roomTapestry, 
  activeAnimation, 
  onAnimationComplete,
  inCombat = false,
  combatData = null,
  enemyName = '',
  onEnemyNameChange,
  onRetreat,
}: TerminalProps) {
  const [input, setInput] = useState('');
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [history]);

  // Keyboard listener for retreat (Space or Escape)
  useEffect(() => {
    if (!inCombat || !onRetreat) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        onRetreat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inCombat, onRetreat]);

  // Extract enemy name from room items when combat starts
  useEffect(() => {
    if (inCombat && roomItems.length > 0 && onEnemyNameChange) {
      // Find the enemy (item with enemy_hp > 0)
      const enemy = roomItems.find((item) => (item as any).enemy_hp > 0);
      if (enemy && enemyName !== enemy.name) {
        onEnemyNameChange(enemy.name);
      }
    }
  }, [inCombat, roomItems, enemyName, onEnemyNameChange]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    onCommand(input.trim());
    setInput('');
  };

  // Determine mode badge based on player state
  const getModeBadge = (): string => {
    if (!player) return '[EXPLORING]';
    if (player.state.includes('CREATING')) return '[CREATING]';
    if (player.state === 'COMBAT') return '[COMBAT]';
    return '[EXPLORING]';
  };

  const modeBadge = getModeBadge();
  const roomTitle = room?.title || 'Unknown Wilds';
  const roomDescription = room?.description || 'No description available.';

  return (
    <div
      style={{
        backgroundColor: 'var(--terminal-bg)',
        color: 'var(--text-primary)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'VT323, monospace',
        fontSize: '20px',
        overflow: 'hidden',
      }}
    >
      {/* Zone 1: The Room Card (Top, Fixed) */}
      <div
        style={{
          flexShrink: 0,
          padding: '1.5rem',
          backgroundColor: 'var(--terminal-bg)',
        }}
      >
        <div
          style={{
            margin: '0 auto',
            maxWidth: '600px',
          }}
        >
          <RetroBox label={modeBadge}>
            <div
              className="room-card-layout"
              style={{
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'stretch',
                height: '100%',
              }}
            >
              {/* Left Column: Fixed Width Portal */}
              <div
                className="room-card-portrait"
                style={{
                  flex: '0 0 240px',
                }}
              >
                <AsciiPortrait
                  art={roomTapestry?.frames?.[0] || ''}
                  mood="Mysterious" // TODO: Get from room.mood or server - using test value for now
                  animation={activeAnimation}
                  onComplete={onAnimationComplete}
                />
              </div>

              {/* Right Column: Fluid Content */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Title: Room Title */}
                <div
                  style={{
                    color: 'var(--color-gold)',
                    fontSize: '1.2em',
                    marginBottom: '1rem',
                  }}
                >
                  {roomTitle}
                </div>

                {/* Description */}
                <div
                  style={{
                    color: 'var(--text-primary)',
                    marginBottom: '1rem',
                  }}
                >
                  {roomDescription}
                </div>

                {/* Footer Section: Objects and Players */}
                <div
                  style={{
                    borderTop: '1px dashed var(--hex-stroke)',
                    paddingTop: '0.5rem',
                  }}
                >
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--color-cyan)', marginBottom: '0.25rem', display: 'block' }}>
                      You see here:
                    </span>
                    {roomItems.length > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        {roomItems.map((item, idx) => (
                          <span
                            key={item.id}
                            className="item-lozenge"
                            style={{
                              backgroundColor: 'var(--cyan-dim)',
                              color: 'var(--cyan-bright)',
                              border: '1px solid var(--cyan-bright)',
                              padding: '0.25rem 0.5rem',
                              fontFamily: 'VT323, monospace',
                              fontSize: '16px',
                              display: 'inline-block',
                            }}
                          >
                            <span style={{ fontWeight: 'bold', marginRight: '0.25rem' }}>
                              [{idx + 1}]
                            </span>
                            {item.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-grey)' }}>nothing</span>
                    )}
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-purple)', marginBottom: '0.25rem', display: 'block' }}>
                      Players here:
                    </span>
                    {playersInRoom.length > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        {playersInRoom.map((playerName, idx) => (
                          <span
                            key={idx}
                            className="player-lozenge"
                            style={{
                              backgroundColor: 'var(--pink-dim)',
                              color: 'var(--pink-bright)',
                              border: '1px solid var(--pink-bright)',
                              padding: '0.25rem 0.5rem',
                              fontFamily: 'VT323, monospace',
                              fontSize: '16px',
                              display: 'inline-block',
                            }}
                          >
                            <span style={{ fontWeight: 'bold', marginRight: '0.25rem' }}>
                              [{idx + 1}]
                            </span>
                            {playerName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-grey)' }}>none</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </RetroBox>
        </div>
      </div>

      {/* Zone 2: The Journal (Flex 1, Scrollable) */}
      <div
        ref={logContainerRef}
        className="game-log-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {history.map((entry, index) => {
          // Render prompt entries with RetroBox
          if (entry.type === 'prompt') {
            return (
              <div key={index} className="log-entry log-entry-prompt" style={{ marginBottom: '0.75rem' }}>
                <RetroBox label={entry.label || 'QUESTION'} compact>
                  <div
                    style={{
                      color: 'var(--text-primary)',
                    }}
                  >
                    {entry.text}
                  </div>
                </RetroBox>
              </div>
            );
          }

          // Regular log entries
          return (
            <div
              key={index}
              className="log-entry"
              style={{
                color:
                  entry.type === 'error'
                    ? 'var(--color-red)'
                    : entry.type === 'chat'
                    ? 'var(--color-cyan)'
                    : entry.type === 'room-title'
                    ? '#ffffff'
                    : entry.type === 'room-desc'
                    ? 'var(--color-grey)'
                    : entry.type === 'room-items'
                    ? 'var(--color-gold)'
                    : entry.type === 'info'
                    ? 'var(--color-gold)'
                    : undefined, // Let CSS handle default color
              }}
            >
              {entry.text}
            </div>
          );
        })}
      </div>

      {/* Zone 3: The Controls (Fixed Bottom) */}
      <div
        style={{
          padding: '10px',
          background: 'var(--terminal-bg)',
          flexShrink: 0,
          borderTop: '1px solid var(--hex-stroke)',
          position: 'relative',
        }}
      >
        {/* Combat Dashboard Overlay */}
        {inCombat && (
          <CombatDashboard
            active={inCombat}
            combatData={combatData}
            enemyName={enemyName}
          />
        )}

        {/* Input Bar - Hidden during combat */}
        {!inCombat && (
          <>
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                marginBottom: '0',
              }}
            >
              <span style={{ color: 'var(--color-green)' }}>&gt; </span>
              <input
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  color: 'var(--color-green)',
                  border: 'none',
                  outline: 'none',
                  padding: '4px',
                  fontFamily: 'VT323, monospace',
                  fontSize: '20px',
                }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
              />
            </form>

            {/* Cheatsheet Bar */}
            <div
              style={{
                padding: '4px 10px',
                fontSize: '0.8em',
                color: 'var(--color-grey)',
                textAlign: 'center',
              }}
            >
              MOVE: n/ne/se/s/sw/nw | help | look [object] | [verb] [object]
            </div>
          </>
        )}
      </div>
    </div>
  );
}
