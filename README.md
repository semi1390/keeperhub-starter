# KeeperHub Starter Template

> Get from zero to your first KeeperHub workflow execution in under 10 minutes.

A minimal, well-documented TypeScript starter for building AI agents that execute onchain through KeeperHub. Built during the KeeperHub Agents Onchain Hackathon by the SentinelLP team.

---

## What this includes

- **`src/client.ts`** — a clean KeeperHub API wrapper covering the full workflow lifecycle
- **`src/nodes.ts`** — helper functions for building workflow nodes (with all the schema gotchas documented)
- **`src/examples/read-contract.ts`** — read a contract value via KeeperHub
- **`src/examples/write-contract.ts`** — call a write function, get a tx hash
- **`src/examples/erc20-transfer.ts`** — multi-step workflow: approve + transfer
- **`SCHEMA.md`** — the undocumented workflow JSON schema we reverse-engineered (~6 hours of trial and error, saved for you here)

---

## Quick start

```bash
git clone https://github.com/semi1390/keeperhub-starter
cd keeperhub-starter
npm install
cp .env.example .env
# Fill in your KEEPERHUB_API_KEY
```

Get your API key from [app.keeperhub.com/settings/api-keys](https://app.keeperhub.com/settings/api-keys).

**Step 1 — Verify your setup (no signing required):**
```bash
npm run example:read
```
This reads a contract value and prints your wallet integrations. If it works, your API key is valid.

**Step 2 — Get your wallet integration ID:**
The read example prints your wallets. Copy the `id` of the wallet you want to use for write operations. Add it to `.env` as `WALLET_INTEGRATION_ID`.

**Step 3 — Execute a write transaction:**
```bash
npm run example:write
```
This calls a contract function through KeeperHub. Gas is sponsored — you don't need ETH in your wallet.

---

## The workflow lifecycle

```
1. createWorkflow()    → workflowId
2. executeWorkflow()   → executionId
3. getExecutionStatus() → poll until "success" or "error"
4. getExecutionLogs()  → extract tx hash
```

---

## Key schema gotchas

The official KeeperHub docs don't cover these. They caused us hours of debugging:

**1. `abi` must be a JSON string:**
```typescript
// WRONG
abi: [{ name: "transfer", ... }]

// CORRECT
abi: JSON.stringify([{ name: "transfer", ... }])
```

**2. `functionArgs` must be a JSON string of named-field objects:**
```typescript
// WRONG
functionArgs: ["0xAddress", "1000000"]

// CORRECT
functionArgs: JSON.stringify([{ to: "0xAddress", amount: "1000000" }])
```

**3. Never use template expressions in `functionArgs`:**
```typescript
// WRONG — produces invalid JSON at runtime
functionArgs: `[{"deadline": {{@__system:timestamp}} + 3600}]`

// CORRECT — pre-compute the value
const deadline = Math.floor(Date.now() / 1000) + 600;
functionArgs: JSON.stringify([{ deadline }])
```

**4. `tokenConfig` for approve-token must be a JSON string:**
```typescript
tokenConfig: JSON.stringify({
  mode: "custom",
  customToken: { address: "0x...", symbol: "USDC" }
})
```

**5. Endpoint inconsistency:**
```
POST /api/workflows/create       ← plural
POST /api/workflow/{id}/execute  ← singular (!)
GET  /api/workflows/executions/  ← plural again
```

See `SCHEMA.md` for the full teardown.

---

## Building your own agent

Once you have the basics working, extend it:

```typescript
import { KeeperHubClient } from "./client";
import { triggerNode, writeContractNode, sequentialEdges } from "./nodes";

const client = new KeeperHubClient(process.env.KEEPERHUB_API_KEY!);

// 1. Build your nodes
const nodes = [
  triggerNode(),
  writeContractNode("my-step", "Do Something", {
    network: "11155111",
    contractAddress: "0x...",
    abi: MY_ABI,
    abiFunction: "myFunction",
    functionArgs: [{ param1: "value1" }],
    integrationId: process.env.WALLET_INTEGRATION_ID!,
  }),
];

// 2. Connect them
const edges = sequentialEdges(["trigger", "my-step"]);

// 3. Create + execute + wait
const workflowId = await client.createWorkflow({ name: "My Workflow", nodes, edges });
const executionId = await client.executeWorkflow(workflowId);
const result = await client.waitForCompletion(executionId);

console.log("Tx hash:", result.txHash);
```

---

## Real-world example

See [SentinelLP](https://github.com/semi1390/sentinellp) — an AI LP keeper built with this client that autonomously monitors Uniswap v3 positions and executes profitable rebalances through KeeperHub.

---

## Contributing

Found something else that's undocumented? Open a PR to `SCHEMA.md`. The goal is to document everything the official docs miss so no one has to spend 6 hours on it again.

---

Built for the [KeeperHub Agents Onchain Hackathon](https://dorahacks.io/hackathon/keeperhub) · July 2026