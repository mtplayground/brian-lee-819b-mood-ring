import type { ParticipantIdentity } from "../api/rooms";

export type StoredRoomIdentity = ParticipantIdentity & {
  roomId: string;
};

const identityStorageKey = (roomId: string) => `roomIdentity:${roomId}`;

export function storeRoomIdentity(roomId: string, participant: ParticipantIdentity) {
  const value: StoredRoomIdentity = {
    roomId,
    ...participant,
  };

  try {
    window.localStorage.setItem(identityStorageKey(roomId), JSON.stringify(value));
  } catch {
    return;
  }
}

export function loadRoomIdentity(roomId: string): StoredRoomIdentity | null {
  try {
    const rawValue = window.localStorage.getItem(identityStorageKey(roomId));
    return rawValue ? (JSON.parse(rawValue) as StoredRoomIdentity) : null;
  } catch {
    return null;
  }
}
