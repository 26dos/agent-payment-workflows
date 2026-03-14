package model

import (
	"encoding/json"
	"time"
)

// AuthType represents how the user authenticated
type AuthType string

const (
	AuthTypeWallet AuthType = "wallet"
	AuthTypeEmail  AuthType = "email"
)

// User represents a human user with a Root DID
type User struct {
	ID                  int64      `json:"id" db:"id"`
	WalletAddress       *string    `json:"wallet_address" db:"wallet_address"`
	Email               *string    `json:"email" db:"email"`
	PasswordHash        *string    `json:"-" db:"password_hash"`
	AuthType            AuthType   `json:"auth_type" db:"auth_type"`
	EmailVerified       bool       `json:"email_verified" db:"email_verified"`
	DID                 string     `json:"did" db:"did"`
	DisplayID           *string    `json:"display_id" db:"display_id"`
	HumanScore          int        `json:"human_score" db:"human_score"`
	SuccessfulInvites   *int       `json:"successful_invites" db:"successful_invites"`
	FiveDigitDIDClaimed *bool      `json:"five_digit_did_claimed" db:"five_digit_did_claimed"`
	InviteCode          *string    `json:"invite_code" db:"invite_code"`
	InvitedBy           *int64     `json:"invited_by" db:"invited_by"`
	Metadata            string     `json:"metadata" db:"metadata"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
}

// HasWallet checks if user has connected a wallet
func (u *User) HasWallet() bool {
	return u.WalletAddress != nil && *u.WalletAddress != ""
}

// CanPerformBusinessOps checks if user can perform business operations (requires wallet)
func (u *User) CanPerformBusinessOps() bool {
	return u.HasWallet()
}

// EmailVerificationCode represents a verification code for email
type EmailVerificationCode struct {
	ID        int64     `json:"id" db:"id"`
	Email     string    `json:"email" db:"email"`
	Code      string    `json:"code" db:"code"`
	Type      string    `json:"type" db:"type"` // register, login, reset_password
	ExpiresAt time.Time `json:"expires_at" db:"expires_at"`
	Used      bool      `json:"used" db:"used"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// IsExpired checks if the verification code has expired
func (e *EmailVerificationCode) IsExpired() bool {
	return time.Now().After(e.ExpiresAt)
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

// ============ Incentive System Models ============

// KYCLevel represents different KYC verification levels
type KYCLevel int

const (
	KYCLevelNone     KYCLevel = 0
	KYCLevelBasic    KYCLevel = 1 // Social media linked
	KYCLevelStandard KYCLevel = 2 // + Asset proof
	KYCLevelAdvanced KYCLevel = 3 // + Identity verification
	KYCLevelFull     KYCLevel = 4 // Full verification
)

// HumanIncentive represents incentive data for a Human DID
type HumanIncentive struct {
	ID                 int64      `json:"id" db:"id"`
	HumanDID           string     `json:"human_did" db:"human_did"`
	RegistrationPoints int64      `json:"registration_points" db:"registration_points"`
	KYCPoints          int64      `json:"kyc_points" db:"kyc_points"`
	ReferralPoints     int64      `json:"referral_points" db:"referral_points"`
	TotalPoints        int64      `json:"total_points" db:"total_points"`
	KYCLevel           KYCLevel   `json:"kyc_level" db:"kyc_level"`
	InvitedBy          *string    `json:"invited_by" db:"invited_by"`
	InviteCount        int        `json:"invite_count" db:"invite_count"`
	InviteCode         *string    `json:"invite_code" db:"invite_code"`
	Registered         bool       `json:"registered" db:"registered"`
	Blacklisted        bool       `json:"blacklisted" db:"blacklisted"`
	BlacklistReason    *string    `json:"blacklist_reason" db:"blacklist_reason"`
	BlacklistedAt      *time.Time `json:"blacklisted_at" db:"blacklisted_at"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at" db:"updated_at"`
}

// AgentIncentive represents incentive data for an Agent DID
type AgentIncentive struct {
	ID                 int64     `json:"id" db:"id"`
	AgentDID           string    `json:"agent_did" db:"agent_did"`
	HumanDID           string    `json:"human_did" db:"human_did"`
	RegistrationPoints int64     `json:"registration_points" db:"registration_points"`
	TaskPoints         int64     `json:"task_points" db:"task_points"`
	TotalPoints        int64     `json:"total_points" db:"total_points"`
	DailyTaskPoints    int       `json:"daily_task_points" db:"daily_task_points"`
	LastTaskDay        *string   `json:"last_task_day" db:"last_task_day"`
	Registered         bool      `json:"registered" db:"registered"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

// IncentiveConstants represents the incentive system constants
type IncentiveConstants struct {
	HumanRegistrationPoints       int64 `json:"human_registration_points"`
	AgentRegistrationPoints       int64 `json:"agent_registration_points"`
	HumanReferralInviterPoints    int64 `json:"human_referral_inviter_points"`
	HumanReferralInviteePoints    int64 `json:"human_referral_invitee_points"`
	TaskCompletionPoints          int64 `json:"task_completion_points"`
	MaxDailyTaskPoints            int   `json:"max_daily_task_points"`
	MaxTotalAgentTaskPoints       int64 `json:"max_total_agent_task_points"`
	KYCBasicPoints                int64 `json:"kyc_basic_points"`
	KYCStandardPoints             int64 `json:"kyc_standard_points"`
	KYCAdvancedPoints             int64 `json:"kyc_advanced_points"`
	KYCFullPoints                 int64 `json:"kyc_full_points"`
}

// GetDefaultIncentiveConstants returns the default incentive constants
func GetDefaultIncentiveConstants() IncentiveConstants {
	return IncentiveConstants{
		HumanRegistrationPoints:       1000,
		AgentRegistrationPoints:       100,
		HumanReferralInviterPoints:    500,
		HumanReferralInviteePoints:    200,
		TaskCompletionPoints:          1,
		MaxDailyTaskPoints:            10,
		MaxTotalAgentTaskPoints:       500,
		KYCBasicPoints:                1000,
		KYCStandardPoints:             3000,
		KYCAdvancedPoints:             6000,
		KYCFullPoints:                 10000,
	}
}

// IncentiveSummary represents a summary of a user's incentives
type IncentiveSummary struct {
	HumanDID          string           `json:"human_did"`
	HumanPoints       int64            `json:"human_points"`
	TotalAgentPoints  int64            `json:"total_agent_points"`
	TotalPoints       int64            `json:"total_points"`
	KYCLevel          KYCLevel         `json:"kyc_level"`
	InviteCount       int              `json:"invite_count"`
	Blacklisted       bool             `json:"blacklisted"`
	Agents            []AgentIncentive `json:"agents"`
}

// ============ Task Specification Models ============

// TaskType represents the type of task
type TaskType int

const (
	TaskTypeDataCrawling      TaskType = 0
	TaskTypeModelInference    TaskType = 1
	TaskTypeDataProcessing    TaskType = 2
	TaskTypeContentGeneration TaskType = 3
	TaskTypeCodeExecution     TaskType = 4
	TaskTypeAPIIntegration    TaskType = 5
	TaskTypeCustom            TaskType = 6
)

// TaskSpecification represents detailed task requirements
type TaskSpecification struct {
	ID                   int64      `json:"id" db:"id"`
	TaskID               int64      `json:"task_id" db:"task_id"`
	TaskType             TaskType   `json:"task_type" db:"task_type"`
	AcceptanceDeadline   time.Time  `json:"acceptance_deadline" db:"acceptance_deadline"`
	CompletionDeadline   time.Time  `json:"completion_deadline" db:"completion_deadline"`
	GracePeriod          int        `json:"grace_period" db:"grace_period"`
	MinReputationScore   int        `json:"min_reputation_score" db:"min_reputation_score"`
	MinCompletedTasks    int        `json:"min_completed_tasks" db:"min_completed_tasks"`
	RequiresKYC          bool       `json:"requires_kyc" db:"requires_kyc"`
	MinKYCLevel          KYCLevel   `json:"min_kyc_level" db:"min_kyc_level"`
	FileType             string     `json:"file_type" db:"file_type"`
	MinBytes             int64      `json:"min_bytes" db:"min_bytes"`
	MaxBytes             int64      `json:"max_bytes" db:"max_bytes"`
	FormatFeatures       string     `json:"format_features" db:"format_features"`
	RequiredKeywords     string     `json:"required_keywords" db:"required_keywords"`
	RequiredFields       string     `json:"required_fields" db:"required_fields"`
	MinResultCount       int        `json:"min_result_count" db:"min_result_count"`
	LanguageRequirement  string     `json:"language_requirement" db:"language_requirement"`
	MetadataIPFS         string     `json:"metadata_ipfs" db:"metadata_ipfs"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
}

// TaskResult represents the submitted result for a task
type TaskResult struct {
	ID                 int64      `json:"id" db:"id"`
	TaskID             int64      `json:"task_id" db:"task_id"`
	ProviderDID        string     `json:"provider_did" db:"provider_did"`
	ResultHash         string     `json:"result_hash" db:"result_hash"`
	FormatProbeHash    string     `json:"format_probe_hash" db:"format_probe_hash"`
	ExecutionProofHash string     `json:"execution_proof_hash" db:"execution_proof_hash"`
	ResultIPFS         string     `json:"result_ipfs" db:"result_ipfs"`
	Verified           bool       `json:"verified" db:"verified"`
	Disputed           bool       `json:"disputed" db:"disputed"`
	SubmittedAt        time.Time  `json:"submitted_at" db:"submitted_at"`
}

// ReferralRecord represents a referral relationship
type ReferralRecord struct {
	ID          int64     `json:"id" db:"id"`
	InviterDID  string    `json:"inviter_did" db:"inviter_did"`
	InviteeDID  string    `json:"invitee_did" db:"invitee_did"`
	InviteCode  string    `json:"invite_code" db:"invite_code"`
	RewardedAt  time.Time `json:"rewarded_at" db:"rewarded_at"`
}

// ============ Dual DID System Models ============

// DIDTier represents the rarity tier of an off-chain DID
type DIDTier int

const (
	DIDTierNormal DIDTier = 0 // Regular user-generated DID
	DIDTierB      DIDTier = 1 // Symmetric/mirror patterns
	DIDTierA      DIDTier = 2 // Meaningful words
	DIDTierS      DIDTier = 3 // Special combinations
	DIDTierSS     DIDTier = 4 // Repeating/sequential patterns
	DIDTierSSS    DIDTier = 5 // Pure 4-digit or super rare
)

// TierNames maps tier to display name
var TierNames = map[DIDTier]string{
	DIDTierNormal: "Normal",
	DIDTierB:      "B",
	DIDTierA:      "A",
	DIDTierS:      "S",
	DIDTierSS:     "SS",
	DIDTierSSS:    "SSS",
}

// OffChainDID represents an off-chain display DID
type OffChainDID struct {
	ID                    int64      `json:"id" db:"id"`
	DisplayID             string     `json:"display_id" db:"display_id"`
	DIDHash               string     `json:"did_hash" db:"did_hash"`
	Tier                  DIDTier    `json:"tier" db:"tier"`
	IsSystemGenerated     bool       `json:"is_system_generated" db:"is_system_generated"`
	CurrentOwnerOnChainID *string    `json:"current_owner_on_chain_id" db:"current_owner_on_chain_id"`
	LastTransferredAt     *time.Time `json:"last_transferred_at" db:"last_transferred_at"`
	Active                bool       `json:"active" db:"active"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at" db:"updated_at"`
}

// OnChainDID represents an on-chain asset DID
type OnChainDID struct {
	ID                 int64      `json:"id" db:"id"`
	DIDHash            string     `json:"did_hash" db:"did_hash"`
	WalletAddress      string     `json:"wallet_address" db:"wallet_address"`
	LinkedOffChainID   *string    `json:"linked_off_chain_id" db:"linked_off_chain_id"`
	Active             bool       `json:"active" db:"active"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
}

// DIDTransferListing represents a DID listed for transfer
type DIDTransferListing struct {
	ID               int64     `json:"id" db:"id"`
	OffChainDIDHash  string    `json:"off_chain_did_hash" db:"off_chain_did_hash"`
	SellerWallet     string    `json:"seller_wallet" db:"seller_wallet"`
	Price            float64   `json:"price" db:"price"`
	PaymentToken     string    `json:"payment_token" db:"payment_token"`
	Active           bool      `json:"active" db:"active"`
	ListedAt         time.Time `json:"listed_at" db:"listed_at"`
}

// DIDTransferHistory represents a DID transfer record
type DIDTransferHistory struct {
	ID              int64     `json:"id" db:"id"`
	OffChainDIDHash string    `json:"off_chain_did_hash" db:"off_chain_did_hash"`
	FromOnChainDID  string    `json:"from_on_chain_did" db:"from_on_chain_did"`
	ToOnChainDID    string    `json:"to_on_chain_did" db:"to_on_chain_did"`
	Price           float64   `json:"price" db:"price"`
	PaymentToken    string    `json:"payment_token" db:"payment_token"`
	TxHash          string    `json:"tx_hash" db:"tx_hash"`
	TransferredAt   time.Time `json:"transferred_at" db:"transferred_at"`
}

// ============ Auction Models ============

// AuctionType represents the type of auction
type AuctionType int

const (
	AuctionTypeEnglish    AuctionType = 0 // Ascending price
	AuctionTypeDutch      AuctionType = 1 // Descending price
	AuctionTypeFixedPrice AuctionType = 2 // Fixed price
)

// AuctionStatus represents the status of an auction
type AuctionStatus int

const (
	AuctionStatusNotStarted AuctionStatus = 0
	AuctionStatusActive     AuctionStatus = 1
	AuctionStatusEnded      AuctionStatus = 2
	AuctionStatusCancelled  AuctionStatus = 3
	AuctionStatusSold       AuctionStatus = 4
)

// PremiumDIDAuction represents an auction for a premium DID
type PremiumDIDAuction struct {
	ID               int64         `json:"id" db:"id"`
	ChainAuctionID   *int64        `json:"chain_auction_id" db:"chain_auction_id"`
	OffChainDIDHash  string        `json:"off_chain_did_hash" db:"off_chain_did_hash"`
	DisplayID        string        `json:"display_id" db:"display_id"`
	Tier             DIDTier       `json:"tier" db:"tier"`
	AuctionType      AuctionType   `json:"auction_type" db:"auction_type"`
	StartPrice       float64       `json:"start_price" db:"start_price"`
	CurrentPrice     float64       `json:"current_price" db:"current_price"`
	MinIncrement     float64       `json:"min_increment" db:"min_increment"`
	ReservePrice     float64       `json:"reserve_price" db:"reserve_price"`
	StartTime        time.Time     `json:"start_time" db:"start_time"`
	EndTime          time.Time     `json:"end_time" db:"end_time"`
	HighestBidder    *string       `json:"highest_bidder" db:"highest_bidder"`
	PaymentToken     string        `json:"payment_token" db:"payment_token"`
	Status           AuctionStatus `json:"status" db:"status"`
	BidCount         int           `json:"bid_count" db:"bid_count"`
	WinnerWallet     *string       `json:"winner_wallet" db:"winner_wallet"`
	FinalPrice       *float64      `json:"final_price" db:"final_price"`
	TxHash           *string       `json:"tx_hash" db:"tx_hash"`
	CreatedAt        time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at" db:"updated_at"`
}

// AuctionBid represents a bid on an auction
type AuctionBid struct {
	ID            int64     `json:"id" db:"id"`
	AuctionID     int64     `json:"auction_id" db:"auction_id"`
	BidderWallet  string    `json:"bidder_wallet" db:"bidder_wallet"`
	Amount        float64   `json:"amount" db:"amount"`
	DepositAmount float64   `json:"deposit_amount" db:"deposit_amount"`
	TxHash        string    `json:"tx_hash" db:"tx_hash"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// UserDIDInfo represents complete DID info for a user
type UserDIDInfo struct {
	OnChainDID  *OnChainDID  `json:"on_chain_did"`
	OffChainDID *OffChainDID `json:"off_chain_did"`
	HasOnChain  bool         `json:"has_on_chain"`
	HasOffChain bool         `json:"has_off_chain"`
}

// PremiumDIDStats represents statistics for premium DIDs
type PremiumDIDStats struct {
	TotalPremiumDIDs    int     `json:"total_premium_dids"`
	SoldPremiumDIDs     int     `json:"sold_premium_dids"`
	AvailablePremiumDIDs int    `json:"available_premium_dids"`
	ActiveAuctions      int     `json:"active_auctions"`
	TotalAuctionVolume  float64 `json:"total_auction_volume"`
	TierCounts          map[string]int `json:"tier_counts"`
}

// AuctionListResponse represents paginated auction list
type AuctionListResponse struct {
	Auctions   []PremiumDIDAuction `json:"auctions"`
	Total      int                 `json:"total"`
	Page       int                 `json:"page"`
	PageSize   int                 `json:"page_size"`
	TotalPages int                 `json:"total_pages"`
}
