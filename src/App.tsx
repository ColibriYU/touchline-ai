import { Pitch } from "./Pitch";
import { useEffect, useRef, useState } from "react";
import type { AppData, Lineup, Player } from "./types";
import { assign, formations, makeLineup, validatePlayers } from "./domain";
import { readData, saveData } from "./storage";
import MatchPanel from "./MatchPanel";
import AdvicePanel from "./AdvicePanel";
import DataPanel from "./DataPanel";
import { validateData } from "./validation";
export default function App() {
  const [online, setOnline] = useState(navigator.onLine);
  const [refresh, setRefresh] = useState<(() => void) | null>(null);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    const upd = (e: Event) => setRefresh(() => (e as CustomEvent).detail);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("touchline-update", upd);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("touchline-update", upd);
    };
  }, []);
  const [data, setData] = useState<AppData>();
  const [tab, setTab] = useState("阵容");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<Player | null>(null);
  useEffect(() => {
    readData()
      .then(async (stored) => {
        const loaded = stored
          ? validateData(stored)
          : {
              version: 1 as const,
              players: validatePlayers(
                await (await fetch("/players.json")).json(),
              ),
              lineup: makeLineup("4-3-3"),
              matches: [],
            };
        await saveData(loaded);
        setData(loaded);
      })
      .catch((e) => setMessage("读取失败：" + e.message));
  }, []);
  const queue = useRef(Promise.resolve());
  function update(next: AppData) {
    setData(next);
    queue.current = queue.current
      .then(() => saveData(next))
      .then(() => setMessage("已保存到此设备"))
      .catch(() => setMessage("保存失败，请立即导出备份"));
  }
  if (!data)
    return (
      <main>
        <h1>Touchline AI</h1>
        <p>{message || "正在载入本地球员库…"}</p>
      </main>
    );
  const lineup = data.lineup;
  return (
    <>
      <header>
        <div className="brand">
          T
          <span>
            {" "}
            TOUCHLINE <b>AI</b>
          </span>
        </div>
        <span className="badge">校园足球 · 教练工作台</span>
      </header>
      <main>
        <div className="eyebrow">YOUR TEAM. YOUR CALL.</div>
        <h1>{tab === "球员" ? "了解每一位球员" : "从阵容开始，掌控比赛。"}</h1>
        <p className="muted">11人制足球 / 本地优先 / 教练拥有最终决定权</p>
        <nav>
          {["阵容", "球员", "比赛", "复盘", "数据"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
              key={t}
            >
              {t}
            </button>
          ))}
        </nav>
        {!online && (
          <p className="offline">离线模式 · 比赛记录可用，AI暂不可用</p>
        )}
        {refresh && (
          <button onClick={refresh}>发现新版本，点击更新（将刷新页面）</button>
        )}
        <div className="toast" role="status">
          {message || "准备就绪 · 拖动球员调整站位"}
        </div>
        {tab === "数据" ? (
          <DataPanel data={data} update={update} notify={setMessage} />
        ) : tab === "比赛" || tab === "复盘" ? (
          <MatchPanel
            data={data}
            update={update}
            notify={setMessage}
            review={tab === "复盘"}
            renderAI={(m, save) => (
              <AdvicePanel
                key={m.id}
                players={m.players}
                lineup={m.initial}
                match={m}
                onMatch={save}
                notify={setMessage}
              />
            )}
          />
        ) : tab === "阵容" ? (
          <div className="workspace">
            <section>
              <div className="section-head">
                <h2>赛前战术板</h2>
                <select
                  aria-label="阵型"
                  value={lineup.formation}
                  onChange={(e) =>
                    update({
                      ...data,
                      lineup: makeLineup(
                        e.target.value as Lineup["formation"],
                        lineup,
                      ),
                    })
                  }
                >
                  {formations.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
              <Pitch
                lineup={lineup}
                players={data.players}
                onChange={(l) => update({ ...data, lineup: l })}
              />
            </section>
            <section>
              <h2>
                首发名单{" "}
                <small>
                  {lineup.slots.filter((s) => s.playerId).length}/11
                </small>
              </h2>
              <p className="muted">
                选择球员后可在球场上拖动。位置不匹配会提示。
              </p>
              {lineup.slots.map((s, i) => (
                <div className="slot" key={i}>
                  <span>{s.role}</span>
                  <select
                    aria-label={`位置${i + 1} ${s.role}`}
                    value={s.playerId ?? ""}
                    onChange={(e) =>
                      update({
                        ...data,
                        lineup: assign(lineup, i, e.target.value || null),
                      })
                    }
                  >
                    <option value="">待安排</option>
                    {data.players
                      .filter((p) => p.available !== false)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.positions.join("/") || "位置未知"}
                        </option>
                      ))}
                  </select>
                  {s.playerId &&
                    !data.players
                      .find((p) => p.id === s.playerId)
                      ?.positions.includes(s.role) && (
                      <small className="warn">需确认适配</small>
                    )}
                </div>
              ))}
              <h3>替补 / 未安排</h3>
              <div className="chips">
                {data.players
                  .filter((p) => !lineup.slots.some((s) => s.playerId === p.id))
                  .map((p) => (
                    <span key={p.id}>
                      {p.name}
                      {p.available === false ? " · 不可出场" : ""}
                    </span>
                  ))}
              </div>
            </section>
            <div className="full-width">
              <AdvicePanel
                players={data.players}
                lineup={lineup}
                onLineup={(l) => update({ ...data, lineup: l })}
                notify={setMessage}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="toolbar">
              <input
                placeholder="搜索姓名、优势或弱点"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label="位置筛选"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">所有位置</option>
                {Array.from(
                  new Set(data.players.flatMap((p) => p.positions)),
                ).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <button
                className="primary"
                onClick={() =>
                  setEdit({
                    id: crypto.randomUUID(),
                    name: "",
                    positions: [],
                    preferredPosition: null,
                    foot: "unknown",
                    strengths: [],
                    weaknesses: [],
                    notes: [],
                    selectionPriority: "unknown",
                  })
                }
              >
                ＋ 添加球员
              </button>
            </div>
            <div className="cards">
              {data.players
                .filter(
                  (p) =>
                    JSON.stringify(p).includes(query) &&
                    (!filter || p.positions.includes(filter)),
                )
                .map((p) => (
                  <article key={p.id}>
                    <div className="section-head">
                      <h2>{p.name}</h2>
                      <span className="badge">
                        {p.positions.join(" / ") || "位置待确认"}
                      </span>
                    </div>
                    <p>优势：{p.strengths.join("、") || "暂无资料"}</p>
                    <p className="muted">
                      弱点：{p.weaknesses.join("、") || "暂无资料"}
                    </p>
                    <p className="muted">{p.notes.join("；")}</p>
                    <button onClick={() => setEdit(structuredClone(p))}>
                      编辑档案
                    </button>
                  </article>
                ))}
            </div>
          </>
        )}
        {edit && (
          <div className="overlay">
            <form
              className="modal"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const cleaned = { ...edit };
                  (
                    ["positions", "strengths", "weaknesses", "notes"] as const
                  ).forEach((k) => {
                    cleaned[k] = cleaned[k]
                      .map((v) => v.trim())
                      .filter(Boolean);
                  });
                  const p = validatePlayers([cleaned])[0];
                  update({
                    ...data,
                    players: [...data.players.filter((x) => x.id !== p.id), p],
                  });
                  setEdit(null);
                } catch {
                  setMessage("请填写有效姓名");
                }
              }}
            >
              <h2>球员档案</h2>
              {(
                [
                  "name",
                  "number",
                  "positions",
                  "preferredPosition",
                  "strengths",
                  "weaknesses",
                  "notes",
                  "injury",
                  "fatigue",
                ] as const
              ).map((key, i) => (
                <label key={key}>
                  {
                    [
                      "姓名",
                      "球衣号码",
                      "可踢位置（逗号分隔）",
                      "主要位置（未知留空）",
                      "优势（逗号分隔）",
                      "弱点（逗号分隔）",
                      "备注（逗号分隔）",
                      "本场伤病（未知留空）",
                      "本场疲劳（未知留空）",
                    ][i]
                  }
                  <input
                    required={key === "name"}
                    value={
                      Array.isArray(edit[key])
                        ? (edit[key] as string[]).join("，")
                        : (edit[key] ?? "")
                    }
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        [key]: [
                          "positions",
                          "strengths",
                          "weaknesses",
                          "notes",
                        ].includes(key)
                          ? e.target.value.split(/[,，]/)
                          : key === "number"
                            ? e.target.value
                            : e.target.value || null,
                      })
                    }
                  />
                </label>
              ))}
              <label>
                惯用脚
                <select
                  value={edit.foot}
                  onChange={(e) => setEdit({ ...edit, foot: e.target.value })}
                >
                  {Object.entries({
                    unknown: "未知",
                    right: "右脚",
                    left: "左脚",
                    both: "双脚",
                    both_right_dominant: "双脚（右脚为主）",
                  }).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                出场优先级
                <select
                  value={edit.selectionPriority}
                  onChange={(e) =>
                    setEdit({ ...edit, selectionPriority: e.target.value })
                  }
                >
                  {Object.entries({
                    normal: "正常",
                    backup: "替补",
                    emergency: "应急",
                    unknown: "未知",
                  }).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                本场可出场
                <select
                  value={
                    edit.available == null ? "unknown" : String(edit.available)
                  }
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      available:
                        e.target.value === "unknown"
                          ? null
                          : e.target.value === "true",
                    })
                  }
                >
                  <option value="unknown">待确认</option>
                  <option value="true">可以</option>
                  <option value="false">不可以</option>
                </select>
              </label>
              <div className="toolbar">
                <button className="primary">保存档案</button>
                <button type="button" onClick={() => setEdit(null)}>
                  取消
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (confirm("删除该球员？历史比赛快照仍会保留。")) {
                      update({
                        ...data,
                        players: data.players.filter((p) => p.id !== edit.id),
                        lineup: {
                          ...lineup,
                          slots: lineup.slots.map((s) => ({
                            ...s,
                            playerId:
                              s.playerId === edit.id ? null : s.playerId,
                          })),
                        },
                      });
                      setEdit(null);
                    }
                  }}
                >
                  删除
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      <footer>
        TOUCHLINE AI <span>场边的每个决定，都有依据。</span>
      </footer>
    </>
  );
}
