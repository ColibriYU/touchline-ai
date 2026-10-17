import { useState } from "react";
import type { AIAdvice, Lineup, Match, Player } from "./types";
import { applyAdvice, applyPrematchAdvice, context } from "./ai";
import { adviceSchema } from "./validation";
export default function AdvicePanel({
  players,
  lineup,
  match,
  onMatch,
  onLineup,
  notify,
}: {
  players: Player[];
  lineup: Lineup;
  match?: Match;
  onMatch?: (m: Match) => void;
  onLineup?: (l: Lineup) => void;
  notify: (s: string) => void;
}) {
  const [advice, setAdvice] = useState<AIAdvice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [question, setQuestion] = useState("");
  const snapshot = () => JSON.stringify({ players, lineup, match });
  async function analyze() {
    if (!navigator.onLine) {
      setError("当前离线，AI分析不可用。本地比赛记录仍可正常使用。");
      return;
    }
    setBusy(true);
    setError("");
    setAdvice(null);
    setAccepted(false);
    const fp = snapshot();
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: context(players, lineup, match),
          question,
        }),
        signal: AbortSignal.timeout(45000),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error || "分析暂时不可用");
      setAdvice(adviceSchema.parse(body));
      setFingerprint(fp);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "分析超时，请稍后重试"
          : e instanceof Error
            ? e.message
            : "AI分析失败",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ai-panel mt-5">
      <div className="section-head">
        <div>
          <div className="eyebrow">TOUCHLINE INTELLIGENCE</div>
          <h2>{match ? "场边助教" : "赛前参谋"}</h2>
        </div>
        <span className="badge">教练决策 · AI辅助</span>
      </div>
      <p className="muted">
        {match
          ? "根据当前阵容、比分、事件与剩余换人次数分析。"
          : "分析整体优势、防守薄弱区域、进攻组织、位置适配及替补预案；兼顾互补与攻守平衡。"}
        资料不足时明确列出需要补充的信息。
      </p>
      <label>
        补充战术背景
        <textarea
          maxLength={4000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：对方边锋速度快，我们希望先稳定防守。"
        />
      </label>
      <p className="muted">
        点击后将本次球员资料及比赛记录发送至配置的AI服务。密钥只保存在服务端。
      </p>
      <button className="primary" disabled={busy} onClick={analyze}>
        {busy ? "正在分析…" : "✦ 请求AI分析"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {advice && (
        <div className="advice">
          {(
            [
              "judgment",
              "priority",
              "execution",
              "evidence",
              "risks",
              "alternatives",
              "missing",
            ] as const
          ).map((key, i) => (
            <div key={key}>
              <h3>
                {i + 1}.{" "}
                {
                  [
                    "当前问题判断",
                    "优先建议",
                    "具体执行方式",
                    "依据的球员资料与比赛事件",
                    "可能风险",
                    "备选方案",
                    "缺失信息",
                  ][i]
                }
              </h3>
              {Array.isArray(advice[key]) ? (
                <ul>
                  {(advice[key] as string[]).map((t, j) => (
                    <li key={j}>{t}</li>
                  ))}
                </ul>
              ) : (
                <p>{advice[key] as string}</p>
              )}
            </div>
          ))}
          {advice.action && (
            <div className="action-preview">
              <h3>待教练确认的操作</h3>
              <p>
                {advice.action.type === "sub"
                  ? `换下 ${(match?.players ?? players).find((p) => p.id === (advice.action as { out: string }).out)?.name ?? advice.action.out}，换上 ${(match?.players ?? players).find((p) => p.id === (advice.action as { in: string }).in)?.name ?? advice.action.in}`
                  : `调整为 ${advice.action.formation}`}
              </p>
              {match ? (
                <button
                  className="primary"
                  disabled={accepted || snapshot() !== fingerprint}
                  onClick={() => {
                    try {
                      onMatch?.(applyAdvice(match, advice));
                      setAccepted(true);
                      notify("建议已采纳，操作与原因已记入比赛事件");
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  {accepted
                    ? "已采纳"
                    : snapshot() !== fingerprint
                      ? "场况已变化，请重新分析"
                      : "采纳建议并执行"}
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={accepted || snapshot() !== fingerprint}
                  onClick={() => {
                    try {
                      onLineup?.(applyPrematchAdvice(players, lineup, advice));
                      setAccepted(true);
                      notify("建议已采纳，赛前阵容已更新");
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  {accepted
                    ? "已采纳"
                    : snapshot() !== fingerprint
                      ? "阵容已变化，请重新分析"
                      : "采纳建议并执行"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
