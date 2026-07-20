import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiRequestError, joinRoom, type JoinRoomResponse } from "../api/rooms";
import { useAppState } from "../state/AppStateContext";
import {
  loadRoomIdentity,
  storeRoomIdentity,
  type StoredRoomIdentity,
} from "../state/roomIdentity";

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
  const { config } = useAppState();
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
      storeRoomIdentity(joinedRoom.roomId, joinedRoom.participant);
      setIdentity({
        roomId: joinedRoom.roomId,
        ...joinedRoom.participant,
      });
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
      setJoinResult(null);
      setStatus("idle");
      return;
    }

    const storedIdentity = loadRoomIdentity(roomId);
    setIdentity(storedIdentity);
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
    </section>
  );
}
