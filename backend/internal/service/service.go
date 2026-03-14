package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"math"
	"math/big"
	"strings"
	"time"

	"github.com/clawpay/backend/internal/model"
	"github.com/clawpay/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo *repository.Repository
}

func New(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ============ User Service ============

func (s *Service) GetOrCreateUser(ctx context.Context, walletAddress string) (*model.User, error) {
	user, _, err := s.GetOrCreateUserWithInvite(ctx, walletAddress, "")
	return user, err
}

func (s *Service) GetOrCreateUserWithInvite(ctx context.Context, walletAddress, inviteCode string) (*model.User, bool, error) {
	user, err := s.repo.GetUserByWallet(ctx, walletAddress)
	if err != nil {
		return nil, false, fmt.Errorf("failed to get user: %w", err)
	}

	if user != nil {
		return user, false, nil
	}

	// Create new user with wallet
	user = &model.User{
		WalletAddress: &walletAddress,
		AuthType:      model.AuthTypeWallet,
		HumanScore:    75, // Initial score
		Metadata:      "{}",
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, false, fmt.Errorf("failed to create user: %w", err)
	}

	// Process invite code if provided
	if inviteCode != "" {
		_ = s.ProcessInviteCode(ctx, user.ID, inviteCode)
	}

	return user, true, nil
}

func (s *Service) GetUserByWallet(ctx context.Context, walletAddress string) (*model.User, error) {
	return s.repo.GetUserByWallet(ctx, walletAddress)
}

func (s *Service) GetUserByEmail(ctx context.Context, email string) (*model.User, error) {
	return s.repo.GetUserByEmail(ctx, email)
}

func (s *Service) UpdateUserDID(ctx context.Context, walletAddress, did string) error {
	return s.repo.UpdateUserDID(ctx, walletAddress, did)
}

// ============ Email Auth Service ============

// CreateVerificationCode creates and stores a verification code for email
func (s *Service) CreateVerificationCode(ctx context.Context, email, codeType string) (string, error) {
	// Generate 6-digit code
	code, err := generateVerificationCode(6)
	if err != nil {
		return "", err
	}

	verification := &model.EmailVerificationCode{
		Email:     email,
		Code:      code,
		Type:      codeType,
		ExpiresAt: time.Now().Add(10 * time.Minute), // Code expires in 10 minutes
	}

	if err := s.repo.CreateVerificationCode(ctx, verification); err != nil {
		return "", err
	}

	return code, nil
}

// VerifyCode verifies a verification code
func (s *Service) VerifyCode(ctx context.Context, email, code, codeType string) (bool, error) {
	verification, err := s.repo.GetVerificationCode(ctx, email, code, codeType)
	if err != nil {
		return false, err
	}

	if verification == nil {
		return false, nil
	}

	if verification.Used {
		return false, nil
	}

	if verification.IsExpired() {
		return false, nil
	}

	// Mark code as used
	if err := s.repo.MarkVerificationCodeUsed(ctx, verification.ID); err != nil {
		return false, err
	}

	return true, nil
}

// CreateEmailUser creates a new user with email authentication
func (s *Service) CreateEmailUser(ctx context.Context, email, password, displayID string) (*model.User, error) {
	return s.CreateEmailUserWithInvite(ctx, email, password, displayID, "")
}

// CreateEmailUserWithInvite creates a new user with email authentication and optional invite code
func (s *Service) CreateEmailUserWithInvite(ctx context.Context, email, password, displayID, inviteCode string) (*model.User, error) {
	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	passwordHashStr := string(passwordHash)

	// Generate DID for the user
	didHash := fmt.Sprintf("0x%x", sha256.Sum256([]byte(email+time.Now().String())))

	user := &model.User{
		Email:         &email,
		PasswordHash:  &passwordHashStr,
		AuthType:      model.AuthTypeEmail,
		EmailVerified: true, // Verified via code
		DID:           didHash,
		HumanScore:    60, // Lower initial score for email users
		Metadata:      "{}",
	}

	// Set display ID if provided
	if displayID != "" {
		// Validate display ID format
		valid, _, reason := s.ValidateDisplayID(ctx, displayID)
		if !valid {
			return nil, fmt.Errorf("invalid display ID: %s", reason)
		}
		user.DisplayID = &displayID
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Process invite code if provided
	if inviteCode != "" {
		_ = s.ProcessInviteCode(ctx, user.ID, inviteCode)
	}

	return user, nil
}

// GetOrCreateGoogleUser creates or gets a user from Google OAuth
func (s *Service) GetOrCreateGoogleUser(ctx context.Context, email, googleID string) (*model.User, error) {
	return s.GetOrCreateGoogleUserWithInvite(ctx, email, googleID, "")
}

// GetOrCreateGoogleUserWithInvite creates or gets a user from Google OAuth with optional invite code
func (s *Service) GetOrCreateGoogleUserWithInvite(ctx context.Context, email, googleID, inviteCode string) (*model.User, error) {
	// Try to find existing user by email
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if user != nil {
		return user, nil
	}

	// Create new user with Google auth
	didHash := fmt.Sprintf("0x%x", sha256.Sum256([]byte(email+googleID+time.Now().String())))

	user = &model.User{
		Email:         &email,
		AuthType:      model.AuthTypeEmail, // Use email auth type for Google users
		EmailVerified: true,                // Google emails are pre-verified
		DID:           didHash,
		HumanScore:    70, // Moderate initial score for Google users
		Metadata:      fmt.Sprintf(`{"google_id":"%s"}`, googleID),
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Process invite code if provided
	if inviteCode != "" {
		_ = s.ProcessInviteCode(ctx, user.ID, inviteCode)
	}

	return user, nil
}

// ValidateEmailLogin validates email/password login
func (s *Service) ValidateEmailLogin(ctx context.Context, email, password string) (*model.User, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	if user.PasswordHash == nil {
		return nil, fmt.Errorf("password not set")
	}

	// Compare password
	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid password")
	}

	return user, nil
}

// BindWalletToUser binds a wallet address to an email-registered user
func (s *Service) BindWalletToUser(ctx context.Context, email, walletAddress string) (*model.User, error) {
	// Get user by email
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	// Check if wallet is already bound to another user
	existingUser, _ := s.repo.GetUserByWallet(ctx, walletAddress)
	if existingUser != nil && existingUser.ID != user.ID {
		return nil, fmt.Errorf("wallet already bound to another account")
	}

	// Update user's wallet address
	user.WalletAddress = &walletAddress

	if err := s.repo.UpdateUserWallet(ctx, user.ID, walletAddress); err != nil {
		return nil, err
	}

	// If user has a Display ID, create On-Chain DID and link them
	if user.DisplayID != nil && *user.DisplayID != "" {
		// Create On-Chain DID
		onChainDID, err := s.RegisterOnChainDID(ctx, walletAddress)
		if err != nil {
			return nil, fmt.Errorf("failed to create on-chain DID: %w", err)
		}

		// Link Off-Chain DID to On-Chain DID
		offChainDID, err := s.repo.GetOffChainDIDByDisplayID(ctx, *user.DisplayID)
		if err == nil && offChainDID != nil {
			offChainDID.CurrentOwnerOnChainID = &onChainDID.DIDHash
			if err := s.repo.UpdateOffChainDID(ctx, offChainDID); err != nil {
				return nil, fmt.Errorf("failed to link DIDs: %w", err)
			}

			// Also update on-chain DID to link back
			onChainDID.LinkedOffChainID = &offChainDID.DIDHash
			if err := s.repo.UpdateOnChainDID(ctx, onChainDID); err != nil {
				return nil, fmt.Errorf("failed to update on-chain DID: %w", err)
			}
		}
	}

	return user, nil
}

// generateVerificationCode generates a random numeric code
func generateVerificationCode(length int) (string, error) {
	const digits = "0123456789"
	result := make([]byte, length)

	for i := 0; i < length; i++ {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			return "", err
		}
		result[i] = digits[num.Int64()]
	}

	return string(result), nil
}

// ============ Agent Service ============

func (s *Service) CreateAgent(ctx context.Context, userID int64, name string) (*model.Agent, error) {
	exists, err := s.repo.AgentNameExists(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("failed to check agent name: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("agent with name '%s' already exists", name)
	}

	agent := &model.Agent{
		UserID:     userID,
		Name:       name,
		AgentScore: 75, // Initial score
		Status:     "active",
	}

	if err := s.repo.CreateAgent(ctx, agent); err != nil {
		return nil, fmt.Errorf("failed to create agent: %w", err)
	}

	return agent, nil
}

func (s *Service) GetAgentsByUser(ctx context.Context, userID int64) ([]*model.Agent, error) {
	return s.repo.GetAgentsByUserID(ctx, userID)
}

func (s *Service) GetAgentByID(ctx context.Context, agentID int64) (*model.Agent, error) {
	return s.repo.GetAgentByID(ctx, agentID)
}

func (s *Service) UpdateAgentMandate(ctx context.Context, agentID int64, dailyLimit, singleLimit float64, expiry time.Time) error {
	return s.repo.UpdateAgentMandate(ctx, agentID, dailyLimit, singleLimit, expiry)
}

func (s *Service) UpdateAgentDID(ctx context.Context, agentID int64, subDID string) error {
	return s.repo.UpdateAgentDID(ctx, agentID, subDID)
}

// ============ Task Service ============

func (s *Service) CreateTask(ctx context.Context, task *model.Task) error {
	// Calculate final price
	priceCalc := s.CalculatePrice(task.BaseAmount, task.Complexity, 75) // Default score
	task.FinalAmount = priceCalc.FinalPrice
	task.InsurancePremium = priceCalc.InsurancePremium
	task.Status = model.TaskStatusCreated
	task.ExpiryTime = time.Now().Add(7 * 24 * time.Hour) // 7 days default

	return s.repo.CreateTask(ctx, task)
}

func (s *Service) GetTaskByID(ctx context.Context, taskID int64) (*model.Task, error) {
	return s.repo.GetTaskByID(ctx, taskID)
}

func (s *Service) GetTasksByDID(ctx context.Context, did string, asRequester bool, limit, offset int) ([]*model.Task, error) {
	return s.repo.GetTasksByDID(ctx, did, asRequester, limit, offset)
}

func (s *Service) AcceptTask(ctx context.Context, taskID int64) error {
	return s.repo.UpdateTaskAccepted(ctx, taskID)
}

func (s *Service) AcceptTaskWithProvider(ctx context.Context, taskID int64, providerDID string, txHash string) error {
	return s.repo.UpdateTaskProvider(ctx, taskID, providerDID, txHash)
}

func (s *Service) CompleteTask(ctx context.Context, taskID int64) error {
	return s.repo.UpdateTaskCompleted(ctx, taskID)
}

func (s *Service) CancelTask(ctx context.Context, taskID int64) error {
	return s.repo.UpdateTaskStatus(ctx, taskID, model.TaskStatusCancelled)
}

func (s *Service) UpdateTaskChainID(ctx context.Context, taskID int64, chainTaskID int64, txHash string) error {
	return s.repo.UpdateTaskChainID(ctx, taskID, chainTaskID, txHash)
}

// ============ Dispute Service ============

func (s *Service) RaiseDispute(ctx context.Context, taskID int64, raisedByDID, reason string) error {
	// Update task status
	if err := s.repo.UpdateTaskStatus(ctx, taskID, model.TaskStatusDisputed); err != nil {
		return err
	}

	// Create dispute record
	dispute := &model.Dispute{
		TaskID:      taskID,
		RaisedByDID: raisedByDID,
		Reason:      reason,
		Resolved:    false,
	}

	return s.repo.CreateDispute(ctx, dispute)
}

func (s *Service) ResolveDispute(ctx context.Context, taskID int64, requesterPercent int) error {
	// Update dispute
	if err := s.repo.ResolveDispute(ctx, taskID, requesterPercent); err != nil {
		return err
	}

	// Update task status
	return s.repo.UpdateTaskStatus(ctx, taskID, model.TaskStatusResolved)
}

func (s *Service) GetDisputeByTaskID(ctx context.Context, taskID int64) (*model.Dispute, error) {
	return s.repo.GetDisputeByTaskID(ctx, taskID)
}

// ============ Activity Log Service ============

func (s *Service) LogActivity(ctx context.Context, taskID int64, agentDID, action string, details []byte) error {
	log := &model.ActivityLog{
		TaskID:   taskID,
		AgentDID: agentDID,
		Action:   action,
		Details:  details,
	}
	return s.repo.CreateActivityLog(ctx, log)
}

func (s *Service) GetActivityLogs(ctx context.Context, taskID int64) ([]*model.ActivityLog, error) {
	return s.repo.GetActivityLogsByTaskID(ctx, taskID)
}

// ============ Dashboard Service ============

func (s *Service) GetDashboardStats(ctx context.Context, userID int64) (*model.DashboardStats, error) {
	return s.repo.GetDashboardStats(ctx, userID)
}

// ============ Pricing Service ============

// CalculatePrice implements the dynamic pricing formula
// Total_Cost = Base_Fee × K_Reputation × K_Complexity × K_SupplyDemand
func (s *Service) CalculatePrice(baseFee float64, complexity int, reputationScore int) *model.PriceCalculation {
	// K_Reputation based on score
	var kReputation float64
	switch {
	case reputationScore >= 90:
		kReputation = 0.8 // Premium discount
	case reputationScore >= 60:
		kReputation = 1.0 // Normal
	case reputationScore >= 40:
		kReputation = 1.2 // Risk penalty
	default:
		kReputation = 1.5 // Critical penalty
	}

	// K_Complexity based on task complexity
	var kComplexity float64
	switch complexity {
	case 1:
		kComplexity = 1.0 // L1 Simple
	case 2:
		kComplexity = 1.5 // L2 Medium
	case 3:
		kComplexity = 2.5 // L3 Complex
	default:
		kComplexity = 1.0
	}

	// K_SupplyDemand - simplified, would need real queue data
	kSupplyDemand := 1.0 // Normal

	// Calculate final price
	finalPrice := baseFee * kReputation * kComplexity * kSupplyDemand

	// Calculate insurance premium (only if reputation < 1.0)
	var insurancePremium float64
	if kReputation > 1.0 {
		penaltyAmount := baseFee * (kReputation - 1.0)
		insurancePremium = penaltyAmount / 2 // 50% of penalty goes to premium
	}

	return &model.PriceCalculation{
		BaseFee:          baseFee,
		FinalPrice:       math.Round(finalPrice*1e6) / 1e6, // Round to 6 decimals
		KReputation:      kReputation,
		KComplexity:      kComplexity,
		KSupplyDemand:    kSupplyDemand,
		InsurancePremium: math.Round(insurancePremium*1e6) / 1e6,
	}
}

// CalculateFinalScore computes weighted reputation score
// Final_Score = (Human_Score × 0.7) + (Agent_Score × 0.3)
func (s *Service) CalculateFinalScore(humanScore, agentScore int) int {
	return int(float64(humanScore)*0.7 + float64(agentScore)*0.3)
}

// ============ Public API Service ============

func (s *Service) GetPublicTasks(ctx context.Context, limit, offset int) ([]*model.Task, error) {
	return s.repo.GetPublicTasks(ctx, limit, offset)
}

func (s *Service) GetPublicTasksCount(ctx context.Context) (int, error) {
	return s.repo.GetPublicTasksCount(ctx)
}

func (s *Service) GetPublicAgents(ctx context.Context, limit, offset int) ([]*model.Agent, error) {
	return s.repo.GetPublicAgents(ctx, limit, offset)
}

func (s *Service) GetPublicAgentsCount(ctx context.Context) (int, error) {
	return s.repo.GetPublicAgentsCount(ctx)
}

// ============ Batch Chain Service ============

func (s *Service) GetPendingChainTasks(ctx context.Context) ([]*model.Task, error) {
	return s.repo.GetPendingChainTasks(ctx)
}

func (s *Service) GetPendingChainTasksCount(ctx context.Context) (int, error) {
	return s.repo.GetPendingChainTasksCount(ctx)
}

func (s *Service) GetBatchChainConfig(ctx context.Context) (*model.BatchChainConfig, error) {
	return s.repo.GetBatchChainConfig(ctx)
}

func (s *Service) UpdateBatchChainConfig(ctx context.Context, config *model.BatchChainConfig) error {
	// Get existing config to preserve ID
	existing, err := s.repo.GetBatchChainConfig(ctx)
	if err != nil {
		return err
	}
	if existing != nil {
		config.ID = existing.ID
	}
	return s.repo.UpdateBatchChainConfig(ctx, config)
}

// TriggerBatchChain batches tasks for on-chain processing
func (s *Service) TriggerBatchChain(ctx context.Context, taskIDs []int64) (string, error) {
	var tasks []*model.Task
	var err error

	if len(taskIDs) > 0 {
		// Get specific tasks
		tasks = make([]*model.Task, 0, len(taskIDs))
		for _, id := range taskIDs {
			task, err := s.repo.GetTaskByID(ctx, id)
			if err != nil {
				return "", fmt.Errorf("failed to get task %d: %w", id, err)
			}
			if task != nil && task.ChainTaskID == nil && task.BatchID == nil {
				tasks = append(tasks, task)
			}
		}
	} else {
		// Get all pending tasks
		tasks, err = s.repo.GetPendingChainTasks(ctx)
		if err != nil {
			return "", fmt.Errorf("failed to get pending tasks: %w", err)
		}
	}

	if len(tasks) == 0 {
		return "", fmt.Errorf("no tasks to batch")
	}

	// Generate batch ID
	batchID := fmt.Sprintf("batch_%d_%d", time.Now().Unix(), len(tasks))

	// Collect task IDs
	ids := make([]int64, len(tasks))
	for i, t := range tasks {
		ids[i] = t.ID
	}

	// Update tasks with batch ID
	if err := s.repo.UpdateTasksBatch(ctx, ids, batchID); err != nil {
		return "", fmt.Errorf("failed to update tasks batch: %w", err)
	}

	// Update last batch time
	s.repo.UpdateBatchLastRun(ctx)

	return batchID, nil
}

// MarkTasksOnChain marks tasks as recorded on-chain with the transaction hash
func (s *Service) MarkTasksOnChain(ctx context.Context, taskIDs []int64, txHash string) error {
	return s.repo.MarkTasksOnChain(ctx, taskIDs, txHash)
}

// ============ Auto Arbitration Service ============

// AutoArbitrationResult contains the result of an auto-arbitration
type AutoArbitrationResult struct {
	TaskID           int64
	RequesterPercent int
	Reason           string
}

// RunAutoArbitration checks for disputes that should be auto-resolved
// Rules:
// 1. Dispute timeout (3 days) - non-responding party loses
// 2. Task completion timeout (7 days after acceptance) - requester wins
// 3. Provider not delivering - requester wins
func (s *Service) RunAutoArbitration(ctx context.Context) ([]AutoArbitrationResult, error) {
	var results []AutoArbitrationResult

	// Get all disputed tasks
	disputedTasks, err := s.repo.GetTasksByStatus(ctx, model.TaskStatusDisputed)
	if err != nil {
		return nil, fmt.Errorf("failed to get disputed tasks: %w", err)
	}

	disputeTimeout := 5 * time.Minute // 5 minutes for demo (production: 3 days)

	for _, task := range disputedTasks {
		dispute, err := s.repo.GetDisputeByTaskID(ctx, task.ID)
		if err != nil || dispute == nil || dispute.Resolved {
			continue
		}

		// Check if dispute has timed out
		if time.Since(dispute.CreatedAt) > disputeTimeout {
			var requesterPercent int
			var reason string

			// Determine winner based on who raised the dispute
			if dispute.RaisedByDID == task.RequesterDID {
				// Requester raised, provider didn't respond - requester wins
				requesterPercent = 100
				reason = "Provider timeout - no response"
			} else {
				// Provider raised, requester didn't respond - provider wins
				requesterPercent = 0
				reason = "Requester timeout - no response"
			}

			// Auto-resolve the dispute
			if err := s.ResolveDispute(ctx, task.ID, requesterPercent); err != nil {
				continue
			}

			results = append(results, AutoArbitrationResult{
				TaskID:           task.ID,
				RequesterPercent: requesterPercent,
				Reason:           reason,
			})
		}
	}

	// Check for overdue accepted tasks (not completed within timeout)
	completionTimeout := 5 * time.Minute // 5 minutes for demo (production: 7 days)
	acceptedTasks, err := s.repo.GetTasksByStatus(ctx, model.TaskStatusAccepted)
	if err != nil {
		return results, fmt.Errorf("failed to get accepted tasks: %w", err)
	}

	for _, task := range acceptedTasks {
		if task.AcceptedAt == nil {
			continue
		}

		// Check if task completion has timed out
		if time.Since(*task.AcceptedAt) > completionTimeout {
			// Provider failed to complete - auto-resolve in favor of requester
			reason := "Provider completion timeout"

			// Create a dispute record for tracking
			_ = s.RaiseDispute(ctx, task.ID, task.RequesterDID, reason)

			// Immediately resolve in favor of requester
			if err := s.ResolveDispute(ctx, task.ID, 100); err != nil {
				continue
			}

			results = append(results, AutoArbitrationResult{
				TaskID:           task.ID,
				RequesterPercent: 100,
				Reason:           reason,
			})
		}
	}

	return results, nil
}

// GetTasksByStatus returns tasks with a specific status
func (s *Service) GetTasksByStatus(ctx context.Context, status model.TaskStatus) ([]*model.Task, error) {
	return s.repo.GetTasksByStatus(ctx, status)
}

// ============ Incentive System Service ============

// GetHumanIncentive returns incentive data for a human DID
func (s *Service) GetHumanIncentive(ctx context.Context, humanDID string) (*model.HumanIncentive, error) {
	return s.repo.GetHumanIncentive(ctx, humanDID)
}

// GetAgentIncentive returns incentive data for an agent DID
func (s *Service) GetAgentIncentive(ctx context.Context, agentDID string) (*model.AgentIncentive, error) {
	return s.repo.GetAgentIncentive(ctx, agentDID)
}

// GetIncentiveSummary returns a summary of all incentives for a human DID
func (s *Service) GetIncentiveSummary(ctx context.Context, humanDID string) (*model.IncentiveSummary, error) {
	human, err := s.repo.GetHumanIncentive(ctx, humanDID)
	if err != nil {
		return nil, err
	}

	agents, err := s.repo.GetAgentIncentivesByHuman(ctx, humanDID)
	if err != nil {
		return nil, err
	}

	var humanPoints int64 = 0
	var totalAgentPoints int64 = 0
	var kycLevel model.KYCLevel = 0
	var inviteCount int = 0
	var blacklisted bool = false

	if human != nil {
		humanPoints = human.TotalPoints
		kycLevel = human.KYCLevel
		inviteCount = human.InviteCount
		blacklisted = human.Blacklisted
	}

	agentIncentives := make([]model.AgentIncentive, len(agents))
	for i, a := range agents {
		agentIncentives[i] = *a
		totalAgentPoints += a.TotalPoints
	}

	return &model.IncentiveSummary{
		HumanDID:         humanDID,
		HumanPoints:      humanPoints,
		TotalAgentPoints: totalAgentPoints,
		TotalPoints:      humanPoints + totalAgentPoints,
		KYCLevel:         kycLevel,
		InviteCount:      inviteCount,
		Blacklisted:      blacklisted,
		Agents:           agentIncentives,
	}, nil
}

// ClaimHumanRegistrationBonus claims the registration bonus for a human DID
func (s *Service) ClaimHumanRegistrationBonus(ctx context.Context, humanDID string, inviteCode *string) (*model.HumanIncentive, error) {
	constants := model.GetDefaultIncentiveConstants()

	// Check if already registered
	existing, err := s.repo.GetHumanIncentive(ctx, humanDID)
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.Registered {
		return existing, fmt.Errorf("already registered")
	}

	incentive := &model.HumanIncentive{
		HumanDID:           humanDID,
		RegistrationPoints: constants.HumanRegistrationPoints,
		TotalPoints:        constants.HumanRegistrationPoints,
		Registered:         true,
	}

	// Handle referral
	if inviteCode != nil && *inviteCode != "" {
		inviter, err := s.repo.GetHumanIncentiveByInviteCode(ctx, *inviteCode)
		if err == nil && inviter != nil && !inviter.Blacklisted {
			incentive.InvitedBy = &inviter.HumanDID
			incentive.TotalPoints += constants.HumanReferralInviteePoints

			// Update inviter
			inviter.ReferralPoints += constants.HumanReferralInviterPoints
			inviter.TotalPoints += constants.HumanReferralInviterPoints
			inviter.InviteCount++
			s.repo.UpdateHumanIncentive(ctx, inviter)

			// Record referral
			s.repo.CreateReferralRecord(ctx, &model.ReferralRecord{
				InviterDID: inviter.HumanDID,
				InviteeDID: humanDID,
				InviteCode: *inviteCode,
			})
		}
	}

	if existing != nil {
		incentive.ID = existing.ID
		if err := s.repo.UpdateHumanIncentive(ctx, incentive); err != nil {
			return nil, err
		}
	} else {
		if err := s.repo.CreateHumanIncentive(ctx, incentive); err != nil {
			return nil, err
		}
	}

	return incentive, nil
}

// ClaimAgentRegistrationBonus claims the registration bonus for an agent DID
func (s *Service) ClaimAgentRegistrationBonus(ctx context.Context, agentDID, humanDID string) (*model.AgentIncentive, error) {
	constants := model.GetDefaultIncentiveConstants()

	// Check if already registered
	existing, err := s.repo.GetAgentIncentive(ctx, agentDID)
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.Registered {
		return existing, fmt.Errorf("already registered")
	}

	incentive := &model.AgentIncentive{
		AgentDID:           agentDID,
		HumanDID:           humanDID,
		RegistrationPoints: constants.AgentRegistrationPoints,
		TotalPoints:        constants.AgentRegistrationPoints,
		Registered:         true,
	}

	if existing != nil {
		incentive.ID = existing.ID
		if err := s.repo.UpdateAgentIncentive(ctx, incentive); err != nil {
			return nil, err
		}
	} else {
		if err := s.repo.CreateAgentIncentive(ctx, incentive); err != nil {
			return nil, err
		}
	}

	return incentive, nil
}

// GenerateInviteCode generates an invite code for a human DID
func (s *Service) GenerateInviteCode(ctx context.Context, humanDID string) (string, error) {
	incentive, err := s.repo.GetHumanIncentive(ctx, humanDID)
	if err != nil {
		return "", err
	}
	if incentive == nil || !incentive.Registered {
		return "", fmt.Errorf("must be registered to generate invite code")
	}
	if incentive.Blacklisted {
		return "", fmt.Errorf("blacklisted accounts cannot generate invite codes")
	}

	// Generate unique code
	code := fmt.Sprintf("0x%x%d", humanDID[:16], time.Now().UnixNano())

	incentive.InviteCode = &code
	if err := s.repo.UpdateHumanIncentive(ctx, incentive); err != nil {
		return "", err
	}

	return code, nil
}

// RecordTaskCompletion records a task completion for incentive points
func (s *Service) RecordTaskCompletion(ctx context.Context, agentDID string, taskID int64) (*model.AgentIncentive, error) {
	constants := model.GetDefaultIncentiveConstants()

	incentive, err := s.repo.GetAgentIncentive(ctx, agentDID)
	if err != nil {
		return nil, err
	}
	if incentive == nil {
		return nil, fmt.Errorf("agent not registered in incentive system")
	}

	// Check max total points
	if incentive.TaskPoints >= constants.MaxTotalAgentTaskPoints {
		return incentive, nil // Already at max
	}

	// Check daily limit
	today := time.Now().Format("2006-01-02")
	if incentive.LastTaskDay != nil && *incentive.LastTaskDay == today {
		if incentive.DailyTaskPoints >= constants.MaxDailyTaskPoints {
			return incentive, nil // Daily limit reached
		}
	} else {
		// New day, reset daily counter
		incentive.DailyTaskPoints = 0
		incentive.LastTaskDay = &today
	}

	// Add points
	pointsToAdd := constants.TaskCompletionPoints
	if incentive.TaskPoints+pointsToAdd > constants.MaxTotalAgentTaskPoints {
		pointsToAdd = constants.MaxTotalAgentTaskPoints - incentive.TaskPoints
	}

	incentive.TaskPoints += pointsToAdd
	incentive.TotalPoints += pointsToAdd
	incentive.DailyTaskPoints++

	if err := s.repo.UpdateAgentIncentive(ctx, incentive); err != nil {
		return nil, err
	}

	return incentive, nil
}

// GetReferralLeaderboard returns top referrers
func (s *Service) GetReferralLeaderboard(ctx context.Context, limit int) ([]*model.HumanIncentive, error) {
	return s.repo.GetTopReferrers(ctx, limit)
}

// GetPointsLeaderboard returns top point earners
func (s *Service) GetPointsLeaderboard(ctx context.Context, limit int, includeAgents bool) (interface{}, error) {
	if includeAgents {
		return s.repo.GetTopAgentPoints(ctx, limit)
	}
	return s.repo.GetTopHumanPoints(ctx, limit)
}

// ============ Task Specification Service ============

// CreateTaskSpecification creates a task specification
func (s *Service) CreateTaskSpecification(ctx context.Context, spec *model.TaskSpecification) error {
	return s.repo.CreateTaskSpecification(ctx, spec)
}

// GetTaskSpecification returns the specification for a task
func (s *Service) GetTaskSpecification(ctx context.Context, taskID int64) (*model.TaskSpecification, error) {
	return s.repo.GetTaskSpecification(ctx, taskID)
}

// SubmitTaskResult submits a result for a task
func (s *Service) SubmitTaskResult(ctx context.Context, result *model.TaskResult) error {
	return s.repo.CreateTaskResult(ctx, result)
}

// GetTaskResult returns the result for a task
func (s *Service) GetTaskResult(ctx context.Context, taskID int64) (*model.TaskResult, error) {
	return s.repo.GetTaskResult(ctx, taskID)
}

// ValidateProvider validates if a provider meets task requirements
func (s *Service) ValidateProvider(ctx context.Context, taskID int64, providerDID string) (bool, string, error) {
	spec, err := s.repo.GetTaskSpecification(ctx, taskID)
	if err != nil {
		return false, "", err
	}
	if spec == nil {
		return true, "", nil // No specification, all providers accepted
	}

	// Check reputation score
	// In production, this would query the on-chain ReputationScore contract
	// For now, we use a default score or look up in the agents table
	agentScore := 60 // Default

	if agentScore < spec.MinReputationScore {
		return false, fmt.Sprintf("reputation score %d below minimum %d", agentScore, spec.MinReputationScore), nil
	}

	// Check KYC if required
	if spec.RequiresKYC {
		agentIncentive, _ := s.repo.GetAgentIncentive(ctx, providerDID)
		if agentIncentive == nil {
			return false, "agent not registered in incentive system", nil
		}
		humanIncentive, _ := s.repo.GetHumanIncentive(ctx, agentIncentive.HumanDID)
		if humanIncentive == nil || humanIncentive.KYCLevel < spec.MinKYCLevel {
			return false, fmt.Sprintf("KYC level insufficient (need level %d)", spec.MinKYCLevel), nil
		}
	}

	// Check acceptance deadline
	if time.Now().After(spec.AcceptanceDeadline) {
		return false, "acceptance period ended", nil
	}

	return true, "", nil
}

// ============ Dual DID System Service ============

// RegisterOnChainDID registers an on-chain DID for a wallet
func (s *Service) RegisterOnChainDID(ctx context.Context, walletAddress string) (*model.OnChainDID, error) {
	return s.RegisterOnChainDIDWithHash(ctx, walletAddress, "")
}

// RegisterOnChainDIDWithHash registers an on-chain DID with an optional pre-computed hash
func (s *Service) RegisterOnChainDIDWithHash(ctx context.Context, walletAddress, didHash string) (*model.OnChainDID, error) {
	// Check if already registered
	existing, err := s.repo.GetOnChainDIDByWallet(ctx, walletAddress)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		// Update with new hash if provided and different
		if didHash != "" && existing.DIDHash != didHash {
			existing.DIDHash = didHash
			if err := s.repo.UpdateOnChainDID(ctx, existing); err != nil {
				return nil, err
			}
		}
		return existing, nil // Already registered
	}

	// Generate DID hash if not provided
	if didHash == "" {
		didHash = fmt.Sprintf("0x%x", sha256.Sum256([]byte(walletAddress+time.Now().String())))
	}

	onChainDID := &model.OnChainDID{
		DIDHash:       didHash,
		WalletAddress: walletAddress,
		Active:        true,
		CreatedAt:     time.Now(),
	}

	if err := s.repo.CreateOnChainDID(ctx, onChainDID); err != nil {
		return nil, err
	}

	return onChainDID, nil
}

// RegisterOffChainDID registers an off-chain display DID
func (s *Service) RegisterOffChainDID(ctx context.Context, walletAddress, displayID string) (*model.OffChainDID, error) {
	// Check if user already has a display ID
	user, err := s.repo.GetUserByWallet(ctx, walletAddress)
	if err != nil {
		return nil, err
	}
	if user != nil && user.DisplayID != nil && *user.DisplayID != "" {
		return nil, fmt.Errorf("user already has a Human DID: %s", *user.DisplayID)
	}

	// Validate display ID format
	valid, _, reason := s.ValidateDisplayID(ctx, displayID)
	if !valid {
		return nil, fmt.Errorf(reason)
	}

	// Check if this is a premium ID (requires auction, cannot register directly)
	if s.IsPremiumDisplayID(displayID) {
		return nil, fmt.Errorf("this Display ID requires auction. 4-character IDs and repeating patterns (like AAAAA, 11111) must be acquired through auction")
	}

	// Generate DID hash
	didHash := fmt.Sprintf("0x%x", sha256.Sum256([]byte(displayID)))

	offChainDID := &model.OffChainDID{
		DisplayID:         displayID,
		DIDHash:           didHash,
		Tier:              model.DIDTierNormal,
		IsSystemGenerated: false,
		Active:            true,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	// Check if user has on-chain DID to link
	onChainDID, _ := s.repo.GetOnChainDIDByWallet(ctx, walletAddress)
	if onChainDID != nil {
		if onChainDID.LinkedOffChainID != nil {
			return nil, fmt.Errorf("already has an off-chain DID linked to on-chain DID")
		}
		offChainDID.CurrentOwnerOnChainID = &onChainDID.DIDHash
	}

	if err := s.repo.CreateOffChainDID(ctx, offChainDID); err != nil {
		return nil, err
	}

	// Link to on-chain DID if exists
	if onChainDID != nil {
		onChainDID.LinkedOffChainID = &offChainDID.DIDHash
		if err := s.repo.UpdateOnChainDID(ctx, onChainDID); err != nil {
			return nil, err
		}
	}

	// Update user's display_id to enforce one DID per user
	if user != nil {
		if err := s.repo.UpdateUserDisplayID(ctx, user.ID, displayID); err != nil {
			return nil, fmt.Errorf("failed to update user display ID: %w", err)
		}
	}

	return offChainDID, nil
}

// CompleteRegistration registers both on-chain and off-chain DIDs
func (s *Service) CompleteRegistration(ctx context.Context, walletAddress, displayID string) (*model.UserDIDInfo, error) {
	// Register on-chain DID
	onChainDID, err := s.RegisterOnChainDID(ctx, walletAddress)
	if err != nil {
		return nil, err
	}

	// Register off-chain DID
	offChainDID, err := s.RegisterOffChainDID(ctx, walletAddress, displayID)
	if err != nil {
		return nil, err
	}

	return &model.UserDIDInfo{
		OnChainDID:  onChainDID,
		OffChainDID: offChainDID,
		HasOnChain:  true,
		HasOffChain: true,
	}, nil
}

// GetUserDIDInfo returns the DID info for a user
func (s *Service) GetUserDIDInfo(ctx context.Context, walletAddress string) (*model.UserDIDInfo, error) {
	info := &model.UserDIDInfo{}

	onChainDID, err := s.repo.GetOnChainDIDByWallet(ctx, walletAddress)
	if err != nil {
		return nil, err
	}

	if onChainDID != nil {
		info.OnChainDID = onChainDID
		info.HasOnChain = true

		if onChainDID.LinkedOffChainID != nil {
			offChainDID, err := s.repo.GetOffChainDIDByHash(ctx, *onChainDID.LinkedOffChainID)
			if err != nil {
				return nil, err
			}
			if offChainDID != nil {
				info.OffChainDID = offChainDID
				info.HasOffChain = true
			}
		}
	}

	// Also check user's display_id field for off-chain DID (in case not linked to on-chain)
	if !info.HasOffChain {
		user, err := s.repo.GetUserByWallet(ctx, walletAddress)
		if err == nil && user != nil && user.DisplayID != nil && *user.DisplayID != "" {
			offChainDID, err := s.repo.GetOffChainDIDByDisplayID(ctx, *user.DisplayID)
			if err == nil && offChainDID != nil {
				info.OffChainDID = offChainDID
				info.HasOffChain = true
			}
		}
	}

	return info, nil
}

// GetUserDIDInfoByEmail returns DID info for an email user
func (s *Service) GetUserDIDInfoByEmail(ctx context.Context, email string) (*model.UserDIDInfo, error) {
	info := &model.UserDIDInfo{}

	// Get user by email
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil || user == nil {
		return info, nil
	}

	// Check if user has a wallet and thus on-chain DID
	if user.WalletAddress != nil && *user.WalletAddress != "" {
		onChainDID, err := s.repo.GetOnChainDIDByWallet(ctx, *user.WalletAddress)
		if err == nil && onChainDID != nil {
			info.OnChainDID = onChainDID
			info.HasOnChain = true
		}
	}

	// Check if user has display_id set
	if user.DisplayID != nil && *user.DisplayID != "" {
		offChainDID, err := s.repo.GetOffChainDIDByDisplayID(ctx, *user.DisplayID)
		if err == nil && offChainDID != nil {
			info.OffChainDID = offChainDID
			info.HasOffChain = true
		}
	}

	return info, nil
}

// RegisterOffChainDIDByEmail registers an off-chain DID for an email user
func (s *Service) RegisterOffChainDIDByEmail(ctx context.Context, email, displayID string) (*model.OffChainDID, error) {
	// Get user
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil || user == nil {
		return nil, fmt.Errorf("user not found")
	}

	// Check if user already has a display ID (one Human DID per user)
	if user.DisplayID != nil && *user.DisplayID != "" {
		return nil, fmt.Errorf("user already has a Human DID: %s", *user.DisplayID)
	}

	// Validate display ID format
	valid, _, reason := s.ValidateDisplayID(ctx, displayID)
	if !valid {
		return nil, fmt.Errorf(reason)
	}

	// Check if this is a premium ID (requires auction, cannot register directly)
	if s.IsPremiumDisplayID(displayID) {
		return nil, fmt.Errorf("this Display ID requires auction. 4-character IDs and repeating patterns (like AAAAA, 11111) must be acquired through auction")
	}

	// Generate DID hash
	didHash := fmt.Sprintf("0x%x", sha256.Sum256([]byte(displayID)))

	// Create off-chain DID
	offChainDID := &model.OffChainDID{
		DisplayID:             displayID,
		DIDHash:               didHash,
		Tier:                  model.DIDTierNormal,
		IsSystemGenerated:     false,
		Active:                true,
	}

	if err := s.repo.CreateOffChainDID(ctx, offChainDID); err != nil {
		return nil, fmt.Errorf("failed to create off-chain DID: %w", err)
	}

	// Update user's display_id
	if err := s.repo.UpdateUserDisplayID(ctx, user.ID, displayID); err != nil {
		return nil, fmt.Errorf("failed to update user display ID: %w", err)
	}

	return offChainDID, nil
}

// isRepeatingPattern checks if a string consists of all the same character (豹子号)
func isRepeatingPattern(s string) bool {
	if len(s) < 2 {
		return false
	}
	firstChar := s[0]
	for i := 1; i < len(s); i++ {
		if s[i] != firstChar {
			return false
		}
	}
	return true
}

// ValidateDisplayID validates a display ID format and availability
// Returns: (valid, available, reason)
// Rules:
// - 6+ chars: Free registration (unless repeating pattern)
// - 5 chars: Requires 3 successful invites, system assigns randomly
// - 1-4 chars: Requires auction
// - Repeating patterns (豹子号): Requires auction regardless of length
func (s *Service) ValidateDisplayID(ctx context.Context, displayID string) (bool, bool, string) {
	// Check length
	if len(displayID) == 0 {
		return false, false, "Display ID cannot be empty"
	}
	if len(displayID) > 32 {
		return false, false, "Display ID must be 32 characters or less"
	}
	
	// 1-4 character IDs require auction
	if len(displayID) < 5 {
		return false, false, "Display IDs with 1-4 characters require auction"
	}
	
	// 5 character IDs require 3 invites (cannot be directly registered)
	if len(displayID) == 5 {
		return false, false, "5-character Display IDs require 3 successful invites. Use 6+ characters for free registration"
	}

	// Convert to uppercase for validation
	upperDisplayID := strings.ToUpper(displayID)

	// Validate characters: only A-Z and 0-9 allowed
	for _, c := range upperDisplayID {
		if !((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
			return false, false, "Display ID can only contain letters (A-Z) and digits (0-9)"
		}
	}
	
	// Repeating patterns (豹子号) require auction regardless of length
	if isRepeatingPattern(upperDisplayID) {
		return false, false, "Repeating pattern Display IDs (like AAAAAA) require auction"
	}

	// Check availability
	existing, _ := s.repo.GetOffChainDIDByDisplayID(ctx, upperDisplayID)
	if existing != nil {
		return true, false, "Display ID is already taken"
	}

	// Check blocked list
	blocked, _ := s.repo.IsDisplayIDBlocked(ctx, upperDisplayID)
	if blocked {
		return false, false, "Display ID is blocked"
	}

	return true, true, ""
}

// IsPremiumDisplayID checks if a display ID requires auction (premium)
// Premium IDs: 1-4 characters OR any repeating patterns (豹子号) like 11111, AAAAAA
func (s *Service) IsPremiumDisplayID(displayID string) bool {
	upperDisplayID := strings.ToUpper(displayID)
	
	// 1-4 characters require auction
	if len(upperDisplayID) >= 1 && len(upperDisplayID) <= 4 {
		return true
	}
	
	// Repeating patterns (豹子号) require auction regardless of length
	if isRepeatingPattern(upperDisplayID) {
		return true
	}
	
	return false
}

// IsFiveDigitEligible checks if a display ID is 5 digits (requires invite reward)
func (s *Service) IsFiveDigitEligible(displayID string) bool {
	return len(displayID) == 5
}

// GetUserInviteProgress returns the user's invite progress and claim status
func (s *Service) GetUserInviteProgress(ctx context.Context, walletAddress string) (int, bool, error) {
	user, err := s.repo.GetUserByWallet(ctx, walletAddress)
	if err != nil {
		return 0, false, err
	}
	if user == nil {
		return 0, false, nil
	}

	inviteCount := 0
	claimed := false

	if user.SuccessfulInvites != nil {
		inviteCount = *user.SuccessfulInvites
	}
	if user.FiveDigitDIDClaimed != nil {
		claimed = *user.FiveDigitDIDClaimed
	}

	return inviteCount, claimed, nil
}

// GetUserInviteProgressByEmail returns invite progress for email users
func (s *Service) GetUserInviteProgressByEmail(ctx context.Context, email string) (int, bool, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return 0, false, err
	}
	if user == nil {
		return 0, false, nil
	}

	inviteCount := 0
	claimed := false

	if user.SuccessfulInvites != nil {
		inviteCount = *user.SuccessfulInvites
	}
	if user.FiveDigitDIDClaimed != nil {
		claimed = *user.FiveDigitDIDClaimed
	}

	return inviteCount, claimed, nil
}

// ClaimFiveDigitDID claims a random 5-digit DID for a user who has successful invites
// This replaces any existing DID with a new 5-digit one
func (s *Service) ClaimFiveDigitDID(ctx context.Context, walletAddress string) (*model.OffChainDID, error) {
	// Check user eligibility
	user, err := s.repo.GetUserByWallet(ctx, walletAddress)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}
	
	// Check if already claimed 5-digit reward
	if user.FiveDigitDIDClaimed != nil && *user.FiveDigitDIDClaimed {
		return nil, fmt.Errorf("5-digit DID reward already claimed")
	}
	
	// Check invite count (currently 1 for testing, change to 3 for production)
	inviteCount := 0
	if user.SuccessfulInvites != nil {
		inviteCount = *user.SuccessfulInvites
	}
	if inviteCount < 1 {
		return nil, fmt.Errorf("need 1 successful invite to claim 5-digit DID. Current: %d/1", inviteCount)
	}
	
	// If user already has a DID, deactivate the old one
	if user.DisplayID != nil && *user.DisplayID != "" {
		oldDID, _ := s.repo.GetOffChainDIDByDisplayID(ctx, *user.DisplayID)
		if oldDID != nil {
			oldDID.Active = false
			oldDID.UpdatedAt = time.Now()
			_ = s.repo.UpdateOffChainDID(ctx, oldDID)
		}
	}
	
	// Generate a random 5-digit DID
	displayID, err := s.GenerateRandomFiveDigitDID(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to generate 5-digit DID: %w", err)
	}
	
	// Create the off-chain DID
	didHash := fmt.Sprintf("0x%x", sha256.Sum256([]byte(displayID)))
	
	offChainDID := &model.OffChainDID{
		DisplayID:         displayID,
		DIDHash:           didHash,
		Tier:              model.DIDTierNormal,
		IsSystemGenerated: false,
		Active:            true,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	
	// Link to on-chain DID if exists
	onChainDID, _ := s.repo.GetOnChainDIDByWallet(ctx, walletAddress)
	if onChainDID != nil {
		offChainDID.CurrentOwnerOnChainID = &onChainDID.DIDHash
	}
	
	if err := s.repo.CreateOffChainDID(ctx, offChainDID); err != nil {
		return nil, err
	}
	
	// Link to on-chain DID if exists
	if onChainDID != nil {
		onChainDID.LinkedOffChainID = &offChainDID.DIDHash
		if err := s.repo.UpdateOnChainDID(ctx, onChainDID); err != nil {
			return nil, err
		}
	}
	
	// Update user with new display ID (replaces old one)
	if err := s.repo.UpdateUserDisplayID(ctx, user.ID, displayID); err != nil {
		return nil, err
	}
	
	// Mark as claimed
	if err := s.repo.MarkFiveDigitDIDClaimed(ctx, user.ID); err != nil {
		return nil, err
	}
	
	return offChainDID, nil
}

// ClaimFiveDigitDIDByEmail claims a random 5-digit DID for an email user
func (s *Service) ClaimFiveDigitDIDByEmail(ctx context.Context, email string) (*model.OffChainDID, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}
	
	// Check if already claimed 5-digit reward
	if user.FiveDigitDIDClaimed != nil && *user.FiveDigitDIDClaimed {
		return nil, fmt.Errorf("5-digit DID reward already claimed")
	}
	
	// Check invite count
	inviteCount := 0
	if user.SuccessfulInvites != nil {
		inviteCount = *user.SuccessfulInvites
	}
	if inviteCount < 1 {
		return nil, fmt.Errorf("need 1 successful invite to claim 5-digit DID. Current: %d/1", inviteCount)
	}
	
	// If user already has a DID, deactivate the old one
	if user.DisplayID != nil && *user.DisplayID != "" {
		oldDID, _ := s.repo.GetOffChainDIDByDisplayID(ctx, *user.DisplayID)
		if oldDID != nil {
			oldDID.Active = false
			oldDID.UpdatedAt = time.Now()
			_ = s.repo.UpdateOffChainDID(ctx, oldDID)
		}
	}
	
	// Generate a random 5-digit DID
	displayID, err := s.GenerateRandomFiveDigitDID(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to generate 5-digit DID: %w", err)
	}
	
	// Create the off-chain DID
	didHash := fmt.Sprintf("0x%x", sha256.Sum256([]byte(displayID)))
	
	offChainDID := &model.OffChainDID{
		DisplayID:         displayID,
		DIDHash:           didHash,
		Tier:              model.DIDTierNormal,
		IsSystemGenerated: false,
		Active:            true,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	
	if err := s.repo.CreateOffChainDID(ctx, offChainDID); err != nil {
		return nil, err
	}
	
	// Update user with new display ID
	if err := s.repo.UpdateUserDisplayID(ctx, user.ID, displayID); err != nil {
		return nil, err
	}
	
	// Mark as claimed
	if err := s.repo.MarkFiveDigitDIDClaimed(ctx, user.ID); err != nil {
		return nil, err
	}
	
	return offChainDID, nil
}

// GenerateRandomFiveDigitDID generates a random available 5-digit DID
func (s *Service) GenerateRandomFiveDigitDID(ctx context.Context) (string, error) {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	
	// Try up to 100 times to find an available DID
	for i := 0; i < 100; i++ {
		// Generate random 5-char string
		result := make([]byte, 5)
		for j := 0; j < 5; j++ {
			result[j] = chars[time.Now().UnixNano()%int64(len(chars))]
			time.Sleep(time.Nanosecond) // Add small delay for better randomness
		}
		displayID := string(result)
		
		// Skip repeating patterns
		if isRepeatingPattern(displayID) {
			continue
		}
		
		// Check if available
		existing, _ := s.repo.GetOffChainDIDByDisplayID(ctx, displayID)
		if existing == nil {
			blocked, _ := s.repo.IsDisplayIDBlocked(ctx, displayID)
			if !blocked {
				return displayID, nil
			}
		}
	}
	
	return "", fmt.Errorf("failed to generate available 5-digit DID after 100 attempts")
}

// IncrementUserInviteCount increments the successful_invites count for a user
func (s *Service) IncrementUserInviteCount(ctx context.Context, inviterWallet string) error {
	return s.repo.IncrementUserInviteCount(ctx, inviterWallet)
}

// GenerateUserInviteCode generates a unique invite code for a user
func (s *Service) GenerateUserInviteCode(ctx context.Context, userID int64) (string, error) {
	// Generate 8-character alphanumeric code
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Excluding confusing chars like 0, O, 1, I
	code := make([]byte, 8)
	for i := 0; i < 8; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", err
		}
		code[i] = chars[n.Int64()]
	}
	inviteCode := string(code)
	
	// Save to database
	if err := s.repo.SetUserInviteCode(ctx, userID, inviteCode); err != nil {
		return "", err
	}
	
	return inviteCode, nil
}

// GetOrCreateInviteCode gets existing invite code or creates a new one
func (s *Service) GetOrCreateInviteCode(ctx context.Context, userID int64, existingCode *string) (string, error) {
	if existingCode != nil && *existingCode != "" {
		return *existingCode, nil
	}
	return s.GenerateUserInviteCode(ctx, userID)
}

// GetUserByInviteCode returns a user by their invite code
func (s *Service) GetUserByInviteCode(ctx context.Context, inviteCode string) (*model.User, error) {
	return s.repo.GetUserByInviteCode(ctx, inviteCode)
}

// ProcessInviteCode processes an invite code during registration
func (s *Service) ProcessInviteCode(ctx context.Context, newUserID int64, inviteCode string) error {
	if inviteCode == "" {
		return nil
	}
	
	// Find inviter
	inviter, err := s.repo.GetUserByInviteCode(ctx, inviteCode)
	if err != nil {
		return err
	}
	if inviter == nil {
		return nil // Invalid invite code, silently ignore
	}
	
	// Set invited_by on new user
	if err := s.repo.SetUserInvitedBy(ctx, newUserID, inviter.ID); err != nil {
		return err
	}
	
	// Increment inviter's successful_invites count
	if inviter.WalletAddress != nil {
		return s.repo.IncrementUserInviteCount(ctx, *inviter.WalletAddress)
	}
	
	// For email users, increment by user ID
	return s.repo.IncrementUserInviteCountByID(ctx, inviter.ID)
}

// GetOffChainDIDByDisplayID returns an off-chain DID by display ID
func (s *Service) GetOffChainDIDByDisplayID(ctx context.Context, displayID string) (*model.OffChainDID, error) {
	return s.repo.GetOffChainDIDByDisplayID(ctx, displayID)
}

// ============ DID Transfer Service ============

// ListDIDForTransfer lists a DID for transfer
func (s *Service) ListDIDForTransfer(ctx context.Context, walletAddress, displayID string, price float64, paymentToken string) (*model.DIDTransferListing, error) {
	// Get off-chain DID
	offChainDID, err := s.repo.GetOffChainDIDByDisplayID(ctx, displayID)
	if err != nil {
		return nil, err
	}
	if offChainDID == nil {
		return nil, fmt.Errorf("off-chain DID not found")
	}

	// Verify ownership
	onChainDID, err := s.repo.GetOnChainDIDByWallet(ctx, walletAddress)
	if err != nil {
		return nil, err
	}
	if onChainDID == nil || offChainDID.CurrentOwnerOnChainID == nil || *offChainDID.CurrentOwnerOnChainID != onChainDID.DIDHash {
		return nil, fmt.Errorf("not the owner of this DID")
	}

	// Check if already listed
	existing, _ := s.repo.GetActiveListingByDIDHash(ctx, offChainDID.DIDHash)
	if existing != nil {
		return nil, fmt.Errorf("DID is already listed for transfer")
	}

	listing := &model.DIDTransferListing{
		OffChainDIDHash: offChainDID.DIDHash,
		SellerWallet:    walletAddress,
		Price:           price,
		PaymentToken:    paymentToken,
		Active:          true,
		ListedAt:        time.Now(),
	}

	if err := s.repo.CreateDIDTransferListing(ctx, listing); err != nil {
		return nil, err
	}

	return listing, nil
}

// CancelDIDTransferListing cancels a DID transfer listing
func (s *Service) CancelDIDTransferListing(ctx context.Context, walletAddress, displayID string) error {
	offChainDID, err := s.repo.GetOffChainDIDByDisplayID(ctx, displayID)
	if err != nil {
		return err
	}
	if offChainDID == nil {
		return fmt.Errorf("off-chain DID not found")
	}

	listing, err := s.repo.GetActiveListingByDIDHash(ctx, offChainDID.DIDHash)
	if err != nil {
		return err
	}
	if listing == nil {
		return fmt.Errorf("no active listing found")
	}
	if listing.SellerWallet != walletAddress {
		return fmt.Errorf("not the seller")
	}

	listing.Active = false
	return s.repo.UpdateDIDTransferListing(ctx, listing)
}

// GetDIDTransferListings returns active transfer listings
func (s *Service) GetDIDTransferListings(ctx context.Context, page, pageSize int) ([]*model.DIDTransferListing, int, error) {
	return s.repo.GetActiveListings(ctx, page, pageSize)
}

// ============ Premium DID Auction Service ============

// GetActiveAuctions returns premium DID auctions (supports status filter)
func (s *Service) GetActiveAuctions(ctx context.Context, page, pageSize int, tier, auctionType, status string) (*model.AuctionListResponse, error) {
	return s.repo.GetActiveAuctions(ctx, page, pageSize, tier, auctionType, status)
}

// GetAuction returns a specific auction
func (s *Service) GetAuction(ctx context.Context, auctionID int64) (*model.PremiumDIDAuction, error) {
	return s.repo.GetAuction(ctx, auctionID)
}

// GetAuctionBids returns bids for an auction
func (s *Service) GetAuctionBids(ctx context.Context, auctionID int64) ([]*model.AuctionBid, error) {
	return s.repo.GetAuctionBids(ctx, auctionID)
}

// RecordBid records a bid for an auction
func (s *Service) RecordBid(ctx context.Context, auctionID int64, bidderWallet string, amount float64, txHash string, newEndTime *int64) (*model.AuctionBid, error) {
	auction, err := s.repo.GetAuction(ctx, auctionID)
	if err != nil {
		return nil, err
	}
	if auction == nil {
		return nil, fmt.Errorf("auction not found")
	}
	if auction.Status != model.AuctionStatusActive {
		return nil, fmt.Errorf("auction is not active")
	}

	bid := &model.AuctionBid{
		AuctionID:    auctionID,
		BidderWallet: bidderWallet,
		Amount:       amount,
		TxHash:       txHash,
		CreatedAt:    time.Now(),
	}

	if err := s.repo.CreateAuctionBid(ctx, bid); err != nil {
		return nil, err
	}

	// Update auction
	auction.CurrentPrice = amount
	auction.HighestBidder = &bidderWallet
	auction.BidCount++
	auction.UpdatedAt = time.Now()

	// Update end time if provided (from chain event)
	if newEndTime != nil {
		auction.EndTime = time.Unix(*newEndTime, 0)
	}

	if err := s.repo.UpdateAuction(ctx, auction); err != nil {
		return nil, err
	}

	return bid, nil
}

// FinalizeAuctionSync syncs auction finalization from chain to backend
func (s *Service) FinalizeAuctionSync(ctx context.Context, auctionID int64, winnerWallet string, finalPrice float64, displayID, offChainDIDHash, onChainDIDHash, txHash string) error {
	// Update auction status
	auction, err := s.repo.GetAuction(ctx, auctionID)
	if err != nil {
		return err
	}
	if auction == nil {
		return fmt.Errorf("auction not found")
	}

	auction.Status = model.AuctionStatusSold
	auction.WinnerWallet = &winnerWallet
	auction.FinalPrice = &finalPrice
	auction.TxHash = &txHash
	auction.UpdatedAt = time.Now()

	if err := s.repo.UpdateAuction(ctx, auction); err != nil {
		return err
	}

	// Generate off-chain DID hash if not provided (keccak256 of displayID)
	if offChainDIDHash == "" {
		offChainDIDHash = fmt.Sprintf("0x%x", sha256.Sum256([]byte(displayID)))
	}

	// Get on-chain DID hash from database based on winner wallet
	onChainDID, _ := s.repo.GetOnChainDIDByWallet(ctx, winnerWallet)
	if onChainDID != nil && onChainDIDHash == "" {
		onChainDIDHash = onChainDID.DIDHash
	}

	// Create off-chain DID record if not exists
	existing, _ := s.repo.GetOffChainDIDByDisplayID(ctx, displayID)
	if existing == nil {
		offChainDID := &model.OffChainDID{
			DisplayID:             displayID,
			DIDHash:               offChainDIDHash,
			Tier:                  auction.Tier,
			IsSystemGenerated:     false,
			CurrentOwnerOnChainID: &onChainDIDHash,
			Active:                true,
			CreatedAt:             time.Now(),
			UpdatedAt:             time.Now(),
		}
		if err := s.repo.CreateOffChainDID(ctx, offChainDID); err != nil {
			return err
		}
	} else {
		// Update existing
		existing.CurrentOwnerOnChainID = &onChainDIDHash
		existing.Active = true
		existing.UpdatedAt = time.Now()
		if err := s.repo.UpdateOffChainDID(ctx, existing); err != nil {
			return err
		}
	}

	// Update on_chain_dids.linked_off_chain_id to link the off-chain DID
	if onChainDID != nil {
		onChainDID.LinkedOffChainID = &offChainDIDHash
		if err := s.repo.UpdateOnChainDID(ctx, onChainDID); err != nil {
			return err
		}
	}

	// Update user's display_id and did
	user, _ := s.repo.GetUserByWallet(ctx, winnerWallet)
	if user != nil {
		if err := s.repo.UpdateUserDisplayID(ctx, user.ID, displayID); err != nil {
			return err
		}
		// Also update user's did field
		if onChainDIDHash != "" {
			if err := s.repo.UpdateUserDID(ctx, winnerWallet, onChainDIDHash); err != nil {
				// Log but don't fail
			}
		}
	}

	return nil
}

// GetPremiumDIDStats returns statistics for premium DIDs
func (s *Service) GetPremiumDIDStats(ctx context.Context) (*model.PremiumDIDStats, error) {
	return s.repo.GetPremiumDIDStats(ctx)
}

// GetAvailablePremiumDIDs returns premium DIDs available for purchase
func (s *Service) GetAvailablePremiumDIDs(ctx context.Context, tier string, page, pageSize int) ([]*model.OffChainDID, int, error) {
	return s.repo.GetAvailablePremiumDIDs(ctx, tier, page, pageSize)
}

// CreatePremiumDID creates a premium DID (admin only)
func (s *Service) CreatePremiumDID(ctx context.Context, displayID string, tier model.DIDTier) (*model.OffChainDID, error) {
	if tier == model.DIDTierNormal {
		return nil, fmt.Errorf("premium DID must have a tier")
	}

	// Check if exists
	existing, _ := s.repo.GetOffChainDIDByDisplayID(ctx, displayID)
	if existing != nil {
		return nil, fmt.Errorf("display ID already exists")
	}

	didHash := fmt.Sprintf("0x%x", sha256.Sum256([]byte(displayID)))

	premiumDID := &model.OffChainDID{
		DisplayID:         displayID,
		DIDHash:           didHash,
		Tier:              tier,
		IsSystemGenerated: true,
		Active:            true,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.CreateOffChainDID(ctx, premiumDID); err != nil {
		return nil, err
	}

	return premiumDID, nil
}

// CreatePremiumDIDsBatch creates multiple premium DIDs
func (s *Service) CreatePremiumDIDsBatch(ctx context.Context, dids []struct {
	DisplayID string `json:"display_id"`
	Tier      int    `json:"tier"`
}) (int, int, error) {
	created := 0
	failed := 0

	for _, did := range dids {
		_, err := s.CreatePremiumDID(ctx, did.DisplayID, model.DIDTier(did.Tier))
		if err != nil {
			failed++
		} else {
			created++
		}
	}

	return created, failed, nil
}

// CreateAuction creates an auction for a premium DID
func (s *Service) CreateAuction(ctx context.Context, displayID string, auctionType model.AuctionType, startPrice, minIncrement float64, duration int, paymentToken string) (*model.PremiumDIDAuction, error) {
	offChainDID, err := s.repo.GetOffChainDIDByDisplayID(ctx, displayID)
	if err != nil {
		return nil, err
	}
	if offChainDID == nil {
		return nil, fmt.Errorf("off-chain DID not found")
	}
	if !offChainDID.IsSystemGenerated {
		return nil, fmt.Errorf("only premium DIDs can be auctioned")
	}
	if offChainDID.CurrentOwnerOnChainID != nil {
		return nil, fmt.Errorf("DID already has an owner")
	}

	// Check if already in auction
	existing, _ := s.repo.GetActiveAuctionByDIDHash(ctx, offChainDID.DIDHash)
	if existing != nil {
		return nil, fmt.Errorf("DID is already in an active auction")
	}

	if duration == 0 {
		duration = 7 * 24 // Default 7 days
	}

	auction := &model.PremiumDIDAuction{
		OffChainDIDHash: offChainDID.DIDHash,
		DisplayID:       displayID,
		Tier:            offChainDID.Tier,
		AuctionType:     auctionType,
		StartPrice:      startPrice,
		CurrentPrice:    startPrice,
		MinIncrement:    minIncrement,
		ReservePrice:    startPrice * 0.2, // 20% floor
		StartTime:       time.Now(),
		EndTime:         time.Now().Add(time.Duration(duration) * time.Hour),
		PaymentToken:    paymentToken,
		Status:          model.AuctionStatusActive,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := s.repo.CreateAuction(ctx, auction); err != nil {
		return nil, err
	}

	return auction, nil
}

// SyncShortIdAuction syncs a user-created short ID auction from chain to backend
func (s *Service) SyncShortIdAuction(ctx context.Context, displayID string, chainAuctionID int64, startPrice float64, paymentToken, txHash, creatorWallet string) (*model.PremiumDIDAuction, error) {
	// Generate DID hash for the short ID
	didHash := fmt.Sprintf("0x%x", sha256.Sum256([]byte("SHORT_AUCTION:"+displayID)))

	// Check if auction already exists
	existing, _ := s.repo.GetAuctionByChainID(ctx, chainAuctionID)
	if existing != nil {
		return existing, nil
	}

	// Determine tier based on length
	length := len(displayID)
	tier := model.DIDTierS // Default to TierS for short IDs

	// Calculate min increment (10% of start price)
	minIncrement := startPrice / 10
	if minIncrement == 0 {
		minIncrement = 1
	}

	now := time.Now()
	auction := &model.PremiumDIDAuction{
		ChainAuctionID:  &chainAuctionID,
		OffChainDIDHash: didHash,
		DisplayID:       displayID,
		Tier:            tier,
		AuctionType:     model.AuctionTypeEnglish,
		StartPrice:      startPrice,
		CurrentPrice:    0,
		MinIncrement:    minIncrement,
		ReservePrice:    startPrice,
		StartTime:       now,
		EndTime:         now.Add(30 * time.Minute),
		PaymentToken:    paymentToken,
		Status:          model.AuctionStatusActive,
		TxHash:          &txHash,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	// Adjust tier based on length (shorter = more valuable)
	if length == 1 {
		auction.Tier = model.DIDTierSSS
	} else if length == 2 {
		auction.Tier = model.DIDTierSS
	} else if length == 3 {
		auction.Tier = model.DIDTierS
	} else {
		auction.Tier = model.DIDTierA
	}

	if err := s.repo.CreateAuction(ctx, auction); err != nil {
		return nil, err
	}

	return auction, nil
}

// CancelAuction cancels an auction
func (s *Service) CancelAuction(ctx context.Context, auctionID int64) error {
	auction, err := s.repo.GetAuction(ctx, auctionID)
	if err != nil {
		return err
	}
	if auction == nil {
		return fmt.Errorf("auction not found")
	}
	if auction.Status != model.AuctionStatusActive {
		return fmt.Errorf("auction cannot be cancelled")
	}

	auction.Status = model.AuctionStatusCancelled
	auction.UpdatedAt = time.Now()

	return s.repo.UpdateAuction(ctx, auction)
}
