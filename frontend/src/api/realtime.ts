import type { ClientMoodState } from "../state/clientMood";
import { isClientMoodState } from "../state/clientMood";
import type { ClientConfig } from "./config";
import type { ParticipantIdentity, ParticipantSlot } from "./rooms";

export type MoodSocketPayload =
  | {
      type: "moodUpdate";
      mood: ClientMoodState;
    }
  | {
      type: "moodClear";
    };

export type RoomSocketEvent =
  | {
      type: "participantConnected";
      participantId: string;
      slot: ParticipantSlot;
    }
  | {
      type: "participantDisconnected";
      participantId: string;
      slot: ParticipantSlot;
    }
  | {
      type: "participantMessage";
      participantId: string;
      slot: ParticipantSlot;
      payload: unknown;
    };

type ParticipantEventShell = {
  participantId: string;
  slot: ParticipantSlot;
};

export function buildRoomWebSocketUrl(
  config: ClientConfig,
  roomId: string,
  participant: ParticipantIdentity,
): string {
  const params = new URLSearchParams({
    participantId: participant.participantId,
    identityKey: participant.identityKey,
  });

  return `${config.wsBaseUrl}/api/rooms/${encodeURIComponent(roomId)}/ws?${params.toString()}`;
}

export function parseRoomSocketEvent(rawValue: string): RoomSocketEvent | null {
  try {
    const value = JSON.parse(rawValue) as Partial<RoomSocketEvent>;
    const eventType = value.type;

    if (
      eventType === "participantConnected" ||
      eventType === "participantDisconnected"
    ) {
      return isParticipantEvent(value)
        ? {
            type: eventType,
            participantId: value.participantId,
            slot: value.slot,
          }
        : null;
    }

    if (eventType === "participantMessage") {
      return isParticipantEvent(value) && "payload" in value
        ? {
            type: eventType,
            participantId: value.participantId,
            slot: value.slot,
            payload: value.payload,
          }
        : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function parseMoodSocketPayload(payload: unknown): MoodSocketPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<MoodSocketPayload>;

  if (candidate.type === "moodClear") {
    return { type: "moodClear" };
  }

  if (candidate.type === "moodUpdate" && isClientMoodState(candidate.mood)) {
    return {
      type: "moodUpdate",
      mood: candidate.mood,
    };
  }

  return null;
}

export function moodUpdateMessage(mood: ClientMoodState): string {
  return JSON.stringify({
    type: "moodUpdate",
    mood,
  } satisfies MoodSocketPayload);
}

export function moodClearMessage(): string {
  return JSON.stringify({
    type: "moodClear",
  } satisfies MoodSocketPayload);
}

function isParticipantEvent(
  value: Partial<RoomSocketEvent>,
): value is ParticipantEventShell {
  return (
    typeof value.participantId === "string" &&
    (value.slot === "first" || value.slot === "second")
  );
}
