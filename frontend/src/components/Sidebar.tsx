import { ChevronDown, Clock3, SendHorizontal, Settings } from "lucide-react";
import { User } from "../api";
import { View } from "../App";

export default function Sidebar({
  user,
  view,
  scheduledCount,
  sentCount,
  onCompose,
  onNavigate,
  onSettings,
}: {
  user: User;
  view: View;
  scheduledCount: number;
  sentCount: number;
  onCompose: () => void;
  onNavigate: (v: "scheduled" | "sent") => void;
  onSettings: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">ReachInbox</div>

      <div className="identity">
        <div className="identity-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.name[0]}
        </div>

        <div className="identity-copy">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>

        <ChevronDown size={14} />
      </div>

      <button className="compose-button" onClick={onCompose}>
        Compose
      </button>

      <div className="section-label">CORE</div>

      <button
        className={`nav-row ${view === "scheduled" ? "active" : ""}`}
        onClick={() => onNavigate("scheduled")}
      >
        <Clock3 size={17} />
        <span>Scheduled</span>
        <em>{scheduledCount}</em>
      </button>

      <button
        className={`nav-row ${view === "sent" ? "active" : ""}`}
        onClick={() => onNavigate("sent")}
      >
        <SendHorizontal size={17} />
        <span>Sent</span>
        <em>{sentCount}</em>
      </button>

      <div className="sidebar-bottom">
        <button
          className={`muted-nav ${view === "settings" ? "active" : ""}`}
          onClick={onSettings}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>
    </aside>
  );
}