import { useAppState } from "../state/AppStateContext";

export function HomeRoute() {
  const { config } = useAppState();

  return (
    <section className="route-panel" aria-labelledby="home-heading">
      <p className="route-panel__eyebrow">Frontend shell</p>
      <h1 id="home-heading">Single-page experience ready for room flows.</h1>
      <p>
        The app is wired with routing, app-level state, and environment-aware endpoints for the API and WebSocket
        server.
      </p>
      <dl className="config-list">
        <div>
          <dt>Backend</dt>
          <dd>{config.backendBaseUrl}</dd>
        </div>
        <div>
          <dt>WebSocket</dt>
          <dd>{config.wsBaseUrl}</dd>
        </div>
      </dl>
    </section>
  );
}
