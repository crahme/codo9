// connect-to-neon.js
import { Client } from 'pg';

// Replace these with your actual Neon connection details
const connectionString = 'postgresql://neondb_owner:npg_yMXmTz81aPCD@ep-polished-waterfall-a5szq7p4-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // For Neon, SSL is usually required
  },
});

async function connect() {
  try {
    await client.connect();
    console.log('Connected to Neon Postgres!');
    // Run a simple query, e.g., SELECT NOW()
    const res = await client.query('SELECT NOW()');
    console.log('Server time:', res.rows[0]);
  } catch (err) {
    console.error('Connection error:', err.stack);
  } //finally {
    //await client.end();
    //console.log('Disconnected.');
  //}
}

connect();
