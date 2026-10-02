import { DurableObject } from 'cloudflare:workers';
interface Query { sql: string; params: (string | number | null)[] }
interface Fixture { migrations: string[]; imports: Query[][]; verification: { response: string; queries: Query[] }[] }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export class RetainedDataTest extends DurableObject<{ FIXTURE: Fixture }> {
  verify() {
    const sql = this.ctx.storage.sql;
    for (const migration of this.env.FIXTURE.migrations) sql.exec(migration).toArray();
    sql.exec("INSERT INTO user_bets(id,bet_numbers,notes) VALUES(1,'[7,8,9,10,11,12]','new target bet')");
    const execute = (queries: Query[]) => { for (const query of queries) sql.exec(query.sql, ...query.params).toArray(); };
    execute(this.env.FIXTURE.imports[0]!);
    for (const queries of this.env.FIXTURE.imports) execute(queries);
    for (const queries of this.env.FIXTURE.imports) execute(queries);
    assert(sql.exec('SELECT COUNT(*) AS count FROM audit_logs').toArray()[0]?.['count'] === 1001, 'idempotent audit');
    assert(sql.exec('SELECT notes FROM user_bets WHERE id=1').toArray()[0]?.['notes'] === 'new target bet', 'new positive bet survives');
    assert(sql.exec('SELECT notes FROM user_bets WHERE id=-1').toArray()[0]?.['notes'] === 'source bet', 'negative mapped bet');
    sql.exec("UPDATE audit_logs SET event='divergent' WHERE id='audit-1'");
    sql.exec("DELETE FROM audit_logs WHERE id='audit-0'");
    let rejected = false;
    try { for (const queries of this.env.FIXTURE.imports) execute(queries); } catch { rejected = true; }
    assert(rejected && sql.exec("SELECT event FROM audit_logs WHERE id='audit-1'").toArray()[0]?.['event'] === 'divergent', 'divergent collision fails closed');
    assert(sql.exec("SELECT id FROM audit_logs WHERE id='audit-0'").toArray().length === 0, 'complete batch rollback');
    sql.exec("UPDATE audit_logs SET event='api.test' WHERE id='audit-1'");
    for (const queries of this.env.FIXTURE.imports) execute(queries);
    return this.env.FIXTURE.verification.map(item => ({
      response: item.response,
      result: { results: item.queries.map(query => {
        const cursor = sql.exec(query.sql, ...query.params);
        return { columns: cursor.columnNames, rows: [...cursor.raw()], meta: { rows_read: cursor.rowsRead, rows_written: cursor.rowsWritten } };
      }) },
    }));
  }
}

const worker = {
  async fetch(_request: Request, env: { DATA: DurableObjectNamespace<RetainedDataTest> }) {
    try { return Response.json({ pass: true, responses: await env.DATA.getByName('retained-test').verify() }); }
    catch (error) { return Response.json({ pass: false, error: String(error) }, { status: 500 }); }
  },
};
export default worker;
