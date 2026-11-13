import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const user_list = ["Alan", "Bob", "Carol", "Dean", "Elin"];
const COLORS = ["#ef8f8f", "#d9d95a", "#6fb3e0", "#9b8fe0", "#5fcf97"];

const CHANNELS = [
  { name: "Poland Office", about: "Chat with the Warsaw team", welcome: "Welcome to the Poland Office channel. 🇵🇱 Share updates with the Warsaw team here." },
  { name: "Introductions", about: "This channel is for company wide chatter", welcome: "Welcome to Team Chat. 👋 Send a message now to start interacting with other users in the app." },
  { name: "India Office", about: "Updates and discussions for the Bangalore team", welcome: "Welcome to the India Office channel. 🇮🇳 Share updates with the Bangalore team here." },
];
const DEFAULT_CHANNEL = "Introductions";

// [emoji, searchable name / keywords]
const EMOJI_DATA = [
  ["😀", "grinning happy"], ["😃", "smile happy"], ["😄", "laugh smile"], ["😁", "grin"],
  ["😆", "laughing"], ["😅", "sweat smile nervous"], ["😂", "joy laugh tears lol"], ["🤣", "rofl rolling laugh"],
  ["😊", "blush happy"], ["😇", "angel halo innocent"], ["🙂", "slight smile"], ["😉", "wink"],
  ["😍", "heart eyes love"], ["🥰", "love hearts adore"], ["😘", "kiss"], ["😋", "yum tasty delicious"],
  ["😛", "tongue"], ["😜", "crazy wink tongue"], ["🤪", "zany crazy"], ["🤗", "hug"],
  ["🤔", "thinking hmm"], ["🤨", "skeptical eyebrow"], ["😐", "neutral"], ["😶", "silent speechless"],
  ["🙄", "eye roll"], ["😏", "smirk"], ["😴", "sleep tired zzz"], ["😎", "cool sunglasses"],
  ["🤓", "nerd glasses"], ["🥳", "party celebrate"], ["🤩", "star struck wow"], ["😢", "cry sad"],
  ["😭", "sob crying sad"], ["😤", "angry huff"], ["😡", "angry mad"], ["🤯", "mind blown"],
  ["😱", "scream shocked"], ["😨", "fear scared"], ["😰", "anxious worried"], ["🤒", "sick fever"],
  ["🤧", "sneeze"], ["🥵", "hot"], ["🥶", "cold freezing"], ["😷", "mask"],
  ["🤝", "handshake deal"], ["👍", "thumbs up like good yes"], ["👎", "thumbs down dislike no"], ["👏", "clap applause"],
  ["🙌", "raised hands hooray"], ["🙏", "pray thanks please"], ["💪", "muscle strong"], ["👋", "wave hello hi bye"],
  ["✌️", "peace victory"], ["🤞", "fingers crossed luck"], ["👌", "ok perfect"], ["❤️", "red heart love"],
  ["🧡", "orange heart"], ["💛", "yellow heart"], ["💚", "green heart"], ["💙", "blue heart"],
  ["💜", "purple heart"], ["🖤", "black heart"], ["💔", "broken heart"], ["✨", "sparkles magic"],
  ["🔥", "fire hot lit"], ["💯", "hundred perfect"], ["🎉", "party tada celebrate"], ["🎊", "confetti"],
  ["🎂", "birthday cake"], ["🎁", "gift present"], ["🏆", "trophy win"], ["⭐", "star"],
  ["🌟", "glowing star"], ["🌈", "rainbow"], ["☀️", "sun sunny"], ["🌙", "moon night"],
  ["⚡", "lightning bolt energy"], ["❄️", "snow cold"], ["🌧️", "rain"], ["☕", "coffee tea"],
  ["🍕", "pizza"], ["🍔", "burger"], ["🍟", "fries"], ["🍩", "donut"],
  ["🍎", "apple fruit"], ["🍌", "banana fruit"], ["🍺", "beer"], ["🥂", "cheers champagne"],
  ["⚽", "football soccer"], ["🏏", "cricket"], ["🎮", "game controller gaming"], ["🎵", "music note"],
  ["🎧", "headphones"], ["💻", "laptop computer"], ["📱", "phone mobile"], ["💡", "idea bulb"],
  ["📚", "books study"], ["✅", "check done yes"], ["❌", "cross no wrong"], ["⚠️", "warning"],
  ["🚀", "rocket launch"], ["👀", "eyes look"], ["🐶", "dog puppy"], ["🐱", "cat kitten"],
  ["🐼", "panda"], ["🦄", "unicorn"], ["🌹", "rose flower"], ["🌻", "sunflower flower"],
];

const randomUser = () => user_list[Math.floor(Math.random() * user_list.length)];
const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Highlight @mentions inside message text
function renderText(text) {
  return text.split(/(@(?:Alan|Bob|Carol|Dean|Elin)\b)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="mention">{part}</span>
    ) : (
      part
    )
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12.6 2-12.6 2z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19c.4-3.4 3-5.2 6.2-5.2s5.8 1.8 6.2 5.2" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16.5 14.2c2.5.1 4.3 1.6 4.7 4.3" />
    </svg>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [channel, setChannel] = useState(DEFAULT_CHANNEL);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const emojiRef = useRef(null);
  const localId = useRef(1);

  const current = CHANNELS.find((c) => c.name === channel) || CHANNELS[1];
  const visible = messages.filter((m) => (m.channel || DEFAULT_CHANNEL) === channel);

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, channel]);

  // Close the emoji picker when clicking outside of it
  useEffect(() => {
    if (!showEmoji) return;
    const onDown = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showEmoji]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return user_list.filter((u) => u.toLowerCase().startsWith(mentionQuery.toLowerCase()));
  }, [mentionQuery]);

  const filteredEmojis = useMemo(() => {
    const q = emojiQuery.trim().toLowerCase();
    if (!q) return EMOJI_DATA;
    return EMOJI_DATA.filter(([, name]) => name.includes(q));
  }, [emojiQuery]);

  const switchChannel = (name) => {
    setChannel(name);
    setShowEmoji(false);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const user = randomUser(); // random user for every message
    if (connected) {
      socketRef.current.emit("chat:message", { user, text: t, channel });
    } else {
      setMessages((prev) => [
        ...prev,
        { id: localId.current++, user, text: t, channel, likes: 0, time: Date.now() },
      ]);
    }
    setText("");
    setMentionQuery(null);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const like = (id) => {
    if (connected) {
      socketRef.current.emit("chat:like", id);
    } else {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, likes: m.likes + 1 } : m)));
    }
  };

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    // Detect an "@word" right before the cursor
    const before = v.slice(0, e.target.selectionStart);
    const match = before.match(/@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const pickMention = (name) => {
    const pos = inputRef.current.selectionStart;
    const before = text.slice(0, pos).replace(/@(\w*)$/, "@" + name + " ");
    setText(before + text.slice(pos));
    setMentionQuery(null);
    inputRef.current.focus();
  };

  const pickEmoji = (em) => {
    setText((t) => t + em);
    setShowEmoji(false);
    setEmojiQuery("");
    inputRef.current?.focus();
  };

  const toggleEmoji = () => {
    setShowEmoji((s) => !s);
    setEmojiQuery("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (suggestions.length) pickMention(suggestions[0]);
      else send();
    }
    if (e.key === "Escape") {
      setMentionQuery(null);
      setShowEmoji(false);
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="profile">
          <div className="me">
            TC<span className="online" />
          </div>
          <div>
            <strong>Team Chat</strong>
            <small>Company workspace</small>
          </div>
        </div>
        <div className="conv-head">
          <span>Conversations</span>
          <span className="plus">+</span>
        </div>
        <ul className="channels">
          {CHANNELS.map((c) => (
            <li key={c.name}>
              <button
                className={c.name === channel ? "active" : ""}
                onClick={() => switchChannel(c.name)}
              >
                <span className="hash">#</span>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="chat">
        <header>
          <div>
            <h1>{current.name}</h1>
            <p>{current.about}</p>
          </div>
          <div className="head-right">
            <span
              className={connected ? "status on" : "status"}
              title={connected ? "Connected to server" : "Offline (local mode)"}
            >
              {connected ? "live" : "local"}
            </span>
            <span className="members">
              {user_list.length} | 100 <PeopleIcon />
            </span>
          </div>
        </header>

        <div className="thread">
          <div className="welcome">
            <div className="avatar" style={{ background: "#e5484d" }}>TB</div>
            <div className="body">
              <div className="meta">
                <b>Team Bot</b> <time>Welcome</time>
              </div>
              <div className="bubble">
                {current.welcome} Type <b>@</b> to mention someone.
              </div>
            </div>
          </div>

          {visible.map((m) => (
            <div className="msg" key={m.id}>
              <div className="avatar" style={{ background: COLORS[user_list.indexOf(m.user)] }}>
                {m.user.slice(0, 2).toUpperCase()}
              </div>
              <div className="body">
                <div className="meta">
                  <b>{m.user}</b> <time>{fmt(m.time)}</time>
                </div>
                <div className="bubble">{renderText(m.text)}</div>
              </div>
              <button
                className={m.likes > 0 ? "like liked" : "like"}
                onClick={() => like(m.id)}
                aria-label="Like message"
              >
                <span className="thumb">👍</span>
                <span key={m.likes} className="count">{m.likes}</span>
              </button>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="composer">
          {suggestions.length > 0 && (
            <ul className="popup mentions">
              {suggestions.map((u) => (
                <li
                  key={u}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMention(u);
                  }}
                >
                  <i style={{ background: COLORS[user_list.indexOf(u)] }}>{u.slice(0, 2).toUpperCase()}</i>@{u}
                </li>
              ))}
            </ul>
          )}
          {showEmoji && (
            <div className="popup emoji-panel" ref={emojiRef}>
              <input
                className="emoji-search"
                autoFocus
                value={emojiQuery}
                onChange={(e) => setEmojiQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowEmoji(false);
                  if (e.key === "Enter" && filteredEmojis.length) pickEmoji(filteredEmojis[0][0]);
                }}
                placeholder="Search emoji (e.g. heart, fire, party)"
              />
              <div className="emoji-grid">
                {filteredEmojis.map(([em, name]) => (
                  <button key={em} title={name.split(" ")[0]} onClick={() => pickEmoji(em)}>
                    {em}
                  </button>
                ))}
                {filteredEmojis.length === 0 && <p className="no-emoji">No emoji found</p>}
              </div>
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
            <button className="emoji-btn" onClick={toggleEmoji} aria-label="Emoji">
              😎
            </button>
          </div>
          <button className="send" onClick={send} disabled={!text.trim()} aria-label="Send">
            <SendIcon />
          </button>
        </div>
      </section>
    </div>
  );
}