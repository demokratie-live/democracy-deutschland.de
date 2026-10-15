import { Link } from "@/components/shared/Link";
import { getLatestBlogPosts, getPressMedia } from "@/lib/content";
import { asset } from "@/lib/base-path";
import type { PressList } from "@/lib/schemas";

/**
 * article.tpl of default_press: a grey 200 px box with the image, the title
 * in an overlay that slides up on hover (default_press.css), link in a new tab.
 */
function PressTile({ title, link, img }: { title: string; link: string; img?: string }) {
  return (
    <div className="col-md-4" style={{ paddingBottom: "30px" }}>
      <div
        style={{
          border: "rgb(151,151,151) solid 1px",
          background: "rgb(216,216,216)",
          minHeight: "200px",
          maxHeight: "200px",
          overflow: "hidden",
        }}
      >
        <Link href={link} target="_blank">
          <img
            src={img && asset(img)}
            alt={title}
            className="img-responsive"
            style={{ minHeight: "200px", width: "100%" }}
          />
          <div className="overlay">
            <div>
              <h5>{title}</h5>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

/** `${media}`, `${articles}`, `${publications}`: one list of content/press/media.yaml. */
export async function PressMedia({ list }: { list: PressList }) {
  const media = await getPressMedia();
  return media[list].map((item, index) => <PressTile key={index} {...item} />);
}

/**
 * `${wordpress}`: the newest blog posts (default_press::wordpress()) from
 * content/blog/, linked to their permalink.
 */
export async function BlogTeasers({ count }: { count: number }) {
  const posts = await getLatestBlogPosts(count);
  return posts.map(({ frontmatter, permalink }) => (
    <PressTile
      key={frontmatter.wpId}
      title={frontmatter.title}
      link={permalink}
      img={frontmatter.image}
    />
  ));
}
