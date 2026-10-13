import { z } from "zod";
import { isRoadmapCode } from "../roadmap";

/** Status code of icon_class() (see content/engineering/roadmap.yaml). */
const code = z
  .number()
  .refine(isRoadmapCode, "status code of icon_class(): 0 or 1–5, 11–15 … 71–75");

/** Colour classes of the template's <style> block (rmicon-<color>). */
const color = z.enum(["blue", "grey", "red", "green", "black"]);

/** Head of one status column: text and the coloured line below it. */
const columnSchema = z.object({
  text: z.string().min(1),
  color,
  date: z.string().min(1),
});

/** One row of goal.tpl. */
export const roadmapGoalSchema = z.object({
  goal: z.string().min(1),
  /** Indented sub item (three &nbsp; on live). */
  sub: z.boolean().optional(),
  bold: z.boolean().optional(),
  /** GitHub issue of democracy-client, shown as "#<issue>". */
  issue: z.number().int().positive().optional(),
  beta: code,
  mvp: code,
  dream: code,
});
export type RoadmapGoal = z.infer<typeof roadmapGoalSchema>;

/** Roadmap of /engineering/ (table `roadmap` and texts tagged "roadmap" on live). */
export const roadmapSchema = z.object({
  columns: z.object({ beta: columnSchema, mvp: columnSchema, dream: columnSchema }),
  goals: z.array(roadmapGoalSchema).min(1),
});
export type Roadmap = z.infer<typeof roadmapSchema>;
