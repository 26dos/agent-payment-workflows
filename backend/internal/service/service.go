package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/clawpay/backend/internal/model"
	"github.com/clawpay/backend/internal/repository"
)

type Service struct {
	repo *repository.Repository
}

func New(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ============ User Service ============

func (s *Service) GetOrCreateUser(ctx context.Context, walletAddress string) (*model.User, error) {
	user, err := s.repo.GetUserByWallet(ctx, walletAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if user != nil {
		return user, nil
	}

	// Create new user
	user = &model.User{
		WalletAddress: walletAddress,
		HumanScore:    75, // Initial score
		Metadata:      "{}",
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

func (s *Service) GetUserByWallet(ctx context.Context, walletAddress string) (*model.User, error) {
	return s.repo.GetUserByWallet(ctx, walletAddress)
}

func (s *Service) UpdateUserDID(ctx context.Context, walletAddress, did string) error {
	return s.repo.UpdateUserDID(ctx, walletAddress, did)
}

// ============ Agent Service ============

func (s *Service) CreateAgent(ctx context.Context, userID int64, name string) (*model.Agent, error) {
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

func (s *Service) AcceptTaskWithProvider(ctx context.Context, taskID int64, providerDID string) error {
	return s.repo.UpdateTaskProvider(ctx, taskID, providerDID)
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
