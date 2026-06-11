import * as SQLite from 'expo-sqlite';

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read';

export type MessageType = 'text' | 'image' | 'file';

export type Message = {
  id: string;
  peerId: string;
  direction: 'in' | 'out';
  type: MessageType;
  body: string;
  fileName: string | null;
  mimeType: string | null;
  status: MessageStatus;
  createdAt: number;
};

export type Contact = {
  userId: string;
  email: string | null;
  name: string | null;
  publicKey: string;
};

const dbPromise = SQLite.openDatabaseAsync('messenger.db');

export async function initDb() {
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      peerId TEXT NOT NULL,
      direction TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      body TEXT NOT NULL,
      fileName TEXT,
      mimeType TEXT,
      status TEXT NOT NULL DEFAULT 'delivered',
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contacts (
      userId TEXT PRIMARY KEY,
      email TEXT,
      publicKey TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reads (
      peerId TEXT PRIMARY KEY,
      lastReadAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT,
      email TEXT
    );
  `);

  const profileColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(profile)',
  );
  if (!profileColumns.some((column) => column.name === 'email')) {
    await db.execAsync('ALTER TABLE profile ADD COLUMN email TEXT');
  }

  const messageColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(messages)',
  );
  if (!messageColumns.some((column) => column.name === 'status')) {
    await db.execAsync(
      "ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'delivered'",
    );
  }
  if (!messageColumns.some((column) => column.name === 'type')) {
    await db.execAsync(
      "ALTER TABLE messages ADD COLUMN type TEXT NOT NULL DEFAULT 'text'",
    );
  }
  if (!messageColumns.some((column) => column.name === 'fileName')) {
    await db.execAsync('ALTER TABLE messages ADD COLUMN fileName TEXT');
  }
  if (!messageColumns.some((column) => column.name === 'mimeType')) {
    await db.execAsync('ALTER TABLE messages ADD COLUMN mimeType TEXT');
  }

  const contactColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(contacts)',
  );
  if (!contactColumns.some((column) => column.name === 'email')) {
    await db.execAsync('ALTER TABLE contacts ADD COLUMN email TEXT');
  }
  if (!contactColumns.some((column) => column.name === 'name')) {
    await db.execAsync('ALTER TABLE contacts ADD COLUMN name TEXT');
  }
}

export type MyProfile = { name: string | null; email: string | null };

export async function getMyProfile(): Promise<MyProfile> {
  const db = await dbPromise;
  const row = await db.getFirstAsync<MyProfile>(
    'SELECT name, email FROM profile WHERE id = 1',
  );
  return { name: row?.name ?? null, email: row?.email ?? null };
}

export async function setMyProfile(name: string, email: string) {
  const db = await dbPromise;
  await db.runAsync(
    'INSERT OR REPLACE INTO profile (id, name, email) VALUES (1, ?, ?)',
    name,
    email,
  );
}

export async function saveContact(contact: Contact) {
  const db = await dbPromise;
  await db.runAsync(
    `INSERT INTO contacts (userId, email, name, publicKey) VALUES (?, ?, ?, ?)
     ON CONFLICT(userId) DO UPDATE SET
       publicKey = excluded.publicKey,
       email = COALESCE(excluded.email, contacts.email),
       name = COALESCE(excluded.name, contacts.name)`,
    contact.userId,
    contact.email,
    contact.name,
    contact.publicKey,
  );
}

export async function getContact(userId: string): Promise<Contact | null> {
  const db = await dbPromise;
  return db.getFirstAsync<Contact>(
    'SELECT * FROM contacts WHERE userId = ?',
    userId,
  );
}

export async function loadContacts(): Promise<Contact[]> {
  const db = await dbPromise;
  return db.getAllAsync<Contact>(
    'SELECT * FROM contacts ORDER BY COALESCE(name, email)',
  );
}

export async function saveMessage(message: Message): Promise<boolean> {
  const db = await dbPromise;
  const result = await db.runAsync(
    'INSERT OR IGNORE INTO messages (id, peerId, direction, type, body, fileName, mimeType, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    message.id,
    message.peerId,
    message.direction,
    message.type,
    message.body,
    message.fileName,
    message.mimeType,
    message.status,
    message.createdAt,
  );
  return result.changes > 0;
}

export async function updateMessageStatus(id: string, status: MessageStatus) {
  const db = await dbPromise;
  await db.runAsync('UPDATE messages SET status = ? WHERE id = ?', status, id);
}

// Delivery acks must never downgrade a message that's already been read.
export async function updateDeliveryStatus(id: string, status: MessageStatus) {
  const db = await dbPromise;
  await db.runAsync(
    "UPDATE messages SET status = ? WHERE id = ? AND status != 'read'",
    status,
    id,
  );
}

export async function getUnreadIncomingIds(peerId: string): Promise<string[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM messages
     WHERE peerId = ? AND direction = 'in'
       AND createdAt > COALESCE((SELECT lastReadAt FROM reads WHERE peerId = ?), 0)`,
    peerId,
    peerId,
  );
  return rows.map((row) => row.id);
}

export async function loadMessages(): Promise<Message[]> {
  const db = await dbPromise;
  return db.getAllAsync<Message>('SELECT * FROM messages ORDER BY createdAt DESC');
}

export async function loadUndeliveredOutgoing(): Promise<Message[]> {
  const db = await dbPromise;
  return db.getAllAsync<Message>(
    "SELECT * FROM messages WHERE direction = 'out' AND status NOT IN ('delivered', 'read') ORDER BY createdAt",
  );
}

export async function loadMessagesWith(peerId: string): Promise<Message[]> {
  const db = await dbPromise;
  return db.getAllAsync<Message>(
    'SELECT * FROM messages WHERE peerId = ? ORDER BY createdAt',
    peerId,
  );
}

export type Conversation = {
  peerId: string;
  email: string | null;
  name: string | null;
  lastBody: string;
  lastType: MessageType;
  lastDirection: 'in' | 'out';
  lastStatus: MessageStatus;
  lastMessageAt: number;
  unread: number;
};

export async function loadConversations(): Promise<Conversation[]> {
  const db = await dbPromise;
  return db.getAllAsync<Conversation>(`
    SELECT
      m.peerId AS peerId,
      c.email AS email,
      c.name AS name,
      last.body AS lastBody,
      last.type AS lastType,
      last.direction AS lastDirection,
      last.status AS lastStatus,
      MAX(m.createdAt) AS lastMessageAt,
      SUM(
        CASE WHEN m.direction = 'in' AND m.createdAt > COALESCE(r.lastReadAt, 0)
        THEN 1 ELSE 0 END
      ) AS unread
    FROM messages m
    LEFT JOIN contacts c ON c.userId = m.peerId
    LEFT JOIN reads r ON r.peerId = m.peerId
    JOIN messages last ON last.id = (
      SELECT id FROM messages
      WHERE peerId = m.peerId
      ORDER BY createdAt DESC LIMIT 1
    )
    GROUP BY m.peerId
    ORDER BY lastMessageAt DESC
  `);
}

export async function markRead(peerId: string) {
  const db = await dbPromise;
  await db.runAsync(
    'INSERT OR REPLACE INTO reads (peerId, lastReadAt) VALUES (?, ?)',
    peerId,
    Date.now(),
  );
}

export async function clearAll() {
  const db = await dbPromise;
  await db.execAsync(
    'DELETE FROM messages; DELETE FROM contacts; DELETE FROM reads; DELETE FROM profile;',
  );
}
