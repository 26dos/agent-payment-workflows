package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/clawpay/backend/internal/middleware"
	"github.com/clawpay/backend/internal/model"
	"github.com/clawpay/backend/internal/service"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc       *service.Service
	jwtSecret string
}

func New(svc *service.Service, jwtSecret string) *Handler {
	return &Handler{svc: svc, jwtSecret: jwtSecret}
}

// ============ Auth Handlers ============

type LoginRequest struct {
	WalletAddress string `json:"wallet_address" binding:"required"`
	Message       string `json:"message" binding:"required"`
	Signature     string `json:"signature" binding:"required"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  *model.User `json:"user"`
}

// Login handles wallet signature authentication
func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify signature
	valid, err := middleware.VerifySignature(req.Message, req.Signature, req.WalletAddress)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	// Get or create user
	user, err := h.svc.GetOrCreateUser(c.Request.Context(), req.WalletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	// Generate JWT token
	token, err := middleware.GenerateToken(req.WalletAddress, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		Token: token,
		User:  user,
	})
}

// GetNonce returns a nonce message for signing
func (h *Handler) GetNonce(c *gin.Context) {
	walletAddress := c.Query("wallet_address")
	if walletAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wallet_address required"})
		return
	}

	// Generate nonce message
	nonce := time.Now().UnixNano()
	message := "Sign this message to login to ClawPay.\n\nNonce: " + strconv.FormatInt(nonce, 10)

	c.JSON(http.StatusOK, gin.H{
		"message": message,
		"nonce":   nonce,
	})
}

// ============ User Handlers ============

// GetProfile returns the current user's profile
func (h *Handler) GetProfile(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	user, err := h.svc.GetUserByWallet(c.Request.Context(), walletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

type UpdateDIDRequest struct {
	DID string `json:"did" binding:"required"`
}

// UpdateDID updates the user's Human DID
func (h *Handler) UpdateDID(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)

	var req UpdateDIDRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateUserDID(c.Request.Context(), walletAddress, req.DID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update DID"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "DID updated"})
}

// ============ Agent Handlers ============

type CreateAgentRequest struct {
	Name string `json:"name" binding:"required"`
}

// CreateAgent creates a new agent for the user
func (h *Handler) CreateAgent(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)

	var req CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.GetUserByWallet(c.Request.Context(), walletAddress)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	agent, err := h.svc.CreateAgent(c.Request.Context(), user.ID, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create agent"})
		return
	}

	c.JSON(http.StatusCreated, agent)
}

// GetAgents returns all agents for the current user
func (h *Handler) GetAgents(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)

	user, err := h.svc.GetUserByWallet(c.Request.Context(), walletAddress)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	agents, err := h.svc.GetAgentsByUser(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get agents"})
		return
	}

	c.JSON(http.StatusOK, agents)
}

// GetAgent returns a specific agent
func (h *Handler) GetAgent(c *gin.Context) {
	agentID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
		return
	}

	agent, err := h.svc.GetAgentByID(c.Request.Context(), agentID)
	if err != nil || agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}

	c.JSON(http.StatusOK, agent)
}

type UpdateMandateRequest struct {
	DailyLimit  float64   `json:"daily_limit" binding:"required"`
	SingleLimit float64   `json:"single_limit" binding:"required"`
	Expiry      time.Time `json:"expiry" binding:"required"`
}

// UpdateAgentMandate updates an agent's mandate settings
func (h *Handler) UpdateAgentMandate(c *gin.Context) {
	agentID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
		return
	}

	var req UpdateMandateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateAgentMandate(c.Request.Context(), agentID, req.DailyLimit, req.SingleLimit, req.Expiry); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update mandate"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Mandate updated"})
}

type UpdateAgentDIDRequest struct {
	SubDID string `json:"sub_did" binding:"required"`
}

// UpdateAgentDID updates an agent's Sub-DID
func (h *Handler) UpdateAgentDID(c *gin.Context) {
	agentID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
		return
	}

	var req UpdateAgentDIDRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateAgentDID(c.Request.Context(), agentID, req.SubDID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update agent DID"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Agent DID updated"})
}

// ============ Task Handlers ============

type CreateTaskRequest struct {
	RequesterDID string  `json:"requester_did" binding:"required"`
	ProviderDID  *string `json:"provider_did"` // Optional for marketplace tasks
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	BaseAmount   float64 `json:"base_amount" binding:"required"`
	Complexity   int     `json:"complexity" binding:"required,min=1,max=3"`
	Metadata     string  `json:"metadata"`
}

// CreateTask creates a new escrow task
func (h *Handler) CreateTask(c *gin.Context) {
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task := &model.Task{
		RequesterDID: req.RequesterDID,
		ProviderDID:  req.ProviderDID,
		Title:        req.Title,
		Description:  req.Description,
		BaseAmount:   req.BaseAmount,
		Complexity:   req.Complexity,
		Metadata:     req.Metadata,
	}

	if err := h.svc.CreateTask(c.Request.Context(), task); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	c.JSON(http.StatusCreated, task)
}

// GetTasks returns tasks for a DID
func (h *Handler) GetTasks(c *gin.Context) {
	did := c.Query("did")
	if did == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "did required"})
		return
	}

	asRequester := c.Query("role") != "provider"
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	tasks, err := h.svc.GetTasksByDID(c.Request.Context(), did, asRequester, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get tasks"})
		return
	}

	c.JSON(http.StatusOK, tasks)
}

// GetTask returns a specific task
func (h *Handler) GetTask(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	task, err := h.svc.GetTaskByID(c.Request.Context(), taskID)
	if err != nil || task == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	c.JSON(http.StatusOK, task)
}

type AcceptTaskRequest struct {
	ProviderDID string `json:"provider_did" binding:"required"`
}

// AcceptTask marks a task as accepted by a provider
func (h *Handler) AcceptTask(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var req AcceptTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.AcceptTaskWithProvider(c.Request.Context(), taskID, req.ProviderDID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task accepted"})
}

// CompleteTask marks a task as completed
func (h *Handler) CompleteTask(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	if err := h.svc.CompleteTask(c.Request.Context(), taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task completed"})
}

// CancelTask cancels a task
func (h *Handler) CancelTask(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	if err := h.svc.CancelTask(c.Request.Context(), taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task cancelled"})
}

type RaiseDisputeRequest struct {
	RaisedByDID string `json:"raised_by_did"`
	Reason      string `json:"reason"`
}

// RaiseDispute raises a dispute on a task
func (h *Handler) RaiseDispute(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var req RaiseDisputeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.RaiseDispute(c.Request.Context(), taskID, req.RaisedByDID, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to raise dispute"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Dispute raised"})
}

type UpdateChainTaskRequest struct {
	ChainTaskID int64  `json:"chain_task_id" binding:"required"`
	TxHash      string `json:"tx_hash" binding:"required"`
}

// UpdateTaskChainID updates a task's on-chain ID
func (h *Handler) UpdateTaskChainID(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var req UpdateChainTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateTaskChainID(c.Request.Context(), taskID, req.ChainTaskID, req.TxHash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update chain task ID"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Chain task ID updated"})
}

// ============ Pricing Handlers ============

type CalculatePriceRequest struct {
	BaseFee         float64 `json:"base_fee" binding:"required"`
	Complexity      int     `json:"complexity" binding:"required,min=1,max=3"`
	ReputationScore int     `json:"reputation_score"`
}

// CalculatePrice calculates the dynamic price
func (h *Handler) CalculatePrice(c *gin.Context) {
	var req CalculatePriceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.ReputationScore == 0 {
		req.ReputationScore = 75 // Default score
	}

	result := h.svc.CalculatePrice(req.BaseFee, req.Complexity, req.ReputationScore)
	c.JSON(http.StatusOK, result)
}

// ============ Dashboard Handlers ============

// GetDashboardStats returns dashboard statistics
func (h *Handler) GetDashboardStats(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)

	user, err := h.svc.GetUserByWallet(c.Request.Context(), walletAddress)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	stats, err := h.svc.GetDashboardStats(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// ============ Activity Log Handlers ============

type LogActivityRequest struct {
	AgentDID string          `json:"agent_did" binding:"required"`
	Action   string          `json:"action" binding:"required"`
	Details  json.RawMessage `json:"details"`
}

// LogActivity logs an activity for a task
func (h *Handler) LogActivity(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var req LogActivityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.LogActivity(c.Request.Context(), taskID, req.AgentDID, req.Action, req.Details); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to log activity"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Activity logged"})
}

// GetActivityLogs returns activity logs for a task
func (h *Handler) GetActivityLogs(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	logs, err := h.svc.GetActivityLogs(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get activity logs"})
		return
	}

	c.JSON(http.StatusOK, logs)
}

// ============ Public API Handlers (No Auth Required) ============

// GetPublicTasks returns all open tasks for public viewing
func (h *Handler) GetPublicTasks(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	tasks, err := h.svc.GetPublicTasks(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get tasks"})
		return
	}

	total, err := h.svc.GetPublicTasksCount(c.Request.Context())
	if err != nil {
		total = len(tasks)
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks": tasks,
		"total": total,
		"limit": limit,
		"offset": offset,
	})
}

// GetPublicTask returns a specific task for public viewing
func (h *Handler) GetPublicTask(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	task, err := h.svc.GetTaskByID(c.Request.Context(), taskID)
	if err != nil || task == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	c.JSON(http.StatusOK, task)
}

// GetPublicAgents returns all agents for public viewing
func (h *Handler) GetPublicAgents(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	agents, err := h.svc.GetPublicAgents(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get agents"})
		return
	}

	total, err := h.svc.GetPublicAgentsCount(c.Request.Context())
	if err != nil {
		total = len(agents)
	}

	c.JSON(http.StatusOK, gin.H{
		"agents": agents,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetPublicAgent returns a specific agent for public viewing
func (h *Handler) GetPublicAgent(c *gin.Context) {
	agentID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
		return
	}

	agent, err := h.svc.GetAgentByID(c.Request.Context(), agentID)
	if err != nil || agent == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}

	c.JSON(http.StatusOK, agent)
}

// ============ Batch Chain Handlers ============

// GetPendingChainTasks returns tasks pending for on-chain batch
func (h *Handler) GetPendingChainTasks(c *gin.Context) {
	count, err := h.svc.GetPendingChainTasksCount(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get pending tasks"})
		return
	}

	tasks, err := h.svc.GetPendingChainTasks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get pending tasks"})
		return
	}

	config, _ := h.svc.GetBatchChainConfig(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"count":  count,
		"tasks":  tasks,
		"config": config,
	})
}

type BatchChainRequest struct {
	TaskIDs []int64 `json:"task_ids"`
}

// TriggerBatchChain manually triggers batch chaining for selected or all pending tasks
func (h *Handler) TriggerBatchChain(c *gin.Context) {
	var req BatchChainRequest
	c.ShouldBindJSON(&req) // Optional body

	batchID, err := h.svc.TriggerBatchChain(c.Request.Context(), req.TaskIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to trigger batch chain: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Batch chain triggered",
		"batch_id": batchID,
	})
}

type UpdateBatchConfigRequest struct {
	TaskCount       int  `json:"task_count"`
	IntervalMinutes int  `json:"interval_minutes"`
	AutoEnabled     bool `json:"auto_enabled"`
}

// UpdateBatchConfig updates the batch chain configuration
func (h *Handler) UpdateBatchConfig(c *gin.Context) {
	var req UpdateBatchConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config := &model.BatchChainConfig{
		TaskCount:       req.TaskCount,
		IntervalMinutes: req.IntervalMinutes,
		AutoEnabled:     req.AutoEnabled,
	}

	if err := h.svc.UpdateBatchChainConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Config updated"})
}

// GetBatchConfig returns the current batch chain configuration
func (h *Handler) GetBatchConfig(c *gin.Context) {
	config, err := h.svc.GetBatchChainConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get config"})
		return
	}

	c.JSON(http.StatusOK, config)
}
