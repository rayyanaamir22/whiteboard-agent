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
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

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
    const useRelative = 'deltaX' in command || 'deltaY' in command;
    setShapes(prev => prev.map(s => {
      if (s.id !== command.id) return s;
      if (useRelative) {
        const dx = command.deltaX ?? 0;
        const dy = command.deltaY ?? 0;
        return { ...s, x: s.x + dx, y: s.y + dy };
      }
      return { ...s, x: command.x, y: command.y };
    }));
    if (useRelative) {
      const dx = command.deltaX ?? 0;
      const dy = command.deltaY ?? 0;
      return `Moved by (${dx}, ${dy})`;
    }
    return `Moved to [${command.x}, ${command.y}]`;
  }

  if (t === 'RESIZE') {
    const scale = command.scale ?? 1;
    setShapes(prev => prev.map(s => {
      if (s.id !== command.id) return s;
      if (s.type === 'rectangle') return { ...s, width: (s.width || 100) * scale, height: (s.height || 100) * scale };
      if (s.type === 'circle') return { ...s, radius: (s.radius || 50) * scale };
      if (s.type === 'text') return { ...s, fontSize: (s.fontSize || 24) * scale };
      return s;
    }));
    return `Resized by ${scale}x`;
  }

  if (t === 'ROTATE') {
    const degrees = command.degrees ?? 0;
    setShapes(prev => prev.map(s => s.id === command.id ? { ...s, rotation: (s.rotation || 0) + degrees } : s));
    return `Rotated ${degrees}°`;
  }

  if (t === 'ERROR') {
    return null; // already handled in log
  }
  return null;
}

// Normalize payload to command list and run each (used by WebSocket and mock).
// Payload can be: single command { type, ... }, array [cmd, ...], or { commands: [cmd, ...] }.
function processCommandPayload(setShapes, setWsMessages, payload) {
  if (!payload || typeof payload !== 'object') return;
  const commands = Array.isArray(payload)
    ? payload
    : payload.commands && Array.isArray(payload.commands)
      ? payload.commands
      : payload.type
        ? [payload]
        : [];
  for (const cmd of commands) {
    if (!cmd || typeof cmd !== 'object' || !cmd.type) continue;
    if (cmd.type === 'ERROR') {
      setWsMessages(msgs => [...msgs, `[AI] Error: ${cmd.reason || 'unclear'}`]);
      continue;
    }
    const summary = applyCommand(setShapes, cmd);
    if (summary) setWsMessages(msgs => [...msgs, `[AI] Action: ${summary}`]);
  }
}

// Pick which shape to target from transcript (for RESIZE/ROTATE/MOVE/DELETE mock).
// Returns shape id or null. Falls back to first shape if no specifier.
function pickTargetShapeId(shapes, transcript) {
  if (!shapes.length) return null;
  const t = transcript.toLowerCase();
  // Explicit: "the last one", "last", "the first one", "first", "second", "third"
  if (/\b(last|the last one)\b/.test(t)) return shapes[shapes.length - 1].id;
  if (/\b(first|the first one)\b/.test(t)) return shapes[0].id;
  if (/\b(second|the second one)\b/.test(t) && shapes.length > 1) return shapes[1].id;
  if (/\b(third|the third one)\b/.test(t) && shapes.length > 2) return shapes[2].id;
  // By type: "the circle", "the rectangle", "the text"
  if (/\b(the )?circle\b/.test(t)) { const s = shapes.find(sh => sh.type === 'circle'); if (s) return s.id; }
  if (/\b(the )?(rectangle|rect|square)\b/.test(t)) { const s = shapes.find(sh => sh.type === 'rectangle'); if (s) return s.id; }
  if (/\b(the )?text\b/.test(t)) { const s = shapes.find(sh => sh.type === 'text'); if (s) return s.id; }
  // By color: "the red one", "the blue one" (named or hex)
  const colorToFills = { red: ['red', '#e57373', '#c62828'], blue: ['blue', '#64b5f6', '#1976d2'], green: ['green'], yellow: ['yellow'], black: ['black'] };
  for (const [c, fills] of Object.entries(colorToFills)) {
    if (new RegExp(`\\b(the )?${c}( one)?\\b`).test(t)) {
      const s = shapes.find(sh => {
        const f = (sh.fill || '').toLowerCase();
        return f.includes(c) || fills.some(v => f === v.toLowerCase());
      });
      if (s) return s.id;
    }
  }
  return shapes[0].id; // default: first shape
}

// Simple mock command from transcript when agent is disconnected (for testing)
function getMockCommand(transcript, shapes = []) {
  const t = transcript.toLowerCase();

  if (t.includes('clear')) return { type: 'CLEAR' };
  if (t.includes('write ') || t.startsWith('write')) {
    const match = transcript.match(/write\s+(.+)/i);
    const text = match ? match[1].trim() : transcript.replace(/^write\s*/i, '');
    return { type: 'WRITE', text: text || 'Hello', x: CENTER_X, y: CENTER_Y };
  }
  // RESIZE / ROTATE before draw so "make the circle bigger" targets circle, doesn't draw
  const targetId = pickTargetShapeId(shapes, transcript);
  if (targetId && (t.includes('bigger') || t.includes('larger') || t.includes('grow'))) {
    return { type: 'RESIZE', id: targetId, scale: 1.5 };
  }
  if (targetId && (t.includes('smaller') || t.includes('shrink'))) {
    return { type: 'RESIZE', id: targetId, scale: 0.75 };
  }
  if (targetId && (t.includes('double') || t.includes('twice'))) {
    return { type: 'RESIZE', id: targetId, scale: 2 };
  }
  if (targetId && (t.includes('rotate') || t.includes('turn'))) {
    const degMatch = t.match(/(\d+)\s*(degree|deg|°)?/);
    const degrees = degMatch ? parseInt(degMatch[1], 10) : 45;
    return { type: 'ROTATE', id: targetId, degrees };
  }
  // Multi-command mock before single DRAW: "stick figure", "stickman", "draw a stickman"
  if (t.includes('stick figure') || t.includes('stickman') || t.includes('stick man')) {
    const cx = CENTER_X;
    const color = 'black';
    return {
      commands: [
        { type: 'DRAW', shape: 'circle', x: cx, y: 120, radius: 28, color },
        { type: 'DRAW', shape: 'rectangle', x: cx - 10, y: 150, width: 20, height: 95, color },
        { type: 'DRAW', shape: 'rectangle', x: cx - 55, y: 175, width: 55, height: 8, color },
        { type: 'DRAW', shape: 'rectangle', x: cx, y: 175, width: 55, height: 8, color },
        { type: 'DRAW', shape: 'rectangle', x: cx - 12, y: 245, width: 8, height: 75, color },
        { type: 'DRAW', shape: 'rectangle', x: cx + 4, y: 245, width: 8, height: 75, color },
      ],
    };
  }
  // DRAW: circle before rectangle so "draw a red circle" -> circle
  if (t.includes('circle')) {
    const color = t.includes('red') ? 'red' : t.includes('blue') ? 'blue' : t.includes('green') ? 'green' : t.includes('yellow') ? 'yellow' : 'black';
    return { type: 'DRAW', shape: 'circle', x: CENTER_X, y: CENTER_Y, radius: 50, color };
  }
  if (t.includes('draw') || t.includes('square') || t.includes('rectangle') || t.includes('rect')) {
    const color = t.includes('red') ? 'red' : t.includes('blue') ? 'blue' : t.includes('green') ? 'green' : t.includes('yellow') ? 'yellow' : 'black';
    return { type: 'DRAW', shape: 'rectangle', x: CENTER_X, y: CENTER_Y, width: 100, height: 100, color };
  }
  return null;
}

const INITIAL_SHAPES = [];

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

const InfoIcon = ({ size = 20, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', ...style }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const IndexPage = () => {
  const [shapes, setShapes] = useState(INITIAL_SHAPES);
  const [wsMessages, setWsMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const [connected, setConnected] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const [showInfo, setShowInfo] = useState(false);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  // WebSocket setup: receive JSON commands, apply to canvas, add to log
  useEffect(() => {
    const ws = new window.WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      setIsWaitingForAI(false);
      const raw = event.data;
      let payload = null;
      try {
        payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (_) {}
      if (!payload || typeof payload !== 'object') {
        setWsMessages(msgs => [...msgs, raw]);
        return;
      }
      processCommandPayload(setShapes, setWsMessages, payload);
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
      recognitionRef.current.onresult = async (event) => {
        const transcript = event.results[0][0].transcript.trim().toLowerCase();
        setWsMessages(msgs => [...msgs, `[Speech] ${transcript}`]);
        if (wsRef.current && wsRef.current.readyState === 1) {
          setIsWaitingForAI(true);
          wsRef.current.send(transcript);
          setTimeout(() => setIsWaitingForAI(false), 50000);
        } else {
          // Try AI (gateway → command-parser/Gemini) first; fall back to local mock if unavailable
          try {
            const res = await fetch(`${GATEWAY_URL}/api/command/parse`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ speech: transcript, context: { shapes: shapesRef.current.length } }),
            });
            if (res.ok) {
              const data = await res.json();
              const payload = data.commands && data.commands.length ? { commands: data.commands } : null;
              if (payload) {
                processCommandPayload(setShapes, setWsMessages, payload);
                setIsListening(false);
                return;
              }
            }
          } catch (_) {
            // Gateway or command-parser down: use mock
          }
          const mock = getMockCommand(transcript, shapesRef.current);
          if (mock) processCommandPayload(setShapes, setWsMessages, mock);
        }
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
    setIsListening(true);
    recognitionRef.current.start();
  };

  // Sync drag to state; backend can use relative MOVE (deltaX/deltaY) so drag never conflicts
  const handleShapeDragEnd = (shapeId, e) => {
    const node = e.target;
    setShapes(prev => prev.map(s => s.id === shapeId ? { ...s, x: node.x(), y: node.y() } : s));
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
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            aria-label="How it works"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              padding: 0,
              border: 'none',
              borderRadius: '50%',
              background: 'transparent',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
            }}
          >
            <InfoIcon size={20} color="currentColor" />
          </button>
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

      {/* How it works overlay */}
      {showInfo && (
        <div
          role="dialog"
          aria-label="How VocalCanvas works"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setShowInfo(false)}
        >
          <div
            style={{
              background: COLORS.chrome,
              border: `1px solid ${COLORS.chromeLight}`,
              borderRadius: 12,
              padding: '24px 28px',
              maxWidth: 360,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>How it works</span>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: 20,
                  lineHeight: 1,
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.6, margin: 0 }}>
              <strong style={{ color: '#fff' }}>Open mic</strong> — Tap the microphone and speak your idea in plain words (e.g. “draw a red circle”, “write Hello”, “draw a stickman”).
            </p>
            <p style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.6, margin: '12px 0 0' }}>
              <strong style={{ color: '#fff' }}>Keep your idea in creation</strong> — The AI turns your speech into shapes and text on the canvas. You can drag shapes to move them. Say “clear” to start over.
            </p>
            <p style={{ fontSize: 12, color: COLORS.hint, lineHeight: 1.5, margin: '16px 0 0' }}>
              When the status shows Connected, your commands are processed in real time. If it shows Disconnected, the app will still try to interpret your speech.
            </p>
          </div>
        </div>
      )}

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
                        rotation={shape.rotation || 0}
                        draggable
                        onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
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
                        rotation={shape.rotation || 0}
                        draggable
                        onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
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
                        rotation={shape.rotation || 0}
                        draggable
                        onDragEnd={(e) => handleShapeDragEnd(shape.id, e)}
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
          disabled={isListening || isWaitingForAI}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: 'none',
            background: COLORS.micButton,
            color: '#fff',
            cursor: isListening || isWaitingForAI ? 'wait' : 'pointer',
            boxShadow: '0 4px 20px rgba(66, 153, 225, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={isListening ? 'Listening...' : isWaitingForAI ? 'AI responding...' : 'Speak command'}
        >
          <MicIcon size={28} color="#fff" />
        </button>
        <span style={{ fontSize: 14, color: '#e2e8f0' }}>
          {isListening ? 'Listening...' : isWaitingForAI ? 'AI responding...' : 'Speak command'}
        </span>
        <span style={{ fontSize: 12, color: COLORS.hint }}>
          Try saying &quot;draw a yellow star&quot;
        </span>
      </footer>
    </div>
  );
};

export default IndexPage; 