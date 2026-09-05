import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Modal } from "./components";
import type { AssistantSettings, Ticket, TicketAttachment, TicketKind } from "./types";
import { uid } from "./types";
import { clockTime, ticketAttachments } from "./tickets";
import { recognizeTicket } from "./assistant";

const colors: Record<TicketKind, string> = { 火车票: "#efd5cf", 登机牌: "#d9e1ed", 酒店: "#efe2bd", 门票: "#dbe7d5", 预约: "#ead8e8", 通票: "#d8e5e1" };

export function TicketEditor({ cityId, initial, settings, onClose, onCreate }: { cityId: string; initial?: Ticket; settings: AssistantSettings; onClose: () => void; onCreate: (ticket: Ticket) => void }) {
  const [draft, setDraft] = useState<Partial<Ticket>>(() => ({ ...initial, kind: initial?.kind || "火车票", date: initial?.date === "待定" ? "" : initial?.date, departureTime: initial?.departureTime || clockTime(initial?.time), arrivalTime: initial?.arrivalTime || clockTime(initial?.time?.split(/[→–—]/)[1]), checkInDate: initial?.checkInDate || (initial?.kind === "酒店" ? initial.date : "") }));
  const [files, setFiles] = useState<TicketAttachment[]>(() => ticketAttachments(initial || {}));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoRead, setAutoRead] = useState(false);
  const [cropSource, setCropSource] = useState("");
  const [cropping, setCropping] = useState(false);
  const alive = useRef(true);
  const kind = draft.kind || "火车票";
  const patch = (key: keyof Ticket, value: string | boolean) => setDraft((old) => ({ ...old, [key]: value }));
  function close() { alive.current = false; onClose(); }
  async function recognize(list: TicketAttachment[]) {
    if (!settings.apiKey) throw new Error("请先在设置中连接 DeepSeek，附件已保留，可先手动填写");
    const { ticketText } = await import("./ticketFiles");
    const text = await ticketText(list, setStatus);
    setStatus("正在整理日期、旅客与座位信息…");
    const result = await recognizeTicket(settings, text);
    if (!alive.current) return;
    setDraft((current) => {
      const next = { ...current };
      for (const [key, value] of Object.entries(result)) {
        if (key === "kind" && !initial && !current.title) next.kind = value as TicketKind;
        else if (current[key as keyof Ticket] === undefined || current[key as keyof Ticket] === "") Object.assign(next, { [key]: value });
      }
      return next;
    });
    setStatus("已补齐空白字段，请核对日期、旅客和座位后保存。不同路线请分开建票。");
  }
  async function upload(selected: File[]) {
    if (!selected.length) return;
    setBusy(true); setStatus("正在保存附件并准备完整预览…");
    try {
      if (selected.length + files.length > 12) throw new Error("每张票据最多收纳 12 份附件");
      const { prepareTicketFile } = await import("./ticketFiles");
      const added: TicketAttachment[] = [];
      for (const file of selected) added.push(await prepareTicketFile(file));
      if (!alive.current) return;
      const next = [...files, ...added]; setFiles(next);
      setStatus(`已保存 ${next.length} 份附件，可分别填写旅客名称。`);
      if (autoRead) await recognize(next);
    } catch (error) { if (alive.current) setStatus(error instanceof Error ? error.message : "附件暂时无法读取"); }
    finally { if (alive.current) setBusy(false); }
  }
  async function image(file: File | undefined, target: "qrCode" | "backgroundImage") {
    if (!file) return;
    try {
      const { readTicketData } = await import("./ticketFiles");
      const data = await readTicketData(file);
      if (target === "qrCode") { setCropSource(data); setCropping(true); }
      else patch(target, data);
    } catch (error) { setStatus(String(error)); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (kind === "酒店" && draft.checkInDate && draft.checkOutDate && `${draft.checkOutDate}T${draft.checkOutTime || "23:59"}` < `${draft.checkInDate}T${draft.checkInTime || "00:00"}`) { setStatus("退房时间不能早于入住时间"); return; }
    if (kind !== "酒店" && draft.date && draft.arrivalTime && `${draft.arrivalDate || draft.date}T${draft.arrivalTime}` < `${draft.date}T${draft.departureTime || "00:00"}`) { setStatus("到达早于出发，跨日行程请补充到达日期"); return; }
    onCreate({ ...initial, ...draft, id: initial?.id || uid("ticket"), cityId: initial?.cityId || cityId, kind, provider: draft.provider || kind, title: draft.title?.trim() || "旅行票据", date: (kind === "酒店" ? draft.checkInDate : draft.date) || "待定", time: kind === "酒店" ? draft.checkInTime || "待定" : [draft.departureTime, draft.arrivalTime].filter(Boolean).join(" → ") || "待定", meta: draft.meta || "", code: draft.code || "", color: initial?.color || colors[kind], attachments: files, attachment: undefined, attachmentType: undefined, image: undefined });
  }
  function field(key: keyof Ticket, label: string, type = "text", placeholder = "") {
    return <label key={key}><span>{label}</span><input type={type} value={String(draft[key] || "")} onChange={(event) => patch(key, event.target.value)} placeholder={placeholder} required={key === "title"} /></label>;
  }
  return <Modal title={initial ? "编辑这张票据" : "收好一张票据"} eyebrow="TICKET POCKET" onClose={close} wide>
    <form className="modal-form ticket-editor" onSubmit={submit}>
      <fieldset disabled={busy}>
        <section className="ticket-upload-section"><h3>原始票据 · 图片 / PDF</h3><p>可同时添加两位旅客的车票，每份 PDF 保留所有页面。</p>
          <label className="ticket-file-add">＋ 添加文件<input type="file" multiple accept="image/*,application/pdf,.pdf" onChange={(event) => { const selected = Array.from(event.target.files || []); event.target.value = ""; void upload(selected); }} /></label>
          <div className="ticket-file-list">{files.map((file) => <div key={file.id}><span>{file.type === "pdf" ? "PDF" : "▣"}</span><input aria-label="附件名称或旅客" value={file.name} onChange={(event) => setFiles((items) => items.map((item) => item.id === file.id ? { ...item, name: event.target.value } : item))} /><small>{file.pages ? `${file.pages.length} 页` : "图片"}</small><button type="button" aria-label={`移除${file.name}`} onClick={() => setFiles((items) => items.filter((item) => item.id !== file.id))}>×</button></div>)}</div>
          <label className="recognize-option"><input type="checkbox" checked={autoRead} onChange={(event) => setAutoRead(event.target.checked)} />上传后自动补齐空白字段</label><p className="privacy-note">识别会把票据文字发送给你配置的 DeepSeek。仅生成草稿，不自动保存；首次图片识别需联网下载语言包。</p>
          {!!files.length && <button type="button" onClick={async () => { setBusy(true); try { await recognize(files); } catch (error) { setStatus(error instanceof Error ? error.message : "识别失败，仍可手动填写"); } finally { setBusy(false); } }}>✦ 识别并补齐空白字段</button>}
        </section>
        <div className="ticket-art-fields"><section><h3>二维码</h3>{draft.qrCode && <img className="qr-editor-preview" src={draft.qrCode} alt="二维码预览" />}<label className="ticket-file-add">＋ 从图片选取<input type="file" accept="image/*" onChange={(event) => { void image(event.target.files?.[0], "qrCode"); event.target.value = ""; }} /></label>{draft.qrCode && <><button type="button" onClick={() => { setCropSource(draft.qrCode!); setCropping(true); }}>裁剪二维码</button><button type="button" onClick={() => patch("qrCode", "")}>移除</button></>}</section>
          <section><h3>票面背景</h3>{draft.backgroundImage && <img className="background-editor-preview" src={draft.backgroundImage} alt="票面背景预览" />}<label className="ticket-file-add">＋ 选择背景<input type="file" accept="image/*" onChange={(event) => { void image(event.target.files?.[0], "backgroundImage"); event.target.value = ""; }} /></label>{draft.backgroundImage && <button type="button" onClick={() => patch("backgroundImage", "")}>移除背景</button>}<p>仅显示在票据中段，不覆盖图标、二维码和附件。</p></section></div>
        <div className="category-picker">{(Object.keys(colors) as TicketKind[]).map((item) => <button type="button" key={item} className={kind === item ? "active" : ""} onClick={() => patch("kind", item)}>{item}</button>)}</div>
        {kind === "酒店" && <label className="recognize-option"><input type="checkbox" checked={!!draft.includesBreakfast} onChange={(event) => patch("includesBreakfast", event.target.checked)} /><img className="breakfast-editor-icon" src="./assets/breakfast-croissant.png" alt="" />含早餐</label>}
        {field("title", "标题", "text", "Zürich HB → Salzburg Hbf")}{field("provider", "提供方")}
        {kind === "酒店" ? <><div className="form-row">{field("checkInDate", "入住日期", "date")}{field("checkInTime", "入住时间", "time")}</div><div className="form-row">{field("checkOutDate", "退房日期", "date")}{field("checkOutTime", "退房时间", "time")}</div></> : <><div className="form-row">{field("date", "出发 / 开始日期", "date")}{field("departureTime", "出发 / 开始时间", "time")}</div><div className="form-row">{field("arrivalDate", "到达 / 结束日期（不填为同日）", "date")}{field("arrivalTime", "到达 / 结束时间", "time")}</div></>}
        {field("passengers", "旅客姓名（可填写多人）", "text", "旅客 A、旅客 B")}{field("meta", "座位 / 房型", "text", "A：车厢 3 座位 21；B：车厢 3 座位 22")}{field("code", "确认号")}
      </fieldset>
      {status && <p role="status" className="ticket-editor-status">{status}</p>}
      <footer><button type="button" onClick={close}>取消</button><button className="primary-button" disabled={busy}>{busy ? "正在处理…" : "保存票据"}</button></footer>
    </form>
    {cropping && <QrCropper source={cropSource} onCancel={() => setCropping(false)} onSave={(value) => { patch("qrCode", value); setCropping(false); }} />}
  </Modal>;
}

function QrCropper({ source, onCancel, onSave }: { source: string; onCancel: () => void; onSave: (value: string) => void }) {
  const image = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState({ x: .1, y: .1, w: .8, h: .8 });
  const [error, setError] = useState("");
  function point(event: PointerEvent) { const rect = image.current!.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }; }
  function save(full = false) {
    const img = image.current; if (!img?.naturalWidth) return;
    const area = full ? { x: 0, y: 0, w: 1, h: 1 } : box;
    if (area.w * img.naturalWidth < 20 || area.h * img.naturalHeight < 20) { setError("请框选完整二维码，并保留四周白边"); return; }
    const canvas = document.createElement("canvas"); canvas.width = Math.round(area.w * img.naturalWidth); canvas.height = Math.round(area.h * img.naturalHeight);
    canvas.getContext("2d")!.drawImage(img, area.x * img.naturalWidth, area.y * img.naturalHeight, area.w * img.naturalWidth, area.h * img.naturalHeight, 0, 0, canvas.width, canvas.height);
    onSave(canvas.toDataURL("image/png"));
  }
  return <div className="qr-crop-modal" role="dialog" aria-modal="true" aria-label="裁剪二维码"><section><h3>框选完整二维码</h3><p>拖动选区，保留二维码四周白边，不要切掉角标。</p><div className="qr-crop-stage" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); start.current = point(event); }} onPointerMove={(event) => { if (!start.current) return; const end = point(event); setBox({ x: Math.min(start.current.x, end.x), y: Math.min(start.current.y, end.y), w: Math.abs(end.x - start.current.x), h: Math.abs(end.y - start.current.y) }); }} onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; }}><img ref={image} src={source} alt="待裁剪的票据" draggable={false} /><div style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }} /></div>{error && <p role="alert">{error}</p>}<footer><button type="button" onClick={onCancel}>取消</button><button type="button" onClick={() => save(true)}>使用整张</button><button type="button" onClick={() => save()}>确认裁剪</button></footer></section></div>;
}
