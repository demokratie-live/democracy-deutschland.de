import { Link } from "./Link";
import { YouTubeHDThumbnail } from "./YouTubeHDThumbnail";

/**
 * "Worum geht es bei DEMOCRACY (2:30)?" block with link and YouTube video.
 * The title is either three `<h1>`s (`titleBefore`, `titleEmphasis` in blue,
 * `titleAfter`; home, wahlometer) or a single `title` (about).
 */
export function VideoSection({
  raised = false,
  rowId,
  title,
  titleBefore,
  titleEmphasis,
  titleAfter,
  linkHref,
  linkLabel,
  youtube,
}: {
  raised?: boolean;
  /** id of the `.row.video-content` (about: "mission-statement"). */
  rowId?: string;
  title?: string;
  titleBefore?: string;
  titleEmphasis?: string;
  titleAfter?: string;
  linkHref: string;
  linkLabel: string;
  /** YouTube video id, e.g. DFXcnRdXA7k; thumbnail in public/files/youtube/<id>.jpg */
  youtube: string;
}) {
  return (
    <div
      className="background-white"
      style={raised ? { zIndex: 100, position: "relative" } : undefined}
    >
      <div
        id="video-box"
        className="container page"
        style={{ minHeight: "unset", paddingBottom: "10vh" }}
      >
        <div className="row video-content" id={rowId}>
          <div id="video-title" className="col-lg-7">
            {title !== undefined ? (
              <h1 id="video-title">{title}</h1>
            ) : (
              <>
                <h1 id="video-title">{titleBefore}</h1>{" "}
                <h1 id="video-title-emphasis">{titleEmphasis}</h1>{" "}
                <h1 id="video-title">{titleAfter}</h1>
              </>
            )}
          </div>
          <div
            id="video-applink"
            className="col-lg-5"
            style={{ textAlign: "right", paddingTop: "20px" }}
          >
            <Link href={linkHref} style={{ color: "rgb(74,74,74)", fontSize: "20px" }}>
              {linkLabel}
            </Link>
          </div>
          <div className="col-lg-12" id="video" style={{ paddingTop: "35px" }}>
            <YouTubeHDThumbnail videoId={youtube} />
          </div>
        </div>
      </div>
    </div>
  );
}
