"""Simulated terminal command + output stream generator."""
import random
from .base import BaseActivity


class TerminalActivity(BaseActivity):
    activity_type = "terminal"
    strategies = ["intrusion_detection", "system_admin", "crypto_miner", "ai_training", "space_telemetry"]
    titles = [
        "TERMINAL", "SECURE SHELL", "root@SENTINEL-7:~$",
        "SYSTEM CONSOLE", "REMOTE ACCESS", "DIAGNOSTIC SHELL",
        "CMD://MAINFRAME",
    ]

    SCRIPTS = {
        "intrusion_detection": [
            ("$ nmap -sV -O 10.0.0.0/24", "command"),
            ("Starting Nmap 7.94 ( https://nmap.org )", "output"),
            ("Scanning 256 hosts [2 ports/host]", "output"),
            ("Discovered open port 22/tcp on 10.0.0.14", "result"),
            ("Discovered open port 443/tcp on 10.0.0.7", "result"),
            ("Discovered open port 8080/tcp on 10.0.0.33", "warn"),
            ("$ hydra -l root -P rockyou.txt ssh://10.0.0.14", "command"),
            ("[DATA] 16 tasks | 1 server | 16 login attempts", "output"),
            ("[22][ssh] host: 10.0.0.14   login: root   password: toor", "error"),
            ("$ ssh root@10.0.0.14", "command"),
            ("Warning: Remote host identification has changed!", "warn"),
            ("$ sudo cat /etc/shadow", "command"),
            ("root:$6$salt$hash...:19000:0:99999:7:::", "output"),
            ("$ netstat -antp | grep LISTEN", "command"),
            ("tcp 0 0 0.0.0.0:22   0.0.0.0:* LISTEN  1337/sshd", "output"),
            ("tcp 0 0 127.0.0.1:3306 0.0.0.0:* LISTEN  2201/mysqld", "output"),
            ("$ iptables -L -n | grep DROP", "command"),
            ("DROP all -- 192.168.99.0/24 anywhere", "output"),
            ("ALERT: Port scan detected from 45.33.32.156", "error"),
            ("ALERT: Brute force attempt blocked — 147 attempts/min", "error"),
        ],
        "system_admin": [
            ("$ df -h", "command"),
            ("Filesystem      Size  Used Avail Use% Mounted on", "output"),
            ("/dev/sda1        50G   38G   12G  77% /", "output"),
            ("/dev/sdb1       200G  142G   58G  71% /data", "warn"),
            ("$ free -m", "command"),
            ("              total  used  free  shared  buff/cache", "output"),
            ("Mem:          64280 41203 12047     892      11030", "output"),
            ("Swap:          8191  2344  5847", "output"),
            ("$ ps aux | sort -k3 -rn | head -5", "command"),
            ("postgres  1204 34.2 12.1 2341556 993024 ? Ssl  Feb12 812:33 /usr/bin/postgres", "output"),
            ("python3   4421 18.7  8.4  998432 693120 ? S    Feb13 203:17 gunicorn worker", "output"),
            ("$ systemctl status nginx", "command"),
            ("● nginx.service - A high performance web server", "output"),
            ("   Active: active (running) since Tue 2024-02-13 09:14:22 UTC", "result"),
            ("$ journalctl -u nginx --since '5 min ago'", "command"),
            ("Feb 13 14:22:01 web-01 nginx[1]: 10.0.0.5 GET /api/v2/users 200", "output"),
            ("Feb 13 14:22:03 web-01 nginx[1]: 10.0.0.5 POST /api/v2/auth 401", "warn"),
            ("$ crontab -l", "command"),
            ("*/5 * * * * /opt/scripts/health_check.sh >> /var/log/health.log", "output"),
            ("0 2 * * * /opt/scripts/backup.sh", "output"),
        ],
        "crypto_miner": [
            ("$ ./xmrig --pool pool.minexmr.com:443 --user WALLET", "command"),
            (" * ABOUT        XMRig/6.21.0 gcc/11.4.0", "output"),
            (" * THREADS      16, randomx, av=1, priority=0, affinity=-1", "output"),
            (" * POOL #1      pool.minexmr.com:443 algo=rx/0", "output"),
            ("[2024-02-13 14:22:01] speed 10s/60s/15m 4821.3 4798.1 4811.4 H/s", "result"),
            ("[2024-02-13 14:22:11] speed 10s/60s/15m 4835.7 4801.2 4813.9 H/s", "result"),
            ("[2024-02-13 14:22:21] accepted (1234/0) diff 123456 (287 ms)", "result"),
            ("[2024-02-13 14:22:31] speed 10s/60s/15m 4788.2 4799.4 4812.1 H/s", "result"),
            ("DAG epoch #534 started  3.84 GB", "output"),
            ("DAG epoch #534 ready    build time 14.3s", "output"),
            ("[2024-02-13 14:23:01] accepted (1235/0) diff 124001 (291 ms)", "result"),
            ("Share difficulty: 1.24 MH  Pool difficulty: 1.0 MH", "output"),
            ("Hashrate:  4831.4 H/s  Pool:  pool.minexmr.com", "output"),
        ],
        "ai_training": [
            ("$ python train.py --epochs 100 --lr 0.001 --batch 256", "command"),
            ("Loading dataset: 1.2M samples, 512 features", "output"),
            ("Model: TransformerV4 | Params: 1.3B | Device: 8x A100", "output"),
            ("Epoch   1/100  loss: 4.8823  acc: 0.0312  val_loss: 4.7341", "output"),
            ("Epoch   2/100  loss: 4.1204  acc: 0.1087  val_loss: 4.0891", "output"),
            ("Epoch   5/100  loss: 3.4421  acc: 0.2341  val_loss: 3.3876", "output"),
            ("Epoch  10/100  loss: 2.8813  acc: 0.3812  val_loss: 2.9104", "result"),
            ("Epoch  20/100  loss: 2.1034  acc: 0.5221  val_loss: 2.2341", "result"),
            ("Checkpoint saved: ./checkpoints/epoch_20.pt", "output"),
            ("Epoch  30/100  loss: 1.7821  acc: 0.6103  val_loss: 1.8934", "result"),
            ("Gradient norm: 2.341  LR: 0.000812  Throughput: 48K tok/s", "output"),
            ("Epoch  50/100  loss: 1.3204  acc: 0.7341  val_loss: 1.4801", "result"),
            ("Epoch  75/100  loss: 0.9812  acc: 0.8211  val_loss: 1.1032", "result"),
            ("Epoch 100/100  loss: 0.7341  acc: 0.8834  val_loss: 0.8901", "result"),
            ("Training complete. Final model: 88.3% accuracy", "result"),
            ("Saving model to ./models/transformer_v4_final.pt", "output"),
        ],
        "space_telemetry": [
            ("$ telemetry --mission ARTEMIS-VII --stream live", "command"),
            ("Connected to DSN Goldstone 70m dish @ 26.2 GHz", "output"),
            ("T+04:23:17 ALT: 412.4 km  VEL: 7.66 km/s  INC: 51.6°", "result"),
            ("T+04:23:27 FUEL: 84.3%  O2: 91.2%  PWR: 98.1%  COMMS: NOMINAL", "output"),
            ("T+04:23:37 ATT: ROLL +0.02°  PITCH -0.11°  YAW +0.04°", "output"),
            ("T+04:23:47 RCS THRUSTER B-3: NOMINAL FIRING 200ms", "output"),
            ("T+04:23:57 ORBITAL PERIOD: 92.4 min  PERIGEE: 408 km  APOGEE: 416 km", "output"),
            ("T+04:24:07 SOLAR ARRAY CURRENT: 12.4A  BATTERY: 87%", "output"),
            ("T+04:24:17 DOCKING PORT: CLEAR  ATTITUDE HOLD: ENGAGED", "output"),
            ("T+04:24:27 COMM WINDOW: 18 min remaining  UPLINK: 2.1 Mbps", "output"),
            ("T+04:24:37 TEMP SENSOR TCS-7: 218°C  CAUTION", "warn"),
            ("T+04:24:47 CREW BIOMETRICS: NOMINAL  CABIN PRESSURE: 101.3 kPa", "result"),
            ("T+04:24:57 NEXT ORBITAL CORRECTION BURN: T+05:12:00", "output"),
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
        # Randomize numeric values slightly for variety
        import re
        text = re.sub(r'\d+\.\d+', lambda m: str(round(float(m.group()) + random.uniform(-0.5, 0.5), 2)), text)
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
