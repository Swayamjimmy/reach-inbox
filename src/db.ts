import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export async function initializeDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );


    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      tenant_id TEXT NOT NULL
        REFERENCES tenants(id)
        ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );


    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );


    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
      ON sessions (expires_at);


    CREATE TABLE IF NOT EXISTS senders (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL
        REFERENCES tenants(id)
        ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, email)
    );


    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL
        REFERENCES tenants(id)
        ON DELETE CASCADE,
      sender_id TEXT NOT NULL
        REFERENCES senders(id),
      idempotency_key TEXT NOT NULL,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      text_body TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,

      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (
          status IN (
            'scheduled',
            'queued',
            'processing',
            'sending',
            'rate_limited',
            'sent',
            'failed',
            'uncertain'
          )
        ),

      processing_started_at TIMESTAMPTZ,
      rate_limited_until TIMESTAMPTZ,
      attempts INTEGER NOT NULL DEFAULT 0,
      provider_message_id TEXT,
      preview_url TEXT,
      sent_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

      UNIQUE (
        tenant_id,
        idempotency_key
      )
    );


    CREATE INDEX IF NOT EXISTS emails_tenant_status_idx
      ON emails (
        tenant_id,
        status,
        scheduled_at
      );


    CREATE TABLE IF NOT EXISTS slack_installations (
      tenant_id TEXT PRIMARY KEY
        REFERENCES tenants(id)
        ON DELETE CASCADE,
      team_id TEXT NOT NULL,
      team_name TEXT NOT NULL,
      access_token TEXT NOT NULL,
      bot_user_id TEXT,
      channel_id TEXT,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );


    CREATE TABLE IF NOT EXISTS slack_oauth_states (
      state TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL
        REFERENCES tenants(id)
        ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );


    INSERT INTO tenants (
      id,
      name
    )
    VALUES (
      'demo',
      'Demo Tenant'
    )
    ON CONFLICT (id) DO NOTHING;
  `);
}