import { useEffect, useState } from 'react';
import './App.css';
import { useGameSocket } from './hooks/useGameSocket';
import { Terminal } from './components/Terminal';
import type { LogEntry } from './components/Terminal';
import { HexMap } from './components/HexMap';
import { HUD } from './components/HUD';
import { AuthScreen } from './components/AuthScreen';
import type { User, Room, StateUpdatePayload, Item, Animation, CombatUpdatePayload, CombatEndPayload } from './types';

function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });
  const { socket, isConnected } = useGameSocket(authToken);

  // Allow body scrolling when auth screen is shown
  useEffect(() => {
    if (!authToken) {
      document.body.style.overflowY = 'auto';
    } else {
      document.body.style.overflowY = 'hidden';
    }
    return () => {
      document.body.style.overflowY = '';
    };
  }, [authToken]);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [player, setPlayer] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [visibleRooms, setVisibleRooms] = useState<Room[]>([]);
  const [roomItems, setRoomItems] = useState<Item[]>([]);
  const [playersInRoom, setPlayersInRoom] = useState<string[]>([]);
  const [activeAnimation, setActiveAnimation] = useState<Animation | null>(null);
  const [roomTapestry, setRoomTapestry] = useState<Animation | null>(null);
  const [inCombat, setInCombat] = useState(false);
  const [combatData, setCombatData] = useState<CombatUpdatePayload | null>(null);
  const [enemyName, setEnemyName] = useState<string>('');
  const [combatAnimation, setCombatAnimation] = useState<Animation | null>(null);
  const [inventory, setInventory] = useState<Item[]>([]);

  const handleAuthSuccess = (token: string) => {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
  };

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleLog = (entry: LogEntry) => {
      setHistory((prev) => [...prev, entry]);
    };

    const handleStateUpdate = (payload: StateUpdatePayload) => {
      setPlayer(payload.player);
      setRoom(payload.room);
      setVisibleRooms(payload.visibleRooms);
      setRoomItems(payload.roomItems || []);
      setPlayersInRoom(payload.playersInRoom || []);
      setInventory(payload.inventory || []);
    };

    const handleAnimationPlay = (animation: Animation) => {
      // If it's a TAPESTRY, store it for the Room Card display
      if (animation.type === 'TAPESTRY') {
        setRoomTapestry(animation);
      } else {
        // Other animations play in the viewport
        setActiveAnimation(animation);
      }
    };

    const handleCombatUpdate = (data: CombatUpdatePayload) => {
      setCombatData(data);
      setInCombat(true);
      
      // Update player HP in real-time for HUD
      if (player) {
        setPlayer({
          ...player,
          hp: data.playerHp,
          max_hp: data.playerMaxHp,
        });
      }
      
      // Extract enemy name and animation from room items
      if (roomItems.length > 0) {
        const enemy = roomItems.find((item) => item.enemy_hp && item.enemy_hp > 0);
        if (enemy && enemyName !== enemy.name) {
          setEnemyName(enemy.name);
        }
      }
    };

    const handleCombatEnd = (_data: CombatEndPayload) => {
      setInCombat(false);
      setCombatData(null);
      setCombatAnimation(null);
      setEnemyName('');
    };

    socket.on('game:log', handleLog);
    socket.on('state:update', handleStateUpdate);
    socket.on('animation:play', handleAnimationPlay);
    socket.on('combat:update', handleCombatUpdate);
    socket.on('combat:end', handleCombatEnd);

    return () => {
      socket.off('game:log', handleLog);
      socket.off('state:update', handleStateUpdate);
      socket.off('animation:play', handleAnimationPlay);
      socket.off('combat:update', handleCombatUpdate);
      socket.off('combat:end', handleCombatEnd);
    };
  }, [socket]);

  const handleCommand = (command: string) => {
    if (!socket) {
      setHistory((prev) => [
        ...prev,
        { text: 'Not connected to server.', type: 'error' },
      ]);
      return;
    }

    socket.emit('cmd:input', { raw: command });
  };

  const effectiveHistory: LogEntry[] = isConnected
    ? history
    : [{ text: 'Connecting to server...', type: 'info' }, ...history];

  // Conditional rendering - but all hooks have been called above
  if (!authToken) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        background: '#000',
        borderLeft: '1px solid #333',
        borderRight: '1px solid #333',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
        }}
      >
        <HexMap player={player} room={room} visibleRooms={visibleRooms} />
        <HUD player={player} inventory={inventory} />
      </div>
      <div
        style={{
          flex: 2,
          minHeight: 0,
          borderTop: '2px solid var(--accent-gold)',
          position: 'relative',
        }}
      >
        <Terminal
          history={effectiveHistory}
          onCommand={handleCommand}
          player={player}
          room={room}
          roomItems={roomItems}
          playersInRoom={playersInRoom}
          roomTapestry={roomTapestry}
          activeAnimation={inCombat ? combatAnimation : activeAnimation}
          onAnimationComplete={() => setActiveAnimation(null)}
          inCombat={inCombat}
          combatData={combatData}
          enemyName={enemyName}
          onEnemyNameChange={setEnemyName}
          onRetreat={() => {
            if (socket) {
              socket.emit('combat:retreat');
            }
          }}
        />
      </div>
    </div>
  );
}

export default App;
