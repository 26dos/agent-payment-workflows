package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/clawpay/backend/internal/email"
	"github.com/clawpay/backend/internal/middleware"
	"github.com/clawpay/backend/internal/model"
	"github.com/clawpay/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type Handler struct {
	svc          *service.Service
	jwtSecret    string
	emailService *email.EmailService
}

func New(svc *service.Service, jwtSecret string, emailService *email.EmailService) *Handler {
	return &Handler{svc: svc, jwtSecret: jwtSecret, emailService: emailService}
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

// ============ Email Auth Handlers ============

type SendVerificationCodeRequest struct {
	Email string `json:"email" binding:"required,email"`
	Type  string `json:"type"` // register, login, reset_password
}

// SendVerificationCode sends a verification code to the email
func (h *Handler) SendVerificationCode(c *gin.Context) {
	var req SendVerificationCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email address"})
		return
	}

	codeType := req.Type
	if codeType == "" {
		codeType = "register"
	}

	// Check if email already registered for register type
	if codeType == "register" {
		existing, _ := h.svc.GetUserByEmail(c.Request.Context(), req.Email)
		if existing != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
			return
		}
	}

	// Generate verification code
	code, err := h.svc.CreateVerificationCode(c.Request.Context(), req.Email, codeType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate verification code"})
		return
	}

	// Send email if configured
	response := gin.H{
		"message": "Verification code sent",
	}

	if h.emailService != nil && h.emailService.IsConfigured() {
		if err := h.emailService.SendVerificationCode(req.Email, code, codeType); err != nil {
			log.Error().Err(err).Str("email", req.Email).Msg("Failed to send verification email")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
			return
		}
	} else {
		// Development mode: return code in response
		log.Warn().Msg("SMTP not configured, returning verification code in response (dev mode only)")
		response["code"] = code
		response["dev_mode"] = true
	}

	c.JSON(http.StatusOK, response)
}

type EmailRegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Code     string `json:"code" binding:"required"`
	DisplayID string `json:"display_id"` // Optional, can set later
}

// EmailRegister registers a new user with email
func (h *Handler) EmailRegister(c *gin.Context) {
	var req EmailRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify the code
	valid, err := h.svc.VerifyCode(c.Request.Context(), req.Email, req.Code, "register")
	if err != nil || !valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired verification code"})
		return
	}

	// Check if email already registered
	existing, _ := h.svc.GetUserByEmail(c.Request.Context(), req.Email)
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	// Create user
	user, err := h.svc.CreateEmailUser(c.Request.Context(), req.Email, req.Password, req.DisplayID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user: " + err.Error()})
		return
	}

	// Generate JWT token
	token, err := middleware.GenerateTokenForEmail(req.Email, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user":  user,
		"message": "Registration successful. Connect a wallet to perform business operations.",
	})
}

type EmailLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// EmailLogin handles email/password login
func (h *Handler) EmailLogin(c *gin.Context) {
	var req EmailLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.ValidateEmailLogin(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Generate JWT token
	token, err := middleware.GenerateTokenForEmail(req.Email, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		Token: token,
		User:  user,
	})
}

type EmailLoginWithCodeRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required"`
}

// EmailLoginWithCode handles login with verification code (passwordless)
func (h *Handler) EmailLoginWithCode(c *gin.Context) {
	var req EmailLoginWithCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify the code
	valid, err := h.svc.VerifyCode(c.Request.Context(), req.Email, req.Code, "login")
	if err != nil || !valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired verification code"})
		return
	}

	// Get user
	user, err := h.svc.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Generate JWT token
	token, err := middleware.GenerateTokenForEmail(req.Email, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		Token: token,
		User:  user,
	})
}

type BindWalletRequest struct {
	WalletAddress string `json:"wallet_address" binding:"required"`
	Message       string `json:"message" binding:"required"`
	Signature     string `json:"signature" binding:"required"`
}

// BindWallet binds a wallet to an email-registered user
func (h *Handler) BindWallet(c *gin.Context) {
	// Get current user from context (must be email authenticated)
	email := middleware.GetEmail(c)
	if email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req BindWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify signature
	valid, err := middleware.VerifySignature(req.Message, req.Signature, req.WalletAddress)
	if err != nil {
		log.Error().Err(err).Msg("Signature verification error")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature: " + err.Error()})
		return
	}
	if !valid {
		log.Error().Msg("Signature invalid")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	log.Info().Str("email", email).Str("wallet", req.WalletAddress).Msg("Binding wallet to user")

	// Bind wallet to user
	user, err := h.svc.BindWalletToUser(c.Request.Context(), email, req.WalletAddress)
	if err != nil {
		log.Error().Err(err).Str("email", email).Str("wallet", req.WalletAddress).Msg("Failed to bind wallet")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bind wallet: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Wallet bound successfully",
		"user":    user,
	})
}

// GetBindWalletNonce returns a nonce for wallet binding
func (h *Handler) GetBindWalletNonce(c *gin.Context) {
	email := middleware.GetEmail(c)
	if email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	walletAddress := c.Query("wallet_address")
	if walletAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wallet_address required"})
		return
	}

	nonce := time.Now().UnixNano()
	message := "Sign this message to bind wallet to your ClawPay account.\n\nEmail: " + email + "\nNonce: " + strconv.FormatInt(nonce, 10)

	c.JSON(http.StatusOK, gin.H{
		"message": message,
		"nonce":   nonce,
	})
}

// CheckBusinessAccess middleware helper - returns whether user can perform business ops
func (h *Handler) CheckBusinessAccess(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)
	email := middleware.GetEmail(c)
	
	if walletAddress == "" && email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var user *model.User
	var err error

	if walletAddress != "" {
		user, err = h.svc.GetUserByWallet(c.Request.Context(), walletAddress)
	} else {
		user, err = h.svc.GetUserByEmail(c.Request.Context(), email)
	}

	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"can_perform_business_ops": user.CanPerformBusinessOps(),
		"has_wallet":               user.HasWallet(),
		"email_verified":           user.EmailVerified,
		"auth_type":                user.AuthType,
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
	email := middleware.GetEmail(c)

	var req CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user *model.User
	var err error
	
	if walletAddress != "" {
		user, err = h.svc.GetUserByWallet(c.Request.Context(), walletAddress)
	} else if email != "" {
		user, err = h.svc.GetUserByEmail(c.Request.Context(), email)
	}
	
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	agent, err := h.svc.CreateAgent(c.Request.Context(), user.ID, req.Name)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create agent"})
		return
	}

	c.JSON(http.StatusCreated, agent)
}

// GetAgents returns all agents for the current user
func (h *Handler) GetAgents(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)
	email := middleware.GetEmail(c)

	var user *model.User
	var err error
	
	if walletAddress != "" {
		user, err = h.svc.GetUserByWallet(c.Request.Context(), walletAddress)
	} else if email != "" {
		user, err = h.svc.GetUserByEmail(c.Request.Context(), email)
	}
	
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
	ChainTaskID  *int64  `json:"chain_task_id"`
	ChainTxHash  string  `json:"chain_tx_hash"`
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
		ChainTaskID:  req.ChainTaskID,
		TxHash:       req.ChainTxHash,
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
	TxHash      string `json:"tx_hash"`
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

	if err := h.svc.AcceptTaskWithProvider(c.Request.Context(), taskID, req.ProviderDID, req.TxHash); err != nil {
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
		log.Error().Err(err).Msg("Failed to get public tasks")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

type MarkTasksOnChainRequest struct {
	TaskIDs []int64 `json:"task_ids" binding:"required"`
	TxHash  string  `json:"tx_hash" binding:"required"`
}

// MarkTasksOnChain marks tasks as recorded on-chain with the transaction hash
func (h *Handler) MarkTasksOnChain(c *gin.Context) {
	var req MarkTasksOnChainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.TaskIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No task IDs provided"})
		return
	}

	if err := h.svc.MarkTasksOnChain(c.Request.Context(), req.TaskIDs, req.TxHash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark tasks: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tasks marked as on-chain",
		"count":   len(req.TaskIDs),
		"tx_hash": req.TxHash,
	})
}

// ============ Incentive System Handlers ============

// GetIncentiveConstants returns the incentive system constants
func (h *Handler) GetIncentiveConstants(c *gin.Context) {
	constants := model.GetDefaultIncentiveConstants()
	c.JSON(http.StatusOK, constants)
}

// GetHumanIncentive returns incentive data for a human DID
func (h *Handler) GetHumanIncentive(c *gin.Context) {
	humanDID := c.Query("did")
	if humanDID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "did required"})
		return
	}

	incentive, err := h.svc.GetHumanIncentive(c.Request.Context(), humanDID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get incentive: " + err.Error()})
		return
	}

	if incentive == nil {
		c.JSON(http.StatusOK, gin.H{
			"human_did":           humanDID,
			"registration_points": 0,
			"kyc_points":          0,
			"referral_points":     0,
			"total_points":        0,
			"kyc_level":           0,
			"invite_count":        0,
			"registered":          false,
			"blacklisted":         false,
		})
		return
	}

	c.JSON(http.StatusOK, incentive)
}

// GetAgentIncentive returns incentive data for an agent DID
func (h *Handler) GetAgentIncentive(c *gin.Context) {
	agentDID := c.Query("did")
	if agentDID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "did required"})
		return
	}

	incentive, err := h.svc.GetAgentIncentive(c.Request.Context(), agentDID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get incentive: " + err.Error()})
		return
	}

	if incentive == nil {
		c.JSON(http.StatusOK, gin.H{
			"agent_did":           agentDID,
			"registration_points": 0,
			"task_points":         0,
			"total_points":        0,
			"daily_task_points":   0,
			"registered":          false,
		})
		return
	}

	c.JSON(http.StatusOK, incentive)
}

// GetIncentiveSummary returns a summary of all incentives for a human DID
func (h *Handler) GetIncentiveSummary(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)
	
	user, err := h.svc.GetUserByWallet(c.Request.Context(), walletAddress)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	summary, err := h.svc.GetIncentiveSummary(c.Request.Context(), user.DID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get summary: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

type ClaimRegistrationBonusRequest struct {
	HumanDID   string  `json:"human_did" binding:"required"`
	InviteCode *string `json:"invite_code"`
}

// ClaimRegistrationBonus claims the registration bonus for a human DID
func (h *Handler) ClaimRegistrationBonus(c *gin.Context) {
	var req ClaimRegistrationBonusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	incentive, err := h.svc.ClaimHumanRegistrationBonus(c.Request.Context(), req.HumanDID, req.InviteCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to claim bonus: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, incentive)
}

type ClaimAgentBonusRequest struct {
	AgentDID string `json:"agent_did" binding:"required"`
	HumanDID string `json:"human_did" binding:"required"`
}

// ClaimAgentBonus claims the registration bonus for an agent DID
func (h *Handler) ClaimAgentBonus(c *gin.Context) {
	var req ClaimAgentBonusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	incentive, err := h.svc.ClaimAgentRegistrationBonus(c.Request.Context(), req.AgentDID, req.HumanDID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to claim bonus: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, incentive)
}

type GenerateInviteCodeRequest struct {
	HumanDID string `json:"human_did" binding:"required"`
}

// GenerateInviteCode generates an invite code for a human DID
func (h *Handler) GenerateInviteCode(c *gin.Context) {
	var req GenerateInviteCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code, err := h.svc.GenerateInviteCode(c.Request.Context(), req.HumanDID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate code: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"invite_code": code,
		"human_did":   req.HumanDID,
	})
}

type RecordTaskCompletionRequest struct {
	AgentDID string `json:"agent_did" binding:"required"`
	TaskID   int64  `json:"task_id" binding:"required"`
}

// RecordTaskCompletion records a task completion for incentive points
func (h *Handler) RecordTaskCompletion(c *gin.Context) {
	var req RecordTaskCompletionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	incentive, err := h.svc.RecordTaskCompletion(c.Request.Context(), req.AgentDID, req.TaskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record completion: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, incentive)
}

// GetReferralLeaderboard returns top referrers
func (h *Handler) GetReferralLeaderboard(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	leaderboard, err := h.svc.GetReferralLeaderboard(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get leaderboard: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, leaderboard)
}

// GetPointsLeaderboard returns top point earners
func (h *Handler) GetPointsLeaderboard(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	includeAgents := c.Query("include_agents") == "true"

	leaderboard, err := h.svc.GetPointsLeaderboard(c.Request.Context(), limit, includeAgents)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get leaderboard: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, leaderboard)
}

// ============ Task Specification Handlers ============

type CreateTaskSpecRequest struct {
	TaskID              int64   `json:"task_id" binding:"required"`
	TaskType            int     `json:"task_type"`
	AcceptanceDeadline  string  `json:"acceptance_deadline"`
	CompletionDeadline  string  `json:"completion_deadline"`
	GracePeriod         int     `json:"grace_period"`
	MinReputationScore  int     `json:"min_reputation_score"`
	MinCompletedTasks   int     `json:"min_completed_tasks"`
	RequiresKYC         bool    `json:"requires_kyc"`
	MinKYCLevel         int     `json:"min_kyc_level"`
	FileType            string  `json:"file_type"`
	MinBytes            int64   `json:"min_bytes"`
	MaxBytes            int64   `json:"max_bytes"`
	FormatFeatures      string  `json:"format_features"`
	RequiredKeywords    string  `json:"required_keywords"`
	RequiredFields      string  `json:"required_fields"`
	MinResultCount      int     `json:"min_result_count"`
	LanguageRequirement string  `json:"language_requirement"`
	MetadataIPFS        string  `json:"metadata_ipfs"`
}

// CreateTaskSpecification creates a task specification
func (h *Handler) CreateTaskSpecification(c *gin.Context) {
	var req CreateTaskSpecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var acceptDeadline, completeDeadline time.Time
	var err error

	if req.AcceptanceDeadline != "" {
		acceptDeadline, err = time.Parse(time.RFC3339, req.AcceptanceDeadline)
		if err != nil {
			acceptDeadline = time.Now().Add(24 * time.Hour)
		}
	} else {
		acceptDeadline = time.Now().Add(24 * time.Hour)
	}

	if req.CompletionDeadline != "" {
		completeDeadline, err = time.Parse(time.RFC3339, req.CompletionDeadline)
		if err != nil {
			completeDeadline = time.Now().Add(7 * 24 * time.Hour)
		}
	} else {
		completeDeadline = time.Now().Add(7 * 24 * time.Hour)
	}

	spec := &model.TaskSpecification{
		TaskID:              req.TaskID,
		TaskType:            model.TaskType(req.TaskType),
		AcceptanceDeadline:  acceptDeadline,
		CompletionDeadline:  completeDeadline,
		GracePeriod:         req.GracePeriod,
		MinReputationScore:  req.MinReputationScore,
		MinCompletedTasks:   req.MinCompletedTasks,
		RequiresKYC:         req.RequiresKYC,
		MinKYCLevel:         model.KYCLevel(req.MinKYCLevel),
		FileType:            req.FileType,
		MinBytes:            req.MinBytes,
		MaxBytes:            req.MaxBytes,
		FormatFeatures:      req.FormatFeatures,
		RequiredKeywords:    req.RequiredKeywords,
		RequiredFields:      req.RequiredFields,
		MinResultCount:      req.MinResultCount,
		LanguageRequirement: req.LanguageRequirement,
		MetadataIPFS:        req.MetadataIPFS,
	}

	if err := h.svc.CreateTaskSpecification(c.Request.Context(), spec); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create specification: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, spec)
}

// GetTaskSpecification returns the specification for a task
func (h *Handler) GetTaskSpecification(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	spec, err := h.svc.GetTaskSpecification(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get specification: " + err.Error()})
		return
	}

	if spec == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Specification not found"})
		return
	}

	c.JSON(http.StatusOK, spec)
}

type SubmitTaskResultRequest struct {
	TaskID             int64  `json:"task_id" binding:"required"`
	ProviderDID        string `json:"provider_did" binding:"required"`
	ResultHash         string `json:"result_hash" binding:"required"`
	FormatProbeHash    string `json:"format_probe_hash"`
	ExecutionProofHash string `json:"execution_proof_hash"`
	ResultIPFS         string `json:"result_ipfs"`
}

// SubmitTaskResult submits a result for a task
func (h *Handler) SubmitTaskResult(c *gin.Context) {
	var req SubmitTaskResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := &model.TaskResult{
		TaskID:             req.TaskID,
		ProviderDID:        req.ProviderDID,
		ResultHash:         req.ResultHash,
		FormatProbeHash:    req.FormatProbeHash,
		ExecutionProofHash: req.ExecutionProofHash,
		ResultIPFS:         req.ResultIPFS,
		SubmittedAt:        time.Now(),
	}

	if err := h.svc.SubmitTaskResult(c.Request.Context(), result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit result: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

// GetTaskResult returns the result for a task
func (h *Handler) GetTaskResult(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	result, err := h.svc.GetTaskResult(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get result: " + err.Error()})
		return
	}

	if result == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Result not found"})
		return
	}

	c.JSON(http.StatusOK, result)
}

type ValidateProviderRequest struct {
	TaskID      int64  `json:"task_id" binding:"required"`
	ProviderDID string `json:"provider_did" binding:"required"`
}

// ValidateProvider validates if a provider meets task requirements
func (h *Handler) ValidateProvider(c *gin.Context) {
	var req ValidateProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	valid, reason, err := h.svc.ValidateProvider(c.Request.Context(), req.TaskID, req.ProviderDID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":  valid,
		"reason": reason,
	})
}

// ============ Dual DID System Handlers ============

type RegisterOnChainDIDRequest struct {
	WalletAddress string `json:"wallet_address"`
	TxHash        string `json:"tx_hash"`
	DIDHash       string `json:"did_hash"`
}

// RegisterOnChainDID registers an on-chain DID for a wallet
func (h *Handler) RegisterOnChainDID(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req RegisterOnChainDIDRequest
	c.ShouldBindJSON(&req)
	if req.WalletAddress == "" {
		req.WalletAddress = walletAddress
	}

	onChainDID, err := h.svc.RegisterOnChainDIDWithHash(c.Request.Context(), walletAddress, req.DIDHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register on-chain DID: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, onChainDID)
}

type RegisterOffChainDIDRequest struct {
	DisplayID string `json:"display_id" binding:"required"`
}

// RegisterOffChainDID registers an off-chain display DID
func (h *Handler) RegisterOffChainDID(c *gin.Context) {
	// Support both wallet and email users
	walletAddress := middleware.GetWalletAddress(c)
	email := middleware.GetEmail(c)
	
	log.Info().Str("wallet", walletAddress).Str("email", email).Msg("RegisterOffChainDID called")
	
	if walletAddress == "" && email == "" {
		log.Warn().Msg("RegisterOffChainDID: No wallet or email found")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req RegisterOffChainDIDRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var offChainDID *model.OffChainDID
	var err error

	if walletAddress != "" {
		offChainDID, err = h.svc.RegisterOffChainDID(c.Request.Context(), walletAddress, req.DisplayID)
	} else {
		offChainDID, err = h.svc.RegisterOffChainDIDByEmail(c.Request.Context(), email, req.DisplayID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register off-chain DID: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, offChainDID)
}

type CompleteRegistrationRequest struct {
	DisplayID string `json:"display_id" binding:"required"`
}

// CompleteRegistration registers both on-chain and off-chain DIDs
func (h *Handler) CompleteRegistration(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req CompleteRegistrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	didInfo, err := h.svc.CompleteRegistration(c.Request.Context(), walletAddress, req.DisplayID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete registration: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, didInfo)
}

// GetMyDIDs returns the current user's DID info
func (h *Handler) GetMyDIDs(c *gin.Context) {
	// Support both wallet and email users
	walletAddress := middleware.GetWalletAddress(c)
	email := middleware.GetEmail(c)

	if walletAddress == "" && email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var didInfo *model.UserDIDInfo
	var err error

	if walletAddress != "" {
		didInfo, err = h.svc.GetUserDIDInfo(c.Request.Context(), walletAddress)
	} else {
		didInfo, err = h.svc.GetUserDIDInfoByEmail(c.Request.Context(), email)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get DIDs: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, didInfo)
}

// ValidateDisplayID validates a display ID format and availability
func (h *Handler) ValidateDisplayID(c *gin.Context) {
	displayID := c.Query("display_id")
	if displayID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "display_id required"})
		return
	}

	valid, available, reason := h.svc.ValidateDisplayID(c.Request.Context(), displayID)
	isPremium := h.svc.IsPremiumDisplayID(displayID)

	c.JSON(http.StatusOK, gin.H{
		"valid":      valid,
		"available":  available,
		"reason":     reason,
		"is_premium": isPremium,
	})
}

// GetOffChainDID returns an off-chain DID by display ID
func (h *Handler) GetOffChainDID(c *gin.Context) {
	displayID := c.Param("display_id")
	if displayID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "display_id required"})
		return
	}

	offChainDID, err := h.svc.GetOffChainDIDByDisplayID(c.Request.Context(), displayID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get off-chain DID: " + err.Error()})
		return
	}

	if offChainDID == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "DID not found"})
		return
	}

	c.JSON(http.StatusOK, offChainDID)
}

// ============ DID Transfer Handlers ============

type ListDIDForTransferRequest struct {
	DisplayID    string  `json:"display_id" binding:"required"`
	Price        float64 `json:"price" binding:"required"`
	PaymentToken string  `json:"payment_token" binding:"required"`
}

// ListDIDForTransfer lists a DID for transfer
func (h *Handler) ListDIDForTransfer(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req ListDIDForTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	listing, err := h.svc.ListDIDForTransfer(c.Request.Context(), walletAddress, req.DisplayID, req.Price, req.PaymentToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list DID: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, listing)
}

// CancelDIDTransferListing cancels a DID transfer listing
func (h *Handler) CancelDIDTransferListing(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	displayID := c.Param("display_id")
	if displayID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "display_id required"})
		return
	}

	if err := h.svc.CancelDIDTransferListing(c.Request.Context(), walletAddress, displayID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel listing: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Listing cancelled"})
}

// GetDIDTransferListings returns active transfer listings
func (h *Handler) GetDIDTransferListings(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	listings, total, err := h.svc.GetDIDTransferListings(c.Request.Context(), page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get listings: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"listings":    listings,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": (total + pageSize - 1) / pageSize,
	})
}

// ============ Premium DID Auction Handlers ============

// GetActiveAuctions returns premium DID auctions (supports status filter: "active", "sold", "all")
func (h *Handler) GetActiveAuctions(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	tier := c.Query("tier")
	auctionType := c.Query("auction_type")
	status := c.DefaultQuery("status", "all")

	auctions, err := h.svc.GetActiveAuctions(c.Request.Context(), page, pageSize, tier, auctionType, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get auctions: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, auctions)
}

// GetAuction returns a specific auction by ID
func (h *Handler) GetAuction(c *gin.Context) {
	auctionID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid auction ID"})
		return
	}

	auction, err := h.svc.GetAuction(c.Request.Context(), auctionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get auction: " + err.Error()})
		return
	}

	if auction == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Auction not found"})
		return
	}

	c.JSON(http.StatusOK, auction)
}

// GetAuctionBids returns bids for an auction
func (h *Handler) GetAuctionBids(c *gin.Context) {
	auctionID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid auction ID"})
		return
	}

	bids, err := h.svc.GetAuctionBids(c.Request.Context(), auctionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get bids: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, bids)
}

type RecordBidRequest struct {
	AuctionID  int64   `json:"auction_id" binding:"required"`
	Amount     float64 `json:"amount" binding:"required"`
	TxHash     string  `json:"tx_hash" binding:"required"`
	NewEndTime *int64  `json:"new_end_time,omitempty"`
}

// RecordBid records a bid for an auction
func (h *Handler) RecordBid(c *gin.Context) {
	walletAddress := middleware.GetWalletAddress(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req RecordBidRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	bid, err := h.svc.RecordBid(c.Request.Context(), req.AuctionID, walletAddress, req.Amount, req.TxHash, req.NewEndTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record bid: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, bid)
}

// FinalizeAuctionSync syncs auction finalization from chain to backend
type FinalizeAuctionSyncRequest struct {
	AuctionID     int64  `json:"auction_id" binding:"required"`
	WinnerWallet  string `json:"winner_wallet" binding:"required"`
	FinalPrice    float64 `json:"final_price" binding:"required"`
	DisplayID     string `json:"display_id" binding:"required"`
	OffChainDIDHash string `json:"off_chain_did_hash"`
	OnChainDIDHash  string `json:"on_chain_did_hash"`
	TxHash        string `json:"tx_hash" binding:"required"`
}

func (h *Handler) FinalizeAuctionSync(c *gin.Context) {
	var req FinalizeAuctionSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.svc.FinalizeAuctionSync(c.Request.Context(), req.AuctionID, req.WinnerWallet, req.FinalPrice, req.DisplayID, req.OffChainDIDHash, req.OnChainDIDHash, req.TxHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync auction finalization: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Auction finalized successfully"})
}

// GetPremiumDIDStats returns statistics for premium DIDs
func (h *Handler) GetPremiumDIDStats(c *gin.Context) {
	stats, err := h.svc.GetPremiumDIDStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get stats: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetAvailablePremiumDIDs returns premium DIDs available for purchase
func (h *Handler) GetAvailablePremiumDIDs(c *gin.Context) {
	tier := c.Query("tier")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	dids, total, err := h.svc.GetAvailablePremiumDIDs(c.Request.Context(), tier, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get premium DIDs: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"dids":        dids,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": (total + pageSize - 1) / pageSize,
	})
}

// ============ Admin Premium DID Handlers ============

type CreatePremiumDIDRequest struct {
	DisplayID string `json:"display_id" binding:"required"`
	Tier      int    `json:"tier" binding:"required"`
}

// CreatePremiumDID creates a premium DID (admin only)
func (h *Handler) CreatePremiumDID(c *gin.Context) {
	var req CreatePremiumDIDRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	premiumDID, err := h.svc.CreatePremiumDID(c.Request.Context(), req.DisplayID, model.DIDTier(req.Tier))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create premium DID: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, premiumDID)
}

type CreatePremiumDIDsBatchRequest struct {
	DIDs []struct {
		DisplayID string `json:"display_id"`
		Tier      int    `json:"tier"`
	} `json:"dids" binding:"required"`
}

// CreatePremiumDIDsBatch creates multiple premium DIDs (admin only)
func (h *Handler) CreatePremiumDIDsBatch(c *gin.Context) {
	var req CreatePremiumDIDsBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, failed, err := h.svc.CreatePremiumDIDsBatch(c.Request.Context(), req.DIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create premium DIDs: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"created": created,
		"failed":  failed,
	})
}

type CreateAuctionRequest struct {
	DisplayID    string  `json:"display_id" binding:"required"`
	AuctionType  int     `json:"auction_type"`
	StartPrice   float64 `json:"start_price" binding:"required"`
	MinIncrement float64 `json:"min_increment"`
	Duration     int     `json:"duration"` // in hours
	PaymentToken string  `json:"payment_token" binding:"required"`
}

// CreateAuction creates an auction for a premium DID (admin only)
func (h *Handler) CreateAuction(c *gin.Context) {
	var req CreateAuctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	auction, err := h.svc.CreateAuction(c.Request.Context(), req.DisplayID, model.AuctionType(req.AuctionType), req.StartPrice, req.MinIncrement, req.Duration, req.PaymentToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create auction: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, auction)
}

// SyncShortIdAuction syncs a user-created short ID auction from chain to backend
type SyncShortIdAuctionRequest struct {
	DisplayID     string `json:"display_id" binding:"required"`
	ChainAuctionID int64  `json:"chain_auction_id" binding:"required"`
	StartPrice    float64 `json:"start_price" binding:"required"`
	PaymentToken  string `json:"payment_token" binding:"required"`
	TxHash        string `json:"tx_hash" binding:"required"`
}

func (h *Handler) SyncShortIdAuction(c *gin.Context) {
	var req SyncShortIdAuctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	walletAddress := middleware.GetWalletAddress(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Wallet required"})
		return
	}

	auction, err := h.svc.SyncShortIdAuction(c.Request.Context(), req.DisplayID, req.ChainAuctionID, req.StartPrice, req.PaymentToken, req.TxHash, walletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync auction: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, auction)
}

// CancelAuction cancels an auction (admin only)
func (h *Handler) CancelAuction(c *gin.Context) {
	auctionID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid auction ID"})
		return
	}

	if err := h.svc.CancelAuction(c.Request.Context(), auctionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel auction: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Auction cancelled"})
}
