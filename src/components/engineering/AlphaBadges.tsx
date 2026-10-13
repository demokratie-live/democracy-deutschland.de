import { StoreBadge } from "@/components/shared/StoreBadge";
import { getAppLinks } from "@/lib/content";
import { asset } from "@/lib/base-path";

/**
 * `.badges2` of default_engineering.tpl: App Store and Google Play badge
 * (hover like the other store badges) and the button, all linking to
 * link_alpha (content/site/app-links.yaml `alpha`).
 */
export async function AlphaBadges({ label, button }: { label: string; button: string }) {
  const { alpha } = await getAppLinks();
  return (
    <div className="badges2">
      <div className="row">
        <div className="col-md-6">
          <span>{label}</span>
          <br />
          <StoreBadge
            store="app-store"
            variant="2"
            href={alpha}
            target="_blank"
            style={{ marginTop: "-5px" }}
          />
        </div>
        <div id="secondbadge" className="col-md-6">
          <span className="d-none d-md-block">{label}</span>
          <StoreBadge
            store="google-play"
            variant="2"
            href={alpha}
            target="_blank"
            style={{ marginTop: "-5px" }}
          />
        </div>
        <div className="col-12">
          <a className="btn-democracy" href={asset(alpha)} target="_blank">
            <div style={{ width: "auto", border: 0 }}>{button}</div>
          </a>
        </div>
      </div>
    </div>
  );
}
