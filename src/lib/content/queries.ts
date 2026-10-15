import {
  appLinksSchema,
  donationSchema,
  footerSchema,
  headSchema,
  navigationSchema,
  pageFrontmatterSchema,
  routesSchema,
  type AppLinks,
  type Donation,
  type Footer,
  type Head,
  type Navigation,
  type PageFrontmatter,
  type Routes,
  teamSchema,
  type Team,
  pressMediaSchema,
  type PressMedia,
  faqSchema,
  type Faq,
  formsSchema,
  type Forms,
  roadmapSchema,
  type Roadmap,
} from "../schemas";
import fs from "fs/promises";
import path from "path";
import { loadMdx } from "./load-mdx";
import { loadYaml } from "./load-yaml";

/** Load content/pages/<pageId>.mdx (pageId = file name without extension). */
export async function getPage(pageId: string) {
  return loadMdx<PageFrontmatter>(`pages/${pageId}.mdx`, pageFrontmatterSchema);
}

export async function getHead(): Promise<Head> {
  return loadYaml("site/head.yaml", headSchema);
}

export async function getRoutes(): Promise<Routes> {
  return loadYaml("site/routes.yaml", routesSchema);
}

export async function getNavigation(): Promise<Navigation> {
  return loadYaml("site/navigation.yaml", navigationSchema);
}

export async function getFooter(): Promise<Footer> {
  return loadYaml("site/footer.yaml", footerSchema);
}

export async function getAppLinks(): Promise<AppLinks> {
  return loadYaml("site/app-links.yaml", appLinksSchema);
}

/** content/donate/donation.yaml: donation status for /spenden/ and the app JSON. */
export async function getDonation(): Promise<Donation> {
  return loadYaml("donate/donation.yaml", donationSchema);
}

/** content/team/team.yaml: team cards of /ueber-uns/. */
export async function getTeam(): Promise<Team> {
  return loadYaml("team/team.yaml", teamSchema);
}

/** content/press/media.yaml: media tiles of /presse/. */
export async function getPressMedia(): Promise<PressMedia> {
  return loadYaml("press/media.yaml", pressMediaSchema);
}

/** content/faq/faq.yaml: category menu and questions of /faq/. */
export async function getFaq(): Promise<Faq> {
  return loadYaml("faq/faq.yaml", faqSchema);
}

/** content/engineering/roadmap.yaml: roadmap table of /engineering/. */
export async function getRoadmap(): Promise<Roadmap> {
  return loadYaml("engineering/roadmap.yaml", roadmapSchema);
}

/** content/site/forms.yaml: recipient, subject and alert texts of the forms. */
export async function getForms(): Promise<Forms> {
  return loadYaml("site/forms.yaml", formsSchema);
}

export const LEGAL_TEXTS = ["impressum", "datenschutz", "nutzungsbedingungen"] as const;
export type LegalTextName = (typeof LEGAL_TEXTS)[number];

/** content/legal/<name>.md: legal text (live: system_text `<name>_text`), Markdown with HTML. */
export async function getLegalText(name: LegalTextName): Promise<string> {
  return fs.readFile(path.join(process.cwd(), "content", "legal", `${name}.md`), "utf-8");
}
