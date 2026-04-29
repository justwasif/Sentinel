// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SentinelINFT is ERC721, Ownable {

    event ExperienceIncremented(uint256 indexed tokenId, uint256 newCycles);
    event IntelligenceUpdated(uint256 indexed tokenId, string storagePointer);
    event AuthorizedCallerSet(address indexed caller, bool authorized);
    event TokenMinted(uint256 indexed tokenId, address indexed to);

    struct AgentMetadata {
        uint256 experienceCycles;
        uint256 mintedAt;
        uint256 lastActiveAt;
        string  storagePointer;     
        string  strategyFingerprint; 
        bool    active;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => AgentMetadata) public agentData;
    mapping(address => bool) public authorizedCallers;

    constructor() ERC721("SentinelINFT", "SINFT") Ownable(msg.sender) {
        authorizedCallers[msg.sender] = true;
    }

    modifier onlyAuthorized() {
        require(
            authorizedCallers[msg.sender] || msg.sender == owner(),
            "SentinelINFT: caller not authorized"
        );
        _;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerSet(caller, authorized);
    }

    function mint(
        address to,
        string calldata storagePointer,
        string calldata strategyFP
    ) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        agentData[tokenId] = AgentMetadata({
            experienceCycles:    0,
            mintedAt:            block.timestamp,
            lastActiveAt:        block.timestamp,
            storagePointer:      storagePointer,
            strategyFingerprint: strategyFP,
            active:              true
        });
        _safeMint(to, tokenId);
        emit TokenMinted(tokenId, to);
    }

    function incrementExperience(uint256 tokenId) external onlyAuthorized {
        require(_ownerOf(tokenId) != address(0), "SentinelINFT: nonexistent token");
        AgentMetadata storage meta = agentData[tokenId];
        meta.experienceCycles += 1;
        meta.lastActiveAt = block.timestamp;
        emit ExperienceIncremented(tokenId, meta.experienceCycles);
    }

    function updateIntelligence(
        uint256 tokenId,
        string calldata newStoragePointer
    ) external onlyAuthorized {
        require(_ownerOf(tokenId) != address(0), "SentinelINFT: nonexistent token");
        agentData[tokenId].storagePointer = newStoragePointer;
        emit IntelligenceUpdated(tokenId, newStoragePointer);
    }

    function setActive(uint256 tokenId, bool active) external onlyAuthorized {
        require(_ownerOf(tokenId) != address(0), "SentinelINFT: nonexistent token");
        agentData[tokenId].active = active;
    }


    function getExperienceCycles(uint256 tokenId) external view returns (uint256) {
        return agentData[tokenId].experienceCycles;
    }

    function getStoragePointer(uint256 tokenId) external view returns (string memory) {
        return agentData[tokenId].storagePointer;
    }

    function getFullMetadata(uint256 tokenId) external view returns (AgentMetadata memory) {
        return agentData[tokenId];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "SentinelINFT: nonexistent token");
        AgentMetadata memory meta = agentData[tokenId];
        return string(abi.encodePacked(
            "data:application/json;utf8,",
            '{"name":"Sentinel Guardian #', _toString(tokenId), '",',
            '"description":"Sentinel iNFT - Autonomous DeFi Position Guardian powered by 0G + KeeperHub",',
            '"attributes":[',
                '{"trait_type":"Experience Cycles","value":', _toString(meta.experienceCycles), '},',
                '{"trait_type":"Strategy","value":"', meta.strategyFingerprint, '"},',
                '{"trait_type":"Active","value":"', meta.active ? "true" : "false", '"},',
                '{"trait_type":"Storage Pointer","value":"', meta.storagePointer, '"}',
            ']}'
        ));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
