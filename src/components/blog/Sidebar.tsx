import type { ReactNode } from "react";
import { asset } from "@/lib/base-path";
import type { SidebarData } from "@/lib/blog/view";

function GroupWidget({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="widget widget_block">
      <div className="widget-content">
        <div className="wp-block-group">
          <div className="wp-block-group__inner-container is-layout-flow wp-block-group-is-layout-flow">
            <h2 className="wp-block-heading">{title}</h2>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * sidebar.php with the block widgets of the live blog: search, newest posts,
 * newest comments (there are none), monthly archives, categories.
 */
export function Sidebar({ data, searchNumber }: { data: SidebarData; searchNumber: number }) {
  const searchId = `wp-block-search__input-${searchNumber}`;
  return (
    <aside className="sidebar">
      <div id="block-2" className="widget widget_block widget_search">
        <div className="widget-content">
          <form
            role="search"
            method="get"
            action={asset("/blog/")}
            className="wp-block-search__button-outside wp-block-search__text-button wp-block-search"
          >
            <label className="wp-block-search__label" htmlFor={searchId}>
              Suchen
            </label>
            <div className="wp-block-search__inside-wrapper">
              <input
                className="wp-block-search__input"
                id={searchId}
                placeholder=""
                defaultValue=""
                type="search"
                name="s"
                required
              />
              <button
                aria-label="Suchen"
                className="wp-block-search__button wp-element-button"
                type="submit"
              >
                Suchen
              </button>
            </div>
          </form>
        </div>
      </div>
      <GroupWidget id="block-3" title="Neueste Beiträge">
        <ul className="wp-block-latest-posts__list wp-block-latest-posts is-layout-flow wp-block-latest-posts-is-layout-flow">
          {data.latest.map((post) => (
            <li key={post.permalink}>
              <a className="wp-block-latest-posts__post-title" href={asset(post.permalink)}>
                {post.title}
              </a>
            </li>
          ))}
        </ul>
      </GroupWidget>
      <GroupWidget id="block-4" title="Neueste Kommentare">
        <div className="no-comments wp-block-latest-comments">
          Es sind keine Kommentare vorhanden.
        </div>
      </GroupWidget>
      <GroupWidget id="block-5" title="Archive">
        <ul className="wp-block-archives-list wp-block-archives">
          {data.months.map((month) => (
            <li key={month.href}>
              <a href={asset(month.href)}>{month.label}</a>
            </li>
          ))}
        </ul>
      </GroupWidget>
      <GroupWidget id="block-6" title="Kategorien">
        <ul className="wp-block-categories-list wp-block-categories-taxonomy-category wp-block-categories">
          {data.categories.map((category) => (
            <li key={category.slug} className={`cat-item cat-item-${category.id}`}>
              <a href={asset(`/blog/category/${category.slug}/`)}>{category.name}</a>
            </li>
          ))}
        </ul>
      </GroupWidget>
    </aside>
  );
}
