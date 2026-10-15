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

import { LEGAL_TEXTS } from "../src/lib/content/queries";
import { attachmentImage } from "../src/lib/blog/images";
import { blogPermalink } from "../src/lib/content/blog";
import {
  blogMediaSchema,
  blogPostFrontmatterSchema,
  blogSiteSchema,
  blogTaxonomySchema,
  type BlogMedia,
  type BlogSite,
  type BlogTaxonomy,
} from "../src/lib/schemas/blog";
import { donationSchema } from "../src/lib/schemas/donation";
import { faqSchema, type Faq } from "../src/lib/schemas/faq";
import { pageFrontmatterSchema } from "../src/lib/schemas/page";
import { pressMediaSchema, type PressMedia } from "../src/lib/schemas/press";
import { roadmapSchema } from "../src/lib/schemas/roadmap";
import { teamSchema, type Team } from "../src/lib/schemas/team";
import {
  appLinksSchema,
  footerSchema,
  formsSchema,
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
/** Paths of the blog pages (index, pages, permalinks), filled before the links are checked. */
const blogPaths = new Set<string>();

async function collectBlogPaths() {
  const dir = path.join(CONTENT_DIR, "blog");
  const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".md"));
  const site = yaml.parse(await fs.readFile(path.join(dir, "site.yaml"), "utf-8")) as BlogSite;
  blogPaths.add("/blog/");
  for (let page = 2; page <= Math.ceil(files.length / site.postsPerPage); page++) {
    blogPaths.add(`/blog/page/${page}/`);
  }
  for (const file of files) {
    const { data } = matter(await fs.readFile(path.join(dir, file), "utf-8"));
    if (typeof data.date === "string" && typeof data.slug === "string") {
      blogPaths.add(blogPermalink({ date: data.date, slug: data.slug }));
    }
  }
}

function checkLinks(label: string, hrefs: string[], routes: Routes | undefined) {
  if (!routes) return;
  const known = new Set([
    ...routes.routes.map((route) => route.path),
    ...routes.aliases.map((alias) => alias.from),
    ...blogPaths,
  ]);
  const unknown = hrefs
    .filter((href) => href.startsWith("/") && !/^\/(files|blog\/wp-content)\//.test(href))
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
  await collectBlogPaths();

  console.log("📊 Site-Daten (YAML):");
  const routes = (await readYaml("site/routes.yaml", routesSchema)) as Routes | undefined;
  await readYaml("site/head.yaml", headSchema);
  await readYaml("site/app-links.yaml", appLinksSchema);
  await readYaml("site/forms.yaml", formsSchema);
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

  console.log("\n🛠️  Roadmap (YAML):");
  await readYaml("engineering/roadmap.yaml", roadmapSchema);

  console.log("\n📝 Blog (Markdown, YAML):");
  const blogSite = (await readYaml("blog/site.yaml", blogSiteSchema)) as BlogSite | undefined;
  if (blogSite) await checkFiles("blog/site.yaml", [blogSite.headerImage]);
  const taxonomy = (await readYaml("blog/taxonomy.yaml", blogTaxonomySchema)) as
    | BlogTaxonomy
    | undefined;
  const blogMedia = (await readYaml("blog/media.yaml", blogMediaSchema)) as BlogMedia | undefined;
  // Uploads the posts reference although live already answers 404 (import log).
  const missingUploads = new Set(
    ((await readYaml("blog/missing-uploads.yaml", z.array(z.string()))) as string[] | undefined) ??
      [],
  );
  if (blogMedia) {
    // Featured images: every file of their srcset (index and single post).
    const files = blogMedia.flatMap((item) =>
      ["post-image", "post-image-cover"].flatMap((size) => {
        const image = attachmentImage(item, size);
        const srcset = image.srcSet?.split(", ").map((entry) => decodeURI(entry.split(" ")[0]));
        return [item.file, image.src, ...(srcset ?? [])];
      }),
    );
    await checkFiles("blog/media.yaml", [...new Set(files)]);
  }
  const blogDir = path.join(CONTENT_DIR, "blog");
  const posts = (await fs.readdir(blogDir)).filter((f) => f.endsWith(".md"));
  for (const file of posts) {
    try {
      const raw = await fs.readFile(path.join(blogDir, file), "utf-8");
      const { data, content } = matter(raw);
      const frontmatter = blogPostFrontmatterSchema.parse(data);
      if (file !== `${frontmatter.slug}.md`) {
        throw new Error(`Dateiname muss ${frontmatter.slug}.md sein`);
      }
      const problems: string[] = [];
      if (taxonomy) {
        const has = (terms: BlogTaxonomy["tags"], slug: string) =>
          terms.some((term) => term.slug === slug);
        if (!has(taxonomy.authors, frontmatter.author))
          problems.push(`Autor ${frontmatter.author} fehlt in blog/taxonomy.yaml`);
        for (const slug of frontmatter.categories)
          if (!has(taxonomy.categories, slug))
            problems.push(`Kategorie ${slug} fehlt in blog/taxonomy.yaml`);
        for (const slug of frontmatter.tags)
          if (!has(taxonomy.tags, slug))
            problems.push(`Schlagwort ${slug} fehlt in blog/taxonomy.yaml`);
      }
      if (frontmatter.image && blogMedia) {
        const item = blogMedia.find((entry) => entry.id === frontmatter.featuredMedia);
        if (item?.file !== frontmatter.image)
          problems.push(`Beitragsbild ${frontmatter.featuredMedia} fehlt in blog/media.yaml`);
      }
      if (/democracy-deutschland\.de\/blog\/wp-content/.test(content))
        problems.push("Verweis auf democracy-deutschland.de/blog/wp-content");
      if (problems.length) throw new Error(problems.join("; "));
      validated++;
      console.log(`  ✅ blog/${file}`);
      const uploads = [...content.matchAll(/\/blog\/wp-content\/uploads\/[^"'\s),]+/g)]
        .map((match) => decodeURI(match[0]))
        .filter((upload) => !missingUploads.has(upload));
      const images = frontmatter.image ? [frontmatter.image] : [];
      await checkFiles(`blog/${file}`, [...new Set([...images, ...uploads])]);
    } catch (err) {
      fail(`blog/${file}`, describe(err));
    }
  }

  console.log("\n⚖️  Rechtstexte (Markdown):");
  for (const name of LEGAL_TEXTS) {
    const file = `legal/${name}.md`;
    try {
      const raw = await fs.readFile(path.join(CONTENT_DIR, file), "utf-8");
      // Markdown links [text](/pfad/) and HTML links href="/pfad/"
      const hrefs = [
        ...[...raw.matchAll(/\]\((\/[^)\s]*)\)/g)].map((match) => match[1]),
        ...[...raw.matchAll(/href="(\/[^"]*)"/g)].map((match) => match[1]),
      ];
      validated++;
      console.log(`  ✅ ${file}`);
      checkLinks(file, hrefs, routes);
    } catch (err) {
      fail(file, describe(err));
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
      for (const [, name] of raw.matchAll(/<LegalText name="([^"]*)"/g)) {
        if (!(LEGAL_TEXTS as readonly string[]).includes(name)) {
          throw new Error(`<LegalText name="${name}">: content/legal/${name}.md gibt es nicht`);
        }
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
