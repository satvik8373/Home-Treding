import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './services/setupAxios';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Suppress benign cross-origin errors from external widgets (e.g. TradingView embed)
window.addEventListener('error', (e) => {
  if (e.message === 'Script error.' || e.filename?.includes('tradingview.com')) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
