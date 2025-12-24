import { useState } from 'react';
import './AuthScreen.css';

interface AuthScreenProps {
  onAuthSuccess: (token: string) => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [accessCode, setAccessCode] = useState('');
  const [serverCode, setServerCode] = useState('');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First, test if server is reachable
      try {
        const testResponse = await fetch('http://localhost:3000/api/test', { 
          method: 'GET',
          signal: AbortSignal.timeout(2000) 
        });
        const testData = await testResponse.json();
        console.log('Server test response:', testData);
      } catch (testErr) {
        console.error('Server test failed:', testErr);
        setError('Cannot connect to server. Make sure the server is running on http://localhost:3000');
        setLoading(false);
        return;
      }

      const endpoint = activeTab === 'login' ? '/api/login' : '/api/signup';
      const url = `http://localhost:3000${endpoint}`;
      console.log('Sending auth request to:', url, { handle, serverCode, hasAccessCode: !!accessCode });
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ handle, password, accessCode, serverCode }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok && response.status !== 403) {
        const text = await response.text();
        console.error('Non-OK response:', response.status, text);
        throw new Error(`Server error: ${response.status} - ${text}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);

      if (response.status === 403) {
        setError('INVALID SECURITY CLEARANCE');
        return;
      }

      if (data.success && data.token) {
        localStorage.setItem('authToken', data.token);
        onAuthSuccess(data.token);
        // Note: loading will be set to false in finally block
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out. Is the server running?');
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError('Cannot connect to server. Make sure the server is running on http://localhost:3000');
        } else {
          setError(err.message || 'Connection error. Please try again.');
        }
        console.error('Auth error:', err.name, err.message, err);
      } else {
        setError('Connection error. Please try again.');
        console.error('Auth error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        {/* ASCII Logo */}
        <pre className="auth-logo">
{`░█████╗░ ██████╗░ ██╗░░░██╗ ███████╗ ███╗░░██╗ ████████╗ ██╗░░░██╗ ██████╗░ ███████╗
██╔══██╗ ██╔══██╗ ██║░░░██║ ██╔════╝ ████╗░██║ ╚══██╔══╝ ██║░░░██║ ██╔══██╗ ██╔════╝
███████║ ██║░░██║ ╚██╗░██╔╝ █████╗░░ ██╔██╗██║ ░░░██║░░░ ██║░░░██║ ██████╔╝ █████╗░░
██╔══██║ ██║░░██║ ░╚████╔╝░ ██╔══╝░░ ██║╚████║ ░░░██║░░░ ██║░░░██║ ██╔══██╗ ██╔══╝░░
██║░░██║ ██████╔╝ ░░╚██╔╝░░ ███████╗ ██║░╚███║ ░░░██║░░░ ╚██████╔╝ ██║░░██║ ███████╗
╚═╝░░╚═╝ ╚═════╝░ ░░░╚═╝░░░ ╚══════╝ ╚═╝░░╚══╝ ░░░╚═╝░░░ ░╚═════╝░ ╚═╝░░╚═╝ ╚══════╝

                      ██╗ ░██████╗ ██╗░░░░░ ░█████╗░ ███╗░░██╗ ██████╗░
                      ██║ ██╔════╝ ██║░░░░░ ██╔══██╗ ████╗░██║ ██╔══██╗
                      ██║ ╚█████╗░ ██║░░░░░ ███████║ ██╔██╗██║ ██║░░██║
                      ██║ ░╚═══██╗ ██║░░░░░ ██╔══██║ ██║╚████║ ██║░░██║
                      ██║ ██████╔╝ ███████╗ ██║░░██║ ██║░╚███║ ██████╔╝
                      ╚═╝ ╚═════╝░ ╚══════╝ ╚═╝░░╚═╝ ╚═╝░░╚══╝ ╚═════╝░`}
        </pre>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('login');
              setError('');
            }}
          >
            [ LOGIN ]
          </button>
          <button
            className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('signup');
              setError('');
            }}
          >
            [ CREATE ]
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-input-group auth-access-code">
            <label htmlFor="accessCode">SECURITY CLEARANCE:</label>
            <input
              id="accessCode"
              type="text"
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                if (error) setError('');
              }}
              required
              autoComplete="off"
              disabled={loading}
              placeholder="Enter server access code"
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="serverCode">ISLAND CODE:</label>
            <input
              id="serverCode"
              type="text"
              value={serverCode}
              onChange={(e) => {
                setServerCode(e.target.value.toUpperCase());
                if (error) setError('');
              }}
              required
              autoComplete="off"
              disabled={loading}
              placeholder="Enter island code (e.g., ALPHA)"
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="handle">Username:</label>
            <input
              id="handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
              disabled={loading}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'CONNECTING...' : 'ENTER THE ISLAND'}
          </button>
        </form>
      </div>
    </div>
  );
}

