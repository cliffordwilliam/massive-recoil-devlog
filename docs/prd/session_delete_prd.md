# PRD: DELETE /session — Log Out

**Stack:** Bun runtime, Elysia HTTP framework, PostgreSQL
**Reference implementation:** The Odin Project (Devise::SessionsController#destroy — no
app-specific code, two config lines drive all the decisions)
**Scope:** Clear the session cookie and confirm. That is the entire endpoint.

---

## What this endpoint does

Clears the session cookie so the user is no longer considered logged in on subsequent
requests. Nothing is written to the database — the session only ever lived in the cookie.

---

## Request

```
DELETE /session
Cookie: session=<blob>
```

No request body needed.

### Why DELETE and not GET or POST

From `config/routes.rb:31` and `devise.rb:260`:

```ruby
delete '/sign_out' => 'users/sessions#destroy'
config.sign_out_via = :delete
```

Odin explicitly enforces DELETE. The reason is **logout CSRF**: if logout were a GET
request, a malicious page could embed `<img src="https://yoursite.com/sign_out">` and
silently log out any visitor who loaded that page. Browsers fire GET requests for images
automatically. They do not fire DELETE requests automatically — the client has to
explicitly intend it.

---

## The logout flow

### Step 1 — Clear the session cookie

Overwrite the session cookie with an empty value and an expiry in the past:

```
Set-Cookie: session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
```

`Max-Age=0` tells the browser to delete the cookie immediately.

There is nothing to look up in the database. The session was entirely in the cookie —
clearing it is the whole operation.

### Step 2 — Respond

```
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0

{ "message": "Signed out." }
```

---

## What if the request has no session cookie?

Return the exact same 200 response. Do not return 401.

**Why:** The end state the client wants is "session is gone". If there is no session, that
state is already true. Returning an error here would force the client to handle an
unnecessary edge case. This is the same pattern as Odin — Devise's destroy action does not
check whether a session exists before clearing it.

This also means the endpoint is **idempotent** — calling it twice produces the same result
as calling it once, which is the correct behaviour for a DELETE.

---

## The full sequence

```
DELETE /session
  │
  ├─ Set-Cookie: session=; Max-Age=0  (clear the cookie regardless of whether it existed)
  └─ 200 → { message: "Signed out." }
```

---

## What is explicitly out of scope

- **Invalidating sessions server-side** — Odin uses cookie-only sessions (no session table
  in the DB), so there is nothing to invalidate beyond clearing the cookie. If you later
  need to force-logout a user (e.g. after banning), you would need to add a server-side
  session store. Not needed for MVP.
