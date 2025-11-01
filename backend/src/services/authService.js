const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Simple file-based storage (will migrate to PostgreSQL later)
const USERS_FILE = path.join(__dirname, '../../data/users.json');
const SESSIONS_FILE = path.join(__dirname, '../../data/sessions.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize files if they don't exist
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([], null, 2));
}

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

class AuthService {
    // Load users from file
    loadUsers() {
        try {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading users:', error.message);
            return [];
        }
    }

    // Save users to file
    saveUsers(users) {
        try {
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        } catch (error) {
            console.error('Error saving users:', error.message);
        }
    }

    // Register new user
    async registerUser(userData) {
        const { name, email, phone, password } = userData;

        // Validation
        if (!name || !email || !password) {
            throw new Error('Name, email, and password are required');
        }

        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Load existing users
        const users = this.loadUsers();

        // Check if user already exists
        const existingUser = users.find(u => u.email === email || (phone && u.phone === phone));
        if (existingUser) {
            throw new Error('Account already exists with this email/phone');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            email,
            phone: phone || null,
            passwordHash,
            isActive: true,
            isVerified: false,
            twoFaEnabled: false,
            subscriptionPlan: 'free',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Add to users array
        users.push(newUser);
        this.saveUsers(users);

        console.log('✅ User registered successfully:', email);

        // Return user without password
        const { passwordHash: _, ...userWithoutPassword } = newUser;
        return userWithoutPassword;
    }

    // Authenticate user
    async authenticateUser(email, password) {
        const users = this.loadUsers();

        // Find user by email
        const user = users.find(u => u.email === email);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Check if account is active
        if (!user.isActive) {
            throw new Error('Account is deactivated');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }

        // Check if 2FA is enabled
        if (user.twoFaEnabled) {
            // Return partial response indicating 2FA is required
            return {
                requires2FA: true,
                userId: user.id,
                email: user.email
            };
        }

        // Generate JWT token
        const token = this.generateToken(user.id);

        // Store session (simple in-memory for now)
        this.storeSession(user.id, token);

        console.log('✅ User authenticated successfully:', email);

        // Return user without password
        const { passwordHash: _, ...userWithoutPassword } = user;
        return {
            user: userWithoutPassword,
            token
        };
    }

    // Generate JWT token
    generateToken(userId) {
        return jwt.sign(
            { userId },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    }

    // Validate JWT token
    validateToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return decoded;
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    // Store session
    storeSession(userId, token) {
        try {
            const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
            sessions.push({
                userId,
                token,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
        } catch (error) {
            console.error('Error storing session:', error.message);
        }
    }

    // Get user by ID
    getUserById(userId) {
        const users = this.loadUsers();
        const user = users.find(u => u.id === userId);
        if (!user) {
            throw new Error('User not found');
        }
        const { passwordHash: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    // Update user profile
    async updateUserProfile(userId, updates) {
        const users = this.loadUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            throw new Error('User not found');
        }

        // Validate email if being updated
        if (updates.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updates.email)) {
                throw new Error('Invalid email format');
            }

            // Check if email is already taken by another user
            const existingUser = users.find(u => u.email === updates.email && u.id !== userId);
            if (existingUser) {
                throw new Error('Email already in use');
            }
        }

        // Update allowed fields
        const allowedFields = ['name', 'email', 'phone'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                users[userIndex][field] = updates[field];
            }
        });

        users[userIndex].updatedAt = new Date().toISOString();
        this.saveUsers(users);

        const { passwordHash: _, ...userWithoutPassword } = users[userIndex];
        return userWithoutPassword;
    }

    // Change password
    async changePassword(userId, currentPassword, newPassword) {
        const users = this.loadUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            throw new Error('User not found');
        }

        const user = users[userIndex];

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error('Current password is incorrect');
        }

        // Validate new password
        if (newPassword.length < 8) {
            throw new Error('New password must be at least 8 characters');
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        users[userIndex].passwordHash = newPasswordHash;
        users[userIndex].updatedAt = new Date().toISOString();

        this.saveUsers(users);

        console.log('✅ Password changed successfully for user:', user.email);
        return { message: 'Password changed successfully' };
    }

    // Initiate password reset
    async initiatePasswordReset(email) {
        const users = this.loadUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
            // Don't reveal if user exists for security
            return { message: 'If the email exists, a reset link has been sent' };
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { userId: user.id, type: 'password_reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // In production, send email with reset link
        // For now, just log it
        console.log('🔑 Password reset token for', email, ':', resetToken);
        console.log('Reset link: http://localhost:3000/reset-password?token=' + resetToken);

        return { 
            message: 'If the email exists, a reset link has been sent',
            // In development, return the token
            ...(process.env.NODE_ENV === 'development' && { resetToken })
        };
    }

    // Complete password reset
    async resetPassword(resetToken, newPassword) {
        try {
            // Verify reset token
            const decoded = jwt.verify(resetToken, JWT_SECRET);
            
            if (decoded.type !== 'password_reset') {
                throw new Error('Invalid reset token');
            }

            // Validate new password
            if (newPassword.length < 8) {
                throw new Error('Password must be at least 8 characters');
            }

            // Update password
            const users = this.loadUsers();
            const userIndex = users.findIndex(u => u.id === decoded.userId);
            
            if (userIndex === -1) {
                throw new Error('User not found');
            }

            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            users[userIndex].passwordHash = newPasswordHash;
            users[userIndex].updatedAt = new Date().toISOString();

            this.saveUsers(users);

            console.log('✅ Password reset successfully for user:', users[userIndex].email);
            return { message: 'Password reset successfully' };

        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Reset token has expired');
            }
            throw new Error('Invalid or expired reset token');
        }
    }
}

module.exports = new AuthService();
