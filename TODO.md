# TODO

## Session

- [ ] **Encrypt session cookie** — currently signed only (HMAC). The user id is visible in the
  cookie value but cannot be tampered with. Safe for now since user id is not sensitive, but
  if anything sensitive is ever stored in the session this must be upgraded to encrypted +
  signed (JWE via `jose`). Do not store sensitive data in the cookie without doing this first.

## Testing

- [ ] **Lower bcrypt cost in tests** — `service.ts` hardcodes `cost: 10`. Set `cost: 1` when
  `NODE_ENV=test` to keep the test suite fast.
