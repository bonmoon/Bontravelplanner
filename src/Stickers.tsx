import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "./components";
import { uid, type StickerAsset, type StickerPlacement, type TravelDocument } from "./types";

type Store = { document: TravelDocument; change: (recipe: (value: TravelDocument) => TravelDocument) => void };
const Context = createContext<Store | null>(null);
const defaultAsset: StickerAsset = { id: "bon-smile", name: "旅途笑脸", image: "./assets/sticker-smile.png" };
async function trimSticker(source: string): Promise<string> {
  const image = new Image(); image.src = source; await image.decode();
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 900 / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width*scale); canvas.height = Math.round(image.height*scale);
  const ctx = canvas.getContext("2d")!; ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let left=canvas.width, top=canvas.height, right=0, bottom=0;
  for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) if(pixels[(y*canvas.width+x)*4+3]>12) { left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y); }
  if(left>right || top>bottom) throw new Error("图片是全透明的，请选择其他图片");
  const output=document.createElement("canvas"); output.width=right-left+21; output.height=bottom-top+21;
  output.getContext("2d")!.drawImage(canvas,left,top,right-left+1,bottom-top+1,10,10,right-left+1,bottom-top+1);
  return output.toDataURL("image/png");
}
export function StickerProvider({ document, change, children }: Store & { children: ReactNode }) {
  const hasDefault = document.stickerLibrary?.some((asset) => asset.id === defaultAsset.id);
  useEffect(() => {
    if(hasDefault) return;
    let cancelled=false;
    trimSticker(defaultAsset.image).then((image) => { if(!cancelled) change((value) => value.stickerLibrary?.some((asset) => asset.id===defaultAsset.id) ? value : { ...value, stickerLibrary:[{...defaultAsset,image},...(value.stickerLibrary||[])] }); }).catch(() => {});
    return () => { cancelled=true; };
  },[hasDefault,change]);
  return <Context.Provider value={{ document, change }}>{children}</Context.Provider>;
}

export function StickerLayer({ target }: { target: string }) {
  const store = useContext(Context);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const layer = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const drag = useRef<{ id: string; x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null);
  if (!store) return null;
  const assets = store.document.stickerLibrary?.some((asset) => asset.id === defaultAsset.id) ? store.document.stickerLibrary : [defaultAsset, ...(store.document.stickerLibrary || [])];
  const items = (store.document.stickers || []).filter((item) => item.target === target);
  const current = items.find((item) => item.id === selected);
  const patch = (id: string, changes: Partial<StickerPlacement>) => store.change((value) => ({ ...value, stickers: (value.stickers || []).map((item) => item.id === id ? { ...item, ...changes } : item) }));
  const add = (assetId: string) => {
    const item: StickerPlacement = { id: uid("sticker"), target, assetId, x: 45, y: 25, size: 24, rotation: -8, note: "" };
    store.change((value) => ({ ...value, stickers: [...(value.stickers || []), item] }));
    setSelected(item.id); setOpen(false);
  };
  async function upload(file: File) {
    try {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("请选择 PNG、JPG、WebP 或 GIF 图片");
      if (file.size > 8 * 1024 * 1024) throw new Error("请选择 8 MB 以内的图片");
      const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const asset = { id: uid("sticker-art"), name: file.name, image: await trimSticker(image) };
      store!.change((value) => ({ ...value, stickerLibrary: [...(value.stickerLibrary || []), asset] }));
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "图片读取失败"); }
  }
  return <>
    <div className="sticker-layer" ref={layer}>
      {items.map((item) => {
        const asset = assets.find((value) => value.id === item.assetId);
        if (!asset) return null;
        const position = moving?.id === item.id ? moving : item;
        return <button key={item.id} className="placed-sticker" title={item.note || "拖动贴纸，点击写备忘"} aria-label={`${asset.name}贴纸：${item.note || "添加备忘"}`} style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${item.size}%`, transform: `rotate(${item.rotation}deg)` }}
          onClick={(event) => { event.stopPropagation(); if (!suppressClick.current) setSelected(item.id); suppressClick.current = false; }}
          onPointerDown={(event) => { event.stopPropagation(); suppressClick.current = false; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: item.id, x: item.x, y: item.y, px: event.clientX, py: event.clientY, moved: false }; }}
          onPointerMove={(event) => { const start = drag.current; const rect = layer.current?.getBoundingClientRect(); if (!start || start.id !== item.id || !rect) return; const dx = event.clientX - start.px; const dy = event.clientY - start.py; if (Math.abs(dx) + Math.abs(dy) > 5) start.moved = true; if (start.moved) setMoving({ id: item.id, x: Math.max(0, Math.min(100 - item.size, start.x + dx / rect.width * 100)), y: Math.max(0, Math.min(75, start.y + dy / rect.height * 100)) }); }}
          onPointerUp={(event) => { event.stopPropagation(); if (moving?.id === item.id) patch(item.id, { x: moving.x, y: moving.y }); suppressClick.current = !!drag.current?.moved; drag.current = null; setMoving(null); }}
          onPointerCancel={() => { drag.current = null; setMoving(null); }}
          onKeyDown={(event) => { const shifts: Record<string, [number, number]> = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }; const shift = shifts[event.key]; if (shift) { event.preventDefault(); event.stopPropagation(); patch(item.id, { x: Math.max(0, Math.min(100-item.size,item.x+shift[0])), y: Math.max(0,Math.min(75,item.y+shift[1])) }); } }}>
          <img src={asset.image} alt="" draggable={false} />{item.note && <span>{item.note}</span>}
        </button>;
      })}
    </div>
    <button className="sticker-add export-hide" aria-label="添加贴纸备忘" onClick={(event) => { event.stopPropagation(); setOpen(true); }}>＋ 贴纸</button>
    {(open || current) && <div onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
      <Modal title={current ? "贴纸备忘" : "我的贴纸"} onClose={() => { setOpen(false); setSelected(null); }}>
        {current ? <div className="modal-form"><label>写个备忘<textarea value={current.note} onChange={(event) => patch(current.id, { note: event.target.value })} /></label><label>大小<input type="range" min="12" max="40" value={current.size} onChange={(event) => patch(current.id, { size: Number(event.target.value), x: Math.min(current.x,100-Number(event.target.value)) })} /></label><label>角度<input type="range" min="-30" max="30" value={current.rotation} onChange={(event) => patch(current.id, { rotation: Number(event.target.value) })} /></label><footer><button onClick={() => { store.change((value) => ({ ...value, stickers: value.stickers?.filter((item) => item.id !== current.id) })); setSelected(null); }}>移除这张贴纸</button><button onClick={() => setSelected(null)}>完成</button></footer></div> : <><p>选一张贴上，拖动调整位置。上传的图片会留在贴纸库。</p><div className="sticker-library">{assets.map((asset) => <button key={asset.id} onClick={() => add(asset.id)}><img src={asset.image} alt={asset.name} /></button>)}</div><label className="soft-button">＋ 上传贴纸<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} /></label>{error && <p role="alert">{error}</p>}</>}
      </Modal>
    </div>}
  </>;
}
