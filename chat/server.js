const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root' 
});

//Create database if it doesn't exist
db.query('CREATE DATABASE IF NOT EXISTS chatdb', (err) => {
  if (err) throw err;
  console.log('✅ Database chatdb exists or created');

  //Use database
  db.query('USE chatdb', (err) => {
    if (err) throw err;

    //Create messages table if it doesn't exist
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender VARCHAR(100) NOT NULL,
        receiver VARCHAR(100) NOT NULL,
        text TEXT NOT NULL,
        time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent BOOLEAN DEFAULT TRUE
      )
    `;
    db.query(createTableSQL, (err) => {
      if (err) throw err;
      console.log('✅ Table messages exists or created');

      //Insert initial messages if table is empty
      db.query('SELECT COUNT(*) AS count FROM messages', (err, results) => {
        if (err) throw err;
        if (results[0].count === 0) {
          const initialMessages = [
            ['Nobahle Nzimande', 'Me', 'Is the laptop still available?'],
            ['Me', 'Nobahle Nzimande', 'Yes, it is available.'],
            ['Nobahle Nzimande', 'Me', 'Are you available to meet tomorrow?'],
            ['Me', 'Nobahle Nzimande', 'Yes, that works for me.'],
            ['Me', 'Namhla Brown', 'How about 11:30 during break time?'],
            ['Namhla Brown', 'Me', 'That works, thanks!'],
            ['Me', 'Robert Wilson', 'Thank you for the support.'],
            ['James Smith', 'Me', 'Great, thank you!'],
            ['Me', 'Aliyana Dalasile', 'I’ll check and let you know']
          ];

          //This add timestamps spaced by 2-5 minutes
          const now = new Date();
const messagesWithTime = initialMessages.map((msg, index) => {
  const time = new Date(now.getTime() + index * 2 * 60000); 
  return [msg[0], msg[1], msg[2], time];
});
          db.query(
            'INSERT INTO messages (sender, receiver, text) VALUES ?',
            [initialMessages],
            (err) => {
              if (err) throw err;
              console.log('Initial messages inserted');
            }
          );
        }
      });
    });
  });
});

// Get messages for a user
app.get('/messages/:user', (req, res) => {
  const mainUser = "Me";
  const otherUser = req.params.user;

  db.query(
    `SELECT * FROM messages 
     WHERE (sender = ? AND receiver = ?) 
        OR (sender = ? AND receiver = ?)
     ORDER BY time ASC`,
    [mainUser, otherUser, otherUser, mainUser],
    (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    }
  );
});

// Insert message
app.post('/messages', (req, res) => {
  const { sender, receiver, text } = req.body;

  db.query(
    'INSERT INTO messages (sender, receiver, text) VALUES (?, ?, ?)',
    [sender, receiver, text],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ id: result.insertId });
    }
  );
});

// Start server
app.listen(3001, () => {
  console.log('🚀 Server running on http://localhost:3001');
});

