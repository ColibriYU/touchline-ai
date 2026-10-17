export type Formation = "4-3-3" | "4-2-3-1" | "4-4-2";
export interface Player {
  id: string;
  name: string;
  positions: string[];
  preferredPosition: string | null;
  foot: string;
  strengths: string[];
  weaknesses: string[];
  notes: string[];
  selectionPriority: string;
  available?: boolean | null;
  injury?: string | null;
  fatigue?: string | null;
  number?: string;
}
export interface Slot {
  role: string;
  playerId: string | null;
  x: number;
  y: number;
}
export interface Lineup {
  formation: Formation;
  slots: Slot[];
}
export type EventKind =
  | "goal"
  | "yellow"
  | "red"
  | "injury"
  | "fatigue"
  | "problem"
  | "sub"
  | "tactic"
  | "score"
  | "note";
export interface MatchEvent {
  id: string;
  minute: number;
  kind: EventKind;
  playerId?: string;
  incoming?: string;
  side?: "home" | "away";
  text: string;
  lineup?: Lineup;
  score?: [number, number];
  void?: boolean;
}
export interface Match {
  id: string;
  opponent: string;
  date: string;
  duration: number;
  subLimit: number;
  reentry: boolean;
  players: Player[];
  initial: Lineup;
  events: MatchEvent[];
  elapsed: number;
  runningSince: number | null;
  status: "ready" | "live" | "ended";
}
export interface AppData {
  version: 1;
  players: Player[];
  lineup: Lineup;
  matches: Match[];
}
export interface AIAdvice {
  judgment: string;
  priority: string;
  execution: string;
  evidence: string[];
  risks: string[];
  alternatives: string[];
  missing: string[];
  action?:
    | { type: "sub"; out: string; in: string }
    | { type: "formation"; formation: Formation };
}
