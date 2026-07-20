import { useParams } from "react-router-dom";

export function RoomRoute() {
  const { roomId } = useParams();

  return (
    <section className="route-panel" aria-labelledby="room-heading">
      <p className="route-panel__eyebrow">Room route</p>
      <h1 id="room-heading">Room shell</h1>
      <p>
        Route context is available for future room entry and live mood rendering.
      </p>
      <dl className="config-list">
        <div>
          <dt>Room</dt>
          <dd>{roomId ?? "unknown"}</dd>
        </div>
      </dl>
    </section>
  );
}
