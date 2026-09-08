import { ChevronLeft } from "lucide-react";
import { Email } from "../api";
import { formatScheduled } from "./Mailbox";

export default function EmailDetail({
  email,
  onBack,
}: {
  email: Email;
  onBack: () => void;
}) {
  return (
    <section className="max-w-[975px] mx-auto mt-10">
      <div className="flex items-center justify-between text-[#9aa19c] text-xs mb-8">
        <button className="flex items-center gap-[3px] text-[#69716b]" onClick={onBack}>
          <ChevronLeft size={17} /> Back
        </button>
        <span>
          {email.sent_at ? new Date(email.sent_at).toLocaleString() : formatScheduled(email.scheduled_at)}
        </span>
      </div>

      <div className="flex items-center gap-[13px]">
        <div className="w-[38px] h-[38px] rounded-full bg-[#05b956] text-white grid place-items-center">
          {email.subject?.[0] || "A"}
        </div>
        <div className="flex flex-col gap-[3px]">
          <strong className="text-[14px]">{email.sender_id}</strong>
          <span className="text-[12px] text-[#9aa09c]">to {email.to_email}</span>
        </div>
        <span className="ml-auto self-start text-[#747c76] text-xs">
          {email.sent_at ? new Date(email.sent_at).toLocaleString() : ""}
        </span>
      </div>

      <h1 className="text-[20px] font-medium my-8 ml-[51px]">
        {email.subject || "(No subject)"}
      </h1>

      <div className="ml-[51px] max-w-[720px] text-[15px] leading-relaxed text-[#354039]">
        {email.text_body.split("\n").map((line, i) => (
          <p key={i} className="m-0 mb-3.5">{line || "\u00a0"}</p>
        ))}
      </div>

      {email.preview_url && (
        <a className="inline-block mt-5 ml-[51px] text-[#00a744] text-[13px]" href={email.preview_url} target="_blank" rel="noreferrer">
          Open Ethereal preview
        </a>
      )}
    </section>
  );
}