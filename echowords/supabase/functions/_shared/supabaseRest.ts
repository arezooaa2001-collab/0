// Minimal, dependency-free Supabase client for the Edge Function.
// Every request carries the CALLER's JWT, so Row Level Security applies exactly as in the app.

export class UserScopedSupabase {
  constructor(private url: string, private anonKey: string, private authHeader: string) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { apikey: this.anonKey, Authorization: this.authHeader, ...extra };
  }

  async getUserId(): Promise<string | null> {
    const res = await fetch(`${this.url}/auth/v1/user`, { headers: this.headers() });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j?.id === 'string' ? j.id : null;
  }

  async selectWord<T>(id: string, columns: string): Promise<T | null> {
    const q = new URLSearchParams({ id: `eq.${id}`, select: columns });
    const res = await fetch(`${this.url}/rest/v1/words?${q}`, { headers: this.headers({ Accept: 'application/json' }) });
    if (!res.ok) throw new Error(`select failed: HTTP ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as T[];
    return rows[0] ?? null;
  }

  async updateWord<T>(id: string, patch: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1/words?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.headers({ 'Content-Type': 'application/json', Prefer: 'return=representation', Accept: 'application/json' }),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`update failed: HTTP ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as T[];
    if (!rows[0]) throw new Error('update failed: row not found');
    return rows[0];
  }

  /** Read-only download of a private object. */
  async download(bucket: string, path: string): Promise<Blob> {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`${this.url}/storage/v1/object/authenticated/${bucket}/${encoded}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    return await res.blob();
  }
}
