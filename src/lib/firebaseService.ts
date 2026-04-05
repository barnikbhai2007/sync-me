import { doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { RoomState, User, QueueItem, Message } from '../types';

export const joinRoom = async (code: string, user: User) => {
  console.log("Joining room:", code, user);
  const roomRef = doc(db, 'rooms', code);
  const roomSnap = await getDoc(roomRef);

  if (roomSnap.exists()) {
    console.log("Room exists, updating...");
    await updateDoc(roomRef, {
      users: arrayUnion(user),
      logs: arrayUnion(`${user.name} joined the room`)
    });
  } else {
    console.log("Room does not exist, creating...");
    const initialState: RoomState = {
      code,
      users: [user],
      queue: [],
      currentMedia: { item: null, playing: false, currentTime: 0, lastUpdated: Date.now(), type: 'youtube' },
      messages: [],
      logs: [`Room created by ${user.name}`],
      history: [],
      shuffle: false,
      repeatMode: 'none'
    };
    await setDoc(roomRef, initialState);
    console.log("Room created.");
  }
};

export const leaveRoom = async (code: string, user: User) => {
  const roomRef = doc(db, 'rooms', code);
  await updateDoc(roomRef, {
    users: arrayRemove(user),
    logs: arrayUnion(`${user.name} left the room`)
  });
};

export const sendMessage = async (code: string, message: Message) => {
  const roomRef = doc(db, 'rooms', code);
  await updateDoc(roomRef, {
    messages: arrayUnion(message)
  });
};

export const syncMedia = async (code: string, mediaState: RoomState['currentMedia']) => {
  const roomRef = doc(db, 'rooms', code);
  await updateDoc(roomRef, {
    currentMedia: { ...mediaState, lastUpdated: Date.now() }
  });
};

export const updateRoomState = async (code: string, updates: Partial<RoomState>) => {
  const roomRef = doc(db, 'rooms', code);
  await updateDoc(roomRef, updates as any);
};

export const addToQueue = async (code: string, item: QueueItem) => {
  const roomRef = doc(db, 'rooms', code);
  await updateDoc(roomRef, {
    queue: arrayUnion(item),
    logs: arrayUnion(`${item.addedBy} added ${item.title} to queue`)
  });
};

export const removeFromQueue = async (code: string, itemId: string, title?: string, removedBy?: string) => {
  const roomRef = doc(db, 'rooms', code);
  const roomSnap = await getDoc(roomRef);
  if (roomSnap.exists()) {
    const queue = roomSnap.data().queue;
    const updatedQueue = queue.filter((item: QueueItem) => item.id !== itemId);
    const updates: any = { queue: updatedQueue };
    if (title && removedBy) {
      updates.logs = arrayUnion(`${removedBy} removed ${title} from queue`);
    }
    await updateDoc(roomRef, updates);
  }
};

export const playNow = async (code: string, item: QueueItem, playedBy?: string) => {
  const roomRef = doc(db, 'rooms', code);
  const updates: any = {
    currentMedia: { item, playing: true, currentTime: 0, lastUpdated: Date.now(), type: item.type }
  };
  if (playedBy) {
    updates.logs = arrayUnion(`${playedBy} started playing ${item.title}`);
  }
  await updateDoc(roomRef, updates);
};

export const sendEmoji = async (code: string, emoji: string) => {
  const roomRef = doc(db, 'rooms', code);
  await updateDoc(roomRef, {
    logs: arrayUnion(`emoji:${emoji}`)
  });
};

export const subscribeToRoom = (code: string, callback: (state: RoomState) => void) => {
  const roomRef = doc(db, 'rooms', code);
  return onSnapshot(roomRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data() as RoomState);
    }
  });
};

export const toggleFavorite = async (userId: string, item: QueueItem, isFavorite: boolean) => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    await setDoc(userRef, { favorites: [item] });
    return;
  }
  
  if (isFavorite) {
    await updateDoc(userRef, {
      favorites: arrayRemove(item)
    });
  } else {
    await updateDoc(userRef, {
      favorites: arrayUnion(item)
    });
  }
};

export const subscribeToFavorites = (userId: string, callback: (favorites: QueueItem[]) => void) => {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (doc) => {
    if (doc.exists() && doc.data().favorites) {
      callback(doc.data().favorites as QueueItem[]);
    } else {
      callback([]);
    }
  });
};
