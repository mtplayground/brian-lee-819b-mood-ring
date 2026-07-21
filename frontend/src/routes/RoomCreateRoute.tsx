import { useEffect, useState } from "react";
import { createRoom, type CreateRoomResponse } from "../api/rooms";
import { ShareLink } from "../components/room/ShareLink";
import { useAppState } from "../state/AppStateContext";
import { storeRoomIdentity } from "../state/roomIdentity";

export function RoomCreateRoute() {
  const { config, setActiveRoomIdentity, setActiveThemeId } = useAppState();
  const [createdRoom, setCreatedRoom] = useState<CreateRoomResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveRoomIdentity(null);
  }, [setActiveRoomIdentity]);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const room = await createRoom(config);
      storeRoomIdentity(room.roomId, room.creatorParticipant);
      const creatorIdentity = {
        roomId: room.roomId,
        ...room.creatorParticipant,
      };
      setActiveThemeId(room.creatorParticipant.lastUsedThemeId);
      setActiveRoomIdentity(creatorIdentity);
      setCreatedRoom(room);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create room");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="route-panel room-create" aria-labelledby="room-create-heading">
      <p className="route-panel__eyebrow">Private room for two</p>
      <h1 id="room-create-heading">Start a shared mood room.</h1>
      <p>
        Create a room, send the link, and keep your browser identity for this room.
      </p>

      <div className="room-create__actions">
        <button
          className="button button--primary"
          type="button"
          onClick={handleCreateRoom}
          disabled={isCreating}
        >
          {isCreating ? "Creating..." : "Create room"}
        </button>
      </div>

      {errorMessage && (
        <p className="room-create__error" role="alert">
          {errorMessage}
        </p>
      )}

      {createdRoom && <ShareLink roomId={createdRoom.roomId} sharePath={createdRoom.sharePath} />}
    </section>
  );
}
