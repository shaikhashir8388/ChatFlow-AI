'use client';

import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';

let socket;

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
      socket = io(process.env.NEXT_PUBLIC_BACKEND_URL);

      socket.on('connect', () => {
        socket.emit('join', decoded.id);
        socket.emit('loadMessages');
      });

      socket.on('previousMessages', (msgs) => {
        setMessages(msgs);
      });

      socket.on('receiveMessage', (msg) => {
        setMessages((prev) => [...prev, msg]);
      });

      return () => {
        socket.disconnect();
      };
    } else {
      window.location.href = '/';
    }
  }, []);

  const sendMessage = () => {
    if (input.trim()) {
      socket.emit('sendMessage', { userId, message: input });
      setInput('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="bg-blue-600 text-white p-4 text-center">
        <h1 className="text-2xl font-bold">Chat Room</h1>
      </header>
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-2 p-2 rounded ${msg.user === userId ? 'bg-blue-200 ml-auto' : 'bg-gray-200'}`}
          >
            <strong>{msg.user === userId ? 'You' : 'Other'}:</strong> {msg.content}
            <span className="text-xs text-gray-500 ml-2">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
      <div className="p-4 bg-white flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-2 border rounded-l"
          placeholder="Type a message..."
        />
        <button onClick={sendMessage} className="bg-blue-600 text-white p-2 rounded-r">
          Send
        </button>
      </div>
    </div>
  );
}