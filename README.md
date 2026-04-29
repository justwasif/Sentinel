# Sentinel

Sentinel is a multi-agent DeFi position guardian swarm. It continuously monitors cross-protocol lending and liquidity positions, reasons about risk using verifiable AI inference, and executes protective transactions through KeeperHub with guaranteed delivery. Every decision is cryptographically provable. Every execution is auditable by any third party.

The problem it solves is real: on March 12, 2020, $8M in MakerDAO vaults were liquidated at $0 because keeper bots failed to execute fast enough during a gas crisis. The issue was not intelligence — it was guaranteed execution under adversarial conditions. Sentinel addresses this by combining a reasoning swarm with KeeperHub's execution infrastructure.

---

## Deployed Contracts — 0G Galileo Testnet (chainId 16602)

SentinelINFT: 0x1A686bb2b8453A543ECA148bDbdE4155EB56a7B1
PositionRegistry: 0x22D6e5c83b1fE929F6572b84C4dBA63e6607aE2A
InferenceGuard: 0xFc3edaB7F7932c2Ce052F9B516051C60015c5Ba5

Explorer: https://chainscan-galileo.0g.ai

Minted iNFT (token #0): https://chainscan-galileo.0g.ai/address/0x1A686bb2b8453A543ECA148bDbdE4155EB56a7B1

The iNFT's storagePointer field references the encrypted intelligence blob on 0G Storage. The experienceCycles counter increments on-chain after every successful execution, providing a live record of the agent's activity that any judge or user can verify on the explorer.

---

## How the Agents Communicate and Coordinate

Sentinel runs three agents. Each has a distinct role and they communicate through a shared proposal queue and 0G Storage.

The Risk Agent polls Spark and Aave health factors using 0G Compute's verifiedEvaluate() endpoint. Every response is TEE-signed, meaning the output is cryptographically tied to a specific model run inside a secure enclave. When the health factor of a monitored position drops below the registered threshold, the Risk Agent emits a risk proposal with an executionId.

The Yield Agent monitors Uniswap V3 LP positions by reading the current tick from each pool's slot0() function. It is rule-based: if the current tick is outside the registered [tickLower, tickUpper] range, the position is earning zero fees and a rebalance proposal is emitted. This agent does not require AI inference because the decision is arithmetic, not judgment.

The Swarm Coordinator is the orchestrator. It receives proposals from both agents, applies a priority order (Risk before Yield), and routes the approved action to KeeperHub via the MCP server. The Coordinator is minted as an ERC-7857-inspired iNFT on 0G Galileo. Its identity and strategy fingerprint are embedded in the token. Its experienceCycles counter increments after every successful execution. The token can be transferred — whoever holds it inherits the agent with its full execution history.

Agent communication flow:

1. Risk Agent or Yield Agent detects a condition and emits a proposal to the shared queue
2. Coordinator picks up the proposal and sends the reasoning trace to 0G DA as a blob
3. 0G DA returns a rootHash
4. The rootHash is submitted to InferenceGuard via submitProof(executionId, rootHash)
5. Coordinator checks isProofValid(executionId) — if false, execution is blocked
6. Coordinator calls KeeperHub via MCP: keeperhub.create_workflow() and keeperhub.trigger_execution()
7. KeeperHub executes with retry logic, gas optimization, and MEV-protected routing
8. On success, consumeProof() is called on InferenceGuard and incrementExperience() is called on SentinelINFT

No action reaches the chain without a valid 0G DA proof. This is enforced at the contract level, not just by convention.

---

## 0G Protocol Features Used

0G Compute: The Risk Agent calls verifiedEvaluate() for every health factor analysis. Responses are TEE-signed, making each AI decision cryptographically provable. This is the core of what makes Sentinel's reasoning verifiable rather than just logged.

0G Storage: Agent memory is stored as a DAG on 0G Storage. Each execution cycle loads the last N cycles as context, so the agents accumulate learned behavior over time. The Coordinator's intelligence blob and the iNFT metadata are also stored here.

0G DA: Every execution result is written as a blob to 0G DA. The returned rootHash is submitted to the InferenceGuard contract. This means the audit trail is not just stored — it is verifiable by any third party without trusting the Sentinel team.

0G Chain: All three contracts are deployed on 0G Galileo. The InferenceGuard contract gates transaction approval based on 0G DA proof hashes. The SentinelINFT evolves on-chain with each execution.

ERC-7857 iNFT: The Coordinator agent is minted as an iNFT. Its encrypted intelligence is referenced via storagePointer to 0G Storage. The experienceCycles field tracks real execution history on-chain.

---

## KeeperHub Integration

Sentinel uses KeeperHub as its execution layer for all protective transactions.

The Coordinator calls KeeperHub natively via the MCP server using keeperhub.create_workflow() and keeperhub.trigger_execution(). No custom middleware is needed.

Payments are handled autonomously via x402. The agent pays KeeperHub per execution in USDC without any human approval step.

Transaction signing uses KeeperHub's Turnkey-backed non-custodial wallet. Keys never leave the enclave and remote attestation is available. Combined with 0G Compute's TEE inference, both the decision and the signing are hardware-verified.

KeeperHub's exponential backoff retry logic and multi-RPC failover are why Sentinel is meaningfully different from a naive keeper bot. This is exactly the infrastructure that was absent on Black Thursday.

Sentinel also publishes its guard workflows to the KeeperHub marketplace as callable units. Other protocols can call the Spark Liquidation Shield or LP Range Rebalancer via MCP or REST and pay per execution in x402. This turns the guardian into a revenue-generating protocol primitive.

---

## Project Structure

```
sentinel/
  contracts/
    SentinelINFT.sol          ERC-7857-inspired iNFT with experience tracking
    PositionRegistry.sol      Registry of monitored DeFi positions
    InferenceGuard.sol        Proof gatekeeper — enforces no execution without 0G DA proof
    MockUniswapV3Pool.sol     Demo pool with controllable tick for live demonstration
  scripts/
    deploy.js                 Deploys all three core contracts and mints token #0
    deployMockPool.js         Deploys demo pool and registers a position
    demoTrigger.js            Moves pool tick in/out of range during live demo
  agents/
    yieldAgent.js             Yield Agent — monitors Uniswap V3 LP positions
  hardhat.config.js
  deployed-addresses.json     Auto-generated after deploy — contains all contract addresses
```

---

## Setup and Running Locally

Requirements: Node.js 18+, a wallet with 0G Galileo testnet tokens (faucet: https://faucet.0g.ai)

Install dependencies:

```
npm install --save-dev hardhat@2.22.17 @nomicfoundation/hardhat-ethers@3.0.8 ethers@6.13.4 --legacy-peer-deps
npm install @openzeppelin/contracts@5.0.2 dotenv --legacy-peer-deps
```

Create a .env file:

```
PRIVATE_KEY=your_metamask_private_key
RPC_URL=https://evmrpc-testnet.0g.ai
YIELD_POLL_MS=15000
```

Compile contracts:

```
npx hardhat compile
```

Note: viaIR must be enabled in hardhat.config.js due to contract complexity. This is already set in the config.

Deploy core contracts:

```
npx hardhat run scripts/deploy.js --network galileo
```

Deploy demo pool and register position:

```
npx hardhat run scripts/deployMockPool.js --network galileo
```

Run the Yield Agent:

```
node agents/yieldAgent.js
```

Trigger an out-of-range event (run in a second terminal):

```
npx hardhat run scripts/demoTrigger.js --network galileo
```

Reset back to in-range:

```
npx hardhat run scripts/demoTrigger.js --network galileo -- --reset
```
