import "server-only";

import { createClient } from "@supabase/supabase-js";

export interface DatabaseTable {
  schema: string;
  table: string;
  type: string;
}

export interface DatabaseColumn {
  table: string;
  column: string;
  dataType: string;
  nullable: boolean;
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase credentials missing.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getDatabaseTables(): Promise<DatabaseTable[]> {
  const client = getClient();

  const { data, error } = await client.rpc("execute_readonly_sql", {
    query: `
      SELECT
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : []).map((row: any) => ({
    schema: row.table_schema,
    table: row.table_name,
    type: row.table_type,
  }));
}

export async function getTableColumns(
  tableName: string
): Promise<DatabaseColumn[]> {
  const client = getClient();

  const { data, error } = await client.rpc("execute_readonly_sql", {
    query: `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
      ORDER BY ordinal_position;
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : []).map((row: any) => ({
    table: row.table_name,
    column: row.column_name,
    dataType: row.data_type,
    nullable: row.is_nullable === 'YES',
  }));
}
