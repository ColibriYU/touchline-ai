import { z } from "zod";
import { playerSchema, replay } from "./domain";
import type { AppData } from "./types";
export const formationSchema = z.enum(["4-3-3", "4-2-3-1", "4-4-2"]);
export const lineupSchema = z
  .object({
    formation: formationSchema,
    slots: z
      .array(
        z.object({
          role: z.string().min(1),
          playerId: z.string().nullable(),
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
        }),
      )
      .length(11),
  })
  .superRefine((l, ctx) => {
    const ids = l.slots.flatMap((s) => (s.playerId ? [s.playerId] : []));
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "首发球员重复" });
  });
const eventSchema = z
  .object({
    id: z.string().min(1),
    minute: z.number().min(0).max(300),
    kind: z.enum([
      "goal",
      "yellow",
      "red",
      "injury",
      "fatigue",
      "problem",
      "sub",
      "tactic",
      "score",
      "note",
    ]),
    playerId: z.string().optional(),
    incoming: z.string().optional(),
    side: z.enum(["home", "away"]).optional(),
    text: z.string().max(4000),
    lineup: lineupSchema.optional(),
    score: z
      .tuple([z.number().int().min(0).max(99), z.number().int().min(0).max(99)])
      .optional(),
    void: z.boolean().optional(),
  })
  .superRefine((e, ctx) => {
    if (
      (["sub", "yellow", "red", "injury", "fatigue"].includes(e.kind) &&
        !e.playerId) ||
      (e.kind === "sub" && !e.incoming) ||
      (e.kind === "tactic" && !e.lineup) ||
      (e.kind === "score" && !e.score) ||
      (e.kind === "goal" && !e.side)
    )
      ctx.addIssue({ code: "custom", message: "事件缺少必要字段" });
  });
export const matchSchema = z.object({
  id: z.string(),
  opponent: z.string().trim().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.number().int().min(1).max(180),
  subLimit: z.number().int().min(0).max(99),
  reentry: z.boolean(),
  players: z.array(playerSchema).max(100),
  initial: lineupSchema,
  events: z.array(eventSchema).max(10000),
  elapsed: z.number().min(0).max(18000),
  runningSince: z.number().nullable(),
  status: z.enum(["ready", "live", "ended"]),
});
export const appSchema = z.object({
  version: z.literal(1),
  players: z.array(playerSchema).max(100),
  lineup: lineupSchema,
  matches: z.array(matchSchema).max(1000),
});
export function validateData(value: unknown): AppData {
  const d = appSchema.parse(value);
  const check = (ids: string[]) => {
    if (new Set(ids).size !== ids.length) throw Error("存在重复ID");
  };
  const refs = (lineup: AppData["lineup"], ids: string[]) => {
    if (lineup.slots.some((s) => s.playerId && !ids.includes(s.playerId)))
      throw Error("阵容引用了不存在的球员");
  };
  check(d.players.map((p) => p.id));
  check(d.matches.map((m) => m.id));
  refs(
    d.lineup,
    d.players.map((p) => p.id),
  );
  if (d.matches.filter((m) => m.status !== "ended").length > 1)
    throw Error("只支持一场进行中的比赛");
  d.matches.forEach((m) => {
    const ids = m.players.map((p) => p.id);
    check(ids);
    check(m.events.map((e) => e.id));
    refs(m.initial, ids);
    if (m.status === "ended" && m.runningSince !== null)
      throw Error("已结束比赛不能计时");
    m.events.forEach((e) => {
      if (
        (e.playerId && !ids.includes(e.playerId)) ||
        (e.incoming && !ids.includes(e.incoming))
      )
        throw Error("事件引用了不存在的球员");
      if (e.lineup) refs(e.lineup, ids);
    });
    replay(m);
  });
  return d;
}
const text = z.string().trim().min(1).max(4000);
const texts = z.array(text).min(1).max(20);
export const adviceSchema = z.object({
  judgment: text,
  priority: text,
  execution: text,
  evidence: texts,
  risks: texts,
  alternatives: texts,
  missing: texts,
  action: z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("sub"),
        out: z.string().min(1),
        in: z.string().min(1),
      }),
      z.object({ type: z.literal("formation"), formation: formationSchema }),
    ])
    .optional(),
});
