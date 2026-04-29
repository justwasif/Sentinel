// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUniswapV3Pool
 * @notice Fake Uniswap V3 pool for demo purposes.
 *         Implements the exact same slot0() interface that the real Uniswap V3
 *         pool exposes — so the Yield Agent can't tell the difference.
 *
 *         The owner can call setTick() at any time to simulate price movement.
 *         During the demo:
 *           - Start with tick INSIDE the registered range  → agent sees "IN RANGE ✅"
 *           - Call setTick() to move outside the range     → agent sees "⚠️ OUT OF RANGE"
 */
contract MockUniswapV3Pool is Ownable {

    // ── Events ────────────────────────────────────────────────────────────────
    event TickUpdated(int24 oldTick, int24 newTick, string reason);

    // ── Storage ───────────────────────────────────────────────────────────────
    int24 public currentTick;

    // Human-readable labels for demo narrative
    string public token0Symbol;
    string public token1Symbol;
    uint24 public fee; // e.g. 3000 = 0.3%

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(
        int24 initialTick,
        string memory _token0Symbol,
        string memory _token1Symbol,
        uint24 _fee
    ) Ownable(msg.sender) {
        currentTick      = initialTick;
        token0Symbol     = _token0Symbol;
        token1Symbol     = _token1Symbol;
        fee              = _fee;
    }

    // ── The critical function — matches real Uniswap V3 pool interface ────────

    /**
     * @notice Mirrors the exact return signature of the real Uniswap V3 slot0().
     *         The Yield Agent calls this — it cannot tell this is a mock.
     */
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24   tick,
        uint16  observationIndex,
        uint16  observationCardinality,
        uint16  observationCardinalityNext,
        uint8   feeProtocol,
        bool    unlocked
    ) {
        // sqrtPriceX96 — we return a plausible non-zero value
        // Real formula: sqrt(price) * 2^96, but for mock we just need non-zero
        sqrtPriceX96            = 1 << 96; // 2^96, roughly represents price = 1
        tick                    = currentTick;
        observationIndex        = 0;
        observationCardinality  = 1;
        observationCardinalityNext = 1;
        feeProtocol             = 0;
        unlocked                = true;
    }

    // ── Demo controls ─────────────────────────────────────────────────────────

    /**
     * @notice Move the tick to simulate price movement.
     *         Call this during the demo to trigger the Yield Agent.
     * @param newTick   The tick to set
     * @param reason    Human-readable reason shown in event log (e.g. "ETH crashed to $1800")
     */
    function setTick(int24 newTick, string calldata reason) external onlyOwner {
        int24 old = currentTick;
        currentTick = newTick;
        emit TickUpdated(old, newTick, reason);
    }

    /**
     * @notice Convenience: move tick INTO a range (pass any value between tickLower and tickUpper)
     */
    function moveInRange(int24 tick) external onlyOwner {
        int24 old = currentTick;
        currentTick = tick;
        emit TickUpdated(old, tick, "Manually moved IN range");
    }

    /**
     * @notice Convenience: move tick OUT of range (pass a value outside tickLower/tickUpper)
     */
    function moveOutOfRange(int24 tick) external onlyOwner {
        int24 old = currentTick;
        currentTick = tick;
        emit TickUpdated(old, tick, "Manually moved OUT of range - rebalance needed!");
    }

    // ── Views ─────────────────────────────────────────────────────────────────
    function getCurrentTick() external view returns (int24) {
        return currentTick;
    }

    function getPoolInfo() external view returns (
        string memory t0,
        string memory t1,
        uint24 poolFee,
        int24 tick
    ) {
        return (token0Symbol, token1Symbol, fee, currentTick);
    }
}
