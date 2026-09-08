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
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    };
  }, [query, scheduled]);

  const visibleEmails = results ?? emails;

  const basePill = "flex-shrink-0 rounded-md px-2.5 py-[5px] text-[11.5px] font-semibold flex items-center gap-1.5 border";

  return (
    <section className="max-w-[1100px] mx-auto mt-10">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap md:flex-nowrap">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-[22px] font-semibold m-0 text-[#1a1d1b]">{title}</h2>
            <span className="bg-[#f0f4f2] text-[#4a534e] px-2.5 py-1 rounded-xl text-[13px] font-semibold flex items-center">
              {visibleEmails.length}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] text-[#7b847e]">
            {query.trim()
              ? `${visibleEmails.length} matching email${visibleEmails.length === 1 ? "" : "s"}`
              : `${emails.length} email${emails.length === 1 ? "" : "s"} in ${title.toLowerCase()}`}
          </p>
        </div>

        <div className={`flex-shrink-0 w-full md:w-[320px] h-10 flex items-center gap-2 px-3 border border-[#e2e7e4] rounded-lg bg-[#fafcfb] text-[#8a938d] transition-all duration-200 focus-within:bg-white focus-within:border-[#00ab44] focus-within:ring-[3px] focus-within:ring-[#00ab44]/10`}>
          <Search size={16} className="flex-shrink-0 text-[#9aa19d]" />
          <input
            className="w-full min-w-0 border-0 outline-none bg-transparent text-[#303832] text-[13px] placeholder:text-[#a2aaa5]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()} emails`}
            aria-label={`Search ${title.toLowerCase()} emails`}
          />
          {searching && <span className="w-3 h-3 border-[1.5px] border-[#dce4df] border-t-[#00a744] rounded-full animate-spin flex-shrink-0" />}
          {!searching && query && (
            <button className="grid place-items-center text-[#727b75]" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {searchError && <div className="max-w-[900px] mb-3 px-3.5 py-2.5 rounded-lg text-xs bg-[#fff1f1] text-[#b33b3b]">{searchError}</div>}

      <div className="border-t border-[#edf0ee]">
        {visibleEmails.length === 0 ? (
          <div className="min-h-[330px] grid place-items-center content-center gap-2 text-[#9aa19d]">
            <div className="text-[#9aa19d]">
              <Mail size={25} />
            </div>
            <strong className="text-[#555d58] text-[15px]">{query ? "No matching emails" : `No ${title.toLowerCase()} emails`}</strong>
            <span className="text-[13px]">
              {query ? "Try a recipient, subject, or phrase from the email body." : "Compose an email to see it here."}
            </span>
            {query && (
              <button className="mt-2 text-[#00ab44] text-[13px]" onClick={() => setQuery("")}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          visibleEmails.map((email) => (
            <button
              className="w-full min-h-[64px] border-b border-[#edf0ee] flex items-center gap-4 text-left p-3 relative hover:bg-[#f8faf9] transition-colors"
              key={email.id}
              onClick={() => onSelect(email)}
            >
              <div className="w-[145px] xl:w-[200px] flex-shrink-0 text-[13.5px] text-[#222a24] font-medium whitespace-nowrap overflow-hidden text-ellipsis" title={email.to_email}>
                To: {email.to_email}
              </div>

              <div className="min-w-0 flex-1 flex items-center gap-4 overflow-hidden text-[13.5px]">
                {email.status === "rate_limited" ? (
                  <span className={`${basePill} bg-[#fff0f0] text-[#d94343] border-[#f7dfdf]`} title="Hourly limit reached. Rescheduled to the next window.">
                    <Clock3 size={12} /> Delayed (Next Hr)
                  </span>
                ) : email.status === "sent" ? (
                  <span className={`${basePill} bg-[#f4fdf7] text-[#15803d] border-[#dcfce7]`}>
                    <SendHorizontal size={11} /> Sent
                  </span>
                ) : ["queued", "processing", "sending"].includes(email.status) ? (
                  <span className={`${basePill} bg-[#f0f7ff] text-[#3b82f6] border-[#dbeafe]`}>
                    <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-pulse" />
                    {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                  </span>
                ) : ["failed", "uncertain"].includes(email.status) ? (
                  <span className={`${basePill} bg-[#fef2f2] text-[#b91c1c] border-[#fee2e2]`}>
                    <X size={12} /> Failed
                  </span>
                ) : (
                  <span className={`${basePill} bg-[#fdfaf5] text-[#b38541] border-[#f6ecd9]`}>
                    <CalendarClock size={12} /> {formatScheduled(email.scheduled_at)}
                  </span>
                )}

                <div className="min-w-0 flex-1 flex items-center gap-2.5 overflow-hidden">
                  <strong className="flex-shrink-0 whitespace-nowrap text-[#1a1d1b]">{email.subject || "(No subject)"}</strong>
                  <span className="whitespace-nowrap text-[#8b938d] overflow-hidden text-ellipsis">
                    - {email.text_body.replace(/\n/g, " ").slice(0, 110)}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 text-[#b9c0bb]">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}