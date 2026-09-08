import { config } from "./config.js";

type EmailDocument = {
  id: string;
  tenantId: string;
  senderId: string;
  toEmail: string;
  subject: string;
  textBody: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  previewUrl: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type EmailRow = {
  id: string;
  tenant_id: string;
  sender_id: string;
  to_email: string;
  subject: string;
  text_body: string;
  status: string;
  scheduled_at: Date;
  sent_at: Date | null;
  preview_url: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

const INDEXABLE_STATUSES = new Set([
  "scheduled",
  "queued",
  "processing",
  "sending",
  "rate_limited",
  "sent",
]);

function elasticUrl(path = ""): string {
  return `${config.elasticsearchUrl.replace(/\/$/, "")}${path}`;
}

async function request(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(elasticUrl(path), {
    ...init,
    headers: {
      ...(init?.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Elasticsearch ${response.status}: ${
        body.slice(0, 500) || response.statusText
      }`,
    );
  }

  return response;
}

let indexReady: Promise<void> | null = null;

async function createIndex(): Promise<void> {
  const response = await fetch(
    elasticUrl(
      `/${encodeURIComponent(config.elasticsearchIndex)}`,
    ),
  );

  if (response.ok) {
    return;
  }

  if (response.status !== 404) {
    const body = await response.text();

    throw new Error(
      `Elasticsearch index check failed (${response.status}): ${body.slice(
        0,
        500,
      )}`,
    );
  }

  await request(
    `/${encodeURIComponent(config.elasticsearchIndex)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        mappings: {
          properties: {
            id: {
              type: "keyword",
            },

            tenantId: {
              type: "keyword",
            },

            senderId: {
              type: "keyword",
            },

            toEmail: {
              type: "text",
              fields: {
                keyword: {
                  type: "keyword",
                },
              },
            },

            subject: {
              type: "text",
            },

            textBody: {
              type: "text",
            },

            status: {
              type: "keyword",
            },

            scheduledAt: {
              type: "date",
            },

            sentAt: {
              type: "date",
            },

            previewUrl: {
              type: "keyword",
              index: false,
            },

            lastError: {
              type: "text",
              index: false,
            },

            createdAt: {
              type: "date",
            },

            updatedAt: {
              type: "date",
            },
          },
        },
      }),
    },
  );
}

async function ensureIndex(): Promise<void> {
  if (!indexReady) {
    indexReady = createIndex().catch((error) => {
      indexReady = null;
      throw error;
    });
  }

  await indexReady;
}

function toDocument(email: EmailRow): EmailDocument {
  return {
    id: email.id,
    tenantId: email.tenant_id,
    senderId: email.sender_id,
    toEmail: email.to_email,
    subject: email.subject,
    textBody: email.text_body,
    status: email.status,

    scheduledAt: new Date(
      email.scheduled_at,
    ).toISOString(),

    sentAt: email.sent_at
      ? new Date(email.sent_at).toISOString()
      : null,

    previewUrl: email.preview_url,
    lastError: email.last_error,

    createdAt: new Date(
      email.created_at,
    ).toISOString(),

    updatedAt: new Date(
      email.updated_at,
    ).toISOString(),
  };
}

export async function initializeEmailSearch(): Promise<void> {
  await ensureIndex();
}

export async function indexEmail(
  email: EmailRow,
): Promise<void> {
  if (!INDEXABLE_STATUSES.has(email.status)) {
    return;
  }

  await ensureIndex();

  // indexEmail(): add refresh=wait_for
    await request(
    `/${encodeURIComponent(
        config.elasticsearchIndex,
    )}/_doc/${encodeURIComponent(email.id)}?refresh=wait_for`,
    {
        method: "PUT",
        body: JSON.stringify(toDocument(email)),
    },
);
}

export async function removeEmailFromIndex(
  emailId: string,
): Promise<void> {
  await ensureIndex();

  const response = await fetch(
    elasticUrl(
      `/${encodeURIComponent(
        config.elasticsearchIndex,
      )}/_doc/${encodeURIComponent(emailId)}`,
    ),
    {
      method: "DELETE",
    },
  );

  if (response.ok || response.status === 404) {
    return;
  }

  const body = await response.text();

  throw new Error(
    `Elasticsearch ${response.status}: ${
      body.slice(0, 500) || response.statusText
    }`,
  );
}

export async function indexEmails(
  emails: EmailRow[],
): Promise<void> {
  const indexable = emails.filter((email) =>
    INDEXABLE_STATUSES.has(email.status),
  );

  if (!indexable.length) {
    return;
  }

  await ensureIndex();

  const body =
    indexable
      .flatMap((email) => [
        JSON.stringify({
          index: {
            _index: config.elasticsearchIndex,
            _id: email.id,
          },
        }),

        JSON.stringify(toDocument(email)),
      ])
      .join("\n") + "\n";

  const response = await request("/_bulk", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-ndjson",
    },
  });

  const result = (await response.json()) as {
    errors?: boolean;
    items?: Array<
      Record<
        string,
        {
          status?: number;
          error?: unknown;
        }
      >
    >;
  };

  if (result.errors) {
    const failed = (result.items ?? []).filter(
      (item) => {
        const operation = Object.values(item)[0];

        return (
          operation?.status !== undefined &&
          operation.status >= 300
        );
      },
    );

    throw new Error(
      `Elasticsearch bulk indexing failed for ${failed.length} email(s)`,
    );
  }
}

export async function searchEmails(input: {
  tenantId: string;
  query: string;
  status?: "scheduled" | "sent";
  limit?: number;
}): Promise<
  Array<{
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
  }>
> {
  await ensureIndex();

  const filters: Array<
    Record<string, unknown>
  > = [
    {
      term: {
        tenantId: input.tenantId,
      },
    },

    {
      terms: {
        status:
          input.status === "sent"
            ? ["sent"]
            : input.status === "scheduled"
              ? [
                  "scheduled",
                  "queued",
                  "processing",
                  "sending",
                  "rate_limited",
                ]
              : [
                  "sent",
                  "scheduled",
                  "queued",
                  "processing",
                  "sending",
                  "rate_limited",
                ],
      },
    },
  ];

  const query = input.query.trim();

  const body = {
    size: Math.min(
      Math.max(input.limit ?? 200, 1),
      200,
    ),

    track_total_hits: false,

    query: query
      ? {
          bool: {
            filter: filters,

            must: [
  {
    bool: {
      should: [
        {
          match_phrase_prefix: {
            toEmail: {
              query,
              max_expansions: 50,
            },
          },
        },
        {
          match_phrase_prefix: {
            subject: {
              query,
              max_expansions: 50,
            },
          },
        },
        {
          match_phrase_prefix: {
            textBody: {
              query,
              max_expansions: 50,
            },
          },
        },
      ],
      minimum_should_match: 1,
    },
  },
],
          },
        }
      : {
          bool: {
            filter: filters,
          },
        },

    sort: [
      {
        scheduledAt: {
          order: "desc",
        },
      },

      {
        createdAt: {
          order: "desc",
        },
      },
    ],
  };

  const response = await request(
    `/${encodeURIComponent(
      config.elasticsearchIndex,
    )}/_search`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  const result = (await response.json()) as {
    hits?: {
      hits?: Array<{
        _source?: EmailDocument;
      }>;
    };
  };

  return (result.hits?.hits ?? [])
    .map((hit) => hit._source)
    .filter(
      (email): email is EmailDocument =>
        Boolean(email),
    )
    .map((email) => ({
      id: email.id,
      sender_id: email.senderId,
      to_email: email.toEmail,
      subject: email.subject,
      text_body: email.textBody,
      scheduled_at: email.scheduledAt,
      status: email.status,
      preview_url: email.previewUrl,
      sent_at: email.sentAt,
      last_error: email.lastError,
    }));
}

export async function syncEmailSearchIndex(
  loadEmails: () => Promise<EmailRow[]>,
): Promise<void> {
  await ensureIndex();

  const emails = await loadEmails();

  /*
   * Remove documents whose status is no longer searchable.
   * This also cleans up stale documents after a worker interruption.
   */
  await request(
    `/${encodeURIComponent(
      config.elasticsearchIndex,
    )}/_delete_by_query?conflicts=proceed&refresh=true`,
    {
      method: "POST",

      body: JSON.stringify({
        query: {
          bool: {
            must_not: [
              {
                terms: {
                  status: Array.from(
                    INDEXABLE_STATUSES,
                  ),
                },
              },
            ],
          },
        },
      }),
    },
  );

  await indexEmails(emails);
}