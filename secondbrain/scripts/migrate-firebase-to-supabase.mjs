import { readFile, writeFile, chmod } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const namespace = '1b671a64-40d5-491e-99b0-da01ff1f3341';
function uuidv5(name, namespaceUuid) {
  const ns = Buffer.from(namespaceUuid.replaceAll('-', ''), 'hex');
  const bytes = createHash('sha1').update(ns).update(name).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const directory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(directory, '..');
const snapshot = process.argv[2];
const apply = process.argv.includes('--apply');

if (!snapshot) {
  console.error('Uso: node scripts/migrate-firebase-to-supabase.mjs <directorio-exportacion> [--apply]');
  process.exit(1);
}

function parseEnv(source) {
  return Object.fromEntries(source.split('\n')
    .filter(line => line && !line.trimStart().startsWith('#') && line.includes('='))
    .map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }));
}

const env = parseEnv(await readFile(path.join(appRoot, '.env.local'), 'utf8'));
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const readSnapshot = async name => JSON.parse(await readFile(path.join(snapshot, name), 'utf8'));
function decode(field) {
  if (field === undefined) return undefined;
  if ('nullValue' in field) return null;
  for (const key of ['stringValue', 'timestampValue', 'referenceValue', 'booleanValue', 'doubleValue']) {
    if (key in field) return field[key];
  }
  if ('integerValue' in field) return Number(field.integerValue);
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(decode);
  if ('mapValue' in field) {
    return Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([key, value]) => [key, decode(value)]));
  }
  throw new Error('Tipo Firestore no admitido: ' + Object.keys(field).join(','));
}
function convertDocument(document) {
  return {
    sourcePath: document.name.split('/documents/')[1],
    firebaseId: document.name.split('/').at(-1),
    data: Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)])),
    raw: document,
  };
}
const source = {
  entries: (await readSnapshot('diary_entries.json')).map(convertDocument),
  people: (await readSnapshot('people.json')).map(convertDocument),
  profiles: (await readSnapshot('users.json')).map(convertDocument),
  auth: await readSnapshot('firebase_auth_users.json'),
};
const summary = { source: {
  auth: source.auth.length,
  profiles: source.profiles.length,
  entries: source.entries.length,
  people: source.people.length,
}, createdUsers: 0, profiles: 0, entries: 0, people: 0, mergedPeople: 0, unmapped: 0 };
const byEmail = new Map();
let page = 1;
while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const user of data.users) {
    const key = user.email?.trim().toLowerCase();
    if (!key) continue;
    if (byEmail.has(key)) throw new Error('Email duplicado en Supabase Auth');
    byEmail.set(key, user);
  }
  if (data.users.length < 1000) break;
  page++;
}

const userMap = new Map();
for (const user of source.auth) {
  if (!user.localId || !user.email) throw new Error('Usuario de Firebase sin UID o email');
  const key = user.email.trim().toLowerCase();
  let destination = byEmail.get(key);
  if (!destination && !apply) {
    userMap.set(user.localId, 'pending:' + user.localId);
    continue;
  }
  if (!destination && apply) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: randomBytes(36).toString('base64url'),
      email_confirm: Boolean(user.emailVerified),
      user_metadata: { display_name: user.displayName || '' },
      app_metadata: { legacy_firebase_uid: user.localId, legacy_password_reset_required: !user.providerUserInfo?.some(p => p.providerId === 'google.com') },
    });
    if (error || !data.user) throw error || new Error('Supabase no creó el usuario');
    destination = data.user;
    byEmail.set(key, destination);
    summary.createdUsers++;
  }
  if (destination) userMap.set(user.localId, destination.id);
}

const orphans = [];
for (const profile of source.profiles) {
  const owner = profile.data.uid || profile.firebaseId;
  const uid = userMap.get(owner);
  if (!uid) {
    orphans.push({ ...profile, collection: 'users', owner, reason: 'Perfil sin usuario en Firebase Auth' });
    continue;
  }
  if (!apply) continue;
  const { data: current, error: lookupError } = await supabase.from('profiles').select('*').eq('uid', uid).maybeSingle();
  if (lookupError) throw lookupError;
  const firebaseSubscription = profile.data.subscription || {};
  const currentSubscription = current?.subscription || {};
  const currentUpdated = Date.parse(currentSubscription.updatedAt || current?.created_at || '') || 0;
  const sourceUpdated = Date.parse(firebaseSubscription.updatedAt || profile.data.createdAt || '') || 0;
  const preferred = sourceUpdated > currentUpdated ? firebaseSubscription : currentSubscription;
  const subscription = {
    ...preferred,
    stripeCustomerId: preferred.stripeCustomerId || firebaseSubscription.stripeCustomerId || currentSubscription.stripeCustomerId,
    stripeSubscriptionId: preferred.stripeSubscriptionId || firebaseSubscription.stripeSubscriptionId || currentSubscription.stripeSubscriptionId,
  };
  for (const key of ['stripeCustomerId', 'stripeSubscriptionId']) if (!subscription[key]) delete subscription[key];
  const authUser = source.auth.find(user => user.localId === owner);
  const createdAt = [profile.data.createdAt, current?.created_at].filter(Boolean).sort()[0];
  const lastLoginAt = [profile.data.lastLoginAt, current?.last_login_at].filter(Boolean).sort().at(-1);
  const payload = {
    uid, email: authUser.email, display_name: profile.data.displayName || current?.display_name || '',
    is_google_user: Boolean(profile.data.isGoogleUser),
    subscription, is_first_login: profile.data.isFirstLogin ?? current?.is_first_login ?? true,
    has_completed_first_payment: profile.data.hasCompletedFirstPayment ?? current?.has_completed_first_payment ?? false,
    show_welcome_modal: profile.data.showWelcomeModal ?? current?.show_welcome_modal ?? false,
    created_at: createdAt, last_login_at: lastLoginAt,
  };
  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'uid' });
  if (error) throw error;
  summary.profiles++;
}

const existingEntries = new Map();
for (const uid of userMap.values()) {
  if (uid.startsWith('pending:')) continue;
  const { data, error } = await supabase.from('diary_entries').select('*').eq('user_id', uid);
  if (error) throw error;
  for (const row of data) existingEntries.set(uid + ':' + row.date, row);
}
for (const document of source.entries) {
  const value = document.data;
  const uid = userMap.get(value.user_id);
  if (!uid) {
    orphans.push({ ...document, collection: 'diary_entries', owner: value.user_id || '', reason: 'Entrada sin usuario verificable' });
    continue;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date || '')) throw new Error('Fecha de entrada inválida');
  const key = uid + ':' + value.date;
  const current = existingEntries.get(key);
  if (!apply) continue;
  const mentioned = [...new Set([...(current?.mentioned_people || []), ...(value.mentioned_people || [])])];
  const sourceNewer = !current || Date.parse(value.updated_at || '') > Date.parse(current.updated_at || '');
  const payload = {
    content: sourceNewer ? (value.content || '') : current.content,
    mentioned_people: mentioned,
    updated_at: sourceNewer ? value.updated_at : current.updated_at,
    happiness: sourceNewer ? (value.happiness ?? null) : current.happiness,
    stress: sourceNewer ? (value.stress ?? null) : current.stress,
    tranquility: sourceNewer ? (value.tranquility ?? null) : current.tranquility,
    sadness: sourceNewer ? (value.sadness ?? null) : current.sadness,
    mood_analyzed_at: sourceNewer ? (value.mood_analyzed_at ?? null) : current.mood_analyzed_at,
  };
  const result = current
    ? await supabase.from('diary_entries').update(payload).eq('id', current.id)
    : await supabase.from('diary_entries').insert({
      ...payload, id: uuidv5('firestore/' + document.sourcePath, namespace),
      user_id: uid, date: value.date, created_at: value.created_at,
    });
  if (result.error) throw result.error;
  if (!current) summary.entries++;
  existingEntries.set(key, { ...current, ...payload });
}

function normalizedName(name) {
  return String(name || '').normalize('NFKC').trim().toLocaleLowerCase('es');
}
function mergeDetails(left, right) {
  const result = structuredClone(left || {});
  for (const [category, value] of Object.entries(right || {})) {
    const prior = result[category] || {};
    const entries = [...(prior.entries || []), ...(value.entries || [])];
    const seen = new Set();
    result[category] = { ...prior, ...value, entries: entries.filter(item => {
      const key = JSON.stringify([item.value, item.date]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }) };
  }
  return result;
}
const groups = new Map();
for (const uid of userMap.values()) {
  if (uid.startsWith('pending:')) continue;
  const { data, error } = await supabase.from('people').select('*').eq('user_id', uid);
  if (error) throw error;
  for (const row of data) {
    const key = uid + ':' + normalizedName(row.name);
    if (!groups.has(key)) groups.set(key, { existing: [], source: [], uid });
    groups.get(key).existing.push(row);
  }
}
for (const document of source.people) {
  const uid = userMap.get(document.data.user_id);
  if (!uid) {
    orphans.push({ ...document, collection: 'people', owner: document.data.user_id || '', reason: 'Persona sin usuario verificable' });
    continue;
  }
  if (!normalizedName(document.data.name)) throw new Error('Persona sin nombre');
  const key = uid + ':' + normalizedName(document.data.name);
  if (!groups.has(key)) groups.set(key, { existing: [], source: [], uid });
  groups.get(key).source.push(document);
}
for (const { existing, source: documents, uid } of groups.values()) {
  if (!documents.length && existing.length < 2) continue;
  const rows = [
    ...existing.map(row => ({ row, source: false })),
    ...documents.map(document => ({ row: document.data, source: true, document })),
  ].sort((a, b) => Date.parse(a.row.updated_at || '') - Date.parse(b.row.updated_at || ''));
  const canonical = [...existing].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];
  const newest = rows.at(-1).row;
  const details = rows.reduce((result, item) => mergeDetails(result, item.row.details), {});
  const createdAt = rows.map(item => item.row.created_at).filter(Boolean).sort()[0];
  const updatedAt = rows.map(item => item.row.updated_at).filter(Boolean).sort().at(-1);
  const lastValue = field => rows.map(item => item.row[field]).filter(Boolean).at(-1) || null;
  const payload = {
    user_id: uid, name: newest.name, details,
    mention_count: Math.max(...rows.map(item => Number(item.row.mention_count || 0))),
    relationship: lastValue('relationship'), category: lastValue('category'),
    description: lastValue('description'), created_at: createdAt, updated_at: updatedAt,
  };
  if (!apply) continue;
  const result = canonical
    ? await supabase.from('people').update(payload).eq('id', canonical.id)
    : await supabase.from('people').insert({
      ...payload, id: uuidv5('firestore/' + documents[0].sourcePath, namespace),
    });
  if (result.error) throw result.error;
  if (!canonical) summary.people++;
  const duplicateIds = existing.filter(row => row.id !== canonical?.id).map(row => row.id);
  if (duplicateIds.length) {
    const { error } = await supabase.from('people').delete().in('id', duplicateIds);
    if (error) throw error;
    summary.mergedPeople += duplicateIds.length;
  }
}

summary.unmapped = orphans.length;
if (apply) {
  const safeFile = path.join(snapshot, 'migration_result.json');
  await writeFile(safeFile, JSON.stringify({
    summary,
    userMap: [...userMap.entries()],
    unmapped: orphans.map(item => ({
      sourcePath: item.sourcePath, collection: item.collection, owner: item.owner,
      reason: item.reason, raw: item.raw,
    })),
  }, null, 2));
  await chmod(safeFile, 0o600);
}
console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry_run', ...summary }, null, 2));
