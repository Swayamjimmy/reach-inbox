export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  tenantId: string;
};

export type Sender = {
  id: string;
  name: string;
  email: string;
};

export type SlackStatus = {
  connected: boolean;
  installation: {
    team_id: string;
    team_name: string;
    channel_id: string | null;
    connected_at: string;
  } | null;
};

export type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
};

export type Email = {
  id: string;
  sender_id: string;
  to_email: string;
  subject: string;
  text_body: string;
  scheduled_at: string;
  status: string;
  preview_url: string | null;
  sent_at: string | null;
  last_error: string | null;
};

const api = async <T,>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(
    path,
    {
      ...options,

      credentials: "include",

      headers: {
        ...(options.body
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),

        ...(options.headers || {}),
      },
    },
  );

  if (!response.ok) {
    let message =
      `Request failed (${response.status})`;

    try {
      const body =
        await response.json();

      message =
        body.error || message;
    } catch {}

    throw new Error(
      message,
    );
  }

  if (
    response.status === 204
  ) {
    return undefined as T;
  }

  return response.json();
};

export async function getMe() {
  return api<{
    authenticated: boolean;
    user: User;
  }>("/api/auth/me");
}

export function loginWithGoogle() {
  window.location.href =
    "/api/auth/google";
}

export async function logout() {
  return api<void>(
    "/api/auth/logout",
    {
      method: "POST",
    },
  );
}

export async function getSenders() {
  return api<Sender[]>(
    "/api/senders",
  );
}

export async function getEmails(
  status?: string,
) {
  const query = status
    ? `?status=${encodeURIComponent(
        status,
      )}`
    : "";

  return api<Email[]>(
    `/api/emails${query}`,
  );
}

export async function searchEmails(
  query: string,
  status?: "scheduled" | "sent",
) {
  const params =
    new URLSearchParams();

  if (query.trim()) {
    params.set(
      "q",
      query.trim(),
    );
  }

  if (status) {
    params.set(
      "status",
      status,
    );
  }

  const suffix =
    params.toString()
      ? `?${params.toString()}`
      : "";

  return api<Email[]>(
    `/api/emails/search${suffix}`,
  );
}

export async function scheduleEmail(
  input: {
    senderId: string;
    toEmail: string;
    subject: string;
    textBody: string;
    scheduledAt: string;
  },
) {
  return api<Email>(
    "/api/emails",
    {
      method: "POST",

      headers: {
        "Idempotency-Key":
          crypto.randomUUID(),
      },

      body: JSON.stringify(
        input,
      ),
    },
  );
}

export async function getSlackStatus() {
  return api<SlackStatus>(
    "/api/slack/status",
  );
}

export async function getSlackChannels() {
  return api<SlackChannel[]>(
    "/api/slack/channels",
  );
}

export async function connectSlack() {
  window.location.href =
    "/api/slack/connect";
}

export async function setSlackChannel(
  channelId: string,
) {
  return api<{
    ok: true;
    channelId: string;
  }>(
    "/api/slack/channel",
    {
      method: "PUT",

      body: JSON.stringify({
        channelId,
      }),
    },
  );
}

export async function disconnectSlack() {
  return api<void>(
    "/api/slack/disconnect",
    {
      method: "DELETE",
    },
  );
}