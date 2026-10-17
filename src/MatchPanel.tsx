import { useEffect, useState } from "react";
import type { AppData, Match, MatchEvent } from "./types";
import {
  appendEvent,
  formations,
  makeLineup,
  replay,
  reviseEvent,
  seconds,
  validateStart,
  freezeMatch,
} from "./domain";
import { Pitch } from "./Pitch";
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const labels: Record<string, string> = {
  goal: "进球",
  yellow: "黄牌",
  red: "红牌",
  injury: "受伤",
  fatigue: "疲劳",
  problem: "场上问题",
  sub: "换人",
  tactic: "战术调整",
  score: "比分校正",
  note: "教练记录",
};
export default function MatchPanel({
  data,
  update,
  notify,
  review = false,
  renderAI,
}: {
  data: AppData;
  update: (d: AppData) => void;
  notify: (s: string) => void;
  review?: boolean;
  renderAI?: (m: Match, onUpdate: (m: Match) => void) => React.ReactNode;
}) {
  const [selected, setSelected] = useState(data.matches[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [player, setPlayer] = useState("");
  const [incoming, setIncoming] = useState("");
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState<MatchEvent | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const m = data.matches.find((x) => x.id === selected);
  const state = m ? replay(m) : null;
  function save(next: Match) {
    update({
      ...data,
      matches: data.matches.map((x) => (x.id === next.id ? next : x)),
    });
  }
  function event(kind: MatchEvent["kind"], extra: Partial<MatchEvent> = {}) {
    if (!m) return;
    try {
      save(
        appendEvent(m, {
          id: crypto.randomUUID(),
          minute: Math.floor(seconds(m) / 60),
          kind,
          text: reason || labels[kind],
          ...extra,
        }),
      );
      setReason("");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <div className="toolbar">
        <select
          aria-label="选择比赛"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">选择比赛</option>
          {data.matches.map((x) => (
            <option key={x.id} value={x.id}>
              {x.date} · vs {x.opponent}
              {x.status === "ended" ? " · 已结束" : ""}
            </option>
          ))}
        </select>
        {!review && (
          <button className="primary" onClick={() => setCreating(true)}>
            ＋ 创建比赛
          </button>
        )}
      </div>
      {creating && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              if (data.matches.some((m) => m.status !== "ended"))
                throw Error("请先结束已有比赛");
              validateStart(data.players, data.lineup);
              const f = new FormData(e.currentTarget);
              const match: Match = {
                id: crypto.randomUUID(),
                opponent: String(f.get("opponent")).trim(),
                date: String(f.get("date")),
                duration: Number(f.get("duration")),
                subLimit: Number(f.get("limit")),
                reentry: f.get("reentry") === "on",
                players: structuredClone(data.players),
                initial: structuredClone(data.lineup),
                events: [],
                elapsed: 0,
                runningSince: null,
                status: "ready",
              };
              update({ ...data, matches: [match, ...data.matches] });
              setSelected(match.id);
              setCreating(false);
            } catch (e) {
              notify((e as Error).message);
            }
          }}
        >
          <h2>比赛设置</h2>
          <p className="muted">
            创建时保存当前首发和球员状态。未知状态会如实保留；请先在球员档案确认出场情况。
          </p>
          <div className="form-grid">
            <label>
              对手
              <input name="opponent" required maxLength={80} />
            </label>
            <label>
              日期
              <input
                type="date"
                name="date"
                required
                defaultValue={new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Shanghai",
                }).format(new Date())}
              />
            </label>
            <label>
              总时长（分钟）
              <input
                name="duration"
                type="number"
                min="1"
                max="180"
                defaultValue="90"
                required
              />
            </label>
            <label>
              允许换人总次数
              <input
                name="limit"
                type="number"
                min="0"
                max="99"
                defaultValue="5"
                required
              />
            </label>
          </div>
          <label className="checkbox">
            <input type="checkbox" name="reentry" />{" "}
            允许换下球员再次上场（校园赛自定义规则）
          </label>
          <div className="toolbar">
            <button className="primary">保存并进入比赛</button>
            <button type="button" onClick={() => setCreating(false)}>
              取消
            </button>
          </div>
        </form>
      )}
      {m && state ? (
        <>
          <section className="scoreboard">
            <div className="eyebrow">
              {m.status === "ended"
                ? "FULL TIME"
                : m.runningSince
                  ? "LIVE MATCH"
                  : "MATCH DAY"}{" "}
              · {m.date}
            </div>
            <div className="scoreline">
              <span>我方</span>
              <strong>
                {state.score[0]} : {state.score[1]}
              </strong>
              <span>{m.opponent}</span>
            </div>
            <div className="clock">
              {Math.floor(seconds(m, now) / 60)
                .toString()
                .padStart(2, "0")}
              <span>:</span>
              {Math.floor(seconds(m, now) % 60)
                .toString()
                .padStart(2, "0")}
            </div>
            <p>
              {state.lineup.formation} · 剩余换人 {state.remaining} 次 · 总时长{" "}
              {m.duration} 分钟
              {seconds(m, now) > m.duration * 60 ? " · 已进入补时" : ""}
            </p>
            {m.status !== "ended" && !review && (
              <div className="toolbar justify-center">
                <button
                  className="primary"
                  onClick={() => {
                    save({
                      ...m,
                      status: "live",
                      elapsed: seconds(m),
                      runningSince: m.runningSince ? null : Date.now(),
                    });
                    setNow(Date.now());
                  }}
                >
                  {m.runningSince ? "暂停计时" : "开始 / 继续"}
                </button>
                <button
                  onClick={() => {
                    const v = prompt(
                      "校正比赛时间（分钟，可含小数）",
                      String(Math.floor(seconds(m) / 60)),
                    );
                    if (v === null) return;
                    const n = Number(v);
                    if (!v.trim() || !Number.isFinite(n) || n < 0 || n > 300)
                      return notify("请输入0至300分钟");
                    save({
                      ...m,
                      elapsed: n * 60,
                      runningSince: m.runningSince ? Date.now() : null,
                      events: [
                        ...m.events,
                        {
                          id: crypto.randomUUID(),
                          minute: n,
                          kind: "note",
                          text: `校正时间：${Math.floor(seconds(m) / 60)} → ${n} 分钟`,
                        },
                      ],
                    });
                  }}
                >
                  校正时间
                </button>
                <button
                  onClick={() => {
                    if (confirm("结束比赛并保存复盘？"))
                      save({
                        ...m,
                        status: "ended",
                        elapsed: seconds(m),
                        runningSince: null,
                      });
                  }}
                >
                  结束比赛
                </button>
              </div>
            )}
          </section>
          {m.status !== "ended" && !review && (
            <>
              <div className="workspace">
                <section>
                  <h2>场边快速记录</h2>
                  <div className="toolbar">
                    <button
                      onClick={() =>
                        event("goal", {
                          side: "home",
                          playerId: player || undefined,
                        })
                      }
                    >
                      我方 ＋1
                    </button>
                    <button onClick={() => event("goal", { side: "away" })}>
                      对手 ＋1
                    </button>
                    <button
                      onClick={() => {
                        const v = prompt(
                          "输入比分，例如 2:1",
                          state.score.join(":"),
                        );
                        if (!v) return;
                        if (!/^\d{1,2}:\d{1,2}$/.test(v))
                          return notify("比分格式应为 2:1");
                        event("score", {
                          score: v.split(":").map(Number) as [number, number],
                          text: "手动校正比分",
                        });
                      }}
                    >
                      修正比分
                    </button>
                  </div>
                  <label>
                    事件关联球员
                    <select
                      value={player}
                      onChange={(e) => setPlayer(e.target.value)}
                    >
                      <option value="">选择球员（进球可未知）</option>
                      {m.players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {state.red.has(p.id) ? " · 已罚下" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    原因 / 状态 / 补充说明
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="例如：右路连续被二打一"
                    />
                  </label>
                  <div className="quick-grid">
                    {(["yellow", "red", "injury", "fatigue"] as const).map(
                      (k) => (
                        <button
                          key={k}
                          disabled={!player}
                          onClick={() => event(k, { playerId: player })}
                        >
                          {labels[k]}
                        </button>
                      ),
                    )}
                  </div>
                  <h3>一键标记场上问题</h3>
                  <div className="quick-grid">
                    {["边路被打穿", "中场失控", "出球困难", "进攻乏力"].map(
                      (text) => (
                        <button
                          key={text}
                          onClick={() =>
                            event("problem", {
                              text: reason ? `${text}：${reason}` : text,
                            })
                          }
                        >
                          {text}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    className="mt-3"
                    disabled={!reason.trim()}
                    onClick={() => event("note")}
                  >
                    保存教练记录
                  </button>
                </section>
                <section>
                  <h2>换人与战术调整</h2>
                  <p className="muted">
                    换人次数按每次球员替换计算。两黄视为红牌；罚下后不能补人。
                  </p>
                  <label>
                    换下
                    <select
                      value={player}
                      onChange={(e) => setPlayer(e.target.value)}
                    >
                      <option value="">选择场上球员</option>
                      {state.lineup.slots
                        .filter((s) => s.playerId)
                        .map((s) => (
                          <option key={s.playerId} value={s.playerId!}>
                            {m.players.find((p) => p.id === s.playerId)?.name} ·{" "}
                            {s.role}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    换上
                    <select
                      value={incoming}
                      onChange={(e) => setIncoming(e.target.value)}
                    >
                      <option value="">选择可用替补</option>
                      {m.players
                        .filter(
                          (p) =>
                            p.available !== false &&
                            !state.red.has(p.id) &&
                            !state.lineup.slots.some(
                              (s) => s.playerId === p.id,
                            ) &&
                            (m.reentry || !state.left.has(p.id)),
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.positions.join("/") || "位置未知"}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    className="primary w-full"
                    disabled={!player || !incoming || !reason.trim()}
                    onClick={() => event("sub", { playerId: player, incoming })}
                  >
                    确认换人（先填写原因）
                  </button>
                  <label className="mt-5">
                    变更阵型
                    <select
                      value={state.lineup.formation}
                      onChange={(e) => {
                        if (!reason.trim())
                          return notify("请先填写战术调整原因");
                        event("tactic", {
                          lineup: makeLineup(
                            e.target.value as typeof state.lineup.formation,
                            state.lineup,
                          ),
                        });
                      }}
                    >
                      {formations.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                </section>
              </div>
              <section className="mt-5">
                <h2>当前站位</h2>
                <p className="muted">
                  填写原因后拖动；每次松手保存一条战术调整。
                </p>
                <div className="small-pitch">
                  <Pitch
                    lineup={state.lineup}
                    players={m.players}
                    onChange={(lineup) => {
                      if (!reason.trim()) return notify("请先填写站位调整原因");
                      event("tactic", { lineup });
                    }}
                  />
                </div>
              </section>
              {renderAI?.(m, save)}
            </>
          )}
          <section className="mt-5">
            <div className="section-head">
              <h2>比赛事件与复盘</h2>
              <button
                onClick={() => {
                  download(`比赛-${m.date}-${m.opponent}.json`, {
                    version: 1,
                    match: freezeMatch(m),
                    result: { score: state.score, lineup: state.lineup },
                  });
                  notify("已导出单场比赛");
                }}
              >
                导出本场
              </button>
            </div>
            <p className="muted">
              首发：
              {m.initial.slots
                .map(
                  (s) =>
                    `${s.role} ${m.players.find((p) => p.id === s.playerId)?.name ?? "空缺"}`,
                )
                .join(" · ")}
            </p>
            {!m.events.length && (
              <p className="empty">哨声未响，记录从这里开始。</p>
            )}
            <div className="timeline">
              {m.events
                .slice()
                .reverse()
                .map((e) => (
                  <div className={`event ${e.void ? "void" : ""}`} key={e.id}>
                    <strong>{e.minute}′</strong>
                    <div>
                      <b>{labels[e.kind]}</b>
                      <p>
                        {e.playerId &&
                          `${m.players.find((p) => p.id === e.playerId)?.name} `}
                        {e.incoming &&
                          `→ ${m.players.find((p) => p.id === e.incoming)?.name} `}
                        {e.side === "away" ? "对手 · " : ""}
                        {e.text}
                        {e.void ? "（已撤销）" : ""}
                      </p>
                    </div>
                    <div className="event-actions">
                      <button onClick={() => setEditing({ ...e })}>修正</button>
                      <button
                        onClick={() => {
                          try {
                            save(reviseEvent(m, e.id, { void: !e.void }));
                          } catch (err) {
                            notify(
                              "无法撤销/恢复：" +
                                (err as Error).message +
                                "，请先处理后续相关事件",
                            );
                          }
                        }}
                      >
                        {e.void ? "恢复" : "撤销"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </>
      ) : (
        <section className="empty">
          <h2>{review ? "尚无比赛可复盘" : "准备好迎接下一场比赛了吗？"}</h2>
          <p>先在战术板安排11名首发，再创建比赛。</p>
        </section>
      )}
      {editing && m && (
        <div className="overlay">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                save(reviseEvent(m, editing.id, editing));
                setEditing(null);
              } catch (err) {
                notify((err as Error).message);
              }
            }}
          >
            <h2>修正事件</h2>
            <p className="muted">
              时间与备注可修正；如球员或事件类型有误，请撤销并重新记录。回放顺序依照记录顺序。
            </p>
            <label>
              分钟
              <input
                type="number"
                min="0"
                max="300"
                step="0.1"
                required
                value={editing.minute}
                onChange={(e) =>
                  setEditing({ ...editing, minute: Number(e.target.value) })
                }
              />
            </label>
            <label>
              说明
              <input
                required
                value={editing.text}
                onChange={(e) =>
                  setEditing({ ...editing, text: e.target.value })
                }
              />
            </label>
            <button className="primary">保存修正</button>{" "}
            <button type="button" onClick={() => setEditing(null)}>
              取消
            </button>
          </form>
        </div>
      )}
    </>
  );
}
