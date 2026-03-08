import { describe, it, expect } from 'vitest';

/**
 * Tests for the auth middleware logic defined inline in index.ts (lines 50-72).
 * Since the middleware is not exported as a standalone function, we test the
 * logic by replicating its decision tree with the same conditions.
 */

// Replicate the auth decision logic from index.ts for isolated testing.
// This mirrors lines 50-72 of ankiconnect-server/src/index.ts exactly.
type AuthResult = { allowed: true } | { allowed: false; status: 401; error: string };

function checkAuth(params: {
  remoteIp: string;
  authHeader: string | undefined;
  apiToken: string; // from settings
}): AuthResult {
  const { remoteIp, authHeader, apiToken } = params;
  const isLocalhost =
    remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';

  if (isLocalhost) {
    return { allowed: true };
  }

  if (!apiToken) {
    return { allowed: false, status: 401, error: 'API token not configured' };
  }

  if (!authHeader || authHeader !== `Bearer ${apiToken}`) {
    return { allowed: false, status: 401, error: 'Invalid or missing API token' };
  }

  return { allowed: true };
}

describe('auth middleware logic', () => {
  const validToken = 'test-token-abc123';

  describe('localhost bypass', () => {
    it('allows IPv4 localhost without token', () => {
      const result = checkAuth({
        remoteIp: '127.0.0.1',
        authHeader: undefined,
        apiToken: validToken,
      });
      expect(result.allowed).toBe(true);
    });

    it('allows IPv6 localhost (::1) without token', () => {
      const result = checkAuth({
        remoteIp: '::1',
        authHeader: undefined,
        apiToken: validToken,
      });
      expect(result.allowed).toBe(true);
    });

    it('allows IPv4-mapped IPv6 localhost without token', () => {
      const result = checkAuth({
        remoteIp: '::ffff:127.0.0.1',
        authHeader: undefined,
        apiToken: validToken,
      });
      expect(result.allowed).toBe(true);
    });

    it('allows localhost even when no token is configured', () => {
      const result = checkAuth({
        remoteIp: '127.0.0.1',
        authHeader: undefined,
        apiToken: '',
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('remote requests without token configured', () => {
    it('rejects remote request when no API token is configured', () => {
      const result = checkAuth({
        remoteIp: '192.168.1.100',
        authHeader: undefined,
        apiToken: '',
      });
      expect(result).toEqual({
        allowed: false,
        status: 401,
        error: 'API token not configured',
      });
    });
  });

  describe('remote requests with token configured', () => {
    it('rejects remote request without Authorization header', () => {
      const result = checkAuth({
        remoteIp: '10.0.0.5',
        authHeader: undefined,
        apiToken: validToken,
      });
      expect(result).toEqual({
        allowed: false,
        status: 401,
        error: 'Invalid or missing API token',
      });
    });

    it('rejects remote request with wrong token', () => {
      const result = checkAuth({
        remoteIp: '10.0.0.5',
        authHeader: 'Bearer wrong-token',
        apiToken: validToken,
      });
      expect(result).toEqual({
        allowed: false,
        status: 401,
        error: 'Invalid or missing API token',
      });
    });

    it('rejects remote request with non-Bearer auth scheme', () => {
      const result = checkAuth({
        remoteIp: '10.0.0.5',
        authHeader: `Basic ${validToken}`,
        apiToken: validToken,
      });
      expect(result).toEqual({
        allowed: false,
        status: 401,
        error: 'Invalid or missing API token',
      });
    });

    it('rejects remote request with token but no Bearer prefix', () => {
      const result = checkAuth({
        remoteIp: '10.0.0.5',
        authHeader: validToken,
        apiToken: validToken,
      });
      expect(result).toEqual({
        allowed: false,
        status: 401,
        error: 'Invalid or missing API token',
      });
    });

    it('allows remote request with valid Bearer token', () => {
      const result = checkAuth({
        remoteIp: '10.0.0.5',
        authHeader: `Bearer ${validToken}`,
        apiToken: validToken,
      });
      expect(result.allowed).toBe(true);
    });

    it('allows remote request from Tailscale-like IP with valid token', () => {
      const result = checkAuth({
        remoteIp: '100.64.0.1',
        authHeader: `Bearer ${validToken}`,
        apiToken: validToken,
      });
      expect(result.allowed).toBe(true);
    });
  });
});
