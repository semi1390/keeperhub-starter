// ============================================================
// Example 2: Write Contract
//
// Calls a write function on a contract through KeeperHub.
// KeeperHub signs and submits the transaction — gas sponsored.
//
// This example calls a simple storage contract.
// Replace with your own contract/ABI/function.
//
// Run: npm run example:write
// ============================================================

import * as dotenv from "dotenv";
dotenv.config();

import { KeeperHubClient } from "../client";
import { triggerNode, writeContractNode, sequentialEdges } from "../nodes";

const API_KEY = process.env.KEEPERHUB_API_KEY!;
const NETWORK = process.env.NETWORK ?? "11155111";
const WALLET_ID = process.env.WALLET_INTEGRATION_ID!;

// Example: a simple value storage contract on Sepolia
// Replace with your own contract
const EXAMPLE_CONTRACT = "0x1238536071e1c677a632429e3655c799b22cda52";

const EXAMPLE_ABI = [
  {
    name: "store",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "value", type: "uint256" }],
    outputs: [],
  },
];

async function main() {
  if (!WALLET_ID) {
    console.error(
      "❌ WALLET_INTEGRATION_ID not set in .env\n" +
      "   Run: npm run example:read to find your wallet ID"
    );
    process.exit(1);
  }

  const client = new KeeperHubClient(API_KEY);

  console.log("✍️  KeeperHub Starter — Write Contract Example");
  console.log(`Network: ${NETWORK === "1" ? "Ethereum Mainnet" : "Sepolia Testnet"}\n`);

  // Pre-compute deadline — DO NOT use template expressions like
  // {{@__system:timestamp}} in functionArgs — they break JSON parsing
  const deadline = Math.floor(Date.now() / 1000) + 600;

  const nodes = [
    triggerNode(),
    writeContractNode("step-write", "Store Value", {
      network: NETWORK,
      contractAddress: EXAMPLE_CONTRACT,
      abi: EXAMPLE_ABI,
      abiFunction: "store",
      functionArgs: [{ value: 42 }],
      integrationId: WALLET_ID,
    }),
  ];

  const edges = sequentialEdges(["trigger", "step-write"]);

  console.log("📝 Creating workflow...");
  const workflowId = await client.createWorkflow({
    name: `Store Value — ${new Date().toISOString()}`,
    description: "Example: write to a contract via KeeperHub",
    nodes,
    edges,
  });
  console.log(`✅ Workflow created: ${workflowId}\n`);

  console.log("🚀 Executing workflow...");
  const executionId = await client.executeWorkflow(workflowId);
  console.log(`Execution ID: ${executionId}\n`);

  console.log("⏳ Waiting for onchain confirmation...");
  const result = await client.waitForCompletion(executionId);

  console.log(`\n${result.status === "success" ? "✅" : "❌"} Status: ${result.status}`);

  if (result.txHash) {
    const explorer = NETWORK === "1"
      ? "https://etherscan.io"
      : "https://sepolia.etherscan.io";
    console.log(`🔗 Transaction: ${explorer}/tx/${result.txHash}`);
  }

  console.log(
    `🔗 KeeperHub audit trail: https://app.keeperhub.com/workflows/${workflowId}/executions/${executionId}`
  );
}

main().catch(console.error);