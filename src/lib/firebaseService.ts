import { doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { RoomState, User, QueueItem, Message } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const joinRoom = async (code: string, user: User) => {
  console.log("Joining room:", code, user);
  const roomRef = doc(db, 'rooms', code);
  try {
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${code}`);
  }
};

export const leaveRoom = async (code: string, user: User) => {
  const roomRef = doc(db, 'rooms', code);
  try {
    await updateDoc(roomRef, {
      users: arrayRemove(user),
      logs: arrayUnion(`${user.name} left the room`)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${code}`);
  }
};

export const sendMessage = async (code: string, message: Message) => {
  const roomRef = doc(db, 'rooms', code);
  try {
    await updateDoc(roomRef, {
      messages: arrayUnion(message)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${code}`);
  }
};

export const syncMedia = async (code: string, mediaState: RoomState['currentMedia']) => {
  const roomRef = doc(db, 'rooms', code);
  try {
    await updateDoc(roomRef, {
      currentMedia: { ...mediaState, lastUpdated: Date.now() }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${code}`);
  }
};

export const updateRoomState = async (code: string, updates: Partial<RoomState>) => {
  const roomRef = doc(db, 'rooms', code);
  try {
    await updateDoc(roomRef, updates as any);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${code}`);
  }
};

export const addToQueue = async (code: string, item: QueueItem) => {
  const roomRef = doc(db, 'rooms', code);
  try {
    await updateDoc(roomRef, {
      queue: arrayUnion(item),
      logs: arrayUnion(`${item.addedBy} added ${item.title} to queue`)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${code}`);
  }
};

export const removeFromQueue = async (code: string, itemId: string, title?: string, removedBy?: string) => {
  const roomRef = doc(db, 'rooms', code);
  try {
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
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${code}`);
  }
};

export const playNow = async (code: string, item: QueueItem, playedBy?: string) => {
  const roomRef = doc(db, 'rooms', code);
  try {
    const updates: any = {
      currentMedia: { item, playing: true, currentTime: 0, lastUpdated: Date.now(), type: item.type }
    };
    if (playedBy) {
      updates.logs = arrayUnion(`${playedBy} started playing ${item.title}`);
    }
    await updateDoc(roomRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${code}`);
  }
};

export const sendEmoji = async (code: string, emoji: string) => {
  const roomRef = doc(db, 'rooms', code);
  try {
    await updateDoc(roomRef, {
      logs: arrayUnion(`emoji:${emoji}`)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${code}`);
  }
};

export const subscribeToRoom = (code: string, callback: (state: RoomState) => void) => {
  const roomRef = doc(db, 'rooms', code);
  return onSnapshot(roomRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data() as RoomState);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `rooms/${code}`);
  });
};

export const toggleFavorite = async (userId: string, item: QueueItem, isFavorite: boolean) => {
  const userRef = doc(db, 'users', userId);
  try {
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
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
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${userId}`);
  });
};
