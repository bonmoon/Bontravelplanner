import type { City, DayPlan, Place, Ticket } from "./types";
import { appleMapsUrl, googleMapsUrl } from "./maps";
import { cityDatesFromDays } from "./dates";
import { ticketAttachments, ticketFields } from "./tickets";

export const categoryIcon: Record<Place["category"], string> = {
  景点: "✦",
  美食: "◌",
  交通: "↗",
  住宿: "⌂",
  购物: "◇",
};

export function Modal({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-card ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function CityCard({ city, tripStartDate, active, onOpen, onCover }: { city: City; tripStartDate: string; active: boolean; onOpen: () => void; onCover: (file: File) => void }) {
  const placeCount = city.days.reduce((sum, day) => sum + day.places.length, 0);
  const displayDates = cityDatesFromDays(city, tripStartDate)?.dates || city.dates;
  return (
    <article className={`city-cover-card ${city.cover ? "has-cover" : ""} ${active ? "active" : ""}`} style={{ backgroundColor: city.color }} onClick={onOpen}>
      <div className="city-card-actions export-hide"><label aria-label={`更换${city.name}封面`} title="更换封面" onClick={(event) => event.stopPropagation()}>▣<input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onCover(event.target.files[0])} /></label><button aria-label={`编辑${city.name}`} onClick={(event) => { event.stopPropagation(); window.dispatchEvent(new CustomEvent("travel-city-edit", { detail: city.id })); }}>✎</button><button aria-label={`删除${city.name}`} onClick={(event) => { event.stopPropagation(); window.dispatchEvent(new CustomEvent("travel-city-remove", { detail: city.id })); }}>×</button></div>
      <div className="city-cover-copy">
        <button className="plain-city-button" onClick={onOpen}>
          <strong>{city.name}</strong><span>{city.englishName}</span><small>{displayDates}</small>
        </button>
        <div className="city-counts"><span>{city.days.length} 天</span><span>景点 {placeCount}</span><span>Journal {city.journal?.length || 0}</span></div>
      </div>
      <div className={`city-cover-art ${city.cover ? "has-image" : ""}`} aria-hidden="true">
        {city.cover ? <img src={city.cover} alt={`${city.name}封面`} /> : <span>{city.name.slice(0, 1)}</span>}
      </div>
    </article>
  );
}

export function TicketCard({ ticket, city, onEdit, onRemove, onPreview }: { ticket: Ticket; city?: City; onEdit: () => void; onRemove: () => void; onPreview: () => void }) {
  const files = ticketAttachments(ticket);
  const attachment = files[0];
  return (
    <article className={`ticket-card kind-${ticket.kind}`} style={{ backgroundColor: ticket.color }}>
      <div className="ticket-mark"><span>{ticket.kind === "火车票" ? "▥" : ticket.kind === "酒店" ? "⌂" : "✦"}</span><small>{ticket.kind}</small></div>
      <div className="ticket-main">
        {ticket.backgroundImage && <img className="ticket-background" src={ticket.backgroundImage} alt="" />}
        <span className="ticket-provider">{ticket.provider}</span>
        <h3>{ticket.title}</h3>
        {ticket.kind === "酒店" && ticket.includesBreakfast && <span className="breakfast-badge" title="含早餐"><img src="./assets/breakfast-croissant.png" alt="" />含早餐</span>}
        <div className="ticket-fields">{ticketFields(ticket).map(([label, value]) => <span key={label}><small>{label}</small>{value}</span>)}</div>
      </div>
      <div className="ticket-stub ticket-stub-files"><TicketQrs ticket={ticket} onPreview={onPreview} />{attachment ? <button className="ticket-attachment-button" onClick={onPreview} onDoubleClick={onPreview} aria-label={`预览${ticket.title}完整附件`}>{attachment.type === "image" ? <img src={attachment.data} alt="票据附件" /> : <b>PDF</b>}<small>查看附件 · {files.length}</small></button> : <button className="ticket-image-add export-hide" onClick={onEdit}>＋ 图片 / PDF</button>}<small>{city?.name || "旅程"}</small></div>
      <div className="ticket-card-actions export-hide"><button className="ticket-edit" onClick={onEdit} aria-label={`编辑${ticket.title}`}>✎ 编辑</button><button className="ticket-delete" onClick={onRemove} aria-label={`删除${ticket.title}`}>× 删除</button></div>
    </article>
  );
}

export function TicketQrs({ ticket, onPreview }: { ticket: Ticket; onPreview?: () => void }) {
  return <>{[ticket.qrCode, ticket.qrCode2].map((qr, index) => qr && (onPreview ? <button key={index} className="ticket-qr-button" onClick={onPreview} aria-label={`放大旅客 ${index + 1} 二维码`}><img className="ticket-qr" src={qr} alt={`旅客 ${index + 1} 二维码`} /><small>旅客 {index + 1}</small></button> : <section key={index}><h3>旅客 {index + 1} · 二维码</h3><img className="full-qr" src={qr} alt={`旅客 ${index + 1} 完整二维码`} /></section>))}</>;
}

export function PlaceRow({
  place,
  city,
  index,
  isLast,
  onSummarize,
  onToggleLock,
  onRemove,
  onImages,
  busy,
}: {
  place: Place;
  city: City;
  index: number;
  isLast: boolean;
  onSummarize: () => void;
  onToggleLock: () => void;
  onRemove: () => void;
  onImages: (files: File[]) => void;
  busy: boolean;
}) {
  return (
    <div className="place-with-leg">
      <article className="place-row">
        <div className="place-copy">
          <span className="place-category">{place.category}</span>
          <h4>{index + 1}. {place.name}</h4>
          <div className="place-note">
            <strong>{place.time}{place.endTime ? ` – ${place.endTime}` : ""}<small>{place.duration}</small></strong>
            <p>{place.summary || "点一下魔法棒，补上这一站的看点。"}</p>
            {!!place.highlights.length && <div className="highlight-list">{place.highlights.map((item) => <span key={item}>{item}</span>)}</div>}
          </div>
          <div className={`place-media ${place.image ? "has-image" : ""} ${place.gallery?.length ? "has-gallery" : ""} gallery-${Math.min(6, place.gallery?.length || 0)}`}>
            {place.image ? <img className="place-hero-image" src={place.image} alt={`${place.name}图片`} /> : <div className={`place-media-empty category-${place.category}`}><span>{categoryIcon[place.category]}</span><small>给这一站加一张大图</small></div>}
            {!!place.gallery?.length && <div className="place-gallery">{place.gallery.map((image, galleryIndex) => <img key={`${place.id}-${galleryIndex}`} src={image} alt={`${place.name}补充图片 ${galleryIndex + 1}`} />)}</div>}
            <label className={`place-media-add ${place.image ? "icon-only" : ""}`} title={place.image ? "添加更多图片" : "添加图片"}><span aria-hidden="true">＋</span>{!place.image && <b>添加图片</b>}<input type="file" accept="image/*" multiple onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length) onImages(files); event.target.value = ""; }} /></label>
          </div>
        </div>
        <div className="place-actions export-hide">
          <button onClick={onSummarize} disabled={busy} title="补充看点">{busy ? "…" : "✦"}</button>
          <button onClick={onToggleLock} title={place.locked ? "解除固定" : "固定时间"}>{place.locked ? "●" : "○"}</button>
          <button className="remove-place-button" onClick={onRemove} title="移除地点">×</button>
          <details>
            <summary>•••</summary>
            <div><a href={appleMapsUrl(place, city)} target="_blank" rel="noreferrer">Apple 地图</a><a href={googleMapsUrl(place, city)} target="_blank" rel="noreferrer">Google 地图</a><button onClick={onRemove}>移除</button></div>
          </details>
        </div>
      </article>
      {!isLast && <div className="route-leg"><span>步行</span><b>顺路去下一站</b><i>›</i></div>}
    </div>
  );
}

export function DaySection({
  day,
  onAdd,
  onRemove,
  children,
}: {
  day: DayPlan;
  onAdd: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="day-section">
      <header><div><h3>{day.date} <span>{day.weekday}</span></h3><p>{day.title}</p></div><div className="day-actions export-hide"><button className="day-remove" onClick={onRemove}>删除此天</button><button className="soft-button" onClick={onAdd}>＋ 添加地点</button></div></header>
      <div>{children}</div>
    </section>
  );
}
