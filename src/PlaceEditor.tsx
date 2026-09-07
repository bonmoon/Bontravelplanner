import { useState, type FormEvent } from "react";
import { Modal } from "./components";
import type { Place, DayPlan } from "./types";

export function PlaceEditor({ place, days, onSave, onClose }: { place: Place; days: DayPlan[]; onSave: (place: Place, dayId: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(place);
  const [dayId, setDayId] = useState(days.find(d => d.places.some(p => p.id === place.id))?.id || "");
  function submit(event: FormEvent) { event.preventDefault(); onSave(draft, dayId); }
  return <Modal title="编辑地点" onClose={onClose}><form className="modal-form" onSubmit={submit}>
    <label>名称<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
    <label>安排日期 · 移动到其他日期<select aria-label="安排日期" value={dayId} onChange={e => setDayId(e.target.value)}>{days.map(day => <option key={day.id} value={day.id}>{day.date} · {day.title}</option>)}</select></label>
    <label>分类<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Place["category"] })}>{["景点","美食","交通","住宿","购物"].map((name) => <option key={name}>{name}</option>)}</select></label>
    <div className="form-row"><label>开始<input type="time" value={/^\d{2}:\d{2}$/.test(draft.time) ? draft.time : ""} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label><label>结束<input type="time" value={draft.endTime || ""} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} /></label></div>
    <label>停留时长<input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} /></label>
    <label>看点<textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></label>
    <label>标签（每行一个）<textarea value={draft.highlights.join("\n")} onChange={(e) => setDraft({ ...draft, highlights: e.target.value.split("\n") })} /></label>
    <label>地图检索名<input value={draft.mapQuery || ""} onChange={(e) => setDraft({ ...draft, mapQuery: e.target.value })} /></label>
    <footer><button type="button" onClick={onClose}>取消</button><button className="primary-button">保存修改</button></footer>
  </form></Modal>;
}
