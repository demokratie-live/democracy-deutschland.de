/**
 * Original CSS in the order of default_page::css() (public/css/, see
 * AGENTS.md). Empty module files (contact, nutzungsbedingungen, datenschutz,
 * impressum, blog) are left out.
 */
export const ORIGINAL_STYLESHEETS = [
  "/css/bootstrap.min.css",
  "/css/font_awesome/css/all.min.css",
  "/css/font.css",
  "/css/default_page.css",
  "/css/default_home.css",
  "/css/default_about.css",
  "/css/default_wahlometer.css",
  "/css/default_citizen.css",
  "/css/default_donate.css",
  "/css/donate.css",
  "/css/default_engineering.css",
  "/css/default_faq.css",
  "/css/default_politicians.css",
  "/css/default_press.css",
];

/**
 * CSS of the YouTube HD Thumbnail plugin, loaded after the original CSS like
 * live (there from cdn.jsdelivr.net; public/vendor/, MIT, see its LICENSE).
 */
export const VENDOR_STYLESHEETS = ["/vendor/YouTubeHDThumbnail/css/YouTube.HD.Thumbnail.css"];
