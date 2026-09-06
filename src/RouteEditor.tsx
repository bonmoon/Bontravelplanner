import { useState } from "react";
import { Modal } from "./components";
import { normalizeRoute, type OptimizedDay } from "./routePlanning";
import type { City } from "./types";

export function RouteEditor({ city, optimized, onChange, onClose, onAccept, onRefine }: { city: City; optimized: OptimizedDay[]; onChange: (days: OptimizedDay[]) => void; onClose: () => void; onAccept: () => void; onRefine: (message: string) => Promise<OptimizedDay[]> }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const places = new Map(city.days.flatMap(day => day.places).map(place => [place.id, place]));
  let conflict = "";
  try { normalizeRoute({ ...city, days: city.days.filter(day => optimized.some(item => item.dayId === day.id)) }, optimized); } catch (e) { conflict = (e as Error).message; }
  function changeTime(dayId: string, id: string, field: "time" | "endTime", value: string) {
    onChange(optimized.map(day => day.dayId === dayId ? { ...day, times: { ...day.times, [id]: { ...day.times[id], [field]: value } } } : day));
  }
  function move(dayId: string, index: number, delta: number) {
    onChange(optimized.map(day => { if (day.dayId !== dayId) return day; const ids = [...day.placeIds]; [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]; return { ...day, placeIds: ids }; }));
  }
  async function refine(request = message) {
    if (!request.trim() || busy) return;
    setBusy(true); setError("");
    try { const next = await onRefine([...history, request].join("\n")); onChange(next); setHistory([...history, request]); setMessage(""); } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="微调这一天的节奏" eyebrow={city.name} onClose={onClose} wide><p>晚餐 20:00 前开始 · 行程 21:00 前结束。时间为建议，请核对实际交通及开放时间。确认前不会更改原行程。</p><button className="primary-button" disabled={busy} onClick={() => void refine("请根据当前预览重新安排合理的顺路顺序和起止时间，晚餐20点前、21点前结束，保留所有地点及锁定时间。")}>{busy ? "正在整理…" : "✦ AI 排顺并调整时间"}</button><p>用 ↑ ↓ 调整顺序，点击时间直接修改。固定的地点请先在行程中解除固定。</p><div className="route-preview">{optimized.map(day => <section key={day.dayId}><h3>{day.title}</h3><p>{day.note}</p>{day.placeIds.map((id, index) => { const place = places.get(id)!; const locked = place.locked; return <article className="route-edit-row" key={id}><strong>{index + 1}. {place.name}{locked ? " · 固定" : ""}</strong><div><input aria-label={`${place.name}开始时间`} type="time" disabled={locked || busy} value={day.times[id]?.time ?? place.time} onChange={e => changeTime(day.dayId, id, "time", e.target.value)} /><input aria-label={`${place.name}结束时间`} type="time" disabled={locked || busy} value={day.times[id]?.endTime ?? place.endTime ?? ""} onChange={e => changeTime(day.dayId, id, "endTime", e.target.value)} /><button disabled={busy || locked || !index || places.get(day.placeIds[index - 1])?.locked} onClick={() => move(day.dayId, index, -1)} aria-label={`上移${place.name}`}>↑</button><button disabled={busy || locked || index === day.placeIds.length - 1 || places.get(day.placeIds[index + 1])?.locked} onClick={() => move(day.dayId, index, 1)} aria-label={`下移${place.name}`}>↓</button></div></article>; })}</section>)}</div>{conflict && <p role="alert">{conflict}。可修改时间，或请 AI 重新安排。</p>}<div className="route-refine"><textarea value={message} disabled={busy} onChange={e => setMessage(e.target.value)} placeholder="例如：博物馆留两小时，18:30 吃晚饭，20:30 回酒店" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void refine(); } }} /><button disabled={busy || !message.trim()} onClick={() => void refine()}>{busy ? "正在调整…" : "✦ 与旅行助手微调"}</button>{error && <p role="alert">{error}，保留当前预览。</p>}</div><footer className="modal-footer"><button onClick={onClose}>先不改</button><button className="primary-button" disabled={busy || !!conflict} onClick={onAccept}>确认写入行程</button></footer></Modal>;
}
