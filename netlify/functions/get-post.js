import { neon } from '@netlify/neon';

export default async (req, res) => {
  const { postId } = req.query; // Or get postId from req.body if POST
  const sql = neon(); // Uses NETLIFY_DATABASE_URL from .env
  const [post] = await sql`SELECT * FROM posts WHERE id = ${postId}`;
  res.status(200).json(post);
};
