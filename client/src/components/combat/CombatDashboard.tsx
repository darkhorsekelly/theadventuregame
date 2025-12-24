import { useEffect, useState, useRef } from 'react';

export interface CombatUpdatePayload {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  playerRoll: number;
  enemyRoll: number;
  damage: number;
  source: 'player' | 'enemy' | 'tie';
}

interface CombatDashboardProps {
  active: boolean;
  combatData: CombatUpdatePayload | null;
  enemyName: string;
}

export function CombatDashboard({ active, combatData, enemyName }: CombatDashboardProps) {
  const [localPlayerHp, setLocalPlayerHp] = useState(combatData?.playerHp || 100);
  const [localEnemyHp, setLocalEnemyHp] = useState(combatData?.enemyHp || 100);
  const [playerDice, setPlayerDice] = useState(combatData?.playerRoll || 1);
  const [enemyDice, setEnemyDice] = useState(combatData?.enemyRoll || 1);
  const [damageFloat, setDamageFloat] = useState<{ value: number; source: 'player' | 'enemy' | null }>({ value: 0, source: null });
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const previousDataRef = useRef<CombatUpdatePayload | null>(null);

  // Smooth HP bar animations
  useEffect(() => {
    if (combatData) {
      // Animate player HP
      const playerDiff = combatData.playerHp - localPlayerHp;
      if (Math.abs(playerDiff) > 0) {
        const step = playerDiff > 0 ? 1 : -1;
        const interval = setInterval(() => {
          setLocalPlayerHp((prev) => {
            const next = prev + step;
            if ((step > 0 && next >= combatData.playerHp) || (step < 0 && next <= combatData.playerHp)) {
              clearInterval(interval);
              return combatData.playerHp;
            }
            return next;
          });
        }, 20);
        return () => clearInterval(interval);
      }

      // Animate enemy HP
      const enemyDiff = combatData.enemyHp - localEnemyHp;
      if (Math.abs(enemyDiff) > 0) {
        const step = enemyDiff > 0 ? 1 : -1;
        const interval = setInterval(() => {
          setLocalEnemyHp((prev) => {
            const next = prev + step;
            if ((step > 0 && next >= combatData.enemyHp) || (step < 0 && next <= combatData.enemyHp)) {
              clearInterval(interval);
              return combatData.enemyHp;
            }
            return next;
          });
        }, 20);
        return () => clearInterval(interval);
      }
    }
  }, [combatData, localPlayerHp, localEnemyHp]);

  // Dice rolling animation
  useEffect(() => {
    if (!combatData || !previousDataRef.current) {
      previousDataRef.current = combatData;
      if (combatData) {
        setPlayerDice(combatData.playerRoll);
        setEnemyDice(combatData.enemyRoll);
      }
      return;
    }

    // Check if rolls changed
    if (
      combatData.playerRoll !== previousDataRef.current.playerRoll ||
      combatData.enemyRoll !== previousDataRef.current.enemyRoll
    ) {
      // Rapid dice rolling animation
      let rollCount = 0;
      const rollInterval = setInterval(() => {
        setPlayerDice(Math.floor(Math.random() * 6) + 1);
        setEnemyDice(Math.floor(Math.random() * 6) + 1);
        rollCount++;
        
        if (rollCount >= 10) {
          clearInterval(rollInterval);
          setPlayerDice(combatData.playerRoll);
          setEnemyDice(combatData.enemyRoll);
        }
      }, 50);
      
      return () => clearInterval(rollInterval);
    }

    previousDataRef.current = combatData;
  }, [combatData]);

  // Damage float animation
  useEffect(() => {
    if (combatData && combatData.damage > 0 && combatData.source !== 'tie') {
      setDamageFloat({ value: combatData.damage, source: combatData.source });
      
      // Clear after animation
      setTimeout(() => {
        setDamageFloat({ value: 0, source: null });
      }, 2000);
    }
  }, [combatData]);

  // Shake effect when player takes damage
  useEffect(() => {
    if (combatData?.source === 'enemy' && combatData.damage > 0) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }, [combatData]);

  // Flash effect when enemy takes damage
  useEffect(() => {
    if (combatData?.source === 'player' && combatData.damage > 0) {
      setFlash(true);
      setTimeout(() => setFlash(false), 300);
    }
  }, [combatData]);

  if (!active || !combatData) {
    return null;
  }

  const playerHpPercent = (localPlayerHp / combatData.playerMaxHp) * 100;
  const enemyHpPercent = (localEnemyHp / combatData.enemyMaxHp) * 100;

  // Generate health bar ASCII
  const generateHealthBar = (percent: number, length: number = 20) => {
    const filled = Math.floor((percent / 100) * length);
    const empty = length - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  };

  return (
    <div
      className={`combat-dashboard ${shake ? 'shake' : ''}`}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1a1a1a',
        borderTop: '3px double var(--hex-stroke)',
        padding: '1rem',
        zIndex: 1000,
        fontFamily: 'VT323, monospace',
        fontSize: '18px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <span style={{ color: '#00ff00' }}>YOU</span>
        <span style={{ color: '#ff0000' }}>VS</span>
        <span style={{ color: '#ff0000' }} className={flash ? 'flash-white' : ''}>
          {enemyName.toUpperCase()}
        </span>
      </div>

      {/* Main Arena */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '0.5rem',
        }}
      >
        {/* Left: Player Health Bar */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#00ff00', marginBottom: '0.25rem' }}>HP</div>
          <div
            style={{
              color: '#00ff00',
              whiteSpace: 'nowrap',
              transition: 'width 0.3s ease-out',
            }}
          >
            {generateHealthBar(playerHpPercent)}
          </div>
          <div style={{ color: '#888', fontSize: '14px' }}>
            {Math.max(0, Math.floor(localPlayerHp))}/{combatData.playerMaxHp}
          </div>
        </div>

        {/* Center: Dice Arena */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            position: 'relative',
            minWidth: '120px',
          }}
        >
          {/* Player Dice */}
          <div
            style={{
              border: '2px solid var(--hex-stroke)',
              padding: '0.5rem 1rem',
              backgroundColor: '#000',
              color: '#00ff00',
              fontSize: '24px',
              minWidth: '60px',
              textAlign: 'center',
            }}
          >
            {playerDice}
          </div>

          {/* VS */}
          <div style={{ color: '#888', fontSize: '14px' }}>VS</div>

          {/* Enemy Dice */}
          <div
            className={flash ? 'flash-white' : ''}
            style={{
              border: '2px solid var(--hex-stroke)',
              padding: '0.5rem 1rem',
              backgroundColor: '#000',
              color: '#ff0000',
              fontSize: '24px',
              minWidth: '60px',
              textAlign: 'center',
            }}
          >
            {enemyDice}
          </div>

          {/* Damage Float */}
          {damageFloat.value > 0 && damageFloat.source && (
            <div
              className="damage-float"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: damageFloat.source === 'player' ? '#ffd700' : '#ff0000',
                fontSize: '28px',
                fontWeight: 'bold',
                pointerEvents: 'none',
                animation: 'floatUp 2s ease-out forwards',
              }}
            >
              -{damageFloat.value}
            </div>
          )}
        </div>

        {/* Right: Enemy Health Bar */}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <div style={{ color: '#ff0000', marginBottom: '0.25rem' }}>HP</div>
          <div
            style={{
              color: '#ff0000',
              whiteSpace: 'nowrap',
              transition: 'width 0.3s ease-out',
            }}
          >
            {generateHealthBar(enemyHpPercent)}
          </div>
          <div style={{ color: '#888', fontSize: '14px' }}>
            {Math.max(0, Math.floor(localEnemyHp))}/{combatData.enemyMaxHp}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: 'center',
          color: '#888',
          fontSize: '14px',
          marginTop: '0.5rem',
          borderTop: '1px dashed var(--hex-stroke)',
          paddingTop: '0.5rem',
        }}
      >
        PRESS [SPACE] OR [ESC] TO RETREAT
      </div>
    </div>
  );
}

