import { it, expect } from "vitest";
import {
  appendEvent,
  assign,
  makeLineup,
  replay,
  reviseEvent,
  seconds,
  validateStart,
} from "../src/domain";
import type { Match, MatchEvent } from "../src/types";
import players from "../players.json";
export function fixture(): Match {
  let initial = makeLineup("4-3-3");
  players.slice(0, 11).forEach((p, i) => (initial = assign(initial, i, p.id)));
  return {
    id: "m",
    opponent: "测试",
    date: "2026-10-17",
    duration: 90,
    subLimit: 2,
    reentry: false,
    players,
    initial,
    events: [],
    elapsed: 120,
    runningSince: null,
    status: "live",
  };
}
function ev(
  kind: MatchEvent["kind"],
  extra: Partial<MatchEvent> = {},
): MatchEvent {
  return { id: crypto.randomUUID(), kind, minute: 2, text: "测试", ...extra };
}
it("计时在刷新后按绝对时间恢复", () =>
  expect(seconds({ ...fixture(), runningSince: 1000 }, 4000)).toBe(123));
it("两黄罚下且不能替换红牌球员", () => {
  let m = fixture();
  m = appendEvent(m, ev("yellow", { playerId: "p01" }));
  m = appendEvent(m, ev("yellow", { playerId: "p01" }));
  expect(replay(m).lineup.slots.filter((s) => s.playerId)).toHaveLength(10);
  expect(() =>
    appendEvent(m, ev("sub", { playerId: "p01", incoming: "p12" })),
  ).toThrow();
});
it("撤销换人同时恢复阵容及次数", () => {
  let m = appendEvent(
    fixture(),
    ev("sub", { playerId: "p01", incoming: "p12" }),
  );
  expect(replay(m).remaining).toBe(1);
  m = reviseEvent(m, m.events[0].id, { void: true });
  expect(replay(m).remaining).toBe(2);
  expect(replay(m).lineup.slots[0].playerId).toBe("p01");
});
it("禁止重复上场及超限换人", () => {
  const m = appendEvent(
    fixture(),
    ev("sub", { playerId: "p01", incoming: "p12" }),
  );
  expect(() =>
    appendEvent(m, ev("sub", { playerId: "p12", incoming: "p01" })),
  ).toThrow();
  expect(() =>
    appendEvent(
      { ...m, subLimit: 1 },
      ev("sub", { playerId: "p02", incoming: "p13" }),
    ),
  ).toThrow();
});
it("允许校园赛再入场", () => {
  let m = appendEvent(
    { ...fixture(), reentry: true },
    ev("sub", { playerId: "p01", incoming: "p12" }),
  );
  m = appendEvent(m, ev("sub", { playerId: "p12", incoming: "p01" }));
  expect(replay(m).lineup.slots[0].playerId).toBe("p01");
});
it("不能撤销被后续换人依赖的事件", () => {
  let m = appendEvent(
    fixture(),
    ev("sub", { playerId: "p01", incoming: "p12" }),
  );
  m = appendEvent(m, ev("sub", { playerId: "p12", incoming: "p13" }));
  expect(() => reviseEvent(m, m.events[0].id, { void: true })).toThrow();
});
it("结束后拒绝新增事件，允许修正", () => {
  let m = appendEvent(fixture(), ev("goal", { side: "home" }));
  m = { ...m, status: "ended" };
  expect(() => appendEvent(m, ev("goal"))).toThrow();
  expect(replay(reviseEvent(m, m.events[0].id, { void: true })).score).toEqual([
    0, 0,
  ]);
});
it("变阵不能偷偷换人", () => {
  const m = fixture();
  expect(() =>
    appendEvent(m, ev("tactic", { lineup: assign(m.initial, 0, "p12") })),
  ).toThrow();
});
it("开赛拒绝空阵容或不可用球员", () => {
  expect(() => validateStart(players, makeLineup("4-3-3"))).toThrow();
  expect(() =>
    validateStart(
      players.map((p) => ({ ...p, available: false })),
      fixture().initial,
    ),
  ).toThrow();
});
