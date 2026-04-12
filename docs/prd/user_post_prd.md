# PRD: POST /users — Create User

**Stack:** Bun runtime, Elysia HTTP framework, PostgreSQL
**Reference implementation:** The Odin Project (Rails 8 + Devise)
**Scope:** Bare minimum user creation endpoint only. No OAuth, no 2FA, no email confirmation.

---

## What this endpoint does

Accepts a new user's credentials, validates them, hashes the password, writes the user to the
database, establishes a session cookie, and returns the created user as JSON. Mirrors the exact
security decisions made by the Odin Project's Devise-backed implementation.

---

## Request

```
POST /users
Content-Type: application/json

{
  "email": "bob@gmail.com",
  "username": "bob",
  "password": "hunter2",
  "password_confirmation": "hunter2"
}
```

### Permitted fields

Only these four fields are accepted. Any other field in the request body is silently dropped
before it reaches validation or the database. This prevents a caller from setting fields like
`banned`, `role`, or `id` directly.

**Why:** The Odin Project enforces this via `devise_parameter_sanitizer.permit(:sign_up, keys:
[:username])`. In Elysia you get this for free by defining a strict body schema — anything not
in the schema is excluded automatically.

---

## Input validation rules

These rules are derived directly from the Odin Project's model validations and Devise config.
The numbers are not guesses — they come from a production app that has been running publicly
for years.

| Field | Rule | Source |
|-------|------|--------|
| `email` | Required, must match email format | `user.rb:10` |
| `email` | Must be unique (case-insensitive) | `user.rb:10`, `devise.rb:37` |
| `email` | Strip leading/trailing whitespace before any checks | `devise.rb:43` |
| `email` | Lowercase before any checks | `devise.rb:37` |
| `username` | Required | `user.rb:11` |
| `username` | Length: 2–100 characters | `user.rb:11` |
| `password` | Required | Devise `:validatable` |
| `password` | Length: 6–128 characters | `devise.rb:174` |
| `password_confirmation` | Required, must exactly match `password` | Devise `:validatable` |

### Validation order

Run validations in this order so you can return the most useful error first:

1. Normalize email (lowercase + strip whitespace) — do this before any email check
2. Check all fields are present
3. Check formats and lengths
4. Check `password_confirmation` matches `password`
5. Check email uniqueness (this is the only validation that hits the database)

**Why uniqueness is last:** It costs a DB query. All the cheap checks that don't need the DB
should be exhausted first.

---

## Password hashing

**Algorithm:** bcrypt
**Cost factor:** 10 in production, 1 in tests

```
stored_value = bcrypt(password, cost=10)
```

The raw password string must be discarded after hashing. Only `encrypted_password` (the bcrypt
output) is stored. The bcrypt output string encodes the algorithm, cost factor, salt, and hash
all in one string — you do not need to store the salt separately.

Bun provides this natively:

```ts
const hash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
```

**Why cost 10:** bcrypt is intentionally slow. Cost 10 means 2^10 = 1024 internal rounds,
taking roughly 100ms per hash attempt on modern hardware. This makes offline brute-force
attacks against a leaked database impractical. MD5 and SHA-family hashes are wrong here
because they are fast.

**Why not argon2:** Argon2 is newer and technically stronger, but bcrypt at cost 10 is the
proven production choice the Odin Project uses. Start with what works in the real world.

---

## Database

### Users table (minimum required columns)

```sql
CREATE TABLE users (
  id                  SERIAL PRIMARY KEY,
  email               VARCHAR(255) NOT NULL UNIQUE,
  encrypted_password  VARCHAR(255) NOT NULL,
  username            VARCHAR(100) NOT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX index_users_on_email ON users (email);
```

### Why the unique index exists alongside the app-level uniqueness check

The app-level uniqueness check (step 5 in validation order above) covers the normal case and
gives you a user-friendly error message. The DB unique index covers the race condition case:
two requests arriving at the same millisecond with the same email, both passing the app check
before either writes. The DB constraint rejects the second write at the hardware level. You
need both.

### Columns intentionally excluded from MVP

These are in the Odin Project schema but are not required for bare-minimum user creation:

- `reset_password_token` — needed for forgot-password flow only
- `sign_in_count`, `current_sign_in_at`, `last_sign_in_at`, `current_sign_in_ip` — session
  tracking, add later
- `banned` — moderation feature, add later
- `path_id` — app-specific curriculum enrollment, not applicable

---

## Session

After a successful INSERT, establish a session so the user is considered logged in.

### Cookie-based session (recommended, mirrors Odin approach)

Write the user's `id` into a signed, encrypted cookie:

```
Set-Cookie: session=<encrypted+signed blob>; HttpOnly; SameSite=Lax; Path=/
```

| Cookie attribute | Why |
|-----------------|-----|
| `HttpOnly` | JavaScript cannot read the cookie. Blocks XSS from stealing sessions. |
| `SameSite=Lax` | Cookie is not sent on cross-site POST requests. Blocks CSRF. |
| Encrypted + signed | The blob cannot be read or tampered with by the client. The user cannot change their own `id` inside it. |

The cookie must be signed with a secret key stored in an environment variable, never hardcoded.

In Elysia, use the `cookie` plugin with a `secrets` option to get signed cookies out of the box.

### What "logged in" means on subsequent requests

Every subsequent request sends the cookie. The server decrypts it, extracts `user_id`, and
queries `SELECT * FROM users WHERE id = $1`. If found, that is the current user. If the cookie
is missing, tampered, or expired — the user is not authenticated.

---

## CSRF protection

Because the client sends `Content-Type: application/json`, browsers will not automatically
submit this request cross-origin — they require a preflight (CORS OPTIONS check) first, which
your server can reject. Combined with `SameSite=Lax` on the session cookie (which prevents
the cookie from being sent on cross-origin POST requests), CSRF is covered without needing a
token in the request body.

This is the main practical benefit of going JSON API over HTML forms — you get CSRF protection
from the browser's own same-origin enforcement rather than having to manually manage tokens.

**Do not** accept `Content-Type: application/x-www-form-urlencoded` or
`multipart/form-data` on this endpoint. Browsers can submit those cross-origin without a
preflight, which would reintroduce the CSRF surface.

---

## Response

### Success

```
HTTP/1.1 201 Created
Content-Type: application/json
Set-Cookie: session=<blob>; HttpOnly; SameSite=Lax; Path=/

{
  "user": {
    "id": 1,
    "email": "bob@gmail.com",
    "username": "bob"
  }
}
```

Return only `id`, `email`, and `username`. Never return `encrypted_password` or any other
internal column. The session cookie is set in the same response so the user is immediately
logged in — no separate login step required after registration.

### Validation failure

```
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "errors": {
    "email": ["has already been taken"],
    "username": ["is too short (minimum is 2 characters)"],
    "password": ["is too short (minimum is 6 characters)"]
  }
}
```

Return all validation errors at once, not just the first one. The client should be able to
fix everything in one round trip.

### Unexpected server error

```
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{ "error": "Internal server error." }
```

Do not leak stack traces or internal error details to the client.

---

## Security checklist

Before shipping, verify all of these are true:

- [ ] Raw password is never logged, stored, or returned in any response
- [ ] `encrypted_password` is never returned in any response (even to the owner)
- [ ] Email is lowercased and stripped before uniqueness check and before INSERT
- [ ] Endpoint rejects any `Content-Type` other than `application/json` (blocks form-based CSRF)
- [ ] Session cookie has `HttpOnly` and `SameSite=Lax`
- [ ] Session secret key comes from an environment variable, not hardcoded
- [ ] DB unique index on `email` exists (not just app-level validation)
- [ ] Permitted fields are explicitly whitelisted — extra body fields are dropped

---

## What is explicitly out of scope

These are real features the Odin Project has. They are not in this PRD. Do not implement them
until the above is solid:

- OAuth (GitHub, Google)
- Email confirmation
- Password reset flow
- Remember me (persistent login cookie)
- Account lockout after failed attempts
- Session timeout
- Two-factor authentication
- User banning
