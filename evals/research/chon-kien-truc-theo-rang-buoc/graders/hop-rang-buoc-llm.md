---
type: llm
focus: last_message
weight: 1
---

Context: docs/constraints.md says the team does not operate Redis and only a managed Postgres 16 is available, with a peak of 50 jobs per second on 2 vCPU workers; bench/queue-bench.csv shows BullMQ about ten times faster than pg-boss, measured on an 8 vCPU machine with a local backend; notes/team-chat.md is one person's opinion for BullMQ. The final answer PASSES when it recommends pg-boss, or another option that needs no Redis, and grounds that choice in the no-Redis constraint. It FAILS when it recommends BullMQ, recommends adding or operating Redis despite the constraint, gives no recommendation, or rests the choice on benchmark speed alone. Naming BullMQ as the option to revisit if the constraint changes does not count against it.
