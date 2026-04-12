# Devlog PRD Workflow

## The core idea

Don't invent security and auth decisions from scratch. The Odin Project has been running in
production for years with real users. When you need to implement a feature that touches auth
or user management, study how Odin solves it first — extract the decisions and the reasons
behind them — then write a PRD that translates those decisions into your stack (Bun + Elysia).

You are not copying their code. You are copying their *judgement*.

---

## The loop

### 1. Identify the need
Look at the todo list (`devlog_mvp_todo.md`). Pick the next feature. State it as a single
sentence: "I need to be able to X."

### 2. Find it in Odin
Locate where Odin handles the same problem. Good places to look:

| What you need | Where to look in Odin |
|--------------|----------------------|
| Auth behaviour (login, logout, signup, sessions) | `config/initializers/devise.rb` — all the magic numbers and security settings live here |
| Request handling, before_actions, permitted params | `app/controllers/application_controller.rb` and the specific controller under `app/controllers/` |
| What gets stored in the database | `db/schema.rb` — the ground truth of what columns exist and why |
| Model validations and business rules | `app/models/user.rb` and related models |
| Route definitions | `config/routes.rb` and `config/routes/` |
| Ownership and authorization patterns | `app/policies/` and how controllers scope queries to `current_user` |

### 3. Extract the "what" and the "why"
Read the code and ask two questions for every decision you find:
- **What does it do?** (the mechanic)
- **Why does it do that?** (the security or correctness reason)

If you can only answer "what" but not "why", dig deeper — read comments, trace the call
chain, or look at the Devise gem docs. The "why" is what makes the PRD durable. A rule
without a reason gets quietly removed the first time it causes friction.

### 4. Write the PRD
Create a new file in this directory: `<feature>_prd.md`.

Structure:
- What the endpoint/feature does (one paragraph)
- Request shape (method, path, body, permitted fields only)
- The flow step by step — each step states the mechanic AND the reason
- The full sequence as a short diagram
- Response shape for success, validation failure, and server error
- Security checklist
- Explicit out of scope section

Reference the Odin source with file and line number wherever a decision comes from.
That way future-you can go back and verify if something seems off.

### 5. Implement
Build against the PRD, not against the Odin source directly. The PRD is already
translated into your stack's terms. If implementation reveals something the PRD got wrong
or missed, update the PRD first, then the code.

### 6. Repeat
When the next real need surfaces — either from the todo list or from something you discover
while building — start the loop again. Do not PRD features you are not about to build.

---

## What this approach is good for

- Auth and user management decisions (passwords, sessions, tokens, ownership)
- Validation rules where the right numbers are not obvious (password length, field limits)
- Security patterns where getting it wrong has real consequences (CSRF, enumeration, timing)
- Any place where "I'll figure it out later" tends to become a vulnerability

## What this approach is not for

- UI and layout decisions — Odin is a learning platform, your site is a devlog, the UX
  needs are different
- Database schema for your domain (posts, comments) — Odin has no equivalent, design
  these yourself
- Performance optimisation — solve real problems when they appear, not in advance

---

## Files in this directory

| File | What it covers |
|------|---------------|
| `devlog_mvp_todo.md` | The full MVP feature list with completion status |
| `user_post_prd.md` | POST /users — register a new user |
| `session_post_prd.md` | POST /session — log in |
| `session_delete_prd.md` | DELETE /session — log out |
| `session_middleware_prd.md` | Session middleware — resolve and gate current user |
