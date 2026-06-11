const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./data.db');

db.serialize(() => {

  // 👤 utilisateurs
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT
    )
  `);

  // 🗳️ votes par plug
  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      plug TEXT
    )
  `);

});

module.exports = db;