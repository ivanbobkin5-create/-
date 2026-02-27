import pg from 'pg';
const { Pool } = pg;
const connectionString = 'postgresql://gen_user:I%3BL6fAhV%7CSjsWE@89.223.121.2:5432/default_db';

const pool = new Pool({
    connectionString,
    ssl: false,
    connectionTimeoutMillis: 5000,
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error without SSL:', err.message);
    } else {
        console.log('Success without SSL:', res.rows);
    }
    process.exit();
});
