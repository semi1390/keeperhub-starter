// ============================================================
// Example 1: Read Contract
//
// Reads the ETH balance of an address using a simple
// read-contract workflow. A good first test — no signing
// required, just proves your API key works.
//
// Run: npm run example:read
// ============================================================

import * as dotenv from "dotenv";
dotenv.config();

import { KeeperHubClient } from "../client";
import { triggerNode, readContractNode, sequentialEdges } from "../nodes";

const API_KEY = process.env.KEEPERHUB_API_KEY!;
const NETWORK = process.env.NETWORK ?? "11155111";

// A simple contract that returns a value — using WETH balanceOf
const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const WETH = NETWORK === "1" ? WETH_MAINNET : WETH_SEPOLIA;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

async function main() {
  const client = new KeeperHubClient(API_KEY);

  console.log("🔍 KeeperHub Starter — Read Contract Example");
  console.log(`Network: ${NETWORK === "1" ? "Ethereum Mainnet" : "Sepolia Testnet"}\n`);

  // First, list wallet integrations (useful for getting your walletId)
  console.log("📋 Fetching wallet integrations...");
  const integrations = await client.getWalletIntegrations();
  console.log(`Found ${integrations.length} wallet(s):`);
  integrations.forEach((w) => {
    console.log(`  - ${w.name}: ${w.address} (id: ${w.id})`);
  });
  console.log();

  // Build the workflow
  const nodes = [
    triggerNode(),
    readContractNode("step-read", "Read WETH Balance", {
      network: NETWORK,
      contractAddress: WETH,
      abi: ERC20_ABI,
      abiFunction: "balanceOf",
      functionArgs: [{ owner: "0x0000000000000000000000000000000000000000" }],
    }),
  ];

  const edges = sequentialEdges(["trigger", "step-read"]);

  // Create the workflow
  console.log("📝 Creating workflow...");
  const workflowId = await client.createWorkflow({
    name: `Read WETH Balance — ${new Date().toISOString()}`,
    description: "Example: read a contract value via KeeperHub",
    nodes,
    edges,
  });
  console.log(`✅ Workflow created: ${workflowId}\n`);

  // Execute it
  console.log("🚀 Executing workflow...");
  const executionId = await client.executeWorkflow(workflowId);
  console.log(`Execution ID: ${executionId}\n`);

  // Wait for completion
  console.log("⏳ Waiting for completion...");
  const result = await client.waitForCompletion(executionId);

  console.log(`\n✅ Result: ${result.status}`);
  if (result.logs.length > 0) {
    const readLog = result.logs.find((l) => l.nodeId === "step-read");
    if (readLog?.output) {
      console.log("Contract output:", JSON.stringify(readLog.output, null, 2));
    }
  }

  console.log(
    `\n🔗 View on KeeperHub: https://app.keeperhub.com/workflows/${workflowId}/executions/${executionId}`
  );
}

main().catch(console.error);