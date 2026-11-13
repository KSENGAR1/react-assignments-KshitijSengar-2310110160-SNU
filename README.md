# React Assignments

- `photo-gallery/` – infinite-scroll gallery (Picsum API) with like counters
- `chat-app/` – chat UI with likes, emoji picker, @mentions and optional socket.io server

Each folder is a Vite + React app:

```bash
cd photo-gallery   # or chat-app
npm install
npm run dev
```

Chat app with real-time server (stretch goal 3), in a second terminal:

```bash
cd chat-app
npm run server      # http://localhost:4000
```
Open the chat app in two browser tabs to see messages sync.

## Submitting
Create a public GitHub repo, push this folder, and email the link.
```bash
git init && git add . && git commit -m "React assignments"
git branch -M main
git remote add origin https://github.com/<you>/react-assignments.git
git push -u origin main
```
