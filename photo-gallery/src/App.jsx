import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbsUp } from "@fortawesome/free-solid-svg-icons";

const API = "https://picsum.photos/v2/list";
const LIKES_KEY = "gallery-likes";
const TIMEOUT_MS = 8000;

// ---- Offline fallback data (used only when the picsum API is unreachable) ----
const AUTHORS = ["Vadim Sherbakov", "Alex", "Daniel Genser", "Justin Leibow", "Alexander Shustov"];
const mockPage = (page) =>
  page > 3
    ? []
    : Array.from({ length: 10 }, (_, i) => {
        const n = (page - 1) * 10 + i + 1;
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='125'><rect width='100%' height='100%' fill='hsl(${(n * 47) % 360},55%,50%)'/><text x='50%' y='50%' fill='white' font-size='26' font-family='sans-serif' text-anchor='middle' dominant-baseline='middle'>Photo ${n}</text></svg>`;
        return {
          id: `demo-${n}`,
          author: AUTHORS[n % AUTHORS.length],
          download_url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
        };
      });

async function fetchLive(page) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}?page=${page}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function Photo({ photo, likes, onLike }) {
  return (
    <article className="photo">
      <img src={photo.download_url} alt={`Photo by ${photo.author}`} loading="lazy" width="200" height="125" />
      <span className="author">Author: {photo.author}</span>
      <button className="like" onClick={onLike} aria-label={`Like photo by ${photo.author}`}>
        <FontAwesomeIcon icon={faThumbsUp} />
        <span className="count">{likes}</span>
      </button>
    </article>
  );
}

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offline, setOffline] = useState(false);
  const [likes, setLikes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LIKES_KEY)) || {}; } catch { return {}; }
  });
  const sentinel = useRef(null);
  const busy = useRef(false); // prevents duplicate fetches

  useEffect(() => {
    try { localStorage.setItem(LIKES_KEY, JSON.stringify(likes)); } catch {}
  }, [likes]);

  const loadPage = useCallback(async () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoading(true);
    let data;
    try {
      data = offline ? mockPage(page) : await fetchLive(page);
    } catch {
      // picsum unreachable or too slow: switch to demo data
      setOffline(true);
      data = mockPage(page);
    }
    if (data.length === 0) setHasMore(false); // no more data: stop
    else {
      setPhotos((prev) => [...prev, ...data]);
      setPage((p) => p + 1);
    }
    busy.current = false;
    setLoading(false);
  }, [page, hasMore, offline]);

  // Load the next page whenever the sentinel at the bottom becomes visible
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadPage(); },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadPage]);

  const like = (id) => setLikes((l) => ({ ...l, [id]: (l[id] || 0) + 1 }));

  const retryLive = () => {
    setOffline(false);
    setPhotos([]);
    setPage(1);
    setHasMore(true);
  };

  return (
    <main className="app">
      <h1>Photo gallery</h1>
      {offline && (
        <p className="banner">
          Couldn't reach picsum.photos, so demo photos are shown.{" "}
          <button onClick={retryLive}>Try live data again</button>
        </p>
      )}
      <section className="list">
        {photos.map((p) => (
          <Photo key={p.id} photo={p} likes={likes[p.id] || 0} onLike={() => like(p.id)} />
        ))}
      </section>
      <div ref={sentinel} className="status">
        {loading && <p>Loading…</p>}
        {!hasMore && <p>🎉 You've seen all the photos.</p>}
      </div>
    </main>
  );
}