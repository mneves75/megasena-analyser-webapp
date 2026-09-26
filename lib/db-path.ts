import path from 'path';

/** The SQLite file used by the app and the CLIs: `DATABASE_PATH`, else `db/mega-sena.db`. */
export function resolveDatabasePath(): string {
  const configured = process.env['DATABASE_PATH'];
  return configured ? path.resolve(configured) : path.join(process.cwd(), 'db', 'mega-sena.db');
}
