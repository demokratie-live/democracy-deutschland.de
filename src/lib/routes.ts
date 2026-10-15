import type { Route } from "./schemas";

/** "/wahlometer" and "/wahlometer/" both become "/wahlometer/". */
export function normalizePath(pathname: string): string {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

/** Route for a pathname without basePath (as returned by usePathname()). */
export function findRoute(routes: Route[], pathname: string): Route | undefined {
  const path = normalizePath(pathname);
  return routes.find((route) => route.path === path);
}
