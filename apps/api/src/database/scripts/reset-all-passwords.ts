import 'dotenv/config';
import * as argon2 from 'argon2';
import AppDataSource from '../data-source';

async function main() {
  const dataSource = await AppDataSource.initialize();

  const passwordHash = await argon2.hash('123456');
  await dataSource.query(`UPDATE users SET password_hash = $1`, [passwordHash]);

  const rows: Array<{ email: string; role_names: string | null; employee_code: string | null }> =
    await dataSource.query(`
      SELECT
        u.email,
        string_agg(DISTINCT r.name, ', ') AS role_names,
        e.employee_code
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN employees e ON e.user_id = u.id
      GROUP BY u.id, e.employee_code
      ORDER BY role_names NULLS LAST, u.email
    `);

  console.log(`\nUpdated ${rows.length} user(s) to password: 123456\n`);
  console.log('Email'.padEnd(30) + 'Role(s)'.padEnd(20) + 'Employee Code');
  console.log('-'.repeat(70));
  for (const row of rows) {
    console.log(
      row.email.padEnd(30) + (row.role_names ?? '-').padEnd(20) + (row.employee_code ?? '-'),
    );
  }

  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
