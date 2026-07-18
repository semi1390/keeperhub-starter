// ============================================================
// Example 3: ERC20 Approve + Transfer
//
// A multi-step workflow: approve a token, then transfer it.
// Shows how to chain multiple steps with sequential edges.
//
// Run: npm run example:erc20
// ============================================================

import * as dotenv from "dotenv";
dotenv.config();

import { KeeperHubClient } from "../client";
import { triggerNode, approveTokenNode, writeContractNode, sequentialEdges } from "../nodes";

const API_KEY = process.env.KEEPERHUB_API_KEY!;
const NETWORK = process.env.NETWORK ?? "11155111";
const WALLET_ID = process.env.WALLET_INTEGRATION_ID!;

// USDC on Sepolia
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const RECIPIENT = "0x0000000000000000000000000000000000000001"; // replace with real address

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

async function main() {
  if (!WALLET_ID) {
    console.error("❌ WALLET_INTEGRATION_ID not set in .env");
    process.exit(1);
  }

  const client = new KeeperHubClient(API_KEY);

  console.log("💸 KeeperHub Starter — ERC20 Multi-Step Example\n");

  // 1 USDC = 1_000_000 (6 decimals)
  const AMOUNT = "1000000";

  const nodes = [
    triggerNode(),
    approveTokenNode("step-approve", "Approve USDC", {
      network: NETWORK,
      tokenAddress: USDC_SEPOLIA,
      tokenSymbol: "USDC",
      spenderAddress: RECIPIENT,
      integrationId: WALLET_ID,
      amount: AMOUNT,
    }),
    writeContractNode("step-transfer", "Transfer USDC", {
      network: NETWORK,
      contractAddress: USDC_SEPOLIA,
      abi: ERC20_ABI,
      abiFunction: "transfer",
      functionArgs: [{ to: RECIPIENT, amount: AMOUNT }],
      integrationId: WALLET_ID,
    }),
  ];

  const edges = sequentialEdges(["trigger", "step-approve", "step-transfer"]);

  console.log("📝 Creating 2-step workflow (approve → transfer)...");
  const workflowId = await client.createWorkflow({
    name: `ERC20 Transfer — ${new Date().toISOString()}`,
    description: "Approve and transfer USDC via KeeperHub",
    nodes,
    edges,
  });
  console.log(`✅ Workflow: ${workflowId}\n`);

  console.log("🚀 Executing...");
  const executionId = await client.executeWorkflow(workflowId);

  const result = await client.waitForCompletion(executionId);

  console.log(`\n${result.status === "success" ? "✅" : "❌"} ${result.status}`);
  if (result.txHash) {
    console.log(`🔗 https://sepolia.etherscan.io/tx/${result.txHash}`);
  }
}

main().catch(console.error);