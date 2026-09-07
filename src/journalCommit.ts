import type { AssistantOperation, TravelDocument } from "./types";
import { uid } from "./types";
import { applyBusinessOperations } from "./assistantBusiness";
import { applyRecordEdits } from "./assistantEdits";

export function prepareJournalCommit(document: TravelDocument, tripId: string, operations: AssistantOperation[]) {
  const trip = document.trips.find(t => t.id === tripId);
  if (!trip) throw new Error("找不到这趟旅行，手记未保存");
  if (!operations.length || operations.some(op => op.type !== "add_journal" && !(op.type === "edit_record" && op.entity === "journal"))) throw new Error("请单独确认手记修改");
  const updated = applyBusinessOperations(applyRecordEdits(trip, operations), operations, "");
  const targets = operations.map(op => {
    const city = updated.cities.find(c => op.type === "add_journal" ? c.id === op.cityId : op.type === "edit_record" && c.journal?.some(j => j.id === op.id));
    const entry = op.type === "add_journal" ? city?.journal?.find(j => !trip.cities.flatMap(c => c.journal || []).some(old => old.id === j.id) && j.title === op.journal.title && j.text === op.journal.text) : op.type === "edit_record" ? city?.journal?.find(j => j.id === op.id) : undefined;
    if (!city || !entry?.text?.trim()) throw new Error("手记正文为空，未保存；请重新整理正文");
    return { cityId: city.id, cityName: city.name, entry };
  });
  const message = targets.map(t => `「${t.entry.title}」 → ${t.cityName}的旅行手记`).join("\n");
  const next = { ...document, activeTripId: tripId, trips: document.trips.map(t => t.id === tripId ? { ...updated, updatedAt: new Date().toISOString(), chats: [...updated.chats, { id: uid("chat"), role: "assistant" as const, content: `已保存：\n${message}`, createdAt: new Date().toISOString() }] } : t) };
  return { document: next, targets };
}

export function verifyJournalCommit(saved: TravelDocument | null, tripId: string, targets: ReturnType<typeof prepareJournalCommit>["targets"]) {
  if (!targets.every(target => saved?.trips.find(t => t.id === tripId)?.cities.find(c => c.id === target.cityId)?.journal?.some(j => j.id === target.entry.id && j.text === target.entry.text && j.title === target.entry.title))) throw new Error("手记没有完整保存到本机，请重试或先导出备份");
}
