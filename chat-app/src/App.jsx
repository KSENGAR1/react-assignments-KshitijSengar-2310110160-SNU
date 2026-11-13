import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const user_list = ["Alan", "Bob", "Carol", "Dean", "Elin"];
const EMOJIS = ["😀", "😂", "😍", "👍", "🎉", "🔥", "😢", "🙏", "❤️", "🤔", "😎", "👏"];
const COLORS = ["#ef8f8f", "#e0e060", "#6fb3e0", "#9b8fe0", "#6fcf97"];
const randomUser = () => user_list[Math.floor(Math.random() * user_list.length)];
const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Highlight @mentions inside message text
function renderText(text) {
  return text.split(/(@(?:Alan|Bob|Carol|Dean|Elin)\b)/g).map((part, i) =>
    part.startsWith("@") ? <span key={i} className="mention">{part}</span> : part
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const localId = useRef(1);

  // Socket.io (optional): falls back to local-only mode if the server is not running
  useEffect(() => {
    const socket = io("http://localhost:4000", { reconnectionAttempts: 3, timeout: 2000 });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("chat:history", setMessages);
    socket.on("chat:message", (m) => setMessages((prev) => [...prev, m]));
    socket.on("chat:like", ({ id, likes }) =>
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, likes } : m)))
    );
    return () => socket.disconnect();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const suggestions = useMemo(
    () => (mentionQuery === null ? [] : user_list.filter((u) => u.toLowerCase().startsWith(mentionQuery.toLowerCase()))),
    [mentionQuery]
  );

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const user = randomUser(); // random user for every message
    if (connected) socketRef.current.emit("chat:message", { user, text: t });
    else setMessages((prev) => [...prev, { id: localId.current++, user, text: t, likes: 0, time: Date.now() }]);
    setText(""); setMentionQuery(null); setShowEmoji(false);
    inputRef.current?.focus();
  };

  const like = (id) => {
    if (connected) socketRef.current.emit("chat:like", id);
    else setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, likes: m.likes + 1 } : m)));
  };

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    // Detect an "@word" right before the cursor
    const before = v.slice(0, e.target.selectionStart);
    const m = before.match(/@(\w*)$/);
    setMentionQuery(m ? m[1] : null);
  };

  const pickMention = (name) => {
    const pos = inputRef.current.selectionStart;
    const before = text.slice(0, pos).replace(/@(\w*)$/, `@${name} `);
    setText(before + text.slice(pos));
    setMentionQuery(null);
    inputRef.current.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (suggestions.length) pickMention(suggestions[0]);
      else send();
    }
    if (e.key === "Escape") { setMentionQuery(null); setShowEmoji(false); }
  };

  return (
    <div className="chat">
      <header>
        <div>
          <h1>Introductions</h1>
          <p>This channel is for company wide chatter</p>
        </div>
        <span className={`dot ${connected ? "on" : ""}`} title={connected ? "Connected to server" : "Offline (local mode)"}>
          {connected ? "live" : "local"}
        </span>
      </header>

      <div className="thread">
        {messages.length === 0 && <p className="empty">No messages yet. Say hi! Type @ to mention someone.</p>}
        {messages.map((m) => (
          <div className="msg" key={m.id}>
            <div className="avatar" style={{ background: COLORS[user_list.indexOf(m.user)] }}>
              {m.user.slice(0, 2).toUpperCase()}
            </div>
            <div className="body">
              <div className="meta"><b>{m.user}</b> <time>{fmt(m.time)}</time></div>
              <div className="bubble">{renderText(m.text)}</div>
            </div>
            <button className="like" onClick={() => like(m.id)} aria-label="Like message">
              👍 <span>{m.likes}</span>
            </button>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {suggestions.length > 0 && (
          <ul className="popup mentions">
            {suggestions.map((u) => (
              <li key={u} onMouseDown={(e) => { e.preventDefault(); pickMention(u); }}>@{u}</li>
            ))}
          </ul>
        )}
        {showEmoji && (
          <div className="popup emojis">
            {EMOJIS.map((em) => (
              <button key={em} onClick={() => { setText((t) => t + em); inputRef.current.focus(); }}>{em}</button>
            ))}
          </div>
        )}
        <div className="pill">
          <input
            ref={inputRef}
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Type Message"
          />
          <button className="icon" onClick={() => setShowEmoji((s) => !s)} aria-label="Emoji">😎</button>
        </div>
        <button className="send" onClick={send} disabled={!text.trim()}>Send</button>
      </div>
    </div>
  );
}