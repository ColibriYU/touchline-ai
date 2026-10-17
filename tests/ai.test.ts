import { it, expect } from "vitest";
import { adviceSchema, validateData } from "../src/validation";
import { context, applyAdvice } from "../src/ai";
import { makeLineup, assign, replay } from "../src/domain";
import type { Match, AIAdvice } from "../src/types";
import players from "../players.json";
const advice: AIAdvice = {
  judgment: "判断",
  priority: "换人",
  execution: "执行",
  evidence: ["资料"],
  risks: ["风险"],
  alternatives: ["备选"],
  missing: ["缺失"],
  action: { type: "sub", out: "p01", in: "p12" },
};
function match(): Match {
  let initial = makeLineup("4-3-3");
  players.slice(0, 11).forEach((p, i) => (initial = assign(initial, i, p.id)));
  return {
    id: "m",
    opponent: "测试",
    date: "2026-10-17",
    duration: 90,
    subLimit: 5,
    reentry: false,
    players,
    initial,
    events: [],
    elapsed: 0,
    runningSince: null,
    status: "live",
  };
}
it("AI输入完整且不把容易受伤转为本场伤病", () => {
  const m = match();
  const c = context(players, m.initial, m);
  expect(c.players).toEqual(players);
  expect(c.status?.injury).toEqual({});
  expect(c.bench).toHaveLength(6);
  expect(c.remainingSubstitutions).toBe(5);
});
it("建议生成不改变原比赛，显式采纳才产生换人", () => {
  const m = match();
  const next = applyAdvice(m, advice);
  expect(m.events).toHaveLength(0);
  expect(next.events).toHaveLength(1);
  expect(replay(next).remaining).toBe(4);
});
it("采纳非法建议必须失败", () =>
  expect(() => applyAdvice({ ...match(), subLimit: 0 }, advice)).toThrow());
it("AI返回必须符合七项结构，拒绝任意操作", () => {
  expect(adviceSchema.safeParse({ judgment: "好" }).success).toBe(false);
  expect(
    adviceSchema.safeParse({ ...advice, action: { type: "delete" } }).success,
  ).toBe(false);
});
it("导入拒绝伪造引用，不覆盖现有状态", () => {
  expect(() =>
    validateData({
      version: 1,
      players,
      lineup: assign(makeLineup("4-3-3"), 0, "不存在"),
      matches: [],
    }),
  ).toThrow();
});
