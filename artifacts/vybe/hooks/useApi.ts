import { useAuth } from '@/contexts/AuthContext';

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

export function useApi() {
  const { token } = useAuth();

  async function apiFetch(path: string, options: RequestInit = {}) {
    const resp = await fetch(`${BASE_URL}/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'unknown' }));
      throw new Error(err.message ?? err.error ?? 'Request failed');
    }

    return resp.json();
  }

  return { apiFetch };
}
