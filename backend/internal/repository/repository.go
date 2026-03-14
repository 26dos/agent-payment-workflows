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
		INSERT INTO users (wallet_address, email, password_hash, auth_type, email_verified, did, display_id, human_score, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		user.WalletAddress, user.Email, user.PasswordHash, user.AuthType,
		user.EmailVerified, user.DID, user.DisplayID, user.HumanScore, user.Metadata,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
}

func (r *Repository) GetUserByWallet(ctx context.Context, walletAddress string) (*model.User, error) {
	query := `
		SELECT id, wallet_address, email, password_hash, auth_type, email_verified, did, display_id, human_score, metadata, created_at, updated_at,
		       successful_invites, five_digit_did_claimed, invite_code, invited_by
		FROM users WHERE LOWER(wallet_address) = LOWER($1)
	`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, walletAddress).Scan(
		&user.ID, &user.WalletAddress, &user.Email, &user.PasswordHash, &user.AuthType,
		&user.EmailVerified, &user.DID, &user.DisplayID, &user.HumanScore, &user.Metadata,
		&user.CreatedAt, &user.UpdatedAt,
		&user.SuccessfulInvites, &user.FiveDigitDIDClaimed, &user.InviteCode, &user.InvitedBy,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `
		SELECT id, wallet_address, email, password_hash, auth_type, email_verified, did, display_id, human_score, metadata, created_at, updated_at,
		       successful_invites, five_digit_did_claimed, invite_code, invited_by
		FROM users WHERE LOWER(email) = LOWER($1)
	`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.WalletAddress, &user.Email, &user.PasswordHash, &user.AuthType,
		&user.EmailVerified, &user.DID, &user.DisplayID, &user.HumanScore, &user.Metadata,
		&user.CreatedAt, &user.UpdatedAt,
		&user.SuccessfulInvites, &user.FiveDigitDIDClaimed, &user.InviteCode, &user.InvitedBy,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (r *Repository) GetUserByDID(ctx context.Context, did string) (*model.User, error) {
	query := `
		SELECT id, wallet_address, email, password_hash, auth_type, email_verified, did, display_id, human_score, metadata, created_at, updated_at 
		FROM users WHERE did = $1
	`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, did).Scan(
		&user.ID, &user.WalletAddress, &user.Email, &user.PasswordHash, &user.AuthType,
		&user.EmailVerified, &user.DID, &user.DisplayID, &user.HumanScore, &user.Metadata,
		&user.CreatedAt, &user.UpdatedAt,
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

func (r *Repository) UpdateUserWallet(ctx context.Context, userID int64, walletAddress string) error {
	query := `UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, walletAddress, userID)
	return err
}

func (r *Repository) UpdateUserDisplayID(ctx context.Context, userID int64, displayID string) error {
	query := `UPDATE users SET display_id = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, displayID, userID)
	return err
}

func (r *Repository) IncrementUserInviteCount(ctx context.Context, walletAddress string) error {
	query := `
		UPDATE users 
		SET successful_invites = COALESCE(successful_invites, 0) + 1, updated_at = NOW() 
		WHERE wallet_address = $1
	`
	_, err := r.db.Exec(ctx, query, walletAddress)
	return err
}

func (r *Repository) IncrementUserInviteCountByID(ctx context.Context, userID int64) error {
	query := `
		UPDATE users 
		SET successful_invites = COALESCE(successful_invites, 0) + 1, updated_at = NOW() 
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, userID)
	return err
}

func (r *Repository) MarkFiveDigitDIDClaimed(ctx context.Context, userID int64) error {
	query := `UPDATE users SET five_digit_did_claimed = TRUE, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	return err
}

func (r *Repository) SetUserInviteCode(ctx context.Context, userID int64, inviteCode string) error {
	query := `UPDATE users SET invite_code = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, inviteCode, userID)
	return err
}

func (r *Repository) GetUserByInviteCode(ctx context.Context, inviteCode string) (*model.User, error) {
	query := `SELECT id, wallet_address, email, password_hash, auth_type, email_verified, did, display_id, human_score, successful_invites, five_digit_did_claimed, invite_code, invited_by, metadata, created_at, updated_at FROM users WHERE invite_code = $1`
	row := r.db.QueryRow(ctx, query, inviteCode)

	var user model.User
	err := row.Scan(&user.ID, &user.WalletAddress, &user.Email, &user.PasswordHash, &user.AuthType, &user.EmailVerified, &user.DID, &user.DisplayID, &user.HumanScore, &user.SuccessfulInvites, &user.FiveDigitDIDClaimed, &user.InviteCode, &user.InvitedBy, &user.Metadata, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *Repository) SetUserInvitedBy(ctx context.Context, userID int64, inviterID int64) error {
	query := `UPDATE users SET invited_by = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, inviterID, userID)
	return err
}

// ============ Email Verification Repository ============

func (r *Repository) CreateVerificationCode(ctx context.Context, code *model.EmailVerificationCode) error {
	query := `
		INSERT INTO email_verification_codes (email, code, type, expires_at, used)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`
	return r.db.QueryRow(ctx, query,
		code.Email, code.Code, code.Type, code.ExpiresAt, code.Used,
	).Scan(&code.ID, &code.CreatedAt)
}

func (r *Repository) GetVerificationCode(ctx context.Context, email, code, codeType string) (*model.EmailVerificationCode, error) {
	query := `
		SELECT id, email, code, type, expires_at, used, created_at 
		FROM email_verification_codes 
		WHERE LOWER(email) = LOWER($1) AND code = $2 AND type = $3
		ORDER BY created_at DESC LIMIT 1
	`
	verification := &model.EmailVerificationCode{}
	err := r.db.QueryRow(ctx, query, email, code, codeType).Scan(
		&verification.ID, &verification.Email, &verification.Code, &verification.Type,
		&verification.ExpiresAt, &verification.Used, &verification.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return verification, err
}

func (r *Repository) MarkVerificationCodeUsed(ctx context.Context, id int64) error {
	query := `UPDATE email_verification_codes SET used = true WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
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

func (r *Repository) AgentNameExists(ctx context.Context, name string) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM agents WHERE LOWER(name) = LOWER($1)`
	err := r.db.QueryRow(ctx, query, name).Scan(&count)
	return count > 0, err
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
		       complexity, status, COALESCE(metadata, ''), COALESCE(tx_hash, ''), batch_id, created_at, accepted_at, completed_at, expiry_time
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
			       complexity, status, COALESCE(metadata, ''), COALESCE(tx_hash, ''), batch_id, created_at, accepted_at, completed_at, expiry_time
			FROM tasks WHERE requester_did = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
		`
	} else {
		query = `
			SELECT id, chain_task_id, requester_did, provider_did, COALESCE(title, ''), COALESCE(description, ''), base_amount, final_amount, insurance_premium,
			       complexity, status, COALESCE(metadata, ''), COALESCE(tx_hash, ''), batch_id, created_at, accepted_at, completed_at, expiry_time
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

func (r *Repository) GetTasksByStatus(ctx context.Context, status model.TaskStatus) ([]*model.Task, error) {
	query := `
		SELECT id, chain_task_id, requester_did, provider_did, COALESCE(title, '') as title,
		       COALESCE(description, '') as description, base_amount, final_amount, 
		       insurance_premium, complexity, status, COALESCE(metadata, '') as metadata,
		       COALESCE(tx_hash, '') as tx_hash, batch_id, created_at, accepted_at, 
		       completed_at, expiry_time
		FROM tasks WHERE status = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*model.Task
	for rows.Next() {
		task := &model.Task{}
		err := rows.Scan(
			&task.ID, &task.ChainTaskID, &task.RequesterDID, &task.ProviderDID,
			&task.Title, &task.Description, &task.BaseAmount, &task.FinalAmount,
			&task.InsurancePremium, &task.Complexity, &task.Status, &task.Metadata,
			&task.TxHash, &task.BatchID, &task.CreatedAt, &task.AcceptedAt,
			&task.CompletedAt, &task.ExpiryTime,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
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
		       complexity, status, COALESCE(metadata, ''), COALESCE(tx_hash, ''), batch_id, created_at, accepted_at, completed_at, expiry_time
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
func (r *Repository) UpdateTaskProvider(ctx context.Context, taskID int64, providerDID string, txHash string) error {
	var query string
	var err error
	if txHash != "" {
		query = `UPDATE tasks SET provider_did = $1, status = 'accepted', accepted_at = NOW(), tx_hash = $3 WHERE id = $2`
		_, err = r.db.Exec(ctx, query, providerDID, taskID, txHash)
	} else {
		query = `UPDATE tasks SET provider_did = $1, status = 'accepted', accepted_at = NOW() WHERE id = $2`
		_, err = r.db.Exec(ctx, query, providerDID, taskID)
	}
	return err
}

// ============ Batch Chain Repository ============

// GetPendingChainTasks returns tasks that need to be recorded on-chain
// Excludes tasks that have been recorded (tx_hash IS NOT NULL) or linked on-chain (chain_task_id IS NOT NULL)
func (r *Repository) GetPendingChainTasks(ctx context.Context) ([]*model.Task, error) {
	query := `
		SELECT id, chain_task_id, requester_did, provider_did, COALESCE(title, ''), COALESCE(description, ''), base_amount, final_amount, insurance_premium,
		       complexity, status, COALESCE(metadata, ''), COALESCE(tx_hash, ''), batch_id, created_at, accepted_at, completed_at, expiry_time
		FROM tasks
		WHERE chain_task_id IS NULL AND (tx_hash IS NULL OR tx_hash = '')
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
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM tasks WHERE chain_task_id IS NULL AND (tx_hash IS NULL OR tx_hash = '')`).Scan(&count)
	return count, err
}

// UpdateTasksBatch marks tasks as batched
func (r *Repository) UpdateTasksBatch(ctx context.Context, taskIDs []int64, batchID string) error {
	query := `UPDATE tasks SET batch_id = $1 WHERE id = ANY($2)`
	_, err := r.db.Exec(ctx, query, batchID, taskIDs)
	return err
}

// MarkTasksOnChain marks tasks as recorded on-chain with the transaction hash
func (r *Repository) MarkTasksOnChain(ctx context.Context, taskIDs []int64, txHash string) error {
	query := `UPDATE tasks SET tx_hash = $1 WHERE id = ANY($2)`
	_, err := r.db.Exec(ctx, query, txHash, taskIDs)
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

// ============ Incentive System Repository ============

// CreateHumanIncentive creates a human incentive record
func (r *Repository) CreateHumanIncentive(ctx context.Context, incentive *model.HumanIncentive) error {
	query := `
		INSERT INTO human_incentives (human_did, registration_points, kyc_points, referral_points, total_points, kyc_level, invited_by, invite_count, invite_code, registered, blacklisted, blacklist_reason, blacklisted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		incentive.HumanDID, incentive.RegistrationPoints, incentive.KYCPoints, incentive.ReferralPoints,
		incentive.TotalPoints, incentive.KYCLevel, incentive.InvitedBy, incentive.InviteCount,
		incentive.InviteCode, incentive.Registered, incentive.Blacklisted, incentive.BlacklistReason, incentive.BlacklistedAt,
	).Scan(&incentive.ID, &incentive.CreatedAt, &incentive.UpdatedAt)
}

// GetHumanIncentive gets human incentive by DID
func (r *Repository) GetHumanIncentive(ctx context.Context, humanDID string) (*model.HumanIncentive, error) {
	query := `
		SELECT id, human_did, registration_points, kyc_points, referral_points, total_points, kyc_level, invited_by, invite_count, invite_code, registered, blacklisted, blacklist_reason, blacklisted_at, created_at, updated_at
		FROM human_incentives WHERE human_did = $1
	`
	incentive := &model.HumanIncentive{}
	err := r.db.QueryRow(ctx, query, humanDID).Scan(
		&incentive.ID, &incentive.HumanDID, &incentive.RegistrationPoints, &incentive.KYCPoints,
		&incentive.ReferralPoints, &incentive.TotalPoints, &incentive.KYCLevel, &incentive.InvitedBy,
		&incentive.InviteCount, &incentive.InviteCode, &incentive.Registered, &incentive.Blacklisted,
		&incentive.BlacklistReason, &incentive.BlacklistedAt, &incentive.CreatedAt, &incentive.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return incentive, err
}

// GetHumanIncentiveByInviteCode gets human incentive by invite code
func (r *Repository) GetHumanIncentiveByInviteCode(ctx context.Context, inviteCode string) (*model.HumanIncentive, error) {
	query := `
		SELECT id, human_did, registration_points, kyc_points, referral_points, total_points, kyc_level, invited_by, invite_count, invite_code, registered, blacklisted, blacklist_reason, blacklisted_at, created_at, updated_at
		FROM human_incentives WHERE invite_code = $1
	`
	incentive := &model.HumanIncentive{}
	err := r.db.QueryRow(ctx, query, inviteCode).Scan(
		&incentive.ID, &incentive.HumanDID, &incentive.RegistrationPoints, &incentive.KYCPoints,
		&incentive.ReferralPoints, &incentive.TotalPoints, &incentive.KYCLevel, &incentive.InvitedBy,
		&incentive.InviteCount, &incentive.InviteCode, &incentive.Registered, &incentive.Blacklisted,
		&incentive.BlacklistReason, &incentive.BlacklistedAt, &incentive.CreatedAt, &incentive.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return incentive, err
}

// UpdateHumanIncentive updates a human incentive
func (r *Repository) UpdateHumanIncentive(ctx context.Context, incentive *model.HumanIncentive) error {
	query := `
		UPDATE human_incentives SET 
			registration_points = $1, kyc_points = $2, referral_points = $3, total_points = $4,
			kyc_level = $5, invited_by = $6, invite_count = $7, invite_code = $8,
			registered = $9, blacklisted = $10, blacklist_reason = $11, blacklisted_at = $12, updated_at = NOW()
		WHERE id = $13
	`
	_, err := r.db.Exec(ctx, query,
		incentive.RegistrationPoints, incentive.KYCPoints, incentive.ReferralPoints, incentive.TotalPoints,
		incentive.KYCLevel, incentive.InvitedBy, incentive.InviteCount, incentive.InviteCode,
		incentive.Registered, incentive.Blacklisted, incentive.BlacklistReason, incentive.BlacklistedAt, incentive.ID,
	)
	return err
}

// CreateAgentIncentive creates an agent incentive record
func (r *Repository) CreateAgentIncentive(ctx context.Context, incentive *model.AgentIncentive) error {
	query := `
		INSERT INTO agent_incentives (agent_did, human_did, registration_points, task_points, total_points, daily_task_points, last_task_day, registered)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		incentive.AgentDID, incentive.HumanDID, incentive.RegistrationPoints, incentive.TaskPoints,
		incentive.TotalPoints, incentive.DailyTaskPoints, incentive.LastTaskDay, incentive.Registered,
	).Scan(&incentive.ID, &incentive.CreatedAt, &incentive.UpdatedAt)
}

// GetAgentIncentive gets agent incentive by DID
func (r *Repository) GetAgentIncentive(ctx context.Context, agentDID string) (*model.AgentIncentive, error) {
	query := `
		SELECT id, agent_did, human_did, registration_points, task_points, total_points, daily_task_points, last_task_day, registered, created_at, updated_at
		FROM agent_incentives WHERE agent_did = $1
	`
	incentive := &model.AgentIncentive{}
	err := r.db.QueryRow(ctx, query, agentDID).Scan(
		&incentive.ID, &incentive.AgentDID, &incentive.HumanDID, &incentive.RegistrationPoints,
		&incentive.TaskPoints, &incentive.TotalPoints, &incentive.DailyTaskPoints, &incentive.LastTaskDay,
		&incentive.Registered, &incentive.CreatedAt, &incentive.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return incentive, err
}

// GetAgentIncentivesByHuman gets all agent incentives for a human DID
func (r *Repository) GetAgentIncentivesByHuman(ctx context.Context, humanDID string) ([]*model.AgentIncentive, error) {
	query := `
		SELECT id, agent_did, human_did, registration_points, task_points, total_points, daily_task_points, last_task_day, registered, created_at, updated_at
		FROM agent_incentives WHERE human_did = $1 ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, humanDID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var incentives []*model.AgentIncentive
	for rows.Next() {
		incentive := &model.AgentIncentive{}
		err := rows.Scan(
			&incentive.ID, &incentive.AgentDID, &incentive.HumanDID, &incentive.RegistrationPoints,
			&incentive.TaskPoints, &incentive.TotalPoints, &incentive.DailyTaskPoints, &incentive.LastTaskDay,
			&incentive.Registered, &incentive.CreatedAt, &incentive.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		incentives = append(incentives, incentive)
	}
	return incentives, nil
}

// UpdateAgentIncentive updates an agent incentive
func (r *Repository) UpdateAgentIncentive(ctx context.Context, incentive *model.AgentIncentive) error {
	query := `
		UPDATE agent_incentives SET 
			registration_points = $1, task_points = $2, total_points = $3, daily_task_points = $4,
			last_task_day = $5, registered = $6, updated_at = NOW()
		WHERE id = $7
	`
	_, err := r.db.Exec(ctx, query,
		incentive.RegistrationPoints, incentive.TaskPoints, incentive.TotalPoints,
		incentive.DailyTaskPoints, incentive.LastTaskDay, incentive.Registered, incentive.ID,
	)
	return err
}

// CreateReferralRecord creates a referral record
func (r *Repository) CreateReferralRecord(ctx context.Context, record *model.ReferralRecord) error {
	query := `
		INSERT INTO referral_records (inviter_did, invitee_did, invite_code)
		VALUES ($1, $2, $3)
		RETURNING id, rewarded_at
	`
	return r.db.QueryRow(ctx, query, record.InviterDID, record.InviteeDID, record.InviteCode).
		Scan(&record.ID, &record.RewardedAt)
}

// GetTopReferrers gets top referrers by invite count
func (r *Repository) GetTopReferrers(ctx context.Context, limit int) ([]*model.HumanIncentive, error) {
	query := `
		SELECT id, human_did, registration_points, kyc_points, referral_points, total_points, kyc_level, invited_by, invite_count, invite_code, registered, blacklisted, blacklist_reason, blacklisted_at, created_at, updated_at
		FROM human_incentives 
		WHERE registered = true AND blacklisted = false
		ORDER BY invite_count DESC 
		LIMIT $1
	`
	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var incentives []*model.HumanIncentive
	for rows.Next() {
		incentive := &model.HumanIncentive{}
		err := rows.Scan(
			&incentive.ID, &incentive.HumanDID, &incentive.RegistrationPoints, &incentive.KYCPoints,
			&incentive.ReferralPoints, &incentive.TotalPoints, &incentive.KYCLevel, &incentive.InvitedBy,
			&incentive.InviteCount, &incentive.InviteCode, &incentive.Registered, &incentive.Blacklisted,
			&incentive.BlacklistReason, &incentive.BlacklistedAt, &incentive.CreatedAt, &incentive.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		incentives = append(incentives, incentive)
	}
	return incentives, nil
}

// GetTopHumanPoints gets top human points earners
func (r *Repository) GetTopHumanPoints(ctx context.Context, limit int) ([]*model.HumanIncentive, error) {
	query := `
		SELECT id, human_did, registration_points, kyc_points, referral_points, total_points, kyc_level, invited_by, invite_count, invite_code, registered, blacklisted, blacklist_reason, blacklisted_at, created_at, updated_at
		FROM human_incentives 
		WHERE registered = true AND blacklisted = false
		ORDER BY total_points DESC 
		LIMIT $1
	`
	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var incentives []*model.HumanIncentive
	for rows.Next() {
		incentive := &model.HumanIncentive{}
		err := rows.Scan(
			&incentive.ID, &incentive.HumanDID, &incentive.RegistrationPoints, &incentive.KYCPoints,
			&incentive.ReferralPoints, &incentive.TotalPoints, &incentive.KYCLevel, &incentive.InvitedBy,
			&incentive.InviteCount, &incentive.InviteCode, &incentive.Registered, &incentive.Blacklisted,
			&incentive.BlacklistReason, &incentive.BlacklistedAt, &incentive.CreatedAt, &incentive.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		incentives = append(incentives, incentive)
	}
	return incentives, nil
}

// GetTopAgentPoints gets top agent points earners
func (r *Repository) GetTopAgentPoints(ctx context.Context, limit int) ([]*model.AgentIncentive, error) {
	query := `
		SELECT id, agent_did, human_did, registration_points, task_points, total_points, daily_task_points, last_task_day, registered, created_at, updated_at
		FROM agent_incentives 
		WHERE registered = true
		ORDER BY total_points DESC 
		LIMIT $1
	`
	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var incentives []*model.AgentIncentive
	for rows.Next() {
		incentive := &model.AgentIncentive{}
		err := rows.Scan(
			&incentive.ID, &incentive.AgentDID, &incentive.HumanDID, &incentive.RegistrationPoints,
			&incentive.TaskPoints, &incentive.TotalPoints, &incentive.DailyTaskPoints, &incentive.LastTaskDay,
			&incentive.Registered, &incentive.CreatedAt, &incentive.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		incentives = append(incentives, incentive)
	}
	return incentives, nil
}

// ============ Task Specification Repository ============

// CreateTaskSpecification creates a task specification
func (r *Repository) CreateTaskSpecification(ctx context.Context, spec *model.TaskSpecification) error {
	query := `
		INSERT INTO task_specifications (task_id, task_type, acceptance_deadline, completion_deadline, grace_period, min_reputation_score, min_completed_tasks, requires_kyc, min_kyc_level, file_type, min_bytes, max_bytes, format_features, required_keywords, required_fields, min_result_count, language_requirement, metadata_ipfs)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
		RETURNING id, created_at
	`
	return r.db.QueryRow(ctx, query,
		spec.TaskID, spec.TaskType, spec.AcceptanceDeadline, spec.CompletionDeadline, spec.GracePeriod,
		spec.MinReputationScore, spec.MinCompletedTasks, spec.RequiresKYC, spec.MinKYCLevel,
		spec.FileType, spec.MinBytes, spec.MaxBytes, spec.FormatFeatures, spec.RequiredKeywords,
		spec.RequiredFields, spec.MinResultCount, spec.LanguageRequirement, spec.MetadataIPFS,
	).Scan(&spec.ID, &spec.CreatedAt)
}

// GetTaskSpecification gets task specification by task ID
func (r *Repository) GetTaskSpecification(ctx context.Context, taskID int64) (*model.TaskSpecification, error) {
	query := `
		SELECT id, task_id, task_type, acceptance_deadline, completion_deadline, grace_period, min_reputation_score, min_completed_tasks, requires_kyc, min_kyc_level, file_type, min_bytes, max_bytes, format_features, required_keywords, required_fields, min_result_count, language_requirement, metadata_ipfs, created_at
		FROM task_specifications WHERE task_id = $1
	`
	spec := &model.TaskSpecification{}
	err := r.db.QueryRow(ctx, query, taskID).Scan(
		&spec.ID, &spec.TaskID, &spec.TaskType, &spec.AcceptanceDeadline, &spec.CompletionDeadline,
		&spec.GracePeriod, &spec.MinReputationScore, &spec.MinCompletedTasks, &spec.RequiresKYC, &spec.MinKYCLevel,
		&spec.FileType, &spec.MinBytes, &spec.MaxBytes, &spec.FormatFeatures, &spec.RequiredKeywords,
		&spec.RequiredFields, &spec.MinResultCount, &spec.LanguageRequirement, &spec.MetadataIPFS, &spec.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return spec, err
}

// CreateTaskResult creates a task result
func (r *Repository) CreateTaskResult(ctx context.Context, result *model.TaskResult) error {
	query := `
		INSERT INTO task_results (task_id, provider_did, result_hash, format_probe_hash, execution_proof_hash, result_ipfs, verified, disputed, submitted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`
	return r.db.QueryRow(ctx, query,
		result.TaskID, result.ProviderDID, result.ResultHash, result.FormatProbeHash,
		result.ExecutionProofHash, result.ResultIPFS, result.Verified, result.Disputed, result.SubmittedAt,
	).Scan(&result.ID)
}

// GetTaskResult gets task result by task ID
func (r *Repository) GetTaskResult(ctx context.Context, taskID int64) (*model.TaskResult, error) {
	query := `
		SELECT id, task_id, provider_did, result_hash, format_probe_hash, execution_proof_hash, result_ipfs, verified, disputed, submitted_at
		FROM task_results WHERE task_id = $1
	`
	result := &model.TaskResult{}
	err := r.db.QueryRow(ctx, query, taskID).Scan(
		&result.ID, &result.TaskID, &result.ProviderDID, &result.ResultHash, &result.FormatProbeHash,
		&result.ExecutionProofHash, &result.ResultIPFS, &result.Verified, &result.Disputed, &result.SubmittedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return result, err
}

// ============ Dual DID System Repository ============

// CreateOnChainDID creates an on-chain DID
func (r *Repository) CreateOnChainDID(ctx context.Context, did *model.OnChainDID) error {
	query := `
		INSERT INTO on_chain_dids (did_hash, wallet_address, linked_off_chain_id, active, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	return r.db.QueryRow(ctx, query,
		did.DIDHash, did.WalletAddress, did.LinkedOffChainID, did.Active, did.CreatedAt,
	).Scan(&did.ID)
}

// GetOnChainDIDByWallet gets on-chain DID by wallet address (case-insensitive)
func (r *Repository) GetOnChainDIDByWallet(ctx context.Context, walletAddress string) (*model.OnChainDID, error) {
	query := `
		SELECT id, did_hash, wallet_address, linked_off_chain_id, active, created_at
		FROM on_chain_dids WHERE LOWER(wallet_address) = LOWER($1)
	`
	did := &model.OnChainDID{}
	err := r.db.QueryRow(ctx, query, walletAddress).Scan(
		&did.ID, &did.DIDHash, &did.WalletAddress, &did.LinkedOffChainID, &did.Active, &did.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return did, err
}

// GetOnChainDIDByHash gets on-chain DID by hash
func (r *Repository) GetOnChainDIDByHash(ctx context.Context, didHash string) (*model.OnChainDID, error) {
	query := `
		SELECT id, did_hash, wallet_address, linked_off_chain_id, active, created_at
		FROM on_chain_dids WHERE did_hash = $1
	`
	did := &model.OnChainDID{}
	err := r.db.QueryRow(ctx, query, didHash).Scan(
		&did.ID, &did.DIDHash, &did.WalletAddress, &did.LinkedOffChainID, &did.Active, &did.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return did, err
}

// UpdateOnChainDID updates an on-chain DID
func (r *Repository) UpdateOnChainDID(ctx context.Context, did *model.OnChainDID) error {
	query := `
		UPDATE on_chain_dids SET linked_off_chain_id = $1, active = $2 WHERE id = $3
	`
	_, err := r.db.Exec(ctx, query, did.LinkedOffChainID, did.Active, did.ID)
	return err
}

// CreateOffChainDID creates an off-chain DID
func (r *Repository) CreateOffChainDID(ctx context.Context, did *model.OffChainDID) error {
	query := `
		INSERT INTO off_chain_dids (display_id, did_hash, tier, is_system_generated, current_owner_on_chain_id, active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`
	return r.db.QueryRow(ctx, query,
		did.DisplayID, did.DIDHash, did.Tier, did.IsSystemGenerated,
		did.CurrentOwnerOnChainID, did.Active, did.CreatedAt, did.UpdatedAt,
	).Scan(&did.ID)
}

// GetOffChainDIDByDisplayID gets off-chain DID by display ID
func (r *Repository) GetOffChainDIDByDisplayID(ctx context.Context, displayID string) (*model.OffChainDID, error) {
	query := `
		SELECT id, display_id, did_hash, tier, is_system_generated, current_owner_on_chain_id, last_transferred_at, active, created_at, updated_at
		FROM off_chain_dids WHERE display_id = $1
	`
	did := &model.OffChainDID{}
	err := r.db.QueryRow(ctx, query, displayID).Scan(
		&did.ID, &did.DisplayID, &did.DIDHash, &did.Tier, &did.IsSystemGenerated,
		&did.CurrentOwnerOnChainID, &did.LastTransferredAt, &did.Active, &did.CreatedAt, &did.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return did, err
}

// GetOffChainDIDByHash gets off-chain DID by hash
func (r *Repository) GetOffChainDIDByHash(ctx context.Context, didHash string) (*model.OffChainDID, error) {
	query := `
		SELECT id, display_id, did_hash, tier, is_system_generated, current_owner_on_chain_id, last_transferred_at, active, created_at, updated_at
		FROM off_chain_dids WHERE did_hash = $1
	`
	did := &model.OffChainDID{}
	err := r.db.QueryRow(ctx, query, didHash).Scan(
		&did.ID, &did.DisplayID, &did.DIDHash, &did.Tier, &did.IsSystemGenerated,
		&did.CurrentOwnerOnChainID, &did.LastTransferredAt, &did.Active, &did.CreatedAt, &did.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return did, err
}

// UpdateOffChainDID updates an off-chain DID
func (r *Repository) UpdateOffChainDID(ctx context.Context, did *model.OffChainDID) error {
	query := `
		UPDATE off_chain_dids SET current_owner_on_chain_id = $1, last_transferred_at = $2, active = $3, updated_at = $4 WHERE id = $5
	`
	_, err := r.db.Exec(ctx, query, did.CurrentOwnerOnChainID, did.LastTransferredAt, did.Active, did.UpdatedAt, did.ID)
	return err
}

// IsDisplayIDBlocked checks if a display ID is blocked
func (r *Repository) IsDisplayIDBlocked(ctx context.Context, displayID string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM blocked_display_ids WHERE display_id = $1)`
	var exists bool
	err := r.db.QueryRow(ctx, query, displayID).Scan(&exists)
	return exists, err
}

// GetAvailablePremiumDIDs gets available premium DIDs
func (r *Repository) GetAvailablePremiumDIDs(ctx context.Context, tier string, page, pageSize int) ([]*model.OffChainDID, int, error) {
	offset := (page - 1) * pageSize
	
	countQuery := `
		SELECT COUNT(*) FROM off_chain_dids 
		WHERE is_system_generated = true AND current_owner_on_chain_id IS NULL AND active = true
	`
	if tier != "" {
		countQuery += ` AND tier = ` + tier
	}
	
	var total int
	if err := r.db.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, display_id, did_hash, tier, is_system_generated, current_owner_on_chain_id, last_transferred_at, active, created_at, updated_at
		FROM off_chain_dids 
		WHERE is_system_generated = true AND current_owner_on_chain_id IS NULL AND active = true
	`
	if tier != "" {
		query += ` AND tier = ` + tier
	}
	query += ` ORDER BY tier DESC, created_at DESC LIMIT $1 OFFSET $2`

	rows, err := r.db.Query(ctx, query, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var dids []*model.OffChainDID
	for rows.Next() {
		did := &model.OffChainDID{}
		err := rows.Scan(
			&did.ID, &did.DisplayID, &did.DIDHash, &did.Tier, &did.IsSystemGenerated,
			&did.CurrentOwnerOnChainID, &did.LastTransferredAt, &did.Active, &did.CreatedAt, &did.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		dids = append(dids, did)
	}

	return dids, total, nil
}

// ============ DID Transfer Repository ============

// CreateDIDTransferListing creates a DID transfer listing
func (r *Repository) CreateDIDTransferListing(ctx context.Context, listing *model.DIDTransferListing) error {
	query := `
		INSERT INTO did_transfer_listings (off_chain_did_hash, seller_wallet, price, payment_token, active, listed_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`
	return r.db.QueryRow(ctx, query,
		listing.OffChainDIDHash, listing.SellerWallet, listing.Price,
		listing.PaymentToken, listing.Active, listing.ListedAt,
	).Scan(&listing.ID)
}

// GetActiveListingByDIDHash gets active listing by DID hash
func (r *Repository) GetActiveListingByDIDHash(ctx context.Context, didHash string) (*model.DIDTransferListing, error) {
	query := `
		SELECT id, off_chain_did_hash, seller_wallet, price, payment_token, active, listed_at
		FROM did_transfer_listings WHERE off_chain_did_hash = $1 AND active = true
	`
	listing := &model.DIDTransferListing{}
	err := r.db.QueryRow(ctx, query, didHash).Scan(
		&listing.ID, &listing.OffChainDIDHash, &listing.SellerWallet,
		&listing.Price, &listing.PaymentToken, &listing.Active, &listing.ListedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return listing, err
}

// UpdateDIDTransferListing updates a DID transfer listing
func (r *Repository) UpdateDIDTransferListing(ctx context.Context, listing *model.DIDTransferListing) error {
	query := `UPDATE did_transfer_listings SET active = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, listing.Active, listing.ID)
	return err
}

// GetActiveListings gets active transfer listings
func (r *Repository) GetActiveListings(ctx context.Context, page, pageSize int) ([]*model.DIDTransferListing, int, error) {
	offset := (page - 1) * pageSize

	var total int
	countQuery := `SELECT COUNT(*) FROM did_transfer_listings WHERE active = true`
	if err := r.db.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, off_chain_did_hash, seller_wallet, price, payment_token, active, listed_at
		FROM did_transfer_listings WHERE active = true
		ORDER BY listed_at DESC LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(ctx, query, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var listings []*model.DIDTransferListing
	for rows.Next() {
		listing := &model.DIDTransferListing{}
		err := rows.Scan(
			&listing.ID, &listing.OffChainDIDHash, &listing.SellerWallet,
			&listing.Price, &listing.PaymentToken, &listing.Active, &listing.ListedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		listings = append(listings, listing)
	}

	return listings, total, nil
}

// ============ Premium DID Auction Repository ============

// CreateAuction creates an auction
func (r *Repository) CreateAuction(ctx context.Context, auction *model.PremiumDIDAuction) error {
	query := `
		INSERT INTO premium_did_auctions (off_chain_did_hash, display_id, tier, auction_type, start_price, current_price, min_increment, reserve_price, start_time, end_time, payment_token, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id
	`
	return r.db.QueryRow(ctx, query,
		auction.OffChainDIDHash, auction.DisplayID, auction.Tier, auction.AuctionType,
		auction.StartPrice, auction.CurrentPrice, auction.MinIncrement, auction.ReservePrice,
		auction.StartTime, auction.EndTime, auction.PaymentToken, auction.Status,
		auction.CreatedAt, auction.UpdatedAt,
	).Scan(&auction.ID)
}

// GetAuction gets auction by ID
func (r *Repository) GetAuction(ctx context.Context, auctionID int64) (*model.PremiumDIDAuction, error) {
	query := `
		SELECT id, chain_auction_id, off_chain_did_hash, display_id, tier, auction_type, start_price, current_price, min_increment, reserve_price, start_time, end_time, highest_bidder, payment_token, status, bid_count, winner_wallet, final_price, tx_hash, created_at, updated_at
		FROM premium_did_auctions WHERE id = $1
	`
	auction := &model.PremiumDIDAuction{}
	err := r.db.QueryRow(ctx, query, auctionID).Scan(
		&auction.ID, &auction.ChainAuctionID, &auction.OffChainDIDHash, &auction.DisplayID,
		&auction.Tier, &auction.AuctionType, &auction.StartPrice, &auction.CurrentPrice,
		&auction.MinIncrement, &auction.ReservePrice, &auction.StartTime, &auction.EndTime,
		&auction.HighestBidder, &auction.PaymentToken, &auction.Status, &auction.BidCount,
		&auction.WinnerWallet, &auction.FinalPrice, &auction.TxHash, &auction.CreatedAt, &auction.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return auction, err
}

// GetActiveAuctionByDIDHash gets active auction by DID hash
func (r *Repository) GetActiveAuctionByDIDHash(ctx context.Context, didHash string) (*model.PremiumDIDAuction, error) {
	query := `
		SELECT id, chain_auction_id, off_chain_did_hash, display_id, tier, auction_type, start_price, current_price, min_increment, reserve_price, start_time, end_time, highest_bidder, payment_token, status, bid_count, winner_wallet, final_price, tx_hash, created_at, updated_at
		FROM premium_did_auctions WHERE off_chain_did_hash = $1 AND status = $2
	`
	auction := &model.PremiumDIDAuction{}
	err := r.db.QueryRow(ctx, query, didHash, model.AuctionStatusActive).Scan(
		&auction.ID, &auction.ChainAuctionID, &auction.OffChainDIDHash, &auction.DisplayID,
		&auction.Tier, &auction.AuctionType, &auction.StartPrice, &auction.CurrentPrice,
		&auction.MinIncrement, &auction.ReservePrice, &auction.StartTime, &auction.EndTime,
		&auction.HighestBidder, &auction.PaymentToken, &auction.Status, &auction.BidCount,
		&auction.WinnerWallet, &auction.FinalPrice, &auction.TxHash, &auction.CreatedAt, &auction.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return auction, err
}

// GetAuctionByChainID gets auction by chain auction ID
func (r *Repository) GetAuctionByChainID(ctx context.Context, chainAuctionID int64) (*model.PremiumDIDAuction, error) {
	query := `
		SELECT id, chain_auction_id, off_chain_did_hash, display_id, tier, auction_type, start_price, current_price, min_increment, reserve_price, start_time, end_time, highest_bidder, payment_token, status, bid_count, winner_wallet, final_price, tx_hash, created_at, updated_at
		FROM premium_did_auctions WHERE chain_auction_id = $1
	`
	auction := &model.PremiumDIDAuction{}
	err := r.db.QueryRow(ctx, query, chainAuctionID).Scan(
		&auction.ID, &auction.ChainAuctionID, &auction.OffChainDIDHash, &auction.DisplayID,
		&auction.Tier, &auction.AuctionType, &auction.StartPrice, &auction.CurrentPrice,
		&auction.MinIncrement, &auction.ReservePrice, &auction.StartTime, &auction.EndTime,
		&auction.HighestBidder, &auction.PaymentToken, &auction.Status, &auction.BidCount,
		&auction.WinnerWallet, &auction.FinalPrice, &auction.TxHash, &auction.CreatedAt, &auction.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return auction, err
}

// UpdateAuction updates an auction
func (r *Repository) UpdateAuction(ctx context.Context, auction *model.PremiumDIDAuction) error {
	query := `
		UPDATE premium_did_auctions 
		SET current_price = $1, highest_bidder = $2, status = $3, bid_count = $4, winner_wallet = $5, final_price = $6, tx_hash = $7, updated_at = $8
		WHERE id = $9
	`
	_, err := r.db.Exec(ctx, query,
		auction.CurrentPrice, auction.HighestBidder, auction.Status, auction.BidCount,
		auction.WinnerWallet, auction.FinalPrice, auction.TxHash, auction.UpdatedAt, auction.ID,
	)
	return err
}

// GetActiveAuctions gets auctions with optional status filter ("active", "sold", "all")
func (r *Repository) GetActiveAuctions(ctx context.Context, page, pageSize int, tier, auctionType, status string) (*model.AuctionListResponse, error) {
	offset := (page - 1) * pageSize

	countQuery := `SELECT COUNT(*) FROM premium_did_auctions WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	// Filter by status
	if status == "active" {
		countQuery += ` AND status = $` + fmt.Sprint(argIndex)
		args = append(args, model.AuctionStatusActive)
		argIndex++
	} else if status == "sold" {
		countQuery += ` AND status = $` + fmt.Sprint(argIndex)
		args = append(args, model.AuctionStatusSold)
		argIndex++
	}
	// "all" means no status filter

	if tier != "" {
		countQuery += ` AND tier = $` + fmt.Sprint(argIndex)
		args = append(args, tier)
		argIndex++
	}
	if auctionType != "" {
		countQuery += ` AND auction_type = $` + fmt.Sprint(argIndex)
		args = append(args, auctionType)
	}

	var total int
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	query := `
		SELECT id, chain_auction_id, off_chain_did_hash, display_id, tier, auction_type, start_price, current_price, min_increment, reserve_price, start_time, end_time, highest_bidder, payment_token, status, bid_count, winner_wallet, final_price, tx_hash, created_at, updated_at
		FROM premium_did_auctions WHERE 1=1
	`
	args = []interface{}{}
	argIndex = 1
	
	// Filter by status
	if status == "active" {
		query += ` AND status = $` + fmt.Sprint(argIndex)
		args = append(args, model.AuctionStatusActive)
		argIndex++
	} else if status == "sold" {
		query += ` AND status = $` + fmt.Sprint(argIndex)
		args = append(args, model.AuctionStatusSold)
		argIndex++
	}
	
	if tier != "" {
		query += ` AND tier = $` + fmt.Sprint(argIndex)
		args = append(args, tier)
		argIndex++
	}
	if auctionType != "" {
		query += ` AND auction_type = $` + fmt.Sprint(argIndex)
		args = append(args, auctionType)
		argIndex++
	}
	
	query += ` ORDER BY created_at DESC LIMIT $` + fmt.Sprint(argIndex) + ` OFFSET $` + fmt.Sprint(argIndex+1)
	args = append(args, pageSize, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var auctions []model.PremiumDIDAuction
	for rows.Next() {
		auction := model.PremiumDIDAuction{}
		err := rows.Scan(
			&auction.ID, &auction.ChainAuctionID, &auction.OffChainDIDHash, &auction.DisplayID,
			&auction.Tier, &auction.AuctionType, &auction.StartPrice, &auction.CurrentPrice,
			&auction.MinIncrement, &auction.ReservePrice, &auction.StartTime, &auction.EndTime,
			&auction.HighestBidder, &auction.PaymentToken, &auction.Status, &auction.BidCount,
			&auction.WinnerWallet, &auction.FinalPrice, &auction.TxHash, &auction.CreatedAt, &auction.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		auctions = append(auctions, auction)
	}

	return &model.AuctionListResponse{
		Auctions:   auctions,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: (total + pageSize - 1) / pageSize,
	}, nil
}

// CreateAuctionBid creates an auction bid
func (r *Repository) CreateAuctionBid(ctx context.Context, bid *model.AuctionBid) error {
	query := `
		INSERT INTO auction_bids (auction_id, bidder_wallet, amount, deposit_amount, tx_hash, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`
	return r.db.QueryRow(ctx, query,
		bid.AuctionID, bid.BidderWallet, bid.Amount, bid.DepositAmount, bid.TxHash, bid.CreatedAt,
	).Scan(&bid.ID)
}

// GetAuctionBids gets bids for an auction
func (r *Repository) GetAuctionBids(ctx context.Context, auctionID int64) ([]*model.AuctionBid, error) {
	query := `
		SELECT id, auction_id, bidder_wallet, amount, deposit_amount, tx_hash, created_at
		FROM auction_bids WHERE auction_id = $1
		ORDER BY amount DESC
	`
	rows, err := r.db.Query(ctx, query, auctionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bids []*model.AuctionBid
	for rows.Next() {
		bid := &model.AuctionBid{}
		err := rows.Scan(
			&bid.ID, &bid.AuctionID, &bid.BidderWallet, &bid.Amount, &bid.DepositAmount, &bid.TxHash, &bid.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		bids = append(bids, bid)
	}

	return bids, nil
}

// GetPremiumDIDStats gets premium DID statistics
func (r *Repository) GetPremiumDIDStats(ctx context.Context) (*model.PremiumDIDStats, error) {
	stats := &model.PremiumDIDStats{
		TierCounts: make(map[string]int),
	}

	// Total premium DIDs
	query := `SELECT COUNT(*) FROM off_chain_dids WHERE is_system_generated = true`
	r.db.QueryRow(ctx, query).Scan(&stats.TotalPremiumDIDs)

	// Sold premium DIDs
	query = `SELECT COUNT(*) FROM off_chain_dids WHERE is_system_generated = true AND current_owner_on_chain_id IS NOT NULL`
	r.db.QueryRow(ctx, query).Scan(&stats.SoldPremiumDIDs)

	stats.AvailablePremiumDIDs = stats.TotalPremiumDIDs - stats.SoldPremiumDIDs

	// Active auctions
	query = `SELECT COUNT(*) FROM premium_did_auctions WHERE status = $1`
	r.db.QueryRow(ctx, query, model.AuctionStatusActive).Scan(&stats.ActiveAuctions)

	// Total auction volume
	query = `SELECT COALESCE(SUM(final_price), 0) FROM premium_did_auctions WHERE status = $1`
	r.db.QueryRow(ctx, query, model.AuctionStatusSold).Scan(&stats.TotalAuctionVolume)

	// Tier counts
	query = `SELECT tier, COUNT(*) FROM off_chain_dids WHERE is_system_generated = true GROUP BY tier`
	rows, err := r.db.Query(ctx, query)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var tier int
			var count int
			rows.Scan(&tier, &count)
			tierName := model.TierNames[model.DIDTier(tier)]
			stats.TierCounts[tierName] = count
		}
	}

	return stats, nil
}
