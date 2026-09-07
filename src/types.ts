export type PlaceCategory = "景点" | "美食" | "交通" | "住宿" | "购物";
export type TicketKind = "火车票" | "登机牌" | "酒店" | "门票" | "预约" | "通票";
export type ExpenseCategory = "交通" | "餐饮" | "住宿" | "门票" | "购物" | "其他";

export interface Place {
  photoFocus?: Record<string, { x: number; y: number }>;
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
  photoFocus?: Record<string, { x: number; y: number }>;
  id: string;
  date: string;
  title: string;
  text: string;
  images: string[];
}

export interface City {
  photoFocus?: Record<string, { x: number; y: number }>;
  appleGuideUrl?: string;
  dateMode?: "stay" | "days";
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
  qrCode2?: string;
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

export interface TripMember { id: string; name: string; avatar: string; isMe: boolean }
export type SplitType = "equal" | "exact" | "percentage" | "shares" | "personal";
export interface ExpenseParticipant { memberId: string; amount?: number; percentage?: number; shares?: number }
export interface Settlement { id: string; fromMemberId: string; toMemberId: string; amount: number; currency: string; date: string; note: string }
export interface Expense {
  paidBy?: string;
  splitType?: SplitType;
  participants?: ExpenseParticipant[];
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  transactionType?: "expense" | "refund";
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
  members?: TripMember[];
  settlements?: Settlement[];
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
  stickerLibrary?: StickerAsset[];
  stickers?: StickerPlacement[];
  version: 1;
  activeTripId: string;
  trips: Trip[];
}

export interface StickerAsset { id: string; image: string; name: string }
export interface StickerPlacement { id: string; assetId: string; target: string; x: number; y: number; size: number; rotation: number; note: string }

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
  | { type: "add_journal"; cityId: string; journal: Pick<JournalEntry, "title" | "text" | "date"> }
  | { type: "add_member"; name: string; avatar?: string }
  | { type: "delete_record"; entity: "expense" | "ticket" | "journal" | "place" | "day" | "city"; id: string }

  | { type: "edit_record"; entity: "trip" | "city" | "day" | "ticket" | "journal"; id: string; changes: Record<string, string | boolean> }
  | { type: "create_trip"; trip: Partial<Trip> & Pick<Trip, "title"> }
  | { type: "open_ticket" }
  | { type: "open_expense" }
  | { type: "optimize_route"; date?: string; cityName?: string }
  | { type: "add_city"; city: Partial<City> & Pick<City, "name"> }
  | { type: "add_place"; cityName?: string; dayTitle?: string; place: Partial<Place> & Pick<Place, "name"> }
  | { type: "update_place"; placeId?: string; cityName?: string; placeName: string; changes: Partial<Place> }
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
