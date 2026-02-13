package model

import (
	"encoding/json"
	"time"
)

// User represents a human user with a Root DID
type User struct {
	ID            int64     `json:"id" db:"id"`
	WalletAddress string    `json:"wallet_address" db:"wallet_address"`
	DID           string    `json:"did" db:"did"`
	HumanScore    int       `json:"human_score" db:"human_score"`
	Metadata      string    `json:"metadata" db:"metadata"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// Agent represents an AI agent with a Sub-DID
type Agent struct {
	ID             int64      `json:"id" db:"id"`
	UserID         int64      `json:"user_id" db:"user_id"`
	Name           string     `json:"name" db:"name"`
	SubDID         string     `json:"sub_did" db:"sub_did"`
	AgentScore     int        `json:"agent_score" db:"agent_score"`
	DailyLimit     float64    `json:"daily_limit" db:"daily_limit"`
	SingleLimit    float64    `json:"single_limit" db:"single_limit"`
	MandateExpiry  *time.Time `json:"mandate_expiry" db:"mandate_expiry"`
	Status         string     `json:"status" db:"status"` // active, inactive
	TasksCreated   int        `json:"tasks_created" db:"tasks_created"`
	TasksCompleted int        `json:"tasks_completed" db:"tasks_completed"`
	TotalEarned    float64    `json:"total_earned" db:"total_earned"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

// Task represents an escrow task
type Task struct {
	ID               int64      `json:"id" db:"id"`
	ChainTaskID      *int64     `json:"chain_task_id" db:"chain_task_id"`
	RequesterDID     string     `json:"requester_did" db:"requester_did"`
	ProviderDID      *string    `json:"provider_did" db:"provider_did"` // Optional until accepted
	Title            string     `json:"title" db:"title"`
	Description      string     `json:"description" db:"description"`
	BaseAmount       float64    `json:"base_amount" db:"base_amount"`
	FinalAmount      float64    `json:"final_amount" db:"final_amount"`
	InsurancePremium float64    `json:"insurance_premium" db:"insurance_premium"`
	Complexity       int        `json:"complexity" db:"complexity"`
	Status           TaskStatus `json:"status" db:"status"`
	Metadata         string     `json:"metadata" db:"metadata"`
	TxHash           string     `json:"tx_hash" db:"tx_hash"`
	BatchID          *string    `json:"batch_id" db:"batch_id"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	AcceptedAt       *time.Time `json:"accepted_at" db:"accepted_at"`
	CompletedAt      *time.Time `json:"completed_at" db:"completed_at"`
	ExpiryTime       time.Time  `json:"expiry_time" db:"expiry_time"`
}

type TaskStatus string

const (
	TaskStatusCreated   TaskStatus = "created"
	TaskStatusAccepted  TaskStatus = "accepted"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusDisputed  TaskStatus = "disputed"
	TaskStatusResolved  TaskStatus = "resolved"
	TaskStatusCancelled TaskStatus = "cancelled"
	TaskStatusExpired   TaskStatus = "expired"
)

// Dispute represents a task dispute
type Dispute struct {
	ID               int64     `json:"id" db:"id"`
	TaskID           int64     `json:"task_id" db:"task_id"`
	RaisedByDID      string    `json:"raised_by_did" db:"raised_by_did"`
	Reason           string    `json:"reason" db:"reason"`
	RequesterPercent *int      `json:"requester_percent" db:"requester_percent"`
	Resolved         bool      `json:"resolved" db:"resolved"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	ResolvedAt       *time.Time `json:"resolved_at" db:"resolved_at"`
}

// ActivityLog represents an agent activity log
type ActivityLog struct {
	ID        int64           `json:"id" db:"id"`
	TaskID    int64           `json:"task_id" db:"task_id"`
	AgentDID  string          `json:"agent_did" db:"agent_did"`
	Action    string          `json:"action" db:"action"`
	Details   json.RawMessage `json:"details" db:"details"`
	CreatedAt time.Time       `json:"created_at" db:"created_at"`
}

// ReputationHistory tracks reputation changes
type ReputationHistory struct {
	ID        int64     `json:"id" db:"id"`
	DID       string    `json:"did" db:"did"`
	IsHuman   bool      `json:"is_human" db:"is_human"`
	OldScore  int       `json:"old_score" db:"old_score"`
	NewScore  int       `json:"new_score" db:"new_score"`
	Reason    string    `json:"reason" db:"reason"`
	TaskID    *int64    `json:"task_id" db:"task_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// DashboardStats represents dashboard statistics
type DashboardStats struct {
	TotalTasks        int     `json:"total_tasks"`
	CompletedTasks    int     `json:"completed_tasks"`
	ActiveTasks       int     `json:"active_tasks"`
	DisputedTasks     int     `json:"disputed_tasks"`
	TotalVolume       float64 `json:"total_volume"`
	TotalAgents       int     `json:"total_agents"`
	AverageTaskCost   float64 `json:"average_task_cost"`
	SuccessRate       float64 `json:"success_rate"`
}

// PriceCalculation represents a price calculation result
type PriceCalculation struct {
	BaseFee          float64 `json:"base_fee"`
	FinalPrice       float64 `json:"final_price"`
	KReputation      float64 `json:"k_reputation"`
	KComplexity      float64 `json:"k_complexity"`
	KSupplyDemand    float64 `json:"k_supply_demand"`
	InsurancePremium float64 `json:"insurance_premium"`
}

// BatchChainConfig represents batch chain configuration
type BatchChainConfig struct {
	ID              int64      `json:"id" db:"id"`
	TaskCount       int        `json:"task_count" db:"task_count"`
	IntervalMinutes int        `json:"interval_minutes" db:"interval_minutes"`
	AutoEnabled     bool       `json:"auto_enabled" db:"auto_enabled"`
	LastBatchAt     *time.Time `json:"last_batch_at" db:"last_batch_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// AgentStats represents agent statistics for public display
type AgentStats struct {
	Agent          Agent   `json:"agent"`
	TasksCreated   int     `json:"tasks_created"`
	TasksCompleted int     `json:"tasks_completed"`
	TotalEarned    float64 `json:"total_earned"`
	SuccessRate    float64 `json:"success_rate"`
}
