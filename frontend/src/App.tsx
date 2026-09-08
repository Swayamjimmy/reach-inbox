import { useEffect, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Email, Sender, User, getEmails, getMe, getSenders, logout } from "./api";

import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import SlackSettings from "./components/SlackSettings";
import Mailbox from "./components/Mailbox";
import EmailDetail from "./components/EmailDetail";
import Composer from "./components/Composer";

export type View = "scheduled" | "sent" | "compose" | "detail" | "settings";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(
    location.pathname === "/settings/slack" ? "settings" : "scheduled"
  );
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);

  async function load() {
    try {
      const me = await getMe();
      if (!me.authenticated) {
        setUser(null);
        return;
      }
      setUser(me.user);

      const [allEmails, allSenders] = await Promise.all([
        getEmails(),
        getSenders(),
      ]);

      setEmails(allEmails);
      setSenders(allSenders);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="h-screen grid place-items-center">
        <div className="w-[25px] h-[25px] border-2 border-[#e5e8e6] border-t-[#00a63c] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const scheduled = emails.filter((email) =>
    ["scheduled", "queued", "processing", "sending", "rate_limited"].includes(
      email.status
    )
  );
  const sent = emails.filter((email) => email.status === "sent");

  const openDetail = (email: Email) => {
    setSelected(email);
    setView("detail");
  };

  return (
    <div className="min-h-screen flex relative">
      <Sidebar
        user={user}
        view={view}
        scheduledCount={scheduled.length}
        sentCount={sent.length}
        onCompose={() => setView("compose")}
        onNavigate={(next) => {
          setSelected(null);
          setView(next);
        }}
        onSettings={() => {
          setSelected(null);
          setView("settings");
        }}
      />

      <main className="flex-1 min-w-0 pt-[43px] pr-[28px] pb-[30px] pl-5 xl:pl-[32px]">
        {view === "compose" && (
          <Composer
            user={user}
            senders={senders}
            onDone={async () => {
              await load();
              setView("scheduled");
            }}
          />
        )}
        {view === "scheduled" && (
          <Mailbox title="Scheduled" emails={scheduled} scheduled onSelect={openDetail} />
        )}
        {view === "sent" && (
          <Mailbox title="Sent" emails={sent} onSelect={openDetail} />
        )}
        {view === "detail" && selected && (
          <EmailDetail email={selected} onBack={() => setView(selected.status === "sent" ? "sent" : "scheduled")} />
        )}
        {view === "settings" && <SlackSettings />}
      </main>

      <div className="fixed right-[25px] top-[28px] z-30">
        <button
          className="flex items-center gap-1 p-[3px]"
          onClick={() => setProfileOpen((value) => !value)}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-[28px] h-[28px] rounded-full object-cover bg-[#ddd]" />
          ) : (
            <span className="w-[28px] h-[28px] rounded-full grid place-items-center bg-[#ddd] text-[11px]">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <ChevronDown size={13} />
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-[39px] w-[220px] bg-white border border-[#e3e6e4] rounded-[10px] shadow-[0_8px_30px_rgba(0,0,0,0.1)] p-[13px]">
            <div className="text-[13px] font-semibold">{user.name}</div>
            <div className="text-[11px] text-[#8b918d] mt-1 mb-3">{user.email}</div>
            <button
              className="border-t border-[#eee] w-full pt-2.5 pb-0.5 flex gap-2 items-center text-[12px] text-[#555] text-left"
              onClick={async () => {
                await logout();
                location.reload();
              }}
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}