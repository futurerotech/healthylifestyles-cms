import { Client } from 'pg'

const client = new Client({ connectionString: process.env.DATABASE_URI })
try {
  await client.connect()
  // The login page reads the first user; LIMIT 0 verifies the generated auth
  // query's new column even when CI's disposable database has no users.
  await client.query('SELECT reset_password_requested_at FROM users LIMIT 0')
  console.log('Auth schema: reset_password_requested_at is present')
} finally {
  await client.end()
}
