export type PlaceCategory = "景点" | "美食" | "交通" | "住宿" | "购物";
export type TicketKind = "火车票" | "登机牌" | "酒店" | "门票" | "预约" | "通票";
export type ExpenseCategory = "交通" | "餐饮" | "住宿" | "门票" | "购物" | "其他";

export interface Place {
  id: string;
  name: string;
  mapQuery?: string;
  category: PlaceCategory;
  time: string;
  endTime?: string;
  summary: string;
  highlights: string[];
  duration: string;
  mapUrl?: string;
  image?: string;
  gallery?: string[];
  locked?: boolean;
}

export interface DayPlan {
  id: string;
  date: string;
  weekday: string;
  title: string;
  places: Place[];
}

export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  text: string;
  images: string[];
}

export interface City {
  id: string;
  name: string;
  englishName: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  dates: string;
  note: string;
  color: string;
  cover?: string;
  journal?: JournalEntry[];
  days: DayPlan[];
}

export interface TicketAttachment {
  id: string;
  name: string;
  data: string;
  type: "image" | "pdf";
  pages?: string[];
  text?: string;
}

export interface Ticket {
  id: string;
  kind: TicketKind;
  cityId: string;
  provider: string;
  title: string;
  date: string;
  time: string;
  meta: string;
  code: string;
  color: string;
  image?: string;
  attachment?: string;
  attachmentType?: "image" | "pdf";
  includesBreakfast?: boolean;
  qrCode?: string;
  attachments?: TicketAttachment[];
  backgroundImage?: string;
  passengers?: string;
  departureTime?: string;
  arrivalTime?: string;
  arrivalDate?: string;
  checkInDate?: string;
  checkOutDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
}

export interface Expense {
  id: string;
  cityId: string;
  date: string;
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
}

export interface Track {
  title: string;
  artist: string;
  reason: string;
  url: string;
  coverUrl?: string;
  playlistId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  subtitle: string;
  cover?: string;
  cities: City[];
  tickets: Ticket[];
  expenses: Expense[];
  track: Track;
  chats: ChatMessage[];
  updatedAt: string;
}

export interface TravelDocument {
  version: 1;
  activeTripId: string;
  trips: Trip[];
}

export interface AssistantSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  musicProvider: "youtube" | "apple";
  musicLibrary: MusicLibraryItem[];
}

export interface MusicLibraryItem {
  id: string;
  title: string;
  url: string;
  playlistId: string;
  coverUrl: string;
  note: string;
  enabled: boolean;
}

export type AssistantOperation =
  | { type: "open_ticket" }
  | { type: "open_expense" }
  | { type: "optimize_route" }
  | { type: "add_city"; city: Partial<City> & Pick<City, "name"> }
  | { type: "add_place"; cityName?: string; dayTitle?: string; place: Partial<Place> & Pick<Place, "name"> }
  | { type: "update_place"; cityName?: string; placeName: string; changes: Partial<Place> }
  | { type: "plan_day"; cityName?: string; date?: string; title?: string; replace?: boolean; places: Array<Partial<Place> & Pick<Place, "name">> }
  | { type: "add_expense"; expense: Partial<Expense> & Pick<Expense, "title" | "amount"> }
  | { type: "update_expense"; expenseId: string; changes: Partial<Omit<Expense, "id">> }
  | { type: "add_ticket"; ticket: Partial<Ticket> & Pick<Ticket, "title"> };

export interface AssistantCommandResult {
  reply: string;
  operations: AssistantOperation[];
}

export type ViewName = "home" | "trip" | "map" | "tickets" | "expenses" | "assistant" | "settings";

export const uid = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
