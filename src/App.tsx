import React, { useState, useEffect, useRef } from "react";
import { Search, Play, Plus, Youtube, Music, Gamepad2, Send, Users, ListMusic, MessageSquare, History, X, ChevronRight, ChevronLeft, Repeat, Shuffle, Mic2, Volume2, Share2, Menu, Heart } from "lucide-react";
import { joinRoom as joinRoomService, subscribeToRoom, updateRoomState, syncMedia, addToQueue as addToQueueService, removeFromQueue as removeFromQueueService, playNow as playNowService, sendMessage as sendMessageService, sendEmoji as sendEmojiService, toggleFavorite, subscribeToFavorites } from "./lib/firebaseService";
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import YouTube from 'react-youtube';

// --- Mood Background ---
const MoodBackground = ({ mood }: { mood: string }) => {
  const colors = {
    happy: ["#FFD700", "#FF8C00", "#FF4500"],
    sad: ["#4682B4", "#191970", "#00008B"],
    energetic: ["#FF00FF", "#00FFFF", "#7FFF00"],
    calm: ["#98FB98", "#AFEEEE", "#E0FFFF"],
    default: ["#333333", "#111111", "#000000"],
  };

  const selectedColors = (colors as any)[mood] || colors.default;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#050505]">
      {selectedColors.map((color: string, i: number) => (
        <motion.div
          key={`${mood}-${i}`}
          className="absolute rounded-full mix-blend-screen filter blur-[100px] opacity-30"
          style={{
            backgroundColor: color,
            width: "50vw",
            height: "50vw",
            top: i === 0 ? "-10%" : i === 1 ? "40%" : "60%",
            left: i === 0 ? "-10%" : i === 1 ? "60%" : "10%",
          }}
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -100, 50, 0],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{
            duration: 15 + i * 5,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};
import socket from "./lib/socket";
import { auth, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { User, RoomState, QueueItem, Message } from "./types";
import { cn, formatTime, generateRoomCode } from "./lib/utils";
import axios from "axios";
import confetti from "canvas-confetti";

import shaka from "shaka-player";

// --- Components ---

const COOL_AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Willow",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Maya",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Ruby",
];

const AvatarSelector = ({ onSelect }: { onSelect: (avatar: string) => void }) => {
  return (
    <div className="flex gap-4 flex-wrap justify-center max-h-48 overflow-y-auto p-2 custom-scrollbar">
      {COOL_AVATARS.map((url) => (
        <button
          key={url}
          onClick={() => onSelect(url)}
          className="w-16 h-16 rounded-full overflow-hidden border-2 border-transparent hover:border-white transition-all hover:scale-110"
        >
          <img src={url} alt="avatar" referrerPolicy="no-referrer" />
        </button>
      ))}
    </div>
  );
};

const UserSetup = ({ onComplete }: { onComplete: (user: User) => void }) => {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      onComplete({
        id: user.uid,
        name: user.displayName || "Anonymous",
        avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`
      });
    } catch (error) {
      console.error("Google Login Error:", error);
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    setIsLoading(true);
    onComplete({ id: "", name, avatar });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-8 rounded-3xl w-full max-w-md space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Welcome to sync-me</h1>
          <p className="text-gray-400 text-sm">Sign in to start syncing with friends.</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full bg-white/5 border border-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          {isLoading ? "Signing in..." : "Continue with Google"}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0a0a0a] px-2 text-gray-500">Or use a guest profile</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Choose an Avatar</label>
            <AvatarSelector onSelect={setAvatar} />
          </div>
          {avatar && (
            <div className="flex justify-center">
              <img src={avatar} className="w-20 h-20 rounded-full border-2 border-white" alt="selected" referrerPolicy="no-referrer" />
            </div>
          )}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-white/30 transition-all"
            />
          </div>
          <button
            disabled={!name || !avatar || isLoading}
            onClick={handleSubmit}
            className="w-full bg-white text-black font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              "Get Started"
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Home = ({ onJoin, onCreate }: { onJoin: (code: string) => void; onCreate: () => void }) => {
  const [code, setCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreate = () => {
    setIsCreating(true);
    onCreate();
  };

  const handleJoin = () => {
    setIsJoining(true);
    onJoin(code);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-8 md:space-y-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-2 md:space-y-4"
      >
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter">sync-me</h1>
        <p className="text-gray-400 text-base md:text-lg">Watch, Jam, and Play together in real-time.</p>
        <p className="text-gray-500 text-xs mt-4">made by brokenaqua (barnik)</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full max-w-4xl">
        <button 
          onClick={handleCreate} 
          disabled={isCreating || isJoining}
          className="glass p-6 md:p-8 rounded-3xl hover:bg-white/10 transition-all group text-left space-y-4 disabled:opacity-50"
        >
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
            {isCreating ? (
              <div className="w-6 h-6 border-2 border-white/20 border-t-white group-hover:border-black/20 group-hover:border-t-black rounded-full animate-spin" />
            ) : (
              <Plus size={24} />
            )}
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-bold">Create Room</h3>
            <p className="text-sm text-gray-400">Start a new session and invite friends.</p>
          </div>
        </button>

        <div className="glass p-6 md:p-8 rounded-3xl space-y-4 md:col-span-2">
          <h3 className="text-lg md:text-xl font-bold">Join Room</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-white/30"
            />
            <button
              disabled={code.length !== 6 || isJoining || isCreating}
              onClick={handleJoin}
              className="bg-white text-black font-bold px-8 py-3 rounded-xl disabled:opacity-50 hover:bg-gray-200 flex items-center justify-center min-w-[100px]"
            >
              {isJoining ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                "Join"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("sync-me-user");
    return saved ? JSON.parse(saved) : null;
  });
  const [room, setRoom] = useState<RoomState | null>(null);
  const [activeTab, setActiveTab] = useState<"youtube" | "tidal" | "play">("youtube");
  const [sidebarTab, setSidebarTab] = useState<"chat" | "queue" | "logs">("chat");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [lyrics, setLyrics] = useState<{ lyrics: string; subtitles: string } | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [audioQuality, setAudioQuality] = useState<"HI_RES_LOSSLESS" | "LOSSLESS" | "HIGH" | "LOW">("HIGH");
  const [mood, setMood] = useState("default");
  const [favorites, setFavorites] = useState<QueueItem[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<"edit" | "favorites">("edit");

  useEffect(() => {
    if (user?.id) {
      const unsubscribe = subscribeToFavorites(user.id, (favs) => {
        setFavorites(favs);
      });
      return () => unsubscribe();
    }
  }, [user?.id]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const savedUser = localStorage.getItem("sync-me-user");
    return !!(params.get("room") && savedUser);
  });
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(event.target as Node)) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [chatInput, setChatInput] = useState("");

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    sendMessage(chatInput);
    setChatInput("");
  };

  const cycleRepeatMode = () => {
    if (room) {
      const modes: ("none" | "one" | "all")[] = ["none", "one", "all"];
      const nextMode = modes[(modes.indexOf(room.repeatMode) + 1) % 3];
      updateRoomState(room.code, { repeatMode: nextMode });
    }
  };

  const parseSubtitles = (subtitles: string) => {
    if (!subtitles) return [];
    return subtitles.split("\n").map((line) => {
      const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
      if (match) {
        const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
        return { time, text: match[3].trim() };
      }
      return null;
    }).filter(Boolean) as { time: number; text: string }[];
  };

  const parsedLyrics = lyrics ? parseSubtitles(lyrics.subtitles) : [];
  const currentLyric = parsedLyrics.find((l, i) => {
    const next = parsedLyrics[i + 1];
    return localTime >= l.time && (!next || localTime < next.time);
  });

  const togglePlay = () => {
    if (room) {
      let currentTime = 0;
      if (room.currentMedia.item?.type === "tidal" && audioRef.current) {
        currentTime = audioRef.current.currentTime;
      } else if (room.currentMedia.item?.type === "youtube" && youtubePlayerRef.current) {
        currentTime = youtubePlayerRef.current.getCurrentTime() || 0;
      }
      
      syncMedia(room.code, { 
        ...room.currentMedia, 
        playing: !room.currentMedia.playing,
        currentTime: currentTime
      });
    }
  };

  const skipNext = () => {
    if (!room) return;
    
    let nextItem: any = null;
    let newQueue = [...room.queue];
    let newHistory = [...room.history];

    if (room.repeatMode === "one" && room.currentMedia.item) {
      nextItem = { ...room.currentMedia.item };
    } else if (newQueue.length > 0) {
      nextItem = room.shuffle 
        ? newQueue.splice(Math.floor(Math.random() * newQueue.length), 1)[0]
        : newQueue.shift()!;
    } else if (room.repeatMode === "all" && (newHistory.length > 0 || room.currentMedia.item)) {
      const allItems = [...newHistory];
      if (room.currentMedia.item) allItems.push(room.currentMedia.item);
      
      if (allItems.length === 1) {
        nextItem = { ...allItems[0] };
      } else {
        newQueue = allItems;
        newHistory = [];
        nextItem = room.shuffle 
          ? newQueue.splice(Math.floor(Math.random() * newQueue.length), 1)[0]
          : newQueue.shift()!;
      }
    }

    if (nextItem) {
      if (room.currentMedia.item && room.repeatMode !== "one" && room.repeatMode !== "all") {
        newHistory.push(room.currentMedia.item);
      } else if (room.currentMedia.item && room.repeatMode === "all" && newQueue.length > 0) {
        newHistory.push(room.currentMedia.item);
      }
      
      updateRoomState(room.code, {
        queue: newQueue,
        history: newHistory,
        currentMedia: {
          item: nextItem,
          playing: true,
          currentTime: 0,
          lastUpdated: Date.now(),
          type: nextItem.type
        },
        logs: [...room.logs, `${user?.name || "Someone"} skipped to next: ${nextItem.title}`]
      });
    } else {
      if (room.currentMedia.item) {
        newHistory.push(room.currentMedia.item);
      }
      updateRoomState(room.code, {
        queue: newQueue,
        history: newHistory,
        currentMedia: {
          item: null,
          playing: false,
          currentTime: 0,
          lastUpdated: Date.now(),
          type: "youtube"
        }
      });
    }
  };

  const skipPrevious = () => {
    if (!room || room.history.length === 0) return;
    
    const newHistory = [...room.history];
    const prevItem = newHistory.pop()!;
    const newQueue = [...room.queue];
    
    if (room.currentMedia.item) {
      newQueue.unshift(room.currentMedia.item);
    }
    
    updateRoomState(room.code, {
      queue: newQueue,
      history: newHistory,
      currentMedia: {
        item: prevItem,
        playing: true,
        currentTime: 0,
        lastUpdated: Date.now(),
        type: prevItem.type
      },
      logs: [...room.logs, `${user?.name || "Someone"} went back to: ${prevItem.title}`]
    });
  };

  const toggleShuffle = () => {
    if (room) {
      updateRoomState(room.code, { shuffle: !room.shuffle });
    }
  };

  const removeFromQueue = (itemId: string) => {
    if (room) {
      const item = room.queue.find(q => q.id === itemId);
      removeFromQueueService(room.code, itemId, item?.title, user?.name);
    }
  };

  useEffect(() => {
    let interval: any;
    if (room?.currentMedia.playing && room.currentMedia.item?.type === "youtube") {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const nextTime = prev + 1;
          if (room.currentMedia.item?.duration && nextTime >= room.currentMedia.item.duration) {
            skipNext();
            return 0;
          }
          return nextTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [room?.currentMedia.playing, room?.currentMedia.item?.duration, room?.currentMedia.item?.type]);

  useEffect(() => {
    if (room?.currentMedia.currentTime !== undefined) {
      setCurrentTime(room.currentMedia.currentTime);
      if (audioRef.current && room.currentMedia.item?.type === "tidal") {
        if (Math.abs(audioRef.current.currentTime - room.currentMedia.currentTime) > 2) {
          audioRef.current.currentTime = room.currentMedia.currentTime;
        }
      }
    }
  }, [room?.currentMedia.lastUpdated, room?.currentMedia.item?.id]);

  useEffect(() => {
    if (!isDragging) {
      setLocalTime(currentTime);
    }
  }, [currentTime, isDragging]);

  useEffect(() => {
    if (showLyrics && currentLyric) {
      const index = parsedLyrics.findIndex(l => l.time === currentLyric.time);
      if (index !== -1 && lyricRefs.current[index]) {
        lyricRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentLyric, showLyrics]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseInt(e.target.value);
    setLocalTime(time);
  };

  const handleSeekEnd = () => {
    setIsDragging(false);
    setCurrentTime(localTime);
    if (room?.currentMedia.item?.type === "tidal" && audioRef.current) {
      audioRef.current.currentTime = localTime;
    } else if (room?.currentMedia.item?.type === "youtube" && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(localTime, true);
    }
    if (room) {
      syncMedia(room.code, { ...room.currentMedia, currentTime: localTime });
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempAvatar, setTempAvatar] = useState("");
  const shakaPlayerRef = useRef<shaka.Player | null>(null);

  useEffect(() => {
    shaka.polyfill.installAll();
    if (audioRef.current) {
      shakaPlayerRef.current = new shaka.Player(audioRef.current);
      shakaPlayerRef.current.addEventListener("error", (event: any) => {
        console.error("Shaka Player Error:", event.detail);
      });
    }
    return () => {
      if (shakaPlayerRef.current) {
        shakaPlayerRef.current.destroy();
      }
    };
  }, []);

  const updateProfile = () => {
    if (!tempName || !tempAvatar) return;
    const updatedUser = { ...user!, name: tempName, avatar: tempAvatar };
    setUser(updatedUser);
    localStorage.setItem("sync-me-user", JSON.stringify(updatedUser));
    if (room) {
      const updatedUsers = room.users.map(u => u.id === user?.id ? updatedUser : u);
      updateRoomState(room.code, { users: updatedUsers });
    }
    setIsEditingProfile(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCodeFromUrl = params.get("room");
    const targetCode = room?.code || roomCodeFromUrl;

    if (targetCode && user) {
      const unsubscribe = subscribeToRoom(targetCode, (state) => {
        if (room && state.logs.length > room.logs.length) {
          const newLog = state.logs[state.logs.length - 1];
          if (!newLog.startsWith("emoji:")) {
            setNotifications((prev) => [...prev, newLog]);
            setTimeout(() => setNotifications((prev) => prev.slice(1)), 3000);
          }
        }
        setRoom(state);
        setIsJoiningRoom(false);
        setActiveTab(state.currentMedia.type);
        
        if (state.currentMedia.item?.type === "tidal" && state.currentMedia.item.trackId) {
          fetchLyrics(state.currentMedia.item.trackId);
        }
        
        // Update URL without refreshing
        const url = new URL(window.location.href);
        url.searchParams.set("room", state.code);
        window.history.replaceState({}, "", url.toString());
      });
      return () => unsubscribe();
    }
  }, [room?.code, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room");

    if (roomCode && user && !room) {
      setIsJoiningRoom(true);
      joinRoomService(roomCode, user).catch(err => {
        console.error("Failed to join room from URL:", err);
        setIsJoiningRoom(false);
      });
    }
  }, [user]); // Run when user is available or changes

  const switchTab = (tab: "youtube" | "tidal" | "play") => {
    setActiveTab(tab);
    if (room && room.currentMedia.playing && room.currentMedia.item?.type !== tab) {
      syncMedia(room.code, { ...room.currentMedia, playing: false });
    }
  };

  const handleUserSetup = (u: User) => {
    const userWithId = { ...u, id: u.id || Math.random().toString(36).substring(7) };
    setUser(userWithId);
    localStorage.setItem("sync-me-user", JSON.stringify(userWithId));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const userData: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || "Anonymous",
          avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`
        };
        setUser(userData);
        localStorage.setItem("sync-me-user", JSON.stringify(userData));
      }
    });

    socket.connect();
    socket.on("new-emoji", (emoji: string) => {
      spawnEmoji(emoji);
    });

    return () => {
      unsubscribe();
      socket.off("new-emoji");
      socket.disconnect();
    };
  }, []);

  const createRoom = async () => {
    const code = generateRoomCode();
    if (user) {
      try {
        await joinRoomService(code, user);
        setRoom({
          code,
          users: [user],
          queue: [],
          currentMedia: { item: null, playing: false, currentTime: 0, lastUpdated: Date.now(), type: 'youtube' },
          messages: [],
          logs: [],
          history: [],
          shuffle: false,
          repeatMode: 'none'
        });
      } catch (error) {
        console.error("Failed to create room:", error);
        alert("Failed to create room. Please try again.");
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    window.history.replaceState({}, "", url.toString());
  };

  const joinRoom = async (code: string) => {
    if (user) {
      await joinRoomService(code, user);
    }
    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    window.history.replaceState({}, "", url.toString());
  };

  const spawnEmoji = (emoji: string) => {
    console.log("Spawning emoji:", emoji);
    const div = document.createElement("div");
    div.innerText = emoji;
    div.style.position = "fixed";
    div.style.left = Math.random() * 80 + 10 + "%";
    div.style.bottom = "-50px";
    div.style.fontSize = "3rem";
    div.style.pointerEvents = "none";
    div.style.zIndex = "9999";
    div.style.opacity = "1";
    div.style.transform = "translateY(0px) rotate(0deg)";
    div.style.transition = "transform 5s ease-out, opacity 5s ease-in-out";
    document.body.appendChild(div);
    console.log("Emoji element added to body:", div);
    
    // Force reflow
    void div.offsetWidth;

    const rotation = Math.random() * 360 - 180;
    const horizontalOffset = Math.random() * 200 - 100;

    setTimeout(() => {
      div.style.transform = `translate(${horizontalOffset}px, -${window.innerHeight + 100}px) rotate(${rotation}deg)`;
      div.style.opacity = "0";
    }, 50);

    setTimeout(() => div.remove(), 5050);
  };

  const fetchTidalManifest = async (id: string, qualityToTry: string = audioQuality) => {
    try {
      const res = await axios.get(`/api/track?id=${id}&quality=${qualityToTry}`);
      if (!res.data?.data) {
        throw new Error("No data returned from TIDAL track API");
      }
      
      const { manifest, manifestMimeType } = res.data.data;
      
      if (manifestMimeType === "application/vnd.tidal.bts") {
        const paddedManifest = manifest.replace(/-/g, '+').replace(/_/g, '/');
        const missingPadding = (4 - (paddedManifest.length % 4)) % 4;
        const finalManifest = paddedManifest + "=".repeat(missingPadding);
        
        const manifestJson = JSON.parse(atob(finalManifest));
        if (manifestJson.urls && manifestJson.urls.length > 0) {
          if (shakaPlayerRef.current) {
            await shakaPlayerRef.current.unload();
          }
          setAudioUrl(manifestJson.urls[0]);
          if (audioRef.current) {
            audioRef.current.load();
          }
        }
      } else if (manifestMimeType === "application/dash+xml") {
        const paddedManifest = manifest.replace(/-/g, '+').replace(/_/g, '/');
        const missingPadding = (4 - (paddedManifest.length % 4)) % 4;
        const finalManifest = paddedManifest + "=".repeat(missingPadding);
        
        const manifestXml = atob(finalManifest);
        const blob = new Blob([manifestXml], { type: "application/dash+xml" });
        const manifestUrl = URL.createObjectURL(blob);
        
        if (shakaPlayerRef.current) {
          try {
            await shakaPlayerRef.current.load(manifestUrl);
            setAudioUrl(null); // Clear direct URL if using Shaka
          } catch (err) {
            console.error("Shaka load error:", err);
            throw new Error("Shaka load failed");
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching TIDAL manifest for quality ${qualityToTry}:`, err);
      const qualities = ["HI_RES_LOSSLESS", "LOSSLESS", "HIGH", "LOW"];
      const currentIndex = qualities.indexOf(qualityToTry);
      if (currentIndex !== -1 && currentIndex < qualities.length - 1) {
        const nextQuality = qualities[currentIndex + 1];
        console.warn(`Falling back to ${nextQuality}`);
        return fetchTidalManifest(id, nextQuality);
      }
    }
  };

  const fetchRecommendations = async (id: string) => {
    try {
      const res = await axios.get(`/api/recommendations?id=${id}`);
      if (res.data?.data?.items) {
        setRecommendations(res.data.data.items.map((i: any) => i.track));
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    }
  };

  useEffect(() => {
    if (room?.currentMedia.item?.type === "tidal" && room.currentMedia.item.trackId) {
      // Immediate cleanup to stop previous song
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.load();
      }
      if (shakaPlayerRef.current) {
        shakaPlayerRef.current.unload().catch(console.error);
      }

      setIsLoadingManifest(true);
      setAudioUrl(null); // Clear previous URL immediately to prevent stale playback
      fetchTidalManifest(room.currentMedia.item.trackId).finally(() => {
        setIsLoadingManifest(false);
      });
      fetchRecommendations(room.currentMedia.item.trackId);
    } else {
      setIsLoadingManifest(false);
      setAudioUrl(null);
      setRecommendations([]);
    }
  }, [room?.currentMedia.item?.id, audioQuality]);

  useEffect(() => {
    if (audioRef.current && room?.currentMedia.item?.type === "tidal") {
      if (room?.currentMedia.playing && !isLoadingManifest) {
        // Only attempt to play if we have a source or if it's DASH (Shaka)
        if (audioUrl || shakaPlayerRef.current) {
          audioRef.current.play().catch((err) => {
            console.warn("Playback failed:", err);
          });
        }
      } else {
        audioRef.current.pause();
      }
    } else if (youtubePlayerRef.current && room?.currentMedia.item?.type === "youtube") {
      if (room?.currentMedia.playing) {
        youtubePlayerRef.current.playVideo();
      } else {
        youtubePlayerRef.current.pauseVideo();
      }
    }
  }, [room?.currentMedia.playing, audioUrl, room?.currentMedia.item?.id, isLoadingManifest]);

  useEffect(() => {
    let interval: any;
    if (room?.currentMedia.item?.type === "youtube" && room.currentMedia.playing) {
      interval = setInterval(() => {
        if (youtubePlayerRef.current && !isDragging) {
          const ytTime = youtubePlayerRef.current.getCurrentTime() || 0;
          setCurrentTime(ytTime);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [room?.currentMedia.item?.type, room?.currentMedia.playing, isDragging]);

  useEffect(() => {
    if (room?.currentMedia.currentTime !== undefined && !isLoadingManifest) {
      const timeDiff = (Date.now() - room.currentMedia.lastUpdated) / 1000;
      const targetTime = room.currentMedia.playing ? room.currentMedia.currentTime + timeDiff : room.currentMedia.currentTime;
      
      if (audioRef.current && room?.currentMedia.item?.type === "tidal") {
        if (Math.abs(audioRef.current.currentTime - targetTime) > 2) {
          audioRef.current.currentTime = targetTime;
        }
      } else if (youtubePlayerRef.current && room?.currentMedia.item?.type === "youtube") {
        const ytTime = youtubePlayerRef.current.getCurrentTime() || 0;
        if (Math.abs(ytTime - targetTime) > 2) {
          youtubePlayerRef.current.seekTo(targetTime, true);
        }
      }
    }
  }, [room?.currentMedia.currentTime, room?.currentMedia.lastUpdated, audioUrl, room?.currentMedia.playing, isLoadingManifest]);

  const searchMedia = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const endpoint = activeTab === "youtube" ? "/api/search/youtube" : "/api/search/tidal";
      console.log(`Searching ${activeTab} via proxy:`, endpoint);
      const res = await axios.get(`${endpoint}?q=${encodeURIComponent(searchQuery)}`);
      const data = res.data;
      
      let results = [];
      if (activeTab === "youtube") {
        results = Array.isArray(data) ? data : (data.results || data.items || []);
      } else {
        if (data?.data?.items) results = data.data.items;
        else if (data?.items) results = data.items;
        else if (Array.isArray(data?.data)) results = data.data;
        else if (Array.isArray(data)) results = data;
      }
      
      setSearchResults(Array.isArray(results) ? results : []);
      if (results.length === 0) {
        setNotifications((prev) => [...prev, `${activeTab === "youtube" ? "YouTube" : "Tidal"} search returned no results.`]);
        setTimeout(() => setNotifications((prev) => prev.slice(1)), 3000);
      }
    } catch (err: any) {
      console.error("Search error:", err);
      const errorMessage = err.response?.data?.error || err.message || "Unknown error";
      setNotifications((prev) => [...prev, `Search failed: ${errorMessage}`]);
      setTimeout(() => setNotifications((prev) => prev.slice(1)), 3000);
    } finally {
      setIsSearching(false);
    }
  };

  const addToQueue = (item: any) => {
    const queueItem: QueueItem = {
      id: Math.random().toString(36).substring(7),
      type: activeTab as "youtube" | "tidal",
      title: item.title || item.name,
      artist: item.artist?.name || item.author?.name || item.publisher || "Unknown",
      thumbnail: item.thumbnail?.url || (item.album?.cover ? `https://resources.tidal.com/images/${item.album.cover.replace(/-/g, '/')}/640x640.jpg` : (item.thumbnails?.[0]?.url || item.thumbnail || undefined)),
      duration: item.duration || 0,
      addedBy: user?.name || "Guest",
      videoId: item.id || item.videoId,
      trackId: item.id || item.trackId,
    };
    if (room) {
      addToQueueService(room.code, queueItem);
    }
  };

  const handleToggleFavorite = async (item: QueueItem) => {
    if (!user?.id || !auth.currentUser) {
      setNotifications((prev) => [...prev, "Please sign in with Google to save favorites."]);
      return;
    }
    const isFav = favorites.some(f => f.id === item.id);
    await toggleFavorite(user.id, item, isFav);
  };

  const playFavoriteList = () => {
    if (!user?.id || !auth.currentUser) {
      setNotifications((prev) => [...prev, "Please sign in with Google to play favorites."]);
      return;
    }
    if (favorites.length === 0) return;
    
    // Add all favorites to queue
    favorites.forEach(fav => {
      addToQueue(fav);
    });
    
    // If nothing is playing, play the first one
    if (!room?.currentMedia.playing && favorites.length > 0) {
      playNow(favorites[0]);
    }
    setShowProfile(false);
  };
  const playNow = (item: any) => {
    const queueItem: QueueItem = {
      id: Math.random().toString(36).substring(7),
      type: activeTab as "youtube" | "tidal",
      title: item.title || item.name,
      artist: item.artist?.name || item.author?.name || item.publisher || "Unknown",
      thumbnail: item.thumbnail?.url || (item.album?.cover ? `https://resources.tidal.com/images/${item.album.cover.replace(/-/g, '/')}/640x640.jpg` : (item.thumbnails?.[0]?.url || item.thumbnail || undefined)),
      duration: item.duration || 0,
      addedBy: user?.name || "Guest",
      videoId: item.id || item.videoId,
      trackId: item.id || item.trackId,
    };
    if (room) {
      playNowService(room.code, queueItem, user?.name);
    }
  };

  const sendMessage = (text: string) => {
    if (!text.trim() || !room || !user) return;
    sendMessageService(room.code, { user, text, timestamp: Date.now() });
  };

  const sendEmoji = (emoji: string) => {
    if (room) {
      spawnEmoji(emoji);
      if (socket.connected) {
        socket.emit("send-emoji", { code: room.code, emoji });
      } else {
        sendEmojiService(room.code, emoji);
      }
    }
  };

  const fetchLyrics = async (id: string) => {
    try {
      const res = await axios.get(`/api/lyrics?id=${id}`);
      setLyrics(res.data.lyrics);
      
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not set. Cannot analyze mood.");
        return;
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the mood of these lyrics and return only one word: happy, sad, energetic, or calm. Lyrics: ${res.data.lyrics.lyrics.substring(0, 500)}`,
      });
      const mood = response.text?.trim().toLowerCase() || "default";
      setMood(mood);
    } catch (err) {
      console.error(err);
    }
  };

  const renderSidebarContent = () => {
    if (!room) return null;
    
    return (
      <>
        {sidebarTab === "chat" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-4">
              {room.messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3", msg.user.id === user?.id ? "flex-row-reverse" : "")}>
                  <img src={msg.user.avatar} className="w-8 h-8 rounded-full" alt="" referrerPolicy="no-referrer" />
                  <div className={cn("max-w-[80%] p-3 rounded-2xl text-sm", msg.user.id === user?.id ? "bg-white text-black" : "bg-white/5")}>
                    <p className="font-bold text-[10px] mb-1 opacity-50">{msg.user.name}</p>
                    <p>{msg.text}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="mt-4 space-y-4">
              <div className="flex gap-2 justify-center">
                {["🔥", "❤️", "😂", "😮", "👏", "🎉", "✨"].map((e) => (
                  <button key={e} onClick={() => sendEmoji(e)} className="text-xl hover:scale-125 transition-transform">{e}</button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSendMessage();
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:border-white/20"
                />
                <button onClick={handleSendMessage} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {sidebarTab === "queue" && (
          <div className="space-y-4">
            {room.queue.length === 0 ? (
              <div className="text-center py-12 text-gray-500 space-y-2">
                <ListMusic size={48} className="mx-auto opacity-20" />
                <p>Queue is empty</p>
              </div>
            ) : (
              room.queue.map((item, i) => (
                <div key={i} className="flex gap-3 items-center group">
                  <img src={item.thumbnail || undefined} className="w-12 h-12 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold truncate">{item.title}</h4>
                    <p className="text-[10px] text-gray-500 truncate">Added by {item.addedBy}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => playNow(item)} className="p-2 hover:bg-white/10 rounded-lg">
                      <Play size={14} fill="currentColor" />
                    </button>
                    <button onClick={() => removeFromQueue(item.id)} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {sidebarTab === "logs" && (
          <div className="space-y-3">
            {room.logs.map((log, i) => (
              <div key={i} className="flex gap-3 text-[11px] text-gray-400 bg-white/5 p-2 rounded-lg">
                <History size={12} className="mt-0.5 shrink-0" />
                <p>{log.startsWith("emoji:") ? log.replace("emoji:", "") : log}</p>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  if (isJoiningRoom) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-6">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-gray-400 font-bold animate-pulse">Joining room...</p>
      </div>
    );
  }

  if (!user) return <UserSetup onComplete={handleUserSetup} />;
  if (!room) return <Home onJoin={joinRoom} onCreate={createRoom} />;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#050505]">
      <MoodBackground mood={mood} />
      <audio 
        ref={audioRef} 
        src={audioUrl || undefined} 
        crossOrigin="anonymous"
        onEnded={skipNext}
        onTimeUpdate={(e) => {
          setCurrentTime((e.target as HTMLAudioElement).currentTime);
        }}
      />
      {/* Sidebar - Left (Navigation) */}
      <div className="w-full md:w-20 h-16 md:h-full glass-dark flex md:flex-col items-center justify-around md:justify-start md:py-8 px-4 md:px-0 gap-4 md:gap-8 z-50 order-last md:order-first border-t md:border-t-0 md:border-r border-white/5">
        <div className="hidden md:flex w-12 h-12 bg-white text-black rounded-2xl items-center justify-center font-black text-xl">S</div>
        <div className="flex md:flex-col gap-4 flex-1 items-center justify-center md:justify-start w-full md:w-auto">
          <button
            onClick={() => { setShowMobileSidebar(!showMobileSidebar); setHasNewMessages(false); }}
            className={cn("md:hidden w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all relative", showMobileSidebar ? "bg-white text-black" : "text-gray-500 hover:text-white hover:bg-white/5")}
          >
            <MessageSquare size={20} className="md:w-6 md:h-6" />
            {hasNewMessages && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          <div className="hidden md:block w-px h-6 bg-white/10 md:w-8 md:h-px mx-2 md:mx-0" />
          <button
            onClick={() => switchTab("youtube")}
            className={cn("w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all", activeTab === "youtube" ? "bg-white text-black" : "text-gray-500 hover:text-white hover:bg-white/5")}
          >
            <Youtube size={20} className="md:w-6 md:h-6" />
          </button>
          <button
            onClick={() => switchTab("tidal")}
            className={cn("w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all", activeTab === "tidal" ? "bg-white text-black" : "text-gray-500 hover:text-white hover:bg-white/5")}
          >
            <Music size={20} className="md:w-6 md:h-6" />
          </button>
          <button
            onClick={() => switchTab("play")}
            className={cn("w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all", activeTab === "play" ? "bg-white text-black" : "text-gray-500 hover:text-white hover:bg-white/5")}
          >
            <Gamepad2 size={20} className="md:w-6 md:h-6" />
          </button>
        </div>
        <div className="flex md:flex-col gap-4 items-center">
          <button className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5">
            <Share2 size={20} onClick={() => { navigator.clipboard.writeText(window.location.href); setNotifications(prev => [...prev, "Link copied!"]); setTimeout(() => setNotifications(prev => prev.slice(1)), 2000); }} />
          </button>
          <img src={user.avatar} className="w-10 h-10 md:w-12 md:h-12 rounded-2xl border border-white/10 cursor-pointer hover:scale-105 transition-transform" alt="me" referrerPolicy="no-referrer" onClick={() => setIsEditingProfile(true)} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-16 md:h-20 px-4 md:px-8 flex items-center justify-between glass-dark z-40">
          <div className="flex items-center gap-2 md:gap-4">
            <h2 className="text-lg md:text-xl font-bold capitalize">{activeTab}</h2>
            <div className="hidden md:block px-3 py-1 bg-white/5 rounded-full text-xs font-mono text-gray-400 border border-white/5">
              ROOM: {room.code}
            </div>
          </div>
          <div className="flex-1 max-w-xl mx-4 md:mx-8 relative" ref={searchContainerRef}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchMedia();
                  }
                }}
                onFocus={() => { if (searchResults.length > 0) setIsSearching(false); }}
                placeholder={`Search ${activeTab === "youtube" ? "YouTube" : "TIDAL"}...`}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-full py-2 pl-10 pr-12 md:py-2.5 md:pl-12 focus:outline-none focus:border-white/20 transition-all text-white text-sm md:text-base"
              />
              <button 
                onClick={searchMedia}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors"
                title="Search"
              >
                <Search size={20} />
              </button>
            </div>
            {/* Search Results Dropdown */}
            <AnimatePresence>
              {(searchResults.length > 0 || isSearching) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="fixed md:absolute top-16 md:top-full left-0 right-0 md:mt-2 bg-[#0a0a0a] border-b md:border border-white/10 md:rounded-2xl overflow-hidden shadow-2xl z-[100] h-[calc(100vh-64px)] md:h-auto md:max-h-[70vh] overflow-y-auto"
                >
                  <div className="p-4 md:p-3 flex justify-between items-center border-b border-white/5 bg-[#0a0a0a] sticky top-0 z-10">
                    <span className="text-sm md:text-xs text-gray-400 px-2 font-bold uppercase tracking-widest">{isSearching ? "Searching..." : "Search Results"}</span>
                    <button onClick={() => setSearchResults([])} className="p-2 md:p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                      <X size={24} className="md:w-4 md:h-4" />
                    </button>
                  </div>
                  {isSearching ? (
                    <div className="p-16 md:p-12 text-center text-gray-500">
                      <div className="w-10 h-10 md:w-8 md:h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-6 md:mb-4" />
                      <p className="text-lg md:text-sm font-medium">Finding the best matches...</p>
                    </div>
                  ) : (
                    <div className="p-2 md:p-1 space-y-1">
                      {searchResults.map((item: any) => (
                        <div key={item.id} className="p-4 md:p-3 hover:bg-white/5 flex gap-5 md:gap-4 items-center group rounded-2xl md:rounded-xl transition-all active:scale-[0.98]">
                          <div className="relative flex-shrink-0">
                            <img 
                              src={item.thumbnail?.url || (item.album?.cover ? `https://resources.tidal.com/images/${item.album.cover.replace(/-/g, '/')}/160x160.jpg` : (item.thumbnails?.[0]?.url || item.thumbnail || undefined))} 
                              className="w-16 h-16 md:w-14 md:h-14 rounded-xl object-cover shadow-2xl border border-white/5" 
                              alt="" 
                              referrerPolicy="no-referrer" 
                            />
                            <div className="absolute inset-0 bg-black/20 rounded-xl" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-lg md:text-base leading-tight mb-1 line-clamp-2 md:line-clamp-1 text-white">{item.title || item.name}</h4>
                            <p className="text-sm md:text-xs text-gray-400 truncate font-medium tracking-wide">
                              {item.author?.name || item.artist?.name || item.artists?.[0]?.name || "Unknown Artist"}
                              {item.duration ? ` • ${formatTime(item.duration)}` : ""}
                            </p>
                          </div>
                          <div className="flex gap-3 md:gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                            <button 
                              onClick={() => { playNow(item); setSearchResults([]); }} 
                              className="p-4 md:p-3 bg-white text-black rounded-2xl md:rounded-xl hover:scale-110 active:scale-90 transition-transform shadow-xl"
                              title="Play Now"
                            >
                              <Play size={20} className="md:w-4 md:h-4" fill="currentColor" />
                            </button>
                            <button 
                              onClick={() => { addToQueue(item); setSearchResults([]); }} 
                              className="p-4 md:p-3 bg-white/10 text-white rounded-2xl md:rounded-xl hover:bg-white/20 active:scale-90 transition-all border border-white/10"
                              title="Add to Queue"
                            >
                              <Plus size={20} className="md:w-4 md:h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex -space-x-2">
              {room.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    if (u.id === user?.id) {
                      setTempName(u.name);
                      setTempAvatar(u.avatar);
                      setIsEditingProfile(true);
                    }
                  }}
                  className={cn("relative transition-transform hover:scale-110 z-10", u.id === user?.id ? "cursor-pointer" : "cursor-default")}
                >
                  <img src={u.avatar} className="w-8 h-8 rounded-full border-2 border-[#050505]" title={u.id === user?.id ? "Edit Profile" : u.name} alt={u.name} referrerPolicy="no-referrer" />
                  {u.id === user?.id && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#050505] rounded-full" />}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Player View */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
          {/* Link Paste Section */}
          <div className="mb-8 flex gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Paste YouTube or TIDAL link here..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:border-white/20"
              />
            </div>
            <button
              className="bg-white/10 hover:bg-white/20 text-white px-6 rounded-xl font-bold transition-all"
            >
              Add Link
            </button>
          </div>

          {room.currentMedia.item?.type === "youtube" ? (
            <div className="space-y-8">
              <div className="w-full aspect-video glass rounded-3xl overflow-hidden relative group">
                <YouTube
                  videoId={room.currentMedia.item.videoId}
                  opts={{
                    width: '100%',
                    height: '100%',
                    playerVars: {
                      autoplay: 1,
                      controls: 1,
                      rel: 0,
                      modestbranding: 1,
                    },
                  }}
                  onReady={(e) => {
                    youtubePlayerRef.current = e.target;
                    if (room.currentMedia.playing) {
                      e.target.playVideo();
                    } else {
                      e.target.pauseVideo();
                    }
                  }}
                  onStateChange={(e) => {
                    if (e.data === YouTube.PlayerState.ENDED) {
                      skipNext();
                    } else if (e.data === YouTube.PlayerState.PLAYING && !room.currentMedia.playing) {
                      syncMedia(room.code, { ...room.currentMedia, playing: true, currentTime: e.target.getCurrentTime() });
                    } else if (e.data === YouTube.PlayerState.PAUSED && room.currentMedia.playing) {
                      syncMedia(room.code, { ...room.currentMedia, playing: false, currentTime: e.target.getCurrentTime() });
                    }
                  }}
                  className="w-full h-full absolute inset-0"
                />
              </div>
              
              <div className="glass p-6 rounded-3xl space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold">{room.currentMedia.item.title}</h3>
                      <button 
                        onClick={() => handleToggleFavorite(room.currentMedia.item!)}
                        className="text-white hover:text-red-500 transition-colors"
                      >
                        <Heart size={20} className={favorites.some(f => f.id === room.currentMedia.item?.id) ? "fill-red-500 text-red-500" : ""} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-400">{room.currentMedia.item.artist}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-center gap-4 md:gap-8">
                  <button 
                    onClick={toggleShuffle}
                    className={cn("transition-colors", room.shuffle ? "text-white" : "text-gray-500")}
                  >
                    <Shuffle size={20} />
                  </button>
                  <button onClick={skipPrevious} className="text-white hover:scale-110 transition-transform"><ChevronLeft size={32} /></button>
                  <button 
                    onClick={togglePlay}
                    className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    {room.currentMedia.playing ? <div className="flex gap-1.5"><div className="w-2 h-8 bg-black rounded-full"/><div className="w-2 h-8 bg-black rounded-full"/></div> : <Play size={28} fill="currentColor" />}
                  </button>
                  <button onClick={skipNext} className="text-white hover:scale-110 transition-transform"><ChevronRight size={32} /></button>
                  <button 
                    onClick={cycleRepeatMode}
                    className={cn("transition-colors relative", room.repeatMode !== "none" ? "text-white" : "text-gray-500")}
                  >
                    <Repeat size={20} />
                    {room.repeatMode === "one" && <span className="absolute -top-1 -right-1 text-[8px] bg-white text-black rounded-full w-3 h-3 flex items-center justify-center">1</span>}
                  </button>
                </div>
              </div>
            </div>
          ) : room.currentMedia.item?.type === "tidal" ? (
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative group"
                >
                  <img
                    src={room.currentMedia.item.thumbnail || undefined}
                    className="w-full aspect-square rounded-3xl shadow-2xl object-cover"
                    alt="cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
                    <button onClick={() => setShowLyrics(true)} className="bg-white text-black px-6 py-2 rounded-full font-bold flex items-center gap-2">
                      <Mic2 size={18} /> Lyrics
                    </button>
                  </div>
                </motion.div>
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <h1 className="text-4xl font-black tracking-tight">{room.currentMedia.item.title}</h1>
                      <button 
                        onClick={() => handleToggleFavorite(room.currentMedia.item!)}
                        className="text-white hover:text-red-500 transition-colors mt-2"
                      >
                        <Heart size={32} className={favorites.some(f => f.id === room.currentMedia.item?.id) ? "fill-red-500 text-red-500" : ""} />
                      </button>
                    </div>
                    <p className="text-xl text-gray-400">{room.currentMedia.item.artist}</p>
                  </div>

                  <div className="space-y-4">
                    <input
                      type="range"
                      min="0"
                      max={room.currentMedia.item.duration || 100}
                      value={localTime}
                      onMouseDown={() => setIsDragging(true)}
                      onTouchStart={() => setIsDragging(true)}
                      onChange={handleSeek}
                      onMouseUp={handleSeekEnd}
                      onTouchEnd={handleSeekEnd}
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                    />
                    <div className="flex justify-between text-xs text-gray-500 font-mono">
                      <span>{formatTime(localTime)}</span>
                      <span>{formatTime(room.currentMedia.item.duration)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4 md:gap-8">
                    <button 
                      onClick={toggleShuffle}
                      className={cn("transition-colors", room.shuffle ? "text-white" : "text-gray-500")}
                    >
                      <Shuffle size={20} />
                    </button>
                    <button onClick={skipPrevious} className="text-white hover:scale-110 transition-transform"><ChevronLeft size={32} /></button>
                    <button 
                      onClick={togglePlay}
                      className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                    >
                      {room.currentMedia.playing ? <div className="flex gap-1.5"><div className="w-2 h-8 bg-black rounded-full"/><div className="w-2 h-8 bg-black rounded-full"/></div> : <Play size={28} fill="currentColor" />}
                    </button>
                    <button onClick={skipNext} className="text-white hover:scale-110 transition-transform"><ChevronRight size={32} /></button>
                    <button 
                      onClick={cycleRepeatMode}
                      className={cn("transition-colors relative", room.repeatMode !== "none" ? "text-white" : "text-gray-500")}
                    >
                      <Repeat size={20} />
                      {room.repeatMode === "one" && <span className="absolute -top-1 -right-1 text-[8px] bg-white text-black rounded-full w-3 h-3 flex items-center justify-center">1</span>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "youtube" ? (
            <div className="w-full aspect-video glass rounded-3xl overflow-hidden relative group">
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                <Youtube size={64} />
                <p>Search and play a video to start</p>
              </div>
            </div>
          ) : activeTab === "tidal" ? (
            <div className="w-full h-96 flex flex-col items-center justify-center text-gray-500 space-y-4">
              <Music size={64} />
              <p>Search and play a song to start jamming</p>
            </div>
          ) : null}

          {/* Recommended Section */}
          {activeTab === "tidal" && recommendations.length > 0 && (

                <div className="space-y-6">
                  <h3 className="text-xl font-bold">Recommended for you</h3>
                  <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 custom-scrollbar snap-x">
                    {recommendations.slice(0, 8).map((item, i) => (
                      <div 
                        key={i} 
                        className="glass p-4 rounded-2xl space-y-3 hover:bg-white/5 transition-all group min-w-[160px] md:min-w-0 snap-start"
                      >
                        <div className="aspect-square bg-white/5 rounded-xl overflow-hidden relative">
                          <img 
                            src={item.album?.cover ? `https://resources.tidal.com/images/${item.album.cover.replace(/-/g, '/')}/320x320.jpg` : undefined} 
                            className="w-full h-full object-cover" 
                            alt="" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              onClick={(e) => { e.stopPropagation(); addToQueue(item); }}
                              className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
                            >
                              <Plus size={20} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-bold truncate text-sm">{item.title}</h4>
                          <p className="text-xs text-gray-500 truncate">{item.artist?.name || item.artists?.[0]?.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

          {activeTab === "play" && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center text-gray-500">
                <Gamepad2 size={48} />
              </div>
              <h2 className="text-3xl font-black">Coming Soon</h2>
              <p className="text-gray-400 max-w-md">We're working on real-time games you can play with your friends while watching or listening.</p>
            </div>
          )}
        </main>
      </div>

      {/* Right Sidebar - Desktop (Fixed) */}
      <div className="hidden md:flex w-80 lg:w-96 glass-dark flex-col border-l border-white/5 relative z-40">
        <div className="flex border-b border-white/5 relative items-center">
          <div className="flex-1 flex">
            <button
              onClick={() => setSidebarTab("chat")}
              className={cn("flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all", sidebarTab === "chat" ? "text-white border-b-2 border-white" : "text-gray-500")}
            >
              Chat
            </button>
            <button
              onClick={() => setSidebarTab("queue")}
              className={cn("flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all", sidebarTab === "queue" ? "text-white border-b-2 border-white" : "text-gray-500")}
            >
              Queue
            </button>
            <button
              onClick={() => setSidebarTab("logs")}
              className={cn("flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all", sidebarTab === "logs" ? "text-white border-b-2 border-white" : "text-gray-500")}
            >
              Logs
            </button>
          </div>
          <div className="relative px-4" ref={qualityMenuRef}>
            <button 
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              className={cn("transition-colors", showQualityMenu ? "text-white" : "text-gray-500 hover:text-white")}
            >
              <Volume2 size={18} />
            </button>
            <AnimatePresence>
              {showQualityMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-0 mt-2 glass p-2 rounded-xl min-w-[140px] z-[80]"
                >
                  <p className="text-[10px] text-gray-500 px-2 mb-1 uppercase font-bold">Audio Quality</p>
                  {(["HI_RES_LOSSLESS", "LOSSLESS", "HIGH", "LOW"] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => { setAudioQuality(q); setShowQualityMenu(false); }}
                      className={cn("w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all", audioQuality === q ? "bg-white text-black" : "hover:bg-white/5")}
                    >
                      {q.replace(/_/g, ' ')}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {renderSidebarContent()}
        </div>
      </div>

      {/* Right Sidebar - Mobile (Overlay) */}
      <AnimatePresence>
        {showMobileSidebar && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileSidebar(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-96 glass-dark flex flex-col z-[70] shadow-2xl border-l border-white/5 md:hidden"
            >
              <div className="flex border-b border-white/5 relative items-center">
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className="p-4 text-gray-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="flex-1 flex">
                  <button
                    onClick={() => setSidebarTab("chat")}
                    className={cn("flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all", sidebarTab === "chat" ? "text-white border-b-2 border-white" : "text-gray-500")}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setSidebarTab("queue")}
                    className={cn("flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all", sidebarTab === "queue" ? "text-white border-b-2 border-white" : "text-gray-500")}
                  >
                    Queue
                  </button>
                  <button
                    onClick={() => setSidebarTab("logs")}
                    className={cn("flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all", sidebarTab === "logs" ? "text-white border-b-2 border-white" : "text-gray-500")}
                  >
                    Logs
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {renderSidebarContent()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map((note, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white text-black px-4 py-2 rounded-full font-bold shadow-2xl flex items-center gap-2 text-xs"
            >
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              {note}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass p-8 rounded-3xl w-full max-w-md space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <button 
                    onClick={() => setProfileTab("edit")}
                    className={cn("text-xl font-bold transition-colors", profileTab === "edit" ? "text-white" : "text-gray-500")}
                  >
                    Edit Profile
                  </button>
                  <button 
                    onClick={() => setProfileTab("favorites")}
                    className={cn("text-xl font-bold transition-colors", profileTab === "favorites" ? "text-white" : "text-gray-500")}
                  >
                    Favorites
                  </button>
                </div>
                <button onClick={() => setIsEditingProfile(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {profileTab === "edit" ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="relative group">
                      <img src={tempAvatar} className="w-24 h-24 rounded-full border-4 border-white/10" alt="avatar" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center text-[10px] font-bold">
                        CLICK BELOW
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-2 block uppercase font-bold">Choose Avatar</label>
                    <AvatarSelector onSelect={setTempAvatar} />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-2 block uppercase font-bold">Display Name</label>
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-white/30"
                    />
                  </div>

                  <button
                    onClick={updateProfile}
                    className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase">Your Favorites</h3>
                    <button 
                      onClick={() => {
                        playFavoriteList();
                        setIsEditingProfile(false);
                      }}
                      className="bg-white text-black px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-gray-200"
                    >
                      <Play size={14} /> Play All
                    </button>
                  </div>
                  
                  {favorites.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Heart size={48} className="mx-auto mb-4 opacity-20" />
                      <p>No favorites yet.</p>
                      <p className="text-sm">Click the heart icon on any song to add it here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {favorites.map((fav) => (
                        <div key={fav.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 group">
                          <img src={fav.thumbnail} className="w-12 h-12 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{fav.title}</p>
                            <p className="text-xs text-gray-400 truncate">{fav.artist}</p>
                          </div>
                          <button 
                            onClick={() => handleToggleFavorite(fav)}
                            className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Heart size={18} className="fill-red-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lyrics Modal */}
      <AnimatePresence>
        {showLyrics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-8"
          >
            <button onClick={() => setShowLyrics(false)} className="absolute top-8 right-8 p-4 hover:bg-white/10 rounded-full transition-all">
              <X size={32} />
            </button>
            <div className="max-w-2xl w-full text-center space-y-12">
              <div className="space-y-4">
                <h2 className="text-5xl font-black">{room.currentMedia.item?.title}</h2>
                <p className="text-2xl text-gray-400">{room.currentMedia.item?.artist}</p>
              </div>
              <div className="h-[60vh] overflow-y-auto custom-scrollbar px-8 space-y-8 text-3xl font-bold text-gray-600 pb-[30vh]">
                {parsedLyrics.length > 0 ? (
                  parsedLyrics.map((line, i) => (
                    <p 
                      key={i} 
                      ref={(el) => { lyricRefs.current[i] = el; }}
                      className={cn("transition-all duration-500", currentLyric?.time === line.time ? "text-white scale-110" : "opacity-30")}
                    >
                      {line.text}
                    </p>
                  ))
                ) : (
                  <p className="text-white">No lyrics available for this track.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
