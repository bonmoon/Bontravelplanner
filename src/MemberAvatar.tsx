import type { TripMember } from "./types";

export const avatarPresets = ["./assets/profile-cap.png", "./assets/profile-flower.png"];
export function MemberAvatar({ member }: { member?: TripMember }) {
  const value = member?.avatar && member.avatar !== "🙂" ? member.avatar : avatarPresets[member?.isMe ? 0 : 1];
  const image = /^(data:image\/|https?:\/\/|\.\/assets\/)/.test(value);
  return <span className="member-avatar" aria-label={member?.name || "同行人"}>{image ? <img src={value} alt="" /> : value}</span>;
}
