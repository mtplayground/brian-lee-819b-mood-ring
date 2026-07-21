import { useEffect, useRef } from "react";
import {
  buildRoomWebSocketUrl,
  moodClearMessage,
  moodUpdateMessage,
  parseMoodSocketPayload,
  parseRoomSocketEvent,
} from "../api/realtime";
import { useAppState } from "./AppStateContext";
import type { ClientMoodState } from "./clientMood";
import type { StoredRoomIdentity } from "./roomIdentity";

export function useRoomMoodSocket(identity: StoredRoomIdentity | null) {
  const { config, currentMood, setRemoteMood, setRoomPresence } = useAppState();
  const socketRef = useRef<WebSocket | null>(null);
  const latestMoodRef = useRef<ClientMoodState | null>(currentMood);

  useEffect(() => {
    latestMoodRef.current = currentMood;
  }, [currentMood]);

  useEffect(() => {
    if (!identity) {
      socketRef.current?.close();
      socketRef.current = null;
      setRemoteMood(null);
      setRoomPresence([]);
      return undefined;
    }

    const socket = new WebSocket(buildRoomWebSocketUrl(config, identity.roomId, identity));
    socketRef.current = socket;

    socket.onopen = () => {
      const latestMood = latestMoodRef.current;
      socket.send(latestMood ? moodUpdateMessage(latestMood) : moodClearMessage());
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      const roomEvent = parseRoomSocketEvent(event.data);
      if (!roomEvent) {
        return;
      }

      if (roomEvent.type === "presenceSnapshot") {
        setRoomPresence(roomEvent.participants);
        return;
      }

      if (roomEvent.type !== "participantMessage") {
        return;
      }

      if (roomEvent.participantId === identity.participantId) {
        return;
      }

      const moodPayload = parseMoodSocketPayload(roomEvent.payload);
      if (!moodPayload) {
        return;
      }

      if (moodPayload.type === "moodClear") {
        setRemoteMood(null);
        return;
      }

      setRemoteMood({
        participantId: roomEvent.participantId,
        slot: roomEvent.slot,
        mood: moodPayload.mood,
        receivedAt: new Date().toISOString(),
      });
    };

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };

    socket.onerror = () => {
      socket.close();
    };

    return () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      socket.close();
    };
  }, [config, identity, setRemoteMood, setRoomPresence]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!identity || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(currentMood ? moodUpdateMessage(currentMood) : moodClearMessage());
  }, [currentMood, identity]);
}
