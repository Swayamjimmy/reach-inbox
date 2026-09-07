import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { pool } from "./db.js";

function requireSlackConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  if (
    !config.slackClientId ||
    !config.slackClientSecret ||
    !config.slackRedirectUri
  ) {
    throw new Error("Slack OAuth environment variables are not configured");
  }
  return {
    clientId: config.slackClientId,
    clientSecret: config.slackClientSecret,
    redirectUri: config.slackRedirectUri,
  };
}

export async function createSlackAuthorizeUrl(
  tenantId: string,
): Promise<string> {
  const slack = requireSlackConfig();
  const state = randomUUID();

  await pool.query(
    `INSERT INTO slack_oauth_states (state, tenant_id, expires_at)
     VALUES ($1, $2, now() + interval '10 minutes')`,
    [state, tenantId],
  );

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", slack.clientId);
  url.searchParams.set("scope", "chat:write,channels:read,groups:read");
  url.searchParams.set("redirect_uri", slack.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

type SlackAccessResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  team?: { id: string; name: string };
};

export async function completeSlackOAuth(
  code: string,
  state: string,
): Promise<{ tenantId: string; teamName: string }> {
  const slack = requireSlackConfig();
  const stateResult = await pool.query<{ tenant_id: string }>(
    `DELETE FROM slack_oauth_states
     WHERE state = $1 AND expires_at > now()
     RETURNING tenant_id`,
    [state],
  );
  const tenantId = stateResult.rows[0]?.tenant_id;
  if (!tenantId) {
    throw new Error("Slack OAuth state is invalid or expired");
  }

  const body = new URLSearchParams({
    client_id: slack.clientId,
    client_secret: slack.clientSecret,
    code,
    redirect_uri: slack.redirectUri,
  });
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json()) as SlackAccessResponse;
  if (!data.ok || !data.access_token || !data.team) {
    throw new Error(data.error ?? "Slack OAuth token exchange failed");
  }

  await pool.query(
    `INSERT INTO slack_installations
       (tenant_id, team_id, team_name, access_token, bot_user_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id) DO UPDATE SET
       team_id = EXCLUDED.team_id,
       team_name = EXCLUDED.team_name,
       access_token = EXCLUDED.access_token,
       bot_user_id = EXCLUDED.bot_user_id,
       connected_at = now()`,
    [tenantId, data.team.id, data.team.name, data.access_token, data.bot_user_id],
  );

  return { tenantId, teamName: data.team.name };
}


type SlackChannel = {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  is_archived: boolean;
};

type ConversationsListResponse = {
  ok: boolean;
  error?: string;
  response_metadata?: { next_cursor?: string };
  channels?: SlackChannel[];
};

export async function getSlackChannels(tenantId: string): Promise<Array<{
  id: string;
  name: string;
  isPrivate: boolean;
}>> {
  const result = await pool.query<{ access_token: string }>(
    `SELECT access_token FROM slack_installations WHERE tenant_id = $1`,
    [tenantId],
  );
  const token = result.rows[0]?.access_token;
  if (!token) throw new Error("Connect Slack before loading channels");

  const channels: SlackChannel[] = [];
  let cursor = "";

  do {
    const url = new URL("https://slack.com/api/conversations.list");
    url.searchParams.set("limit", "200");
    url.searchParams.set("exclude_archived", "true");
    url.searchParams.set("types", "public_channel,private_channel");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as ConversationsListResponse;
    if (!data.ok) throw new Error(data.error ?? "Unable to load Slack channels");

    channels.push(...(data.channels ?? []));
    cursor = data.response_metadata?.next_cursor ?? "";
  } while (cursor);

  return channels
    .filter((channel) => !channel.is_archived && channel.is_member)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      isPrivate: channel.is_private,
    }));
}

export async function setSlackChannel(
  tenantId: string,
  channelId: string,
): Promise<void> {
  const result = await pool.query<{ access_token: string }>(
    `SELECT access_token FROM slack_installations WHERE tenant_id = $1`,
    [tenantId],
  );
  const token = result.rows[0]?.access_token;
  if (!token) throw new Error("Connect Slack before selecting a channel");

  const url = new URL("https://slack.com/api/conversations.info");
  url.searchParams.set("channel", channelId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    channel?: { is_member?: boolean; is_archived?: boolean };
  };

  if (!data.ok || !data.channel) {
    throw new Error(data.error ?? "Slack channel could not be accessed");
  }
  if (data.channel.is_archived) throw new Error("Archived Slack channels cannot be selected");
  if (!data.channel.is_member) {
    throw new Error("The ReachInbox Slack app is not a member of this channel");
  }

  await pool.query(
    `UPDATE slack_installations SET channel_id = $2 WHERE tenant_id = $1`,
    [tenantId, channelId],
  );
}

export async function getSlackStatus(tenantId: string): Promise<object> {
  const result = await pool.query<{
    team_id: string;
    team_name: string;
    channel_id: string | null;
    connected_at: Date;
  }>(
    `SELECT team_id, team_name, channel_id, connected_at
     FROM slack_installations WHERE tenant_id = $1`,
    [tenantId],
  );
  return { connected: result.rowCount === 1, installation: result.rows[0] ?? null };
}

export async function disconnectSlack(tenantId: string): Promise<void> {
  const result = await pool.query<{ access_token: string }>(
    `SELECT access_token FROM slack_installations WHERE tenant_id = $1`,
    [tenantId],
  );
  const token = result.rows[0]?.access_token;
  if (!token) return;

  const response = await fetch("https://slack.com/api/auth.revoke", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "Slack token revocation failed");

  await pool.query(
    `DELETE FROM slack_installations WHERE tenant_id = $1`,
    [tenantId],
  );
}

export async function sendRateLimitAlert(input: {
  tenantId: string;
  senderEmail: string;
  maximum: number;
}): Promise<boolean> {
  const result = await pool.query<{
    access_token: string;
    channel_id: string | null;
  }>(
    `SELECT access_token, channel_id
     FROM slack_installations WHERE tenant_id = $1`,
    [input.tenantId],
  );
  const installation = result.rows[0];
  if (!installation?.channel_id) return false;

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${installation.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: installation.channel_id,
      text: `Email rate limit reached for ${input.senderEmail}: ${input.maximum} emails per hour. Remaining jobs were delayed.`,
    }),
  });
  const data = (await response.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "Slack notification failed");
  return true;
}
