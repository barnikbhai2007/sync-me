import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const PORT = 3000;

interface User {
  id: string;
  name: string;
  avatar: string;
}

interface QueueItem {
  id: string;
  type: "youtube" | "tidal";
  title: string;
  artist?: string;
  thumbnail: string;
  duration: number;
  addedBy: string;
  videoId?: string;
  trackId?: string;
}

interface RoomState {
  code: string;
  users: User[];
  queue: QueueItem[];
  currentMedia: {
    item: QueueItem | null;
    playing: boolean;
    currentTime: number;
    lastUpdated: number;
    type: "youtube" | "tidal" | "play";
  };
  messages: { user: User; text: string; timestamp: number }[];
  logs: string[];
  history: QueueItem[];
  shuffle: boolean;
  repeatMode: "none" | "one" | "all";
}

const rooms: Record<string, RoomState> = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ code, name, avatar }) => {
    socket.join(code);
    if (!rooms[code]) {
      rooms[code] = {
        code,
        users: [],
        queue: [],
        currentMedia: {
          item: null,
          playing: false,
          currentTime: 0,
          lastUpdated: Date.now(),
          type: "youtube",
        },
        messages: [],
        logs: [],
        history: [],
        shuffle: false,
        repeatMode: "none",
      };
    }

    const user = { id: socket.id, name, avatar };
    const existingUserIndex = rooms[code].users.findIndex(u => u.id === socket.id);
    if (existingUserIndex === -1) {
      rooms[code].users.push(user);
      rooms[code].logs.push(`${name} joined the room.`);
    } else {
      rooms[code].users[existingUserIndex] = user;
    }

    io.to(code).emit("room-update", rooms[code]);
    socket.emit("init-state", rooms[code]);
  });

  socket.on("sync-media", ({ code, playing, currentTime, type, user }) => {
    if (rooms[code]) {
      const prevPlaying = rooms[code].currentMedia.playing;
      const prevTime = rooms[code].currentMedia.currentTime;
      
      rooms[code].currentMedia.playing = playing;
      rooms[code].currentMedia.currentTime = currentTime;
      rooms[code].currentMedia.lastUpdated = Date.now();
      rooms[code].currentMedia.type = type;

      if (Math.abs(prevTime - currentTime) > 5) {
        rooms[code].logs.push(`${user?.name || "Someone"} seeked to ${Math.floor(currentTime)}s.`);
      } else if (prevPlaying !== playing) {
        rooms[code].logs.push(`${user?.name || "Someone"} ${playing ? "played" : "paused"} the media.`);
      }

      socket.to(code).emit("media-update", rooms[code].currentMedia);
      io.to(code).emit("room-update", rooms[code]);
    }
  });

  socket.on("add-to-queue", ({ code, item }) => {
    if (rooms[code]) {
      rooms[code].queue.push(item);
      rooms[code].logs.push(`${item.addedBy} added "${item.title}" to queue.`);
      io.to(code).emit("room-update", rooms[code]);
      io.to(code).emit("notification", { message: `"${item.title}" added to queue` });
    }
  });

  socket.on("play-now", ({ code, item }) => {
    if (rooms[code]) {
      if (rooms[code].currentMedia.item) {
        rooms[code].history.push(rooms[code].currentMedia.item);
      }
      rooms[code].currentMedia.item = item;
      rooms[code].currentMedia.playing = true;
      rooms[code].currentMedia.currentTime = 0;
      rooms[code].currentMedia.lastUpdated = Date.now();
      rooms[code].currentMedia.type = item.type;
      rooms[code].logs.push(`${item.addedBy} started playing "${item.title}".`);
      io.to(code).emit("room-update", rooms[code]);
      io.to(code).emit("notification", { message: `Now playing: ${item.title}` });
    }
  });

  socket.on("skip-next", ({ code, user }) => {
    if (rooms[code]) {
      const room = rooms[code];
      let nextItem: any = null;

      if (room.repeatMode === "one" && room.currentMedia.item) {
        nextItem = { ...room.currentMedia.item };
      } else if (room.queue.length > 0) {
        nextItem = room.shuffle 
          ? room.queue.splice(Math.floor(Math.random() * room.queue.length), 1)[0]
          : room.queue.shift()!;
      } else if (room.repeatMode === "all" && (room.history.length > 0 || room.currentMedia.item)) {
        // Refill queue from history + current item
        const allItems = [...room.history];
        if (room.currentMedia.item) allItems.push(room.currentMedia.item);
        
        // If we only have one item and it's the current one, just repeat it
        if (allItems.length === 1) {
          nextItem = { ...allItems[0] };
        } else {
          room.queue = allItems;
          room.history = [];
          nextItem = room.shuffle 
            ? room.queue.splice(Math.floor(Math.random() * room.queue.length), 1)[0]
            : room.queue.shift()!;
        }
      }

      if (nextItem) {
        if (room.currentMedia.item && room.repeatMode !== "one" && room.repeatMode !== "all") {
          room.history.push(room.currentMedia.item);
        } else if (room.currentMedia.item && room.repeatMode === "all" && room.queue.length > 0) {
          // In 'all' mode, if we just refilled or have items, add current to history
          room.history.push(room.currentMedia.item);
        }
        room.currentMedia.item = nextItem;
        room.currentMedia.playing = true;
        room.currentMedia.currentTime = 0;
        room.currentMedia.lastUpdated = Date.now();
        room.currentMedia.type = nextItem.type;
        room.logs.push(`${user?.name || "Someone"} skipped to next: ${nextItem.title}`);
        io.to(code).emit("room-update", room);
      } else {
        if (room.currentMedia.item) {
          room.history.push(room.currentMedia.item);
        }
        room.currentMedia.item = null;
        room.currentMedia.playing = false;
        room.currentMedia.currentTime = 0;
        room.currentMedia.lastUpdated = Date.now();
        io.to(code).emit("room-update", room);
      }
    }
  });

  socket.on("skip-previous", ({ code, user }) => {
    if (rooms[code] && rooms[code].history.length > 0) {
      const prevItem = rooms[code].history.pop()!;
      
      if (rooms[code].currentMedia.item) {
        rooms[code].queue.unshift(rooms[code].currentMedia.item);
      }
      
      rooms[code].currentMedia.item = prevItem;
      rooms[code].currentMedia.playing = true;
      rooms[code].currentMedia.currentTime = 0;
      rooms[code].currentMedia.lastUpdated = Date.now();
      rooms[code].currentMedia.type = prevItem.type;
      rooms[code].logs.push(`${user?.name || "Someone"} went back to: ${prevItem.title}`);
      io.to(code).emit("room-update", rooms[code]);
    }
  });

  socket.on("remove-from-queue", ({ code, itemId, user }) => {
    if (rooms[code]) {
      const index = rooms[code].queue.findIndex(item => item.id === itemId);
      if (index !== -1) {
        const item = rooms[code].queue[index];
        rooms[code].queue.splice(index, 1);
        rooms[code].logs.push(`${user?.name || "Someone"} removed "${item.title}" from queue.`);
        io.to(code).emit("room-update", rooms[code]);
      }
    }
  });

  socket.on("toggle-shuffle", ({ code }) => {
    if (rooms[code]) {
      rooms[code].shuffle = !rooms[code].shuffle;
      io.to(code).emit("room-update", rooms[code]);
      io.to(code).emit("notification", { message: `Shuffle: ${rooms[code].shuffle ? 'ON' : 'OFF'}` });
    }
  });

  socket.on("toggle-repeat", ({ code }) => {
    if (rooms[code]) {
      const modes: ("none" | "one" | "all")[] = ["one", "all", "none"];
      const next = modes[(modes.indexOf(rooms[code].repeatMode) + 1) % modes.length];
      rooms[code].repeatMode = next;
      io.to(code).emit("room-update", rooms[code]);
      io.to(code).emit("notification", { message: `Repeat: ${next.toUpperCase()}` });
    }
  });

  socket.on("send-message", ({ code, text, user }) => {
    if (rooms[code]) {
      const message = { user, text, timestamp: Date.now() };
      rooms[code].messages.push(message);
      io.to(code).emit("new-message", message);
    }
  });

  socket.on("send-emoji", ({ code, emoji }) => {
    io.to(code).emit("new-emoji", emoji);
  });

  socket.on("switch-tab", ({ code, type }) => {
    if (rooms[code]) {
      rooms[code].currentMedia.type = type;
      io.to(code).emit("room-update", rooms[code]);
    }
  });

  socket.on("update-user", ({ code, user }) => {
    if (rooms[code]) {
      const index = rooms[code].users.findIndex(u => u.id === socket.id);
      if (index !== -1) {
        const oldName = rooms[code].users[index].name;
        rooms[code].users[index] = { ...rooms[code].users[index], ...user };
        if (user.name && user.name !== oldName) {
          rooms[code].logs.push(`${oldName} changed their name to ${user.name}.`);
        }
        io.to(code).emit("room-update", rooms[code]);
      }
    }
  });

  socket.on("disconnect", () => {
    for (const code in rooms) {
      const userIndex = rooms[code].users.findIndex((u) => u.id === socket.id);
      if (userIndex !== -1) {
        const user = rooms[code].users[userIndex];
        rooms[code].users.splice(userIndex, 1);
        rooms[code].logs.push(`${user.name} left the room.`);
        io.to(code).emit("room-update", rooms[code]);
        break;
      }
    }
  });
});

// API Proxy Routes
app.get("/api/search/youtube", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Query required" });
  try {
    const response = await axios.get(`https://yt-search-nine.vercel.app/search?q=${encodeURIComponent(q as string)}`);
    res.json(response.data);
  } catch (error: any) {
    console.error("YouTube Proxy Error:", error.message);
    res.status(500).json({ error: "YouTube search failed" });
  }
});

app.get("/api/search/tidal", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Query required" });
  
  const encodedQuery = encodeURIComponent(q as string);
  const endpoints = [
    `https://hifi-api-production.up.railway.app/search/?s=${encodedQuery}`,
    `https://tidal-api-sigma.vercel.app/search?q=${encodedQuery}`
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log("Proxying Tidal search to:", endpoint);
      const response = await axios.get(endpoint, { timeout: 5000 });
      if (response.data) {
        return res.json(response.data);
      }
    } catch (e: any) {
      console.warn(`Proxy search failed for ${endpoint}:`, e.message);
    }
  }
  res.status(500).json({ error: "Tidal search failed on all endpoints" });
});

app.get("/api/track", async (req, res) => {
  const { id, quality } = req.query;
  if (!id) return res.status(400).json({ error: "Track ID required" });
  try {
    const url = `https://hifi-api-production.up.railway.app/track/?id=${id}&quality=${quality || "HIGH"}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch track manifest" });
  }
});

app.get("/api/recommendations", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Track ID required" });
  try {
    const url = `https://hifi-api-production.up.railway.app/recommendations/?id=${id}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

app.get("/api/playlist", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Playlist ID required" });
  try {
    const url = `https://hifi-api-production.up.railway.app/playlist/?id=${id}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch playlist" });
  }
});

app.get("/api/info", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Track ID required" });
  try {
    const url = `https://hifi-api-production.up.railway.app/info/?id=${id}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch track info" });
  }
});

app.get("/api/lyrics", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Track ID required" });
  try {
    const url = `https://hifi-api-production.up.railway.app/lyrics/?id=${id}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch lyrics" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
