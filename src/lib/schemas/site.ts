import { z } from "zod";

/** Internal links are new paths ("/ueber-uns/", "/engineering/#help"). */
const href = z.string().min(1);

// --- head.yaml ---

export const headSchema = z.object({
  title: z.string(),
  meta: z.record(z.string(), z.string()),
  openGraph: z.object({
    url: z.string(),
    type: z.string(),
    description: z.string(),
    image: z.string(),
  }),
  externalStylesheets: z.array(z.url()),
  manifest: z.string(),
  icons: z.array(
    z.object({
      rel: z.enum(["icon", "apple-touch-icon"]),
      href: z.string(),
      sizes: z.string().optional(),
      type: z.string().optional(),
    }),
  ),
});
export type Head = z.infer<typeof headSchema>;

// --- routes.yaml ---

export const routeSchema = z.object({
  state: z.string(),
  path: z.string().regex(/^\/([a-z0-9-]+\/)*$/, "path must start and end with /"),
  menu: z.string().optional(),
  startpage: z.boolean().default(false),
});
export type Route = z.infer<typeof routeSchema>;

export const routesSchema = z.object({
  start: z.string(),
  routes: z.array(routeSchema),
  aliases: z.array(z.object({ from: z.string(), to: z.string() })).default([]),
});
export type Routes = z.infer<typeof routesSchema>;

// --- navigation.yaml ---

export const navigationSchema = z.object({
  brand: z.object({
    href,
    logo: z.string(),
    alt: z.string(),
    name: z.string(),
    suffix: z.string(),
  }),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      href,
      important: z.boolean().default(false),
    }),
  ),
});
export type Navigation = z.infer<typeof navigationSchema>;

// --- footer.yaml ---

const footerLinkSchema = z.object({ label: z.string(), href });

export const footerSchema = z.object({
  logo: z.object({ name: z.string(), claim: z.string() }),
  newsletter: z.object({ label: z.string(), href: z.url(), ariaLabel: z.string() }),
  columns: z.array(
    z.object({ title: z.string(), className: z.string(), links: z.array(footerLinkSchema) }),
  ),
  social: z.object({
    title: z.string(),
    rows: z.array(z.array(z.object({ href, icon: z.string() }))),
  }),
  copyright: z.object({ text: z.string(), brand: z.string(), owner: z.string() }),
});
export type Footer = z.infer<typeof footerSchema>;

// --- app-links.yaml ---

export const appLinksSchema = z.object({
  appStore: z.url(),
  playStore: z.url(),
  fdroid: z.url(),
  browserVersion: z.url(),
  apk: z.url(),
  aab: z.url(),
});
export type AppLinks = z.infer<typeof appLinksSchema>;

// --- forms.yaml ---

export const formsSchema = z.object({
  recipient: z.email(),
  subject: z.string().includes("{type}"),
  messages: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    text: z.string(),
    sent: z.string(),
    failed: z.string(),
  }),
});
export type Forms = z.infer<typeof formsSchema>;
