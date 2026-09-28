import { vi } from "vitest";

/**
 * Harness bersama untuk test authz route (Fase 5.1–5.3).
 *
 * Yang diuji adalah KEPUTUSAN IZIN route, bukan PostgREST. Karena itu klien
 * Supabase dipalsukan sampai tingkat query-builder: tiap rantai `.from().select()
 * .eq()...` dicatat, lalu hasilnya diambil dari tabel respons yang disiapkan
 * tiap test. Kalau route sampai memanggil tabel yang tidak disiapkan, mock
 * melempar — jadi jalur yang tak sengaja terlewat ketahuan, bukan diam-diam
 * mengembalikan null dan lolos.
 */

export type QueryResult = { data?: unknown; error?: unknown; count?: number };
/** Respons per tabel; fungsi supaya bisa melihat filter yang dipakai route. */
export type TableResponder = QueryResult | ((call: RecordedCall) => QueryResult);

export type RecordedCall = {
  schema: string | null;
  table: string;
  /** Nama operasi terminal: select | insert | update | delete | upsert. */
  op: string;
  /** Filter berurutan: ["eq", "site_id", "abc"], ["is", "site_id", null], ... */
  filters: Array<[string, ...unknown[]]>;
  /** Payload update/insert. */
  payload?: unknown;
};

export type RpcCall = { schema: string | null; name: string; args: unknown };

export type MockDb = {
  calls: RecordedCall[];
  rpcCalls: RpcCall[];
  /** Cari panggilan pertama ke sebuah tabel. */
  callTo: (table: string) => RecordedCall | undefined;
};

type Options = {
  tables?: Record<string, TableResponder>;
  rpc?: Record<string, TableResponder | ((args: unknown) => QueryResult)>;
};

/** Builder yang thenable: `await`-nya menghasilkan respons tabel. */
function makeBuilder(call: RecordedCall, resolve: (call: RecordedCall) => QueryResult) {
  const chainable = [
    "select", "eq", "neq", "in", "is", "or", "not", "gt", "gte", "lt", "lte",
    "like", "ilike", "order", "limit", "range", "filter", "match", "contains",
  ];
  const terminal = ["single", "maybeSingle"];

  const builder: Record<string, unknown> = {};

  for (const method of chainable) {
    builder[method] = (...args: unknown[]) => {
      if (method !== "select") call.filters.push([method, ...args]);
      return builder;
    };
  }
  for (const method of terminal) {
    builder[method] = () => builder;
  }
  // Thenable: hasilnya baru dihitung saat di-await, setelah semua filter tercatat.
  builder.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) => {
    try {
      return Promise.resolve(resolve(call)).then(onFulfilled, onRejected);
    } catch (error) {
      return Promise.reject(error);
    }
  };
  return builder;
}

/**
 * Bangun klien Supabase palsu.
 *
 * `tables` memetakan nama tabel ke respons. Tabel yang tidak terdaftar membuat
 * test gagal dengan pesan jelas — bukan `data: null` yang menyamar jadi "tidak
 * ditemukan".
 */
export function createMockSupabase(options: Options = {}) {
  const db: MockDb = {
    calls: [],
    rpcCalls: [],
    callTo: (table) => db.calls.find((c) => c.table === table),
  };

  const resolveTable = (call: RecordedCall): QueryResult => {
    const responder = options.tables?.[call.table];
    if (responder === undefined) {
      throw new Error(
        `Route menyentuh tabel "${call.table}" yang tidak disiapkan test ini. ` +
          `Tambahkan ke tables:{} atau periksa apakah route seharusnya sampai ke sana.`,
      );
    }
    return typeof responder === "function" ? responder(call) : responder;
  };

  const client = (schema: string | null): Record<string, unknown> => ({
    schema: (name: string) => client(name),
    from: (table: string) => {
      const call: RecordedCall = { schema, table, op: "select", filters: [] };
      db.calls.push(call);
      const builder = makeBuilder(call, resolveTable) as Record<string, unknown>;
      for (const op of ["insert", "update", "upsert", "delete"]) {
        builder[op] = (payload?: unknown) => {
          call.op = op;
          call.payload = payload;
          return builder;
        };
      }
      return builder;
    },
    rpc: (name: string, args: unknown) => {
      db.rpcCalls.push({ schema, name, args });
      const responder = options.rpc?.[name];
      if (responder === undefined) {
        throw new Error(`Route memanggil RPC "${name}" yang tidak disiapkan test ini.`);
      }
      const result = typeof responder === "function"
        ? (responder as (a: unknown) => QueryResult)(args)
        : responder;
      return Promise.resolve(result);
    },
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(async () => undefined),
    },
  });

  return { client: client(null), db };
}

/** Cookie store palsu untuk `next/headers`. */
export function createMockCookies(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
    getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => store.set(name, value),
    delete: (name: string) => store.delete(name),
  };
}
