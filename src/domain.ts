import { z } from "zod";
import type { Formation, Lineup, Player, Match, MatchEvent } from "./types";
export const formations: Formation[] = ["4-3-3", "4-2-3-1", "4-4-2"];
export function makeLineup(formation: Formation, previous?: Lineup): Lineup {
  const rows =
    formation === "4-3-3"
      ? [
          ["LW", "ST", "RW"],
          ["CM", "CDM", "CM"],
          ["LB", "CB", "CB", "RB"],
          ["GK"],
        ]
      : formation === "4-2-3-1"
        ? [
            ["ST"],
            ["LW", "CAM", "RW"],
            ["CDM", "CDM"],
            ["LB", "CB", "CB", "RB"],
            ["GK"],
          ]
        : [
            ["ST", "ST"],
            ["LM", "CM", "CM", "RM"],
            ["LB", "CB", "CB", "RB"],
            ["GK"],
          ];
  const slots = rows.flatMap((row, r) =>
    row.map((role, c) => ({
      role,
      x: ((c + 1) * 100) / (row.length + 1),
      y: 15 + (r * 75) / (rows.length - 1),
      playerId: null as string | null,
    })),
  );
  const remaining = previous?.slots.filter((s) => s.playerId).slice() ?? [];
  slots.forEach((s) => {
    const i = remaining.findIndex((p) => p.role === s.role);
    if (i >= 0) s.playerId = remaining.splice(i, 1)[0].playerId;
  });
  slots
    .filter((s) => !s.playerId)
    .forEach((s) => {
      s.playerId = remaining.shift()?.playerId ?? null;
    });
  return { formation, slots };
}
export const playerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  positions: z.array(z.string()),
  preferredPosition: z.string().nullable(),
  foot: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  notes: z.array(z.string()),
  selectionPriority: z.string(),
  available: z.boolean().nullable().optional(),
  injury: z.string().nullable().optional(),
  fatigue: z.string().nullable().optional(),
  number: z.string().optional(),
});
export function validatePlayers(input: unknown): Player[] {
  const ps = z.array(playerSchema).max(100).parse(input);
  if (new Set(ps.map((p) => p.id)).size !== ps.length)
    throw Error("球员编号重复");
  return ps;
}
export function assign(
  lineup: Lineup,
  index: number,
  id: string | null,
): Lineup {
  return {
    ...lineup,
    slots: lineup.slots.map((s, i) => ({
      ...s,
      playerId: i === index ? id : s.playerId === id ? null : s.playerId,
    })),
  };
}
export function seconds(m: Match, now = Date.now()) {
  return (
    m.elapsed +
    (m.runningSince === null ? 0 : Math.max(0, (now - m.runningSince) / 1000))
  );
}
export function freezeMatch(m: Match, now = Date.now()): Match {
  return { ...m, elapsed: seconds(m, now), runningSince: null };
}
export function replay(m: Match) {
  let lineup = structuredClone(m.initial);
  let score: [number, number] = [0, 0];
  let used = 0;
  const yellow: Record<string, number> = {},
    red = new Set<string>(),
    left = new Set<string>();
  const injury: Record<string, string> = {},
    fatigue: Record<string, string> = {};
  m.players.forEach((p) => {
    if (p.injury) injury[p.id] = p.injury;
    if (p.fatigue) fatigue[p.id] = p.fatigue;
  });
  for (const e of m.events.filter((e) => !e.void)) {
    if (e.kind === "goal") score[e.side === "away" ? 1 : 0]++;
    if (e.kind === "score" && e.score) score = [...e.score];
    if (e.kind === "yellow" && e.playerId) {
      yellow[e.playerId] = (yellow[e.playerId] ?? 0) + 1;
      if (yellow[e.playerId] >= 2) red.add(e.playerId);
    }
    if (e.kind === "red" && e.playerId) red.add(e.playerId);
    if ((e.kind === "injury" || e.kind === "fatigue") && e.playerId)
      (e.kind === "injury" ? injury : fatigue)[e.playerId] = e.text;
    if (e.kind === "sub") {
      const out = e.playerId!,
        incoming = e.incoming!;
      const idx = lineup.slots.findIndex((s) => s.playerId === out);
      if (idx < 0 || red.has(out)) throw Error("换下球员不在场或已被罚下");
      if (used >= m.subLimit) throw Error("已无可用换人次数");
      if (
        !m.players.some((p) => p.id === incoming && p.available !== false) ||
        red.has(incoming) ||
        lineup.slots.some((s) => s.playerId === incoming)
      )
        throw Error("换上球员不可用");
      if (!m.reentry && left.has(incoming))
        throw Error("本场不允许换下球员再次出场");
      lineup = assign(lineup, idx, incoming);
      left.add(out);
      used++;
    }
    if (e.kind === "tactic" && e.lineup) {
      const before = lineup.slots
        .flatMap((s) => (s.playerId ? [s.playerId] : []))
        .sort()
        .join(",");
      const after = e.lineup.slots
        .flatMap((s) => (s.playerId ? [s.playerId] : []))
        .sort()
        .join(",");
      if (before !== after) throw Error("战术调整不能增加或替换场上球员");
      lineup = structuredClone(e.lineup);
    }
    lineup.slots.forEach((s) => {
      if (s.playerId && red.has(s.playerId)) s.playerId = null;
    });
  }
  return {
    lineup,
    score,
    used,
    remaining: m.subLimit - used,
    yellow,
    red,
    left,
    injury,
    fatigue,
  };
}
export function appendEvent(m: Match, e: MatchEvent): Match {
  if (m.status === "ended") throw Error("比赛已结束");
  const next = { ...m, events: [...m.events, e] };
  replay(next);
  return next;
}
export function reviseEvent(
  m: Match,
  id: string,
  patch: Partial<MatchEvent>,
): Match {
  const next = {
    ...m,
    events: m.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  };
  replay(next);
  return next;
}
export function validateStart(players: Player[], lineup: Lineup) {
  const ids = lineup.slots.map((s) => s.playerId);
  if (ids.some((id) => !id) || new Set(ids).size !== 11)
    throw Error("请先安排11名不同的首发球员");
  if (
    ids.some((id) => !players.some((p) => p.id === id && p.available !== false))
  )
    throw Error("首发包含不可出场球员");
}
