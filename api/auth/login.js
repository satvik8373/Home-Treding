const { handleCors } = require('../_lib/cors');

module.exports = async (req, res) => {
  return handleCors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Demo authentication
      const user = {
        id: 'demo_user',
        email: email,
        name: 'Demo User'
      };

      const token = 'demo_token_' + Date.now();

      res.status(200).json({
        success: true,
        message: 'Login successful',
        user,
        token
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
};
