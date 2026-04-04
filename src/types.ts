export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface QueueItem {
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

export interface RoomState {
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

export interface Message {
  user: User;
  text: string;
  timestamp: number;
}
