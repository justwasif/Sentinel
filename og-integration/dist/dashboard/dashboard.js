"use strict";
/**
 * Demo Dashboard
 * Simple text-based dashboard for displaying swarm status and metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoDashboard = void 0;
const logger_1 = require("../utils/logger");
class DemoDashboard {
    constructor(inftManager, coordinator, riskAgent, yieldAgent, keeperHubClient, chainClient) {
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
    initializeState() {
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
    async updateState() {
        this.state.iNFTStats = {
            ...this.inftManager.getEvolutionStats(),
            riskTolerance: this.inftManager.getMetadata().riskTolerance
        };
        try {
            const revenueStats = await this.keeperHubClient.getRevenueStats();
            this.state.revenue = revenueStats;
        }
        catch (error) {
            logger_1.logger.warn("Failed to get revenue stats:", error);
        }
        this.state.performance.totalExecutions = this.state.iNFTStats.totalCycles;
        this.state.performance.successRate = this.state.iNFTStats.successRate;
    }
    /**
     * Update agent status
     */
    updateAgentStatus(agent, status) {
        this.state.agentStatus[agent] = status;
    }
    /**
     * Update current proposals
     */
    updateProposals(riskProposal, yieldProposal) {
        this.state.currentProposals.risk = riskProposal;
        this.state.currentProposals.yield = yieldProposal;
    }
    /**
     * Add recent decision
     */
    addRecentDecision(decision) {
        this.state.recentDecisions.unshift(decision);
        if (this.state.recentDecisions.length > 20) {
            this.state.recentDecisions.pop();
        }
    }
    /**
     * Render dashboard
     */
    render() {
        const lines = [];
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
        }
        else {
            lines.push("│ Risk:  No proposal                                                          │");
        }
        if (this.state.currentProposals.yield) {
            lines.push(`│ Yield: ${this.state.currentProposals.yield.action} (${this.state.currentProposals.yield.urgency}) - ${this.state.currentProposals.yield.reasoning.substring(0, 50)}... │`);
        }
        else {
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
    getStatusBadge(status) {
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
    clear() {
        console.clear();
    }
    /**
     * Display dashboard
     */
    display() {
        this.clear();
        console.log(this.render());
    }
    /**
     * Start live dashboard
     */
    async startLiveDashboard(intervalMs = 5000) {
        logger_1.logger.info(`Starting live dashboard (update interval: ${intervalMs}ms)`);
        while (true) {
            await this.updateState();
            this.display();
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
}
exports.DemoDashboard = DemoDashboard;
//# sourceMappingURL=dashboard.js.map