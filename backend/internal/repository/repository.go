package repository

import (
	"context"
	"fmt"

	"github.com/clawpay/backend/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ============ User Repository ============

func (r *Repository) CreateUser(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (wallet_address, did, human_score, metadata)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query, user.WalletAddress, user.DID, user.HumanScore, user.Metadata).
		Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
}

func (r *Repository) GetUserByWallet(ctx context.Context, walletAddress string) (*model.User, error) {
	query := `SELECT id, wallet_address, did, human_score, metadata, created_at, updated_at FROM users WHERE LOWER(wallet_address) = LOWER($1)`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, walletAddress).Scan(
		&user.ID, &user.WalletAddress, &user.DID, &user.HumanScore, &user.Metadata, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (r *Repository) GetUserByDID(ctx context.Context, did string) (*model.User, error) {
	query := `SELECT id, wallet_address, did, human_score, metadata, created_at, updated_at FROM users WHERE did = $1`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, did).Scan(
		&user.ID, &user.WalletAddress, &user.DID, &user.HumanScore, &user.Metadata, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (r *Repository) UpdateUserDID(ctx context.Context, walletAddress, did string) error {
	query := `UPDATE users SET did = $1, updated_at = NOW() WHERE LOWER(wallet_address) = LOWER($2)`
	_, err := r.db.Exec(ctx, query, did, walletAddress)
	return err
}

func (r *Repository) UpdateUserScore(ctx context.Context, did string, score int) error {
	query := `UPDATE users SET human_score = $1, updated_at = NOW() WHERE did = $2`
	_, err := r.db.Exec(ctx, query, score, did)
	return err
}

// ============ Agent Repository ============

func (r *Repository) CreateAgent(ctx context.Context, agent *model.Agent) error {
	query := `
		INSERT INTO agents (user_id, name, sub_did, agent_score, daily_limit, single_limit, mandate_expiry, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		agent.UserID, agent.Name, agent.SubDID, agent.AgentScore,
		agent.DailyLimit, agent.SingleLimit, agent.MandateExpiry, agent.Status,
	).Scan(&agent.ID, &agent.CreatedAt, &agent.UpdatedAt)
}

func (r *Repository) GetAgentsByUserID(ctx context.Context, userID int64) ([]*model.Agent, error) {
	query := `
		SELECT id, user_id, name, sub_did, agent_score, daily_limit, single_limit, mandate_expiry, status, created_at, updated_at
		FROM agents WHERE user_id = $1 ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []*model.Agent
	for rows.Next() {
		agent := &model.Agent{}
		err := rows.Scan(
			&agent.ID, &agent.UserID, &agent.Name, &agent.SubDID, &agent.AgentScore,
			&agent.DailyLimit, &agent.SingleLimit, &agent.MandateExpiry, &agent.Status,
			&agent.CreatedAt, &agent.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		agents = append(agents, agent)
	}
	return agents, nil
}

func (r *Repository) GetAgentByID(ctx context.Context, id int64) (*model.Agent, error) {
	query := `
		SELECT id, user_id, name, sub_did, agent_score, daily_limit, single_limit, mandate_expiry, status, created_at, updated_at
		FROM agents WHERE id = $1
	`
	agent := &model.Agent{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&agent.ID, &agent.UserID, &agent.Name, &agent.SubDID, &agent.AgentScore,
		&agent.DailyLimit, &agent.SingleLimit, &agent.MandateExpiry, &agent.Status,
		&agent.CreatedAt, &agent.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return agent, err
}

func (r *Repository) GetAgentByDID(ctx context.Context, did string) (*model.Agent, error) {
	query := `
		SELECT id, user_id, name, sub_did, agent_score, daily_limit, single_limit, mandate_expiry, status, created_at, updated_at
		FROM agents WHERE sub_did = $1
	`
	agent := &model.Agent{}
	err := r.db.QueryRow(ctx, query, did).Scan(
		&agent.ID, &agent.UserID, &agent.Name, &agent.SubDID, &agent.AgentScore,
		&agent.DailyLimit, &agent.SingleLimit, &agent.MandateExpiry, &agent.Status,
		&agent.CreatedAt, &agent.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return agent, err
}

func (r *Repository) UpdateAgentMandate(ctx context.Context, agentID int64, dailyLimit, singleLimit float64, expiry interface{}) error {
	query := `UPDATE agents SET daily_limit = $1, single_limit = $2, mandate_expiry = $3, updated_at = NOW() WHERE id = $4`
	_, err := r.db.Exec(ctx, query, dailyLimit, singleLimit, expiry, agentID)
	return err
}

func (r *Repository) UpdateAgentDID(ctx context.Context, agentID int64, subDID string) error {
	query := `UPDATE agents SET sub_did = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, subDID, agentID)
	return err
}

func (r *Repository) UpdateAgentScore(ctx context.Context, did string, score int) error {
	query := `UPDATE agents SET agent_score = $1, updated_at = NOW() WHERE sub_did = $2`
	_, err := r.db.Exec(ctx, query, score, did)
	return err
}

// ============ Task Repository ============

func (r *Repository) CreateTask(ctx context.Context, task *model.Task) error {
	query := `
		INSERT INTO tasks (chain_task_id, requester_did, provider_did, title, description, base_amount, final_amount, insurance_premium, complexity, status, metadata, tx_hash, batch_id, expiry_time)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, created_at
	`
	return r.db.QueryRow(ctx, query,
		task.ChainTaskID, task.RequesterDID, task.ProviderDID, task.Title, task.Description,
		task.BaseAmount, task.FinalAmount, task.InsurancePremium,
		task.Complexity, task.Status, task.Metadata, task.TxHash, task.BatchID, task.ExpiryTime,
	).Scan(&task.ID, &task.CreatedAt)
}

func (r *Repository) GetTaskByID(ctx context.Context, id int64) (*model.Task, error) {
	query := `
		SELECT id, chain_task_id, requester_did, provider_did, COALESCE(title, ''), COALESCE(description, ''), base_amount, final_amount, insurance_premium,
		       complexity, status, metadata, tx_hash, batch_id, created_at, accepted_at, completed_at, expiry_time
		FROM tasks WHERE id = $1
	`
	task := &model.Task{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&task.ID, &task.ChainTaskID, &task.RequesterDID, &task.ProviderDID, &task.Title, &task.Description,
		&task.BaseAmount, &task.FinalAmount, &task.InsurancePremium,
		&task.Complexity, &task.Status, &task.Metadata, &task.TxHash, &task.BatchID,
		&task.CreatedAt, &task.AcceptedAt, &task.CompletedAt, &task.ExpiryTime,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return task, err
}

func (r *Repository) GetTasksByDID(ctx context.Context, did string, asRequester bool, limit, offset int) ([]*model.Task, error) {
	var query string
	if asRequester {
		query = `
			SELECT id, chain_task_id, requester_did, provider_did, COALESCE(title, ''), COALESCE(description, ''), base_amount, final_amount, insurance_premium,
			       complexity, status, metadata, tx_hash, batch_id, created_at, accepted_at, completed_at, expiry_time
			FROM tasks WHERE requester_did = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
		`
	} else {
		query = `
			SELECT id, chain_task_id, requester_did, provider_did, COALESCE(title, ''), COALESCE(description, ''), base_amount, final_amount, insurance_premium,
			       complexity, status, metadata, tx_hash, batch_id, created_at, accepted_at, completed_at, expiry_time
			FROM tasks WHERE provider_did = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
		`
	}

	rows, err := r.db.Query(ctx, query, did, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*model.Task
	for rows.Next() {
		task := &model.Task{}
		err := rows.Scan(
			&task.ID, &task.ChainTaskID, &task.RequesterDID, &task.ProviderDID, &task.Title, &task.Description,
			&task.BaseAmount, &task.FinalAmount, &task.InsurancePremium,
			&task.Complexity, &task.Status, &task.Metadata, &task.TxHash, &task.BatchID,
			&task.CreatedAt, &task.AcceptedAt, &task.CompletedAt, &task.ExpiryTime,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}

func (r *Repository) UpdateTaskStatus(ctx context.Context, taskID int64, status model.TaskStatus) error {
	query := `UPDATE tasks SET status = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, status, taskID)
	return err
}

func (r *Repository) UpdateTaskAccepted(ctx context.Context, taskID int64) error {
	query := `UPDATE tasks SET status = 'accepted', accepted_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, taskID)
	return err
}

func (r *Repository) UpdateTaskCompleted(ctx context.Context, taskID int64) error {
	query := `UPDATE tasks SET status = 'completed', completed_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, taskID)
	return err
}

func (r *Repository) UpdateTaskChainID(ctx context.Context, taskID int64, chainTaskID int64, txHash string) error {
	query := `UPDATE tasks SET chain_task_id = $1, tx_hash = $2 WHERE id = $3`
	_, err := r.db.Exec(ctx, query, chainTaskID, txHash, taskID)
	return err
}

// ============ Dispute Repository ============

func (r *Repository) CreateDispute(ctx context.Context, dispute *model.Dispute) error {
	query := `
		INSERT INTO disputes (task_id, raised_by_did, reason, resolved)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`
	return r.db.QueryRow(ctx, query, dispute.TaskID, dispute.RaisedByDID, dispute.Reason, dispute.Resolved).
		Scan(&dispute.ID, &dispute.CreatedAt)
}

func (r *Repository) GetDisputeByTaskID(ctx context.Context, taskID int64) (*model.Dispute, error) {
	query := `
		SELECT id, task_id, raised_by_did, reason, requester_percent, resolved, created_at, resolved_at
		FROM disputes WHERE task_id = $1
	`
	dispute := &model.Dispute{}
	err := r.db.QueryRow(ctx, query, taskID).Scan(
		&dispute.ID, &dispute.TaskID, &dispute.RaisedByDID, &dispute.Reason,
		&dispute.RequesterPercent, &dispute.Resolved, &dispute.CreatedAt, &dispute.ResolvedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return dispute, err
}

func (r *Repository) ResolveDispute(ctx context.Context, taskID int64, requesterPercent int) error {
	query := `UPDATE disputes SET resolved = true, requester_percent = $1, resolved_at = NOW() WHERE task_id = $2`
	_, err := r.db.Exec(ctx, query, requesterPercent, taskID)
	return err
}

// ============ Activity Log Repository ============

func (r *Repository) CreateActivityLog(ctx context.Context, log *model.ActivityLog) error {
	query := `
		INSERT INTO activity_logs (task_id, agent_did, action, details)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`
	return r.db.QueryRow(ctx, query, log.TaskID, log.AgentDID, log.Action, log.Details).
		Scan(&log.ID, &log.CreatedAt)
}

func (r *Repository) GetActivityLogsByTaskID(ctx context.Context, taskID int64) ([]*model.ActivityLog, error) {
	query := `
		SELECT id, task_id, agent_did, action, details, created_at
		FROM activity_logs WHERE task_id = $1 ORDER BY created_at ASC
	`
	rows, err := r.db.Query(ctx, query, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*model.ActivityLog
	for rows.Next() {
		log := &model.ActivityLog{}
		err := rows.Scan(&log.ID, &log.TaskID, &log.AgentDID, &log.Action, &log.Details, &log.CreatedAt)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}
	return logs, nil
}

// ============ Dashboard Stats ============

func (r *Repository) GetDashboardStats(ctx context.Context, userID int64) (*model.DashboardStats, error) {
	stats := &model.DashboardStats{}

	// Get user's DID (may be null/empty)
	var did *string
	err := r.db.QueryRow(ctx, `SELECT did FROM users WHERE id = $1`, userID).Scan(&did)
	if err != nil && err != pgx.ErrNoRows {
		return nil, err
	}

	// Get agent count
	err = r.db.QueryRow(ctx, `SELECT COUNT(*) FROM agents WHERE user_id = $1`, userID).Scan(&stats.TotalAgents)
	if err != nil {
		return nil, err
	}

	// Get agent DIDs (only non-null ones)
	rows, err := r.db.Query(ctx, `SELECT sub_did FROM agents WHERE user_id = $1 AND sub_did IS NOT NULL AND sub_did != ''`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agentDIDs []string
	for rows.Next() {
		var agentDID string
		if err := rows.Scan(&agentDID); err != nil {
			return nil, err
		}
		if agentDID != "" {
			agentDIDs = append(agentDIDs, agentDID)
		}
	}

	// If no DIDs to query, return early with zero stats
	if len(agentDIDs) == 0 {
		return stats, nil
	}

	// Build query for tasks by any of user's agents
	query := `
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status = 'completed') as completed,
			COUNT(*) FILTER (WHERE status IN ('created', 'accepted')) as active,
			COUNT(*) FILTER (WHERE status = 'disputed') as disputed,
			COALESCE(SUM(final_amount), 0) as total_volume,
			COALESCE(AVG(final_amount), 0) as avg_cost
		FROM tasks 
		WHERE requester_did = ANY($1) OR provider_did = ANY($1)
	`

	err = r.db.QueryRow(ctx, query, agentDIDs).Scan(
		&stats.TotalTasks,
		&stats.CompletedTasks,
		&stats.ActiveTasks,
		&stats.DisputedTasks,
		&stats.TotalVolume,
		&stats.AverageTaskCost,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get task stats: %w", err)
	}

	if stats.TotalTasks > 0 {
		stats.SuccessRate = float64(stats.CompletedTasks) / float64(stats.TotalTasks) * 100
	}

	return stats, nil
}

// ============ Public API Repository ============

// GetPublicTasks returns all open tasks (status=created, no provider assigned)
func (r *Repository) GetPublicTasks(ctx context.Context, limit, offset int) ([]*model.Task, error) {
	query := `
		SELECT id, chain_task_id, requester_did, provider_did, COALESCE(title, ''), COALESCE(description, ''), base_amount, final_amount, insurance_premium,
		       complexity, status, metadata, tx_hash, batch_id, created_at, accepted_at, completed_at, expiry_time
		FROM tasks 
		WHERE status = 'created'
		ORDER BY created_at DESC 
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*model.Task
	for rows.Next() {
		task := &model.Task{}
		err := rows.Scan(
			&task.ID, &task.ChainTaskID, &task.RequesterDID, &task.ProviderDID, &task.Title, &task.Description,
			&task.BaseAmount, &task.FinalAmount, &task.InsurancePremium,
			&task.Complexity, &task.Status, &task.Metadata, &task.TxHash, &task.BatchID,
			&task.CreatedAt, &task.AcceptedAt, &task.CompletedAt, &task.ExpiryTime,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}

// GetPublicTasksCount returns total count of open tasks
func (r *Repository) GetPublicTasksCount(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM tasks WHERE status = 'created'`).Scan(&count)
	return count, err
}

// GetPublicAgents returns all agents with their stats
func (r *Repository) GetPublicAgents(ctx context.Context, limit, offset int) ([]*model.Agent, error) {
	query := `
		SELECT id, user_id, name, sub_did, agent_score, daily_limit, single_limit, mandate_expiry, status,
		       COALESCE(tasks_created, 0), COALESCE(tasks_completed, 0), COALESCE(total_earned, 0),
		       created_at, updated_at
		FROM agents 
		WHERE sub_did IS NOT NULL AND sub_did != ''
		ORDER BY agent_score DESC, created_at DESC 
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []*model.Agent
	for rows.Next() {
		agent := &model.Agent{}
		err := rows.Scan(
			&agent.ID, &agent.UserID, &agent.Name, &agent.SubDID, &agent.AgentScore,
			&agent.DailyLimit, &agent.SingleLimit, &agent.MandateExpiry, &agent.Status,
			&agent.TasksCreated, &agent.TasksCompleted, &agent.TotalEarned,
			&agent.CreatedAt, &agent.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		agents = append(agents, agent)
	}
	return agents, nil
}

// GetPublicAgentsCount returns total count of public agents
func (r *Repository) GetPublicAgentsCount(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM agents WHERE sub_did IS NOT NULL AND sub_did != ''`).Scan(&count)
	return count, err
}

// UpdateTaskProvider sets the provider when someone accepts a task
func (r *Repository) UpdateTaskProvider(ctx context.Context, taskID int64, providerDID string) error {
	query := `UPDATE tasks SET provider_did = $1, status = 'accepted', accepted_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, providerDID, taskID)
	return err
}

// ============ Batch Chain Repository ============

// GetPendingChainTasks returns tasks that need to be chained
// Only excludes tasks that have actually been linked on-chain (chain_task_id IS NOT NULL)
// Tasks with batch_id but no chain_task_id are included (failed or pending batch)
func (r *Repository) GetPendingChainTasks(ctx context.Context) ([]*model.Task, error) {
	query := `
		SELECT id, chain_task_id, requester_did, provider_did, COALESCE(title, ''), COALESCE(description, ''), base_amount, final_amount, insurance_premium,
		       complexity, status, metadata, tx_hash, batch_id, created_at, accepted_at, completed_at, expiry_time
		FROM tasks 
		WHERE chain_task_id IS NULL
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*model.Task
	for rows.Next() {
		task := &model.Task{}
		err := rows.Scan(
			&task.ID, &task.ChainTaskID, &task.RequesterDID, &task.ProviderDID, &task.Title, &task.Description,
			&task.BaseAmount, &task.FinalAmount, &task.InsurancePremium,
			&task.Complexity, &task.Status, &task.Metadata, &task.TxHash, &task.BatchID,
			&task.CreatedAt, &task.AcceptedAt, &task.CompletedAt, &task.ExpiryTime,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}

// GetPendingChainTasksCount returns count of tasks pending chain
func (r *Repository) GetPendingChainTasksCount(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM tasks WHERE chain_task_id IS NULL`).Scan(&count)
	return count, err
}

// UpdateTasksBatch marks tasks as batched
func (r *Repository) UpdateTasksBatch(ctx context.Context, taskIDs []int64, batchID string) error {
	query := `UPDATE tasks SET batch_id = $1 WHERE id = ANY($2)`
	_, err := r.db.Exec(ctx, query, batchID, taskIDs)
	return err
}

// GetBatchChainConfig gets the batch config
func (r *Repository) GetBatchChainConfig(ctx context.Context) (*model.BatchChainConfig, error) {
	query := `SELECT id, task_count, interval_minutes, auto_enabled, last_batch_at, updated_at FROM batch_chain_config LIMIT 1`
	config := &model.BatchChainConfig{}
	err := r.db.QueryRow(ctx, query).Scan(
		&config.ID, &config.TaskCount, &config.IntervalMinutes, &config.AutoEnabled, &config.LastBatchAt, &config.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return config, err
}

// UpdateBatchChainConfig updates the batch config
func (r *Repository) UpdateBatchChainConfig(ctx context.Context, config *model.BatchChainConfig) error {
	query := `UPDATE batch_chain_config SET task_count = $1, interval_minutes = $2, auto_enabled = $3, updated_at = NOW() WHERE id = $4`
	_, err := r.db.Exec(ctx, query, config.TaskCount, config.IntervalMinutes, config.AutoEnabled, config.ID)
	return err
}

// UpdateBatchLastRun updates the last batch run time
func (r *Repository) UpdateBatchLastRun(ctx context.Context) error {
	query := `UPDATE batch_chain_config SET last_batch_at = NOW(), updated_at = NOW()`
	_, err := r.db.Exec(ctx, query)
	return err
}
