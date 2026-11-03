import Dexie, { type Table } from 'dexie';
import type { Entry } from './types';

interface Draft {
  key: string;
  value: unknown;
}

class AppDb extends Dexie {
  entries!: Table<Entry, number>;
  drafts!: Table<Draft, string>;

  constructor() {
    super('kotoba-keiko');
    this.version(1).stores({ entries: '++id, createdAt, mode', drafts: 'key' });
  }
}

export const db = new AppDb();

export async function saveEntry(entry: Entry): Promise<number> {
  return db.entries.add(entry);
}

export async function loadDraft<T>(key: string): Promise<T | undefined> {
  return (await db.drafts.get(key))?.value as T | undefined;
}

export async function saveDraft(key: string, value: unknown): Promise<void> {
  await db.drafts.put({ key, value });
}

export async function clearDraft(key: string): Promise<void> {
  await db.drafts.delete(key);
}

const BACKUP_APP = 'kotoba-keiko';

export async function exportBackup(): Promise<string> {
  const entries = await db.entries.toArray();
  return JSON.stringify({ app: BACKUP_APP, version: 1, entries }, null, 2);
}

/** 書き出したJSONの回答を取り込む。同じ番号の回答は上書きする。取り込んだ件数を返す */
export async function importBackup(json: string): Promise<number> {
  let data: { app?: unknown; entries?: unknown };
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('JSONとして読み取れないファイルです。');
  }
  if (data.app !== BACKUP_APP || !Array.isArray(data.entries)) {
    throw new Error('このアプリで書き出したファイルを選んでください。');
  }
  const entries = data.entries as Entry[];
  const valid = entries.every(
    (e) => typeof e?.createdAt === 'string' && typeof e?.mode === 'string' && typeof e?.promptText === 'string',
  );
  if (!valid) throw new Error('ファイルの中に読み取れない回答があります。');
  await db.entries.bulkPut(entries);
  return entries.length;
}
