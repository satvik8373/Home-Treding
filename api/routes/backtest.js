const express = require('express');
const axios = require('axios');

const router = express.Router();

// Production uses the candle-backed engine running on the backend service.
async function executeAuthenticBacktest(params, authorization) {
  const baseUrl = process.env.MAVRIX_BACKTEST_ENGINE_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('REAL_OPTIONS_BACKTEST_UNAVAILABLE: Historical backtest service is not configured.');
  }
  try {
    const response = await axios.post(`${baseUrl}/api/backtest/run`, params,
      { timeout: 120000, headers: authorization ? { authorization } : {} });
    if (!response.data?.success || !response.data?.data) {
      throw new Error(response.data?.error || 'BACKTEST_FAILED');
    }
    return response.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'BACKTEST_FAILED');
  }
}

router.get('/available-data', async (req, res) => {
  const baseUrl = process.env.MAVRIX_BACKTEST_ENGINE_URL?.replace(/\/$/, '') || 'http://localhost:5000';
  try {
    const response = await axios.get(`${baseUrl}/api/backtest/available-data`, {
      timeout: 10000,
      headers: req.headers.authorization ? { authorization: req.headers.authorization } : {}
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'FAILED_TO_FETCH_AVAILABLE_DATA' });
  }
});

router.post('/run', async (req, res) => {
  try {
    const { strategyId = 'nifty-atm-independent-breakout', symbol = 'NIFTY 50',
      days = 22, capital = 100000, startDate, endDate } = req.body || {};
    const data = await executeAuthenticBacktest({ strategyId, symbol, days, capital, startDate, endDate }, req.headers.authorization);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.message?.startsWith('REAL_OPTIONS_BACKTEST_UNAVAILABLE') ? 503 : 400)
      .json({ success: false, error: error.message || 'BACKTEST_FAILED' });
  }
});

async function exportBacktest(req, res) {
  const baseUrl = process.env.MAVRIX_BACKTEST_ENGINE_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    return res.status(503).json({ success: false, error: 'REAL_OPTIONS_BACKTEST_UNAVAILABLE: Historical backtest service is not configured.' });
  }
  try {
    const response = await axios({
      method: req.method,
      url: `${baseUrl}/api/backtest/export`,
      params: req.method === 'GET' ? req.query : undefined,
      data: req.method === 'POST' ? req.body : undefined,
      headers: req.headers.authorization ? { authorization: req.headers.authorization } : {},
      responseType: 'arraybuffer',
      timeout: 120000
    });
    res.setHeader('Content-Type', response.headers['content-type'] || 'text/csv; charset=utf-8');
    if (response.headers['content-disposition']) res.setHeader('Content-Disposition', response.headers['content-disposition']);
    return res.send(response.data);
  } catch (error) {
    return res.status(error.response?.status || 400).json({ success: false,
      error: error.response?.data?.toString?.() || error.message || 'BACKTEST_EXPORT_FAILED' });
  }
}

router.get('/export', exportBacktest);
router.post('/export', exportBacktest);

router.executeAuthenticBacktest = executeAuthenticBacktest;
module.exports = router;
