# Devlog MVP — Feature Todo

**Site:** Gamedev devlog for 1 game. You post via SSH directly to the DB.
Visitors register, log in, and CRUD their own comments on posts.

**Process per feature:** Study Odin repo → Write PRD → Implement in Bun + Elysia

---

## Auth

- [ ] **POST /users** — Register a new user
  - PRD written: `~/user_post_prd.md`

- [x] **POST /session** — Log in (verify password, issue session cookie)
  - PRD written: `~/session_post_prd.md`

- [x] **DELETE /session** — Log out (clear session cookie)
  - PRD written: `~/session_delete_prd.md`

- [x] **Session middleware** — On every protected route, decrypt cookie → look up user → attach to request context or reject with 401
  - PRD written: `~/session_middleware_prd.md`

---

## Posts (read-only from web — you write directly to DB via SSH)

- [ ] **GET /posts** — List all posts, newest first
  - No Odin ref needed (no auth required, pure read)

- [ ] **GET /posts/:id** — Single post with its comments
  - No Odin ref needed (no auth required, pure read)

---

## Comments (authenticated, users own their own)

- [ ] **POST /posts/:id/comments** — Create a comment (must be logged in)
  - Odin ref: `app/controllers/lessons/project_submissions_controller.rb` (authenticated create pattern)

- [ ] **PATCH /comments/:id** — Edit own comment (must be logged in + must own it)
  - Odin ref: same as above, also `app/policies/` for ownership check pattern

- [ ] **DELETE /comments/:id** — Delete own comment (must be logged in + must own it)
  - Odin ref: same as above

---

## Notes

**What is NOT in MVP:**
- Password reset / forgot password
- Email confirmation
- OAuth (GitHub, Google login)
- Admin UI (you manage data directly via DB)
- Comment moderation / flagging
- Notifications
- POST /posts from the web (you use SSH → DB for this)

**Auth rule to keep in mind:**
All three comment endpoints require a valid session. If the session cookie is missing or
invalid, return 401. For PATCH and DELETE, additionally verify `comment.user_id === current_user.id`
before allowing the write — return 403 if not. Never rely on the client to send their own
user ID in the request body for ownership checks.
