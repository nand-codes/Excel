import type { Client, ClientInput, ImportResult, Payment, PaymentInput, User } from './types';

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: FieldErrors;
  /** Present on a stale-write 409: the record as it currently stands on the server. */
  readonly current?: Client;
  /** On 409: `stale` if someone else saved first, `deleted` if the record is gone. */
  readonly reason?: 'stale' | 'deleted';

  constructor(
    status: number,
    code: string,
    message: string,
    extra?: { fields?: FieldErrors; current?: Client; reason?: 'stale' | 'deleted' }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = extra?.fields;
    this.current = extra?.current;
    this.reason = extra?.reason;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  fields?: FieldErrors;
  client?: Client;
  reason?: 'stale' | 'deleted';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline', 'Cannot reach the server. Check your internet connection.');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorBody = (payload ?? {}) as ApiErrorBody;
    throw new ApiError(
      response.status,
      errorBody.error || 'request_failed',
      errorBody.message || 'The request failed. Please try again.',
      { fields: errorBody.fields, current: errorBody.client, reason: errorBody.reason }
    );
  }

  return payload as T;
}

export const api = {
  // ── Session ────────────────────────────────────────────────────
  me: () => request<{ user: User }>('GET', '/auth/me').then((r) => r.user),

  login: (username: string, password: string) =>
    request<{ user: User }>('POST', '/auth/login', { username, password }).then((r) => r.user),

  logout: () => request<{ ok: true }>('POST', '/auth/logout'),

  // ── Clients ────────────────────────────────────────────────────
  listClients: () => request<{ clients: Client[] }>('GET', '/clients').then((r) => r.clients),

  /**
   * Creates or updates a client. Pass `expectedUpdatedAt` from the record being
   * edited so the server can reject an edit made against a stale copy.
   */
  saveClient: (client: ClientInput, expectedUpdatedAt?: string | null) =>
    request<{ client: Client; status: 'created' | 'updated' }>('POST', '/clients', {
      client,
      expectedUpdatedAt: expectedUpdatedAt ?? null,
    }),

  deleteClient: (id: string) => request<{ ok: true }>('DELETE', `/clients/${encodeURIComponent(id)}`),

  clearClients: () => request<{ ok: true }>('DELETE', '/clients'),

  importClients: (clients: unknown[]) =>
    request<ImportResult>('POST', '/clients/bulk', { clients, skipExisting: true }),

  // ── Payments ───────────────────────────────────────────────────
  listPayments: (clientId: string) =>
    request<{ payments: Payment[]; total: number }>(
      'GET',
      `/clients/${encodeURIComponent(clientId)}/payments`
    ),

  addPayment: (payment: PaymentInput) =>
    request<{ payment: Payment; total: number }>('POST', '/payments', payment),

  deletePayment: (id: string) =>
    request<{ ok: true; clientId: string; total: number }>(
      'DELETE',
      `/payments/${encodeURIComponent(id)}`
    ),
};
