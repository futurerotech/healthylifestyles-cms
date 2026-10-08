import { Client } from 'pg'

const client = new Client({ connectionString: process.env.DATABASE_URI })
try {
  await client.connect()
  // The login page reads the first user; LIMIT 0 verifies the generated auth
  // query's new column even when CI's disposable database has no users.
  await client.query('SELECT reset_password_requested_at FROM users LIMIT 0')
  console.log('Auth schema: reset_password_requested_at is present')
  // The storage plugin populates media for article hero images. LIMIT 0 catches
  // schema drift even when a disposable database has no uploaded images.
  await client.query('SELECT _objectkey FROM media LIMIT 0')
  console.log('Media schema: _objectkey is present')
} finally {
  await client.end()
}
