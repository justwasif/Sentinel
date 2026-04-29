// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PositionRegistry is Ownable {

    event PositionRegistered(address indexed user, bytes32 indexed positionId, string protocol);
    event PositionRemoved(address indexed user, bytes32 indexed positionId);
    event PositionUpdated(address indexed user, bytes32 indexed positionId);

    enum Protocol { SPARK, AAVE, UNISWAP_V3, OTHER }

    struct Position {
        bytes32   id;               
        address   positionAddress;   
        Protocol  protocol;
        uint256   healthThreshold;  
        int24     tickLower;        
        int24     tickUpper;       
        bool      active;
        uint256   registeredAt;
    }

    mapping(address => bytes32[]) private _userPositionIds;
    mapping(bytes32 => Position) public positions;
    mapping(bytes32 => address) public positionOwner;

    constructor() Ownable(msg.sender) {}


    function registerLendingPosition(
        address positionAddress,
        Protocol protocol,
        uint256 healthThreshold
    ) external returns (bytes32 positionId) {
        require(protocol == Protocol.SPARK || protocol == Protocol.AAVE, "PositionRegistry: not a lending protocol");
        require(healthThreshold > 1e18, "PositionRegistry: threshold must be > 1.0");
        require(positionAddress != address(0), "PositionRegistry: zero address");

        positionId = keccak256(abi.encodePacked(msg.sender, protocol, positionAddress));
        require(positions[positionId].registeredAt == 0, "PositionRegistry: already registered");

        positions[positionId] = Position({
            id:               positionId,
            positionAddress:  positionAddress,
            protocol:         protocol,
            healthThreshold:  healthThreshold,
            tickLower:        0,
            tickUpper:        0,
            active:           true,
            registeredAt:     block.timestamp
        });

        positionOwner[positionId] = msg.sender;
        _userPositionIds[msg.sender].push(positionId);

        emit PositionRegistered(msg.sender, positionId, _protocolName(protocol));
    }

    function registerUniswapPosition(
        address poolAddress,
        int24 tickLower,
        int24 tickUpper
    ) external returns (bytes32 positionId) {
        require(poolAddress != address(0), "PositionRegistry: zero address");
        require(tickLower < tickUpper, "PositionRegistry: invalid tick range");

        positionId = keccak256(abi.encodePacked(msg.sender, Protocol.UNISWAP_V3, poolAddress));
        require(positions[positionId].registeredAt == 0, "PositionRegistry: already registered");

        positions[positionId] = Position({
            id:               positionId,
            positionAddress:  poolAddress,
            protocol:         Protocol.UNISWAP_V3,
            healthThreshold:  0,
            tickLower:        tickLower,
            tickUpper:        tickUpper,
            active:           true,
            registeredAt:     block.timestamp
        });

        positionOwner[positionId] = msg.sender;
        _userPositionIds[msg.sender].push(positionId);

        emit PositionRegistered(msg.sender, positionId, "UNISWAP_V3");
    }


    function removePosition(bytes32 positionId) external {
        require(positionOwner[positionId] == msg.sender, "PositionRegistry: not owner");
        positions[positionId].active = false;
        emit PositionRemoved(msg.sender, positionId);
    }

    function updateHealthThreshold(bytes32 positionId, uint256 newThreshold) external {
        require(positionOwner[positionId] == msg.sender, "PositionRegistry: not owner");
        require(newThreshold > 1e18, "PositionRegistry: threshold must be > 1.0");
        positions[positionId].healthThreshold = newThreshold;
        emit PositionUpdated(msg.sender, positionId);
    }

    function getUserPositionIds(address user) external view returns (bytes32[] memory) {
        return _userPositionIds[user];
    }

    function getUserPositions(address user) external view returns (Position[] memory) {
        bytes32[] memory ids = _userPositionIds[user];
        Position[] memory result = new Position[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = positions[ids[i]];
        }
        return result;
    }

    function getActivePositions(address user) external view returns (Position[] memory) {
        bytes32[] memory ids = _userPositionIds[user];
        uint256 count = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (positions[ids[i]].active) count++;
        }
        Position[] memory result = new Position[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (positions[ids[i]].active) {
                result[j++] = positions[ids[i]];
            }
        }
        return result;
    }

    function isPositionActive(bytes32 positionId) external view returns (bool) {
        return positions[positionId].active;
    }

    function _protocolName(Protocol p) internal pure returns (string memory) {
        if (p == Protocol.SPARK) return "SPARK";
        if (p == Protocol.AAVE) return "AAVE";
        if (p == Protocol.UNISWAP_V3) return "UNISWAP_V3";
        return "OTHER";
    }
}
