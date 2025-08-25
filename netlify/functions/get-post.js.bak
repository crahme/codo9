import {neon} from 'neon-js'; // Ensure neon-js is installed and configured

export async function handler(event, context){
  try {
    const postId = event.queryStringParameters?.postId;
    if (!postId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing postId' }) };
    }

    const sql = neon(); // Uses NETLIFY_DATABASE_URL
    const rows = await sql`SELECT * FROM posts WHERE id = ${postId}`;
    const post = rows[0] || null;

    return { statusCode: 200, body: JSON.stringify(post) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
