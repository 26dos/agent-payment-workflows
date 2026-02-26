package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port string
	Env  string

	// Database
	DatabaseURL string

	// JWT
	JWTSecret string

	// Blockchain
	BSCTestnetRPC string
	BSCMainnetRPC string

	// Contract Addresses
	USD1Address              string
	DualDIDRegistryAddress   string // Primary DID Registry
	ReputationAddress        string
	DynamicPricingAddress    string
	InsurancePoolAddress     string
	EscrowAddress            string

	// CORS
	AllowedOrigins []string

	// Email SMTP Configuration
	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string
	SMTPFromName string
}

func Load() (*Config, error) {
	// Load .env file if exists
	godotenv.Load()

	cfg := &Config{
		Port:                  getEnv("PORT", "8080"),
		Env:                   getEnv("ENV", "development"),
		DatabaseURL:           getEnv("DATABASE_URL", "postgres://postgres:password@localhost:5432/clawpay?sslmode=disable"),
		JWTSecret:             getEnv("JWT_SECRET", "default-secret-change-in-production"),
		BSCTestnetRPC:         getEnv("BSC_TESTNET_RPC", "https://data-seed-prebsc-1-s1.binance.org:8545/"),
		BSCMainnetRPC:         getEnv("BSC_MAINNET_RPC", "https://bsc-dataseed.binance.org/"),
		USD1Address:              getEnv("USD1_ADDRESS", ""),
		DualDIDRegistryAddress:   getEnv("DUAL_DID_REGISTRY_ADDRESS", ""),
		ReputationAddress:        getEnv("REPUTATION_ADDRESS", ""),
		DynamicPricingAddress:    getEnv("DYNAMIC_PRICING_ADDRESS", ""),
		InsurancePoolAddress:     getEnv("INSURANCE_POOL_ADDRESS", ""),
		EscrowAddress:            getEnv("ESCROW_ADDRESS", ""),
		AllowedOrigins:        strings.Split(getEnv("ALLOWED_ORIGINS", "http://localhost:3000"), ","),
		// Email SMTP
		SMTPHost:     getEnv("SMTP_HOST", ""),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPUsername: getEnv("SMTP_USERNAME", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", ""),
		SMTPFromName: getEnv("SMTP_FROM_NAME", "ClawPay"),
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}
