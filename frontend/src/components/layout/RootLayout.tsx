import { useMemo, type PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "../../state/AppStateContext";
import { baseThemeRenderer, moodToThemeTokens } from "../../theme";

export function RootLayout({ children }: PropsWithChildren) {
  const { config, currentMood } = useAppState();
  const themeRender = useMemo(() => {
    const tokens = moodToThemeTokens(currentMood);

    return baseThemeRenderer.render(tokens, currentMood);
  }, [currentMood]);

  return (
    <div
      className={`app-shell ${themeRender.rootClassName}`}
      data-theme-renderer={themeRender.rendererId}
      style={themeRender.rootStyle}
    >
      <header className="app-header">
        <Link className="app-header__mark" to="/" aria-label="Open home">
          <span className="app-header__symbol" aria-hidden="true" />
          <span>Shared mood canvas</span>
        </Link>
        <div className="app-header__meta" aria-label="Configured backend">
          <span>API</span>
          <code>{config.backendBaseUrl}</code>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <div className="theme-stage" aria-hidden="true" style={themeRender.stageStyle}>
        <div className="theme-stage__surface" />
      </div>
    </div>
  );
}
