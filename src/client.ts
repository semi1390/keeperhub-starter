// ============================================================
// KeeperHub Starter — API Client
//
// A minimal, well-documented wrapper around the KeeperHub
// REST API. Covers the full workflow lifecycle:
//   create → execute → poll → get logs → extract tx hash
//
// Based on real-world usage — every field name here was
// verified against the actual API. See SCHEMA.md for the
// full undocumented schema we reverse-engineered.
// ============================================================

import axios, { AxiosInstance } from "axios";

const BASE_URL = "https://app.keeperhub.com/api";

// ---- Types ----

export interface WorkflowNode {
  id: string;
  type: "trigger" | "action";
  data: {
    label: string;
    type: "trigger" | "action";
    config: Record<string, unknown>;
    status: "idle";
    description?: string;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface CreateWorkflowParams {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ExecutionStatus {
  status: "pending" | "running" | "success" | "error" | "cancelled";
  progress?: {
    totalSteps: number;
    completedSteps: number;
    percentage: number;
    currentNodeId?: string;
    currentNodeName?: string;
  };
}

export interface ExecutionLog {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string;
  duration: string;
  network?: string;
  gasUsedWei?: string;
}

// ---- Client ----

export class KeeperHubClient {
  private http: AxiosInstance;

  constructor(apiKey: string) {
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }

  // ---- Workflow Management ----

  /**
   * Create a new workflow.
   * Returns the workflow ID — save this to execute or update later.
   */
  async createWorkflow(params: CreateWorkflowParams): Promise<string> {
    const res = await this.http.post("/workflows/create", params);
    return res.data.id;
  }

  /**
   * Update an existing workflow's nodes and edges.
   * Useful for fixing errors in a workflow before re-executing.
   */
  async updateWorkflow(
    workflowId: string,
    params: Partial<CreateWorkflowParams>
  ): Promise<void> {
    await this.http.put(`/workflows/${workflowId}`, params);
  }

  /**
   * Execute a workflow. Returns the execution ID.
   * Note: the execute endpoint uses /workflow/ (singular), not /workflows/
   */
  async executeWorkflow(workflowId: string): Promise<string> {
    const res = await this.http.post(`/workflow/${workflowId}/execute`, {});
    return res.data.executionId ?? res.data.id;
  }

  // ---- Execution Monitoring ----

  /**
   * Get the current status of an execution.
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatus> {
    const res = await this.http.get(
      `/workflows/executions/${executionId}/status`
    );
    return res.data;
  }

  /**
   * Get detailed logs for each step of an execution.
   * Contains transaction hashes, gas used, and error messages.
   */
  async getExecutionLogs(executionId: string): Promise<ExecutionLog[]> {
    const res = await this.http.get(
      `/workflows/executions/${executionId}/logs`
    );
    return res.data.data ?? res.data ?? [];
  }

  /**
   * Get wallet integrations — needed to get the walletId
   * required for write contract operations.
   */
  async getWalletIntegrations(): Promise<
    Array<{ id: string; name: string; address: string; network: string }>
  > {
    const res = await this.http.get("/integrations");
    return res.data.data ?? res.data ?? [];
  }

  // ---- Polling Helper ----

  /**
   * Poll an execution until it completes or times out.
   * Returns the final status and logs.
   */
  async waitForCompletion(
    executionId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<{ status: string; logs: ExecutionLog[]; txHash?: string }> {
    const { timeoutMs = 300_000, pollIntervalMs = 5_000 } = options;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const status = await this.getExecutionStatus(executionId);

      if (status.status === "success") {
        const logs = await this.getExecutionLogs(executionId);
        const txHash = this.extractTxHash(logs);
        return { status: "success", logs, txHash };
      }

      if (status.status === "error" || status.status === "cancelled") {
        const logs = await this.getExecutionLogs(executionId).catch(() => []);
        return { status: status.status, logs };
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new Error(`Execution ${executionId} timed out after ${timeoutMs}ms`);
  }

  // ---- Helpers ----

  /**
   * Extract a transaction hash from execution logs.
   * KeeperHub returns tx hashes in output.transactionHash or output.transactionLink.
   */
  extractTxHash(logs: ExecutionLog[]): string | undefined {
    for (const log of logs) {
      if (log.output?.transactionHash) {
        return log.output.transactionHash as string;
      }
      if (log.output?.transactionLink) {
        const match = String(log.output.transactionLink).match(
          /0x[a-fA-F0-9]{64}/
        );
        if (match) return match[0];
      }
    }
    return undefined;
  }
}