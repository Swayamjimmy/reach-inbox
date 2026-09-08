import { useEffect, useRef, useState } from "react";
import { CalendarClock, Clock3, Mail, Search, SendHorizontal, X } from "lucide-react";
import { Email, searchEmails } from "../api";

export function formatScheduled(value: string) {
  const date = new Date(value);
  return (
    date.toLocaleDateString(undefined, { weekday: "short" }) +
    " " +
    date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

export default function Mailbox({
  title,
  emails,
  scheduled,
  onSelect,
}: {
  title: string;
  emails: Email[];
  scheduled?: boolean;
  onSelect: (e: Email) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Email[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    setQuery("");
    setResults(null);
    setSearchError("");
  }, [title]);

  useEffect(() => {
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current);
    }

    const trimmed = query.trim();

    if (!trimmed) {
      setResults(null);
      setSearching(false);
      setSearchError("");
      return;
    }

    setSearching(true);

    searchTimer.current = window.setTimeout(() => {
      void searchEmails(trimmed, scheduled ? "scheduled" : "sent")
        .then((next) => {
          setResults(next);
          setSearchError("");
        })
        .catch((error) => {
          setSearchError(error instanceof Error ? error.message : "Search failed");
          setResults([]);
        })
        .finally(() => setSearching(false));
    }, 260);

    return () => {
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current);
      }
    };
  }, [query, scheduled]);

  const visibleEmails = results ?? emails;

  return (
    <section className="mailbox">
      <div className="mailbox-toolbar">
        <div>
          <div className="mailbox-title-row">
            <h2>{title}</h2>
            <span className="mailbox-count">{visibleEmails.length}</span>
          </div>

          <p className="mailbox-subtitle">
            {query.trim()
              ? `${visibleEmails.length} matching email${visibleEmails.length === 1 ? "" : "s"}`
              : `${emails.length} email${emails.length === 1 ? "" : "s"} in ${title.toLowerCase()}`}
          </p>
        </div>

        {/* Updated classname here to match the fixed CSS */}
        <div className={`mailbox-search ${query ? "has-value" : ""}`}>
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()} emails`}
            aria-label={`Search ${title.toLowerCase()} emails`}
          />
          {searching && <span className="search-spinner" />}
          {!searching && query && (
            <button className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {searchError && <div className="mailbox-alert">{searchError}</div>}

      <div className="message-list">
        {visibleEmails.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Mail size={25} />
            </div>
            <strong>{query ? "No matching emails" : `No ${title.toLowerCase()} emails`}</strong>
            <span>
              {query
                ? "Try a recipient, subject, or phrase from the email body."
                : "Compose an email to see it here."}
            </span>
            {query && (
              <button className="empty-clear" onClick={() => setQuery("")}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          visibleEmails.map((email) => (
            <button
              className="message-row"
              key={email.id}
              onClick={() => onSelect(email)}
            >
              <div className="row-to" title={email.to_email}>
                To: {email.to_email}
              </div>

              <div className="row-main">
                {email.status === "rate_limited" ? (
                  <span className="status-pill rate-limited-pill" title="Hourly limit reached. Rescheduled to the next window.">
                    <Clock3 size={12} />
                    Delayed (Next Hr)
                  </span>
                ) : email.status === "sent" ? (
                  <span className="status-pill sent-pill">
                    <SendHorizontal size={11} />
                    Sent
                  </span>
                ) : ["queued", "processing", "sending"].includes(email.status) ? (
                  <span className="status-pill processing-pill">
                    <span className="pulsing-dot" />
                    {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                  </span>
                ) : ["failed", "uncertain"].includes(email.status) ? (
                  <span className="status-pill failed-pill">
                    <X size={12} />
                    Failed
                  </span>
                ) : (
                  <span className="status-pill scheduled-pill">
                    <CalendarClock size={12} />
                    {formatScheduled(email.scheduled_at)}
                  </span>
                )}

                <div className="row-copy">
                  <strong>{email.subject || "(No subject)"}</strong>
                  <span className="row-preview">
                    - {email.text_body.replace(/\n/g, " ").slice(0, 110)}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}