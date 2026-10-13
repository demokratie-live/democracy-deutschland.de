/**
 * Content-Validierungs-Script
 * Prüft alle Content-Dateien gegen ihre Zod-Schemas und interne Verweise
 * (State der Seiten, interne Links) gegen content/site/routes.yaml.
 * Nutzung: pnpm validate-content
 */

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import yaml from "yaml";
import { z } from "zod";

import { blogPostFrontmatterSchema } from "../src/lib/schemas/blog";
import { donationSchema } from "../src/lib/schemas/donation";
import { faqSchema, type Faq } from "../src/lib/schemas/faq";
import { pageFrontmatterSchema } from "../src/lib/schemas/page";
import { pressMediaSchema, type PressMedia } from "../src/lib/schemas/press";
import { teamSchema, type Team } from "../src/lib/schemas/team";
import {
  appLinksSchema,
  footerSchema,
  headSchema,
  navigationSchema,
  routesSchema,
  type Routes,
} from "../src/lib/schemas/site";

const CONTENT_DIR = path.join(process.cwd(), "content");

let errors = 0;
let validated = 0;

function fail(label: string, messages: string[]) {
  errors++;
  console.error(`  ❌ ${label}`);
  for (const message of messages) console.error(`     → ${message}`);
}

function describe(err: unknown): string[] {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  }
  return [String(err)];
}

async function readYaml(filePath: string, schema: z.ZodType): Promise<unknown> {
  try {
    const raw = await fs.readFile(path.join(CONTENT_DIR, filePath), "utf-8");
    const data = schema.parse(yaml.parse(raw));
    validated++;
    console.log(`  ✅ ${filePath}`);
    return data;
  } catch (err) {
    fail(filePath, describe(err));
    return undefined;
  }
}

/** Internal links must point to a path of routes.yaml (anchor allowed). */
function checkLinks(label: string, hrefs: string[], routes: Routes | undefined) {
  if (!routes) return;
  const known = new Set([
    ...routes.routes.map((route) => route.path),
    ...routes.aliases.map((alias) => alias.from),
  ]);
  const unknown = hrefs
    .filter((href) => href.startsWith("/") && !href.startsWith("/files/"))
    .filter((href) => !known.has(href.split("#")[0]));
  if (unknown.length > 0)
    fail(
      label,
      unknown.map((href) => `unbekannter Pfad: ${href}`),
    );
}

/** Paths under public/ ("/files/…", "/blog/wp-content/…") must exist. */
async function checkFiles(label: string, paths: string[]) {
  const missing: string[] = [];
  for (const file of paths) {
    try {
      await fs.access(path.join(process.cwd(), "public", file));
    } catch {
      missing.push(file);
    }
  }
  if (missing.length > 0)
    fail(
      label,
      missing.map((file) => `Datei fehlt: public${file}`),
    );
}

async function main() {
  console.log("\n🔍 Validiere Content-Dateien...\n");

  console.log("📊 Site-Daten (YAML):");
  const routes = (await readYaml("site/routes.yaml", routesSchema)) as Routes | undefined;
  await readYaml("site/head.yaml", headSchema);
  await readYaml("site/app-links.yaml", appLinksSchema);
  const navigation = (await readYaml("site/navigation.yaml", navigationSchema)) as
    | z.infer<typeof navigationSchema>
    | undefined;
  const footer = (await readYaml("site/footer.yaml", footerSchema)) as
    | z.infer<typeof footerSchema>
    | undefined;

  if (navigation) {
    checkLinks(
      "site/navigation.yaml",
      [navigation.brand.href, ...navigation.items.map((i) => i.href)],
      routes,
    );
  }
  if (footer) {
    checkLinks(
      "site/footer.yaml",
      footer.columns.flatMap((column) => column.links.map((link) => link.href)),
      routes,
    );
  }

  console.log("\n💶 Spendenstand (YAML):");
  await readYaml("donate/donation.yaml", donationSchema);

  console.log("\n👥 Team (YAML):");
  const team = (await readYaml("team/team.yaml", teamSchema)) as Team | undefined;
  if (team) {
    // Live showed a broken image because a hover photo was missing.
    const images = team.members.flatMap((member) =>
      member.imgHover ? [member.img, member.imgHover] : [member.img],
    );
    await checkFiles("team/team.yaml", images);
  }

  console.log("\n📰 Presse (YAML):");
  const press = (await readYaml("press/media.yaml", pressMediaSchema)) as PressMedia | undefined;
  if (press) {
    const items = [...press.kit, ...press.articles, ...press.publications];
    await checkFiles("press/media.yaml", [
      ...items.map((item) => item.img),
      ...items.map((item) => item.link).filter((link) => link.startsWith("/files/")),
    ]);
  }

  console.log("\n❓ FAQ (YAML):");
  const faq = (await readYaml("faq/faq.yaml", faqSchema)) as Faq | undefined;
  if (faq) {
    // Markdown links [text](/pfad/) in the answers.
    const hrefs = faq.questions.flatMap((question) =>
      [...question.answer.matchAll(/\]\((\/[^)\s]*)\)/g)].map((match) => match[1]),
    );
    checkLinks("faq/faq.yaml", hrefs, routes);
  }

  console.log("\n📝 Blog-Posts (Markdown):");
  const blogDir = path.join(CONTENT_DIR, "blog");
  const posts = (await fs.readdir(blogDir)).filter((f) => f.endsWith(".md"));
  for (const file of posts) {
    try {
      const raw = await fs.readFile(path.join(blogDir, file), "utf-8");
      const frontmatter = blogPostFrontmatterSchema.parse(matter(raw).data);
      if (file !== `${frontmatter.slug}.md`) {
        throw new Error(`Dateiname muss ${frontmatter.slug}.md sein`);
      }
      validated++;
      console.log(`  ✅ blog/${file}`);
      if (frontmatter.image) await checkFiles(`blog/${file}`, [frontmatter.image]);
    } catch (err) {
      fail(`blog/${file}`, describe(err));
    }
  }

  console.log("\n📄 Seiten (MDX):");
  const pagesDir = path.join(CONTENT_DIR, "pages");
  const files = (await fs.readdir(pagesDir)).filter((f) => f.endsWith(".mdx"));
  const states = new Set(routes?.routes.map((route) => route.state));
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(pagesDir, file), "utf-8");
      const { data } = matter(raw);
      const frontmatter = pageFrontmatterSchema.parse(data);
      if (routes && !states.has(frontmatter.state)) {
        throw new Error(`state "${frontmatter.state}" fehlt in site/routes.yaml`);
      }
      validated++;
      console.log(`  ✅ pages/${file}`);
    } catch (err) {
      fail(`pages/${file}`, describe(err));
    }
  }

  console.log(`\n📋 Ergebnis: ${validated} Dateien validiert, ${errors} Fehler\n`);

  if (errors > 0) {
    process.exit(1);
  }
}

main();
