import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type ShareLinkProps = {
  roomId: string;
  sharePath: string;
};

export function ShareLink({ roomId, sharePath }: ShareLinkProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const shareUrl = useMemo(() => new URL(sharePath, window.location.origin).href, [sharePath]);

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <section className="share-link" aria-labelledby="share-link-heading">
      <div>
        <p className="route-panel__eyebrow">Room ready</p>
        <h2 id="share-link-heading">Send this link to one close person.</h2>
      </div>

      <label className="share-link__field">
        <span>Share link</span>
        <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
      </label>

      <div className="share-link__actions">
        <button className="button button--primary" type="button" onClick={copyShareUrl}>
          Copy link
        </button>
        <Link className="button button--secondary" to={`/rooms/${roomId}`}>
          Enter room
        </Link>
      </div>

      <p className="share-link__status" role="status">
        {copyStatus === "copied" && "Copied."}
        {copyStatus === "failed" && "Copy failed. Select the link manually."}
      </p>
    </section>
  );
}
