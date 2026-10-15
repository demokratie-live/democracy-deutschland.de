import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * The search term of the URL (`?s=`), null without one. Null while the page
 * hydrates (the static HTML is the page without search), the term right after.
 */
export function useBlogSearchQuery(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get("s"),
    () => null,
  );
}
