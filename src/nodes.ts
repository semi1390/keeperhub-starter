// ============================================================
// KeeperHub Starter — Node Builders
//
// Helper functions for building workflow nodes.
// Every field name here was verified against the real API.
//
// The schema KeeperHub expects is NOT fully documented.
// These builders encode what actually works.
// ============================================================

import { WorkflowNode } from "./client";

/**
 * Manual trigger node — required as the first node in every workflow.
 * KeeperHub also supports scheduled and webhook triggers (coming soon).
 */
export function triggerNode(id = "trigger"): WorkflowNode {
  return {
    id,
    type: "trigger",
    data: {
      label: "Manual Trigger",
      type: "trigger",
      config: { triggerType: "manual" },
      status: "idle",
    },
  };
}

/**
 * Write contract node — calls any contract function.
 *
 * CRITICAL SCHEMA NOTES (learned the hard way):
 * - `abi` must be a JSON STRING (JSON.stringify the array), not the array itself
 * - `functionArgs` must be a JSON STRING of an array of objects with named fields
 *   e.g. JSON.stringify([{ tokenId: 123, liquidity: "456", deadline: 9999999 }])
 * - Numeric values that might overflow JS numbers should be strings
 * - Do NOT use template expressions like {{@__system:timestamp}} — they break JSON parsing
 *   Use a pre-computed Unix timestamp instead (Math.floor(Date.now() / 1000) + 600)
 * - `network` is the chain ID as a STRING: "11155111" for Sepolia, "1" for mainnet
 * - `integrationId` is your KeeperHub wallet ID (from getWalletIntegrations())
 */
export function writeContractNode(
  id: string,
  label: string,
  options: {
    network: string;
    contractAddress: string;
    abi: object[];
    abiFunction: string;
    functionArgs: object[];
    integrationId: string;
    gasLimitMultiplier?: string;
  }
): WorkflowNode {
  return {
    id,
    type: "action",
    data: {
      label,
      type: "action",
      config: {
        actionType: "web3/write-contract",
        network: options.network,
        contractAddress: options.contractAddress,
        abi: JSON.stringify(options.abi),           // MUST be stringified
        abiFunction: options.abiFunction,
        functionArgs: JSON.stringify(options.functionArgs), // MUST be stringified array
        integrationId: options.integrationId,
        gasLimitMultiplier: options.gasLimitMultiplier ?? "1.5",
      },
      status: "idle",
    },
  };
}

/**
 * Read contract node — calls a view/pure function.
 * Does not require an integrationId (no signing needed).
 * Result is available to subsequent nodes via templating.
 */
export function readContractNode(
  id: string,
  label: string,
  options: {
    network: string;
    contractAddress: string;
    abi: object[];
    abiFunction: string;
    functionArgs?: object[];
  }
): WorkflowNode {
  return {
    id,
    type: "action",
    data: {
      label,
      type: "action",
      config: {
        actionType: "web3/read-contract",
        network: options.network,
        contractAddress: options.contractAddress,
        abi: JSON.stringify(options.abi),
        abiFunction: options.abiFunction,
        functionArgs: JSON.stringify(options.functionArgs ?? [{}]),
      },
      status: "idle",
    },
  };
}

/**
 * Approve ERC20 token node — approve a spender to use your tokens.
 *
 * SCHEMA NOTES:
 * - `tokenConfig` must be a JSON STRING with mode and customToken
 * - `amount` can be "max" or a specific amount string
 * - `spenderAddress` is the contract being approved
 */
export function approveTokenNode(
  id: string,
  label: string,
  options: {
    network: string;
    tokenAddress: string;
    tokenSymbol: string;
    spenderAddress: string;
    integrationId: string;
    amount?: string;
  }
): WorkflowNode {
  return {
    id,
    type: "action",
    data: {
      label,
      type: "action",
      config: {
        actionType: "web3/approve-token",
        network: options.network,
        tokenConfig: JSON.stringify({        // MUST be stringified
          mode: "custom",
          customToken: {
            address: options.tokenAddress,
            symbol: options.tokenSymbol,
          },
        }),
        spenderAddress: options.spenderAddress,
        integrationId: options.integrationId,
        amount: options.amount ?? "max",
      },
      status: "idle",
    },
  };
}

/**
 * Build edges connecting nodes in sequence.
 * Pass node IDs in order: ["trigger", "step1", "step2", ...]
 */
export function sequentialEdges(nodeIds: string[]) {
  return nodeIds.slice(0, -1).map((id, i) => ({
    id: `e${i + 1}`,
    source: id,
    target: nodeIds[i + 1],
  }));
}