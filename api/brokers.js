// Brokers endpoint
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const brokers = [
      { id: 1, name: 'Dhan', status: 'active', connected: false },
      { id: 2, name: 'Zerodha', status: 'active', connected: false },
      { id: 3, name: 'Angel One', status: 'active', connected: false }
    ];

    res.status(200).json({
      success: true,
      brokers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
