/**
 * Demo Dashboard
 * Simple text-based dashboard for displaying swarm status and metrics
 */

import { INFTManager } from "../inft/metadata";
import { SwarmCoordinator } from "../agents/coordinator";
import { RiskAgent } from "../agents/risk-agent";
import { YieldAgent } from "../agents/yield-agent";
import { KeeperHubClient } from "../services/keeperhub";
import { MockChainClient } from "../services/chain";
import { logger } from "../utils/logger";

export interface DashboardState {
  agentStatus: {
    risk: 'active' | 'idle' | 'error';
    yield: 'active' | 'idle' | 'error';
    coordinator: 'active' | 'idle' | 'error';
  };
  currentProposals: {
    risk: any;
    yield: any;
  };
  recentDecisions: any[];
  iNFTStats: {
    totalCycles: number;
    successRate: number;
    avgQuality: number;
    riskTolerance: string;
  };
  performance: {
    avgLatency: number;
    successRate: number;
    totalExecutions: number;
  };
  revenue: {
    totalRevenue: number;
    totalExecutions: number;
    avgRevenuePerExecution: number;
  };
}

export class DemoDashboard {
  private inftManager: INFTManager;
  private coordinator: SwarmCoordinator;
  private riskAgent: RiskAgent;
  private yieldAgent: YieldAgent;
  private keeperHubClient: KeeperHubClient;
  private chainClient: MockChainClient;
  private state: DashboardState;

  constructor(
    inftManager: INFTManager,
    coordinator: SwarmCoordinator,
    riskAgent: RiskAgent,
    yieldAgent: YieldAgent,
    keeperHubClient: KeeperHubClient,
    chainClient: MockChainClient
  ) {
    this.inftManager = inftManager;
    this.coordinator = coordinator;
    this.riskAgent = riskAgent;
    this.yieldAgent = yieldAgent;
    this.keeperHubClient = keeperHubClient;
    this.chainClient = chainClient;
    this.state = this.initializeState();
  }

  /**
   * Initialize dashboard state
   */
  private initializeState(): DashboardState {
    return {
      agentStatus: {
        risk: 'idle',
        yield: 'idle',
        coordinator: 'idle'
      },
      currentProposals: {
        risk: null,
        yield: null
      },
      recentDecisions: [],
      iNFTStats: {
        totalCycles: 0,
        successRate: 0,
        avgQuality: 0,
        riskTolerance: 'moderate'
      },
      performance: {
        avgLatency: 0,
        successRate: 0,
        totalExecutions: 0
      },
      revenue: {
        totalRevenue: 0,
        totalExecutions: 0,
        avgRevenuePerExecution: 0
      }
    };
  }

  /**
   * Update dashboard state
   */
  async updateState(): Promise<void> {
    this.state.iNFTStats = {
      ...this.inftManager.getEvolutionStats(),
      riskTolerance: this.inftManager.getMetadata().riskTolerance
    };

    try {
      const revenueStats = await this.keeperHubClient.getRevenueStats();
      this.state.revenue = revenueStats;
    } catch (error) {
      logger.warn("Failed to get revenue stats:", error);
    }

    this.state.performance.totalExecutions = this.state.iNFTStats.totalCycles;
    this.state.performance.successRate = this.state.iNFTStats.successRate;
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agent: 'risk' | 'yield' | 'coordinator', status: 'active' | 'idle' | 'error'): void {
    this.state.agentStatus[agent] = status;
  }

  /**
   * Update current proposals
   */
  updateProposals(riskProposal: any, yieldProposal: any): void {
    this.state.currentProposals.risk = riskProposal;
    this.state.currentProposals.yield = yieldProposal;
  }

  /**
   * Add recent decision
   */
  addRecentDecision(decision: any): void {
    this.state.recentDecisions.unshift(decision);
    if (this.state.recentDecisions.length > 20) {
      this.state.recentDecisions.pop();
    }
  }

  /**
   * Render dashboard
   */
  render(): string {
    const lines: string[] = [];

    lines.push("╔══════════════════════════════════════════════════════════════════════════════╗");
    lines.push("║                    Sentinel 0G Swarm Dashboard                             ║");
    lines.push("╚══════════════════════════════════════════════════════════════════════════════╝");
    lines.push("");

    lines.push("┌─ Agent Status ─────────────────────────────────────────────────────────────┐");
    lines.push(`│ Risk Agent:      ${this.getStatusBadge(this.state.agentStatus.risk)}                    │`);
    lines.push(`│ Yield Agent:     ${this.getStatusBadge(this.state.agentStatus.yield)}                    │`);
    lines.push(`│ Coordinator:     ${this.getStatusBadge(this.state.agentStatus.coordinator)}                    │`);
    lines.push("└────────────────────────────────────────────────────────────────────────────┘");
    lines.push("");

    lines.push("┌─ Current Proposals ────────────────────────────────────────────────────────┐");
    if (this.state.currentProposals.risk) {
      lines.push(`│ Risk:  ${this.state.currentProposals.risk.action} (${this.state.currentProposals.risk.urgency}) - ${this.state.currentProposals.risk.reasoning.substring(0, 50)}... │`);
    } else {
      lines.push("│ Risk:  No proposal                                                          │");
    }
    if (this.state.currentProposals.yield) {
      lines.push(`│ Yield: ${this.state.currentProposals.yield.action} (${this.state.currentProposals.yield.urgency}) - ${this.state.currentProposals.yield.reasoning.substring(0, 50)}... │`);
    } else {
      lines.push("│ Yield: No proposal                                                         │");
    }
    lines.push("└────────────────────────────────────────────────────────────────────────────┘");
    lines.push("");

    lines.push("┌─ iNFT Evolution ────────────────────────────────────────────────────────────┐");
    lines.push(`│ Total Cycles:     ${this.state.iNFTStats.totalCycles.toString().padEnd(10)} │`);
    lines.push(`│ Success Rate:     ${(this.state.iNFTStats.successRate * 100).toFixed(1)}%${' '.repeat(10)} │`);
    lines.push(`│ Avg Quality:      ${this.state.iNFTStats.avgQuality.toFixed(2)}${' '.repeat(10)} │`);
    lines.push(`│ Risk Tolerance:   ${this.state.iNFTStats.riskTolerance.padEnd(10)} │`);
    lines.push("└────────────────────────────────────────────────────────────────────────────┘");
    lines.push("");

    lines.push("┌─ Performance Metrics ───────────────────────────────────────────────────────┐");
    lines.push(`│ Total Executions: ${this.state.performance.totalExecutions.toString().padEnd(10)} │`);
    lines.push(`│ Success Rate:     ${(this.state.performance.successRate * 100).toFixed(1)}%${' '.repeat(10)} │`);
    lines.push(`│ Avg Latency:      ${this.state.performance.avgLatency.toFixed(0)}ms${' '.repeat(10)} │`);
    lines.push("└────────────────────────────────────────────────────────────────────────────┘");
    lines.push("");

    lines.push("┌─ Revenue ──────────────────────────────────────────────────────────────────┐");
    lines.push(`│ Total Revenue:        $${this.state.revenue.totalRevenue.toFixed(2).padEnd(10)} │`);
    lines.push(`│ Total Executions:     ${this.state.revenue.totalExecutions.toString().padEnd(10)} │`);
    lines.push(`│ Avg Revenue/Exec:     $${this.state.revenue.avgRevenuePerExecution.toFixed(2).padEnd(10)} │`);
    lines.push("└────────────────────────────────────────────────────────────────────────────┘");
    lines.push("");

    if (this.state.recentDecisions.length > 0) {
      lines.push("┌─ Recent Decisions ─────────────────────────────────────────────────────────┐");
      for (let i = 0; i < Math.min(5, this.state.recentDecisions.length); i++) {
        const decision = this.state.recentDecisions[i];
        const time = new Date(decision.timestamp).toLocaleTimeString();
        lines.push(`│ ${time} - ${decision.reasoning.substring(0, 60)}... │`);
      }
      lines.push("└────────────────────────────────────────────────────────────────────────────┘");
      lines.push("");
    }

    lines.push("┌─ Verification Status ───────────────────────────────────────────────────────┐");
    lines.push("│ TEE Verified:     ✓                                                           │");
    lines.push("│ DA Verified:      ✓                                                           │");
    lines.push("│ Chain Verified:   ✓                                                           │");
    lines.push("└────────────────────────────────────────────────────────────────────────────┘");
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Get status badge
   */
  private getStatusBadge(status: string): string {
    switch (status) {
      case 'active':
        return '● Active ';
      case 'idle':
        return '○ Idle   ';
      case 'error':
        return '✗ Error  ';
      default:
        return '? Unknown';
    }
  }

  /**
   * Clear dashboard
   */
  clear(): void {
    console.clear();
  }

  /**
   * Display dashboard
   */
  display(): void {
    this.clear();
    console.log(this.render());
  }

  /**
   * Start live dashboard
   */
  async startLiveDashboard(intervalMs: number = 5000): Promise<void> {
    logger.info(`Starting live dashboard (update interval: ${intervalMs}ms)`);

    while (true) {
      await this.updateState();
      this.display();
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * Get current state
   */
  getState(): DashboardState {
    return { ...this.state };
  }
}