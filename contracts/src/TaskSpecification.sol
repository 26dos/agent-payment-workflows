// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./DualDIDRegistry.sol";
import "./ReputationScore.sol";

/**
 * @title TaskSpecification
 * @dev Manages detailed task specifications for AI Agent task publishing
 * 
 * This contract implements the "AI Agent 任务发布信息登记表" requirements:
 * - Basic task identification
 * - Time constraints
 * - Output format requirements
 * - Content validation requirements
 * - Execution constraints and proof requirements
 * 
 * All specifications are stored on-chain as arbitration evidence.
 * Detailed content can be stored via IPFS hash in the metadata field.
 */
contract TaskSpecification is Ownable {
    // ============ Enums ============
    
    enum TaskType {
        DataCrawling,       // 数据爬取
        ModelInference,     // 模型推理
        DataProcessing,     // 数据处理
        ContentGeneration,  // 内容生成
        CodeExecution,      // 代码执行
        APIIntegration,     // API集成
        Custom              // 自定义
    }
    
    enum ProofType {
        None,           // 无需证明
        TEEAttestation, // TEE 证明
        LogHash,        // 日志哈希
        Snapshot,       // 快照
        APIVerification // API 验真
    }
    
    enum ToolRestriction {
        Allowed,        // 允许第三方工具
        Forbidden,      // 禁止第三方工具
        Specified       // 指定工具
    }
    
    enum ResultReuse {
        Forbidden,      // 禁止复用
        AllowHistorical // 允许历史结果
    }
    
    // ============ Structs ============
    
    /**
     * @dev Time constraints for task execution
     * 任务执行时间约束
     */
    struct TimeConstraints {
        uint256 acceptanceDeadline;     // 接单截止时间
        uint256 completionDeadline;     // 任务完成截止时间
        uint256 gracePeriod;            // 结果补传宽限期 (seconds)
        bool requiresIntermediateResult;// 是否需要中间结果提交
        uint256 intermediateDeadline;   // 中间结果提交截止时间 (0 if not required)
    }
    
    /**
     * @dev Output format requirements
     * 结果输出格式硬性要求
     */
    struct OutputFormat {
        string fileType;            // 约定输出文件类型 (e.g., "json", "csv", "txt")
        uint256 minBytes;           // 输出文件最小字节数
        uint256 maxBytes;           // 输出文件最大字节数
        string formatFeatures;      // 必选格式特征 (e.g., "JSON key-value pairs")
        bool requiresResultHash;    // 是否需要结果哈希提交
        bool requiresFormatProbe;   // 是否需要格式探针提交
        uint8 probeType;            // 0: first 32 bytes, 1: 3 sample hashes
    }
    
    /**
     * @dev Content validation requirements
     * 结果内容核心校验要求
     */
    struct ContentValidation {
        string requiredKeywords;    // 结果必含关键字列表 (comma-separated)
        string requiredFields;      // 结构化结果必含字段 (comma-separated)
        uint256 minResultCount;     // 结果数量要求 - 最小
        uint256 maxResultCount;     // 结果数量要求 - 最大
        string languageRequirement; // 结果语言要求 (e.g., "zh-CN", "en-US")
        uint256 minContentLength;   // 内容规模要求 - 最小字数
        uint256 maxContentLength;   // 内容规模要求 - 最大字数
    }
    
    /**
     * @dev Execution constraints and proof requirements
     * 执行约束与证明要求
     */
    struct ExecutionConstraints {
        ToolRestriction toolRestriction;    // 第三方工具使用限制
        string specifiedTools;              // 指定工具列表 (if toolRestriction == Specified)
        string dataSourceConstraints;       // 数据源/域名约束
        ProofType proofType;                // 执行证明提交要求
        string externalVerificationAPI;     // 结果外部验真方式 (API path)
        string privacyConstraints;          // 数据隐私约束
        ResultReuse resultReuse;            // 结果复用限制
        string customConstraints;           // 其他自定义硬约束
    }
    
    /**
     * @dev Provider admission criteria
     * 接收方 Agent 准入条件
     */
    struct ProviderCriteria {
        uint256 minReputationScore;     // 最低信誉分要求 (with 2 decimals, e.g., 6000 = 60.00)
        uint256 minCompletedTasks;      // 最少完成任务数
        bool requiresKYC;               // 是否要求 KYC
        uint8 minKYCLevel;              // 最低 KYC 等级 (0-4)
    }
    
    /**
     * @dev Complete task specification
     * 完整任务规范
     */
    struct Specification {
        // Basic info
        bytes32 taskId;                     // 任务唯一 ID (linked to ClawPayEscrow)
        bytes32 requesterDID;               // 发布方 Agent DID
        TaskType taskType;                  // 任务类型
        uint256 createdAt;                  // 任务创建时间戳
        
        // Detailed specifications
        TimeConstraints timeConstraints;
        OutputFormat outputFormat;
        ContentValidation contentValidation;
        ExecutionConstraints executionConstraints;
        ProviderCriteria providerCriteria;
        
        // Metadata
        string metadataIPFS;                // IPFS hash for detailed description
        bool active;                        // Is specification active
    }
    
    /**
     * @dev Task result submission
     * 任务结果提交
     */
    struct TaskResult {
        bytes32 taskId;
        bytes32 providerDID;
        bytes32 resultHash;             // 结果哈希
        bytes32 formatProbeHash;        // 格式探针哈希
        bytes32 executionProofHash;     // 执行证明哈希
        string resultIPFS;              // 结果 IPFS hash
        uint256 submittedAt;
        bool verified;
        bool disputed;
    }
    
    // ============ State Variables ============

    DualDIDRegistry public dualDIDRegistry;
    ReputationScore public reputationScore;
    
    // Task ID => Specification
    mapping(bytes32 => Specification) public specifications;
    
    // Task ID => Result
    mapping(bytes32 => TaskResult) public results;
    
    // Task ID => Intermediate results (multiple allowed)
    mapping(bytes32 => bytes32[]) public intermediateResults;
    
    // Authorized contracts (ClawPayEscrow)
    mapping(address => bool) public authorizedContracts;
    
    // ============ Events ============
    
    event SpecificationCreated(
        bytes32 indexed taskId,
        bytes32 indexed requesterDID,
        TaskType taskType,
        uint256 acceptanceDeadline,
        uint256 completionDeadline
    );
    
    event SpecificationUpdated(bytes32 indexed taskId);
    
    event ResultSubmitted(
        bytes32 indexed taskId,
        bytes32 indexed providerDID,
        bytes32 resultHash,
        string resultIPFS
    );
    
    event IntermediateResultSubmitted(
        bytes32 indexed taskId,
        bytes32 indexed providerDID,
        bytes32 resultHash,
        uint256 submittedAt
    );
    
    event ResultVerified(bytes32 indexed taskId, bool passed);
    
    event ResultDisputed(bytes32 indexed taskId, string reason);
    
    // ============ Modifiers ============
    
    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender] || msg.sender == owner(), "TaskSpecification: not authorized");
        _;
    }
    
    modifier specificationExists(bytes32 taskId) {
        require(specifications[taskId].active, "TaskSpecification: spec not found");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _dualDIDRegistry, address _reputationScore) Ownable(msg.sender) {
        dualDIDRegistry = DualDIDRegistry(_dualDIDRegistry);
        reputationScore = ReputationScore(_reputationScore);
    }
    
    // ============ Admin Functions ============
    
    function setAuthorizedContract(address _contract, bool authorized) external onlyOwner {
        authorizedContracts[_contract] = authorized;
    }
    
    function setContracts(address _dualDIDRegistry, address _reputationScore) external onlyOwner {
        dualDIDRegistry = DualDIDRegistry(_dualDIDRegistry);
        reputationScore = ReputationScore(_reputationScore);
    }
    
    // ============ Specification Creation ============
    
    /**
     * @dev Create a task specification
     * @param taskId Unique task ID (from ClawPayEscrow)
     * @param requesterDID Requester's Agent DID
     * @param taskType Type of task
     * @param timeConstraints Time-related constraints
     * @param outputFormat Output format requirements
     * @param contentValidation Content validation rules
     * @param executionConstraints Execution constraints
     * @param providerCriteria Provider admission criteria
     * @param metadataIPFS IPFS hash for detailed description
     */
    function createSpecification(
        bytes32 taskId,
        bytes32 requesterDID,
        TaskType taskType,
        TimeConstraints calldata timeConstraints,
        OutputFormat calldata outputFormat,
        ContentValidation calldata contentValidation,
        ExecutionConstraints calldata executionConstraints,
        ProviderCriteria calldata providerCriteria,
        string calldata metadataIPFS
    ) external returns (bool) {
        // Validate requester DID
        DualDIDRegistry.SubDID memory requester = dualDIDRegistry.getSubDID(requesterDID);
        require(requester.active, "TaskSpecification: requester not active");
        
        // Verify sender is the requester's owner
        DualDIDRegistry.OnChainDID memory onChainDID = dualDIDRegistry.getOnChainDID(requester.parentOnChainDID);
        require(onChainDID.walletAddress == msg.sender || authorizedContracts[msg.sender], "TaskSpecification: not authorized");
        
        // Validate time constraints
        require(timeConstraints.acceptanceDeadline > block.timestamp, "TaskSpecification: acceptance deadline must be future");
        require(timeConstraints.completionDeadline > timeConstraints.acceptanceDeadline, "TaskSpecification: completion must be after acceptance");
        
        // Validate output format
        require(outputFormat.maxBytes >= outputFormat.minBytes, "TaskSpecification: invalid byte range");
        
        // Validate content requirements
        require(contentValidation.maxResultCount >= contentValidation.minResultCount, "TaskSpecification: invalid result count range");
        require(contentValidation.maxContentLength >= contentValidation.minContentLength, "TaskSpecification: invalid content length range");
        
        // Create specification
        specifications[taskId] = Specification({
            taskId: taskId,
            requesterDID: requesterDID,
            taskType: taskType,
            createdAt: block.timestamp,
            timeConstraints: timeConstraints,
            outputFormat: outputFormat,
            contentValidation: contentValidation,
            executionConstraints: executionConstraints,
            providerCriteria: providerCriteria,
            metadataIPFS: metadataIPFS,
            active: true
        });
        
        emit SpecificationCreated(
            taskId,
            requesterDID,
            taskType,
            timeConstraints.acceptanceDeadline,
            timeConstraints.completionDeadline
        );
        
        return true;
    }
    
    /**
     * @dev Create specification with simplified parameters (for basic tasks)
     */
    function createSimpleSpecification(
        bytes32 taskId,
        bytes32 requesterDID,
        TaskType taskType,
        uint256 acceptanceDeadline,
        uint256 completionDeadline,
        uint256 minReputationScore,
        string calldata metadataIPFS
    ) external returns (bool) {
        // If called by authorized contract (e.g., ClawPayEscrow), skip DID validation
        // because the caller has already validated the DID
        if (!authorizedContracts[msg.sender]) {
            // Validate requester DID for direct calls
            DualDIDRegistry.SubDID memory requester = dualDIDRegistry.getSubDID(requesterDID);
            require(requester.active, "TaskSpecification: requester not active");
            
            // Verify sender is the requester's owner
            DualDIDRegistry.OnChainDID memory onChainDID = dualDIDRegistry.getOnChainDID(requester.parentOnChainDID);
            require(onChainDID.walletAddress == msg.sender, "TaskSpecification: not authorized");
        }
        
        require(acceptanceDeadline > block.timestamp, "TaskSpecification: acceptance deadline must be future");
        require(completionDeadline > acceptanceDeadline, "TaskSpecification: completion must be after acceptance");
        
        // Create with default values
        specifications[taskId] = Specification({
            taskId: taskId,
            requesterDID: requesterDID,
            taskType: taskType,
            createdAt: block.timestamp,
            timeConstraints: TimeConstraints({
                acceptanceDeadline: acceptanceDeadline,
                completionDeadline: completionDeadline,
                gracePeriod: 1 hours,
                requiresIntermediateResult: false,
                intermediateDeadline: 0
            }),
            outputFormat: OutputFormat({
                fileType: "",
                minBytes: 0,
                maxBytes: type(uint256).max,
                formatFeatures: "",
                requiresResultHash: true,
                requiresFormatProbe: false,
                probeType: 0
            }),
            contentValidation: ContentValidation({
                requiredKeywords: "",
                requiredFields: "",
                minResultCount: 0,
                maxResultCount: type(uint256).max,
                languageRequirement: "",
                minContentLength: 0,
                maxContentLength: type(uint256).max
            }),
            executionConstraints: ExecutionConstraints({
                toolRestriction: ToolRestriction.Allowed,
                specifiedTools: "",
                dataSourceConstraints: "",
                proofType: ProofType.None,
                externalVerificationAPI: "",
                privacyConstraints: "",
                resultReuse: ResultReuse.Forbidden,
                customConstraints: ""
            }),
            providerCriteria: ProviderCriteria({
                minReputationScore: minReputationScore,
                minCompletedTasks: 0,
                requiresKYC: false,
                minKYCLevel: 0
            }),
            metadataIPFS: metadataIPFS,
            active: true
        });
        
        emit SpecificationCreated(
            taskId,
            requesterDID,
            taskType,
            acceptanceDeadline,
            completionDeadline
        );
        
        return true;
    }
    
    // ============ Provider Validation ============
    
    /**
     * @dev Validate if a provider meets the task criteria
     * @param taskId The task ID
     * @param providerDID The provider's Agent DID
     * @return valid Whether the provider meets criteria
     * @return reason Rejection reason if not valid
     */
    function validateProvider(bytes32 taskId, bytes32 providerDID) 
        external 
        view 
        specificationExists(taskId) 
        returns (bool valid, string memory reason) 
    {
        Specification storage spec = specifications[taskId];
        ProviderCriteria storage criteria = spec.providerCriteria;
        
        // Check if acceptance deadline passed
        if (block.timestamp > spec.timeConstraints.acceptanceDeadline) {
            return (false, "Acceptance deadline passed");
        }
        
        // Check provider DID is active
        DualDIDRegistry.SubDID memory provider = dualDIDRegistry.getSubDID(providerDID);
        if (!provider.active) {
            return (false, "Provider DID not active");
        }
        
        // Check reputation score
        if (criteria.minReputationScore > 0) {
            uint256 providerScore = reputationScore.getFinalScore(providerDID);
            if (providerScore < criteria.minReputationScore) {
                return (false, "Reputation score too low");
            }
        }
        
        // Check completed tasks
        if (criteria.minCompletedTasks > 0) {
            ReputationScore.ScoreStats memory stats = reputationScore.getAgentStats(providerDID);
            if (stats.successfulTasks < criteria.minCompletedTasks) {
                return (false, "Not enough completed tasks");
            }
        }
        
        return (true, "");
    }
    
    // ============ Result Submission ============
    
    /**
     * @dev Submit task result
     * @param taskId The task ID
     * @param providerDID Provider's Agent DID
     * @param resultHash Hash of the result data
     * @param formatProbeHash Format probe hash (if required)
     * @param executionProofHash Execution proof hash (if required)
     * @param resultIPFS IPFS hash of the result
     */
    function submitResult(
        bytes32 taskId,
        bytes32 providerDID,
        bytes32 resultHash,
        bytes32 formatProbeHash,
        bytes32 executionProofHash,
        string calldata resultIPFS
    ) external specificationExists(taskId) {
        Specification storage spec = specifications[taskId];
        
        // Validate provider
        DualDIDRegistry.SubDID memory provider = dualDIDRegistry.getSubDID(providerDID);
        require(provider.active, "TaskSpecification: provider not active");

        DualDIDRegistry.OnChainDID memory onChainDID = dualDIDRegistry.getOnChainDID(provider.parentOnChainDID);
        require(onChainDID.walletAddress == msg.sender, "TaskSpecification: not provider owner");
        
        // Check deadline (with grace period)
        uint256 deadline = spec.timeConstraints.completionDeadline + spec.timeConstraints.gracePeriod;
        require(block.timestamp <= deadline, "TaskSpecification: deadline passed");
        
        // Validate required proofs
        if (spec.outputFormat.requiresResultHash) {
            require(resultHash != bytes32(0), "TaskSpecification: result hash required");
        }
        
        if (spec.outputFormat.requiresFormatProbe) {
            require(formatProbeHash != bytes32(0), "TaskSpecification: format probe required");
        }
        
        if (spec.executionConstraints.proofType != ProofType.None) {
            require(executionProofHash != bytes32(0), "TaskSpecification: execution proof required");
        }
        
        // Store result
        results[taskId] = TaskResult({
            taskId: taskId,
            providerDID: providerDID,
            resultHash: resultHash,
            formatProbeHash: formatProbeHash,
            executionProofHash: executionProofHash,
            resultIPFS: resultIPFS,
            submittedAt: block.timestamp,
            verified: false,
            disputed: false
        });
        
        emit ResultSubmitted(taskId, providerDID, resultHash, resultIPFS);
    }
    
    /**
     * @dev Submit intermediate result
     */
    function submitIntermediateResult(
        bytes32 taskId,
        bytes32 providerDID,
        bytes32 resultHash
    ) external specificationExists(taskId) {
        Specification storage spec = specifications[taskId];
        
        require(spec.timeConstraints.requiresIntermediateResult, "TaskSpecification: intermediate result not required");
        require(block.timestamp <= spec.timeConstraints.intermediateDeadline, "TaskSpecification: intermediate deadline passed");
        
        // Validate provider
        DualDIDRegistry.SubDID memory provider = dualDIDRegistry.getSubDID(providerDID);
        require(provider.active, "TaskSpecification: provider not active");

        DualDIDRegistry.OnChainDID memory onChainDID = dualDIDRegistry.getOnChainDID(provider.parentOnChainDID);
        require(onChainDID.walletAddress == msg.sender, "TaskSpecification: not provider owner");
        
        intermediateResults[taskId].push(resultHash);
        
        emit IntermediateResultSubmitted(taskId, providerDID, resultHash, block.timestamp);
    }
    
    // ============ Result Verification ============
    
    /**
     * @dev Mark result as verified (called by arbitration system)
     */
    function verifyResult(bytes32 taskId, bool passed) external onlyAuthorized {
        require(results[taskId].submittedAt > 0, "TaskSpecification: no result submitted");
        
        results[taskId].verified = true;
        
        emit ResultVerified(taskId, passed);
    }
    
    /**
     * @dev Mark result as disputed
     */
    function disputeResult(bytes32 taskId, string calldata reason) external specificationExists(taskId) {
        require(results[taskId].submittedAt > 0, "TaskSpecification: no result submitted");
        require(!results[taskId].disputed, "TaskSpecification: already disputed");
        
        // Verify sender is the requester
        Specification storage spec = specifications[taskId];
        DualDIDRegistry.SubDID memory requester = dualDIDRegistry.getSubDID(spec.requesterDID);
        DualDIDRegistry.OnChainDID memory onChainDID = dualDIDRegistry.getOnChainDID(requester.parentOnChainDID);
        require(onChainDID.walletAddress == msg.sender, "TaskSpecification: not requester");
        
        results[taskId].disputed = true;
        
        emit ResultDisputed(taskId, reason);
    }
    
    // ============ View Functions ============
    
    function getSpecification(bytes32 taskId) external view returns (Specification memory) {
        return specifications[taskId];
    }
    
    function getTimeConstraints(bytes32 taskId) external view returns (TimeConstraints memory) {
        return specifications[taskId].timeConstraints;
    }
    
    function getOutputFormat(bytes32 taskId) external view returns (OutputFormat memory) {
        return specifications[taskId].outputFormat;
    }
    
    function getContentValidation(bytes32 taskId) external view returns (ContentValidation memory) {
        return specifications[taskId].contentValidation;
    }
    
    function getExecutionConstraints(bytes32 taskId) external view returns (ExecutionConstraints memory) {
        return specifications[taskId].executionConstraints;
    }
    
    function getProviderCriteria(bytes32 taskId) external view returns (ProviderCriteria memory) {
        return specifications[taskId].providerCriteria;
    }
    
    function getResult(bytes32 taskId) external view returns (TaskResult memory) {
        return results[taskId];
    }
    
    function getIntermediateResults(bytes32 taskId) external view returns (bytes32[] memory) {
        return intermediateResults[taskId];
    }
    
    /**
     * @dev Check if task is within acceptance period
     */
    function isAcceptancePeriod(bytes32 taskId) external view returns (bool) {
        if (!specifications[taskId].active) return false;
        return block.timestamp <= specifications[taskId].timeConstraints.acceptanceDeadline;
    }
    
    /**
     * @dev Check if task is within completion period
     */
    function isCompletionPeriod(bytes32 taskId) external view returns (bool) {
        if (!specifications[taskId].active) return false;
        TimeConstraints storage tc = specifications[taskId].timeConstraints;
        return block.timestamp > tc.acceptanceDeadline && 
               block.timestamp <= tc.completionDeadline + tc.gracePeriod;
    }
    
    /**
     * @dev Check if result was submitted on time
     */
    function isResultOnTime(bytes32 taskId) external view returns (bool) {
        if (results[taskId].submittedAt == 0) return false;
        TimeConstraints storage tc = specifications[taskId].timeConstraints;
        return results[taskId].submittedAt <= tc.completionDeadline;
    }
    
    /**
     * @dev Check if result was submitted within grace period
     */
    function isResultInGracePeriod(bytes32 taskId) external view returns (bool) {
        if (results[taskId].submittedAt == 0) return false;
        TimeConstraints storage tc = specifications[taskId].timeConstraints;
        return results[taskId].submittedAt > tc.completionDeadline && 
               results[taskId].submittedAt <= tc.completionDeadline + tc.gracePeriod;
    }
}
