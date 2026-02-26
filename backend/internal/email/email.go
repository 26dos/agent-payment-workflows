package email

import (
	"fmt"
	"net/smtp"
	"strings"

	"github.com/clawpay/backend/internal/config"
)

type EmailService struct {
	cfg *config.Config
}

func New(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg}
}

// IsConfigured checks if SMTP is properly configured
func (e *EmailService) IsConfigured() bool {
	return e.cfg.SMTPHost != "" && e.cfg.SMTPUsername != "" && e.cfg.SMTPPassword != ""
}

// SendVerificationCode sends a verification code email
func (e *EmailService) SendVerificationCode(toEmail, code, codeType string) error {
	if !e.IsConfigured() {
		return fmt.Errorf("SMTP not configured")
	}

	subject := "ClawPay - Verification Code"
	var body string

	switch codeType {
	case "register":
		subject = "ClawPay - Registration Verification Code"
		body = fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .logo { font-size: 28px; font-weight: bold; color: #3B82F6; }
        .code-box { background: #F3F4F6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1F2937; }
        .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ClawPay</div>
        </div>
        <p>Hi,</p>
        <p>Welcome to ClawPay! Please use the following verification code to complete your registration:</p>
        <div class="code-box">
            <div class="code">%s</div>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <div class="footer">
            <p>ClawPay - AI Agent Settlement Protocol</p>
        </div>
    </div>
</body>
</html>`, code)

	case "login":
		subject = "ClawPay - Login Verification Code"
		body = fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .logo { font-size: 28px; font-weight: bold; color: #3B82F6; }
        .code-box { background: #F3F4F6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1F2937; }
        .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ClawPay</div>
        </div>
        <p>Hi,</p>
        <p>Here is your login verification code:</p>
        <div class="code-box">
            <div class="code">%s</div>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, your account may be at risk. Please secure your account.</p>
        <div class="footer">
            <p>ClawPay - AI Agent Settlement Protocol</p>
        </div>
    </div>
</body>
</html>`, code)

	case "reset_password":
		subject = "ClawPay - Password Reset Code"
		body = fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .logo { font-size: 28px; font-weight: bold; color: #3B82F6; }
        .code-box { background: #F3F4F6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1F2937; }
        .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ClawPay</div>
        </div>
        <p>Hi,</p>
        <p>You requested to reset your password. Use this code to proceed:</p>
        <div class="code-box">
            <div class="code">%s</div>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
        <div class="footer">
            <p>ClawPay - AI Agent Settlement Protocol</p>
        </div>
    </div>
</body>
</html>`, code)

	default:
		body = fmt.Sprintf(`Your ClawPay verification code is: %s`, code)
	}

	return e.sendEmail(toEmail, subject, body, true)
}

// sendEmail sends an email using SMTP
func (e *EmailService) sendEmail(to, subject, body string, isHTML bool) error {
	from := e.cfg.SMTPFrom
	if from == "" {
		from = e.cfg.SMTPUsername
	}

	// Build headers
	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("%s <%s>", e.cfg.SMTPFromName, from)
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	if isHTML {
		headers["Content-Type"] = "text/html; charset=UTF-8"
	} else {
		headers["Content-Type"] = "text/plain; charset=UTF-8"
	}

	// Build message
	var msg strings.Builder
	for k, v := range headers {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")
	msg.WriteString(body)

	// Auth
	auth := smtp.PlainAuth("", e.cfg.SMTPUsername, e.cfg.SMTPPassword, e.cfg.SMTPHost)

	// Send
	addr := fmt.Sprintf("%s:%s", e.cfg.SMTPHost, e.cfg.SMTPPort)
	err := smtp.SendMail(addr, auth, from, []string{to}, []byte(msg.String()))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}
