import { openDB } from "idb";
import type { AppData } from "./types";
const db = openDB("touchline-ai", 1, {
  upgrade(db) {
    db.createObjectStore("state");
  },
});
export async function readData(): Promise<AppData | undefined> {
  return (await db).get("state", "main");
}
export async function saveData(data: AppData) {
  await (await db).put("state", data, "main");
}
