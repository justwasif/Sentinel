// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Test USDC token for 0G Galileo testnet.
 *         6 decimals to match real USDC.
 *         Anyone can mint up to FAUCET_LIMIT per call via faucet().
 *         Owner can mint unlimited via mint().
 *
 * Deploy: npx hardhat run scripts/deployUSDC.js --network galileo
 */
contract MockUSDC is ERC20, Ownable {

    uint8  private constant DECIMALS       = 6;
    uint256 public  constant FAUCET_LIMIT  = 10_000 * 10**6;   // 10,000 USDC
    uint256 public  constant FAUCET_COOLDOWN = 24 hours;

    mapping(address => uint256) public lastFaucetAt;

    event Faucet(address indexed to, uint256 amount);
    event Mint(address indexed to, uint256 amount);

    constructor() ERC20("USD Coin (Mock)", "USDC") Ownable(msg.sender) {
        // Pre-mint 1,000,000 USDC to deployer for KeeperHub payments + testing
        _mint(msg.sender, 1_000_000 * 10**DECIMALS);
    }

    // ── Public faucet ────────────────────────────────────────────────────────

    /**
     * @notice Mint FAUCET_LIMIT USDC to caller. Enforces 24h cooldown.
     */
    function faucet() external {
        require(
            block.timestamp >= lastFaucetAt[msg.sender] + FAUCET_COOLDOWN,
            "MockUSDC: faucet cooldown active"
        );
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_LIMIT);
        emit Faucet(msg.sender, FAUCET_LIMIT);
    }

    /**
     * @notice Check seconds until caller can use faucet again (0 = ready).
     */
    function faucetCooldownRemaining(address user) external view returns (uint256) {
        uint256 nextAt = lastFaucetAt[user] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextAt) return 0;
        return nextAt - block.timestamp;
    }

    // ── Owner mint ───────────────────────────────────────────────────────────

    /**
     * @notice Mint arbitrary amount to any address. Owner only.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit Mint(to, amount);
    }

    // ── ERC20 overrides ──────────────────────────────────────────────────────

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}