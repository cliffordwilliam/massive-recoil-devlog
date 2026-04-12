# PRD: Session Middleware — Authenticate Current User

**Stack:** Bun runtime, Elysia HTTP framework, PostgreSQL
**Reference implementation:** The Odin Project — Devise's `authenticate_user!` and
`current_user` helpers, used as `before_action` hooks on controllers
**Scope:** Read session cookie, resolve current user, gate protected routes.

---

## What this does

Every request that requires a logged-in user must pass through this middleware before the
route handler runs. It reads the session cookie, looks up the user in the database, and
either attaches the user to the request context or rejects with 401.

This is not a single endpoint — it is a reusable piece that sits in front of other routes.

---

## The two patterns Odin uses

Scanning the controllers reveals two distinct usages of Devise's session helpers:

### Pattern 1 — Hard gate (`authenticate_user!`)

```ruby
# app/controllers/users/profiles_controller.rb:3
before_action :authenticate_user!
```

Used on any controller where every action requires login. If the session is missing or
invalid, Devise rejects the request immediately before the action runs. The action code
never executes.

Examples in Odin: profiles, progress, notifications, project submissions, lesson completions.
These are all routes where there is no meaningful response for an unauthenticated user.

### Pattern 2 — Soft check (`current_user`)

```ruby
# app/controllers/courses_controller.rb:15
return if current_user.nil?
```

Used on routes that are public but behave differently when someone is logged in. `current_user`
returns the user object if a valid session exists, or `nil` if not. The action decides what
to do with that information.

Examples in Odin: the lessons page, courses page — a logged-out visitor can still view them,
but a logged-in user gets extra data (their progress, completed lessons, etc.).

---

## Implementation in Elysia

Elysia's equivalent of `before_action` is a `derive` or `beforeHandle` hook. The cleanest
approach is two separate things:

### 1. A `resolveUser` derive — runs on every request, never rejects

Attaches `currentUser` to the request context. If there is no session or the session is
invalid, `currentUser` is `null`. The route handler decides what to do with it.

```ts
const resolveUser = new Elysia({ name: "resolve-user" })
  .derive(async ({ cookie, db }) => {
    const userId = cookie.session?.value?.userId;
    if (!userId) return { currentUser: null };

    const user = await db.query("SELECT id, email, username FROM users WHERE id = $1", [userId]);
    return { currentUser: user ?? null };
  });
```

This is the equivalent of `current_user` in Rails — always available, never throws.

### 2. A `requireAuth` guard — rejects 401 if no user

Built on top of `resolveUser`. Used on route groups that require login.

```ts
const requireAuth = new Elysia({ name: "require-auth" })
  .use(resolveUser)
  .macro({
    auth: (enabled: boolean) => ({
      beforeHandle({ currentUser, error }) {
        if (enabled && !currentUser) throw error(401, { error: "Unauthorized." });
      }
    })
  });
```

This is the equivalent of `authenticate_user!` in Rails.

### How to apply them

On a protected route group (comments CRUD, profile, etc.):

```ts
app.use(requireAuth).group("/comments", { auth: true }, (app) =>
  app
    .post("/", createComment)
    .patch("/:id", updateComment)
    .delete("/:id", deleteComment)
);
```

On a public route that is aware of the current user (post listing, single post):

```ts
app.use(resolveUser).get("/posts/:id", ({ currentUser, params }) => {
  // currentUser may be null — that is fine here
});
```

---

## What gets attached to context

Only fetch the columns you actually need. Never fetch `encrypted_password`.

```sql
SELECT id, email, username FROM users WHERE id = $1 LIMIT 1
```

Odin follows the same rule — `current_user` is a full ActiveRecord object but
`encrypted_password` is never passed to views or returned in responses.

---

## Session expiry check

As noted in the POST /session PRD, store `lastActiveAt` alongside `userId` in the cookie
and check it inside `resolveUser`:

```ts
.derive(async ({ cookie, db }) => {
  const session = cookie.session?.value;
  if (!session?.userId) return { currentUser: null };

  const sessionAge = Date.now() - session.lastActiveAt;
  if (sessionAge > 30 * 60 * 1000) {
    cookie.session.remove();
    return { currentUser: null };
  }

  // Refresh the timestamp so active users don't get expired mid-use
  cookie.session.value.lastActiveAt = Date.now();

  const user = await db.query("SELECT id, email, username FROM users WHERE id = $1", [session.userId]);
  return { currentUser: user ?? null };
});
```

Odin sets this to 30 minutes in `devise.rb:184`: `config.timeout_in = 30.minutes`.

---

## Ownership check — the third pattern

This is not part of the middleware itself, but it appears in every protected write route
and is worth capturing here since it comes from the same Devise `current_user` pattern.

Odin scopes DB queries to the current user rather than looking up by ID alone:

```ruby
# app/controllers/lessons/project_submissions_controller.rb:24
@project_submission = current_user.project_submissions.find(params[:id])
```

This is `SELECT * FROM project_submissions WHERE id = $1 AND user_id = $2`. If the
submission belongs to a different user, ActiveRecord raises `RecordNotFound` — the request
gets a 404, not a 403. The caller does not even learn that the resource exists.

In your comment routes, apply the same pattern:

```ts
// PATCH /comments/:id
const comment = await db.queryOne(
  "SELECT * FROM comments WHERE id = $1 AND user_id = $2",
  [params.id, currentUser.id]
);
if (!comment) throw error(404, { error: "Not found." });
```

Never do this instead:

```ts
// WRONG — looks up by ID alone, then checks ownership separately
const comment = await db.queryOne("SELECT * FROM comments WHERE id = $1", [params.id]);
if (comment.userId !== currentUser.id) throw error(403, { error: "Forbidden." });
```

The wrong version leaks that the resource exists (via 403 vs 404). The correct version
treats "not yours" and "doesn't exist" identically.

---

## The full picture across all four PRDs

```
Every request
  │
  ├─ resolveUser (always runs)
  │     ├─ read + decrypt session cookie
  │     ├─ check session age < 30 min
  │     ├─ SELECT user by id
  │     └─ attach currentUser to context (null if any step fails)
  │
  ├─ requireAuth (only on protected routes)
  │     └─ currentUser === null → 401
  │
  └─ Route handler runs
        └─ ownership checks scope queries to currentUser.id
```

---

## What is explicitly out of scope

- **Server-side session store** — Odin uses cookie-only sessions, nothing in the DB.
  Force-logout (needed for banning) requires a DB session table. Not needed for MVP.
- **Role-based access** — Odin has admin roles and a policy layer. Your site has one poster
  (you, via SSH) and commenters. No roles needed for MVP.
