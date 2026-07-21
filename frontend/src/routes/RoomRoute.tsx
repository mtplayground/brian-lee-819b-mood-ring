import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiRequestError,
  getLatestSnapshot,
  getThemePreference,
  joinRoom,
  type JoinRoomResponse,
} from "../api/rooms";
import { MoodInputPanel } from "../components/mood/MoodInputPanel";
import { PostcardMoodView } from "../components/mood/PostcardMoodView";
import { SharedMoodCanvas } from "../components/mood/SharedMoodCanvas";
import { useAppState } from "../state/AppStateContext";
import {
  clientMoodStateFromMoodValue,
  type ClientMoodState,
} from "../state/clientMood";
import {
  loadRoomIdentity,
  storeRoomIdentity,
  type StoredRoomIdentity,
} from "../state/roomIdentity";
import { useRoomMoodSocket } from "../state/useRoomMoodSocket";

type JoinStatus = "idle" | "joining" | "joined";
type SnapshotStatus = "idle" | "loading" | "ready" | "error";

const errorMessageFor = (error: unknown): string => {
  if (error instanceof ApiRequestError) {
    if (error.code === "room_not_found" || error.status === 404) {
      return "This room link does not exist.";
    }

    if (error.code === "room_full" || error.status === 409) {
      return "This room already has two people.";
    }

    if (error.status === 400) {
      return "This room link is invalid. Check the link and try again.";
    }

    if (error.status >= 500) {
      return "The room service is having trouble. Try again shortly.";
    }
  }

  if (error instanceof TypeError) {
    return "Unable to reach the room service. Check your connection and try again.";
  }

  return error instanceof Error ? error.message : "Unable to join room";
};

export function RoomRoute() {
  const {
    activeThemeId,
    config,
    currentMood,
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
  const [postcardMood, setPostcardMood] = useState<ClientMoodState | null>(null);
  const [postcardParticipantId, setPostcardParticipantId] = useState<string | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus>("idle");
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
      setPostcardMood(null);
      setPostcardParticipantId(null);
      setSnapshotStatus("idle");
      setStatus("idle");
      return;
    }

    const storedIdentity = loadRoomIdentity(roomId);
    setIdentity(storedIdentity);
    setActiveRoomIdentity(null);
    setJoinResult(null);
    setPostcardMood(null);
    setPostcardParticipantId(null);
    setSnapshotStatus("idle");
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
  const socketConnection = useRoomMoodSocket(isJoined ? identity : null);

  const otherParticipants = identity
    ? roomPresence.filter((participant) => participant.participantId !== identity.participantId)
    : [];
  const isSocketReady = socketConnection.status === "connected";
  const isLiveTogether = isSocketReady && otherParticipants.length > 0;
  const isPostcardMode = isSocketReady && !isLiveTogether;
  const displayedPostcardMood = postcardMood ?? remoteMood?.mood ?? null;
  const displayedPostcardUpdatedAt =
    postcardMood?.updatedAt ?? remoteMood?.mood.updatedAt ?? null;
  const connectionMode = isSocketReady
    ? otherParticipants.length > 0
      ? "Live together"
      : "Postcard mode"
    : socketConnection.status === "reconnecting"
      ? "Reconnecting"
      : "Connecting";
  const connectionMessage = isSocketReady
    ? otherParticipants.length > 0
      ? "The other person is here now. Mood changes are live."
      : snapshotStatus === "loading"
        ? "You are connected. Loading the other person's last saved mood."
        : displayedPostcardMood
          ? "You are connected. The other person's saved mood is shown as a postcard."
          : "You are connected. The other person will see updates when they return."
    : socketConnection.status === "reconnecting"
      ? `Connection dropped. Reconnecting attempt ${socketConnection.reconnectAttempt}.`
      : "Opening the live room connection.";
  const connectionStatusClass = isSocketReady
    ? isLiveTogether
      ? "connection-status--live"
      : "connection-status--solo"
    : socketConnection.status === "reconnecting"
      ? "connection-status--reconnecting"
      : "connection-status--connecting";
  const reconnectDetail =
    socketConnection.status === "reconnecting" && socketConnection.nextRetryMs !== null
      ? `Next retry in ${Math.ceil(socketConnection.nextRetryMs / 1000)}s.`
      : null;
  const closeDetail =
    socketConnection.status === "reconnecting" && socketConnection.lastCloseCode !== null
      ? `Last close code ${socketConnection.lastCloseCode}${
          socketConnection.lastCloseReason ? `: ${socketConnection.lastCloseReason}` : ""
        }.`
      : null;

  useEffect(() => {
    if (!isJoined || !identity || !isPostcardMode) {
      if (isLiveTogether) {
        setPostcardMood(null);
        setPostcardParticipantId(null);
        setSnapshotStatus("idle");
      }

      return;
    }

    let isCancelled = false;
    setSnapshotStatus("loading");

    void getLatestSnapshot(config, identity.roomId, identity)
      .then((response) => {
        if (isCancelled) {
          return;
        }

        setPostcardParticipantId(response.participantId);

        if (!response.snapshot) {
          setPostcardMood(null);
          setSnapshotStatus("ready");
          return;
        }

        setPostcardMood(
          clientMoodStateFromMoodValue(response.snapshot.mood, response.snapshot.updatedAt),
        );
        setSnapshotStatus("ready");
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setSnapshotStatus("error");
      });

    return () => {
      isCancelled = true;
    };
  }, [config, identity, isJoined, isLiveTogether, isPostcardMode]);

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
            <div className={`connection-status ${connectionStatusClass}`}>
              <span className="connection-status__dot" aria-hidden="true" />
              <h2 id="presence-heading">{connectionMode}</h2>
            </div>
            <p>{connectionMessage}</p>
            {(reconnectDetail || closeDetail) && (
              <p className="connection-status__meta">
                {[reconnectDetail, closeDetail].filter(Boolean).join(" ")}
              </p>
            )}
          </section>

          {isPostcardMode ? (
            <PostcardMoodView
              activeThemeId={activeThemeId}
              mood={displayedPostcardMood}
              snapshotUpdatedAt={displayedPostcardUpdatedAt}
            />
          ) : (
            <SharedMoodCanvas
              activeThemeId={activeThemeId}
              localMood={currentMood}
              remoteMood={remoteMood?.mood ?? null}
            />
          )}

          <MoodInputPanel />

          <section className="remote-mood" aria-labelledby="remote-mood-heading">
            <p className="route-panel__eyebrow">Other person</p>
            {remoteMood ? (
              <>
                <h2 id="remote-mood-heading">
                  {isLiveTogether ? remoteMood.mood.selectedPreset.label : "Saved postcard"}
                </h2>
                <p>{remoteMoodSummary}</p>
              </>
            ) : displayedPostcardMood ? (
              <>
                <h2 id="remote-mood-heading">{displayedPostcardMood.selectedPreset.label}</h2>
                <p>
                  {postcardParticipantId
                    ? "This is their most recent saved mood."
                    : "This saved mood is available while they are away."}
                </p>
              </>
            ) : snapshotStatus === "error" ? (
              <>
                <h2 id="remote-mood-heading">Postcard unavailable</h2>
                <p>The saved mood could not be loaded. Live mood will appear when they return.</p>
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
