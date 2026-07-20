/* Wafex redesign — static site server (Railway-ready) */
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets; ".html" extension optional for clean URLs
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// 404
app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Wafex site blooming on port ${PORT}`);
});
