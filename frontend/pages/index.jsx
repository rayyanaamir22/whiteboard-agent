// This file requires Next.js, React, and react-konva dependencies. Now using plain JavaScript.
import React, { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Konva to avoid SSR issues
const Stage = dynamic(() => import('react-konva').then(mod => mod.Stage), { ssr: false });
const Layer = dynamic(() => import('react-konva').then(mod => mod.Layer), { ssr: false });
const Rect = dynamic(() => import('react-konva').then(mod => mod.Rect), { ssr: false });

const WS_URL = 'ws://localhost:8080'; // Change as needed

const IndexPage = () => {
  const [rects, setRects] = useState([{ x: 50, y: 60, width: 100, height: 100, fill: 'red' }]);
  const [wsMessages, setWsMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);

  // WebSocket setup
  useEffect(() => {
    const ws = new window.WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      setWsMessages(msgs => [...msgs, event.data]);
    };
    ws.onopen = () => setWsMessages(msgs => [...msgs, '[WebSocket connected]']);
    ws.onclose = () => setWsMessages(msgs => [...msgs, '[WebSocket disconnected]']);
    return () => ws.close();
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
        const transcript = event.results[0][0].transcript;
        setWsMessages(msgs => [...msgs, `[Speech] ${transcript}`]);
        // Optionally send to WebSocket
        if (wsRef.current && wsRef.current.readyState === 1) {
          wsRef.current.send(transcript);
        }
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
    setIsListening(true);
    recognitionRef.current.start();
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Speech Whiteboard (Next.js + Konva + WebSocket + Speech)</h1>
      <div style={{ display: 'flex', gap: 32 }}>
        <div>
          <Stage width={500} height={400} style={{ border: '1px solid #ccc' }}>
            <Layer>
              {rects.map((rect, i) => (
                <Rect key={i} {...rect} draggable />
              ))}
            </Layer>
          </Stage>
          <button onClick={handleSpeech} disabled={isListening} style={{ marginTop: 16 }}>
            {isListening ? 'Listening...' : '🎤 Speak Command'}
          </button>
        </div>
        <div style={{ minWidth: 300 }}>
          <h3>WebSocket Messages</h3>
          <div style={{ background: '#f9f9f9', border: '1px solid #eee', height: 300, overflow: 'auto', padding: 8 }}>
            {wsMessages.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndexPage; 