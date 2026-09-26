import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RefreshRejectedError, T3KClient, type T3KTokens } from './tone3000-client';

// Map-backed Storage: the client only touches localStorage/sessionStorage.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

const expired = (refresh = 'r1'): T3KTokens => ({
  access_token: 'stale',
  refresh_token: refresh,
  expires_at: 0,
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
let onAuthRequired: ReturnType<typeof vi.fn>;
let client: T3KClient;

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  onAuthRequired = vi.fn();
  client = new T3KClient('t3k_pub_test', onAuthRequired);
});

afterEach(() => vi.unstubAllGlobals());

describe('T3KClient token refresh', () => {
  it('returns a fresh token without refreshing', async () => {
    client.setTokens({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3_600_000 });
    await expect(client.getAccessToken()).resolves.toBe('a');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shares one in-flight refresh between concurrent callers', async () => {
    client.setTokens(expired());
    fetchMock.mockResolvedValue(
      json(200, { access_token: 'a2', refresh_token: 'r2', expires_in: 3600 })
    );
    const tokens = await Promise.all([client.getAccessToken(), client.getAccessToken()]);
    expect(tokens).toEqual(['a2', 'a2']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.getTokens()?.refresh_token).toBe('r2');
  });

  it('keeps the current refresh token when the response omits one', async () => {
    client.setTokens(expired('keep-me'));
    fetchMock.mockResolvedValue(json(200, { access_token: 'a2', expires_in: 3600 }));
    await client.getAccessToken();
    expect(client.getTokens()?.refresh_token).toBe('keep-me');
  });

  it('keeps the session when the refresh fails offline', async () => {
    client.setTokens(expired());
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(client.getAccessToken()).rejects.toThrow(TypeError);
    expect(client.getTokens()?.refresh_token).toBe('r1');
    expect(onAuthRequired).not.toHaveBeenCalled();
  });

  it('keeps the session on a server error', async () => {
    client.setTokens(expired());
    fetchMock.mockResolvedValue(json(503, {}));
    await expect(client.getAccessToken()).rejects.toThrow('token_refresh_failed');
    expect(client.getTokens()).not.toBeNull();
    expect(onAuthRequired).not.toHaveBeenCalled();
  });

  it('signs out when the server rejects the grant', async () => {
    client.setTokens(expired());
    fetchMock.mockResolvedValue(json(400, { error: 'invalid_grant' }));
    await expect(client.getAccessToken()).rejects.toBeInstanceOf(RefreshRejectedError);
    expect(client.getTokens()).toBeNull();
    expect(onAuthRequired).toHaveBeenCalledTimes(1);
  });

  it('keeps tokens another instance rotated in while this refresh was rejected', async () => {
    client.setTokens(expired('r1'));
    fetchMock.mockImplementation(async () => {
      // Another plugin instance (same localStorage origin) won the rotation.
      localStorage.setItem(
        't3k_tokens',
        JSON.stringify({ access_token: 'b', refresh_token: 'r-other', expires_at: 1e15 })
      );
      return json(400, { error: 'invalid_grant' });
    });
    await expect(client.getAccessToken()).rejects.toBeInstanceOf(RefreshRejectedError);
    expect(client.getTokens()?.refresh_token).toBe('r-other');
    expect(onAuthRequired).not.toHaveBeenCalled();
  });

  it('does not sign back in when a refresh lands after logout', async () => {
    client.setTokens(expired());
    const listener = vi.fn();
    client.setTokenListener(listener);
    let respond!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (respond = resolve)));

    const pending = client.getAccessToken();
    client.logout();
    respond(json(200, { access_token: 'a2', refresh_token: 'r2', expires_in: 3600 }));

    await expect(pending).rejects.toThrow('not_authenticated');
    expect(client.getTokens()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it('reads a corrupt stored session as signed out', () => {
    localStorage.setItem('t3k_tokens', '{not json');
    expect(client.getTokens()).toBeNull();
    localStorage.setItem('t3k_tokens', 'null');
    expect(client.getTokens()).toBeNull();
  });
});
