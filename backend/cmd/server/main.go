package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/clawpay/backend/internal/config"
	"github.com/clawpay/backend/internal/email"
	"github.com/clawpay/backend/internal/handler"
	"github.com/clawpay/backend/internal/middleware"
	"github.com/clawpay/backend/internal/repository"
	"github.com/clawpay/backend/internal/service"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Setup logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}

	// Set Gin mode
	if cfg.IsDevelopment() {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// Connect to database
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer pool.Close()

	// Verify database connection
	if err := pool.Ping(ctx); err != nil {
		log.Fatal().Err(err).Msg("Failed to ping database")
	}
	log.Info().Msg("Connected to database")

	// Initialize layers
	repo := repository.New(pool)
	svc := service.New(repo)
	emailSvc := email.New(cfg)
	h := handler.New(svc, cfg.JWTSecret, emailSvc)

	// Log email service status
	if emailSvc.IsConfigured() {
		log.Info().Msg("Email service configured and ready")
	} else {
		log.Warn().Msg("Email service not configured - verification codes will be returned in API response (dev mode)")
	}

	// Setup router
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// CORS configuration
	corsConfig := cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}
	router.Use(cors.New(corsConfig))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// API routes
	api := router.Group("/api/v1")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			// Wallet auth
			auth.GET("/nonce", h.GetNonce)
			auth.POST("/login", h.Login)

			// Email auth
			auth.POST("/email/send-code", h.SendVerificationCode)
			auth.POST("/email/register", h.EmailRegister)
			auth.POST("/email/login", h.EmailLogin)
			auth.POST("/email/login-with-code", h.EmailLoginWithCode)
		}

		// Public routes (no auth required)
		public := api.Group("/public")
		{
			public.GET("/tasks", h.GetPublicTasks)
			public.GET("/tasks/:id", h.GetPublicTask)
			public.GET("/agents", h.GetPublicAgents)
			public.GET("/agents/:id", h.GetPublicAgent)
		}

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			// User routes
			user := protected.Group("/user")
			{
				user.GET("/profile", h.GetProfile)
				user.PUT("/did", h.UpdateDID)
				user.GET("/business-access", h.CheckBusinessAccess)
			}

			// Wallet binding routes (for email users)
			wallet := protected.Group("/wallet")
			{
				wallet.GET("/bind/nonce", h.GetBindWalletNonce)
				wallet.POST("/bind", h.BindWallet)
			}

			// Agent routes
			agents := protected.Group("/agents")
			{
				agents.POST("", h.CreateAgent)
				agents.GET("", h.GetAgents)
				agents.GET("/:id", h.GetAgent)
				agents.PUT("/:id/mandate", h.UpdateAgentMandate)
				agents.PUT("/:id/did", h.UpdateAgentDID)
			}

			// Task routes
			tasks := protected.Group("/tasks")
			{
				tasks.POST("", h.CreateTask)
				tasks.GET("", h.GetTasks)
				tasks.GET("/:id", h.GetTask)
				tasks.PUT("/:id/accept", h.AcceptTask)
				tasks.PUT("/:id/complete", h.CompleteTask)
				tasks.PUT("/:id/cancel", h.CancelTask)
				tasks.PUT("/:id/dispute", h.RaiseDispute)
				tasks.PUT("/:id/chain", h.UpdateTaskChainID)
				tasks.POST("/:id/activity", h.LogActivity)
				tasks.GET("/:id/activity", h.GetActivityLogs)
			}

			// Pricing routes
			pricing := protected.Group("/pricing")
			{
				pricing.POST("/calculate", h.CalculatePrice)
			}

			// Dashboard routes
			dashboard := protected.Group("/dashboard")
			{
				dashboard.GET("/stats", h.GetDashboardStats)
			}

			// Batch chain routes (admin)
			batch := protected.Group("/batch")
			{
				batch.GET("/pending", h.GetPendingChainTasks)
				batch.POST("/trigger", h.TriggerBatchChain)
				batch.POST("/mark-onchain", h.MarkTasksOnChain)
				batch.GET("/config", h.GetBatchConfig)
				batch.PUT("/config", h.UpdateBatchConfig)
			}

			// Incentive system routes
			incentives := protected.Group("/incentives")
			{
				incentives.GET("/constants", h.GetIncentiveConstants)
				incentives.GET("/human", h.GetHumanIncentive)
				incentives.GET("/agent", h.GetAgentIncentive)
				incentives.GET("/summary", h.GetIncentiveSummary)
				incentives.POST("/claim-human", h.ClaimRegistrationBonus)
				incentives.POST("/claim-agent", h.ClaimAgentBonus)
				incentives.POST("/generate-invite", h.GenerateInviteCode)
				incentives.POST("/record-completion", h.RecordTaskCompletion)
				incentives.GET("/leaderboard/referrals", h.GetReferralLeaderboard)
				incentives.GET("/leaderboard/points", h.GetPointsLeaderboard)
			}

			// Task specification routes
			specs := protected.Group("/specifications")
			{
				specs.POST("", h.CreateTaskSpecification)
				specs.GET("/:id", h.GetTaskSpecification)
				specs.POST("/validate", h.ValidateProvider)
			}

			// Task results routes
			results := protected.Group("/results")
			{
				results.POST("", h.SubmitTaskResult)
				results.GET("/:id", h.GetTaskResult)
			}

			// Dual DID system routes
			dids := protected.Group("/dids")
			{
				dids.POST("/on-chain", h.RegisterOnChainDID)
				dids.POST("/off-chain", h.RegisterOffChainDID)
				dids.POST("/complete", h.CompleteRegistration)
				dids.GET("/my", h.GetMyDIDs)
				dids.GET("/validate", h.ValidateDisplayID)
				dids.GET("/off-chain/:display_id", h.GetOffChainDID)
			}

			// DID transfer routes
			transfers := protected.Group("/transfers")
			{
				transfers.POST("/list", h.ListDIDForTransfer)
				transfers.DELETE("/:display_id", h.CancelDIDTransferListing)
				transfers.GET("", h.GetDIDTransferListings)
			}

			// Premium DID auction routes
			auctions := protected.Group("/auctions")
			{
				auctions.GET("", h.GetActiveAuctions)
				auctions.GET("/stats", h.GetPremiumDIDStats)
				auctions.GET("/premium-dids", h.GetAvailablePremiumDIDs)
				auctions.GET("/:id", h.GetAuction)
				auctions.GET("/:id/bids", h.GetAuctionBids)
				auctions.POST("/bid", h.RecordBid)
				auctions.POST("/sync-short-id", h.SyncShortIdAuction)
				auctions.POST("/finalize-sync", h.FinalizeAuctionSync)
			}

			// Admin premium DID routes
			adminDID := protected.Group("/admin/dids")
			{
				adminDID.POST("/premium", h.CreatePremiumDID)
				adminDID.POST("/premium/batch", h.CreatePremiumDIDsBatch)
				adminDID.POST("/auctions", h.CreateAuction)
				adminDID.DELETE("/auctions/:id", h.CancelAuction)
			}
		}
	}

	// Create server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Info().Str("port", cfg.Port).Msg("Starting server")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	// Start auto-arbitration background task
	go func() {
		ticker := time.NewTicker(5 * time.Minute) // Check every 5 minutes
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				results, err := svc.RunAutoArbitration(ctx)
				if err != nil {
					log.Error().Err(err).Msg("Auto-arbitration failed")
				} else if len(results) > 0 {
					log.Info().Int("count", len(results)).Msg("Auto-arbitration resolved disputes")
					for _, r := range results {
						log.Info().Int64("taskID", r.TaskID).Int("requesterPercent", r.RequesterPercent).Str("reason", r.Reason).Msg("Dispute auto-resolved")
					}
				}
				cancel()
			}
		}
	}()
	log.Info().Msg("Auto-arbitration background task started (5 min interval)")

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info().Msg("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	fmt.Println("Server exited")
}
