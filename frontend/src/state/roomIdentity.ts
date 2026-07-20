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
    if (!rawValue) {
      return null;
    }

    const value = JSON.parse(rawValue) as Partial<StoredRoomIdentity>;

    if (
      value.roomId !== roomId ||
      typeof value.participantId !== "string" ||
      typeof value.identityKey !== "string" ||
      (value.slot !== "first" && value.slot !== "second")
    ) {
      return null;
    }

    return {
      roomId: value.roomId,
      participantId: value.participantId,
      identityKey: value.identityKey,
      slot: value.slot,
    };
  } catch {
    return null;
  }
}
