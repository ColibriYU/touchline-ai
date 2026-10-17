import { describe, it, expect } from "vitest";
import { assign, makeLineup, validatePlayers } from "../src/domain";
import players from "../players.json";
describe("球员及阵容", () => {
  it("保留全部17名原始球员且不虚构状态", () => {
    expect(validatePlayers(players)).toEqual(players);
    expect(players).toHaveLength(17);
  });
  it("调整首发不会重复球员", () => {
    let l = assign(makeLineup("4-3-3"), 0, "p01");
    l = assign(l, 1, "p01");
    expect(l.slots.filter((s) => s.playerId === "p01")).toHaveLength(1);
  });
  it("变阵保留全部首发", () => {
    let l = makeLineup("4-3-3");
    players.slice(0, 11).forEach((p, i) => (l = assign(l, i, p.id)));
    expect(
      makeLineup("4-2-3-1", l).slots.filter((s) => s.playerId),
    ).toHaveLength(11);
  });
  it("拒绝重复球员ID", () =>
    expect(() => validatePlayers([players[0], players[0]])).toThrow());
});
