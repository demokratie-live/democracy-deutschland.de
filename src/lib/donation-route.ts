import { getDonation } from "@/lib/content";
import { donationStatusJson } from "@/lib/donation";

/**
 * GET handler of /api.php and /api/donation_status.json. With output: "export"
 * both become static files at build time. The app requests
 * /api.php?call=donation_status; a static host ignores the query string, so
 * every call to /api.php returns the donation status.
 */
export async function GET() {
  return new Response(donationStatusJson(await getDonation()), {
    headers: { "Content-Type": "application/json" },
  });
}
