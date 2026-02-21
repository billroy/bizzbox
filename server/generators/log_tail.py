"""Log file tail with severity color coding generator."""
import random
from datetime import datetime, timedelta
from .base import BaseActivity


class LogTailActivity(BaseActivity):
    activity_type = "log_tail"
    strategies = ["web_server", "security_events", "database_engine", "kubernetes_cluster", "financial_trading"]
    titles = [
        "SYSTEM LOG", "EVENT MONITOR", "LOG TAIL",
        "AUDIT STREAM", "SECURITY LOG", "CLUSTER EVENTS",
        "TRANSACTION LOG",
    ]

    LOG_TEMPLATES = {
        "web_server": [
            ("INFO",  "10.0.0.{ip} - GET /api/v2/users HTTP/1.1 200 {ms}ms"),
            ("INFO",  "10.0.0.{ip} - POST /api/v2/orders HTTP/1.1 201 {ms}ms"),
            ("WARN",  "10.0.0.{ip} - POST /api/v2/auth HTTP/1.1 401 {ms}ms"),
            ("INFO",  "10.0.0.{ip} - GET /static/app.{ext} HTTP/1.1 304 {ms}ms"),
            ("ERROR", "Connection timeout from 10.0.0.{ip} after {ms}ms"),
            ("INFO",  "Cache HIT /api/v2/products?page={n} [{ms}ms]"),
            ("WARN",  "Rate limit approaching: 10.0.0.{ip} [{n} req/min]"),
            ("ERROR", "Upstream /backend:{port} failed health check"),
            ("INFO",  "SSL cert renewed for app.example.com [365 days]"),
            ("DEBUG", "Request trace {hex} completed [{ms}ms]"),
        ],
        "security_events": [
            ("CRIT",  "BREACH ATTEMPT: 45.33.32.{ip} — SQL injection detected"),
            ("ERROR", "FAILED AUTH: user 'admin' from {ip}.{ip}.{ip}.{ip} [{n} attempts]"),
            ("WARN",  "Port scan detected: 192.168.{ip}.{ip} → {n} ports in {ms}ms"),
            ("CRIT",  "PRIVILEGE ESCALATION: user={user} → root on {host}"),
            ("ERROR", "FIREWALL DROP: SRC={ip}.{ip}.{ip}.{ip} DST=10.0.0.1 PORT={port}"),
            ("WARN",  "Anomalous traffic pattern: {n} packets/sec from {hex}"),
            ("INFO",  "IDS signature match: Snort rule {n} — benign"),
            ("CRIT",  "DATA EXFILTRATION ALERT: {n}MB outbound to 185.{ip}.{ip}.{ip}"),
            ("ERROR", "Certificate mismatch: expected CN=app.corp, got CN={hex}"),
            ("WARN",  "Session hijack attempt blocked: token reuse from {ip}.{ip}.{n}.{n}"),
        ],
        "database_engine": [
            ("INFO",  "Query completed: SELECT * FROM orders WHERE… [{ms}ms, {n} rows]"),
            ("WARN",  "Slow query detected [{ms}ms]: UPDATE users SET last_seen=NOW()"),
            ("ERROR", "Deadlock detected: txn {hex} vs txn {hex2} — rolled back"),
            ("INFO",  "Vacuum: orders table — {n} dead tuples removed [{ms}ms]"),
            ("INFO",  "Checkpoint started — {n} dirty buffers to flush"),
            ("WARN",  "Connection pool exhausted: {n}/{n2} connections in use"),
            ("INFO",  "Replication lag: replica-1 behind by {ms}ms"),
            ("ERROR", "Index corruption detected on users_email_idx — rebuilding"),
            ("INFO",  "Autovacuum: table public.events — {n} tuples vacuumed"),
            ("WARN",  "Cache hit ratio below threshold: {n}% [target: 95%]"),
        ],
        "kubernetes_cluster": [
            ("INFO",  "Pod web-{n}-{hex} scheduled on node worker-{n2}"),
            ("WARN",  "Pod db-replica-{n} evicted: insufficient memory"),
            ("ERROR", "OOMKill: container api-server in pod api-{hex} killed"),
            ("INFO",  "Deployment rollout complete: api-server v{n}.{n2}.{n3}"),
            ("WARN",  "Node worker-{n}: disk pressure detected [{n2}% full]"),
            ("ERROR", "ImagePullBackOff: registry.corp/app:{hex} not found"),
            ("INFO",  "HPA scaled api-server: {n} → {n2} replicas"),
            ("WARN",  "PVC storage-{n} at {n2}% capacity"),
            ("ERROR", "Liveness probe failed: pod metrics-{hex} restarting [{n}/3]"),
            ("INFO",  "NetworkPolicy applied: deny-all ingress on namespace prod"),
        ],
        "financial_trading": [
            ("INFO",  "BUY AAPL 100@{price} [fill: {n}ms] OrderID:{hex}"),
            ("INFO",  "SELL TSLA 50@{price2} [fill: {n}ms] OrderID:{hex2}"),
            ("WARN",  "Circuit breaker triggered: SPY volatility >{n}%"),
            ("CRIT",  "MARGIN CALL: Account {hex} — deficit ${n},{n2}"),
            ("INFO",  "STOP LOSS executed: NVDA 200@{price3} — loss ${n},{n2}"),
            ("WARN",  "Latency spike: order routing {ms}ms [SLA: 50ms]"),
            ("INFO",  "Market open — {n} orders pending execution"),
            ("ERROR", "Order rejected: insufficient buying power [{hex}]"),
            ("WARN",  "Unusual volume: {n}x average on GME"),
            ("INFO",  "Position limit reached: SPX futures {n} contracts"),
        ],
    }

    def _format(self, template):
        import random, string
        replacements = {
            "{ip}": str(random.randint(1, 254)),
            "{ms}": str(random.randint(2, 3000)),
            "{n}": str(random.randint(1, 999)),
            "{n2}": str(random.randint(1, 99)),
            "{n3}": str(random.randint(0, 9)),
            "{port}": str(random.choice([22, 80, 443, 3306, 5432, 6379, 8080])),
            "{hex}": ''.join(random.choices('0123456789abcdef', k=8)),
            "{hex2}": ''.join(random.choices('0123456789abcdef', k=8)),
            "{ext}": random.choice(["js", "css", "woff2", "png"]),
            "{user}": random.choice(["deploy", "jenkins", "ubuntu", "app"]),
            "{host}": random.choice(["web-01", "worker-3", "bastion", "api-7"]),
            "{price}": f"{random.uniform(100, 500):.2f}",
            "{price2}": f"{random.uniform(100, 500):.2f}",
            "{price3}": f"{random.uniform(100, 500):.2f}",
        }
        result = template
        for k, v in replacements.items():
            result = result.replace(k, v)
        return result

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._templates = self.LOG_TEMPLATES[self.strategy]
        self._lines = []
        self._ts = datetime.utcnow() - timedelta(seconds=60)
        for _ in range(random.randint(10, 20)):
            self._advance()

    def _advance(self):
        self._ts += timedelta(milliseconds=random.randint(50, 2000))
        level, template = random.choice(self._templates)
        msg = self._format(template)
        self._lines.append({
            "timestamp": self._ts.strftime("%H:%M:%S.%f")[:-3],
            "level": level,
            "text": msg,
        })
        if len(self._lines) > 50:
            self._lines = self._lines[-50:]

    def _get_state(self):
        return {"lines": self._lines}

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        n = random.randint(1, 4)
        for _ in range(n):
            self._advance()
        self._last_added = n
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        n = getattr(self, '_last_added', 0)
        if n and new_state["lines"]:
            return {
                "_delta": True,
                "_limits": {"lines": 50},
                "append_lines": new_state["lines"][-n:],
            }
        return None
