"""Process monitor generator — live CPU cores, memory, and process table."""
import random
from .base import BaseActivity


class ProcessMonitorActivity(BaseActivity):
    activity_type = "process_monitor"
    update_interval_override = 0.5  # 2 Hz — large process table, fully dynamic
    strategies = [
        "linux_server",
        "container_orchestrator",
        "gpu_cluster",
        "database_server",
        "web_farm",
    ]
    titles = [
        "PROCESS MONITOR",
        "SYSTEM STATUS",
        "TASK MANAGER",
        "CPU MONITOR",
        "PROC TABLE",
        "SYSMON",
        "RESOURCE TRACKER",
    ]

    CORES_PER_STRATEGY = {
        "linux_server": 8,
        "container_orchestrator": 16,
        "gpu_cluster": 4,
        "database_server": 8,
        "web_farm": 12,
    }

    PROCESS_NAMES = {
        "linux_server": [
            "nginx", "mysql", "sshd", "crond", "python3", "rsyslogd",
            "systemd", "journald", "bash", "node", "redis-server",
            "postfix", "dovecot", "fail2ban", "ufw",
        ],
        "container_orchestrator": [
            "kubelet", "containerd", "etcd", "kube-proxy", "kube-apiserver",
            "kube-scheduler", "coredns", "flannel", "calico-node",
            "cri-dockerd", "runc", "pause", "envoy", "istio-proxy",
            "prometheus",
        ],
        "gpu_cluster": [
            "cuda_worker", "nccl_comm", "pytorch", "tensorrt", "nvidia-smi",
            "dcgm-exporter", "gpu_monitor", "nv-hostengine", "mps_server",
            "cuda_memcpy", "cublas_bench", "nccl_allreduce", "triton_srv",
            "vllm_worker", "deepspeed",
        ],
        "database_server": [
            "postgres", "pg_wal", "pg_stat", "vacuum", "autovacuum",
            "pg_dump", "pg_restore", "pgbouncer", "patroni", "pg_basebackup",
            "repmgr", "pg_archiver", "checkpointer", "bg_writer",
            "wal_sender",
        ],
        "web_farm": [
            "httpd", "php-fpm", "redis", "memcached", "varnishd",
            "haproxy", "certbot", "logrotate", "node", "pm2",
            "gunicorn", "celery", "rabbitmq", "consul", "traefik",
        ],
    }

    USER_POOLS = {
        "linux_server": ["root", "www-data", "mysql", "nobody", "syslog", "mail"],
        "container_orchestrator": ["root", "nobody", "kube", "etcd", "istio", "prometheus"],
        "gpu_cluster": ["root", "cuda", "nobody", "ml-user", "nv-admin", "researcher"],
        "database_server": ["root", "postgres", "nobody", "repmgr", "pgbouncer", "barman"],
        "web_farm": ["root", "www-data", "nobody", "redis", "varnish", "haproxy"],
    }

    STATUS_OPTIONS = ["running", "sleeping"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        num_cores = self.CORES_PER_STRATEGY[self.strategy]
        self._cores = [{"usage": random.randint(5, 65)} for _ in range(num_cores)]
        self._mem_total = random.choice([8192, 16384, 32768, 65536])
        self._mem_used = int(self._mem_total * random.uniform(0.35, 0.75))
        self._next_pid = random.randint(1000, 9000)
        self._processes = []
        self._zombie_timers = {}  # pid -> frames remaining
        # Pre-fill process table
        num_procs = random.randint(15, 25)
        for _ in range(num_procs):
            self._processes.append(self._make_process())

    def _make_process(self, force_zombie=False):
        name = random.choice(self.PROCESS_NAMES[self.strategy])
        user = random.choice(self.USER_POOLS[self.strategy])
        pid = self._next_pid
        self._next_pid += random.randint(1, 20)
        cpu = round(random.uniform(0.0, 30.0), 1)
        mem = round(random.uniform(0.1, 12.0), 1)
        if force_zombie or random.random() < 0.02:
            status = "zombie"
            self._zombie_timers[pid] = random.randint(5, 15)
        else:
            status = random.choice(self.STATUS_OPTIONS)
        runtime = random.randint(10, 86400)
        return {
            "pid": pid,
            "name": name,
            "user": user,
            "cpu": cpu,
            "mem": mem,
            "status": status,
            "runtime": runtime,
        }

    @staticmethod
    def _format_runtime(seconds):
        h = seconds // 3600
        m = (seconds % 3600) // 60
        s = seconds % 60
        return f"{h:02d}:{m:02d}:{s:02d}"

    def _get_state(self):
        procs = []
        for p in self._processes:
            procs.append({
                "pid": p["pid"],
                "name": p["name"],
                "user": p["user"],
                "cpu": p["cpu"],
                "mem": p["mem"],
                "status": p["status"],
                "runtime": self._format_runtime(p["runtime"]),
            })
        # Compute load averages from core usage
        avg_usage = sum(c["usage"] for c in self._cores) / len(self._cores) / 100.0
        num_cores = len(self._cores)
        load_1m = round(avg_usage * num_cores + random.gauss(0, 0.15), 2)
        load_5m = round(avg_usage * num_cores * 0.9 + random.gauss(0, 0.1), 2)
        load_15m = round(avg_usage * num_cores * 0.8 + random.gauss(0, 0.05), 2)
        load_1m = max(0.0, load_1m)
        load_5m = max(0.0, load_5m)
        load_15m = max(0.0, load_15m)
        return {
            "cores": [{"usage": c["usage"]} for c in self._cores],
            "mem_total": self._mem_total,
            "mem_used": self._mem_used,
            "load_avg": [load_1m, load_5m, load_15m],
            "processes": procs,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Strip strategy (static), mem_total (static)
        return {
            "_delta": True,
            "cores": new_state["cores"],
            "mem_used": new_state["mem_used"],
            "load_avg": new_state["load_avg"],
            "processes": new_state["processes"],
        }

    def next_frame(self) -> dict:
        # --- Update core usage ---
        for core in self._cores:
            drift = random.randint(-3, 3)
            new_usage = core["usage"] + drift
            # Occasional spike: 5% chance per core
            if random.random() < 0.05:
                new_usage = random.randint(85, 100)
            core["usage"] = max(0, min(100, new_usage))

        # --- Update memory usage ---
        self._mem_used += random.randint(-64, 64)
        self._mem_used = max(512, min(self._mem_total - 256, self._mem_used))

        # --- Update processes ---
        # Increment runtime for all alive processes
        for p in self._processes:
            p["runtime"] += 1

        # Drift CPU/MEM slightly for existing processes
        for p in self._processes:
            p["cpu"] = round(max(0.0, min(100.0, p["cpu"] + random.gauss(0, 2.0))), 1)
            p["mem"] = round(max(0.1, min(50.0, p["mem"] + random.gauss(0, 0.3))), 1)

        # Zombie timer countdown — remove expired zombies
        expired_pids = set()
        for pid in list(self._zombie_timers):
            self._zombie_timers[pid] -= 1
            if self._zombie_timers[pid] <= 0:
                expired_pids.add(pid)
                del self._zombie_timers[pid]
        self._processes = [p for p in self._processes if p["pid"] not in expired_pids]

        # Process dies: 5% chance per frame (pick one)
        if self._processes and random.random() < 0.05:
            idx = random.randint(0, len(self._processes) - 1)
            dead = self._processes.pop(idx)
            # Clean up zombie timer if it was a zombie
            self._zombie_timers.pop(dead["pid"], None)

        # Process spawns: 8% chance per frame
        if random.random() < 0.08 and len(self._processes) < 30:
            self._processes.append(self._make_process())

        # Keep process count in 15-25 range with soft correction
        if len(self._processes) < 15:
            self._processes.append(self._make_process())
        elif len(self._processes) > 25:
            idx = random.randint(0, len(self._processes) - 1)
            dead = self._processes.pop(idx)
            self._zombie_timers.pop(dead["pid"], None)

        return self._get_state()
