import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const MusicContext = createContext({ playing: false, error: "", toggle: () => {} });
export function TravelMusicProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const enabled = useRef((() => { try { return localStorage.getItem("bontrip-bgm") !== "off"; } catch { return true; } })());
  function remember(value: boolean) { enabled.current = value; try { localStorage.setItem("bontrip-bgm", value ? "on" : "off"); } catch { /* local preference is optional */ } }
  function play() { if (!audio.current) return; setError(""); audio.current.volume = .35; void audio.current.play().catch(() => { setPlaying(false); setError("点击猫咪，再试一次播放"); }); }
  function toggle() { if (audio.current && !audio.current.paused) { remember(false); audio.current.pause(); } else { remember(true); play(); } }
  useEffect(() => {
    const start = () => { if (enabled.current) play(); };
    // Ignore music controls themselves so the first gesture cannot toggle twice.
    const gesture = (event: Event) => { if (!(event.target as Element)?.closest(".cat-music-control,.opening-sound")) start(); };
    window.addEventListener("pointerdown", gesture, { once: true });
    window.addEventListener("bontrip-bgm-start", start);
    window.addEventListener("bontrip-bgm-toggle", toggle);
    return () => { window.removeEventListener("pointerdown", gesture); window.removeEventListener("bontrip-bgm-start", start); window.removeEventListener("bontrip-bgm-toggle", toggle); };
  }, []);
  return <MusicContext.Provider value={{ playing, error, toggle }}>{children}<audio className="travel-audio" ref={audio} src="./assets/paws-and-passport.mp3" loop preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setError("音乐暂时无法加载，请联网后重试"); }} /></MusicContext.Provider>;
}

export function CatMusicControl({ compact = false }: { compact?: boolean }) {
  const { playing, error, toggle } = useContext(MusicContext);
  return <button className={`cat-music-control ${compact ? "compact" : ""} ${playing ? "is-playing" : ""}`} onClick={toggle} aria-label={playing ? "暂停背景音乐" : "播放背景音乐"} aria-pressed={playing} title={error || "Paws and Passport · 循环播放"}>
    {compact && <img src="./assets/bontrip-travel.png" alt="" />}<span className="cat-equalizer" aria-hidden="true"><i /><i /><i /></span><span className="cat-music-label">{playing ? "暂停音乐" : "播放音乐"}</span>
  </button>;
}

export function CatCompanion() {
  const { playing, error } = useContext(MusicContext);
  return <div className={`sidebar-illustration cat-companion ${playing ? "is-playing" : ""}`}><div className="cat-motion"><img src="./assets/bontrip-travel.png" alt="旅行小猫" /><span aria-hidden="true">✦</span><i aria-hidden="true">♪</i></div><p>在路上，<br />收集风景，<br />也收集自己。</p><CatMusicControl />{error && <small role="status">{error}</small>}</div>;
}
