import { z } from "zod";

/** Image under public/ with the old path ("/files/wir/…"). */
const image = z.string().regex(/^\/files\//, "path under /files/");

/**
 * One card of default_about's team list (team_member.tpl): photo, name,
 * text lines (joined with <br>) and contact links shown on hover.
 */
export const teamMemberSchema = z.object({
  name: z.string().min(1),
  text: z.array(z.string().min(1)).min(1),
  img: image,
  /** Optional second photo shown while hovering (`hover` attribute). */
  imgHover: image.optional(),
  links: z.array(
    z.object({
      /** Font Awesome classes, e.g. "fa fa-envelope" or "fab fa-xing". */
      icon: z.string().regex(/^fab? fa-[a-z0-9-]+$/, "Font Awesome classes like 'fa fa-envelope'"),
      url: z.string().regex(/^(mailto:|tel:|https:\/\/)/, "mailto:, tel: or https:// URL"),
    }),
  ),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const teamSchema = z.object({
  members: z.array(teamMemberSchema).min(1),
});
export type Team = z.infer<typeof teamSchema>;
