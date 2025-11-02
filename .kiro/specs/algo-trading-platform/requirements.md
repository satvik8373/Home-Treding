# Requirements Document

## Introduction

This document outlines the requirements for building a web-based algorithmic trading platform that enables users to create, backtest, and deploy automated trading strategies integrated with the Dhan brokerage API. The platform will provide a user-friendly interface for retail traders to automate their trading strategies without extensive coding knowledge, while also supporting advanced users with custom code capabilities.

The platform will handle the complete trading lifecycle: user onboarding, brokerage account linking, strategy creation and management, backtesting with historical data, live deployment with real-time order execution, portfolio monitoring, and performance analytics.

## Requirements

### Requirement 1: User Authentication and Profile Management

**User Story:** As a new user, I want to create an account and securely log in to the platform, so that I can access my trading strategies and linked brokerage accounts.

#### Acceptance Criteria

1. WHEN a user visits the platform THEN the system SHALL display a landing page with signup and login options
2. WHEN a user submits registration details (name, email, phone, password) THEN the system SHALL validate the inputs and create a new account
3. IF the email or phone already exists THEN the system SHALL display an error message "Account already exists with this email/phone"
4. WHEN a user logs in with valid credentials THEN the system SHALL authenticate the user and redirect to the dashboard
5. WHEN a user requests password reset THEN the system SHALL send a reset link via email
6. WHEN a user enables two-factor authentication THEN the system SHALL require OTP verification on subsequent logins

### Requirement 2: Brokerage Account Linking (Dhan Integration)

**User Story:** As a registered user, I want to link my Dhan brokerage account to the platform, so that I can execute trades and access my portfolio data.

#### Acceptance Criteria

1. WHEN a user navigates to the brokerage linking page THEN the system SHALL display instructions for generating Dhan API credentials
2. WHEN a user submits API Key, API Secret, and Client ID THEN the system SHALL validate the credentials by making a test API call to Dhan
3. IF the credentials are invalid or static IP is not whitelisted THEN the system SHALL display an error message with troubleshooting steps
4. WHEN credentials are successfully validated THEN the system SHALL encrypt and store them securely in the database
5. WHEN a user has linked their account THEN the system SHALL display the account status as "Active" on the dashboard
6. WHEN a user wants to unlink their account THEN the system SHALL remove the stored credentials and deactivate any live strategies

### Requirement 3: Strategy Creation and Management

**User Story:** As a trader, I want to create and manage trading strategies using a visual builder or custom code, so that I can automate my trading logic.

#### Acceptance Criteria

1. WHEN a user clicks "Create Strategy" THEN the system SHALL display a form with fields for strategy name, description, instrument type, timeframe, entry rules, exit rules, stop-loss, and target
2. WHEN a user selects instrument type THEN the system SHALL provide options for Equity, Futures, Options, and Currency
3. WHEN a user defines entry and exit rules THEN the system SHALL validate that the rules are non-empty and logically consistent
4. IF stop-loss percentage is greater than or equal to target percentage THEN the system SHALL display a warning message
5. WHEN a user saves a strategy THEN the system SHALL store it with status "Draft" and assign a unique strategy ID
6. WHEN a user views their strategy list THEN the system SHALL display all strategies with their status (Draft, Backtested, Live, Archived)
7. WHEN a user edits a Draft strategy THEN the system SHALL allow modifications to all fields
8. IF a strategy is Live THEN the system SHALL prevent editing and require deactivation first

### Requirement 4: Backtesting Module

**User Story:** As a trader, I want to backtest my strategy against historical data, so that I can evaluate its performance before deploying it live.

#### Acceptance Criteria

1. WHEN a user selects a strategy for backtesting THEN the system SHALL display options to choose date range and data granularity (1m, 5m, 15m, 1h, 1d)
2. WHEN a user initiates a backtest THEN the system SHALL create an asynchronous job and return a job ID
3. WHEN the backtest is running THEN the system SHALL display a progress indicator
4. WHEN the backtest completes THEN the system SHALL display results including total trades, win rate, profit/loss, max drawdown, and equity curve
5. IF historical data is unavailable for the selected period THEN the system SHALL display an error message "Insufficient data for the selected period"
6. WHEN backtest results are available THEN the system SHALL allow the user to export them as PDF or CSV
7. WHEN a strategy is successfully backtested THEN the system SHALL update its status to "Backtested"

### Requirement 5: Live Strategy Deployment

**User Story:** As a trader, I want to deploy my backtested strategy live, so that it can automatically execute trades in my linked brokerage account.

#### Acceptance Criteria

1. WHEN a user clicks "Deploy" on a backtested strategy THEN the system SHALL display a confirmation modal with risk warnings
2. IF the user's brokerage account is not linked THEN the system SHALL prevent deployment and display an error message
3. WHEN a user confirms deployment THEN the system SHALL create a deployment record with status "Active" and start the execution engine
4. WHEN the strategy generates a buy/sell signal THEN the system SHALL place an order via Dhan API using the stored credentials
5. IF order placement fails due to insufficient margin THEN the system SHALL log the error and send a notification to the user
6. IF order placement fails due to static IP not whitelisted THEN the system SHALL pause the strategy and notify the user
7. WHEN a user deactivates a live strategy THEN the system SHALL stop signal generation and update status to "Inactive"
8. WHEN a strategy is live THEN the system SHALL monitor it continuously and log all order attempts and results

### Requirement 6: Order and Trade Management

**User Story:** As a trader, I want to view all orders and trades executed by my strategies or manually, so that I can track my trading activity.

#### Acceptance Criteria

1. WHEN a user navigates to the tradebook page THEN the system SHALL fetch and display orders from Dhan API
2. WHEN displaying orders THEN the system SHALL show Order ID, Time, Symbol, Quantity, Price, Type (Market/Limit), Status, and associated Strategy Name
3. WHEN a user applies filters (date, symbol, status, strategy) THEN the system SHALL update the displayed results accordingly
4. WHEN a user clicks "Export" THEN the system SHALL generate a CSV file with all filtered trades
5. WHEN an order is placed by a strategy THEN the system SHALL store metadata (strategyId, correlationId) for tracking
6. WHEN order status changes in Dhan THEN the system SHALL sync the updated status within 5 seconds

### Requirement 7: Portfolio and Position Monitoring

**User Story:** As a trader, I want to monitor my live positions and portfolio value in real-time, so that I can track my overall profit and loss.

#### Acceptance Criteria

1. WHEN a user navigates to the portfolio page THEN the system SHALL fetch current positions from Dhan API
2. WHEN displaying portfolio summary THEN the system SHALL show Total Invested, Current Market Value, Today's P&L, and Overall P&L
3. WHEN a user views position details THEN the system SHALL display Symbol, Quantity, Average Price, Current Price, and Unrealized P&L
4. WHEN a user selects "Group by Strategy" THEN the system SHALL organize positions by the strategy that created them
5. WHEN market prices update THEN the system SHALL refresh portfolio values within 10 seconds
6. IF API call to Dhan fails THEN the system SHALL display cached data with a timestamp and warning message

### Requirement 8: Strategy Performance Analytics

**User Story:** As a trader, I want to view detailed performance analytics for my strategies, so that I can identify strengths and weaknesses.

#### Acceptance Criteria

1. WHEN a user selects a strategy for analysis THEN the system SHALL display KPIs including win rate, profit factor, average P&L per trade, max drawdown, and total trades
2. WHEN displaying performance THEN the system SHALL show an equity curve chart (portfolio value over time)
3. WHEN analyzing trade distribution THEN the system SHALL display a histogram of trades by time of day
4. WHEN showing win/loss breakdown THEN the system SHALL display a pie chart of winning vs losing trades
5. WHEN a user compares multiple strategies THEN the system SHALL display side-by-side performance metrics
6. WHEN calculating max drawdown THEN the system SHALL compute the largest peak-to-trough decline in portfolio value

### Requirement 9: Notifications and Alerts

**User Story:** As a trader, I want to receive notifications about important events, so that I can stay informed about my strategies and trades.

#### Acceptance Criteria

1. WHEN a strategy is activated or deactivated THEN the system SHALL create a notification for the user
2. WHEN an order fails to execute THEN the system SHALL send an immediate notification with the error reason
3. WHEN a strategy reaches a profit or loss threshold THEN the system SHALL send an alert notification
4. WHEN margin is insufficient for a trade THEN the system SHALL send a warning notification
5. WHEN a user logs in THEN the system SHALL display unread notification count in the header
6. WHEN a user views notifications THEN the system SHALL mark them as read
7. WHEN a critical error occurs (e.g., API connection lost) THEN the system SHALL send an email notification

### Requirement 10: User Settings and Account Management

**User Story:** As a user, I want to manage my profile, security settings, and subscription plan, so that I can control my account preferences.

#### Acceptance Criteria

1. WHEN a user navigates to settings THEN the system SHALL display tabs for Profile, Security, Billing, and Brokerage Accounts
2. WHEN a user updates profile information (name, email, phone) THEN the system SHALL validate and save the changes
3. WHEN a user changes their password THEN the system SHALL require the current password for verification
4. WHEN a user enables 2FA THEN the system SHALL generate a QR code for authenticator app setup
5. WHEN a user views billing information THEN the system SHALL display current plan, expiry date, and usage statistics
6. WHEN a user upgrades their plan THEN the system SHALL process payment and update subscription status
7. WHEN a user manages brokerage accounts THEN the system SHALL allow adding, editing, or removing linked accounts

### Requirement 11: Data Ingestion and Market Feed

**User Story:** As the system, I need to ingest real-time and historical market data from Dhan, so that strategies can generate signals and backtests can run accurately.

#### Acceptance Criteria

1. WHEN the system starts THEN it SHALL establish a WebSocket connection to Dhan for real-time market data
2. WHEN a strategy is deployed THEN the system SHALL subscribe to market data for the relevant instruments
3. WHEN historical data is needed for backtesting THEN the system SHALL fetch OHLC data from Dhan API for the specified period
4. IF the WebSocket connection drops THEN the system SHALL attempt to reconnect within 5 seconds
5. WHEN market data is received THEN the system SHALL update the in-memory cache within 100 milliseconds
6. WHEN data granularity is requested (1m, 5m, 15m, 1h, 1d) THEN the system SHALL aggregate tick data accordingly

### Requirement 12: Risk Management and Compliance

**User Story:** As the platform, I need to enforce risk management rules and maintain compliance logs, so that users trade within safe limits and regulatory requirements are met.

#### Acceptance Criteria

1. WHEN a strategy attempts to place an order THEN the system SHALL verify that the user has sufficient margin
2. IF a strategy's daily loss exceeds a configured threshold THEN the system SHALL automatically pause the strategy
3. WHEN a user sets position size limits THEN the system SHALL enforce them before order placement
4. WHEN any order is placed THEN the system SHALL log the order details, timestamp, and user ID for audit purposes
5. WHEN API credentials are stored THEN the system SHALL encrypt them using AES-256 encryption
6. WHEN a user accesses sensitive data THEN the system SHALL log the access event with timestamp and IP address
7. IF suspicious activity is detected (e.g., rapid order cancellations) THEN the system SHALL flag the account for review

### Requirement 13: Admin Portal and System Monitoring

**User Story:** As an administrator, I want to monitor platform usage and manage users, so that I can ensure smooth operations and handle support requests.

#### Acceptance Criteria

1. WHEN an admin logs in THEN the system SHALL display a dashboard with KPIs: total users, active strategies, trades today, and system health
2. WHEN an admin views user list THEN the system SHALL display user details with options to activate, deactivate, or view activity
3. WHEN an admin searches for a user THEN the system SHALL filter results by name, email, or user ID
4. WHEN an admin views system logs THEN the system SHALL display error logs, API failures, and performance metrics
5. WHEN an admin needs to disable a strategy THEN the system SHALL allow manual deactivation with a reason note
6. WHEN the system detects high API error rates THEN the system SHALL alert administrators via email

### Requirement 14: Help Documentation and Onboarding

**User Story:** As a new user, I want access to comprehensive documentation and guides, so that I can learn how to use the platform effectively.

#### Acceptance Criteria

1. WHEN a user clicks "Help" THEN the system SHALL display a documentation page with sections for Getting Started, Strategy Creation, Backtesting, and Live Trading
2. WHEN a user views the "Link Dhan Account" guide THEN the system SHALL provide step-by-step instructions with screenshots
3. WHEN a user searches documentation THEN the system SHALL return relevant articles and FAQs
4. WHEN a new user logs in for the first time THEN the system SHALL display an onboarding tour highlighting key features
5. WHEN a user encounters an error THEN the system SHALL provide contextual help links related to the error
6. WHEN a user views FAQs THEN the system SHALL display common questions about API linking, static IP, margin requirements, and strategy limits
