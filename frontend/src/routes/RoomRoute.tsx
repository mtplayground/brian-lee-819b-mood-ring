import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiRequestError,
  getThemePreference,
  joinRoom,
  type JoinRoomResponse,
} from "../api/rooms";
import { MoodInputPanel } from "../components/mood/MoodInputPanel";
import { useAppState } from "../state/AppStateContext";
import {
  loadRoomIdentity,
  storeRoomIdentity,
  type StoredRoomIdentity,
} from "../state/roomIdentity";
import { useRoomMoodSocket } from "../state/useRoomMoodSocket";

type JoinStatus = "idle" | "joining" | "joined";

const errorMessageFor = (error: unknown): string => {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) {
      return "This room link does not exist.";
    }

    if (error.status === 409) {
      return "This room already has two people.";
    }
  }

  return error instanceof Error ? error.message : "Unable to join room";
};

export function RoomRoute() {
  const {
    config,
    remoteMood,
    roomPresence,
    setActiveRoomIdentity,
    setActiveThemeId,
  } = useAppState();
  const { roomId } = useParams();
  const [identity, setIdentity] = useState<StoredRoomIdentity | null>(() =>
    roomId ? loadRoomIdentity(roomId) : null,
  );
  const [joinResult, setJoinResult] = useState<JoinRoomResponse | null>(null);
  const [status, setStatus] = useState<JoinStatus>(identity ? "joining" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleJoinRoom = async (storedIdentity = identity) => {
    if (!roomId) {
      setErrorMessage("Room link is missing a room identifier.");
      return;
    }

    setStatus("joining");
    setErrorMessage(null);

    try {
      const joinedRoom = await joinRoom(config, roomId, storedIdentity?.identityKey);
      const themePreference = await getThemePreference(
        config,
        joinedRoom.roomId,
        joinedRoom.participant,
      ).catch(() => null);
      const participant = {
        ...joinedRoom.participant,
        lastUsedThemeId: themePreference?.themeId ?? joinedRoom.participant.lastUsedThemeId,
      };
      storeRoomIdentity(joinedRoom.roomId, participant);
      const restoredIdentity = {
        roomId: joinedRoom.roomId,
        ...participant,
      };
      setIdentity(restoredIdentity);
      setActiveThemeId(participant.lastUsedThemeId);
      setActiveRoomIdentity(restoredIdentity);
      setJoinResult(joinedRoom);
      setStatus("joined");
    } catch (error) {
      setErrorMessage(errorMessageFor(error));
      setStatus("idle");
    }
  };

  useEffect(() => {
    if (!roomId) {
      setIdentity(null);
      setActiveRoomIdentity(null);
      setJoinResult(null);
      setStatus("idle");
      return;
    }

    const storedIdentity = loadRoomIdentity(roomId);
    setIdentity(storedIdentity);
    setActiveRoomIdentity(null);
    setJoinResult(null);
    setErrorMessage(null);

    if (storedIdentity) {
      void handleJoinRoom(storedIdentity);
    } else {
      setStatus("idle");
    }
    // The join action is intentionally driven by roomId changes only; config is stable
    // for the lifetime of the app shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const isJoined = status === "joined" && identity;
  const isReturning = Boolean(joinResult?.restoredIdentity);
  useRoomMoodSocket(isJoined ? identity : null);

  const otherParticipants = identity
    ? roomPresence.filter((participant) => participant.participantId !== identity.participantId)
    : [];
  const connectionMode = otherParticipants.length > 0 ? "Live together" : "Postcard mode";
  const connectionMessage =
    otherParticipants.length > 0
      ? "The other person is here now. Mood changes are live."
      : "You are connected. The other person will see updates when they return.";

  const remoteMoodSummary = remoteMood
    ? [
        `${Math.round(remoteMood.mood.value.intensity * 100)}% intensity`,
        remoteMood.mood.blend
          ? `${Math.round(remoteMood.mood.blend.amount * 100)}% blended`
          : null,
        remoteMood.mood.value.note || null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <section className="route-panel room-entry" aria-labelledby="room-heading">
      <p className="route-panel__eyebrow">Shared room</p>
      <h1 id="room-heading">{isJoined ? "You are in." : "Join this room."}</h1>
      <p>
        {isJoined
          ? "This browser will be recognized when you come back to this room."
          : "Use this link to enter the shared mood space for two people."}
      </p>

      {roomId ? (
        <dl className="config-list">
          <div>
            <dt>Room</dt>
            <dd>{roomId}</dd>
          </div>
          {identity && (
            <>
              <div>
                <dt>Identity</dt>
                <dd>{identity.participantId}</dd>
              </div>
              <div>
                <dt>Slot</dt>
                <dd>{identity.slot === "first" ? "Creator" : "Joined person"}</dd>
              </div>
            </>
          )}
          {joinResult && (
            <div>
              <dt>Entry</dt>
              <dd>{isReturning ? "Restored from this browser" : "Joined on this browser"}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="room-entry__error" role="alert">
          Room link is missing a room identifier.
        </p>
      )}

      {errorMessage && (
        <p className="room-entry__error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="room-entry__actions">
        {!isJoined && roomId && (
          <button
            className="button button--primary"
            type="button"
            onClick={() => void handleJoinRoom()}
            disabled={status === "joining"}
          >
            {status === "joining" ? "Joining..." : identity ? "Restore entry" : "Join room"}
          </button>
        )}
        <Link className="button button--secondary" to="/">
          Create another room
        </Link>
      </div>

      {isJoined && (
        <>
          <section className="presence-panel" aria-labelledby="presence-heading">
            <p className="route-panel__eyebrow">Presence</p>
            <h2 id="presence-heading">{connectionMode}</h2>
            <p>{connectionMessage}</p>
          </section>

          <MoodInputPanel />

          <section className="remote-mood" aria-labelledby="remote-mood-heading">
            <p className="route-panel__eyebrow">Other person</p>
            {remoteMood ? (
              <>
                <h2 id="remote-mood-heading">{remoteMood.mood.selectedPreset.label}</h2>
                <p>{remoteMoodSummary}</p>
              </>
            ) : (
              <>
                <h2 id="remote-mood-heading">Waiting for their mood</h2>
                <p>Their live mood will appear here as soon as they choose one.</p>
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
