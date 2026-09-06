import { useRef } from "react";

export function PhotoOrder({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const drag = useRef<number | null>(null);
  const list = useRef<HTMLDivElement>(null);
  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= images.length) return;
    const next = [...images]; const [image] = next.splice(from, 1); next.splice(to, 0, image); onChange(next);
  }
  return <details className="photo-order export-hide"><summary>调整图片顺序 · {images.length} 张</summary><p>拖动右侧手柄，上下调整；第一张作为主图。</p><div ref={list}>{images.map((src, index) => <div className="photo-order-row" data-photo-index={index} key={index}><img src={src} alt={`第 ${index + 1} 张`} draggable={false} /><span>{index + 1}</span><button aria-label={`上移第 ${index + 1} 张图片`} disabled={!index} onClick={() => move(index, index - 1)}>↑</button><button aria-label={`下移第 ${index + 1} 张图片`} disabled={index === images.length - 1} onClick={() => move(index, index + 1)}>↓</button><button className="photo-drag" aria-label={`拖动第 ${index + 1} 张图片排序`} onPointerDown={e => { drag.current = index; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => { const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-photo-index]"); if (drag.current !== null && target && list.current?.contains(target)) move(drag.current, Number(target.dataset.photoIndex)); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>⠿</button></div>)}</div></details>;
}
