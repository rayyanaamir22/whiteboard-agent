// This file requires Next.js, React, and react-konva dependencies.
import React, { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Konva to avoid SSR issues
const Stage = dynamic(() => import('react-konva').then(mod => mod.Stage), { ssr: false });
const Layer = dynamic(() => import('react-konva').then(mod => mod.Layer), { ssr: false });
const Rect = dynamic(() => import('react-konva').then(mod => mod.Rect), { ssr: false });
const Circle = dynamic(() => import('react-konva').then(mod => mod.Circle), { ssr: false });
const Text = dynamic(() => import('react-konva').then(mod => mod.Text), { ssr: false });

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CENTER_X = 400;
const CENTER_Y = 300;

let shapeIdCounter = 0;
const nextShapeId = () => `shape-${Date.now()}-${++shapeIdCounter}`;

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
    return null;
  }
  return null;
}

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
      setWsMessages(msgs => [...msgs, { role: 'ai', text: `Error: ${cmd.reason || 'unclear'}`, color: null, timestamp: new Date() }]);
      continue;
    }
    const summary = applyCommand(setShapes, cmd);
    if (summary) {
      setWsMessages(msgs => [...msgs, { role: 'ai', text: summary, color: cmd.color || null, timestamp: new Date() }]);
    }
  }
}

function pickTargetShapeId(shapes, transcript) {
  if (!shapes.length) return null;
  const t = transcript.toLowerCase();
  if (/\b(last|the last one)\b/.test(t)) return shapes[shapes.length - 1].id;
  if (/\b(first|the first one)\b/.test(t)) return shapes[0].id;
  if (/\b(second|the second one)\b/.test(t) && shapes.length > 1) return shapes[1].id;
  if (/\b(third|the third one)\b/.test(t) && shapes.length > 2) return shapes[2].id;
  if (/\b(the )?circle\b/.test(t)) { const s = shapes.find(sh => sh.type === 'circle'); if (s) return s.id; }
  if (/\b(the )?(rectangle|rect|square)\b/.test(t)) { const s = shapes.find(sh => sh.type === 'rectangle'); if (s) return s.id; }
  if (/\b(the )?text\b/.test(t)) { const s = shapes.find(sh => sh.type === 'text'); if (s) return s.id; }
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
  return shapes[0].id;
}

function getMockCommand(transcript, shapes = []) {
  const t = transcript.toLowerCase();
  if (t.includes('clear')) return { type: 'CLEAR' };
  if (t.includes('write ') || t.startsWith('write')) {
    const match = transcript.match(/write\s+(.+)/i);
    const text = match ? match[1].trim() : transcript.replace(/^write\s*/i, '');
    const color = t.includes('green') ? 'green' : t.includes('red') ? 'red' : t.includes('blue') ? 'blue' : 'black';
    return { type: 'WRITE', text: text || 'Hello', x: CENTER_X, y: CENTER_Y, color };
  }
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

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Extract a "highlight color" from a command text string like "Draw a red circle"
const COLOR_NAMES = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white'];

// Parse the transcript into segments for rich display
// Returns [{ text, highlight: bool, color: string|null }]
function parseHighlights(text, accentColor) {
  if (!accentColor) return [{ text, highlight: false, color: null }];

  // Try to highlight the color name and associated noun
  const colorRegex = new RegExp(`(${COLOR_NAMES.join('|')})`, 'i');
  const match = text.match(colorRegex);
  if (!match) return [{ text, highlight: false, color: null }];

  const idx = match.index;
  const word = match[0];

  // Find adjacent noun after color (e.g. "red circle")
  const afterColor = text.slice(idx + word.length);
  const nounMatch = afterColor.match(/^\s+(\w+)/);
  const highlighted = nounMatch ? word + afterColor.slice(0, nounMatch[0].length) : word;

  return [
    { text: text.slice(0, idx), highlight: false, color: null },
    { text: highlighted, highlight: true, color: accentColor },
    { text: text.slice(idx + highlighted.length), highlight: false, color: null },
  ];
}

// Dot color from shape color
function dotColor(color) {
  if (!color) return '#94a3b8';
  const map = {
    red: '#f87171', blue: '#60a5fa', green: '#4ade80',
    yellow: '#facc15', orange: '#fb923c', purple: '#c084fc',
    pink: '#f472b6', black: '#1e293b', white: '#f1f5f9',
  };
  return map[color.toLowerCase()] || color;
}

// ─── icons ──────────────────────────────────────────────────────────────────

const MicIcon = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);

const UndoIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

const RedoIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </svg>
);

const BrushIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3z" />
    <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
    <path d="M14.5 17.5 4.5 15" />
  </svg>
);

const InfoIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// ─── main component ──────────────────────────────────────────────────────────

const COLORS = {
  chrome: '#1a2f4e',
  chromeLight: '#243d5e',
  chromeDark: '#14253d',
  border: '#2d4a6e',
  canvasBg: '#ffffff',
  connected: '#4ade80',
  disconnected: '#64748b',
  youText: '#7dd3fc',
  aiText: '#86efac',
  micButton: '#3b82f6',
  micButtonHover: '#2563eb',
  hint: '#64748b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  buttonBg: 'rgba(255,255,255,0.08)',
  buttonBorder: 'rgba(255,255,255,0.12)',
};

const IndexPage = () => {
  const [shapes, setShapes] = useState(INITIAL_SHAPES);
  const [history, setHistory] = useState([INITIAL_SHAPES]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [wsMessages, setWsMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [connected, setConnected] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const [micHover, setMicHover] = useState(false);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const logEndRef = useRef(null);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  // Push to history on shapes change (for undo/redo)
  const setShapesWithHistory = (updater) => {
    setShapes(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setHistory(h => {
        const trimmed = h.slice(0, historyIndex + 1);
        return [...trimmed, next];
      });
      setHistoryIndex(i => i + 1);
      return next;
    });
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setShapes(history[newIndex]);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setShapes(history[newIndex]);
  };

  // WebSocket setup
  useEffect(() => {
    const ws = new window.WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      const raw = event.data;
      let payload = null;
      try {
        payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (_) {}
      if (!payload || typeof payload !== 'object') {
        setWsMessages(msgs => [...msgs, { role: 'ai', text: raw, color: null, timestamp: new Date() }]);
        return;
      }
      processCommandPayload(setShapesWithHistory, setWsMessages, payload);
    };
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [wsMessages]);

  // Scale canvas to fit
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

  // Speech
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
        const transcript = event.results[0][0].transcript.trim();
        const tLower = transcript.toLowerCase();
        // Detect color from transcript for dot
        const colorMatch = tLower.match(new RegExp(COLOR_NAMES.join('|')));
        const color = colorMatch ? colorMatch[0] : null;
        setWsMessages(msgs => [...msgs, { role: 'you', text: transcript, color, timestamp: new Date() }]);
        if (wsRef.current && wsRef.current.readyState === 1) {
          wsRef.current.send(transcript);
        } else {
          const mock = getMockCommand(transcript, shapesRef.current);
          if (mock) processCommandPayload(setShapesWithHistory, setWsMessages, mock);
        }
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
    setIsListening(true);
    recognitionRef.current.start();
  };

  const handleShapeDragEnd = (shapeId, e) => {
    const node = e.target;
    setShapes(prev => prev.map(s => s.id === shapeId ? { ...s, x: node.x(), y: node.y() } : s));
  };

  // Group consecutive log entries by minute for timestamp grouping
  const groupedLog = [];
  wsMessages.forEach((msg) => {
    const time = formatTime(msg.timestamp);
    const last = groupedLog[groupedLog.length - 1];
    if (!last || last.time !== time) {
      groupedLog.push({ time, entries: [msg] });
    } else {
      last.entries.push(msg);
    }
  });

  return (
    <div style={{
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      background: COLORS.chrome,
      display: 'flex',
      flexDirection: 'column',
      color: COLORS.text,
      fontFamily: '"DM Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      boxSizing: 'border-box',
    }}>

      {/* ── Top header ── */}
      <header style={{
        flexShrink: 0,
        background: COLORS.chromeDark,
        padding: '0 20px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        {/* Left: logo + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MicIcon size={20} color="#fff" />
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>VocalCanvas</span>
          {/* User avatar circle */}
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}>A</div>
          {/* Info icon */}
          <button style={{
            background: 'none',
            border: 'none',
            color: COLORS.textMuted,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}>
            <InfoIcon />
          </button>
        </div>

        {/* Right: Save / Load / Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={{
            padding: '6px 16px',
            borderRadius: 8,
            border: `1px solid ${COLORS.buttonBorder}`,
            background: COLORS.buttonBg,
            color: COLORS.text,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}>Save Room</button>
          <button style={{
            padding: '6px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#22c55e',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}>Load Room</button>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: connected ? COLORS.connected : COLORS.disconnected,
            paddingLeft: 4,
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: connected ? COLORS.connected : COLORS.disconnected,
            }} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </header>

      {/* ── Main: canvas + log ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, minWidth: 0 }}>

        {/* Canvas area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Toolbar */}
          <div style={{
            flexShrink: 0,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: COLORS.chromeLight,
              borderRadius: 10,
              padding: '5px 10px',
              border: `1px solid ${COLORS.border}`,
            }}>
              {/* Undo */}
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="Undo"
                style={{
                  background: 'none',
                  border: 'none',
                  color: historyIndex <= 0 ? COLORS.hint : COLORS.text,
                  cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                }}
              ><UndoIcon /></button>

              {/* Redo */}
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="Redo"
                style={{
                  background: 'none',
                  border: 'none',
                  color: historyIndex >= history.length - 1 ? COLORS.hint : COLORS.text,
                  cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                }}
              ><RedoIcon /></button>

              {/* Divider */}
              <div style={{ width: 1, height: 18, background: COLORS.border, margin: '0 4px' }} />

              {/* Brush */}
              <button style={{
                background: 'none',
                border: 'none',
                color: COLORS.textMuted,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
              }}><BrushIcon /></button>

              {/* Color palette dots */}
              {['#facc15', '#4ade80', '#60a5fa'].map((c) => (
                <button
                  key={c}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: c,
                    border: '2px solid rgba(255,255,255,0.15)',
                    cursor: 'pointer',
                    margin: '0 2px',
                  }}
                  title={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div
            ref={canvasContainerRef}
            style={{
              flex: 1,
              padding: '0 16px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
              backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              borderRadius: 12,
              boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}>
              <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                <Layer>
                  {shapes.map((shape) => {
                    if (shape.type === 'rectangle') {
                      return (
                        <Rect
                          key={shape.id}
                          x={shape.x} y={shape.y}
                          width={shape.width} height={shape.height}
                          fill={shape.fill} stroke={shape.stroke}
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
                          x={shape.x} y={shape.y}
                          radius={shape.radius}
                          fill={shape.fill} stroke={shape.stroke}
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
                          x={shape.x} y={shape.y}
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
        </div>

        {/* ── Command log panel ── */}
        <aside style={{
          flexShrink: 0,
          width: 300,
          minWidth: 240,
          background: COLORS.chromeLight,
          borderLeft: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}>
          {/* Log header */}
          <div style={{
            padding: '14px 16px 12px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: COLORS.text }}>Command Log</span>
            <span style={{
              fontSize: 11,
              padding: '2px 7px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.08)',
              color: COLORS.textMuted,
              letterSpacing: '0.01em',
            }}>real-time</span>
          </div>

          {/* Log entries */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px 0',
          }}>
            {wsMessages.length === 0 && (
              <div style={{ padding: '8px 16px', color: COLORS.hint, fontSize: 13 }}>
                Speak a command to see it here...
              </div>
            )}
            {groupedLog.map((group, gi) => (
              <div key={gi}>
                {/* Timestamp */}
                <div style={{
                  padding: '4px 16px 8px',
                  fontSize: 11,
                  color: COLORS.textMuted,
                  letterSpacing: '0.03em',
                }}>
                  {group.time}
                </div>
                {/* Entries in this time group */}
                {group.entries.map((entry, ei) => {
                  const segments = parseHighlights(entry.text, entry.color);
                  const dc = dotColor(entry.color);
                  return (
                    <div
                      key={ei}
                      style={{
                        display: 'flex',
                        gap: 10,
                        padding: '6px 16px',
                        alignItems: 'flex-start',
                      }}
                    >
                      {/* Colored dot */}
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: dc,
                        marginTop: 4,
                        flexShrink: 0,
                        boxShadow: `0 0 6px ${dc}55`,
                      }} />
                      {/* Text content */}
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: COLORS.text }}>
                        {segments.map((seg, si) =>
                          seg.highlight ? (
                            <span key={si} style={{ color: dotColor(seg.color), fontWeight: 600 }}>
                              {seg.text}
                            </span>
                          ) : (
                            <span key={si}>{seg.text}</span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* Log footer hint */}
          <div style={{
            flexShrink: 0,
            padding: '10px 16px',
            borderTop: `1px solid ${COLORS.border}`,
            color: COLORS.hint,
            fontSize: 12,
            fontStyle: 'italic',
          }}>
            Speak a command to see it here...
          </div>
        </aside>
      </div>

      {/* ── Bottom: mic + hint ── */}
      <footer style={{
        flexShrink: 0,
        background: COLORS.chromeDark,
        borderTop: `1px solid ${COLORS.border}`,
        padding: '18px 24px 22px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}>
        <button
          onClick={handleSpeech}
          disabled={isListening}
          onMouseEnter={() => setMicHover(true)}
          onMouseLeave={() => setMicHover(false)}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: 'none',
            background: isListening
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : micHover
                ? `linear-gradient(135deg, ${COLORS.micButtonHover}, #1d4ed8)`
                : `linear-gradient(135deg, ${COLORS.micButton}, #2563eb)`,
            color: '#fff',
            cursor: isListening ? 'wait' : 'pointer',
            boxShadow: isListening
              ? '0 0 0 6px rgba(239,68,68,0.2), 0 4px 20px rgba(239,68,68,0.4)'
              : '0 4px 20px rgba(59,130,246,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
          title={isListening ? 'Listening...' : 'Speak command'}
        >
          <MicIcon size={26} color="#fff" />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
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
