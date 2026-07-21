import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "../../state/AppStateContext";
import { moodToThemeTokens, themeRendererById } from "../../theme";
import { ThemeSelector } from "../theme/ThemeSelector";

export function RootLayout({ children }: PropsWithChildren) {
  const { activeThemeId, config, currentMood } = useAppState();
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const hasMounted = useRef(false);
  const themeRender = useMemo(() => {
    const tokens = moodToThemeTokens(currentMood);
    const renderer = themeRendererById[activeThemeId];

    return renderer.render(tokens, currentMood);
  }, [activeThemeId, currentMood]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return undefined;
    }

    setIsThemeTransitioning(true);
    const timeoutId = window.setTimeout(() => setIsThemeTransitioning(false), 560);

    return () => window.clearTimeout(timeoutId);
  }, [activeThemeId]);

  return (
    <div
      className={`app-shell ${themeRender.rootClassName}${isThemeTransitioning ? " theme-renderer--transitioning" : ""}`}
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
        <ThemeSelector />
      </header>

      <main className="app-main">{children}</main>

      <div className="theme-stage" aria-hidden="true" style={themeRender.stageStyle}>
        <div className="theme-stage__surface" />
      </div>
    </div>
  );
}
