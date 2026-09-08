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
    <section className="detail">
      <div className="detail-top">
        <button className="back-button" onClick={onBack}>
          <ChevronLeft size={17} />
          Back
        </button>

        <span>
          {email.sent_at
            ? new Date(email.sent_at).toLocaleString()
            : formatScheduled(email.scheduled_at)}
        </span>
      </div>

      <div className="sender-line">
        <div className="sender-avatar">{email.subject?.[0] || "A"}</div>

        <div>
          <strong>{email.sender_id}</strong>
          <span>to {email.to_email}</span>
        </div>

        <span className="detail-date">
          {email.sent_at ? new Date(email.sent_at).toLocaleString() : ""}
        </span>
      </div>

      <h1>{email.subject || "(No subject)"}</h1>

      <div className="email-body">
        {email.text_body.split("\n").map((line, i) => (
          <p key={i}>{line || "\u00a0"}</p>
        ))}
      </div>

      {email.preview_url && (
        <a
          className="preview-link"
          href={email.preview_url}
          target="_blank"
          rel="noreferrer"
        >
          Open Ethereal preview
        </a>
      )}
    </section>
  );
}