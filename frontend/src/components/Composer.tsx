import { useEffect, useMemo, useRef, useState } from "react";
import { AlignLeft, Bold, CalendarClock, Check, ChevronDown, IndentDecrease, IndentIncrease, Italic, Link2, List, ListOrdered, Paperclip, Quote, Redo2, Send, Strikethrough, Underline, Undo2, Upload, X } from "lucide-react";
import { scheduleEmail, Sender, User } from "../api";

type ScheduleChoice = "tomorrow" | "10am" | "11am" | "3pm" | null;

export default function Composer({
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
    if (!senderId && senders[0]) setSenderId(senders[0].id);
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

    if (choice === "10am") result.setHours(10, 0, 0, 0);
    else if (choice === "11am") result.setHours(11, 0, 0, 0);
    else if (choice === "3pm") result.setHours(15, 0, 0, 0);
    else result.setHours(9, 0, 0, 0);

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

  const formRowClass = "flex items-center min-h-[57px] border-b border-[#e7eae8] relative";
  const labelClass = "w-[61px] flex-shrink-0 text-[14px]";
  const inputClass = "flex-1 h-[42px] border-0 outline-none bg-transparent text-[14px] text-[#2d332f]";
  const toolbarBtnClass = "w-7 h-[30px] grid place-items-center rounded hover:bg-[#f2f4f3]";

  return (
    <section className="max-w-[976px] mx-auto">
      <div className="flex justify-end items-center h-[25px]">
        <button className="text-[#919792]" onClick={onDone}><X size={19} /></button>
      </div>

      <div className={formRowClass}>
        <label className={labelClass}>From</label>
        <select className="flex-shrink-0 w-[208px] h-[42px] appearance-none bg-[#f1f3f2] rounded-[9px] px-3.5 border-0 outline-none text-[14px] text-[#2d332f]" value={senderId} onChange={(e) => setSenderId(e.target.value)}>
          {senders.map((s) => (
            <option key={s.id} value={s.id}>{s.name} &lt;{s.email}&gt;</option>
          ))}
        </select>
        <ChevronDown size={15} className="absolute left-[232px] pointer-events-none text-[#8b938e]" />
      </div>

      <div className={formRowClass}>
        <label className={labelClass}>To</label>
        <div className="flex-1 min-h-[57px] flex items-center gap-[5px] flex-wrap py-2">
          {recipients.map((recipient) => (
            <span className="h-[26px] border border-[#00b44a] rounded-[15px] px-[9px] inline-flex items-center gap-1 text-[#27713e] bg-[#f4fff8] text-xs" key={recipient}>
              {recipient}
              <button className="grid place-items-center text-[#3a8a50]" onClick={() => setRecipients((current) => current.filter((value) => value !== recipient))}>
                <X size={12} />
              </button>
            </span>
          ))}
          <input className="min-w-[160px] h-[32px] border-0 outline-none bg-transparent text-[14px] text-[#2d332f]" value={recipientInput} onChange={(e) => setRecipientInput(e.target.value)} onKeyDown={handleRecipientKey} onBlur={() => recipientInput && addRecipient(recipientInput)} placeholder={recipients.length ? "" : "recipient@example.com"} />
          <button className="ml-auto flex items-center gap-1.5 text-[#09a746] text-[13px] whitespace-nowrap" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Upload List
          </button>
          <input ref={fileRef} hidden type="file" accept=".csv,.txt" onChange={(e) => e.target.files?.[0] && importList(e.target.files[0])} />
        </div>
      </div>

      <div className={formRowClass}>
        <label className={labelClass}>Subject</label>
        <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
      </div>

      <div className="flex items-center gap-2.5 h-[67px] text-[14px]">
        <span>Delay between 2 emails</span>
        <input className="w-[66px] h-[38px] border border-[#dfe4e1] rounded-[7px] px-2.5 outline-none text-[#8d958f]" value={delay} onChange={(e) => setDelay(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="00" />
        <span className="ml-[17px]">Hourly Limit</span>
        <input className="w-[66px] h-[38px] border border-[#dfe4e1] rounded-[7px] px-2.5 outline-none text-[#8d958f]" value={hourlyLimit} onChange={(e) => setHourlyLimit(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="00" />
      </div>

      <div className="h-[446px] bg-[#fafafa] rounded-[10px] overflow-hidden">
        <textarea className="w-full h-[392px] resize-none border-0 outline-none bg-transparent p-[17px_15px] text-[15px] text-[#303733] placeholder:text-[#a4aaa6]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type Your Reply..." />
        <div className="h-[48px] -mt-px mx-[15px] bg-white rounded-[23px] flex items-center gap-[3px] px-2.5 text-[#777e79]">
          <button className={toolbarBtnClass}><Undo2 size={17} /></button>
          <button className={toolbarBtnClass}><Redo2 size={17} /></button>
          <span className="w-px h-[24px] bg-[#e4e7e5] mx-[5px]" />
          <button className={toolbarBtnClass}>T<small>↕</small></button>
          <button className={toolbarBtnClass}><Bold size={17} /></button>
          <button className={toolbarBtnClass}><Italic size={17} /></button>
          <button className={toolbarBtnClass}><Underline size={17} /></button>
          <span className="w-px h-[24px] bg-[#e4e7e5] mx-[5px]" />
          <button className={toolbarBtnClass}><AlignLeft size={17} /></button>
          <button className={toolbarBtnClass}>↕</button>
          <button className={toolbarBtnClass}><ListOrdered size={17} /></button>
          <button className={toolbarBtnClass}><List size={17} /></button>
          <button className={toolbarBtnClass}><IndentIncrease size={17} /></button>
          <button className={toolbarBtnClass}><IndentDecrease size={17} /></button>
          <button className={toolbarBtnClass}><Quote size={17} /></button>
          <button className={toolbarBtnClass}><Link2 size={17} /></button>
          <button className={toolbarBtnClass}><Strikethrough size={17} /></button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-3.5 relative">
        <button className="w-[38px] h-[38px] grid place-items-center text-[#777e79]"><Paperclip size={18} /></button>

        <div className="relative">
          <button className="h-[38px] border border-[#d9dedb] rounded-[7px] flex items-center gap-[7px] px-[13px] text-[13px] text-[#48504b] bg-white" onClick={() => setScheduleOpen((value) => !value)}>
            <CalendarClock size={17} /> Send Later <ChevronDown size={15} />
          </button>
          {scheduleOpen && (
            <div className="absolute right-0 bottom-[48px] w-[300px] p-[17px] border border-[#e2e6e3] bg-white rounded-[10px] shadow-[0_5px_18px_rgba(0,0,0,0.13)] z-20">
              <strong className="block text-[15px] mb-[18px]">Send Later</strong>
              <label className="block text-[12px] text-[#8a928d] mb-1.5">Pick date & time</label>
              <input type="datetime-local" className="w-full h-[36px] border-0 border-b border-[#e8ebe9] outline-none text-[#727a75]" value={dateValue} onChange={(e) => { setDateValue(e.target.value); setChoice(null); }} />
              <div className="py-[9px]">
                <button className="block w-full text-left py-2 text-[13px] text-[#5c655f] hover:text-[#00a644]" onClick={() => { setChoice("tomorrow"); setDateValue(""); }}>Tomorrow</button>
                <button className="block w-full text-left py-2 text-[13px] text-[#5c655f] hover:text-[#00a644]" onClick={() => { setChoice("10am"); setDateValue(""); }}>Tomorrow, 10:00 AM</button>
                <button className="block w-full text-left py-2 text-[13px] text-[#5c655f] hover:text-[#00a644]" onClick={() => { setChoice("11am"); setDateValue(""); }}>Tomorrow, 11:00 AM</button>
                <button className="block w-full text-left py-2 text-[13px] text-[#5c655f] hover:text-[#00a644]" onClick={() => { setChoice("3pm"); setDateValue(""); }}>Tomorrow, 3:00 PM</button>
              </div>
              <div className="flex justify-end items-center gap-3.5 border-t border-[#edf0ee] pt-[13px]">
                <button onClick={() => setScheduleOpen(false)}>Cancel</button>
                <button className="border border-[#00b34a] text-[#00a644] rounded-[17px] py-[7px] px-[17px] flex gap-1 items-center" onClick={() => setScheduleOpen(false)}>
                  <Check size={15} /> Done
                </button>
              </div>
            </div>
          )}
        </div>

        <button className="h-[38px] rounded-[7px] flex items-center gap-[7px] px-[13px] text-[13px] bg-[#00ab44] text-white font-semibold disabled:opacity-60" disabled={saving} onClick={submit}>
          {saving ? "Scheduling..." : "Schedule"} <Send size={16} />
        </button>
      </div>
    </section>
  );
}