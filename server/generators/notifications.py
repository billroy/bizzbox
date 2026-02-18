"""Toast-like notification stack generator."""
import random
import time
from .base import BaseActivity


class NotificationsActivity(BaseActivity):
    activity_type = "notifications"
    strategies = ["security_alerts", "system_events", "trading_signals", "mission_comms", "social_feed"]
    titles = [
        "ALERT STACK", "NOTIFICATIONS", "EVENT FEED",
        "SIGNAL MONITOR", "MISSION COMMS", "SYSTEM ALERTS",
        "LIVE FEED",
    ]

    NOTIFICATION_TEMPLATES = {
        "security_alerts": [
            ("CRIT",  "BREACH ATTEMPT",      "Intrusion detected from {ip} — {port}/tcp"),
            ("ERROR", "ANOMALY DETECTED",    "Behavioral deviation score: {score}/100"),
            ("WARN",  "SESSION HIJACK",      "Token reuse detected for user {user}"),
            ("CRIT",  "EXFILTRATION ALERT",  "{n}MB outbound to unknown host {ip}"),
            ("WARN",  "AUTH FAILURE",        "{n} failed logins — {user}@{host}"),
            ("INFO",  "IDS SIGNATURE",       "Rule {n} triggered — classified benign"),
            ("CRIT",  "RANSOMWARE ACTIVITY", "File encryption detected on {host}"),
            ("ERROR", "PRIVILEGE ESC",       "User {user} attempted root escalation"),
        ],
        "system_events": [
            ("INFO",  "SERVICE RESTART",     "nginx restarted in {ms}ms — 0 downtime"),
            ("ERROR", "DISK FULL",           "Partition /data at {n}% capacity"),
            ("INFO",  "BACKUP COMPLETE",     "{n}GB archived to s3://backups/{hex}"),
            ("WARN",  "MEMORY PRESSURE",     "Available: {n}MB — threshold exceeded"),
            ("INFO",  "DEPLOY COMPLETE",     "v{n}.{n2}.{n3} deployed to {n4} nodes"),
            ("ERROR", "SERVICE DOWN",        "{svc} unresponsive — restarting"),
            ("INFO",  "CERT RENEWED",        "TLS cert for api.corp extended 365d"),
            ("WARN",  "CPU SPIKE",           "Load average {n}.{n2} — above baseline"),
        ],
        "trading_signals": [
            ("INFO",  "BUY SIGNAL",          "{ticker} — MA crossover at ${price}"),
            ("WARN",  "STOP LOSS",           "{ticker} triggered stop @ ${price2}"),
            ("CRIT",  "MARGIN CALL",         "Account {hex} deficit: ${n},{n2}"),
            ("INFO",  "ORDER FILLED",        "{n} {ticker} @ ${price} [{ms}ms]"),
            ("WARN",  "CIRCUIT BREAKER",     "Volatility halt: {ticker} {n}% move"),
            ("INFO",  "POSITION OPENED",     "LONG {ticker} x{n} @ ${price3}"),
            ("ERROR", "ORDER REJECTED",      "Insufficient margin — {ticker} rejected"),
            ("WARN",  "UNUSUAL VOLUME",      "{ticker}: {n}x average — investigating"),
        ],
        "mission_comms": [
            ("INFO",  "UPLINK ESTABLISHED",  "DSS-{n} Goldstone — 26.2 GHz — {ms}ms RTT"),
            ("WARN",  "TELEMETRY ANOMALY",   "Sensor TCS-{n} reading {n2}°C above nominal"),
            ("INFO",  "MANEUVER COMPLETE",   "OCS burn {ms}ms — orbit adj confirmed"),
            ("ERROR", "COMMS DROPOUT",       "Signal lost — AOS in {n} minutes"),
            ("INFO",  "CREW STATUS",         "All systems nominal — EVA in T+{n}h"),
            ("WARN",  "DEBRIS AVOIDANCE",    "Object {hex} Δv burn required at T+{n}min"),
            ("INFO",  "DATA DOWNLINK",       "{n}GB telemetry received — {n2}% complete"),
            ("CRIT",  "TRAJECTORY ALERT",    "Deviation detected — corrective burn ordered"),
        ],
        "social_feed": [
            ("INFO",  "TRENDING",            "#{tag} — {n}K mentions in last hour"),
            ("WARN",  "CONTENT FLAGGED",     "@user_{hex}: policy violation detected"),
            ("INFO",  "VIRAL CONTENT",       "Post {hex}: {n}K shares in {n2}min"),
            ("ERROR", "SPAM CLUSTER",        "Bot network detected — {n} accounts"),
            ("INFO",  "ENGAGEMENT SPIKE",    "{n}% surge — hashtag #{tag2}"),
            ("WARN",  "MISINFORMATION",      "Claim flagged by {n} fact-checkers"),
            ("INFO",  "LIVE STREAM",         "@stream_{n} online — {n2}K viewers"),
            ("CRIT",  "COORDINATED ATTACK",  "Inauthentic behavior: {n} accounts"),
        ],
    }

    TAGS = ["AI", "BREAKING", "ALERT", "TECH", "CRISIS", "UPDATE", "LIVE"]
    TICKERS = ["AAPL", "TSLA", "NVDA", "GME", "SPY", "BTC", "ETH"]
    SERVICES = ["nginx", "postgres", "redis", "kafka", "api-server", "worker"]
    USERS = ["deploy", "jenkins", "admin", "ubuntu", "svc-account"]
    HOSTS = ["web-01", "worker-3", "bastion", "db-primary", "cache-01"]

    def _format(self, template):
        import random, string
        return (template
            .replace("{ip}", f"{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}")
            .replace("{port}", str(random.choice([22, 80, 443, 3306, 8080])))
            .replace("{score}", str(random.randint(60, 99)))
            .replace("{user}", random.choice(self.USERS))
            .replace("{host}", random.choice(self.HOSTS))
            .replace("{svc}", random.choice(self.SERVICES))
            .replace("{n4}", str(random.randint(2, 20)))
            .replace("{n3}", str(random.randint(0, 9)))
            .replace("{n2}", str(random.randint(1, 99)))
            .replace("{n}", str(random.randint(1, 999)))
            .replace("{ms}", str(random.randint(10, 5000)))
            .replace("{hex}", ''.join(random.choices('0123456789abcdef', k=8)))
            .replace("{hex2}", ''.join(random.choices('0123456789abcdef', k=8)))
            .replace("{price}", f"{random.uniform(10, 500):.2f}")
            .replace("{price2}", f"{random.uniform(10, 500):.2f}")
            .replace("{price3}", f"{random.uniform(10, 500):.2f}")
            .replace("{ticker}", random.choice(self.TICKERS))
            .replace("{tag}", random.choice(self.TAGS))
            .replace("{tag2}", random.choice(self.TAGS))
        )

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._templates = self.NOTIFICATION_TEMPLATES[self.strategy]
        self._stack = []
        self._next_id = 1
        # Seed initial notifications
        for _ in range(random.randint(2, 5)):
            self._add_notification()

    def _add_notification(self):
        level, title, body_tmpl = random.choice(self._templates)
        self._stack.append({
            "id": self._next_id,
            "level": level,
            "title": title,
            "body": self._format(body_tmpl),
            "age_ms": random.randint(0, 8000),
            "max_age_ms": random.randint(8000, 15000),
        })
        self._next_id += 1

    def _get_state(self):
        return {"stack": self._stack}

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Age all notifications
        dt_ms = random.randint(200, 800)
        for n in self._stack:
            n["age_ms"] += dt_ms
        # Remove expired
        self._stack = [n for n in self._stack if n["age_ms"] < n["max_age_ms"]]
        # Add new notifications
        if len(self._stack) < 6 and random.random() > 0.4:
            self._add_notification()
        # Limit stack
        if len(self._stack) > 8:
            self._stack = self._stack[-8:]
        return self._get_state()
