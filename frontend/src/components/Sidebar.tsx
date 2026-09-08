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
    <aside className="w-[245px] xl:w-[322px] flex-shrink-0 pt10 px-5 xl:px-6 pb-6 relative bg-white flex flex-col pt-10">
      <div className="font-['VT323',_monospace] text-[28px] text-[#00ab44] mb-6 tracking-[1px]">
        ReachInbox
      </div>

      <div className="h-[55px] rounded-[14px] bg-[#f4f6f4] px-3 py-[7px] flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-full overflow-hidden grid place-items-center bg-[#ddd] text-white text-[15px]">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : user.name[0]}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <strong className="text-[14px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{user.name}</strong>
          <span className="text-[10px] text-[#909690] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{user.email}</span>
        </div>

        <ChevronDown size={14} />
      </div>

      <button className="h-[33px] w-full border-[1.5px] border-[#00b34b] rounded-[18px] text-[#00a943] text-[13px] font-semibold" onClick={onCompose}>
        Compose
      </button>

      <div className="text-[11px] text-[#b0b5b1] mt-6 mb-2.5 mx-[15px] tracking-[0.5px]">
        CORE
      </div>

      <button
        className={`w-full h-[36px] flex items-center gap-3 px-3.5 rounded-[13px] text-[#354039] text-[13px] text-left ${view === "scheduled" ? "bg-[#e4f7ed]" : ""}`}
        onClick={() => onNavigate("scheduled")}
      >
        <Clock3 size={17} />
        <span>Scheduled</span>
        <em className="ml-auto not-italic text-[#89918c] text-[11px]">{scheduledCount}</em>
      </button>

      <button
        className={`w-full h-[36px] flex items-center gap-3 px-3.5 rounded-[13px] text-[#354039] text-[13px] text-left ${view === "sent" ? "bg-[#e4f7ed]" : ""}`}
        onClick={() => onNavigate("sent")}
      >
        <SendHorizontal size={17} />
        <span>Sent</span>
        <em className="ml-auto not-italic text-[#89918c] text-[11px]">{sentCount}</em>
      </button>

      <div className="absolute left-6 right-5 bottom-[30px]">
        <button
          className={`flex items-center gap-2.5 text-[13px] p-2.5 rounded-[13px] w-full text-left ${view === "settings" ? "bg-[#eef8f1] text-[#00a744]" : "text-[#7e867f]"}`}
          onClick={onSettings}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>
    </aside>
  );
}