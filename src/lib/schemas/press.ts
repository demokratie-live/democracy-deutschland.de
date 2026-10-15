import { z } from "zod";

/** One tile of default_press (article.tpl): image, title, link in a new tab. */
export const pressItemSchema = z.object({
  title: z.string().min(1),
  /** External URL or a file under public/ ("/files/download/…"). */
  link: z.string().regex(/^(https?:\/\/|\/files\/)/, "http(s)-URL oder /files/…"),
  /** Image under public/files/medien/. */
  img: z.string().regex(/^\/files\/medien\//, "Pfad unter /files/medien/"),
});
export type PressItem = z.infer<typeof pressItemSchema>;

/**
 * content/press/media.yaml: the three lists of the old table `media`, one per
 * type of saimod_media, in live order.
 */
export const pressMediaSchema = z.object({
  /** MEDIA_DOWNLOAD, section "Presse-Kit". */
  kit: z.array(pressItemSchema),
  /** MEDIA_PRESS, section "Pressespiegel". */
  articles: z.array(pressItemSchema),
  /** MEDIA_PUBLICATION, section "Publikationen". */
  publications: z.array(pressItemSchema),
});
export type PressMedia = z.infer<typeof pressMediaSchema>;
export type PressList = keyof PressMedia;
