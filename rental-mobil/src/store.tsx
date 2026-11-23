import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, RotateCcw, X } from 'lucide-react';
import { applyAction } from './domain';
import { makeSeed } from './seed';
import type { Action, State } from './types';

export const STORAGE_KEY = 'rental-mobil-demo:v1';
type Problem = 'corrupt' | 'temporary' | null;
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function validStored(value: unknown): value is State {
  if (!object(value) || value.version !== 1 || typeof value.now !== 'string' || !Number.isFinite(Date.parse(value.now)) || !['owner', 'staff', 'platform'].includes(String(value.role)) || typeof value.tenantId !== 'string') return false;
  const fields: Record<string, Record<string, string>> = {
    tenants: { id: 'string', name: 'string', code: 'string', status: 'string', contact: 'string' },
    settings: { tenantId: 'string', bufferMinutes: 'number', deposit: 'number', lateFee: 'number' },
    vehicles: { id: 'string', tenantId: 'string', plate: 'string', make: 'string', model: 'string', category: 'string', transmission: 'string', seats: 'number', color: 'string', status: 'string', archived: 'boolean' },
    customers: { id: 'string', tenantId: 'string', name: 'string', phone: 'string', verified: 'boolean', note: 'string', archived: 'boolean' },
    drivers: { id: 'string', tenantId: 'string', name: 'string', phone: 'string', status: 'string', archived: 'boolean' },
    bookings: { id: 'string', tenantId: 'string', number: 'string', customerId: 'string', vehicleId: 'string', service: 'string', basis: 'string', start: 'string', end: 'string', months: 'number', status: 'string', note: 'string', createdAt: 'string' },
    invoices: { id: 'string', tenantId: 'string', number: 'string', bookingId: 'string', kind: 'string', start: 'string', end: 'string', due: 'string', total: 'number', void: 'boolean' },
    cash: { id: 'string', tenantId: 'string', bookingId: 'string', kind: 'string', amount: 'number', method: 'string', reference: 'string', at: 'string', actor: 'string' },
    handovers: { id: 'string', tenantId: 'string', bookingId: 'string', direction: 'string', at: 'string', odometer: 'number', fuel: 'number', body: 'string', interior: 'string', equipment: 'boolean', notes: 'string' },
    activities: { id: 'string', tenantId: 'string', action: 'string', summary: 'string', at: 'string', actor: 'string' },
  };
  for (const [key, schema] of Object.entries(fields)) {
    const rows = value[key];
    if (!Array.isArray(rows) || !rows.every(row => object(row) && Object.entries(schema).every(([field, type]) => typeof row[field] === type && (type !== 'number' || Number.isSafeInteger(row[field]))))) return false;
  }
  const state = value as unknown as State;
  if (!state.tenants.some(t => t.id === state.tenantId) || state.tenants.some(t => !state.settings.some(s => s.tenantId === t.id))) return false;
  if (state.invoices.some(i => !Array.isArray(i.lines) || i.lines.some(l => !object(l) || typeof l.label !== 'string' || ![l.quantity, l.rate, l.amount].every(Number.isSafeInteger)))) return false;
  if (state.bookings.some(b => !['draft', 'confirmed', 'active', 'completed', 'cancelled'].includes(b.status) || !Number.isFinite(Date.parse(b.start)) || !Number.isFinite(Date.parse(b.end)) || (b.pricing !== null && (!object(b.pricing) || !['vehicleRate', 'driverRate', 'quantity', 'total', 'deposit', 'bufferMinutes', 'lateFee'].every(k => Number.isSafeInteger((b.pricing as unknown as Record<string, unknown>)[k])))))) return false;
  if ([...state.vehicles, ...state.drivers].some(v => ![v.dailyRate, v.monthlyRate].every(rate => rate === null || (Number.isSafeInteger(rate) && Number(rate) >= 0)))) return false;
  return true;
}
function load(): { state: State; problem: Problem } {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return { state: makeSeed(), problem: null }; const parsed: unknown = JSON.parse(raw); return validStored(parsed) ? { state: parsed, problem: null } : { state: makeSeed(), problem: 'corrupt' }; }
  catch (error) { return { state: makeSeed(), problem: error instanceof SyntaxError ? 'corrupt' : 'temporary' }; }
}
export function confirmLeave() { return !document.querySelector('form[data-dirty="true"]') || window.confirm('Ada isian yang belum disimpan. Tinggalkan perubahan?'); }
function useAppState() {
  const [initial] = useState(load);
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  const [problem, setProblem] = useState<Problem>(initial.problem);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);
  const persist = useCallback((next: State) => { stateRef.current = next; setState(next); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setProblem(null); } catch { setProblem('temporary'); } }, []);
  const run = useCallback((action: Action, message?: string): State | null => {
    try { const next = applyAction(stateRef.current, action); persist(next); if (message) notify(message); return next; }
    catch (error) { notify(error instanceof Error ? error.message : 'Perubahan tidak dapat disimpan.', true); return null; }
  }, [persist, notify]);
  const reset = useCallback(() => { if (!window.confirm('Reset seluruh data dan waktu demo? Perubahan di kedua perusahaan akan dihapus. Data aplikasi lain tidak berubah.')) return; persist(makeSeed()); notify('Data demo dikembalikan ke kondisi awal.'); }, [persist, notify]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), toast.error ? 9000 : 4000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const dirty = (event: Event) => { const target = event.target; if (target instanceof HTMLElement) { const form = target.closest('form'); if (form) form.dataset.dirty = 'true'; } };
    const leave = (event: BeforeUnloadEvent) => { if (document.querySelector('form[data-dirty="true"]')) { event.preventDefault(); event.returnValue = ''; } };
    document.addEventListener('input', dirty); document.addEventListener('change', dirty); window.addEventListener('beforeunload', leave);
    return () => { document.removeEventListener('input', dirty); document.removeEventListener('change', dirty); window.removeEventListener('beforeunload', leave); };
  }, []);
  return { state, run, notify, reset, problem, toast, dismissToast: () => setToast(null) };
}
type AppContextValue = ReturnType<typeof useAppState>;
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const value = useAppState();
  return <AppContext.Provider value={value}>{value.problem === 'corrupt' ? <main className="recovery"><AlertCircle size={38} /><h1>Data demo perlu dipulihkan</h1><p>Data lokal rusak atau versinya tidak cocok. Data lama belum ditimpa. Reset untuk memulai lagi dengan data contoh.</p><button className="button primary" onClick={value.reset}><RotateCcw size={16} />Reset data demo</button></main> : children}<div aria-live="polite" aria-atomic="true">{value.toast && <div className={`toast ${value.toast.error ? 'toast-error' : ''}`} role={value.toast.error ? 'alert' : 'status'}>{value.toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}<span>{value.toast.text}</span><button aria-label="Tutup notifikasi" onClick={value.dismissToast}><X size={16} /></button></div>}</div></AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error('AppProvider diperlukan.'); const { state } = context; return { ...context, tenant: state.tenants.find(t => t.id === state.tenantId)!, settings: state.settings.find(s => s.tenantId === state.tenantId)!, vehicles: state.vehicles.filter(v => v.tenantId === state.tenantId), customers: state.customers.filter(v => v.tenantId === state.tenantId), drivers: state.drivers.filter(v => v.tenantId === state.tenantId), bookings: state.bookings.filter(v => v.tenantId === state.tenantId), invoices: state.invoices.filter(v => v.tenantId === state.tenantId), cash: state.cash.filter(v => v.tenantId === state.tenantId), activities: state.activities.filter(v => v.tenantId === state.tenantId) }; }
