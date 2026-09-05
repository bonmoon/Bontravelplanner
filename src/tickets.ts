import type { Ticket, TicketAttachment } from "./types";
import { looseDateToIso } from "./dates";

export function ticketAttachments(ticket: Partial<Ticket>): TicketAttachment[] {
  if (ticket.attachments) return ticket.attachments;
  const data = ticket.attachment || ticket.image;
  return data ? [{ id: "legacy", name: "原始票据", data, type: ticket.attachmentType || (data.startsWith("data:application/pdf") ? "pdf" : "image") }] : [];
}

export function clockTime(value = ""): string {
  const match = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

export function sortTickets(tickets: Ticket[], tripDate: string): Ticket[] {
  const key = (ticket: Ticket) => `${looseDateToIso(ticket.kind === "酒店" ? ticket.checkInDate || ticket.date : ticket.date, tripDate) || "9999-12-31"}T${clockTime(ticket.kind === "酒店" ? ticket.checkInTime || ticket.time : ticket.departureTime || ticket.time) || "99:99"}`;
  return tickets.map((ticket, index) => ({ ticket, index, key: key(ticket) })).sort((a, b) => a.key.localeCompare(b.key) || a.index - b.index).map(({ ticket }) => ticket);
}

export function ticketFields(ticket: Ticket): Array<[string, string]> {
  const fields: Array<[string, string]> = ticket.kind === "酒店" ? [
    ["入住 CHECK IN", [ticket.checkInDate || ticket.date, ticket.checkInTime].filter(Boolean).join(" · ")],
    ["退房 CHECK OUT", [ticket.checkOutDate, ticket.checkOutTime].filter(Boolean).join(" · ") || "待补充"],
  ] : [
    ["出发 / 开始", [ticket.date, ticket.departureTime || clockTime(ticket.time) || ticket.time].filter(Boolean).join(" · ")],
    ["到达 / 结束", [ticket.arrivalDate, ticket.arrivalTime || clockTime(ticket.time?.split(/[→–—]/)[1])].filter(Boolean).join(" · ") || "待补充"],
  ];
  if (ticket.passengers) fields.push(["旅客", ticket.passengers]);
  if (ticket.meta) fields.push(["座位 / 房型", ticket.meta]);
  if (ticket.code) fields.push(["确认号", ticket.code]);
  return fields;
}
