const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/bestpractices
router.get('/', (req, res) => {
  const { q, area } = req.query;
  let sql = 'SELECT * FROM best_practices WHERE 1=1';
  const params = [];

  if (q) {
    sql += ' AND (id LIKE ? OR topic LIKE ? OR content LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (area) {
    sql += ' AND area = ?';
    params.push(area);
  }
  sql += ' ORDER BY used_count DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET /api/bestpractices/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM best_practices WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// PATCH /api/bestpractices/:id/usage — increment usage/accepted counts
router.patch('/:id/usage', (req, res) => {
  const { accepted } = req.body;
  db.prepare('UPDATE best_practices SET used_count = used_count + 1 WHERE id = ?').run(req.params.id);
  if (accepted) {
    db.prepare('UPDATE best_practices SET accepted_count = accepted_count + 1 WHERE id = ?').run(req.params.id);
  }
  res.json({ ok: true });
});

module.exports = router;
