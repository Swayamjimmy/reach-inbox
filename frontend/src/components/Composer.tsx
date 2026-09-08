import { useEffect, useMemo, useRef, useState } from "react";
import { AlignLeft, Bold, CalendarClock, Check, ChevronDown, IndentDecrease, IndentIncrease, Italic, Link2, List, ListOrdered, Paperclip, Quote, Redo2, Send, Strikethrough, Underline, Undo2, Upload, X } from "lucide-react";
import { scheduleEmail, Sender, User } from "../api";

type ScheduleChoice = "tomorrow" | "10am" | "11am" | "3pm" | null;

export default function Composer({
  user,
  senders,
  onDone,
}: {
  user: User;
  senders: Sender[];
  onDone: () => Promise<void>;
}) {
  const [senderId, setSenderId] = useState(senders[0]?.id || "");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delay, setDelay] = useState("00");
  const [hourlyLimit, setHourlyLimit] = useState("00");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [choice, setChoice] = useState<ScheduleChoice>(null);
  const [dateValue, setDateValue] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!senderId && senders[0]) {
      setSenderId(senders[0].id);
    }
  }, [senders, senderId]);

  const sender = senders.find((s) => s.id === senderId);

  const addRecipient = (value: string) => {
    const clean = value.trim().replace(/[,\s]+$/, "");
    if (clean && clean.includes("@") && !recipients.includes(clean)) {
      setRecipients((current) => [...current, clean]);
    }
    setRecipientInput("");
  };

  const handleRecipientKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", "Tab"].includes(e.key)) {
      e.preventDefault();
      addRecipient(recipientInput);
    }
    if (e.key === "Backspace" && !recipientInput && recipients.length) {
      setRecipients((current) => current.slice(0, -1));
    }
  };

  const importList = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const values = String(reader.result)
        .split(/[\n,;\t]+/)
        .map((value) => value.trim())
        .filter((value) => value.includes("@"));

      setRecipients((current) => Array.from(new Set([...current, ...values])));
    };
    reader.readAsText(file);
  };

  const scheduledAt = useMemo(() => {
    const now = new Date();
    if (dateValue) return new Date(dateValue).toISOString();

    const result = new Date(now);
    result.setDate(result.getDate() + 1);

    if (choice === "10am") {
      result.setHours(10, 0, 0, 0);
    } else if (choice === "11am") {
      result.setHours(11, 0, 0, 0);
    } else if (choice === "3pm") {
      result.setHours(15, 0, 0, 0);
    } else {
      result.setHours(9, 0, 0, 0);
    }

    return result.toISOString();
  }, [choice, dateValue]);

  const submit = async () => {
    if (!sender || !recipients.length || !subject.trim() || !body.trim()) return;

    setSaving(true);
    try {
      const delayMs = Math.max(0, Number(delay) || 0) * 1000;
      const start = new Date(scheduledAt).getTime();

      for (let i = 0; i < recipients.length; i++) {
        await scheduleEmail({
          senderId: sender.id,
          toEmail: recipients[i],
          subject: subject.trim(),
          textBody: body.trim(),
          scheduledAt: new Date(start + i * delayMs).toISOString(),
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
        <h2>New Email</h2>
        <button className="close-compose" onClick={onDone}>
          <X size={19} />
        </button>
      </div>

      <div className="form-row">
        <label>From</label>
        <select value={senderId} onChange={(e) => setSenderId(e.target.value)}>
          {senders.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} &lt;{s.email}&gt;
            </option>
          ))}
        </select>
        <ChevronDown size={15} className="select-chevron" />
      </div>

      <div className="form-row">
        <label>To</label>
        <div className="recipient-wrap">
          {recipients.map((recipient) => (
            <span className="recipient-chip" key={recipient}>
              {recipient}
              <button
                onClick={() => setRecipients((current) => current.filter((value) => value !== recipient))}
              >
                <X size={12} />
              </button>
            </span>
          ))}

          <input
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            onKeyDown={handleRecipientKey}
            onBlur={() => recipientInput && addRecipient(recipientInput)}
            placeholder={recipients.length ? "" : "recipient@example.com"}
          />

          <button className="upload-list" onClick={() => fileRef.current?.click()}>
            <Upload size={16} />
            Upload List
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".csv,.txt"
            onChange={(e) => e.target.files?.[0] && importList(e.target.files[0])}
          />
        </div>
      </div>

      <div className="form-row">
        <label>Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
        />
      </div>

      <div className="limits-row">
        <span>Delay between 2 emails</span>
        <input
          value={delay}
          onChange={(e) => setDelay(e.target.value.replace(/\D/g, "").slice(0, 3))}
          placeholder="00"
        />
        <span>Hourly Limit</span>
        <input
          value={hourlyLimit}
          onChange={(e) => setHourlyLimit(e.target.value.replace(/\D/g, "").slice(0, 3))}
          placeholder="00"
        />
      </div>

      <div className="editor">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type Your Reply..."
        />
        <div className="editor-toolbar">
          <button><Undo2 size={17} /></button>
          <button><Redo2 size={17} /></button>
          <span />
          <button>T<small>↕</small></button>
          <button><Bold size={17} /></button>
          <button><Italic size={17} /></button>
          <button><Underline size={17} /></button>
          <span />
          <button><AlignLeft size={17} /></button>
          <button>↕</button>
          <button><ListOrdered size={17} /></button>
          <button><List size={17} /></button>
          <button><IndentIncrease size={17} /></button>
          <button><IndentDecrease size={17} /></button>
          <button><Quote size={17} /></button>
          <button><Link2 size={17} /></button>
          <button><Strikethrough size={17} /></button>
        </div>
      </div>

      <div className="compose-actions">
        <button className="attach">
          <Paperclip size={18} />
        </button>

        <div className="schedule-area">
          <button className="send-later" onClick={() => setScheduleOpen((value) => !value)}>
            <CalendarClock size={17} />
            Send Later
            <ChevronDown size={15} />
          </button>

          {scheduleOpen && (
            <div className="schedule-popover">
              <strong>Send Later</strong>
              <label>Pick date & time</label>
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => {
                  setDateValue(e.target.value);
                  setChoice(null);
                }}
              />
              <div className="schedule-options">
                <button onClick={() => { setChoice("tomorrow"); setDateValue(""); }}>Tomorrow</button>
                <button onClick={() => { setChoice("10am"); setDateValue(""); }}>Tomorrow, 10:00 AM</button>
                <button onClick={() => { setChoice("11am"); setDateValue(""); }}>Tomorrow, 11:00 AM</button>
                <button onClick={() => { setChoice("3pm"); setDateValue(""); }}>Tomorrow, 3:00 PM</button>
              </div>
              <div className="popover-actions">
                <button onClick={() => setScheduleOpen(false)}>Cancel</button>
                <button className="done" onClick={() => setScheduleOpen(false)}>
                  <Check size={15} /> Done
                </button>
              </div>
            </div>
          )}
        </div>

        <button className="send-now" disabled={saving} onClick={submit}>
          {saving ? "Scheduling..." : "Schedule"}
          <Send size={16} />
        </button>
      </div>
    </section>
  );
}