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
      <div className="center-screen">
        <div className="loader" />
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
    <div className="app-shell">
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

      <main className="main">
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
          <Mailbox
            title="Scheduled"
            emails={scheduled}
            scheduled
            onSelect={openDetail}
          />
        )}

        {view === "sent" && (
          <Mailbox
            title="Sent"
            emails={sent}
            onSelect={openDetail}
          />
        )}

        {view === "detail" && selected && (
          <EmailDetail
            email={selected}
            onBack={() => setView(selected.status === "sent" ? "sent" : "scheduled")}
          />
        )}

        {view === "settings" && <SlackSettings />}
      </main>

      <div className="top-user">
        <button
          className="avatar-button"
          onClick={() => setProfileOpen((value) => !value)}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <span>{user.name.slice(0, 1).toUpperCase()}</span>
          )}
          <ChevronDown size={13} />
        </button>

        {profileOpen && (
          <div className="profile-menu">
            <div className="profile-name">{user.name}</div>
            <div className="profile-email">{user.email}</div>
            <button
              onClick={async () => {
                await logout();
                location.reload();
              }}
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}