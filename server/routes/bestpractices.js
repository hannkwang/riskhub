const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/bestpractices
router.get('/', (req, res) => {
  const { q, area } = req.query;
  let sql = 'SELECT id, area, topic, content FROM best_practices WHERE 1=1';
  const params = [];

  if (q) {
    sql += ' AND (id LIKE ? OR topic LIKE ? OR content LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (area) {
    sql += ' AND area = ?';
    params.push(area);
  }
  sql += ' ORDER BY id ASC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET /api/bestpractices/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT id, area, topic, content FROM best_practices WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

module.exports = router;
