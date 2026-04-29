// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
contract InferenceGuard is Ownable {

    event ProofSubmitted(bytes32 indexed executionId, bytes32 rootHash, address submitter);
    event ProofConsumed(bytes32 indexed executionId, address consumer);
    event AuthorizedSubmitterSet(address indexed submitter, bool authorized);
    event AuthorizedConsumerSet(address indexed consumer, bool authorized);

    struct Proof {
        bytes32   rootHash;       
        address   submitter;      
        uint256   submittedAt;   
        bool      consumed;   
        bool      exists;      
    }

    mapping(bytes32 => Proof) public proofs;
    mapping(address => bool) public authorizedSubmitters;
    mapping(address => bool) public authorizedConsumers;

    bytes32[] public allExecutionIds;

    constructor() Ownable(msg.sender) {
        authorizedSubmitters[msg.sender] = true;
        authorizedConsumers[msg.sender] = true;
    }

    modifier onlySubmitter() {
        require(
            authorizedSubmitters[msg.sender] || msg.sender == owner(),
            "InferenceGuard: not an authorized submitter"
        );
        _;
    }

    modifier onlyConsumer() {
        require(
            authorizedConsumers[msg.sender] || msg.sender == owner(),
            "InferenceGuard: not an authorized consumer"
        );
        _;
    }

    function setAuthorizedSubmitter(address submitter, bool authorized) external onlyOwner {
        authorizedSubmitters[submitter] = authorized;
        emit AuthorizedSubmitterSet(submitter, authorized);
    }

    function setAuthorizedConsumer(address consumer, bool authorized) external onlyOwner {
        authorizedConsumers[consumer] = authorized;
        emit AuthorizedConsumerSet(consumer, authorized);
    }

    function submitProof(bytes32 executionId, bytes32 rootHash) external onlySubmitter {
        require(!proofs[executionId].exists, "InferenceGuard: executionId already exists");
        require(rootHash != bytes32(0), "InferenceGuard: zero rootHash");

        proofs[executionId] = Proof({
            rootHash:    rootHash,
            submitter:   msg.sender,
            submittedAt: block.timestamp,
            consumed:    false,
            exists:      true
        });

        allExecutionIds.push(executionId);
        emit ProofSubmitted(executionId, rootHash, msg.sender);
    }

    function isProofValid(bytes32 executionId) external view returns (bool) {
        Proof storage p = proofs[executionId];
        return p.exists && !p.consumed;
    }

    function consumeProof(bytes32 executionId) external onlyConsumer {
        require(proofs[executionId].exists, "InferenceGuard: proof does not exist");
        require(!proofs[executionId].consumed, "InferenceGuard: proof already consumed");
        proofs[executionId].consumed = true;
        emit ProofConsumed(executionId, msg.sender);
    }

    function getProof(bytes32 executionId) external view returns (Proof memory) {
        return proofs[executionId];
    }

    function getRootHash(bytes32 executionId) external view returns (bytes32) {
        return proofs[executionId].rootHash;
    }

    function getTotalProofs() external view returns (uint256) {
        return allExecutionIds.length;
    }

    function getRecentProofs(uint256 count) external view returns (bytes32[] memory) {
        uint256 total = allExecutionIds.length;
        uint256 start = total > count ? total - count : 0;
        bytes32[] memory result = new bytes32[](total - start);
        for (uint256 i = start; i < total; i++) {
            result[i - start] = allExecutionIds[i];
        }
        return result;
    }
}
