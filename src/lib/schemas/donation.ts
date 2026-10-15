import { z } from "zod";

/** `type` of a row in the old SQL table `donate` (default_donate::DONATION_TYPE_*). */
export const DONATION_TYPE_HEAD = 0;
export const DONATION_TYPE_DATA = 1;

const amount = z.number().int().nonnegative();

const donationItemSchema = z
  .object({
    id: z.number().int().positive(),
    order: z.number().int(),
    type: z.union([z.literal(DONATION_TYPE_HEAD), z.literal(DONATION_TYPE_DATA)]),
    value: amount.default(0),
    max: amount.default(0),
    text_cost: z.string().default(""),
    text_description: z.string().default(""),
    text_description_subtext: z.string().default(""),
    text_date: z.string().default(""),
  })
  .strict()
  // value/max is divided like in PHP; max 0 would end in INF and break json_encode.
  .refine((item) => item.type === DONATION_TYPE_HEAD || item.max > 0, {
    message: "max muss bei Posten (type 1) größer als 0 sein",
    path: ["max"],
  });

/** content/donate/donation.yaml – keys as in the JSON of api.php?call=donation_status. */
export const donationSchema = z
  .object({
    donation_date: z.string(),
    donation_paten: amount,
    donation_paten_goal: amount,
    donation_value: amount,
    donation_value_goal: amount.positive(),
    donation_data: z.array(donationItemSchema),
  })
  .strict()
  .superRefine((donation, ctx) => {
    for (const key of ["id", "order"] as const) {
      const seen = new Set<number>();
      donation.donation_data.forEach((item, index) => {
        if (seen.has(item[key])) {
          ctx.addIssue({
            code: "custom",
            message: `${key} ${item[key]} kommt doppelt vor`,
            path: ["donation_data", index, key],
          });
        }
        seen.add(item[key]);
      });
    }
  });
export type Donation = z.infer<typeof donationSchema>;
export type DonationItem = Donation["donation_data"][number];
