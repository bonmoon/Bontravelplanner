import { useState } from "react";
import type { City } from "./types";
import { appleMapsUrl, appleRouteUrl, googleMapsUrl } from "./maps";
import { cityGuidePlaces, cityGuideText, cityGuideHtml, validAppleGuideUrl } from "./cityGuides";
import { downloadBlob } from "./exporters";

export function MapDesk({ cities, city, onSelect, onGuide }: { cities: City[]; city: City; onSelect: (id: string) => void; onGuide: (value: string) => void }) {
  const [search, setSearch] = useState("");
  const [guide, setGuide] = useState(city.appleGuideUrl || "");
  const [message, setMessage] = useState("");
  const places = cityGuidePlaces(city);
  let savedGuide = "";
  try { savedGuide = validAppleGuideUrl(city.appleGuideUrl || ""); } catch { /* old imported links must also be safe */ }
  async function copy() { try { await navigator.clipboard.writeText(cityGuideText(city)); setMessage("地点与 Apple 地图链接已复制"); } catch { setMessage("无法访问剪贴板，可以使用导出地点集"); } }
  function save() { try { const url = validAppleGuideUrl(guide); onGuide(url); setMessage(url ? "Apple 指南链接已关联" : "已取消关联"); } catch { setMessage("请粘贴 Apple 地图分享的 HTTPS 指南链接"); } }
  return <section className="map-page">
    <header className="page-intro"><span className="eyebrow">CITY FIELD GUIDE</span><h2>{city.name} · 地图与地点集</h2><p>从旅行卡片收好每一站，随时切换目的地。</p></header>
    <nav className="map-city-tabs" aria-label="选择地图城市">{cities.map((item) => <button key={item.id} aria-pressed={item.id===city.id} onClick={() => onSelect(item.id)}>{item.cover ? <img src={item.cover} alt="" /> : <span aria-hidden="true">⌖</span>}<span>{item.name}</span></button>)}</nav>
    <section className="map-search-desk"><label><span>在 {city.englishName || city.name} 搜索</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="咖啡馆、酒店、景点…" /></label><div><a href={appleMapsUrl(search.trim() || "景点",city)} target="_blank" rel="noreferrer">Apple 地图搜索 ↗</a><a href={googleMapsUrl(search.trim() || "景点",city)} target="_blank" rel="noreferrer">Google 地图 ↗</a></div></section>
    <section className="city-guide-panel"><div><span className="eyebrow">{places.length} PLACES</span><h3>{city.name}的口袋指南</h3><p>跟随行程自动更新 · 重复地点合并展示</p></div><div className="guide-actions"><button disabled={!places.length} onClick={() => void copy()}>复制地点清单</button><button disabled={!places.length} onClick={() => downloadBlob(new Blob([cityGuideHtml(city)],{type:"text/html;charset=utf-8"}),`${city.name.replace(/[\\/:*?"<>|]/g,"-")}-地点集.html`)}>⇩ 导出地点集</button>{savedGuide && <a href={savedGuide} target="_blank" rel="noreferrer">打开已关联的 Apple 指南 ↗</a>}</div>
      <details className="apple-guide-link"><summary>关联我的 Apple 指南</summary><p>在 Apple 地图中新建指南，逐个打开下方地点并加入指南，再把指南的分享链接保存在这里。网页地点集自动更新；Apple 指南中的地点需在 Apple 地图内维护。</p><label>指南分享链接<input type="url" value={guide} onChange={(event) => setGuide(event.target.value)} placeholder="https://maps.apple.com/…" /></label><button onClick={save}>保存关联</button></details>
      {message && <p role="status">{message}</p>}
    </section>
    <div className="guide-place-grid">{places.map((place,index) => <article key={place.id}>{place.image && <img className="guide-place-cover" src={place.image} alt={place.name} />}<div><small>{String(index+1).padStart(2,"0")} / {place.category}</small><h3>{place.name}</h3><p>{place.summary}</p><a href={appleMapsUrl(place,city)} target="_blank" rel="noreferrer">在 Apple 地图查找 ↗</a>{index<places.length-1 && <a href={appleRouteUrl([place,places[index+1]],city)} target="_blank" rel="noreferrer">步行到下一站 ↗</a>}</div></article>)}</div>
    {!places.length && <div className="empty-state"><h3>这座城市还没有地点</h3><p>在行程或旅行助手里加入地点，这里就会自动整理好。</p></div>}
  </section>;
}
