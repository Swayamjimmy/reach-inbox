import nodemailer, { type Transporter } from "nodemailer";
import { config } from "./config.js";

let transporterPromise: Promise<Transporter> | undefined;

async function createEtherealTransport(): Promise<Transporter> {
  if (config.etherealUser && config.etherealPass) {
    return nodemailer.createTransport({
      service: "Ethereal",
      auth: {
        user: config.etherealUser,
        pass: config.etherealPass,
      },
    });
  }

  const account = await nodemailer.createTestAccount();
  console.log(`Generated Ethereal account: ${account.user}`);
  console.log(`Ethereal inbox: ${account.web}`);

  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });
}

function getTransporter(): Promise<Transporter> {
  transporterPromise ??= createEtherealTransport();
  return transporterPromise;
}

export async function sendEmail(input: {
  senderName: string;
  senderEmail: string;
  toEmail: string;
  subject: string;
  textBody: string;
}): Promise<{ messageId: string; previewUrl: string | null }> {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: `"${input.senderName}" <${input.senderEmail}>`,
    to: input.toEmail,
    subject: input.subject,
    text: input.textBody,
  });

  const preview = nodemailer.getTestMessageUrl(info);
  return {
    messageId: info.messageId,
    previewUrl: typeof preview === "string" ? preview : null,
  };
}