# PRD: POST /session — Log In

**Stack:** Bun runtime, Elysia HTTP framework, PostgreSQL
**Reference implementation:** The Odin Project (Devise::SessionsController — entirely delegated
to gem, no app-specific code)
**Scope:** Email + password login only. No OAuth, no remember me, no account lockout.

---

## What this endpoint does

Accepts an email and password, verifies the credentials against what is stored in the database,
and if valid establishes a session cookie. The user is then considered logged in for all
subsequent requests until they log out or the session expires.

---

## Request

```
POST /session
Content-Type: application/json

{
  "email": "bob@gmail.com",
  "password": "hunter2"
}
```

### Permitted fields

Only `email` and `password`. Drop everything else.

---

## The login flow, step by step

### Step 1 — Normalize the email

Before doing anything with the submitted email, apply the same normalization used at
registration:

- Lowercase: `"Bob@Gmail.com"` → `"bob@gmail.com"`
- Strip whitespace: `"  bob@gmail.com  "` → `"bob@gmail.com"`

**Why:** The email was normalized before being stored at registration. If you skip normalization
here, `"Bob@Gmail.com"` won't match `"bob@gmail.com"` in the DB even though they are the same
address.

### Step 2 — Look up the user by email

```sql
SELECT * FROM users WHERE email = $1 LIMIT 1
```

Use the normalized email as `$1`.

If no row is returned, the email does not exist. Do **not** reveal this to the caller yet —
see step 4 for why.

### Step 3 — Verify the password with bcrypt

If a user row was found, compare the submitted password against the stored hash:

```ts
const valid = await Bun.password.verify(submittedPassword, user.encrypted_password);
```

`Bun.password.verify` runs bcrypt with the same cost factor that was used when hashing.
The stored hash (`$2a$10$...`) encodes the cost and salt inside itself, so you do not need
to pass those separately. It returns `true` or `false`.

**Why this is not a simple equality check:** The same password hashed twice produces two
different strings because bcrypt embeds a random salt. You cannot compare
`hash(submitted) === stored_hash`. You must use the verify function which extracts the salt
from the stored hash and re-runs the hash with it.

### Step 4 — Return the same error for both failure cases

If the email was not found (step 2) or the password did not match (step 3), return the
exact same error message:

```
"Invalid email or password."
```

Never say "email not found" or "wrong password" separately.

**Why:** If you distinguish between the two, an attacker can submit thousands of email
addresses and use the different error responses to discover which emails are registered
accounts. This is called user enumeration. A single generic message prevents it.

Odin's Devise config has `# config.paranoid = true` commented out, meaning they rely on
Devise's default which already returns a single generic message for both cases.

### Step 5 — Check if the user is allowed to log in

After password verification passes, check one more thing before issuing a session:

```ts
if (user.banned) {
  // reject with the same generic error, or a specific "account suspended" message
}
```

Odin does this in `user.rb:63-65`:
```ruby
def active_for_authentication?
  super && !banned?
end
```

For your MVP, the `banned` column is out of scope. But the check should still exist as a
stub so you can activate it later without touching the login flow.

### Step 6 — Establish the session

Write the user's `id` into a signed, encrypted cookie:

```ts
cookie.session.set({
  userId: user.id,
  // do not put email, username, or any other user data in the cookie
})
```

Only store `userId`. On every subsequent request, look up the full user record from the DB
using this ID. Do not store email, role, or any other field in the cookie — if those change
in the DB, a stale cookie would have the old value.

The cookie must be:
- `HttpOnly` — not readable by JavaScript
- `SameSite=Lax` — not sent on cross-site POST requests
- Signed + encrypted — content cannot be read or tampered with by the client

These are the same cookie attributes specified in the POST /users PRD. Same rules apply here.

### Step 7 — Respond

Return 200 with the authenticated user's public fields and set the session cookie:

```
HTTP/1.1 200 OK
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

The client uses the returned user data to update its UI (e.g. show the username in the
navbar). Navigation to `/dashboard` is the client's responsibility — the server just
confirms success and sets the cookie.

---

## The full sequence

```
POST /session { email, password }
  │
  ├─ Reject if Content-Type is not application/json (blocks form-based CSRF)
  ├─ Normalize email (lowercase + strip)
  ├─ SELECT * FROM users WHERE email = $1
  │     └─ not found → "Invalid email or password." (422)
  ├─ bcrypt.verify(submitted_password, user.encrypted_password)
  │     └─ false → "Invalid email or password." (422)
  ├─ user.banned check
  │     └─ true → reject (403)
  ├─ Write { userId } into signed+encrypted session cookie
  └─ 200 → { user: { id, email, username } }
```

---

## Response

### Success

```
HTTP/1.1 200 OK
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

### Invalid credentials (email not found OR wrong password — same response for both)

```
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{ "error": "Invalid email or password." }
```

---

## Session expiry

Odin sets `config.timeout_in = 30.minutes` in `devise.rb:184`. After 30 minutes of
inactivity the session is considered expired and the user must log in again.

For your MVP, you can implement this by storing a `lastActiveAt` timestamp in the session
cookie alongside `userId` and checking it on each request in the session middleware.

```ts
// in session middleware
const sessionAge = Date.now() - session.lastActiveAt;
if (sessionAge > 30 * 60 * 1000) {
  clearSessionCookie();
  return { error: "Session expired." }; // 401
}
// refresh the timestamp on each valid request
session.lastActiveAt = Date.now();
```

This is optional for local development but include it before going to production.

---

## What is explicitly out of scope

- **Remember me** — Odin has a `remember_me` checkbox that sets a long-lived cookie
  (`remember_created_at` column in schema). Not needed for MVP.
- **Account lockout after N failed attempts** — Odin does not use Devise's `:lockable` module
  for regular users at all. Not needed.
- **OAuth login** — separate flow entirely.
- **Two-factor auth** — admin-only in Odin, not applicable.
