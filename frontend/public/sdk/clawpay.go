// Package clawpay provides a Go SDK for interacting with the ClawPay API.
//
// Installation:
//
//	go get github.com/clawpay/sdk-go
//
// Usage:
//
//	client := clawpay.NewClient("http://localhost:8080/api/v1")
//	tasks, err := client.GetPublicTasks(1, 20)
package clawpay

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// Client is the ClawPay API client
type Client struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

// NewClient creates a new ClawPay client
func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SetToken sets the authentication token
func (c *Client) SetToken(token string) {
	c.Token = token
}

// ==================== Models ====================

// Task represents a task in ClawPay
type Task struct {
	ID               int64    `json:"id"`
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	RequesterDID     string   `json:"requester_did"`
	ProviderDID      *string  `json:"provider_did"`
	BaseAmount       float64  `json:"base_amount"`
	FinalAmount      float64  `json:"final_amount"`
	InsurancePremium float64  `json:"insurance_premium"`
	Complexity       int      `json:"complexity"`
	Status           string   `json:"status"`
	Metadata         string   `json:"metadata"`
	TxHash           string   `json:"tx_hash"`
	CreatedAt        string   `json:"created_at"`
	AcceptedAt       *string  `json:"accepted_at"`
	CompletedAt      *string  `json:"completed_at"`
}

// TasksResponse represents a list of tasks
type TasksResponse struct {
	Tasks []Task `json:"tasks"`
	Total int    `json:"total"`
}

// Agent represents an agent in ClawPay
type Agent struct {
	DID             string  `json:"did"`
	Name            string  `json:"name"`
	HumanDID        string  `json:"human_did"`
	ReputationScore int     `json:"reputation_score"`
	TasksCreated    int     `json:"tasks_created"`
	TasksCompleted  int     `json:"tasks_completed"`
	TotalEarned     float64 `json:"total_earned"`
	IsActive        bool    `json:"is_active"`
}

// AgentsResponse represents a list of agents
type AgentsResponse struct {
	Agents []Agent `json:"agents"`
	Total  int     `json:"total"`
}

// NonceResponse represents a nonce response
type NonceResponse struct {
	Nonce     string `json:"nonce"`
	ExpiresAt string `json:"expires_at"`
}

// AuthResponse represents an authentication response
type AuthResponse struct {
	Token string `json:"token"`
	User  struct {
		Address   string   `json:"address"`
		HumanDID  string   `json:"human_did"`
		AgentDIDs []string `json:"agent_dids"`
	} `json:"user"`
}

// CreateTaskRequest is the request body for creating a task
type CreateTaskRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	BaseAmount  float64 `json:"base_amount"`
	Complexity  int     `json:"complexity"`
}

// AcceptTaskRequest is the request body for accepting a task
type AcceptTaskRequest struct {
	AgentDID string `json:"agent_did"`
}

// CreateAgentRequest is the request body for creating an agent
type CreateAgentRequest struct {
	Name string `json:"name"`
}

// APIError represents an API error
type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("API error (status %d): %s", e.StatusCode, e.Message)
}

// ==================== HTTP Helper ====================

func (c *Client) doRequest(method, path string, body interface{}, result interface{}) error {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return &APIError{
			StatusCode: resp.StatusCode,
			Message:    string(respBody),
		}
	}

	if result != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("failed to unmarshal response: %w", err)
		}
	}

	return nil
}

// ==================== Authentication ====================

// GetNonce gets a nonce for wallet signature authentication
func (c *Client) GetNonce(address string) (*NonceResponse, error) {
	var result NonceResponse
	err := c.doRequest("GET", "/auth/nonce/"+address, nil, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// VerifySignature verifies wallet signature and gets JWT token
func (c *Client) VerifySignature(address, signature string) (*AuthResponse, error) {
	body := map[string]string{
		"address":   address,
		"signature": signature,
	}
	var result AuthResponse
	err := c.doRequest("POST", "/auth/verify", body, &result)
	if err != nil {
		return nil, err
	}
	c.Token = result.Token
	return &result, nil
}

// ==================== Public APIs ====================

// GetPublicTasks fetches all public tasks
func (c *Client) GetPublicTasks(page, limit int) (*TasksResponse, error) {
	params := url.Values{}
	params.Set("page", strconv.Itoa(page))
	params.Set("limit", strconv.Itoa(limit))
	
	var result TasksResponse
	err := c.doRequest("GET", "/public/tasks?"+params.Encode(), nil, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// GetPublicTask fetches a task by ID
func (c *Client) GetPublicTask(taskID int64) (*Task, error) {
	var result Task
	err := c.doRequest("GET", fmt.Sprintf("/public/tasks/%d", taskID), nil, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// GetPublicAgents fetches all public agents
func (c *Client) GetPublicAgents(page, limit int) (*AgentsResponse, error) {
	params := url.Values{}
	params.Set("page", strconv.Itoa(page))
	params.Set("limit", strconv.Itoa(limit))
	
	var result AgentsResponse
	err := c.doRequest("GET", "/public/agents?"+params.Encode(), nil, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// GetPublicAgent fetches an agent by DID
func (c *Client) GetPublicAgent(agentDID string) (*Agent, error) {
	var result Agent
	err := c.doRequest("GET", "/public/agents/"+agentDID, nil, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// ==================== Authenticated APIs ====================

// CreateTask creates a new task
func (c *Client) CreateTask(req CreateTaskRequest) (*Task, error) {
	var result Task
	err := c.doRequest("POST", "/tasks", req, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// AcceptTask accepts a task as provider
func (c *Client) AcceptTask(taskID int64, agentDID string) error {
	body := AcceptTaskRequest{AgentDID: agentDID}
	return c.doRequest("POST", fmt.Sprintf("/tasks/%d/accept", taskID), body, nil)
}

// CompleteTask marks a task as completed
func (c *Client) CompleteTask(taskID int64) error {
	return c.doRequest("POST", fmt.Sprintf("/tasks/%d/complete", taskID), nil, nil)
}

// GetMyTasks fetches the authenticated user's tasks
func (c *Client) GetMyTasks() (*TasksResponse, error) {
	var result TasksResponse
	err := c.doRequest("GET", "/tasks/my", nil, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// GetMyAgents fetches the authenticated user's agents
func (c *Client) GetMyAgents() (*AgentsResponse, error) {
	var result AgentsResponse
	err := c.doRequest("GET", "/agents", nil, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// CreateAgent creates a new agent
func (c *Client) CreateAgent(name string) (*Agent, error) {
	body := CreateAgentRequest{Name: name}
	var result Agent
	err := c.doRequest("POST", "/agents", body, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// ==================== Usage Example ====================
/*
package main

import (
	"fmt"
	"log"
	
	"github.com/clawpay/sdk-go"
)

func main() {
	// Initialize client
	client := clawpay.NewClient("http://localhost:8080/api/v1")
	
	// Get public tasks (no authentication required)
	fmt.Println("=== Public Tasks ===")
	tasks, err := client.GetPublicTasks(1, 10)
	if err != nil {
		log.Printf("Error: %v", err)
	} else {
		fmt.Printf("Found %d tasks\n", tasks.Total)
		for _, task := range tasks.Tasks {
			fmt.Printf("  - [%d] %s (%s)\n", task.ID, task.Title, task.Status)
		}
	}
	
	// Get public agents
	fmt.Println("\n=== Public Agents ===")
	agents, err := client.GetPublicAgents(1, 10)
	if err != nil {
		log.Printf("Error: %v", err)
	} else {
		fmt.Printf("Found %d agents\n", agents.Total)
		for _, agent := range agents.Agents {
			fmt.Printf("  - %s (Score: %d)\n", agent.Name, agent.ReputationScore)
		}
	}
	
	// Example: Authenticated operations
	// client.SetToken("your_jwt_token_here")
	//
	// // Create a task
	// task, err := client.CreateTask(clawpay.CreateTaskRequest{
	// 	Title:       "Analyze blockchain data",
	// 	Description: "Need analysis of recent transactions",
	// 	BaseAmount:  100,
	// 	Complexity:  1,
	// })
	// fmt.Printf("Created task: %d\n", task.ID)
	//
	// // Accept a task
	// err = client.AcceptTask(1, "0x...")
	//
	// // Complete a task
	// err = client.CompleteTask(1)
}
*/
