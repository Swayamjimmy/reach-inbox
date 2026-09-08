import { Client } from "@elastic/elasticsearch";
import { config } from "./config.js";

export type EmailDocument = {
  id: string;
  tenantId: string;
  senderId: string;
  senderEmail: string;
  toEmail: string;
  subject: string;
  textBody: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
};

export const elastic = new Client({ node: config.elasticsearchUrl });

export async function initializeSearch(): Promise<void> {
  try {
    const exists = await elastic.indices.exists({ index: config.elasticsearchIndex });
    if (!exists) {
      await elastic.indices.create({
        index: config.elasticsearchIndex,
        mappings: {
          properties: {
            id: { type: "keyword" },
            tenantId: { type: "keyword" },
            senderId: { type: "keyword" },
            senderEmail: { type: "keyword" },
            toEmail: { type: "keyword" },
            subject: { type: "text" },
            textBody: { type: "text" },
            status: { type: "keyword" },
            scheduledAt: { type: "date" },
            sentAt: { type: "date" },
            createdAt: { type: "date" },
          },
        },
      });
    }
  } catch (error) {
    console.error("Elasticsearch initialization failed; search will be unavailable until ES is reachable", error);
  }
}

export async function indexEmail(document: EmailDocument): Promise<void> {
  await elastic.index({ index: config.elasticsearchIndex, id: document.id, document, refresh: "wait_for" });
}

export async function deleteEmail(id: string): Promise<void> {
  try { await elastic.delete({ index: config.elasticsearchIndex, id, refresh: "wait_for" }); } catch { /* idempotent cleanup */ }
}

export async function searchEmails(tenantId: string, query: string, limit = 100): Promise<EmailDocument[]> {
  const result = await elastic.search<EmailDocument>({
    index: config.elasticsearchIndex,
    size: Math.min(Math.max(limit, 1), 200),
    query: {
      bool: {
        must: query.trim() ? [{ multi_match: { query: query.trim(), fields: ["toEmail^3", "senderEmail^2", "subject^4", "textBody"] } }] : [{ match_all: {} }],
        filter: [{ term: { tenantId } }],
      },
    },
    sort: [{ scheduledAt: "desc" }],
  });
  return result.hits.hits.flatMap((hit) => hit._source ? [hit._source] : []);
}

export async function reindexAllEmails(rows: EmailDocument[]): Promise<void> {
  for (const row of rows) await indexEmail(row);
}
