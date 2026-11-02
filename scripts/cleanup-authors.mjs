// The retired SQLite cleanup used fixed author IDs and modified article
// relationships. It is incompatible with the PostgreSQL CMS and cannot be
// run safely against production or staging content.
throw new Error('Legacy author cleanup is disabled; no database was accessed or modified.');
