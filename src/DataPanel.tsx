import { useState } from "react";
import type { AppData } from "./types";
import { validateData, matchSchema } from "./validation";
import { validatePlayers, freezeMatch } from "./domain";
import { download } from "./MatchPanel";
export default function DataPanel({
  data,
  update,
  notify,
}: {
  data: AppData;
  update: (d: AppData) => void;
  notify: (s: string) => void;
}) {
  const [pending, setPending] = useState<AppData | null>(null);
  const [label, setLabel] = useState("");
  return (
    <section>
      <h2>本地数据与备份</h2>
      <p className="muted">
        球员、阵容及比赛保存在当前浏览器。清除网站数据会删除本地记录，请定期导出备份。
      </p>
      <div className="toolbar">
        <button
          className="primary"
          onClick={() => {
            download("touchline-backup.json", {
              ...data,
              matches: data.matches.map((m) => freezeMatch(m)),
            });
            notify("完整备份已导出");
          }}
        >
          导出完整JSON备份
        </button>
        <button
          onClick={() => {
            download("players.json", data.players);
            notify("球员库已导出");
          }}
        >
          导出球员库
        </button>
      </div>
      <label>
        导入JSON（完整备份、球员列表或单场比赛）
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              if (f.size > 10 * 1024 * 1024) throw Error("文件超过10MB");
              const raw = JSON.parse(await f.text());
              let next: AppData;
              if (Array.isArray(raw)) {
                const ps = validatePlayers(raw);
                next = validateData({
                  ...data,
                  players: ps,
                  lineup: {
                    ...data.lineup,
                    slots: data.lineup.slots.map((s) => ({
                      ...s,
                      playerId: ps.some((p) => p.id === s.playerId)
                        ? s.playerId
                        : null,
                    })),
                  },
                });
                setLabel("替换球员库，保留历史比赛快照");
              } else if (raw.match) {
                const m = matchSchema.parse(raw.match);
                next = validateData({
                  ...data,
                  matches: [
                    { ...m, elapsed: m.elapsed, runningSince: null },
                    ...data.matches.filter((x) => x.id !== m.id),
                  ],
                });
                setLabel("导入单场比赛（相同编号将替换），导入后计时暂停");
              } else {
                next = validateData(raw);
                next.matches = next.matches.map((m) => ({
                  ...m,
                  runningSince: null,
                }));
                setLabel("替换此设备全部数据，导入后计时暂停");
              }
              setPending(next);
            } catch (err) {
              notify(
                "导入失败，原数据未改变：" +
                  (err instanceof Error ? err.message : "无效文件"),
              );
            }
          }}
        />
      </label>
      {pending && (
        <div className="action-preview">
          <h3>导入预览</h3>
          <p>
            {label}。导入后共 {pending.players.length} 名球员、
            {pending.matches.length} 场比赛。
          </p>
          <p>确认前会自动下载当前数据备份。</p>
          <button
            className="primary"
            onClick={() => {
              download("touchline-before-import.json", {
                ...data,
                matches: data.matches.map((m) => freezeMatch(m)),
              });
              update(pending);
              setPending(null);
            }}
          >
            确认导入
          </button>{" "}
          <button onClick={() => setPending(null)}>取消</button>
        </div>
      )}
      <h3>AI服务状态</h3>
      <p className="muted">
        通过同源 /api/analyze 调用服务端。服务地址、模型与密钥在服务端 .env
        配置；此页面不接收或存储密钥。
      </p>
      <h3>离线与安装</h3>
      <p className="muted">
        首次联网打开生产版本后，基础页面和球员库会缓存。之后可离线编辑及记录比赛；AI需要网络。手机安装需要HTTPS站点，可从浏览器菜单选择“添加到主屏幕”。
      </p>
      <p className="muted">版本 1.0.0 · 单球队 · 无账号与云同步</p>
    </section>
  );
}
