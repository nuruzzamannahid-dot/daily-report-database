const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');

const app = express();
app.use(cors());
app.use(express.json());

// Turso connection — set these in Render's Environment Variables, never hardcode them.
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Create table on startup if it doesn't exist yet
async function ensureTable() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS shift_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      team_member TEXT NOT NULL,
      last_day_total_order INTEGER DEFAULT 0,
      last_day_new_order INTEGER DEFAULT 0,
      new_approached_lead INTEGER DEFAULT 0,
      followed_up_lead INTEGER DEFAULT 0,
      visited INTEGER DEFAULT 0,
      new_onboarded INTEGER DEFAULT 0,
      total_issue_escalated INTEGER DEFAULT 0,
      total_issue_solved INTEGER DEFAULT 0,
      burning_issue TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}
ensureTable().catch((err) => console.error('Failed to ensure table:', err));

app.get('/', (req, res) => {
  res.send('CarryBee Shift Report API is running.');
});

// Submit a new shift report
app.post('/api/shift-report', async (req, res) => {
  try {
    const {
      date,
      teamMember,
      lastDayTotalOrder,
      lastDayNewOrder,
      newApproachedLead,
      followedUpLead,
      visited,
      newOnboarded,
      totalIssueEscalated,
      totalIssueSolved,
      burningIssue,
    } = req.body;

    if (!date || !teamMember) {
      return res.status(400).json({ result: 'error', message: 'Date and Team Member are required.' });
    }

    await turso.execute({
      sql: `INSERT INTO shift_reports
        (report_date, team_member, last_day_total_order, last_day_new_order,
         new_approached_lead, followed_up_lead, visited, new_onboarded,
         total_issue_escalated, total_issue_solved, burning_issue)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        date,
        teamMember,
        Number(lastDayTotalOrder) || 0,
        Number(lastDayNewOrder) || 0,
        Number(newApproachedLead) || 0,
        Number(followedUpLead) || 0,
        Number(visited) || 0,
        Number(newOnboarded) || 0,
        Number(totalIssueEscalated) || 0,
        Number(totalIssueSolved) || 0,
        burningIssue || '',
      ],
    });

    res.json({ result: 'success', message: 'Shift report saved.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ result: 'error', message: 'Failed to save report.' });
  }
});

// Optional: list recent reports (handy for a future dashboard view)
app.get('/api/shift-report', async (req, res) => {
  try {
    const result = await turso.execute(
      'SELECT * FROM shift_reports ORDER BY id DESC LIMIT 100'
    );
    res.json({ result: 'success', rows: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ result: 'error', message: 'Failed to fetch reports.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
