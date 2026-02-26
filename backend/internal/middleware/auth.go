package middleware

import (
	"crypto/ecdsa"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Claims represents JWT claims
type Claims struct {
	WalletAddress string `json:"wallet_address,omitempty"`
	Email         string `json:"email,omitempty"`
	AuthType      string `json:"auth_type"` // "wallet" or "email"
	jwt.RegisteredClaims
}

// AuthMiddleware creates a middleware for JWT authentication
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Bearer token required"})
			c.Abort()
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			fmt.Printf("[AUTH] Token validation failed: %v\n", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// Debug log
		fmt.Printf("[AUTH] Token valid - AuthType: %s, Email: %s, WalletAddress: %s\n", 
			claims.AuthType, claims.Email, claims.WalletAddress)

		// Set auth info in context based on auth type
		c.Set("auth_type", claims.AuthType)
		if claims.WalletAddress != "" {
			c.Set("wallet_address", claims.WalletAddress)
		}
		if claims.Email != "" {
			c.Set("email", claims.Email)
		}
		c.Next()
	}
}

// GenerateToken creates a new JWT token for a wallet address
func GenerateToken(walletAddress string, jwtSecret string) (string, error) {
	claims := &Claims{
		WalletAddress: strings.ToLower(walletAddress),
		AuthType:      "wallet",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "clawpay",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

// GenerateTokenForEmail creates a new JWT token for an email user
func GenerateTokenForEmail(email string, jwtSecret string) (string, error) {
	claims := &Claims{
		Email:    strings.ToLower(email),
		AuthType: "email",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "clawpay",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

// VerifySignature verifies an Ethereum signature
func VerifySignature(message, signatureHex, expectedAddress string) (bool, error) {
	// Prepare the message hash (Ethereum signed message format)
	prefixedMessage := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)
	hash := crypto.Keccak256Hash([]byte(prefixedMessage))

	// Decode the signature
	signature, err := hexutil.Decode(signatureHex)
	if err != nil {
		return false, fmt.Errorf("invalid signature format: %w", err)
	}

	if len(signature) != 65 {
		return false, fmt.Errorf("invalid signature length")
	}

	// Adjust v value if needed
	if signature[64] >= 27 {
		signature[64] -= 27
	}

	// Recover the public key from the signature
	pubKey, err := crypto.SigToPub(hash.Bytes(), signature)
	if err != nil {
		return false, fmt.Errorf("failed to recover public key: %w", err)
	}

	// Get the address from the public key
	recoveredAddress := crypto.PubkeyToAddress(*pubKey)

	// Compare addresses (case insensitive)
	expectedAddr := common.HexToAddress(expectedAddress)
	return recoveredAddress == expectedAddr, nil
}

// SignMessage signs a message with a private key (for testing)
func SignMessage(message string, privateKey *ecdsa.PrivateKey) (string, error) {
	prefixedMessage := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)
	hash := crypto.Keccak256Hash([]byte(prefixedMessage))

	signature, err := crypto.Sign(hash.Bytes(), privateKey)
	if err != nil {
		return "", err
	}

	// Adjust v value
	signature[64] += 27

	return hexutil.Encode(signature), nil
}

// GetWalletAddress retrieves wallet address from gin context
func GetWalletAddress(c *gin.Context) string {
	addr, exists := c.Get("wallet_address")
	if !exists {
		return ""
	}
	return addr.(string)
}

// GetEmail retrieves email from gin context
func GetEmail(c *gin.Context) string {
	email, exists := c.Get("email")
	if !exists {
		return ""
	}
	return email.(string)
}

// GetAuthType retrieves auth type from gin context
func GetAuthType(c *gin.Context) string {
	authType, exists := c.Get("auth_type")
	if !exists {
		return ""
	}
	return authType.(string)
}

// RequireWallet middleware ensures user has a wallet connected
func RequireWallet(c *gin.Context) {
	walletAddress := GetWalletAddress(c)
	if walletAddress == "" {
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "Wallet required for this operation",
			"code":    "WALLET_REQUIRED",
			"message": "Please connect a wallet to perform business operations",
		})
		c.Abort()
		return
	}
	c.Next()
}
