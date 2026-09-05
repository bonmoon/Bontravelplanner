import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { applyOptimizedDays, commandTrip, optimizeCity, parseExpenses, summarizePlace, testAssistantConnection, type OptimizedDay } from "./assistant";
import { CityCard, DaySection, Modal, PlaceRow, categoryIcon } from "./components";
import { exportElementPng, exportJson, exportTripHtml } from "./exporters";
import { downloadTripPackageTemplate, importTripPackage } from "./bulkPackage";
import { cityDateRange, looseDateToIso, sortCitiesByDate, syncCityDatesFromDays } from "./dates";
import { appleMapsUrl, appleRouteUrl, googleMapsUrl, googleRouteUrl } from "./maps";
import { sampleDocument } from "./sample";
import { loadAssistantSettings, loadDocument, requestPersistentStorage, saveAssistantSettings, saveDocument } from "./storage";
import type { AssistantOperation, AssistantSettings, City, Expense, JournalEntry, Place, PlaceCategory, Ticket, TicketKind, TravelDocument, Trip, ViewName } from "./types";
import { uid } from "./types";
import { TicketEditor } from "./TicketEditor";
import { TicketsView } from "./TicketsView";
import { exportTicketsHtml } from "./ticketExport";

const navItems: Array<{ id: ViewName; label: string; icon: string; image?: string }> = [
  { id: "home", label: "首页", icon: "⌂", image: "./assets/bontrip-home.png" },
  { id: "trip", label: "我的旅行", icon: "⌘", image: "./assets/bontrip-travel.png" },
  { id: "map", label: "地图", icon: "⌖", image: "./assets/bontrip-map.png" },
  { id: "tickets", label: "票据夹", icon: "▱", image: "./assets/bontrip-food.png" },
  { id: "expenses", label: "记账本", icon: "▦", image: "./assets/bontrip-ledger.png" },
  { id: "assistant", label: "旅行助手", icon: "✦", image: "./assets/travel-assistant-avatar.png" },
  { id: "settings", label: "设置", icon: "⚙" },
];

type ModalName = "trip" | "city" | "editCity" | "journal" | "place" | "ticket" | "editTicket" | "expense" | "route" | "none";

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 12 * 1024 * 1024) return reject(new Error("图片请控制在 12MB 以内"));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("这张图片暂时无法读取"));
    reader.readAsDataURL(file);
  });
}

function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

function App() {
  const [document, setDocument] = useState<TravelDocument>(sampleDocument);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewName>("trip");
  const [cityDetail, setCityDetail] = useState(false);
  const [activeCityId, setActiveCityId] = useState("brussels");
  const [modal, setModal] = useState<ModalName>("none");
  const [modalDayId, setModalDayId] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const [settings, setSettings] = useState<AssistantSettings>(loadAssistantSettings);
  const [optimized, setOptimized] = useState<OptimizedDay[]>([]);
  const [optimizedCityId, setOptimizedCityId] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [expenseDraft, setExpenseDraft] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const bulkImportRef = useRef<HTMLInputElement>(null);
  const [introOpen, setIntroOpen] = useState(() => {
    try { return window.sessionStorage.getItem("bontrip-opening-seen") !== "1"; }
    catch { return true; }
  });

  const trip = document.trips.find((item) => item.id === document.activeTripId) || document.trips[0];
  const city = trip?.cities.find((item) => item.id === activeCityId) || trip?.cities[0];
  const allPlaces = city?.days.flatMap((day) => day.places) || [];

  useEffect(() => {
    loadDocument()
      .then((saved) => {
        if (saved?.trips?.length) setDocument(saved);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => saveDocument(document).catch(() => showToast("这次修改还没有保存下来")), 350);
    return () => window.clearTimeout(timer);
  }, [document, ready]);

  useEffect(() => {
    if (trip && !trip.cities.some((item) => item.id === activeCityId)) setActiveCityId(trip.cities[0]?.id || "");
  }, [trip?.id, activeCityId]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [view]);


  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function updateTrip(recipe: (current: Trip) => Trip) {
    setDocument((current) => ({
      ...current,
      trips: current.trips.map((item) => item.id === current.activeTripId ? { ...recipe(item), updatedAt: new Date().toISOString() } : item),
    }));
  }

  function updateCity(recipe: (current: City) => City) {
    if (!city) return;
    updateTrip((current) => ({ ...current, cities: current.cities.map((item) => item.id === city.id ? recipe(item) : item) }));
  }

  function openCity(cityId: string) {
    setActiveCityId(cityId);
    setCityDetail(true);
    setView("trip");
    window.scrollTo({ top: 0 });
  }

  async function setCityCover(target: City, file: File) {
    try {
      const cover = await readImage(file);
      updateTrip((current) => ({ ...current, cities: current.cities.map((item) => item.id === target.id ? { ...item, cover } : item) }));
      showToast("城市封面换好了");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "这张图片暂时无法读取");
    }
  }

  async function setTripCover(targetId: string, file: File) {
    try {
      const cover = await readImage(file);
      setDocument((current) => ({ ...current, trips: current.trips.map((item) => item.id === targetId ? { ...item, cover, updatedAt: new Date().toISOString() } : item) }));
      showToast("旅行封面换好了");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "这张图片暂时无法读取");
    }
  }

  async function setPlaceImages(dayId: string, placeId: string, files: File[]) {
    try {
      const images = await Promise.all(files.slice(0, 12).map(readImage));
      updateCity((current) => ({ ...current, days: current.days.map((day) => day.id === dayId ? { ...day, places: day.places.map((place) => {
        if (place.id !== placeId) return place;
        const combined = [...(place.image ? [place.image] : []), ...(place.gallery || []), ...images].slice(-12);
        return { ...place, image: combined[0], gallery: combined.slice(1) };
      }) } : day) }));
      showToast(`放好了 ${images.length} 张地点图片`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "这张图片暂时无法读取");
    }
  }

  async function enrichPlace(dayId: string, place: Place) {
    if (!city) return;
    setBusy(place.id);
    try {
      const enriched = await summarizePlace(settings, place, city);
      updateCity((current) => ({
        ...current,
        days: current.days.map((day) => day.id === dayId ? { ...day, places: day.places.map((item) => item.id === place.id ? { ...item, ...enriched } : item) } : day),
      }));
      showToast("这一站的看点补好了");
    } catch (error) {
      const message = error instanceof Error ? error.message : "旅行助手没有完成这次操作";
      updateTrip((current) => ({ ...current, chats: [...current.chats, { id: uid("chat"), role: "assistant", content: `没有写入：${message}`, createdAt: new Date().toISOString() }] }));
      showToast(message);
    } finally {
      setBusy("");
    }
  }

  async function prepareOptimization() {
    await prepareOptimizationFor();
  }

  async function prepareOptimizationFor(date?: string, cityName?: string) {
    const target = cityName ? trip?.cities.find((item) => item.name === cityName || item.englishName === cityName) : city;
    if (!trip || !target) return showToast("没有找到对应城市，请补充城市名称");
    const requestedDate = date ? looseDateToIso(date, trip.startDate) : undefined;
    const days = date ? target.days.filter((day) => (looseDateToIso(day.date, trip.startDate) || day.date) === (requestedDate || date)) : target.days;
    if (!days.some((day) => day.places.length)) return showToast(date ? "这一天还没有地点，请确认日期或先添加行程" : "先添加几个地点吧");
    setBusy("route");
    try {
      setOptimized(await optimizeCity(settings, trip, { ...target, days }));
      setOptimizedCityId(target.id);
      setActiveCityId(target.id);
      setModal("route");
    } catch (error) {
      const message = error instanceof Error ? error.message : "旅行助手没有完成这次操作";
      updateTrip((current) => ({ ...current, chats: [...current.chats, { id: uid("chat"), role: "assistant", content: `没有写入：${message}`, createdAt: new Date().toISOString() }] }));
      showToast(message);
    } finally {
      setBusy("");
    }
  }

  function acceptOptimization() {
    updateTrip((current) => ({ ...current, cities: current.cities.map((item) => item.id === optimizedCityId ? applyOptimizedDays(item, optimized) : item) }));
    setModal("none");
    showToast("路线已经重新排好");
  }


  function applyAssistantOperations(operations: AssistantOperation[]) {
    const categories: PlaceCategory[] = ["景点", "美食", "交通", "住宿", "购物"];
    const ticketColors: Record<TicketKind, string> = { 火车票: "#efd5cf", 登机牌: "#d9e1ed", 酒店: "#efe2bd", 门票: "#dbe7d5", 预约: "#ead8e8", 通票: "#d8e5e1" };
    updateTrip((current) => {
      let next = current;
      operations.forEach((operation) => {
        if (operation.type === "add_city") {
          const raw = operation.city;
          const days = Array.isArray(raw.days) && raw.days.length ? raw.days.map((day) => ({ id: uid("day"), date: day.date || `Day ${next.cities.length + 1}`, weekday: day.weekday || "", title: day.title || "顺路的一天", places: (day.places || []).map((place) => ({ id: uid("place"), name: place.name || "待补地点", mapQuery: place.mapQuery || "", category: categories.includes(place.category) ? place.category : "景点", time: place.time || "待安排", endTime: place.endTime || "", summary: place.summary || "", highlights: place.highlights || [], duration: place.duration || "待安排", mapUrl: place.mapUrl || "" })) })) : [{ id: uid("day"), date: "Day 1", weekday: "", title: "抵达与散步", places: [] }];
          next = { ...next, cities: [...next.cities, { id: uid("city"), name: raw.name, englishName: raw.englishName || raw.name, country: raw.country || "", dates: raw.dates || "待安排", note: raw.note || "给这座城市留一点偶遇。", color: raw.color || "#e4ddcf", journal: [], days }] };
        }
        if (operation.type === "add_place") {
          const targetIndex = Math.max(0, next.cities.findIndex((item) => operation.cityName && item.name.includes(operation.cityName)));
          const target = next.cities[targetIndex] || next.cities[0];
          if (!target) return;
          const raw = operation.place;
          const place: Place = { id: uid("place"), name: raw.name, mapQuery: raw.mapQuery || "", category: categories.includes(raw.category as PlaceCategory) ? raw.category as PlaceCategory : "景点", time: raw.time || "待安排", endTime: raw.endTime || "", summary: raw.summary || "", highlights: raw.highlights || [], duration: raw.duration || "待安排", mapUrl: raw.mapUrl || "" };
          const days = target.days.length ? target.days.map((day, index) => (operation.dayTitle ? day.title.includes(operation.dayTitle) : index === 0) ? { ...day, places: [...day.places, place] } : day) : [{ id: uid("day"), date: "Day 1", weekday: "", title: operation.dayTitle || "顺路的一天", places: [place] }];
          next = { ...next, cities: next.cities.map((item) => item.id === target.id ? { ...item, days } : item) };
        }
        if (operation.type === "update_place") {
          next = { ...next, cities: next.cities.map((targetCity) => {
            if (operation.cityName && !targetCity.name.includes(operation.cityName)) return targetCity;
            return { ...targetCity, days: targetCity.days.map((day) => ({ ...day, places: day.places.map((place) => place.name === operation.placeName || place.name.includes(operation.placeName) ? { ...place, ...operation.changes, id: place.id } : place) })) };
          }) };
        }
        if (operation.type === "plan_day") {
          const requestedIndex = next.cities.findIndex((item) => operation.cityName && item.name.includes(operation.cityName));
          const activeIndex = next.cities.findIndex((item) => item.id === city?.id);
          let target = next.cities[requestedIndex >= 0 ? requestedIndex : Math.max(0, activeIndex)] || next.cities[0];
          if (operation.cityName && requestedIndex < 0) {
            target = { id: uid("city"), name: operation.cityName, englishName: operation.cityName, dates: operation.date || "待定", note: "从攻略收好的地点", color: "#eadccf", days: [] };
            next = { ...next, cities: [...next.cities, target] };
          }
          if (!target || !operation.places?.length) return;
          const requestedDate = operation.date ? looseDateToIso(operation.date, next.startDate) || operation.date : undefined;
          const dayIndex = target.days.findIndex((day) => requestedDate ? (looseDateToIso(day.date, next.startDate) || day.date) === requestedDate : !!operation.title && day.title === operation.title);
          const targetDay = (dayIndex >= 0 ? target.days[dayIndex] : undefined) || { id: uid("day"), date: requestedDate || "Day 1", weekday: "", title: operation.title || "顺路的一天", places: [] };
          const existingByName = new Map(targetDay.places.map((place) => [place.name.replace(/\s/g, "").toLowerCase(), place]));
          const planned = operation.places.filter((place) => place?.name).slice(0, 30).map((raw) => {
            const existing = existingByName.get(raw.name.replace(/\s/g, "").toLowerCase());
            return { ...existing, id: existing?.id || uid("place"), name: raw.name, mapQuery: raw.mapQuery || existing?.mapQuery || "", category: categories.includes(raw.category as PlaceCategory) ? raw.category as PlaceCategory : existing?.category || "景点", time: raw.time || existing?.time || "待安排", endTime: raw.endTime || existing?.endTime || "", summary: raw.summary || existing?.summary || "", highlights: raw.highlights || existing?.highlights || [], duration: raw.duration || existing?.duration || "待安排", mapUrl: raw.mapUrl || existing?.mapUrl || "" } as Place;
          });
          const places = operation.replace !== true ? [...targetDay.places, ...planned.filter((place) => !targetDay.places.some((existing) => existing.name === place.name))] : [...planned.map((place) => targetDay.places.find((old) => old.id === place.id && old.locked) || place), ...targetDay.places.filter((old) => old.locked && !planned.some((place) => place.id === old.id))];
          const updatedDay = { ...targetDay, date: requestedDate || targetDay.date, title: operation.title || targetDay.title, places: places.sort((a, b) => (a.time.match(/\d{1,2}:\d{2}/)?.[0].padStart(5,"0") || "99:99").localeCompare(b.time.match(/\d{1,2}:\d{2}/)?.[0].padStart(5,"0") || "99:99")) };
          const days = dayIndex >= 0 ? target.days.map((day, index) => index === dayIndex ? updatedDay : day) : [...target.days, updatedDay];
          days.sort((a, b) => (looseDateToIso(a.date, next.startDate) || "9999").localeCompare(looseDateToIso(b.date, next.startDate) || "9999"));
          next = { ...next, cities: next.cities.map((item) => item.id === target.id ? { ...item, days } : item) };
        }
        if (operation.type === "add_expense") {
          const raw = operation.expense;
          if (!Number.isFinite(Number(raw.amount)) || Number(raw.amount) <= 0) return;
          next = { ...next, expenses: [{ id: uid("expense"), cityId: city?.id || next.cities[0]?.id || "", date: raw.date || new Date().toISOString().slice(0, 10), title: raw.title, amount: Number(raw.amount) || 0, currency: raw.currency || "¥", category: raw.category || "其他" }, ...next.expenses] };
        }
        if (operation.type === "update_expense") {
          next = { ...next, expenses: next.expenses.map((expense) => expense.id === operation.expenseId ? { ...expense, ...operation.changes, id: expense.id, cityId: operation.changes.cityId || expense.cityId, amount: operation.changes.amount === undefined ? expense.amount : Math.max(0, Number(operation.changes.amount) || 0) } : expense) };
        }
        if (operation.type === "add_ticket") {
          const raw = operation.ticket; const kind = raw.kind || "预约";
          next = { ...next, tickets: [{ id: uid("ticket"), cityId: city?.id || next.cities[0]?.id || "", kind, provider: raw.provider || kind, title: raw.title, date: raw.date || "待定", time: raw.time || "待定", meta: raw.meta || "", code: raw.code || "待补", color: ticketColors[kind] }, ...next.tickets] };
        }
      });
      return next;
    });
    if (operations.some((item) => item.type === "open_ticket")) setModal("ticket");
    if (operations.some((item) => item.type === "open_expense")) setModal("expense");
    const route = operations.find((item) => item.type === "optimize_route");
    if (route?.type === "optimize_route") window.setTimeout(() => void prepareOptimizationFor(route.date, route.cityName), 0);
  }

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    const content = chatDraft.trim();
    if (!content || !trip || busy === "chat") return;
    const userMessage = { id: uid("chat"), role: "user" as const, content, createdAt: new Date().toISOString() };
    updateTrip((current) => ({ ...current, chats: [...current.chats, userMessage] }));
    setChatDraft("");
    const quickTicket = /(?:添加|增加|新建|录入).{0,4}(?:票据|车票|门票|预订)/.test(content) && content.length < 24;
    const quickExpense = /(?:记账|记一笔|增加支出|添加账目)/.test(content) && !/\d/.test(content);
    const quickCity = /(?:添加|增加|新建).{0,3}城市/.test(content) && content.length < 18;
    if (quickTicket || quickExpense || quickCity) {
      if (quickTicket) setModal("ticket");
      if (quickExpense) setModal("expense");
      if (quickCity) setModal("city");
      const reply = quickTicket ? "票据卡已经打开，二维码和确认信息都可以一起放进去。" : quickExpense ? "记账卡已经打开，可以自己填，也可以用一句话快速记。" : "城市卡已经打开，先填城市与日期，之后再补图片。";
      updateTrip((current) => ({ ...current, chats: [...current.chats, { id: uid("chat"), role: "assistant", content: reply, createdAt: new Date().toISOString() }] }));
      return;
    }
    setBusy("chat");
    try {
      const result = await commandTrip(settings, trip, content, city?.name);
      applyAssistantOperations(result.operations);
      updateTrip((current) => ({ ...current, chats: [...current.chats, { id: uid("chat"), role: "assistant", content: result.reply, createdAt: new Date().toISOString() }] }));
      if (result.operations.length) showToast(`旅行助手完成了 ${result.operations.length} 项修改`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "旅行助手没有完成这次操作";
      updateTrip((current) => ({ ...current, chats: [...current.chats, { id: uid("chat"), role: "assistant", content: `没有写入：${message}`, createdAt: new Date().toISOString() }] }));
      showToast(message);
    } finally {
      setBusy("");
    }
  }

  async function quickExpense() {
    if (!expenseDraft.trim() || !trip || !city) return;
    setBusy("expense");
    try {
      const entries = await parseExpenses(settings, expenseDraft, city.id);
      updateTrip((current) => ({ ...current, expenses: [...entries, ...current.expenses] }));
      setExpenseDraft("");
      setModal("none");
      showToast(`记下了 ${entries.length} 笔`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "稍后再试");
    } finally {
      setBusy("");
    }
  }

  function saveSettings(event: FormEvent) {
    event.preventDefault();
    saveAssistantSettings(settings);
    showToast("旅行助手已经连接好");
  }

  async function doExportPng() {
    if (!exportRef.current || !trip) return;
    setBusy("export");
    try {
      await exportElementPng(exportRef.current, trip.title, collectPageStyles());
      showToast("PNG 已经准备好了");
    } catch (error) {
      console.error("PNG export failed", error);
      showToast(error instanceof Error ? error.message : "图片暂时无法生成");
    } finally {
      setBusy("");
    }
  }

  async function doExportHtml() {
    if (view === "tickets" && trip) {
      if (busy === "ticket-export") return;
      setBusy("ticket-export"); showToast("正在打包完整票据、二维码与 PDF…");
      try { await exportTicketsHtml(trip, collectPageStyles()); showToast("完整离线票夹已导出"); }
      catch (error) { showToast(error instanceof Error ? error.message : "导出未完成，请重试"); }
      finally { setBusy(""); }
      return;
    }
    if (!exportRef.current || !trip) return;
    exportTripHtml(trip, exportRef.current.outerHTML, collectPageStyles());
    showToast("HTML 已经准备好了");
  }

  function collectPageStyles(): string {
    return Array.from(window.document.styleSheets).map((sheet) => {
      try { return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"); }
      catch { return ""; }
    }).join("\n");
  }

  async function importBackup(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as TravelDocument;
      if (parsed.version !== 1 || !Array.isArray(parsed.trips) || !parsed.trips.length) throw new Error();
      const restored: TravelDocument = { ...parsed, trips: parsed.trips.map((savedTrip) => ({ ...savedTrip, cities: sortCitiesByDate(savedTrip.cities.map((savedCity) => syncCityDatesFromDays(savedCity, savedTrip.startDate)), savedTrip.startDate) })) };
      await saveDocument(restored);
      setDocument(restored);
      const restoredTrip = restored.trips.find((item) => item.id === restored.activeTripId) || restored.trips[0];
      setActiveCityId(restoredTrip.cities[0]?.id || "");
      setView("trip");
      await requestPersistentStorage().catch(() => false);
      showToast("离线包已保存到这台设备，图片和行程都回来了");
    } catch {
      showToast("这个文件不是可用的旅卡离线包");
    }
  }

  async function importBulkPackage(file: File) {
    try {
      const imported = await importTripPackage(file);
      if (!window.confirm(`用“${imported.title}”覆盖当前旅行？当前旅行的城市、地点、票据和账目都会被替换。`)) return;
      const replacement = { ...imported, id: trip.id };
      setDocument((current) => ({ ...current, trips: current.trips.map((item) => item.id === current.activeTripId ? replacement : item) }));
      setActiveCityId(replacement.cities[0].id);
      setView("trip");
      showToast("素材包已经整理并覆盖当前旅行");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "素材包无法读取");
    } finally {
      if (bulkImportRef.current) bulkImportRef.current.value = "";
    }
  }

  if (!trip) return <div className="loading-screen">正在打开旅卡排版室…</div>;

  return (
    <>
    <TravelBgm />
    {introOpen && <OpeningIntro onDone={() => setIntroOpen(false)} />}
    <div className="app-shell">
      <Sidebar view={view} onView={(next) => { setCityDetail(false); setView(next); }} onNewTrip={() => setModal("trip")} />
      <main className="main-shell">
        <Topbar trip={trip} view={view} onSettings={() => setView("settings")} onExportHtml={doExportHtml} onExportPng={doExportPng} busy={busy === "export"} />
        <div className="page-scroll">
          {view === "home" && <HomeView document={document} onOpenTrip={(id) => { setCityDetail(false); setDocument((current) => ({ ...current, activeTripId: id })); setView("trip"); }} onCover={setTripCover} onNew={() => setModal("trip")} />}
          {view === "trip" && city && (
            <TripView
              refElement={exportRef}
              detail={cityDetail}
              onBack={() => { setCityDetail(false); window.scrollTo({ top: 0 }); }}
              trip={trip}
              city={city}
              busy={busy}
              onOpenCity={openCity}
              onCover={setCityCover}
              onEditCity={(id) => { setActiveCityId(id); setModal("editCity"); }}
              onRemoveCity={(id) => { if (trip.cities.length <= 1) return showToast("一段旅行至少保留一座城市"); if (!window.confirm("删除整张城市卡？其中的日期和地点也会一起移除。")) return; const remaining = trip.cities.filter((item) => item.id !== id); updateTrip((current) => ({ ...current, cities: current.cities.filter((item) => item.id !== id) })); if (id === activeCityId) setActiveCityId(remaining[0]?.id || ""); }}
              onPlaceImage={setPlaceImages}
              onNewCity={() => setModal("city")}
              onNewJournal={() => setModal("journal")}
              onNewDay={() => updateCity((current) => ({ ...current, days: [...current.days, { id: uid("day"), date: `Day ${current.days.length + 1}`, weekday: "", title: "新的一天", places: [] }] }))}
              onRemoveDay={(dayId) => { if (window.confirm("删除这一天？当天的地点也会一起移除。")) updateTrip((current) => { const cities = current.cities.map((item) => item.id === city.id ? syncCityDatesFromDays({ ...item, days: item.days.filter((day) => day.id !== dayId) }, current.startDate) : item); return { ...current, cities: sortCitiesByDate(cities, current.startDate) }; }); }}
              onNewPlace={(dayId) => { setModalDayId(dayId); setModal("place"); }}
              onSummarize={enrichPlace}
              onToggleLock={(dayId, placeId) => updateCity((current) => ({ ...current, days: current.days.map((day) => day.id === dayId ? { ...day, places: day.places.map((place) => place.id === placeId ? { ...place, locked: !place.locked } : place) } : day) }))}
              onRemovePlace={(dayId, placeId) => updateCity((current) => ({ ...current, days: current.days.map((day) => day.id === dayId ? { ...day, places: day.places.filter((place) => place.id !== placeId) } : day) }))}
              onOptimize={prepareOptimization}
              onAssistant={() => setView("assistant")}
              onExpense={() => setModal("expense")}
              onTicket={() => setModal("ticket")}
            />
          )}
          {view === "map" && city && <MapView city={city} places={allPlaces} onOpenCity={openCity} />}
          {view === "tickets" && <TicketsView onExport={() => void doExportHtml()} trip={trip} onAdd={() => setModal("ticket")} onEdit={(id) => { setEditingTicketId(id); setModal("editTicket"); }} onRemove={(id) => { const target = trip.tickets.find((item) => item.id === id); if (window.confirm(`删除票据“${target?.title || "未命名票据"}”？`)) updateTrip((current) => ({ ...current, tickets: current.tickets.filter((item) => item.id !== id) })); }} />}
          {view === "expenses" && <ExpensesView trip={trip} onAdd={() => setModal("expense")} onRemove={(id) => updateTrip((current) => ({ ...current, expenses: current.expenses.filter((item) => item.id !== id) }))} />}
          {view === "assistant" && <AssistantView trip={trip} draft={chatDraft} onDraft={setChatDraft} onSend={sendChat} busy={busy === "chat"} onOptimize={prepareOptimization} onExpense={() => setModal("expense")} />}
          {view === "settings" && <SettingsView settings={settings} onSettings={setSettings} onSave={saveSettings} onBackup={() => exportJson(document, trip.title)} onImport={() => importRef.current?.click()} onBulkImport={() => bulkImportRef.current?.click()} onDownloadTemplate={downloadTripPackageTemplate} onPersist={async () => showToast(await requestPersistentStorage() ? "这台设备会尽量长久保留旅行资料" : "浏览器会继续自动保存旅行资料")} />}
        </div>
      </main>
      <MobileNav view={view} onView={(next) => { setCityDetail(false); setView(next); }} />
      <input ref={importRef} className="hidden" type="file" accept=".json,application/json,text/json" onChange={(event) => event.target.files?.[0] && void importBackup(event.target.files[0])} />
      <input ref={bulkImportRef} className="hidden" type="file" accept=".zip,application/zip" onChange={(event) => event.target.files?.[0] && void importBulkPackage(event.target.files[0])} />
      {modal === "trip" && <NewTripModal onClose={() => setModal("none")} onCreate={(created) => { setDocument((current) => ({ ...current, trips: [created, ...current.trips], activeTripId: created.id })); setActiveCityId(created.cities[0].id); setView("trip"); setModal("none"); }} />}
      {modal === "city" && <NewCityModal tripStartDate={trip.startDate} onClose={() => setModal("none")} onCreate={(created) => { updateTrip((current) => ({ ...current, cities: sortCitiesByDate([...current.cities, created], current.startDate) })); setActiveCityId(created.id); setModal("none"); }} />}
      {modal === "editCity" && city && <NewCityModal tripStartDate={trip.startDate} initial={city} onClose={() => setModal("none")} onCreate={(edited) => { updateTrip((current) => ({ ...current, cities: sortCitiesByDate(current.cities.map((item) => item.id === city.id ? { ...edited, id: city.id, cover: city.cover, days: city.days } : item), current.startDate) })); setModal("none"); showToast("城市卡已经按日期更新顺序"); }} />}
      {modal === "journal" && city && <JournalModal city={city} onClose={() => setModal("none")} onCreate={(entry) => { updateCity((current) => ({ ...current, journal: [entry, ...(current.journal || [])] })); setModal("none"); showToast("这篇城市 Journal 已经收好了"); }} />}
      {modal === "place" && city && <NewPlaceModal onClose={() => setModal("none")} onCreate={(created) => { updateCity((current) => {
        if (!current.days.length) return { ...current, days: [{ id: uid("day"), date: "Day 1", weekday: "", title: "抵达与散步", places: [created] }] };
        return { ...current, days: current.days.map((day) => day.id === modalDayId ? { ...day, places: [...day.places, created] } : day) };
      }); setModal("none"); }} />}
      {modal === "ticket" && <TicketEditor settings={settings} cityId={city?.id || trip.cities[0]?.id || ""} onClose={() => setModal("none")} onCreate={(created) => { updateTrip((current) => ({ ...current, tickets: [created, ...current.tickets] })); setModal("none"); showToast("票据已经收好了"); }} />}
      {modal === "editTicket" && <TicketEditor settings={settings} initial={trip.tickets.find((item) => item.id === editingTicketId)} cityId={city?.id || trip.cities[0]?.id || ""} onClose={() => setModal("none")} onCreate={(edited) => { updateTrip((current) => ({ ...current, tickets: current.tickets.map((item) => item.id === editingTicketId ? { ...edited, id: item.id } : item) })); setModal("none"); showToast("票据已经更新"); }} />}
      {modal === "expense" && city && <ExpenseModal draft={expenseDraft} onDraft={setExpenseDraft} busy={busy === "expense"} onQuick={quickExpense} onClose={() => setModal("none")} onManual={(created) => { updateTrip((current) => ({ ...current, expenses: [created, ...current.expenses] })); setModal("none"); showToast("这一笔已经记下"); }} cityId={city.id} />}
      {modal === "route" && city && <RouteModal city={city} optimized={optimized} onClose={() => setModal("none")} onAccept={acceptOptimization} />}
      <FloatingAssistant open={assistantOpen} onOpen={() => setAssistantOpen(true)} onClose={() => setAssistantOpen(false)} trip={trip} draft={chatDraft} onDraft={setChatDraft} onSend={sendChat} busy={busy === "chat"} onTicket={() => setModal("ticket")} onExpense={() => setModal("expense")} />
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
    </>
  );
}

function SettingsIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16" /><rect x="7" y="4" width="4" height="6" rx="2" fill="#e8c547" /><rect x="14" y="14" width="4" height="6" rx="2" fill="#f06349" /></svg>;
}

function TravelBgm() {
  const audio = useRef<HTMLAudioElement>(null);
  const [enabled, setEnabled] = useState(() => { try { return localStorage.getItem("bontrip-bgm") !== "off"; } catch { return true; } });
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const start = () => { if (enabled && audio.current) { audio.current.volume = .35; void audio.current.play().catch(() => setPlaying(false)); } };
    const toggle = () => setEnabled((current) => !current);
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("bontrip-bgm-start", start);
    window.addEventListener("bontrip-bgm-toggle", toggle);
    try { localStorage.setItem("bontrip-bgm", enabled ? "on" : "off"); } catch { /* storage unavailable */ }
    if (enabled) start(); else audio.current?.pause();
    return () => { window.removeEventListener("pointerdown", start); window.removeEventListener("bontrip-bgm-start", start); window.removeEventListener("bontrip-bgm-toggle", toggle); };
  }, [enabled]);
  return <div className="travel-bgm export-hide"><audio ref={audio} src="./assets/paws-and-passport.mp3" loop preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /><button aria-label={playing ? "关闭背景音乐" : "播放背景音乐"} aria-pressed={playing} onClick={() => { if (enabled && !playing) void audio.current?.play().catch(() => {}); else setEnabled(!enabled); }}><span>♪</span>{playing ? "音乐开" : "音乐关"}</button></div>;
}

function OpeningIntro({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [muted, setMuted] = useState(false);
  const [soundMessage, setSoundMessage] = useState("");

  function rememberAndClose() {
    try { window.sessionStorage.setItem("bontrip-opening-seen", "1"); } catch { /* private mode */ }
    onDone();
  }

  useEffect(() => {
    if (!running) return;
    const leaveTimer = window.setTimeout(() => setLeaving(true), 4300);
    const doneTimer = window.setTimeout(rememberAndClose, 5200);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(doneTimer);
    };
  }, [running]);

  async function beginJourney() {
    if (running) return;
    setRunning(true);
    window.dispatchEvent(new CustomEvent("bontrip-bgm-start"));
  }

  async function toggleSound() {
    setMuted(!muted);
    window.dispatchEvent(new CustomEvent("bontrip-bgm-toggle"));
    setSoundMessage("");
  }

  return <section className={`opening-intro export-hide ${running ? "is-running" : ""} ${leaving ? "is-leaving" : ""}`} aria-label="旅卡排版室开场">
    <div className="opening-stamp opening-stamp-a">BON<br />VOYAGE</div>
    <div className="opening-stamp opening-stamp-b">PAWS<br />ABROAD</div>
    <div className="opening-route" aria-hidden="true"><i /><i /><i /><i /></div>
    <button className="opening-sound" onClick={() => void toggleSound()} aria-label={muted ? "打开开场音乐" : "关闭开场音乐"}>{muted ? "♪̸" : "♪"}</button>
    <button className="opening-skip" onClick={rememberAndClose}>跳过</button>
    <div className="opening-copy">
      <span>PAWS &amp; PASSPORT</span>
      <h1>旅卡排版室</h1>
      <p>猫爪已经盖章，准备出发。</p>
    </div>
    <div className="opening-cat-wrap">
      <div className="opening-sun" />
      <img src="./assets/bontrip-travel.png" alt="带着护照出发的旅行猫咪" />
      <div className="opening-ticket"><small>BOARDING PASS</small><strong>下一站 · 好天气</strong><b>✦</b></div>
    </div>
    {!running && <button className="opening-start" onClick={() => void beginJourney()}><span>带我出发</span><b>→</b></button>}
    {running && <div className="opening-progress" aria-label="正在出发"><i /></div>}
    {soundMessage && <p className="opening-sound-message" aria-live="polite">{soundMessage}</p>}
  </section>;
}

function Sidebar({ view, onView, onNewTrip }: { view: ViewName; onView: (value: ViewName) => void; onNewTrip: () => void }) {
  return <aside className="sidebar export-hide"><div className="brand"><span>旅</span><div><strong>旅卡排版室</strong><small>Travel Card Studio</small></div></div><button className="new-trip-button" onClick={onNewTrip}>＋ 新建旅行</button><nav>{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => onView(item.id)}><i>{item.image ? <img src={item.image} alt="" /> : item.id === "settings" ? <SettingsIcon /> : item.icon}</i>{item.label}</button>)}</nav><div className="sidebar-illustration"><img src="./assets/bontrip-travel.png" alt="旅行小猫" /><p>在路上，<br />收集风景，<br />也收集自己。</p></div></aside>;
}

function MobileNav({ view, onView }: { view: ViewName; onView: (value: ViewName) => void }) {
  return <nav className="mobile-nav export-hide">{navItems.filter((item) => ["home", "trip", "map", "tickets", "expenses", "assistant"].includes(item.id)).map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => onView(item.id)}><i>{item.image ? <img src={item.image} alt="" /> : item.icon}</i><span>{item.label === "我的旅行" ? "行程" : item.label.replace("本", "")}</span></button>)}</nav>;
}

function Topbar({ trip, view, onSettings, onExportHtml, onExportPng, busy }: { trip: Trip; view: ViewName; onSettings: () => void; onExportHtml: () => void; onExportPng: () => void; busy: boolean }) {
  const title = navItems.find((item) => item.id === view)?.label || trip.title;
  return <header className="topbar export-hide"><div><span className="eyebrow">{trip.startDate} — {trip.endDate}</span><h1>{view === "trip" ? trip.title : title}</h1></div><div className="top-actions"><button className="settings-shortcut" onClick={onSettings} aria-label="打开设置"><SettingsIcon /></button><button onClick={onExportHtml}>⇩ HTML</button><button onClick={onExportPng} disabled={busy}>{busy ? "整理中…" : "⇩ PNG"}</button></div></header>;
}

function HomeView({ document, onOpenTrip, onCover, onNew }: { document: TravelDocument; onOpenTrip: (id: string) => void; onCover: (id: string, file: File) => void; onNew: () => void }) {
  return <section className="home-page"><header className="page-intro"><span className="eyebrow">MY TRAVEL CARDS</span><h2>下一次出发，想去哪里？</h2><p>把散落在地图、票夹和脑海里的小念头，收进一张张旅行卡片。</p></header><div className="trip-library">{document.trips.map((trip, index) => <article className={`library-trip ${trip.cover ? "has-cover" : ""}`} key={trip.id} style={{ backgroundColor: ["#ead8ef", "#dcefd9", "#f4dfc7"][index % 3] }}>{trip.cover && <img src={trip.cover} alt={`${trip.title}封面`} />}<button className="library-trip-open" onClick={() => onOpenTrip(trip.id)}><span>已保存</span><h3>{trip.title}</h3><p>{trip.startDate} 至 {trip.endDate}</p><strong>{trip.cities.length} 个城市 · {trip.cities.flatMap((city) => city.days.flatMap((day) => day.places)).length} 个地点</strong><i>{trip.cities.slice(0, 3).map((city) => city.name.slice(0, 1)).join(" · ")}</i></button><label className="trip-cover-upload">▣ {trip.cover ? "更换封面" : "设置封面"}<input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onCover(trip.id, event.target.files[0])} /></label></article>)}<button className="library-trip add" onClick={onNew}><span>＋</span><h3>新建一段旅行</h3></button></div></section>;
}

function TripView({ detail, onBack, refElement, trip, city, busy, onOpenCity, onCover, onEditCity, onRemoveCity, onPlaceImage, onNewCity, onNewJournal, onNewDay, onRemoveDay, onNewPlace, onSummarize, onToggleLock, onRemovePlace, onOptimize, onAssistant, onExpense, onTicket }: { detail: boolean; onBack: () => void; refElement: React.RefObject<HTMLDivElement | null>; trip: Trip; city: City; busy: string; onOpenCity: (id: string) => void; onCover: (city: City, file: File) => void; onEditCity: (id: string) => void; onRemoveCity: (id: string) => void; onPlaceImage: (dayId: string, placeId: string, files: File[]) => void; onNewCity: () => void; onNewJournal: () => void; onNewDay: () => void; onRemoveDay: (dayId: string) => void; onNewPlace: (dayId: string) => void; onSummarize: (dayId: string, place: Place) => void; onToggleLock: (dayId: string, placeId: string) => void; onRemovePlace: (dayId: string, placeId: string) => void; onOptimize: () => void; onAssistant: () => void; onExpense: () => void; onTicket: () => void }) {
  const onRandomTrack = undefined;
  const onAiTrack = undefined;
  useEffect(() => {
    const edit = (event: Event) => onEditCity((event as CustomEvent<string>).detail);
    const remove = (event: Event) => onRemoveCity((event as CustomEvent<string>).detail);
    window.addEventListener("travel-city-edit", edit);
    window.addEventListener("travel-city-remove", remove);
    return () => { window.removeEventListener("travel-city-edit", edit); window.removeEventListener("travel-city-remove", remove); };
  }, [onEditCity, onRemoveCity]);
  const routeTitle = trip.cities.map((item) => item.name).join(" → ");
  return <div className="trip-page" ref={refElement}>
    <section className="export-only export-title"><span>TRAVEL CARD · {trip.cities.length} STOPS</span><h1>{trip.title}</h1><p>{trip.startDate} — {trip.endDate}</p><small>{routeTitle}</small></section>
    <section className="trip-heading"><div><span className="eyebrow">{routeTitle}</span><p>{trip.startDate} — {trip.endDate}</p></div><MusicCard trip={trip} busy={busy === "track"} onRandom={onRandomTrack} onAi={onAiTrack} /></section>
    {!detail && <section className="city-strip city-overview"><header><div><h2>城市卡片</h2><span>{trip.cities.length} STOPS</span></div><button className="text-button export-hide" onClick={onNewCity}>＋ 添加城市</button></header><div>{trip.cities.map((item) => <CityCard key={item.id} city={item} tripStartDate={trip.startDate} active={item.id === city.id} onOpen={() => onOpenCity(item.id)} onCover={(file) => onCover(item, file)} />)}<button className="city-add-card export-hide" onClick={onNewCity}>＋<span>下一座城市</span></button></div></section>}
    {detail && <button className="text-button city-back export-hide" onClick={onBack}>← 所有城市</button>}
    {detail && <div className="trip-workspace"><section className="itinerary-card">
      <header className="section-title-row"><div><span className="eyebrow">TODAY IN {city.englishName.toUpperCase()}</span><h2>{city.name} · 顺路行程</h2><p>{city.note}</p></div><div className="itinerary-heading-actions export-hide"><button className="text-button" onClick={onNewJournal}>＋ 写 Journal</button><button className="text-button" onClick={onNewDay}>＋ 新增一天</button><button className="primary-button" onClick={onOptimize} disabled={busy === "route"}>{busy === "route" ? "正在整理…" : "✦ 重新排顺"}</button></div></header>
      <CityJournal city={city} onAdd={onNewJournal} />
      {city.days.length ? city.days.map((day) => <DaySection key={day.id} day={day} onAdd={() => onNewPlace(day.id)} onRemove={() => onRemoveDay(day.id)}>{day.places.map((place, index) => <PlaceRow key={place.id} place={place} city={city} index={index} isLast={index === day.places.length - 1} busy={busy === place.id} onSummarize={() => onSummarize(day.id, place)} onToggleLock={() => onToggleLock(day.id, place.id)} onRemove={() => onRemovePlace(day.id, place.id)} onImages={(files) => onPlaceImage(day.id, place.id, files)} />)}</DaySection>) : <EmptyDay onAdd={() => { onNewDay(); }} />}
    </section><aside className="trip-side export-hide"><section className="quick-card assistant-quick"><span>✦</span><div><h3>行程助手</h3><p>一起整理地点、看点与每天的节奏。</p></div><button onClick={onAssistant}>聊一聊</button></section><section className="quick-card"><span>▦</span><div><h3>随手记账</h3><p>{trip.expenses.length} 笔旅行支出已经收好。</p></div><button onClick={onExpense}>记一笔</button></section><section className="quick-card"><span>▱</span><div><h3>票据夹</h3><p>{trip.tickets.length} 张车票、门票与预订单。</p></div><button onClick={onTicket}>加票据</button></section></aside></div>}
  </div>;
}

function MusicCard(_props: { trip: Trip; busy: boolean; onRandom?: () => void; onAi?: () => void }) { return null; }

function CityJournal({ city, onAdd }: { city: City; onAdd: () => void }) {
  const entries = city.journal || [];
  return <section className={`city-journal ${entries.length ? "has-entries" : "is-empty"}`}>
    <header><div><span className="eyebrow">CITY JOURNAL</span><h3>{city.name}的旅行手记</h3></div><button className="text-button export-hide" onClick={onAdd}>＋ 写一篇</button></header>
    {entries.length ? <div className="journal-grid">{entries.map((entry) => <article key={entry.id}>{entry.images.length ? <div className={`journal-images count-${Math.min(3, entry.images.length)}`}>{entry.images.slice(0, 3).map((image, index) => <img key={`${entry.id}-${index}`} src={image} alt={`${entry.title}照片 ${index + 1}`} />)}</div> : <div className="journal-image-empty">JOURNAL</div>}<div className="journal-copy"><time>{entry.date}</time><h4>{entry.title}</h4><p>{entry.text}</p></div></article>)}</div> : <button className="journal-empty-card export-hide" onClick={onAdd}><span>＋</span><strong>挑几张今天最有代表性的照片</strong><small>把一天写成一页杂志式城市手记</small></button>}
  </section>;
}

function EmptyDay({ onAdd }: { onAdd: () => void }) { return <div className="empty-state"><span>⌖</span><h3>这座城市还留着一页空白</h3><p>先建第一天，再慢慢把地点和路线串起来。</p><button className="primary-button" onClick={onAdd}>＋ 新建第一天</button></div>; }

function MapView({ city, places, onOpenCity }: { city: City; places: Place[]; onOpenCity: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const scopedSearch = search.trim() || "景点";
  return <section className="map-page">
    <header className="page-intro"><span className="eyebrow">MAP DESK</span><h2>{city.name}地图导览</h2><p>所有搜索都会限定在 {city.englishName}{city.country ? ` · ${city.country}` : ""}，不会再按设备当前位置寻找。</p></header>
    <section className="map-search-desk"><label><span>搜索目的地附近</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`咖啡馆、酒店或景点 · ${city.name}`} /></label><div><a href={appleMapsUrl(scopedSearch, city)} target="_blank" rel="noreferrer"> Apple 地图搜索</a><a href={googleMapsUrl(scopedSearch, city)} target="_blank" rel="noreferrer">G Google 地图搜索</a></div></section>
    <div className="map-layout"><section className="paper-map"><div className="map-lines">{places.map((place, index) => <div className="map-pin" key={place.id} style={{ left: `${18 + (index * 23) % 68}%`, top: `${18 + (index * 31) % 60}%` }}><span>{index + 1}</span><small>{place.name}</small></div>)}</div><div className="map-route-actions"><a href={appleRouteUrl(places, city)} target="_blank" rel="noreferrer">在 Apple 地图打开</a><a href={googleRouteUrl(places, city)} target="_blank" rel="noreferrer">在 Google 地图打开</a></div></section><aside className="map-place-list"><header><h3>{places.length} 个地点</h3></header>{places.map((place, index) => <article key={place.id}><span>{index + 1}</span><div><small>{place.category}</small><strong>{place.name}</strong><p>{place.time} · {place.duration}</p></div><div><a href={appleMapsUrl(place, city)} target="_blank" rel="noreferrer"></a><a href={googleMapsUrl(place, city)} target="_blank" rel="noreferrer">G</a></div></article>)}</aside></div><div className="city-switcher"><button onClick={() => onOpenCity(city.id)}>{city.name}</button></div>
  </section>;
}

function ExpensesView({ trip, onAdd, onRemove }: { trip: Trip; onAdd: () => void; onRemove: (id: string) => void }) {
  const totals = useMemo(() => Object.entries(trip.expenses.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.currency]: (acc[item.currency] || 0) + item.amount }), {})), [trip.expenses]);
  return <section className="expenses-page"><header className="page-intro row"><div><span className="eyebrow">TRAVEL LEDGER</span><h2>随手记下，回来再算</h2><p>每一笔都可以关联城市、日期和用途。</p></div><button className="primary-button" onClick={onAdd}>＋ 记一笔</button></header><div className="expense-layout"><section className="expense-summary"><small>旅行支出</small><div>{totals.map(([currency, amount]) => <strong key={currency}>{currency} {amount.toFixed(2)}</strong>)}</div><p>{trip.expenses.length} 笔 · {new Set(trip.expenses.map((item) => item.cityId)).size} 个城市</p></section><section className="expense-list">{trip.expenses.map((expense) => <article key={expense.id}><span>{expense.category === "交通" ? "↗" : expense.category === "餐饮" ? "◌" : expense.category === "门票" ? "▱" : "◇"}</span><div><strong>{expense.title}</strong><small>{trip.cities.find((city) => city.id === expense.cityId)?.name} · {expense.date}</small></div><b>{expense.currency} {expense.amount.toFixed(2)}</b><button onClick={() => onRemove(expense.id)}>×</button></article>)}</section></div></section>;
}

function AssistantView({ trip, draft, onDraft, onSend, busy, onOptimize, onExpense }: { trip: Trip; draft: string; onDraft: (value: string) => void; onSend: (event: FormEvent) => void; busy: boolean; onOptimize: () => void; onExpense: () => void }) {
  return <section className="assistant-page"><header className="assistant-header"><div className="assistant-avatar"><img src="./assets/travel-assistant-avatar.png" alt="" /></div><div><span className="eyebrow">TRIP COMPANION</span><h2>{trip.title}的旅行助手</h2><p>可以从一个模糊念头开始，我们慢慢把它排成路。</p></div></header><div className="assistant-layout"><section className="chat-card"><div className="chat-messages">{trip.chats.map((message) => <article key={message.id} className={message.role}><span>{message.role === "assistant" ? "旅" : "我"}</span><p>{message.content}</p></article>)}{busy && <article className="assistant"><span>旅</span><p>我在翻一翻你的旅行…</p></article>}</div><form onSubmit={onSend}><textarea value={draft} disabled={busy} onChange={(event) => onDraft(event.target.value)} onKeyDown={sendOnEnter} placeholder="想把哪一天排得更松一点？" /><button disabled={busy || !draft.trim()}>➤</button></form></section><aside className="assistant-tools"><button onClick={onOptimize}><span>⌘</span><strong>重新排顺路线</strong><small>保留固定地点</small></button><button onClick={onExpense}><span>▦</span><strong>随手记一笔</strong><small>一句话就够</small></button></aside></div></section>;
}

function FloatingAssistant({ open, onOpen, onClose, trip, draft, onDraft, onSend, busy, onTicket, onExpense }: { open: boolean; onOpen: () => void; onClose: () => void; trip: Trip; draft: string; onDraft: (value: string) => void; onSend: (event: FormEvent) => void; busy: boolean; onTicket: () => void; onExpense: () => void }) {
  return <aside className={`floating-assistant export-hide ${open ? "open" : ""}`}>
    {open && <section className="floating-assistant-panel"><header><img src="./assets/travel-assistant-avatar.png" alt="旅行助手 Avatar" /><div><strong>旅行助手</strong><small>DeepSeek · 可以直接修改这趟旅行</small></div><button onClick={onClose} aria-label="收起旅行助手">×</button></header><div className="floating-assistant-messages">{trip.chats.slice(-5).map((message) => <article key={message.id} className={message.role}><span>{message.role === "assistant" ? "旅" : "我"}</span><p>{message.content}</p></article>)}{busy && <article className="assistant"><span>旅</span><p>正在把内容整理进旅行卡…</p></article>}</div><div className="floating-assistant-quick"><button onClick={onTicket}>＋ 票据</button><button onClick={onExpense}>＋ 记账</button><button onClick={() => onDraft("城市：\n日期：\n请把下面的攻略正文整理成行程，保留原有地点，安排建议时间：\n")}>＋ 攻略</button><button onClick={() => onDraft("帮我把当前城市的路线重新排顺并调整建议时间")}>排顺路线</button></div><form onSubmit={onSend}><textarea value={draft} disabled={busy} onChange={(event) => onDraft(event.target.value)} onKeyDown={sendOnEnter} placeholder="粘贴攻略正文，写上城市和日期，例如：维也纳，2026-09-17。整理成当天行程并安排时间…" /><button disabled={busy || !draft.trim()}>➤</button></form></section>}
    <button className="floating-assistant-trigger" onClick={open ? onClose : onOpen} aria-label={open ? "收起旅行助手" : "打开旅行助手"}><img src="./assets/travel-assistant-avatar.png" alt="" /><span>{open ? "×" : "问问旅行助手"}</span></button>
  </aside>;
}

function SettingsView({ settings, onSettings, onSave, onBackup, onImport, onBulkImport, onDownloadTemplate, onPersist }: { settings: AssistantSettings; onSettings: (value: AssistantSettings) => void; onSave: (event: FormEvent) => void; onBackup: () => void; onImport: () => void; onBulkImport: () => void; onDownloadTemplate: () => void; onPersist: () => void }) {
  const [connectionStatus, setConnectionStatus] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  async function testConnection() {
    setTestingConnection(true); setConnectionStatus("正在检查连接…");
    try { setConnectionStatus(await testAssistantConnection(settings)); }
    catch (error) { setConnectionStatus(error instanceof Error ? error.message : "连接检查失败"); }
    finally { setTestingConnection(false); }
  }
  return <section className="settings-page">
    <header className="page-intro"><span className="eyebrow">PREFERENCES</span><h2>把旅卡留在自己的设备里</h2><p>旅行资料保存在当前设备；需要换设备时，可以用一个离线包完整带走。</p></header>
    <div className="settings-grid">
      <form className="settings-card" onSubmit={onSave}><header><span>✦</span><div><h3>DeepSeek 旅行助手</h3><p>聊天可以直接写入城市、地点、票据与账目。</p></div></header><label><span>服务地址</span><input value={settings.baseUrl} onChange={(event) => onSettings({ ...settings, baseUrl: event.target.value })} placeholder="https://api.deepseek.com" /><small>官方地址： https://api.deepseek.com</small></label><label><span>访问密钥</span><input type="password" autoComplete="current-password" value={settings.apiKey} onChange={(event) => onSettings({ ...settings, apiKey: event.target.value })} placeholder="••••••••••••" /></label><label><span>模型</span><select value={settings.model} onChange={(event) => onSettings({ ...settings, model: event.target.value })}><option value="deepseek-v4-flash">V4 Flash · 日常规划</option><option value="deepseek-v4-pro">V4 Pro · 精细规划</option></select></label><div className="settings-connection-actions"><button className="primary-button">保存连接</button><button type="button" onClick={() => onSettings({ ...settings, baseUrl: "https://api.deepseek.com" })}>恢复官方地址</button><button type="button" onClick={testConnection} disabled={testingConnection}>{testingConnection ? "检查中…" : "测试连接"}</button></div>{connectionStatus && <p className={connectionStatus.startsWith("连接成功") ? "connection-status success" : "connection-status"}>{connectionStatus}</p>}</form>
      <section className="settings-card transfer-card"><header><span>⇄</span><div><h3>Mac → iPad 离线迁移</h3><p>离线包包含所有旅行、城市、景点、美食、票据、账目和已上传图片。</p></div></header><div className="settings-actions"><button className="transfer-primary" onClick={onBackup}>导出 iPad 离线包 · 含图片</button><button onClick={onImport}>在这台设备导入离线包</button><button onClick={onPersist}>允许长期离线保留</button></div><ol className="transfer-steps"><li>在 Mac 导出 JSON 文件，并用 AirDrop 发到 iPad。</li><li>iPad 打开旅卡网页，在这里选择“导入离线包”。</li><li>导入后会自动保存到 iPad；首次联网打开后，也可以离线查看。</li></ol><small>DeepSeek API 密钥不会写进离线包，需要在新设备单独配置。</small></section>
      <section className="settings-card"><header><span>▦</span><div><h3>批量素材模板</h3><p>适合第一次把大量文字和图片整理成一趟新旅行，会覆盖当前旅行。</p></div></header><div className="settings-actions"><button onClick={onDownloadTemplate}>下载 ZIP 素材包模板</button><button onClick={onBulkImport}>导入 ZIP · 覆盖当前旅行</button></div></section>
    </div>
  </section>;
}

function NewTripModal({ onClose, onCreate }: { onClose: () => void; onCreate: (trip: Trip) => void }) {
  const [cover, setCover] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const cityId = uid("city"); const startDate = String(data.get("start") || ""); const endDate = String(data.get("end") || startDate); const created: Trip = { id: uid("trip"), title: String(data.get("title") || "新的旅行"), startDate: startDate || "待定", endDate: endDate || "待定", subtitle: String(data.get("subtitle") || "慢慢收集沿途的小事"), cover: cover || undefined, updatedAt: new Date().toISOString(), track: { title: "", artist: "", reason: "", url: "" }, cities: [{ id: cityId, name: String(data.get("city") || "第一站"), englishName: "First stop", startDate, endDate: startDate, dates: cityDateRange(startDate, startDate), note: "给这座城市留一点空白。", color: "#eadccf", days: [{ id: uid("day"), date: startDate || "Day 1", weekday: "", title: "抵达与散步", places: [] }] }], tickets: [], expenses: [], chats: [{ id: uid("chat"), role: "assistant", content: "旅行已经建好了。先放进几个想去的地方吧。", createdAt: new Date().toISOString() }] }; onCreate(created); }
  return <Modal title="新建一段旅行" eyebrow="NEW JOURNEY" onClose={onClose}><form className="modal-form" onSubmit={submit}><ImagePicker value={cover} label="旅行封面" onChange={setCover} /><label><span>旅行名称</span><input name="title" placeholder="欧洲之行" required /></label><div className="form-row"><label><span>出发</span><input name="start" type="date" /></label><label><span>回来</span><input name="end" type="date" /></label></div><label><span>第一座城市</span><input name="city" placeholder="布鲁塞尔" required /></label><label><span>这趟旅行</span><input name="subtitle" placeholder="城市、山与慢火车" /></label><footer><button type="button" onClick={onClose}>取消</button><button className="primary-button">开始收集</button></footer></form></Modal>;
}

function NewCityModal({ initial, tripStartDate, onClose, onCreate }: { initial?: City; tripStartDate: string; onClose: () => void; onCreate: (city: City) => void }) {
  const defaultStart = initial?.startDate || looseDateToIso(initial?.dates || "", tripStartDate, 0);
  const defaultEnd = initial?.endDate || looseDateToIso(initial?.dates || "", tripStartDate, 1) || defaultStart;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const startDate = String(data.get("startDate") || ""); const endDate = String(data.get("endDate") || startDate); const city: City = { id: initial?.id || uid("city"), name: String(data.get("name")), englishName: String(data.get("english") || "New city"), country: String(data.get("country") || ""), startDate, endDate, dates: cityDateRange(startDate, endDate), note: String(data.get("note") || "在这里留一点空白给偶遇。"), color: String(data.get("color") || "#e7dfc9"), cover: initial?.cover, journal: initial?.journal || [], days: initial?.days || [{ id: uid("day"), date: startDate || "Day 1", weekday: "", title: "抵达与散步", places: [] }] }; onCreate(city); }
  return <Modal title={initial ? "编辑城市卡" : "添加一座城市"} eyebrow={initial ? "EDIT STOP" : "NEXT STOP"} onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-row"><label><span>城市</span><input name="name" required placeholder="维也纳" defaultValue={initial?.name} /></label><label><span>英文名 / 当地名称</span><input name="english" placeholder="Vienna / Wien" defaultValue={initial?.englishName} /></label></div><label><span>国家 / 地区（用于限定地图搜索）</span><input name="country" placeholder="Austria" defaultValue={initial?.country} /></label><div className="form-row"><label><span>到达日期</span><input name="startDate" type="date" required defaultValue={defaultStart} /></label><label><span>离开日期</span><input name="endDate" type="date" defaultValue={defaultEnd} /></label></div><label><span>城市小记</span><textarea name="note" placeholder="想在这座城市留下什么？" defaultValue={initial?.note} /></label><label><span>卡片颜色</span><input name="color" type="color" defaultValue={initial?.color || "#e7dfc9"} /></label><footer><button type="button" onClick={onClose}>取消</button><button className="primary-button">{initial ? "保存并重排" : "放进旅程"}</button></footer></form></Modal>;
}

function NewPlaceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (place: Place) => void }) {
  const [category, setCategory] = useState<PlaceCategory>("景点");
  const [images, setImages] = useState<string[]>([]);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onCreate({ id: uid("place"), name: String(data.get("name")), mapQuery: String(data.get("mapQuery") || ""), category, time: String(data.get("time") || "10:00"), endTime: String(data.get("endTime") || ""), duration: String(data.get("duration") || "1 小时"), summary: String(data.get("summary") || ""), highlights: [], mapUrl: String(data.get("mapUrl") || ""), image: images[0] || undefined, gallery: images.slice(1) }); }
  return <Modal title="添加一个地点" eyebrow="ADD A PLACE" onClose={onClose}><form className="modal-form" onSubmit={submit}><MultiImagePicker values={images} label={category === "美食" ? "美食照片" : "地点图片"} onChange={setImages} /><div className="category-picker">{(Object.keys(categoryIcon) as PlaceCategory[]).map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{categoryIcon[item]} {item}</button>)}</div><label><span>地点名称</span><input name="name" required placeholder="美泉宫" /></label><label><span>地图检索名</span><input name="mapQuery" placeholder="Schönbrunn Palace, Vienna, Austria" /></label><div className="form-row"><label><span>开始</span><input name="time" type="time" defaultValue="10:00" /></label><label><span>结束</span><input name="endTime" type="time" /></label></div><label><span>建议停留</span><input name="duration" defaultValue="1 小时" /></label><label><span>地图链接</span><input name="mapUrl" placeholder="粘贴 Apple 或 Google 地图地点" /></label><label><span>先记一点</span><textarea name="summary" placeholder="之后也可以让行程助手补完整" /></label><footer><button type="button" onClick={onClose}>取消</button><button className="primary-button">加入这一天</button></footer></form></Modal>;
}

function ImagePicker({ value, label, onChange, square = false }: { value: string; label: string; onChange: (value: string) => void; square?: boolean }) {
  const [error, setError] = useState("");
  return <label className={`image-picker ${square ? "square" : ""}`}>{value ? <img src={value} alt={`${label}预览`} /> : <span><b>＋</b><strong>{label}</strong><small>从相册选择图片</small></span>}<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { setError(""); onChange(await readImage(file)); } catch (reason) { setError(reason instanceof Error ? reason.message : "图片无法读取"); } }} />{value && <em>点击更换</em>}{error && <i>{error}</i>}</label>;
}

function MultiImagePicker({ values, label, onChange }: { values: string[]; label: string; onChange: (values: string[]) => void }) {
  const [error, setError] = useState("");
  return <div className="multi-image-picker">
    <div className="multi-image-preview">{values.map((value, index) => <figure key={`${value.slice(-24)}-${index}`}><img src={value} alt={`${label} ${index + 1}`} /><button type="button" aria-label={`移除第 ${index + 1} 张图片`} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button></figure>)}</div>
    <label><b>＋</b><span>{values.length ? `继续添加 · 已选 ${values.length} / 12 张` : `${label} · 可同时选择多张`}</span><input type="file" accept="image/*" multiple onChange={async (event) => { const files = Array.from(event.target.files || []).slice(0, Math.max(0, 12 - values.length)); event.target.value = ""; if (!files.length) return; try { setError(""); onChange([...values, ...(await Promise.all(files.map(readImage)))].slice(0, 12)); } catch (reason) { setError(reason instanceof Error ? reason.message : "图片无法读取"); } }} /></label>
    {error && <i>{error}</i>}
  </div>;
}

function JournalModal({ city, onClose, onCreate }: { city: City; onClose: () => void; onCreate: (entry: JournalEntry) => void }) {
  const [images, setImages] = useState<string[]>([]);
  const defaultDate = city.days.at(-1)?.date.match(/^\d{4}-\d{2}-\d{2}$/) ? city.days.at(-1)!.date : city.startDate || "";
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onCreate({ id: uid("journal"), date: String(data.get("date") || defaultDate || "旅途中"), title: String(data.get("title") || `${city.name}的一天`), text: String(data.get("text") || ""), images }); }
  return <Modal title={`写一页 ${city.name} Journal`} eyebrow="CITY JOURNAL" onClose={onClose} wide><form className="modal-form journal-form" onSubmit={submit}><MultiImagePicker values={images} label="标志性照片" onChange={setImages} /><div className="form-row"><label><span>日期</span><input name="date" type="date" defaultValue={defaultDate} /></label><label><span>这一页的标题</span><input name="title" required placeholder="雨后的老城与一杯咖啡" /></label></div><label><span>今天想留下什么？</span><textarea name="text" required placeholder="写下走过的街道、意外遇见的人，或者这一刻最想记住的气味。" /></label><footer><button type="button" onClick={onClose}>取消</button><button className="primary-button">收进城市 Journal</button></footer></form></Modal>;
}

function ExpenseModal({ cityId, draft, onDraft, busy, onQuick, onClose, onManual }: { cityId: string; draft: string; onDraft: (value: string) => void; busy: boolean; onQuick: () => void; onClose: () => void; onManual: (expense: Expense) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onManual({ id: uid("expense"), cityId, date: String(data.get("date") || new Date().toISOString().slice(0, 10)), title: String(data.get("title")), amount: Number(data.get("amount")), currency: String(data.get("currency") || "¥"), category: String(data.get("category") || "其他") as Expense["category"] }); }
  return <Modal title="随手记一笔" eyebrow="QUICK LEDGER" onClose={onClose}><div className="expense-quick"><textarea value={draft} onChange={(event) => onDraft(event.target.value)} placeholder="刚才晚餐 38.5 欧，另外买了 10 欧交通卡" /><button className="primary-button" onClick={onQuick} disabled={busy || !draft.trim()}>{busy ? "正在整理…" : "✦ 帮我记下"}</button></div><div className="or-line"><span>或者自己填写</span></div><form className="modal-form compact" onSubmit={submit}><label><span>花在什么地方</span><input name="title" required placeholder="晚餐" /></label><div className="form-row three"><label><span>金额</span><input name="amount" type="number" step="0.01" required /></label><label><span>币种</span><input name="currency" defaultValue="€" /></label><label><span>分类</span><select name="category">{["交通", "餐饮", "住宿", "门票", "购物", "其他"].map((item) => <option key={item}>{item}</option>)}</select></label></div><label><span>日期</span><input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><footer><button type="button" onClick={onClose}>取消</button><button className="primary-button">记下</button></footer></form></Modal>;
}

function RouteModal({ city, optimized, onClose, onAccept }: { city: City; optimized: OptimizedDay[]; onClose: () => void; onAccept: () => void }) {
  const places = new Map(city.days.flatMap((day) => day.places).map((place) => [place.id, place]));
  return <Modal title="路线排顺了" eyebrow={city.name} onClose={onClose} wide><div className="route-preview">{optimized.map((day) => <section key={day.dayId}><header><h3>{day.title}</h3><p>{day.note}</p></header><div>{day.placeIds.map((id, index) => <article key={id}><span>{index + 1}</span><strong>{places.get(id)?.name}</strong><small>{day.times[id]?.time || places.get(id)?.time} – {day.times[id]?.endTime || places.get(id)?.endTime || "待定"} · {places.get(id)?.category}</small></article>)}</div></section>)}</div><footer className="modal-footer"><button onClick={onClose}>先不改</button><button className="primary-button" onClick={onAccept}>使用这条路线</button></footer></Modal>;
}

export default App;
