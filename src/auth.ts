import { randomBytes, randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
import { pool } from "./db.js";

const SESSION_COOKIE = "reachinbox_session";
const OAUTH_STATE_COOKIE = "reachinbox_oauth_state";

const SESSION_DAYS = 30;
const OAUTH_STATE_MINUTES = 10;

function getOAuthClient(): OAuth2Client {
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
    );
  }

  return new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
    config.googleCallbackUrl
  );
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: OAUTH_STATE_MINUTES * 60 * 1000,
    path: "/api/auth/google",
  };
}

export function createGoogleAuthorizeUrl(res: Response): string {
  const state = randomBytes(32).toString("hex");

  res.cookie(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions());

  const client = getOAuthClient();

  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state,
  });
}

export async function completeGoogleLogin(
  code: string,
  state: string,
  expectedState: string | undefined,
  res: Response
): Promise<void> {
  if (!expectedState) {
    throw new Error("Google OAuth state is missing or expired");
  }

  if (state !== expectedState) {
    throw new Error("Google OAuth state is invalid");
  }

  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/api/auth/google" });

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }

  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );

  if (!profileResponse.ok) {
    throw new Error("Unable to fetch Google profile");
  }

  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.sub) {
    throw new Error("Google account ID is missing");
  }

  if (!profile.email) {
    throw new Error("Google account email is missing");
  }

  if (profile.email_verified !== true) {
    throw new Error("Google email is not verified");
  }

  // Use explicit user name formatting 
  const name = profile.name?.trim() || profile.email.split("@")[0] || "Swayam Gupta";
  const avatarUrl = profile.picture ?? null;

  const existingUser = await pool.query<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM users WHERE google_id = $1`,
    [profile.sub]
  );

  let userId: string;
  let tenantId: string;

  if (existingUser.rowCount === 1) {
    userId = existingUser.rows[0]!.id;
    tenantId = existingUser.rows[0]!.tenant_id;

    await pool.query(
      `UPDATE users
       SET email = $2, name = $3, avatar_url = $4, updated_at = now()
       WHERE id = $1`,
      [userId, profile.email, name, avatarUrl]
    );

    await pool.query(
      `INSERT INTO senders (id, tenant_id, name, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, email) DO UPDATE SET name = EXCLUDED.name`,
      [randomUUID(), tenantId, name, profile.email]
    );
  } else {
    userId = randomUUID();
    tenantId = randomUUID();

    await pool.query(
      `INSERT INTO tenants (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [tenantId, `${name}'s workspace`]
    );

    await pool.query(
      `INSERT INTO users (id, google_id, email, name, avatar_url, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, profile.sub, profile.email, name, avatarUrl, tenantId]
    );

    await pool.query(
      `INSERT INTO senders (id, tenant_id, name, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [randomUUID(), tenantId, name, profile.email]
    );
  }

  const sessionId = randomUUID();

  await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, now() + interval '30 days')`,
    [sessionId, userId]
  );

  res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions());
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  tenantId: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function loadUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE];

    if (!sessionId) {
      next();
      return;
    }

    const result = await pool.query<AuthUser>(
      `SELECT u.id, u.email, u.name, u.avatar_url AS "avatarUrl", u.tenant_id AS "tenantId"
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > now()`,
      [sessionId]
    );

    if (result.rowCount === 1) {
      req.user = result.rows[0];
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export async function logout(req: Request, res: Response): Promise<void> {
  const sessionId = req.cookies?.[SESSION_COOKIE];

  if (sessionId) {
    await pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
  }

  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
}