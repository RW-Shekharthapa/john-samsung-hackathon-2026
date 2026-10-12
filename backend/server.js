const express = require('express');
const app = express();
app.get('/api/db', async (_q, r) => { try { const c = await require('mysql2/promise').createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 3000 }); await c.query('select 1'); await c.end(); r.json({ db: 'ok' }); } catch (e) { r.status(503).json({ db: 'error', message: e.message }); } });
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => console.log('API on :' + port));
