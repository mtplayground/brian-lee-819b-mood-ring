import { useEffect, useRef, useState } from "react";
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

const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 5000;

export type RoomSocketConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting";

export type RoomSocketConnectionState = {
  reconnectAttempt: number;
  status: RoomSocketConnectionStatus;
};

export function useRoomMoodSocket(identity: StoredRoomIdentity | null) {
  const { config, currentMood, setRemoteMood, setRoomPresence } = useAppState();
  const [connectionState, setConnectionState] = useState<RoomSocketConnectionState>({
    reconnectAttempt: 0,
    status: "idle",
  });
  const socketRef = useRef<WebSocket | null>(null);
  const latestMoodRef = useRef<ClientMoodState | null>(currentMood);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    latestMoodRef.current = currentMood;
  }, [currentMood]);

  useEffect(() => {
    if (!identity) {
      socketRef.current?.close();
      socketRef.current = null;
      reconnectAttemptRef.current = 0;
      setConnectionState({
        reconnectAttempt: 0,
        status: "idle",
      });
      setRemoteMood(null);
      setRoomPresence([]);
      return undefined;
    }

    let isDisposed = false;
    let reconnectTimer: number | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer === null) {
        return;
      }

      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const scheduleReconnect = () => {
      if (isDisposed) {
        return;
      }

      const reconnectAttempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = reconnectAttempt;
      const delay = Math.min(
        MAX_RECONNECT_DELAY_MS,
        INITIAL_RECONNECT_DELAY_MS * 2 ** (reconnectAttempt - 1),
      );

      setRoomPresence([]);
      setConnectionState({
        reconnectAttempt,
        status: "reconnecting",
      });
      clearReconnectTimer();
      reconnectTimer = window.setTimeout(() => {
        openSocket();
      }, delay);
    };

    const handleRoomMessage = (event: MessageEvent) => {
      if (isDisposed) {
        return;
      }

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

    const openSocket = () => {
      if (isDisposed) {
        return;
      }

      setConnectionState({
        reconnectAttempt: reconnectAttemptRef.current,
        status: reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting",
      });

      const socket = new WebSocket(buildRoomWebSocketUrl(config, identity.roomId, identity));
      socketRef.current = socket;

      socket.onopen = () => {
        if (isDisposed) {
          socket.close();
          return;
        }

        reconnectAttemptRef.current = 0;
        setConnectionState({
          reconnectAttempt: 0,
          status: "connected",
        });

        const latestMood = latestMoodRef.current;
        socket.send(latestMood ? moodUpdateMessage(latestMood) : moodClearMessage());
      };

      socket.onmessage = handleRoomMessage;

      socket.onclose = () => {
        if (isDisposed) {
          return;
        }

        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        scheduleReconnect();
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    openSocket();

    return () => {
      isDisposed = true;
      clearReconnectTimer();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [config, identity, setRemoteMood, setRoomPresence]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!identity || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(currentMood ? moodUpdateMessage(currentMood) : moodClearMessage());
  }, [currentMood, identity]);

  return connectionState;
}
