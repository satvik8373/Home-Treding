const express = require('express');
const router = express.Router();

// Mock user database (in production, use a real database)
const users = new Map();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    if (users.has(email)) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    const user = {
      id: Date.now().toString(),
      email,
      name: name || email.split('@')[0],
      createdAt: new Date().toISOString()
    };

    users.set(email, { ...user, password });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = users.get(email);
    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, email: user.email, name: user.name },
      token: 'mock_token_' + Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
