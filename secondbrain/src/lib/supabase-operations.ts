import { v5 as uuidv5 } from 'uuid';
import type { User } from '@supabase/supabase-js';
import { getDatabaseClient, supabase } from './supabase';

const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

export interface SupabaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  providerData: { providerId: string }[];
  photoURL: string | null;
  getIdToken: () => Promise<string>;
}

export type AuthUser = SupabaseUser;

export interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  mentioned_people?: string[];
  happiness?: number;
  stress?: number;
  neutral?: number;
  tranquility?: number;
  sadness?: number;
  mood_analyzed_at?: string;
}

export interface AudioTranscription {
  id: string;
  entry_id: string;
  audio_url: string;
  transcription: string;
  created_at: string;
}

export interface PersonDetailEntry { value: string; date: string; }
export interface PersonDetailCategory { entries: PersonDetailEntry[]; }
export interface Person {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  relationship?: string;
  category?: string;
  description?: string;
  mention_count?: number;
  details?: Record<string, PersonDetailCategory>;
}
export interface MoodData {
  id: string;
  user_id: string;
  date: string;
  stress_level: number;
  happiness_level: number;
  neutral_level: number;
  analysis_summary?: string;
  created_at: string;
  updated_at: string;
}

const getError = (error: { message?: string } | null) => error ? new Error(error.message) : null;
const iso = (value: string | null | undefined) => value || new Date().toISOString();
const dateOnly = (value: string) => value.split('T')[0];

function toSupabaseUser(user: User): SupabaseUser {
  const providers = user.app_metadata.providers;
  const provider = Array.isArray(providers) && providers.includes('google')
    ? 'google' : user.app_metadata.provider || 'email';
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || null,
    emailVerified: Boolean(user.email_confirmed_at),
    providerData: [{ providerId: provider === 'google' ? 'google.com' : provider }],
    photoURL: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    getIdToken: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('No hay una sesión activa');
      return data.session.access_token;
    },
  };
}

function entry(data: Record<string, unknown>): DiaryEntry {
  return {
    ...data,
    id: String(data.id), date: String(data.date), content: String(data.content || ''),
    user_id: String(data.user_id), created_at: iso(data.created_at as string), updated_at: iso(data.updated_at as string),
    mentioned_people: (data.mentioned_people as string[]) || [],
  } as DiaryEntry;
}

function person(data: Record<string, unknown>): Person {
  return {
    ...data,
    id: String(data.id), name: String(data.name), user_id: String(data.user_id),
    created_at: iso(data.created_at as string), updated_at: iso(data.updated_at as string),
    mention_count: Number(data.mention_count || 0), details: (data.details as Record<string, PersonDetailCategory>) || {},
  } as Person;
}

export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export async function getEntryByDate(date: string, userId: string): Promise<DiaryEntry | null> {
  const { data, error } = await getDatabaseClient().from('diary_entries').select('*').eq('user_id', userId).eq('date', date).maybeSingle();
  if (error) { console.error('Error al obtener entrada:', error); return null; }
  return data ? entry(data) : null;
}

export async function saveEntry(value: Partial<DiaryEntry>): Promise<DiaryEntry | null> {
  const database = getDatabaseClient();
  const now = new Date().toISOString();
  const payload = { content: value.content || '', mentioned_people: value.mentioned_people || [], updated_at: now };
  const result = value.id
    ? await database.from('diary_entries').update(payload).eq('id', value.id).select().single()
    : await database.from('diary_entries').insert({ ...payload, date: value.date, user_id: value.user_id, created_at: now }).select().single();
  if (result.error) { console.error('Error al guardar entrada:', result.error); return null; }
  return entry(result.data);
}

async function entriesQuery(userId: string, startDate?: string, endDate?: string) {
  let query = getDatabaseClient().from('diary_entries').select('*').eq('user_id', userId);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  const { data, error } = await query.order('date', { ascending: false });
  if (error) { console.error('Error al obtener entradas:', error); return []; }
  return (data || []).map(entry);
}
export const getDiaryEntriesByUserId = (userId: string) => entriesQuery(userId);
export async function getEntriesByMonth(year: number, month: number, userId: string) {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return entriesQuery(userId, start, end);
}
export const getEntriesByDateRange = (userId: string, startDate: string, endDate: string) => entriesQuery(userId, startDate, endDate);

export async function getPeopleByUserId(userId: string): Promise<Person[]> {
  const { data, error } = await getDatabaseClient().from('people').select('*').eq('user_id', userId).order('name');
  if (error) { console.error('Error al obtener personas:', error); return []; }
  return (data || []).map(person);
}

export async function savePerson(value: Partial<Person>): Promise<Person | null> {
  const database = getDatabaseClient();
  const now = new Date().toISOString();
  const { id, ...payload } = value;
  const result = id
    ? await database.from('people').update({ ...payload, updated_at: now }).eq('id', id).select().single()
    : await database.from('people').insert({ ...payload, created_at: now, updated_at: now }).select().single();
  if (result.error) { console.error('Error al guardar persona:', result.error); return null; }
  return person(result.data);
}

export async function signUpUser(email: string, password: string, displayName: string): Promise<AuthUser | null> {
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/` } });
  if (error) throw error;
  await supabase.auth.signOut();
  return null;
}

export async function signInUser(email: string, password: string): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user?.email_confirmed_at) {
    await supabase.auth.signOut();
    throw new Error('Debes verificar tu email antes de poder acceder. Revisa tu bandeja de entrada y haz clic en el enlace de verificación.');
  }
  return data.user ? toSupabaseUser(data.user) : null;
}

export async function signInWithGoogle(): Promise<AuthUser | null> {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
  if (error) throw error;
  return null;
}
export async function signOutUser() { const { error } = await supabase.auth.signOut(); if (error) throw error; }
export async function sendEmailVerificationToCurrentUser() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('No hay usuario autenticado');
  if (data.user.email_confirmed_at) throw new Error('El email ya está verificado');
  const { error } = await supabase.auth.resend({ type: 'signup', email: data.user.email || '', options: { emailRedirectTo: `${window.location.origin}/` } });
  if (error) throw error;
}
export async function resendEmailVerification(email: string, _password?: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/` } });
  if (error) throw error;
}
export async function updateUserProfile(updates: { displayName?: string }) {
  const { error } = await supabase.auth.updateUser({ data: { display_name: updates.displayName } });
  if (error) throw error;
}
export async function updateUserPassword(newPassword: string) {
  if (newPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
export async function resetUserPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  if (error) throw error;
}
export async function deleteUserAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('No hay usuario autenticado');
  const response = await fetch('/api/account/delete', { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}` } });
  if (!response.ok) throw new Error((await response.json()).error || 'No se pudo eliminar la cuenta');
  await supabase.auth.signOut();
}
export const deleteUserAccountWithPassword = async () => deleteUserAccount();
export async function getUserInfo() {
  const { data } = await supabase.auth.getUser();
  return { name: data.user?.user_metadata?.display_name || data.user?.email?.split('@')[0] || 'Usuario', email: data.user?.email || null };
}

export function getPersonDetailsWithDates(value: Person) { return value.details || {}; }
const capitalize = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
const similar = (left: string, right: string) => left.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === right.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export async function saveExtractedPersonInfo(personName: string, information: Record<string, unknown>, userId: string, entryDate?: string): Promise<Person | null> {
  const { data, error } = await getDatabaseClient().from('people').select('*').eq('user_id', userId).eq('name', personName).maybeSingle();
  if (error) { console.error('Error al buscar persona:', error); return null; }
  const current = data ? person(data) : { user_id: userId, name: personName, details: {} };
  const details: Record<string, PersonDetailCategory> = current.details || {};
  const date = entryDate || new Date().toISOString().slice(0, 10);
  for (const [rawKey, rawValue] of Object.entries(information)) {
    if (!rawValue) continue;
    const key = rawKey === 'cumpleanos' ? 'cumpleaños' : rawKey;
    const category = details[key] || { entries: [] };
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const raw of values) {
      if (typeof raw !== 'string') continue;
      const value = capitalize(raw);
      const unique = ['rol', 'relacion', 'cumpleaños', 'direccion'].includes(key);
      const matching = category.entries.find(item => item.date === date);
      if (unique && matching) matching.value = value;
      else if (!category.entries.some(item => item.date === date && similar(item.value, value))) category.entries.push({ value, date });
    }
    details[key] = category;
  }
  return savePerson({ ...current, details });
}

export async function addPersonDetail(personId: string, category: string, value: string, date?: string) {
  const { data, error } = await getDatabaseClient().from('people').select('*').eq('id', personId).maybeSingle();
  if (error || !data) return null;
  const current = person(data);
  return saveExtractedPersonInfo(current.name, { [category]: value }, current.user_id, date);
}

export async function saveAudioTranscription(entryId: string, audioUrl: string, transcription: string): Promise<AudioTranscription | null> {
  const { data, error } = await getDatabaseClient().from('audio_transcriptions').insert({ entry_id: entryId, audio_url: audioUrl, transcription }).select().single();
  if (error) { console.error('Error al guardar transcripción:', error); return null; }
  return { ...data, created_at: iso(data.created_at) };
}
export async function getTranscriptionsByEntryId(entryId: string): Promise<AudioTranscription[]> {
  const { data, error } = await getDatabaseClient().from('audio_transcriptions').select('*').eq('entry_id', entryId).order('created_at');
  if (error) return [];
  return (data || []).map(item => ({ ...item, created_at: iso(item.created_at) }));
}

export async function saveMoodData(value: Partial<MoodData>): Promise<MoodData | null> {
  if (!value.user_id || !value.date) return null;
  const now = new Date().toISOString();
  const { data, error } = await getDatabaseClient().from('mood_data').upsert({
    id: uuidv5(`mood-${value.user_id}-${value.date}`, NAMESPACE), user_id: value.user_id, date: value.date,
    stress_level: value.stress_level || 0, happiness_level: value.happiness_level || 0, neutral_level: value.neutral_level || 0,
    analysis_summary: value.analysis_summary || '', updated_at: now,
  }, { onConflict: 'user_id,date' }).select().single();
  if (error) return null;
  return { ...data, created_at: iso(data.created_at), updated_at: iso(data.updated_at) };
}
export async function getMoodDataByPeriod(userId: string, startDate: string, endDate: string): Promise<MoodData[]> {
  const { data, error } = await getDatabaseClient().from('mood_data').select('*').eq('user_id', userId).gte('date', startDate).lte('date', endDate).order('date', { ascending: false });
  if (error) return [];
  return (data || []).map(item => ({ ...item, created_at: iso(item.created_at), updated_at: iso(item.updated_at) }));
}
export async function incrementPersonMentionCount(userId: string, personName: string) {
  const { data } = await getDatabaseClient().from('people').select('id, mention_count').eq('user_id', userId).eq('name', personName).maybeSingle();
  if (data) await getDatabaseClient().from('people').update({ mention_count: Number(data.mention_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', data.id);
}
export async function updateEntryMoodData(entryId: string, mood: { happiness: number; stress: number; tranquility: number; sadness: number }) {
  const { error } = await getDatabaseClient().from('diary_entries').update({ ...mood, mood_analyzed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', entryId);
  return !error;
}
export async function getEntriesMoodDataByDateRange(userId: string, startDate: string, endDate: string) {
  const { data, error } = await getDatabaseClient().from('diary_entries').select('date, happiness, stress, tranquility, sadness').eq('user_id', userId).gte('date', startDate).lte('date', endDate).not('happiness', 'is', null);
  if (error) return [];
  return (data || []).map(item => ({ date: dateOnly(item.date), happiness: Number(item.happiness || 0), stress: Number(item.stress || 0), tranquility: Number(item.tranquility || 0), sadness: Number(item.sadness || 0) }));
}
