const { handleCors } = require('../_lib/cors');

module.exports = async (req, res) => {
  return handleCors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const user = {
        id: 'user_' + Date.now(),
        email,
        name: name || email.split('@')[0]
      };

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
};
