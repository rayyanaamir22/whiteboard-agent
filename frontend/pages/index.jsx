// This file requires Next.js, React, and react-konva dependencies. Now using plain JavaScript.
import React, { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Konva to avoid SSR issues
const Stage = dynamic(() => import('react-konva').then(mod => mod.Stage), { ssr: false });
const Layer = dynamic(() => import('react-konva').then(mod => mod.Layer), { ssr: false });
const Rect = dynamic(() => import('react-konva').then(mod => mod.Rect), { ssr: false });
const Circle = dynamic(() => import('react-konva').then(mod => mod.Circle), { ssr: false });
const Text = dynamic(() => import('react-konva').then(mod => mod.Text), { ssr: false });

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

// Canvas size to match prompt.js
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CENTER_X = 400;
const CENTER_Y = 300;

// Generate unique shape id
let shapeIdCounter = 0;
const nextShapeId = () => `shape-${Date.now()}-${++shapeIdCounter}`;

// Apply a command from the agent to the shapes state (matches prompt.js schema)
function applyCommand(setShapes, command) {
  if (!command || !command.type) return null;
  const t = command.type;

  if (t === 'DRAW') {
    const id = nextShapeId();
    const x = command.x ?? CENTER_X;
    const y = command.y ?? CENTER_Y;
    const color = command.color || 'black';
    if (command.shape === 'circle') {
      const radius = command.radius ?? 50;
      setShapes(prev => [...prev, { id, type: 'circle', x, y, radius, fill: color, stroke: color }]);
      return `Circle created at [${x}, ${y}]`;
    }
    if (command.shape === 'rectangle') {
      const width = command.width ?? 100;
      const height = command.height ?? 100;
      setShapes(prev => [...prev, { id, type: 'rectangle', x, y, width, height, fill: color, stroke: color }]);
      return `Square created at [${x}, ${y}]`;
    }
    return null;
  }

  if (t === 'WRITE') {
    const id = nextShapeId();
    const x = command.x ?? CENTER_X;
    const y = command.y ?? CENTER_Y;
    const text = command.text ?? '';
    const fontSize = command.fontSize ?? 24;
    const color = command.color || 'black';
    setShapes(prev => [...prev, { id, type: 'text', x, y, text, fontSize, fill: color }]);
    return 'Text added';
  }

  if (t === 'DELETE') {
    setShapes(prev => prev.filter(s => s.id !== command.id));
    return `Deleted ${command.id}`;
  }

  if (t === 'CLEAR') {
    setShapes([]);
    return 'Canvas cleared';
  }

  if (t === 'MOVE') {
    setShapes(prev => prev.map(s => s.id === command.id ? { ...s, x: command.x, y: command.y } : s));
    return `Moved to [${command.x}, ${command.y}]`;
  }

  if (t === 'ERROR') {
    return null; // already handled in log
  }
  return null;
}

// Simple mock command from transcript when agent is disconnected (for testing)
function getMockCommand(transcript) {
  const t = transcript.toLowerCase();
  if (t.includes('clear')) return { type: 'CLEAR' };
  // Check circle before rectangle so "draw a red circle" -> circle not square
  if (t.includes('circle')) {
    const color = t.includes('red') ? 'red' : t.includes('blue') ? 'blue' : t.includes('green') ? 'green' : t.includes('yellow') ? 'yellow' : 'black';
    return { type: 'DRAW', shape: 'circle', x: CENTER_X, y: CENTER_Y, radius: 50, color };
  }
  if (t.includes('draw') || t.includes('square') || t.includes('rectangle') || t.includes('rect')) {
    const color = t.includes('red') ? 'red' : t.includes('blue') ? 'blue' : t.includes('green') ? 'green' : t.includes('yellow') ? 'yellow' : 'black';
    return { type: 'DRAW', shape: 'rectangle', x: CENTER_X, y: CENTER_Y, width: 100, height: 100, color };
  }
  if (t.includes('write ') || t.startsWith('write')) {
    const match = transcript.match(/write\s+(.+)/i);
    const text = match ? match[1].trim() : transcript.replace(/^write\s*/i, '');
    return { type: 'WRITE', text: text || 'Hello', x: CENTER_X, y: CENTER_Y };
  }
  return null;
}

// Initial shapes: one rectangle, one circle, one text (VocalCanvas-style)
const INITIAL_SHAPES = [
  { id: 'rect-1', type: 'rectangle', x: 150, y: 100, width: 100, height: 100, fill: '#e57373', stroke: '#c62828' },
  { id: 'circle-1', type: 'circle', x: 400, y: 350, radius: 50, fill: '#64b5f6', stroke: '#1976d2' },
  { id: 'text-1', type: 'text', x: 280, y: 250, text: 'Hello', fontSize: 24, fill: 'black' },
];

// VocalCanvas theme
const COLORS = {
  chrome: '#1e3a5f',
  chromeLight: '#2c5282',
  canvasBg: '#ffffff',
  dotGrid: '#e0e0e0',
  connected: '#48bb78',
  disconnected: '#718096',
  youText: '#90cdf4',
  aiText: '#9ae6b4',
  micButton: '#4299e1',
  hint: '#a0aec0',
};

// Inline SVG mic icon (no emoji)
const MicIcon = ({ size = 24, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', ...style }}>
    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);

const IndexPage = () => {
  const [shapes, setShapes] = useState(INITIAL_SHAPES);
  const [wsMessages, setWsMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [connected, setConnected] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const canvasContainerRef = useRef(null);

  // WebSocket setup: receive JSON commands, apply to canvas, add to log
  useEffect(() => {
    const ws = new window.WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      const raw = event.data;
      let cmd = null;
      try {
        cmd = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (_) {}
      if (cmd && typeof cmd === 'object' && cmd.type) {
        const summary = applyCommand(setShapes, cmd);
        if (summary) {
          setWsMessages(msgs => [...msgs, `[AI] Action: ${summary}`]);
        } else if (cmd.type === 'ERROR') {
          setWsMessages(msgs => [...msgs, `[AI] Error: ${cmd.reason || 'unclear'}`]);
        }
      } else {
        setWsMessages(msgs => [...msgs, raw]);
      }
    };
    ws.onopen = () => {
      setConnected(true);
      setWsMessages(msgs => [...msgs, '[WebSocket connected]']);
    };
    ws.onclose = () => {
      setConnected(false);
      setWsMessages(msgs => [...msgs, '[WebSocket disconnected]']);
    };
    return () => ws.close();
  }, []);

  // Scale canvas to fit available space (viewport-filling, responsive)
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const updateScale = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const scale = Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT, 1) || 1;
      setCanvasScale(scale);
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Web Speech API setup
  const handleSpeech = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Web Speech API not supported');
      return;
    }
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim().toLowerCase();
        setWsMessages(msgs => [...msgs, `[Speech] ${transcript}`]);
        if (wsRef.current && wsRef.current.readyState === 1) {
          wsRef.current.send(transcript);
        } else {
          // Mock when agent disconnected: try to parse simple commands for testing
          const mock = getMockCommand(transcript);
          if (mock) {
            const summary = applyCommand(setShapes, mock);
            if (summary) setWsMessages(msgs => [...msgs, `[AI] Action: ${summary}`]);
          }
        }
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
    setIsListening(true);
    recognitionRef.current.start();
  };

  // Command log entries: [Speech] -> YOU:, [AI] -> AI: (strip prefix), skip [WebSocket ...]
  const logEntries = wsMessages
    .filter(m => !m.startsWith('[WebSocket'))
    .map(m => {
      if (m.startsWith('[Speech] ')) return { role: 'you', text: m.replace('[Speech] ', '') };
      if (m.startsWith('[AI] ')) return { role: 'ai', text: m.replace('[AI] ', '') };
      return { role: 'ai', text: m };
    });

  return (
    <div style={{
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      background: COLORS.chrome,
      display: 'flex',
      flexDirection: 'column',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box',
    }}>
      {/* Top header */}
      <header style={{
        flexShrink: 0,
        background: COLORS.chrome,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${COLORS.chromeLight}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MicIcon size={24} color="#fff" />
          <span style={{ fontSize: 20, fontWeight: 600 }}>VocalCanvas</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: connected ? COLORS.connected : COLORS.disconnected,
          fontSize: 14,
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? COLORS.connected : COLORS.disconnected,
          }} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </header>

      {/* Main: canvas + command log */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, minWidth: 0 }}>
        {/* Whiteboard with dotted grid - scales to fit */}
        <div
          ref={canvasContainerRef}
          style={{
            flex: 1,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.chrome,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <div style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `scale(${canvasScale})`,
            transformOrigin: 'center center',
            background: COLORS.canvasBg,
            backgroundImage: 'radial-gradient(circle, #e0e0e0 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}>
            <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
              <Layer>
                {shapes.map((shape) => {
                  if (shape.type === 'rectangle') {
                    return (
                      <Rect
                        key={shape.id}
                        x={shape.x}
                        y={shape.y}
                        width={shape.width}
                        height={shape.height}
                        fill={shape.fill}
                        stroke={shape.stroke}
                        draggable
                      />
                    );
                  }
                  if (shape.type === 'circle') {
                    return (
                      <Circle
                        key={shape.id}
                        x={shape.x}
                        y={shape.y}
                        radius={shape.radius}
                        fill={shape.fill}
                        stroke={shape.stroke}
                        draggable
                      />
                    );
                  }
                  if (shape.type === 'text') {
                    return (
                      <Text
                        key={shape.id}
                        x={shape.x}
                        y={shape.y}
                        text={shape.text}
                        fontSize={shape.fontSize || 24}
                        fill={shape.fill || 'black'}
                        draggable
                      />
                    );
                  }
                  return null;
                })}
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Command log panel */}
        <aside style={{
          flexShrink: 0,
          width: 320,
          minWidth: 260,
          background: COLORS.chromeLight,
          borderLeft: `1px solid ${COLORS.chrome}`,
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          minHeight: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>COMMAND LOG</span>
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.15)',
              color: COLORS.hint,
            }}>Real-time</span>
          </div>
          <div style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {logEntries.length === 0 && (
              <span style={{ color: COLORS.hint, fontSize: 13 }}>Speak a command to see it here.</span>
            )}
            {logEntries.map((entry, i) => (
              <div key={i} style={{ fontSize: 13 }}>
                <span style={{ color: entry.role === 'you' ? COLORS.youText : COLORS.aiText, fontWeight: 600 }}>
                  {entry.role === 'you' ? 'YOU: ' : 'AI: '}
                </span>
                <span style={{ color: '#e2e8f0' }}>
                  {entry.role === 'you' ? `"${entry.text}"` : entry.text}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Bottom: mic + status + hint */}
      <footer style={{
        flexShrink: 0,
        background: COLORS.chrome,
        borderTop: `1px solid ${COLORS.chromeLight}`,
        padding: '16px 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}>
        <button
          onClick={handleSpeech}
          disabled={isListening}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: 'none',
            background: COLORS.micButton,
            color: '#fff',
            cursor: isListening ? 'wait' : 'pointer',
            boxShadow: '0 4px 20px rgba(66, 153, 225, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={isListening ? 'Listening...' : 'Speak command'}
        >
          <MicIcon size={28} color="#fff" />
        </button>
        <span style={{ fontSize: 14, color: '#e2e8f0' }}>
          {isListening ? 'Listening...' : 'Speak command'}
        </span>
        <span style={{ fontSize: 12, color: COLORS.hint }}>
          Try saying &quot;draw a yellow star&quot;
        </span>
      </footer>
    </div>
  );
};

export default IndexPage; 