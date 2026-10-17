import { appendEvent, assign, makeLineup, replay, seconds } from "./domain";
import type { AIAdvice, Lineup, Match, Player } from "./types";
export function applyPrematchAdvice(
  players: Player[],
  lineup: Lineup,
  advice: AIAdvice,
): Lineup {
  const a = advice.action;
  if (!a) throw Error("没有可执行操作");
  if (a.type === "formation") return makeLineup(a.formation, lineup);
  const index = lineup.slots.findIndex((s) => s.playerId === a.out);
  if (
    index < 0 ||
    lineup.slots.some((s) => s.playerId === a.in) ||
    !players.some((p) => p.id === a.in && p.available !== false)
  )
    throw Error("建议球员不可用，请重新分析");
  return assign(lineup, index, a.in);
}
export function context(players: Player[], lineup: Lineup, match?: Match) {
  const s = match ? replay(match) : null;
  const current = s?.lineup ?? lineup;
  return {
    mode: match ? "live" : "prematch",
    players: match?.players ?? players,
    lineup: current,
    starters: current.slots.filter((s) => s.playerId),
    bench: (match?.players ?? players).filter(
      (p) => !current.slots.some((s) => s.playerId === p.id),
    ),
    score: s?.score ?? null,
    minute: match ? Math.floor(seconds(match) / 60) : null,
    formation: current.formation,
    remainingSubstitutions: s?.remaining ?? null,
    substitutionRules: match
      ? { limit: match.subLimit, reentry: match.reentry }
      : null,
    status: s
      ? {
          yellow: s.yellow,
          red: [...s.red],
          injury: s.injury,
          fatigue: s.fatigue,
          left: [...s.left],
        }
      : null,
    events: match?.events.filter((e) => !e.void) ?? [],
    unknowns: "未提供的能力、伤病、疲劳与历史比赛均未知，不能推测为无或正常。",
  };
}
export function applyAdvice(m: Match, advice: AIAdvice): Match {
  if (!advice.action) throw Error("这条建议没有可自动执行的操作");
  const a = advice.action;
  return appendEvent(m, {
    id: crypto.randomUUID(),
    minute: Math.floor(seconds(m) / 60),
    kind: a.type === "sub" ? "sub" : "tactic",
    text: `采纳AI建议：${advice.priority}`,
    playerId: a.type === "sub" ? a.out : undefined,
    incoming: a.type === "sub" ? a.in : undefined,
    lineup:
      a.type === "formation"
        ? makeLineup(a.formation, replay(m).lineup)
        : undefined,
  });
}
