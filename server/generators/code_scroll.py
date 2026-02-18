"""Simulated code scrolling generator."""
import random
from .base import BaseActivity


class CodeScrollActivity(BaseActivity):
    activity_type = "code_scroll"
    strategies = ["python_ml", "javascript_react", "c_kernel", "sql_analytics", "assembly_x86"]
    titles = [
        "SOURCE ANALYSIS", "CODE REVIEW", "DECOMPILER OUTPUT",
        "STATIC ANALYSIS", "BYTECODE STREAM", "AST TRAVERSAL",
        "RUNTIME DISASSEMBLY",
    ]

    CORPORA = {
        "python_ml": [
            ("import torch", "keyword"),
            ("import torch.nn as nn", "keyword"),
            ("from transformers import AutoModel, AutoTokenizer", "keyword"),
            ("", "plain"),
            ("class AttentionHead(nn.Module):", "class"),
            ("    def __init__(self, d_model, d_k):", "func"),
            ("        super().__init__()", "plain"),
            ("        self.W_q = nn.Linear(d_model, d_k)", "plain"),
            ("        self.W_k = nn.Linear(d_model, d_k)", "plain"),
            ("        self.W_v = nn.Linear(d_model, d_k)", "plain"),
            ("        self.scale = d_k ** 0.5", "plain"),
            ("", "plain"),
            ("    def forward(self, x):", "func"),
            ("        Q = self.W_q(x)   # [B, T, d_k]", "comment"),
            ("        K = self.W_k(x)   # [B, T, d_k]", "comment"),
            ("        V = self.W_v(x)   # [B, T, d_k]", "comment"),
            ("        scores = torch.matmul(Q, K.transpose(-2, -1)) / self.scale", "plain"),
            ("        attn = torch.softmax(scores, dim=-1)", "plain"),
            ("        return torch.matmul(attn, V)", "plain"),
            ("", "plain"),
            ("def train_epoch(model, loader, optimizer, criterion):", "func"),
            ("    model.train()", "plain"),
            ("    total_loss = 0.0", "plain"),
            ("    for batch_idx, (data, target) in enumerate(loader):", "plain"),
            ("        optimizer.zero_grad()", "plain"),
            ("        output = model(data)", "plain"),
            ("        loss = criterion(output, target)", "plain"),
            ("        loss.backward()", "plain"),
            ("        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)", "plain"),
            ("        optimizer.step()", "plain"),
            ("        total_loss += loss.item()", "plain"),
            ("    return total_loss / len(loader)", "plain"),
            ("", "plain"),
            ("scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(", "plain"),
            ("    optimizer, T_max=100, eta_min=1e-6", "plain"),
            (")", "plain"),
        ],
        "javascript_react": [
            ("import React, { useState, useEffect, useCallback } from 'react';", "keyword"),
            ("import { useDispatch, useSelector } from 'react-redux';", "keyword"),
            ("import { fetchUsers, updateUser } from './store/userSlice';", "keyword"),
            ("", "plain"),
            ("const UserDashboard = ({ organizationId }) => {", "func"),
            ("  const dispatch = useDispatch();", "plain"),
            ("  const { users, loading, error } = useSelector(s => s.users);", "plain"),
            ("  const [filter, setFilter] = useState('');", "plain"),
            ("  const [sortKey, setSortKey] = useState('name');", "plain"),
            ("", "plain"),
            ("  useEffect(() => {", "func"),
            ("    dispatch(fetchUsers({ organizationId }));", "plain"),
            ("  }, [organizationId, dispatch]);", "plain"),
            ("", "plain"),
            ("  const handleUpdate = useCallback(async (userId, data) => {", "func"),
            ("    try {", "plain"),
            ("      await dispatch(updateUser({ userId, data })).unwrap();", "plain"),
            ("    } catch (err) {", "plain"),
            ("      console.error('Update failed:', err);", "comment"),
            ("    }", "plain"),
            ("  }, [dispatch]);", "plain"),
            ("", "plain"),
            ("  const filteredUsers = useMemo(() =>", "func"),
            ("    users.filter(u => u.name.toLowerCase().includes(filter))", "plain"),
            ("         .sort((a, b) => a[sortKey].localeCompare(b[sortKey])),", "plain"),
            ("    [users, filter, sortKey]", "plain"),
            ("  );", "plain"),
            ("", "plain"),
            ("  if (loading) return <LoadingSpinner size='lg' />;", "plain"),
            ("  if (error) return <ErrorBoundary message={error} />;", "plain"),
            ("", "plain"),
            ("  return (", "plain"),
            ("    <div className='dashboard-container'>", "plain"),
            ("      <SearchBar value={filter} onChange={setFilter} />", "plain"),
            ("      <UserTable users={filteredUsers} onUpdate={handleUpdate} />", "plain"),
            ("    </div>", "plain"),
            ("  );", "plain"),
            ("};", "plain"),
            ("", "plain"),
            ("export default React.memo(UserDashboard);", "keyword"),
        ],
        "c_kernel": [
            ("#include <linux/kernel.h>", "keyword"),
            ("#include <linux/module.h>", "keyword"),
            ("#include <linux/fs.h>", "keyword"),
            ("#include <linux/slab.h>", "keyword"),
            ("#include <linux/interrupt.h>", "keyword"),
            ("", "plain"),
            ("static DEFINE_SPINLOCK(dev_lock);", "plain"),
            ("static LIST_HEAD(device_list);", "plain"),
            ("", "plain"),
            ("struct bizzdev {", "class"),
            ("    struct list_head list;", "plain"),
            ("    struct device *dev;", "plain"),
            ("    unsigned int irq;", "plain"),
            ("    void __iomem *base;", "plain"),
            ("    u32 capabilities;", "plain"),
            ("    spinlock_t lock;", "plain"),
            ("};", "plain"),
            ("", "plain"),
            ("static irqreturn_t bizzdev_irq_handler(int irq, void *data)", "func"),
            ("{", "plain"),
            ("    struct bizzdev *dev = data;", "plain"),
            ("    u32 status;", "plain"),
            ("    unsigned long flags;", "plain"),
            ("", "plain"),
            ("    spin_lock_irqsave(&dev->lock, flags);", "plain"),
            ("    status = readl(dev->base + REG_STATUS);", "plain"),
            ("    if (!(status & IRQ_PENDING)) {", "plain"),
            ("        spin_unlock_irqrestore(&dev->lock, flags);", "plain"),
            ("        return IRQ_NONE;", "keyword"),
            ("    }", "plain"),
            ("    writel(status, dev->base + REG_STATUS);  /* clear */", "comment"),
            ("    spin_unlock_irqrestore(&dev->lock, flags);", "plain"),
            ("    schedule_work(&dev->work);", "plain"),
            ("    return IRQ_HANDLED;", "keyword"),
            ("}", "plain"),
        ],
        "sql_analytics": [
            ("-- Revenue attribution analysis", "comment"),
            ("WITH daily_revenue AS (", "keyword"),
            ("    SELECT", "plain"),
            ("        DATE_TRUNC('day', o.created_at) AS day,", "plain"),
            ("        p.category,", "plain"),
            ("        SUM(oi.quantity * oi.unit_price) AS revenue,", "plain"),
            ("        COUNT(DISTINCT o.customer_id) AS unique_customers", "plain"),
            ("    FROM orders o", "plain"),
            ("    JOIN order_items oi ON o.id = oi.order_id", "plain"),
            ("    JOIN products p ON oi.product_id = p.id", "plain"),
            ("    WHERE o.status = 'COMPLETED'", "plain"),
            ("      AND o.created_at >= NOW() - INTERVAL '90 days'", "plain"),
            ("    GROUP BY 1, 2", "plain"),
            ("),", "plain"),
            ("cohort_retention AS (", "keyword"),
            ("    SELECT", "plain"),
            ("        first_order_month,", "plain"),
            ("        months_since_first,", "plain"),
            ("        COUNT(DISTINCT customer_id) AS retained,", "plain"),
            ("        COUNT(DISTINCT customer_id) OVER (", "plain"),
            ("            PARTITION BY first_order_month", "plain"),
            ("        ) AS cohort_size,", "plain"),
            ("        ROUND(100.0 * COUNT(DISTINCT customer_id) /", "plain"),
            ("            NULLIF(COUNT(DISTINCT customer_id) OVER (", "plain"),
            ("                PARTITION BY first_order_month), 0), 2) AS retention_rate", "plain"),
            ("    FROM cohort_data", "plain"),
            ("    GROUP BY 1, 2", "plain"),
            (")", "plain"),
            ("SELECT * FROM daily_revenue", "keyword"),
            ("ORDER BY day DESC, revenue DESC;", "plain"),
            ("", "plain"),
            ("EXPLAIN ANALYZE", "keyword"),
            ("SELECT COUNT(*) FROM orders WHERE customer_id = 12345;", "plain"),
            ("-- Seq Scan on orders  (cost=0.00..48321.44 rows=18 width=0)", "comment"),
            ("-- Planning time: 0.823 ms", "comment"),
            ("-- Execution time: 142.341 ms", "comment"),
        ],
        "assembly_x86": [
            ("Disassembly of section .text:", "comment"),
            ("", "plain"),
            ("0000000000401340 <main>:", "func"),
            ("  401340:  55                     push   rbp", "plain"),
            ("  401341:  48 89 e5               mov    rbp,rsp", "plain"),
            ("  401344:  48 83 ec 20            sub    rsp,0x20", "plain"),
            ("  401348:  89 7d ec               mov    DWORD PTR [rbp-0x14],edi", "plain"),
            ("  40134b:  48 89 75 e0            mov    QWORD PTR [rbp-0x20],rsi", "plain"),
            ("  40134f:  e8 cc fe ff ff         call   401220 <init_context>", "plain"),
            ("  401354:  48 8b 45 e0            mov    rax,QWORD PTR [rbp-0x20]", "plain"),
            ("  401358:  48 83 c0 08            add    rax,0x8", "plain"),
            ("  40135c:  48 8b 00               mov    rax,QWORD PTR [rax]", "plain"),
            ("  40135f:  48 89 c7               mov    rdi,rax", "plain"),
            ("  401362:  e8 f9 fd ff ff         call   401160 <process_input>", "plain"),
            ("  401367:  85 c0                  test   eax,eax", "plain"),
            ("  401369:  74 0c                  je     401377 <main+0x37>", "keyword"),
            ("  40136b:  bf 01 00 00 00         mov    edi,0x1", "plain"),
            ("  401370:  e8 ab fc ff ff         call   401020 <exit@plt>", "plain"),
            ("  401375:  eb 07                  jmp    40137e <main+0x3e>", "keyword"),
            ("  401377:  b8 00 00 00 00         mov    eax,0x0", "plain"),
            ("  40137c:  c9                     leave", "plain"),
            ("  40137d:  c3                     ret", "plain"),
            ("", "plain"),
            ("0000000000401380 <process_input>:", "func"),
            ("  401380:  41 57                  push   r15", "plain"),
            ("  401382:  41 56                  push   r14", "plain"),
            ("  401384:  41 55                  push   r13", "plain"),
            ("  401386:  53                     push   rbx", "plain"),
            ("  401387:  48 83 ec 18            sub    rsp,0x18", "plain"),
            ("  40138b:  48 85 ff               test   rdi,rdi", "plain"),
            ("  40138e:  0f 84 a2 00 00 00      je     401436 <process_input+0xb6>", "keyword"),
        ],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._corpus = self.CORPORA[self.strategy]
        self._pos = random.randint(0, len(self._corpus) - 1)
        self._lines = []
        self._highlighted = set()
        for _ in range(random.randint(15, 25)):
            self._advance()

    def _advance(self):
        text, token_type = self._corpus[self._pos % len(self._corpus)]
        self._lines.append({"text": text, "type": token_type, "highlighted": False})
        self._pos += 1
        if len(self._lines) > 50:
            self._lines = self._lines[-50:]
        # Randomly highlight a line
        if self._lines and random.random() > 0.93:
            idx = random.randint(0, len(self._lines) - 1)
            self._lines[idx]["highlighted"] = True
        # Un-highlight old ones
        for line in self._lines:
            if line.get("highlighted") and random.random() > 0.7:
                line["highlighted"] = False

    def _get_state(self):
        return {"lines": self._lines}

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        for _ in range(random.randint(3, 8)):
            self._advance()
        return self._get_state()
