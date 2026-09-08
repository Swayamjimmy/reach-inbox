import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  Clock3,
  FileUp,
  LogOut,
  Mail,
  Paperclip,
  Send,
  SendHorizontal,
  Settings,
  Star,
  Upload,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  ListOrdered,
  List,
  IndentDecrease,
  IndentIncrease,
  Quote,
  Link2,
  Strikethrough,
  Search,
  X,
  Check,
} from "lucide-react";

import {
  Email,
  Sender,
  User,
  getEmails,
  getMe,
  getSenders,
  loginWithGoogle,
  logout,
  scheduleEmail,
  searchEmails,
  connectSlack,
  disconnectSlack,
  getSlackChannels,
  getSlackStatus,
  setSlackChannel,
  type SlackChannel,
  type SlackStatus,
} from "./api";

type View =
  | "scheduled"
  | "sent"
  | "compose"
  | "detail"
  | "settings";

type ScheduleChoice =
  | "tomorrow"
  | "10am"
  | "11am"
  | "3pm"
  | null;

function App() {
  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [view, setView] =
    useState<View>(
      location.pathname ===
        "/settings/slack"
        ? "settings"
        : "scheduled",
    );

  const [emails, setEmails] =
    useState<Email[]>([]);

  const [selected, setSelected] =
    useState<Email | null>(null);

  const [senders, setSenders] =
    useState<Sender[]>([]);

  const [profileOpen, setProfileOpen] =
    useState(false);

  async function load() {
    try {
      const me =
        await getMe();

      if (!me.authenticated) {
        setUser(null);
        return;
      }

      setUser(me.user);

      const [
        allEmails,
        allSenders,
      ] = await Promise.all([
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

  const scheduled =
    emails.filter((email) =>
      [
        "scheduled",
        "queued",
        "processing",
        "sending",
        "rate_limited",
      ].includes(email.status),
    );

  const sent =
    emails.filter(
      (email) =>
        email.status === "sent",
    );

  const openDetail = (
    email: Email,
  ) => {
    setSelected(email);
    setView("detail");
  };

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        view={view}
        scheduledCount={
          scheduled.length
        }
        sentCount={sent.length}
        onCompose={() =>
          setView("compose")
        }
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

        {view === "detail" &&
          selected && (
            <EmailDetail
              email={selected}
              onBack={() =>
                setView(
                  selected.status ===
                    "sent"
                    ? "sent"
                    : "scheduled",
                )
              }
            />
          )}

        {view === "settings" && (
          <SlackSettings />
        )}
      </main>

      <div className="top-user">
        <button
          className="avatar-button"
          onClick={() =>
            setProfileOpen(
              (value) => !value,
            )
          }
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
            />
          ) : (
            <span>
              {user.name
                .slice(0, 1)
                .toUpperCase()}
            </span>
          )}

          <ChevronDown size={13} />
        </button>

        {profileOpen && (
          <div className="profile-menu">
            <div className="profile-name">
              {user.name}
            </div>

            <div className="profile-email">
              {user.email}
            </div>

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

function Login() {
  const error =
    new URLSearchParams(
      location.search,
    ).get("error");

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Login</h1>

        <button
          className="google-button"
          onClick={loginWithGoogle}
        >
          <span className="google-mark">
            G
          </span>

          Login with Google
        </button>

        <div className="or">
          <span />
          or sign up through email
          <span />
        </div>

        <input
          className="login-input"
          placeholder="Email ID"
          disabled
        />

        <input
          className="login-input"
          placeholder="Password"
          type="password"
          disabled
        />

        <button
          className="login-button"
          disabled
        >
          Login
        </button>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function Sidebar({
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
  onNavigate: (
    v: "scheduled" | "sent",
  ) => void;
  onSettings: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="identity">
        <div className="identity-avatar">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
            />
          ) : (
            user.name[0]
          )}
        </div>

        <div className="identity-copy">
          <strong>
            {user.name}
          </strong>

          <span>
            {user.email}
          </span>
        </div>

        <ChevronDown size={14} />
      </div>

      <button
        className="compose-button"
        onClick={onCompose}
      >
        Compose
      </button>

      <div className="section-label">
        CORE
      </div>

      <button
        className={`nav-row ${
          view === "scheduled"
            ? "active"
            : ""
        }`}
        onClick={() =>
          onNavigate("scheduled")
        }
      >
        <Clock3 size={17} />

        <span>
          Scheduled
        </span>

        <em>
          {scheduledCount}
        </em>
      </button>

      <button
        className={`nav-row ${
          view === "sent"
            ? "active"
            : ""
        }`}
        onClick={() =>
          onNavigate("sent")
        }
      >
        <SendHorizontal size={17} />

        <span>
          Sent
        </span>

        <em>
          {sentCount}
        </em>
      </button>

      <div className="sidebar-bottom">
        <button
          className={`muted-nav ${
            view === "settings"
              ? "active"
              : ""
          }`}
          onClick={onSettings}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>
    </aside>
  );
}

function SlackSettings() {
  const [status, setStatus] =
    useState<SlackStatus | null>(
      null,
    );

  const [channels, setChannels] =
    useState<SlackChannel[]>([]);

  const [selectedChannel, setSelectedChannel] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [disconnecting, setDisconnecting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const nextStatus =
        await getSlackStatus();

      setStatus(nextStatus);

      if (nextStatus.connected) {
        const nextChannels =
          await getSlackChannels();

        setChannels(
          nextChannels,
        );

        setSelectedChannel(
          nextStatus.installation
            ?.channel_id ?? "",
        );
      } else {
        setChannels([]);
        setSelectedChannel("");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Slack settings",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!selectedChannel) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await setSlackChannel(
        selectedChannel,
      );

      setMessage(
        "Slack alert channel saved.",
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save channel",
      );
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setError("");

    try {
      await disconnectSlack();

      setStatus({
        connected: false,
        installation: null,
      });

      setChannels([]);
      setSelectedChannel("");

      setMessage(
        "Slack disconnected.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to disconnect Slack",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <section className="settings-page">
        <div className="settings-card">
          <div className="loader" />
        </div>
      </section>
    );
  }

  return (
    <section className="settings-page">
      <div className="settings-header">
        <div>
          <div className="settings-kicker">
            INTEGRATIONS
          </div>

          <h2>Slack</h2>

          <p>
            Send email rate-limit alerts
            to a Slack channel for this
            workspace.
          </p>
        </div>
      </div>

      {error && (
        <div className="settings-alert error">
          {error}
        </div>
      )}

      {message && (
        <div className="settings-alert success">
          {message}
        </div>
      )}

      <div className="settings-card">
        {!status?.connected ? (
          <>
            <div className="slack-card-title">
              <div className="slack-logo">
                #
              </div>

              <div>
                <strong>
                  Connect Slack
                </strong>

                <span>
                  Connect this tenant to a
                  Slack workspace.
                </span>
              </div>
            </div>

            <button
              className="slack-connect-button"
              onClick={() =>
                void connectSlack()
              }
            >
              Connect Slack
            </button>
          </>
        ) : (
          <>
            <div className="slack-card-title">
              <div className="slack-logo">
                ✓
              </div>

              <div>
                <strong>
                  {
                    status.installation
                      ?.team_name
                  }
                </strong>

                <span>
                  Slack workspace
                  connected
                </span>
              </div>
            </div>

            <div className="slack-channel-field">
              <label htmlFor="slack-channel">
                Alert channel
              </label>

              <select
                id="slack-channel"
                value={
                  selectedChannel
                }
                onChange={(e) =>
                  setSelectedChannel(
                    e.target.value,
                  )
                }
              >
                <option value="">
                  Select a channel
                </option>

                {channels.map(
                  (channel) => (
                    <option
                      key={channel.id}
                      value={channel.id}
                    >
                      {channel.isPrivate
                        ? "🔒 "
                        : "# "}
                      {channel.name}
                    </option>
                  ),
                )}
              </select>

              <small>
                Only channels where the
                ReachInbox Slack app is a
                member are shown.
              </small>
            </div>

            {channels.length ===
              0 && (
              <div className="settings-hint">
                No available channels
                were found. For a private
                channel, invite the
                ReachInbox app to that
                channel and reload this
                page.
              </div>
            )}

            <div className="settings-actions">
              <button
                className="slack-save-button"
                disabled={
                  !selectedChannel ||
                  saving
                }
                onClick={() =>
                  void save()
                }
              >
                {saving
                  ? "Saving..."
                  : "Save channel"}
              </button>

              <button
                className="slack-disconnect-button"
                disabled={
                  disconnecting
                }
                onClick={() =>
                  void disconnect()
                }
              >
                {disconnecting
                  ? "Disconnecting..."
                  : "Disconnect Slack"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Mailbox({
  title,
  emails,
  scheduled,
  onSelect,
}: {
  title: string;
  emails: Email[];
  scheduled?: boolean;
  onSelect: (
    e: Email,
  ) => void;
}) {
  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState<Email[] | null>(
      null,
    );

  const [searching, setSearching] =
    useState(false);

  const [searchError, setSearchError] =
    useState("");

  const searchTimer =
    useRef<number | null>(
      null,
    );

  useEffect(() => {
    setQuery("");
    setResults(null);
    setSearchError("");
  }, [title]);

  useEffect(() => {
    if (
      searchTimer.current !==
      null
    ) {
      window.clearTimeout(
        searchTimer.current,
      );
    }

    const trimmed =
      query.trim();

    if (!trimmed) {
      setResults(null);
      setSearching(false);
      setSearchError("");
      return;
    }

    setSearching(true);

    searchTimer.current =
      window.setTimeout(() => {
        void searchEmails(
          trimmed,
          scheduled
            ? "scheduled"
            : "sent",
        )
          .then((next) => {
            setResults(next);
            setSearchError("");
          })
          .catch((error) => {
            setSearchError(
              error instanceof Error
                ? error.message
                : "Search failed",
            );

            setResults([]);
          })
          .finally(() =>
            setSearching(false),
          );
      }, 260);

    return () => {
      if (
        searchTimer.current !==
        null
      ) {
        window.clearTimeout(
          searchTimer.current,
        );
      }
    };
  }, [
    query,
    scheduled,
  ]);

  const visibleEmails =
    results ?? emails;

  return (
    <section className="mailbox">
      <div className="mailbox-toolbar">
        <div>
          <div className="mailbox-title-row">
            <h2>{title}</h2>

            <span className="mailbox-count">
              {
                visibleEmails.length
              }
            </span>
          </div>

          <p className="mailbox-subtitle">
            {query.trim()
              ? `${
                  visibleEmails.length
                } matching email${
                  visibleEmails.length ===
                  1
                    ? ""
                    : "s"
                }`
              : `${
                  emails.length
                } email${
                  emails.length ===
                  1
                    ? ""
                    : "s"
                } in ${title.toLowerCase()}`}
          </p>
        </div>

        <div
          className={`mail-search ${
            query
              ? "has-value"
              : ""
          }`}
        >
          <Search size={16} />

          <input
            value={query}
            onChange={(e) =>
              setQuery(
                e.target.value,
              )
            }
            placeholder={`Search ${title.toLowerCase()} emails`}
            aria-label={`Search ${title.toLowerCase()} emails`}
          />

          {searching && (
            <span className="search-spinner" />
          )}

          {!searching &&
            query && (
              <button
                className="search-clear"
                onClick={() =>
                  setQuery("")
                }
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
        </div>
      </div>

      {searchError && (
        <div className="mailbox-alert">
          {searchError}
        </div>
      )}

      <div className="message-list">
        {visibleEmails.length ===
        0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Mail size={25} />
            </div>

            <strong>
              {query
                ? "No matching emails"
                : `No ${title.toLowerCase()} emails`}
            </strong>

            <span>
              {query
                ? "Try a recipient, subject, or phrase from the email body."
                : "Compose an email to see it here."}
            </span>

            {query && (
              <button
                className="empty-clear"
                onClick={() =>
                  setQuery("")
                }
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          visibleEmails.map(
            (email) => (
              <button
                className="message-row"
                key={email.id}
                onClick={() =>
                  onSelect(email)
                }
              >
                <div
                  className="row-to"
                  title={
                    email.to_email
                  }
                >
                  To:{" "}
                  {email.to_email}
                </div>

                <div className="row-main">
                  {scheduled ? (
                    <span className="scheduled-pill">
                      <Clock3 size={12} />

                      {formatScheduled(
                        email.scheduled_at,
                      )}
                    </span>
                  ) : (
                    <span className="sent-pill">
                      <SendHorizontal
                        size={11}
                      />

                      Sent
                    </span>
                  )}

                  <div className="row-copy">
                    <strong>
                      {email.subject ||
                        "(No subject)"}
                    </strong>

                    <span className="row-preview">
                      -{" "}
                      {email.text_body
                        .replace(
                          /\n/g,
                          " ",
                        )
                        .slice(
                          0,
                          110,
                        )}
                    </span>
                  </div>
                </div>

                <Star
                  size={17}
                  className="star"
                />
              </button>
            ),
          )
        )}
      </div>
    </section>
  );
}

function EmailDetail({
  email,
  onBack,
}: {
  email: Email;
  onBack: () => void;
}) {
  return (
    <section className="detail">
      <div className="detail-top">
        <button
          className="back-button"
          onClick={onBack}
        >
          <ChevronLeft size={17} />
          Back
        </button>

        <span>
          {email.sent_at
            ? new Date(
                email.sent_at,
              ).toLocaleString()
            : formatScheduled(
                email.scheduled_at,
              )}
        </span>
      </div>

      <div className="sender-line">
        <div className="sender-avatar">
          {email.subject?.[0] ||
            "A"}
        </div>

        <div>
          <strong>
            {email.sender_id}
          </strong>

          <span>
            to {email.to_email}
          </span>
        </div>

        <span className="detail-date">
          {email.sent_at
            ? new Date(
                email.sent_at,
              ).toLocaleString()
            : ""}
        </span>
      </div>

      <h1>
        {email.subject ||
          "(No subject)"}
      </h1>

      <div className="email-body">
        {email.text_body
          .split("\n")
          .map(
            (line, i) => (
              <p key={i}>
                {line ||
                  "\u00a0"}
              </p>
            ),
          )}
      </div>

      {email.preview_url && (
        <a
          className="preview-link"
          href={
            email.preview_url
          }
          target="_blank"
          rel="noreferrer"
        >
          Open Ethereal preview
        </a>
      )}
    </section>
  );
}

function Composer({
  user,
  senders,
  onDone,
}: {
  user: User;
  senders: Sender[];
  onDone: () => Promise<void>;
}) {
  const [senderId, setSenderId] =
    useState(
      senders[0]?.id || "",
    );

  const [recipients, setRecipients] =
    useState<string[]>([]);

  const [
    recipientInput,
    setRecipientInput,
  ] = useState("");

  const [subject, setSubject] =
    useState("");

  const [body, setBody] =
    useState("");

  const [delay, setDelay] =
    useState("00");

  const [hourlyLimit, setHourlyLimit] =
    useState("00");

  const [scheduleOpen, setScheduleOpen] =
    useState(false);

  const [choice, setChoice] =
    useState<ScheduleChoice>(
      null,
    );

  const [dateValue, setDateValue] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const fileRef =
    useRef<HTMLInputElement>(
      null,
    );

  useEffect(() => {
    if (
      !senderId &&
      senders[0]
    ) {
      setSenderId(
        senders[0].id,
      );
    }
  }, [
    senders,
    senderId,
  ]);

  const sender =
    senders.find(
      (s) => s.id === senderId,
    );

  const addRecipient = (
    value: string,
  ) => {
    const clean =
      value
        .trim()
        .replace(
          /[,\s]+$/,
          "",
        );

    if (
      clean &&
      clean.includes("@") &&
      !recipients.includes(clean)
    ) {
      setRecipients(
        (current) => [
          ...current,
          clean,
        ],
      );
    }

    setRecipientInput("");
  };

  const handleRecipientKey = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      [
        "Enter",
        ",",
        "Tab",
      ].includes(e.key)
    ) {
      e.preventDefault();
      addRecipient(
        recipientInput,
      );
    }

    if (
      e.key ===
        "Backspace" &&
      !recipientInput &&
      recipients.length
    ) {
      setRecipients(
        (current) =>
          current.slice(
            0,
            -1,
          ),
      );
    }
  };

  const importList = (
    file: File,
  ) => {
    const reader =
      new FileReader();

    reader.onload = () => {
      const values =
        String(
          reader.result,
        )
          .split(
            /[\n,;\t]+/,
          )
          .map((value) =>
            value.trim(),
          )
          .filter((value) =>
            value.includes("@"),
          );

      setRecipients(
        (current) =>
          Array.from(
            new Set([
              ...current,
              ...values,
            ]),
          ),
      );
    };

    reader.readAsText(file);
  };

  const scheduledAt =
    useMemo(() => {
      const now =
        new Date();

      if (dateValue) {
        return new Date(
          dateValue,
        ).toISOString();
      }

      const result =
        new Date(now);

      result.setDate(
        result.getDate() +
          1,
      );

      if (
        choice === "10am"
      ) {
        result.setHours(
          10,
          0,
          0,
          0,
        );
      } else if (
        choice === "11am"
      ) {
        result.setHours(
          11,
          0,
          0,
          0,
        );
      } else if (
        choice === "3pm"
      ) {
        result.setHours(
          15,
          0,
          0,
          0,
        );
      } else {
        result.setHours(
          9,
          0,
          0,
          0,
        );
      }

      return result.toISOString();
    }, [
      choice,
      dateValue,
    ]);

  const submit = async () => {
    if (
      !sender ||
      !recipients.length ||
      !subject.trim() ||
      !body.trim()
    ) {
      return;
    }

    setSaving(true);

    try {
      const delayMs =
        Math.max(
          0,
          Number(delay) || 0,
        ) * 1000;

      const start =
        new Date(
          scheduledAt,
        ).getTime();

      for (
        let i = 0;
        i < recipients.length;
        i++
      ) {
        await scheduleEmail({
          senderId:
            sender.id,

          toEmail:
            recipients[i],

          subject:
            subject.trim(),

          textBody:
            body.trim(),

          scheduledAt:
            new Date(
              start +
                i * delayMs,
            ).toISOString(),
        });
      }

      await onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="composer">
      <div className="compose-header">
        <h2>
          New Email
        </h2>

        <button
          className="close-compose"
          onClick={onDone}
        >
          <X size={19} />
        </button>
      </div>

      <div className="form-row">
        <label>
          From
        </label>

        <select
          value={senderId}
          onChange={(e) =>
            setSenderId(
              e.target.value,
            )
          }
        >
          {senders.map(
            (s) => (
              <option
                key={s.id}
                value={s.id}
              >
                {s.name} &lt;
                {s.email}&gt;
              </option>
            ),
          )}
        </select>

        <ChevronDown
          size={15}
          className="select-chevron"
        />
      </div>

      <div className="form-row">
        <label>
          To
        </label>

        <div className="recipient-wrap">
          {recipients.map(
            (recipient) => (
              <span
                className="recipient-chip"
                key={recipient}
              >
                {recipient}

                <button
                  onClick={() =>
                    setRecipients(
                      (current) =>
                        current.filter(
                          (value) =>
                            value !==
                            recipient,
                        ),
                    )
                  }
                >
                  <X size={12} />
                </button>
              </span>
            ),
          )}

          <input
            value={
              recipientInput
            }
            onChange={(e) =>
              setRecipientInput(
                e.target.value,
              )
            }
            onKeyDown={
              handleRecipientKey
            }
            onBlur={() =>
              recipientInput &&
              addRecipient(
                recipientInput,
              )
            }
            placeholder={
              recipients.length
                ? ""
                : "recipient@example.com"
            }
          />

          <button
            className="upload-list"
            onClick={() =>
              fileRef.current?.click()
            }
          >
            <Upload size={16} />
            Upload List
          </button>

          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".csv,.txt"
            onChange={(e) =>
              e.target.files?.[0] &&
              importList(
                e.target.files[0],
              )
            }
          />
        </div>
      </div>

      <div className="form-row">
        <label>
          Subject
        </label>

        <input
          value={subject}
          onChange={(e) =>
            setSubject(
              e.target.value,
            )
          }
          placeholder="Subject"
        />
      </div>

      <div className="limits-row">
        <span>
          Delay between 2 emails
        </span>

        <input
          value={delay}
          onChange={(e) =>
            setDelay(
              e.target.value
                .replace(
                  /\D/g,
                  "",
                )
                .slice(0, 3),
            )
          }
          placeholder="00"
        />

        <span>
          Hourly Limit
        </span>

        <input
          value={hourlyLimit}
          onChange={(e) =>
            setHourlyLimit(
              e.target.value
                .replace(
                  /\D/g,
                  "",
                )
                .slice(0, 3),
            )
          }
          placeholder="00"
        />
      </div>

      <div className="editor">
        <textarea
          value={body}
          onChange={(e) =>
            setBody(
              e.target.value,
            )
          }
          placeholder="Type Your Reply..."
        />

        <div className="editor-toolbar">
          <button>
            <Undo2 size={17} />
          </button>

          <button>
            <Redo2 size={17} />
          </button>

          <span />

          <button>
            T
            <small>↕</small>
          </button>

          <button>
            <Bold size={17} />
          </button>

          <button>
            <Italic size={17} />
          </button>

          <button>
            <Underline
              size={17}
            />
          </button>

          <span />

          <button>
            <AlignLeft
              size={17}
            />
          </button>

          <button>
            ↕
          </button>

          <button>
            <ListOrdered
              size={17}
            />
          </button>

          <button>
            <List size={17} />
          </button>

          <button>
            <IndentIncrease
              size={17}
            />
          </button>

          <button>
            <IndentDecrease
              size={17}
            />
          </button>

          <button>
            <Quote size={17} />
          </button>

          <button>
            <Link2 size={17} />
          </button>

          <button>
            <Strikethrough
              size={17}
            />
          </button>
        </div>
      </div>

      <div className="compose-actions">
        <button className="attach">
          <Paperclip size={18} />
        </button>

        <div className="schedule-area">
          <button
            className="send-later"
            onClick={() =>
              setScheduleOpen(
                (value) =>
                  !value,
              )
            }
          >
            <CalendarClock
              size={17}
            />

            Send Later

            <ChevronDown
              size={15}
            />
          </button>

          {scheduleOpen && (
            <div className="schedule-popover">
              <strong>
                Send Later
              </strong>

              <label>
                Pick date & time
              </label>

              <input
                type="datetime-local"
                value={
                  dateValue
                }
                onChange={(e) => {
                  setDateValue(
                    e.target.value,
                  );

                  setChoice(null);
                }}
              />

              <div className="schedule-options">
                <button
                  onClick={() => {
                    setChoice(
                      "tomorrow",
                    );

                    setDateValue("");
                  }}
                >
                  Tomorrow
                </button>

                <button
                  onClick={() => {
                    setChoice(
                      "10am",
                    );

                    setDateValue("");
                  }}
                >
                  Tomorrow, 10:00 AM
                </button>

                <button
                  onClick={() => {
                    setChoice(
                      "11am",
                    );

                    setDateValue("");
                  }}
                >
                  Tomorrow, 11:00 AM
                </button>

                <button
                  onClick={() => {
                    setChoice(
                      "3pm",
                    );

                    setDateValue("");
                  }}
                >
                  Tomorrow, 3:00 PM
                </button>
              </div>

              <div className="popover-actions">
                <button
                  onClick={() =>
                    setScheduleOpen(
                      false,
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  className="done"
                  onClick={() =>
                    setScheduleOpen(
                      false,
                    )
                  }
                >
                  <Check
                    size={15}
                  />

                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          className="send-now"
          disabled={saving}
          onClick={submit}
        >
          {saving
            ? "Scheduling..."
            : "Schedule"}

          <Send size={16} />
        </button>
      </div>
    </section>
  );
}

function formatScheduled(
  value: string,
) {
  const date =
    new Date(value);

  return (
    date.toLocaleDateString(
      undefined,
      {
        weekday: "short",
      },
    ) +
    " " +
    date.toLocaleTimeString(
      undefined,
      {
        hour: "numeric",
        minute: "2-digit",
      },
    )
  );
}

export default App;