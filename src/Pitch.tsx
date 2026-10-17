import { useRef, useState } from "react";
import type { Lineup, Player } from "./types";
export function Pitch({
  lineup,
  players,
  onChange,
}: {
  lineup: Lineup;
  players: Player[];
  onChange: (l: Lineup) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const draftRef = useRef<Lineup | null>(null);
  const [draft, setDraft] = useState<Lineup | null>(null);
  const shown = draft ?? lineup;
  return (
    <svg
      ref={svg}
      viewBox="0 0 400 540"
      className="pitch"
      style={{ touchAction: "none" }}
      aria-label="足球战术板，向上进攻"
    >
      <defs>
        <pattern
          id="grass"
          width="400"
          height="90"
          patternUnits="userSpaceOnUse"
        >
          <rect width="400" height="45" fill="#245c48" />
          <rect y="45" width="400" height="45" fill="#20543f" />
        </pattern>
      </defs>
      <rect width="400" height="540" rx="16" fill="url(#grass)" />
      <g fill="none" stroke="#b2d1bc" strokeWidth="1.5" opacity=".65">
        <rect x="18" y="18" width="364" height="504" />
        <path d="M18 270H382 M100 18V100H300V18 M150 18V50H250V18 M100 522V440H300V522 M150 522V490H250V522" />
        <circle cx="200" cy="270" r="55" />
        <circle cx="200" cy="270" r="2" />
      </g>
      <text x="200" y="126" textAnchor="middle" fill="#bdd4bf" fontSize="10">
        进攻方向 ↑
      </text>
      {shown.slots.map((s, i) => (
        <g
          key={i}
          transform={`translate(${s.x * 3.6 + 20},${s.y * 5 + 10})`}
          style={{ touchAction: "none", cursor: "grab" }}
          onPointerDown={(e) => {
            drag.current = i;
            draftRef.current = lineup;
            setDraft(lineup);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current !== i || !svg.current) return;
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
              svg.current.getScreenCTM()!.inverse(),
            );
            const next = {
              ...draftRef.current!,
              slots: draftRef.current!.slots.map((a, j) =>
                j === i
                  ? {
                      ...a,
                      x: Math.max(3, Math.min(97, (p.x - 20) / 3.6)),
                      y: Math.max(3, Math.min(97, (p.y - 10) / 5)),
                    }
                  : a,
              ),
            };
            draftRef.current = next;
            setDraft(next);
          }}
          onPointerUp={() => {
            if (draftRef.current) onChange(draftRef.current);
            draftRef.current = null;
            drag.current = null;
            draftRef.current = null;
            setDraft(null);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDraft(null);
          }}
        >
          <circle
            r="19"
            fill={s.playerId ? "#d9ef88" : "#163c30"}
            stroke="#d9ef88"
            strokeWidth="2"
          />
          <text
            textAnchor="middle"
            y="4"
            fill={s.playerId ? "#102d23" : "#d9ef88"}
            fontSize="11"
            fontWeight="700"
          >
            {s.role}
          </text>
          <rect x="-32" y="23" width="64" height="19" rx="5" fill="#102d23" />
          <text textAnchor="middle" y="36" fill="white" fontSize="11">
            {players.find((p) => p.id === s.playerId)?.name ?? "待安排"}
          </text>
        </g>
      ))}
    </svg>
  );
}
