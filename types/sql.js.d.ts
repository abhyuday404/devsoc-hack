declare module "sql.js" {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string, params?: unknown[]): QueryExecResult[];
    prepare(sql: string): Statement;
    close(): void;
    getRowsModified(): number;
    export(): Uint8Array;
  }

  interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(params?: unknown[]): Record<string, unknown>;
    get(params?: unknown[]): unknown[];
    run(params?: unknown[]): void;
    free(): boolean;
    reset(): void;
  }

  interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  interface SqlJsInitOptions {
    locateFile?: (filename: string) => string;
    wasmBinary?: ArrayBuffer | Buffer | Uint8Array;
  }

  export default function initSqlJs(
    options?: SqlJsInitOptions,
  ): Promise<SqlJsStatic>;

  export type { SqlJsStatic, Database, Statement, QueryExecResult };
}
