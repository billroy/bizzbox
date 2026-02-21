"""Simulated AI coding-agent CLI session generator."""
import random
from .base import BaseActivity


class AiAgentActivity(BaseActivity):
    activity_type = "ai_agent"
    strategies = ["clawed_code", "jiminy_cli", "openeye_codecks", "gitpub_copyleft", "cider"]
    titles = [
        "AI AGENT", "LLM SESSION", "CHAT://MODEL",
        "AGENT://LOCAL", "AI ASSISTANT",
    ]

    # Each strategy mimics the visual signature of a real AI CLI tool
    # using punny names to avoid trademarks. All content is fictional.
    SCRIPTS = {
        # ── Clawed Code  (mimics Claude Code's box-drawing UI) ──────────
        "clawed_code": [
            ("╭──────────────────────────────────╮", "output"),
            ("│          clawed  v2.14.0         │", "output"),
            ("╰──────────────────────────────────╯", "output"),
            (" model: panther-5 • tokens: 0", "output"),
            ("", "output"),
            ("> Refactor the auth middleware to use async/await", "command"),
            ("", "output"),
            ("⎿ Reading src/middleware/auth.ts", "result"),
            ("⎿ Reading src/config/jwt.ts", "result"),
            ("⎿ Reading src/types/express.d.ts", "result"),
            ("", "output"),
            ("  I'll restructure the callback-based auth middleware", "output"),
            ("  to use async/await with proper error propagation.", "output"),
            ("", "output"),
            ("⎿ Editing src/middleware/auth.ts (+42 -31)", "result"),
            ("⎿ Editing src/routes/protected.ts (+8 -3)", "result"),
            ("", "output"),
            ("  Done. Converted 3 callback chains to async/await.", "output"),
            ("  All 14 route handlers now use the updated middleware.", "output"),
            (" cost: $0.42 • 12.4k tokens • 8.2s", "output"),
            ("", "output"),
            ("> Now add retry logic for the token refresh", "command"),
            ("", "output"),
            ("⎿ Reading src/services/token.ts", "result"),
            ("  Adding exponential backoff with jitter to the", "output"),
            ("  refresh flow. Max 3 retries, 500ms base delay.", "output"),
            ("⎿ Editing src/services/token.ts (+28 -6)", "result"),
            ("⎿ Running npm test -- --grep 'token refresh'", "warn"),
            ("  12 passed, 0 failed", "result"),
            (" cost: $0.89 • 24.1k tokens • 11.4s", "output"),
        ],
        # ── Jiminy CLI  (mimics Gemini CLI's gradient banner) ───────────
        "jiminy_cli": [
            ("     ╦╦╔╦╗╦╔╗╔╦ ╦", "result"),
            ("     ║║║║║║║║║╚╦╝", "result"),
            ("    ╚╝╩╩ ╩╩╝╚╝ ╩ ", "result"),
            ("    ✦ jiminy-cli v1.6.2", "output"),
            ("", "output"),
            ("╭──────────────────────────────────╮", "output"),
            ("│ > Explain this error trace and   │", "command"),
            ("│   suggest a fix                  │", "command"),
            ("╰──────────────────────────────────╯", "output"),
            ("", "output"),
            ("  The stack trace shows a null reference in", "output"),
            ("  `UserService.getProfile()` at line 142.", "output"),
            ("  The `session.userId` is undefined when the", "output"),
            ("  middleware skips auth for public routes.", "output"),
            ("", "output"),
            ("  **Fix:** Add a guard clause:", "result"),
            ("  ```typescript", "output"),
            ("  if (!session?.userId) return null;", "output"),
            ("  ```", "output"),
            ("", "output"),
            ("╭──────────────────────────────────╮", "output"),
            ("│ > Now write a test for that edge │", "command"),
            ("│   case                           │", "command"),
            ("╰──────────────────────────────────╯", "output"),
            ("", "output"),
            ("  ✦ Searching codebase for test patterns...", "warn"),
            ("  Creating test in `__tests__/user-service.test.ts`", "output"),
            ("  Added 3 test cases covering null session scenarios.", "result"),
            ("  Run `npm test` to verify.", "output"),
        ],
        # ── OpenEye Co-Decks  (mimics Codex's full-screen TUI) ─────────
        "openeye_codecks": [
            ("┌─ openeye co-decks v1.2.3 ──────────────────────┐", "output"),
            ("│ model: falcon-5.3  context: 192k  sandbox: on  │", "output"),
            ("└────────────────────────────────────────────────-┘", "output"),
            ("", "output"),
            ("───────────────── session ─────────────────", "output"),
            ("", "output"),
            ("  user: Find all SQL injection vulnerabilities", "command"),
            ("        in the query builder module", "command"),
            ("", "output"),
            ("  ● Scanning src/db/query-builder.ts", "output"),
            ("  ● Scanning src/db/raw-query.ts", "output"),
            ("  ● Scanning src/api/search.ts", "output"),
            ("", "output"),
            ("  Found 3 potential injection points:", "warn"),
            ("", "output"),
            ("  1. src/db/query-builder.ts:89", "error"),
            ("     String interpolation in WHERE clause", "error"),
            ("  2. src/db/raw-query.ts:34", "error"),
            ("     Unsanitized user input in ORDER BY", "error"),
            ("  3. src/api/search.ts:112", "warn"),
            ("     Template literal in LIKE pattern", "warn"),
            ("", "output"),
            ("  Applying parameterized query fixes...", "output"),
            ("  ✓ Patched 3 files, 7 insertions, 5 deletions", "result"),
            ("", "output"),
            ("  user: Run the security test suite", "command"),
            ("", "output"),
            ("  ● Running: npm run test:security", "output"),
            ("  ✓ 41 passed  ✗ 0 failed  ⊘ 2 skipped", "result"),
        ],
        # ── GitPub Copyleft  (mimics Copilot CLI's banner + timeline) ───
        "gitpub_copyleft": [
            ("  ╔═╗ ╦ ╔╦╗ ╔═╗ ╦ ╦ ╔╗  ", "result"),
            ("  ║ ╦ ║  ║  ╠═╝ ║ ║ ╠╩╗ ", "result"),
            ("  ╚═╝ ╩  ╩  ╩   ╚═╝ ╚═╝ ", "result"),
            ("  copyleft • v0.8.1 • model: parrot-xl", "output"),
            ("", "output"),
            ("─── timeline ────────────────────────────", "output"),
            ("", "output"),
            ("  You: Set up a CI pipeline for this repo", "command"),
            ("", "output"),
            ("  ▸ Reading .github/workflows/", "output"),
            ("  ▸ Reading package.json scripts", "output"),
            ("  ▸ Analyzing test configuration", "output"),
            ("", "output"),
            ("  I'll create a GitHub Actions workflow with", "output"),
            ("  lint, test, and build stages.", "output"),
            ("", "output"),
            ("  ▸ Creating .github/workflows/ci.yml", "result"),
            ("  ▸ Updating package.json (added lint:ci script)", "result"),
            ("", "output"),
            ("  Pipeline has 3 stages: lint → test → build", "output"),
            ("  Caches node_modules between runs.", "output"),
            ("", "output"),
            ("─── timeline ────────────────────────────", "output"),
            ("", "output"),
            ("  You: Also add a deploy stage for staging", "command"),
            ("", "output"),
            ("  ▸ Editing .github/workflows/ci.yml", "result"),
            ("  Added deploy-staging job triggered on", "output"),
            ("  push to main. Uses OIDC for auth.", "output"),
            ("  ? Run the pipeline now? [y/N]", "warn"),
        ],
        # ── Cider  (mimics Aider's minimalist Unix style) ───────────────
        "cider": [
            ("Cider v0.82.1", "output"),
            ("Models: panther-5 with diff edit format", "output"),
            ("Git repo: ../velvet-api (.git)", "output"),
            ("Repo-map: using 2048 tokens, 14 files", "output"),
            ("Added src/app.py to the chat.", "output"),
            ("Use /help <question> for help, /quit to exit", "output"),
            ("", "output"),
            ("cider > add rate limiting to all /api/* endpoints", "command"),
            ("", "output"),
            ("I'll add a token-bucket rate limiter middleware.", "output"),
            ("", "output"),
            ("Added src/middleware/ratelimit.py", "result"),
            ("Applied edit to src/app.py", "result"),
            ("Applied edit to src/config.py", "result"),
            ("Commit 4a3f1c2: Add token-bucket rate limiting to /api/*", "result"),
            ("", "output"),
            ("cider > /diff", "command"),
            ("", "output"),
            ("+from middleware.ratelimit import limiter", "result"),
            ("+app.before_request(limiter.check)", "result"),
            ("-# TODO: add rate limiting", "error"),
            ("", "output"),
            ("cider > also add Redis backing for the rate limiter", "command"),
            ("", "output"),
            ("I'll swap the in-memory store for Redis.", "output"),
            ("Applied edit to src/middleware/ratelimit.py", "result"),
            ("Applied edit to requirements.txt", "result"),
            ("Commit b7e2d91: Use Redis-backed rate limiter", "result"),
            ("Tokens: 8.4k sent, 2.1k received. Cost: $0.03", "output"),
        ],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._script = self.SCRIPTS[self.strategy]
        self._lines = []
        self._script_pos = random.randint(0, len(self._script) - 1)
        # Seed with a few lines
        for _ in range(random.randint(4, 10)):
            self._advance()

    def _advance(self):
        text, style = self._script[self._script_pos % len(self._script)]
        self._lines.append({"text": text, "style": style})
        self._script_pos += 1
        if len(self._lines) > 40:
            self._lines = self._lines[-40:]

    def _get_state(self):
        return {
            "lines": self._lines,
            "cursor_visible": random.random() > 0.5,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        n = random.randint(1, 3)
        for _ in range(n):
            self._advance()
        self._last_added = n
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        n = getattr(self, '_last_added', 0)
        if n and new_state["lines"]:
            return {
                "_delta": True,
                "_limits": {"lines": 40},
                "append_lines": new_state["lines"][-n:],
                "cursor_visible": new_state["cursor_visible"],
            }
        return None
