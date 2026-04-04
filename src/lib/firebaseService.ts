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
      users: arrayUnion(user)
    });
  } else {
    console.log("Room does not exist, creating...");
    const initialState: RoomState = {
      code,
      users: [user],
      queue: [],
      currentMedia: { item: null, playing: false, currentTime: 0, lastUpdated: Date.now(), type: 'youtube' },
      messages: [],
      logs: [],
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
    users: arrayRemove(user)
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
    queue: arrayUnion(item)
  });
};

export const removeFromQueue = async (code: string, itemId: string) => {
  const roomRef = doc(db, 'rooms', code);
  const roomSnap = await getDoc(roomRef);
  if (roomSnap.exists()) {
    const queue = roomSnap.data().queue;
    const updatedQueue = queue.filter((item: QueueItem) => item.id !== itemId);
    await updateDoc(roomRef, { queue: updatedQueue });
  }
};

export const playNow = async (code: string, item: QueueItem) => {
  const roomRef = doc(db, 'rooms', code);
  await updateDoc(roomRef, {
    currentMedia: { item, playing: true, currentTime: 0, lastUpdated: Date.now(), type: item.type }
  });
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
