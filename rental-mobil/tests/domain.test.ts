import { describe, expect, it } from 'vitest';
import { addMonths, applyAction, bookingDebt, conflict, depositBalance, invoiceBalance, invoicePaid, invoiceStatus, quote } from '../src/domain';
import { makeSeed } from '../src/seed';
import type { Action, DraftInput, HandoverInput, Invoice, State } from '../src/types';

const NOW = '2026-11-13T02:00:00.000Z';
const HOUR = 3_600_000;
const plus = (time: string, milliseconds: number) => new Date(Date.parse(time) + milliseconds).toISOString();
const wib = (date: string, time = '09:00') => new Date(`${date}T${time}:00+07:00`).toISOString();
const OUT: HandoverInput = { odometer: 1_000, fuel: 100, body: 'Baik', interior: 'Bersih', equipment: true, notes: '' };
const IN: HandoverInput = { ...OUT, odometer: 1_100, fuel: 75 };
const raw = (value: unknown) => value as Action;

function fixture(): State {
  const state: State = { version: 1, now: NOW, tenantId: 't1', role: 'owner', tenants: [], settings: [], vehicles: [], customers: [], drivers: [], bookings: [], invoices: [], cash: [], handovers: [], activities: [] };
  for (const tenantId of ['t1', 't2']) {
    state.tenants.push({ id: tenantId, name: tenantId === 't1' ? 'Nusantara Rent' : 'Langit Rental', code: tenantId.toUpperCase(), status: 'active', contact: '' });
    state.settings.push({ tenantId, bufferMinutes: 120, deposit: 500_000, lateFee: 50_000 });
    for (let n = 1; n <= 3; n++) state.vehicles.push({ id: `${tenantId}-v${n}`, tenantId, archived: false, plate: `B ${1000 + n} SIM`, make: 'Toyota', model: 'Avanza', category: 'MPV', transmission: 'Automatic', seats: 7, color: 'Putih', dailyRate: 350_000, monthlyRate: 6_000_000, status: 'ready' });
    for (let n = 1; n <= 2; n++) {
      state.customers.push({ id: `${tenantId}-c${n}`, tenantId, archived: false, name: `Pelanggan Fiktif ${n}`, phone: '08xx-0000-0001', verified: true, note: '' });
      state.drivers.push({ id: `${tenantId}-d${n}`, tenantId, archived: false, name: `Sopir Fiktif ${n}`, phone: '08xx-0000-0002', dailyRate: 200_000, monthlyRate: 3_000_000, status: 'active' });
    }
  }
  return state;
}
function draft(id = 'b1', patch: Partial<DraftInput> = {}): DraftInput {
  return { id, customerId: 't1-c1', vehicleId: 't1-v1', driverId: null, service: 'self', basis: 'daily', start: NOW, end: plus(NOW, 24 * HOUR), months: 1, note: '', ...patch };
}
function run(state: State, ...actions: Action[]): State { return actions.reduce(applyAction, state); }
function book(state = fixture(), id = 'b1', patch: Partial<DraftInput> = {}, confirmed = true): State {
  const next = applyAction(state, { type: 'draft', value: draft(id, patch) });
  return confirmed ? applyAction(next, { type: 'confirm', id }) : next;
}
function invoice(state: State, bookingId = 'b1'): Invoice { return state.invoices.find(item => item.bookingId === bookingId)!; }
function deposit(state: State, bookingId = 'b1', amount = 500_000): State {
  return applyAction(state, { type: 'cash', bookingId, invoiceId: null, kind: 'deposit_received', amount, method: 'cash', reference: 'DEP' });
}
function payment(state: State, amount: number, bookingId = 'b1', reference = 'PAY'): State {
  return applyAction(state, { type: 'cash', bookingId, invoiceId: invoice(state, bookingId).id, kind: 'rental_payment', amount, method: 'transfer', reference });
}
function active(state = book()): State {
  return applyAction(deposit(state), { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true });
}
function returned(state = active(), extra = 0, reason = ''): State {
  return applyAction(state, { type: 'in', id: 'b1', value: IN, extra, reason });
}
function rejectUnchanged(state: State, action: Action, error?: RegExp): void {
  const before = structuredClone(state);
  expect(() => applyAction(state, action)).toThrow(error ?? Error);
  expect(state).toEqual(before);
}
function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freezeDeep); }
}

describe('pure transactions and context / TC-01, TC-02, TC-27', () => {
  it('clones the state and never retains mutable action references', () => {
    const state = fixture(), action: Action = { type: 'customer', value: { ...state.customers[0], name: 'Aruna Fiktif' } };
    freezeDeep(state);
    const next = applyAction(state, action);
    expect(next).not.toBe(state);
    expect(next.vehicles[0]).not.toBe(state.vehicles[0]);
    action.value.name = 'Diubah di luar';
    expect(next.customers[0].name).toBe('Aruna Fiktif');
    expect(state.customers[0].name).toBe('Pelanggan Fiktif 1');
    expect(next.activities[0]).toMatchObject({ tenantId: 't1', actor: 'owner', at: NOW });
  });
  it('is deterministic for the same state and action', () => {
    const state = fixture(), action: Action = { type: 'draft', value: draft() };
    expect(applyAction(state, action)).toEqual(applyAction(state, action));
    expect(makeSeed()).toEqual(makeSeed());
  });
  it('creates empty tenants with settings and simulated owner/staff contexts', () => {
    let state = applyAction(fixture(), { type: 'context', tenantId: '', role: 'platform' });
    const tenant = { id: 't3', name: 'Senja Rental', code: ' senja ', status: 'active' as const, contact: '' };
    state = applyAction(state, { type: 'tenant', value: tenant });
    expect(state.tenants.at(-1)?.code).toBe('SENJA');
    expect(state.settings.at(-1)).toEqual({ tenantId: 't3', deposit: 500_000, lateFee: 0, bufferMinutes: 120 });
    expect(state.bookings.filter(item => item.tenantId === 't3')).toEqual([]);
    rejectUnchanged(state, { type: 'tenant', value: { ...tenant, id: 't4', code: 'SenJa' } }, /Kode/);
    for (const role of ['owner', 'staff'] as const) expect(applyAction(state, { type: 'context', tenantId: 't3', role }).role).toBe(role);
  });
  it('deactivation preserves all data and forbids operational access until reactivation', () => {
    const original = book();
    let state = applyAction(original, { type: 'context', tenantId: 't1', role: 'platform' });
    state = applyAction(state, { type: 'tenant', value: { ...state.tenants[0], status: 'inactive' } });
    expect(state.bookings).toEqual(original.bookings);
    rejectUnchanged(state, { type: 'context', tenantId: 't1', role: 'owner' }, /nonaktif/);
    rejectUnchanged({ ...state, role: 'owner' }, { type: 'confirm', id: 'b1' }, /nonaktif/);
    rejectUnchanged({ ...state, role: 'staff' }, { type: 'clock', at: plus(NOW, HOUR) }, /nonaktif/);
    state = applyAction(state, { type: 'tenant', value: { ...state.tenants[0], status: 'active' } });
    expect(applyAction(state, { type: 'context', tenantId: 't1', role: 'owner' }).bookings).toEqual(original.bookings);
  });
  it('limits platform actions and guards all exported operational queries', () => {
    const source = book(), state = { ...source, role: 'platform' as const };
    const actions: Action[] = [
      { type: 'settings', value: source.settings[0] }, { type: 'customer', value: source.customers[0] },
      { type: 'vehicle', value: source.vehicles[0] }, { type: 'driver', value: source.drivers[0] },
      { type: 'draft', value: draft('b2') }, { type: 'confirm', id: 'b1' }, { type: 'cancel', id: 'b1', reason: 'Batal' },
      { type: 'cash', bookingId: 'b1', invoiceId: invoice(source).id, kind: 'rental_payment', amount: 1, method: 'cash', reference: '' },
      { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true }, { type: 'in', id: 'b1', value: IN, extra: 0, reason: '' },
    ];
    actions.forEach(action => rejectUnchanged(state, action, /platform/));
    for (const query of [() => quote(state, draft()), () => conflict(state, 'vehicle', 't1-v1', NOW, plus(NOW, HOUR)), () => invoicePaid(state, invoice(state)), () => invoiceBalance(state, invoice(state)), () => invoiceStatus(state, invoice(state)), () => bookingDebt(state, 'b1'), () => depositBalance(state, 'b1')]) expect(query).toThrow(/platform/);
    expect(applyAction(state, { type: 'clock', at: plus(NOW, HOUR) }).now).toBe(plus(NOW, HOUR));
  });
  it('denies tenant CRUD to owner and staff and rejects unknown roles/tenants/actions', () => {
    for (const role of ['owner', 'staff'] as const) rejectUnchanged({ ...fixture(), role }, { type: 'tenant', value: fixture().tenants[0] }, /platform/);
    for (const action of [raw({ type: 'context', tenantId: 't1', role: 'admin' }), { type: 'context', tenantId: 'missing', role: 'owner' } as Action, raw({ type: 'erase' }), raw(null)]) rejectUnchanged(fixture(), action);
  });
  it('rejects direct foreign-tenant writes, even when an existing ID is spoofed with the current tenant', () => {
    const state = fixture();
    for (const action of [
      { type: 'customer', value: state.customers.find(item => item.tenantId === 't2') },
      { type: 'vehicle', value: state.vehicles.find(item => item.tenantId === 't2') },
      { type: 'driver', value: state.drivers.find(item => item.tenantId === 't2') },
      { type: 'settings', value: state.settings[1] },
      { type: 'customer', value: { ...state.customers.find(item => item.tenantId === 't2'), tenantId: 't1' } },
      { type: 'vehicle', value: { ...state.vehicles.find(item => item.tenantId === 't2'), tenantId: 't1' } },
      { type: 'driver', value: { ...state.drivers.find(item => item.tenantId === 't2'), tenantId: 't1' } },
    ]) rejectUnchanged(state, raw(action), /perusahaan/);
  });
  it.each(['customerId', 'vehicleId', 'driverId'] as const)('rejects a foreign booking %s in save and quote', field => {
    const patch = field === 'driverId' ? { service: 'driver' as const, driverId: 't2-d1' } : { [field]: field === 'customerId' ? 't2-c1' : 't2-v1' };
    const value = draft('b1', patch);
    rejectUnchanged(fixture(), { type: 'draft', value }, /perusahaan/);
    expect(() => quote(fixture(), value)).toThrow(/perusahaan/);
  });
  it('rejects foreign booking IDs in every lifecycle and ledger action', () => {
    const source = book(), state = applyAction(source, { type: 'context', tenantId: 't2', role: 'staff' });
    const actions: Action[] = [
      { type: 'draft', value: draft('b1', { customerId: 't2-c1', vehicleId: 't2-v1' }) },
      { type: 'confirm', id: 'b1' }, { type: 'cancel', id: 'b1', reason: 'Batal' },
      { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true }, { type: 'in', id: 'b1', value: IN, extra: 0, reason: '' },
      { type: 'cash', bookingId: 'b1', invoiceId: invoice(source).id, kind: 'rental_payment', amount: 100, method: 'cash', reference: '' },
    ];
    actions.forEach(action => rejectUnchanged(state, action, /perusahaan/));
    for (const query of [() => invoicePaid(state, invoice(source)), () => invoiceBalance(state, invoice(source)), () => invoiceStatus(state, invoice(source)), () => depositBalance(state, 'b1'), () => bookingDebt(state, 'b1'), () => conflict(state, 'vehicle', 't1-v1', NOW, plus(NOW, HOUR)), () => conflict(state, 'vehicle', 't2-v1', NOW, plus(NOW, HOUR), 'b1')]) expect(query).toThrow(/perusahaan/);
  });
  it('rejects invoice references from another tenant or booking', () => {
    let state = book();
    state = book(state, 'b2', { vehicleId: 't1-v2' });
    rejectUnchanged(state, { type: 'cash', bookingId: 'b2', invoiceId: invoice(state).id, kind: 'rental_payment', amount: 100, method: 'cash', reference: '' }, /bukan milik/);
    state = applyAction(state, { type: 'context', tenantId: 't2', role: 'owner' });
    state = book(state, 'foreign', { vehicleId: 't2-v1', customerId: 't2-c1' });
    state = applyAction(state, { type: 'context', tenantId: 't1', role: 'owner' });
    rejectUnchanged(state, { type: 'cash', bookingId: 'b1', invoiceId: invoice(state, 'foreign').id, kind: 'rental_payment', amount: 100, method: 'cash', reference: '' }, /perusahaan/);
    expect(() => invoiceBalance(state, { ...invoice(state, 'foreign'), tenantId: 't1' })).toThrow(/perusahaan/);
    expect(invoiceBalance(state, { ...invoice(state), total: 1 })).toBe(350_000);
  });
});

describe('master data and policy validation / TC-02, TC-12, TC-26', () => {
  it('allows staff nonprice edits and unpriced creation, but never tariff changes', () => {
    const state = { ...fixture(), role: 'staff' as const };
    expect(applyAction(state, { type: 'vehicle', value: { ...state.vehicles[0], color: 'Merah' } }).vehicles[0].color).toBe('Merah');
    expect(applyAction(state, { type: 'driver', value: { ...state.drivers[0], phone: '08xx-0000-9999' } }).drivers[0].phone).toContain('9999');
    rejectUnchanged(state, { type: 'settings', value: state.settings[0] }, /pemilik/);
    for (const type of ['vehicle', 'driver'] as const) {
      const value = type === 'vehicle' ? state.vehicles[0] : state.drivers[0];
      rejectUnchanged(state, raw({ type, value: { ...value, dailyRate: 1 } }), /pemilik/);
      rejectUnchanged(state, raw({ type, value: { ...value, monthlyRate: null } }), /pemilik/);
      rejectUnchanged(state, raw({ type, value: { ...value, id: 'new', plate: 'B 9999 SIM' } }), /pemilik/);
      const next = applyAction(state, raw({ type, value: { ...value, id: 'new', plate: 'B 9999 SIM', dailyRate: null, monthlyRate: null } }));
      expect((type === 'vehicle' ? next.vehicles : next.drivers).find(item => item.id === 'new')?.dailyRate).toBeNull();
    }
  });
  it('normalizes plates per tenant, including archived plates', () => {
    const state = fixture();
    rejectUnchanged(state, { type: 'vehicle', value: { ...state.vehicles[1], plate: ' b1001  sim ' } }, /Pelat/);
    expect(applyAction(state, { type: 'vehicle', value: { ...state.vehicles[0], plate: ' b 1001   sim ' } }).vehicles[0].plate).toBe('B 1001 SIM');
    const first = applyAction(state, { type: 'vehicle', value: { ...state.vehicles[0], plate: 'B 7777 SIM' } });
    const second = applyAction(first, { type: 'context', tenantId: 't2', role: 'owner' });
    expect(applyAction(second, { type: 'vehicle', value: { ...second.vehicles.find(item => item.id === 't2-v1')!, plate: 'B 7777 SIM' } }).vehicles.find(item => item.id === 't2-v1')?.plate).toBe('B 7777 SIM');
    const archived = applyAction(state, { type: 'vehicle', value: { ...state.vehicles[0], archived: true } });
    rejectUnchanged(archived, { type: 'vehicle', value: { ...state.vehicles[1], plate: 'B1001SIM' } }, /Pelat/);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '120'])('rejects invalid nonnegative policy value %s', invalid => {
    const state = fixture();
    for (const key of ['bufferMinutes', 'deposit', 'lateFee']) rejectUnchanged(state, raw({ type: 'settings', value: { ...state.settings[0], [key]: invalid } }), /bilangan bulat/);
  });
  it.each([
    ['vehicle', 'status', 'available'], ['vehicle', 'transmission', 'CVT'], ['vehicle', 'seats', 0], ['vehicle', 'seats', 61], ['vehicle', 'dailyRate', 0], ['vehicle', 'monthlyRate', -1], ['vehicle', 'archived', 'false'],
    ['customer', 'verified', 'true'], ['customer', 'name', ' '], ['driver', 'status', 'ready'], ['driver', 'dailyRate', -1],
  ])('rejects invalid %s.%s', (type, key, invalid) => {
    const state = fixture();
    const source = type === 'vehicle' ? state.vehicles[0] : type === 'customer' ? state.customers[0] : state.drivers[0];
    rejectUnchanged(state, raw({ type, value: { ...source, [key]: invalid } }));
  });
  it('allows explicit zero driver rate and zero policies, never an unconfigured rate', () => {
    let state = fixture();
    state = applyAction(state, { type: 'driver', value: { ...state.drivers[0], dailyRate: 0 } });
    expect(quote(state, draft('b1', { service: 'driver', driverId: 't1-d1' })).total).toBe(350_000);
    state = applyAction(state, { type: 'settings', value: { tenantId: 't1', deposit: 0, lateFee: 0, bufferMinutes: 0 } });
    state = book(state);
    state = applyAction(state, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true });
    expect(state.bookings[0].status).toBe('active');
  });
  it('allows complete drafts without tariffs but blocks confirmation', () => {
    const state = fixture(); state.vehicles[0].dailyRate = null;
    const next = book(state, 'b1', {}, false);
    expect(next.bookings).toHaveLength(1);
    rejectUnchanged(next, { type: 'confirm', id: 'b1' }, /Tarif/);
    state.vehicles[0].dailyRate = 350_000; state.drivers[0].monthlyRate = null;
    const monthly = draft('b2', { service: 'driver', driverId: 't1-d1', basis: 'monthly', end: addMonths(NOW, 1) });
    expect(() => quote(state, monthly)).toThrow(/Tarif/);
  });
  it.each(['confirmed', 'active'] as const)('protects all bound entities when %s', status => {
    let state = book(fixture(), 'b1', { service: 'driver', driverId: 't1-d1' });
    if (status === 'active') state = active(state);
    const actions: Action[] = [
      { type: 'vehicle', value: { ...state.vehicles[0], status: 'inactive' } },
      { type: 'vehicle', value: { ...state.vehicles[0], status: 'maintenance' } },
      { type: 'vehicle', value: { ...state.vehicles[0], archived: true } },
      { type: 'driver', value: { ...state.drivers[0], status: 'inactive' } },
      { type: 'driver', value: { ...state.drivers[0], archived: true } },
      { type: 'customer', value: { ...state.customers[0], archived: true } },
    ];
    actions.forEach(action => rejectUnchanged(state, action, /terikat/));
  });
  it('allows historical archives without deleting balances or references', () => {
    let state = returned();
    state = applyAction(state, { type: 'customer', value: { ...state.customers[0], archived: true } });
    state = applyAction(state, { type: 'vehicle', value: { ...state.vehicles[0], archived: true } });
    expect(bookingDebt(state, 'b1')).toBe(350_000);
    expect(depositBalance(state, 'b1')).toBe(500_000);
    rejectUnchanged(state, { type: 'draft', value: draft('b2') }, /arsip/);
  });
  it('enforces global IDs across entity collections', () => {
    const state = fixture();
    rejectUnchanged(state, { type: 'customer', value: { ...state.customers[0], id: 't1-v1' } }, /ID/);
    rejectUnchanged(state, { type: 'draft', value: draft('t1-d1') }, /ID/);
  });
});

describe('quotes, snapshots and calendar / TC-03, TC-04, TC-09–12', () => {
  it.each([[1, 350_000], [24, 350_000], [25, 700_000], [48, 700_000], [49, 1_050_000]])('prices %s hours at %s rupiah', (hours, total) => {
    expect(quote(fixture(), draft('b1', { end: plus(NOW, hours * HOUR) })).total).toBe(total);
  });
  it('prices a 25-hour chauffeur booking separately from deposit', () => {
    expect(quote(fixture(), draft('b1', { end: plus(NOW, 25 * HOUR), service: 'driver', driverId: 't1-d1' }))).toEqual({ vehicleRate: 350_000, driverRate: 200_000, quantity: 2, total: 1_100_000, deposit: 500_000, lateFee: 50_000, bufferMinutes: 120 });
  });
  it.each([
    ['2027-01-31', 1, '2027-02-28'], ['2027-01-31', 2, '2027-03-31'],
    ['2028-01-31', 1, '2028-02-29'], ['2028-02-29', 12, '2029-02-28'],
    ['2027-12-31', 2, '2028-02-29'], ['2027-03-31', -1, '2027-02-28'], ['2027-01-31', 0, '2027-01-31'],
    ['2100-01-31', 1, '2100-02-28'], ['2000-01-31', 1, '2000-02-29'],
  ])('clamps calendar anchor %s + %s to %s', (start, months, end) => {
    expect(addMonths(wib(start), months)).toBe(wib(end));
  });
  it('uses the WIB date rather than UTC or host timezone, preserving seconds and milliseconds', () => {
    expect(addMonths('2027-01-30T18:30:12.345Z', 1)).toBe('2027-02-27T18:30:12.345Z');
    expect(addMonths('2027-01-31T01:30:12.345+07:00', 2)).toBe('2027-03-30T18:30:12.345Z');
  });
  it('issues anchor-based monthly invoices and preserves future due dates', () => {
    const start = wib('2027-01-31');
    const state = book(fixture(), 'b1', { start, end: addMonths(start, 2), basis: 'monthly', months: 2 });
    expect(state.bookings[0].pricing?.total).toBe(12_000_000);
    expect(state.invoices.map(item => [item.start, item.end, item.due, item.total])).toEqual([
      [start, wib('2027-02-28'), start, 6_000_000], [wib('2027-02-28'), wib('2027-03-31'), wib('2027-02-28'), 6_000_000],
    ]);
    expect(state.invoices.every(item => Date.parse(item.due) > Date.parse(state.now))).toBe(true);
    expect(bookingDebt(state, 'b1')).toBe(12_000_000);
  });
  it('allocates a monthly payment to one period without spreading it', () => {
    const start = wib('2027-01-31');
    let state = book(fixture(), 'b1', { start, end: addMonths(start, 2), basis: 'monthly', months: 2, service: 'driver', driverId: 't1-d1' });
    expect(state.bookings[0].pricing?.total).toBe(18_000_000);
    state = payment(state, 4_000_000);
    expect(state.invoices.map(item => invoiceBalance(state, item))).toEqual([5_000_000, 9_000_000]);
    expect(conflict(state, 'driver', 't1-d1', wib('2027-03-20'), wib('2027-03-21'))).not.toBeNull();
  });
  it.each([0, 13, 1.5, NaN, '2'])('rejects invalid month count %s', months => {
    rejectUnchanged(fixture(), raw({ type: 'draft', value: { ...draft(), basis: 'monthly', months, end: addMonths(NOW, 1) } }));
  });
  it.each([
    { service: 'other' }, { basis: 'weekly' }, { service: 'self', driverId: 't1-d1' }, { service: 'driver', driverId: null },
    { start: NOW, end: NOW }, { start: NOW, end: plus(NOW, -1) }, { start: '2027-02-30T09:00:00+07:00' },
    { start: '2026-11-13T25:00:00Z' }, { start: '2026-11-13T09:00' }, { start: '2026-11-13T09:00:00+15:00' },
    { basis: 'monthly', months: 1, end: plus(NOW, 30 * 24 * HOUR + HOUR) },
  ])('rejects invalid booking input %j', patch => {
    rejectUnchanged(fixture(), raw({ type: 'draft', value: { ...draft(), ...patch } }));
  });
  it('rejects unsafe integer arithmetic in quotes without mutating state', () => {
    const state = fixture(); state.vehicles[0].dailyRate = Number.MAX_SAFE_INTEGER;
    expect(() => quote(state, draft('b1', { end: plus(NOW, 25 * HOUR) }))).toThrow(/perhitungan/);
    expect(() => addMonths(NOW, 0.5)).toThrow();
  });
  it('keeps confirmed rates/policies/invoices immutable but refreshes draft estimates', () => {
    let state = book(fixture(), 'b1', { service: 'driver', driverId: 't1-d1' });
    const prior = structuredClone(state.bookings[0]), invoices = structuredClone(state.invoices);
    state = applyAction(state, { type: 'settings', value: { tenantId: 't1', bufferMinutes: 0, deposit: 100_000, lateFee: 99_000 } });
    state = applyAction(state, { type: 'vehicle', value: { ...state.vehicles[0], dailyRate: 900_000 } });
    state = applyAction(state, { type: 'driver', value: { ...state.drivers[0], dailyRate: 300_000 } });
    expect(state.bookings[0]).toEqual(prior); expect(state.invoices).toEqual(invoices);
    const input = draft('b2', { start: plus(prior.end, 2 * HOUR), end: plus(prior.end, 26 * HOUR), service: 'driver', driverId: 't1-d1' });
    expect(quote(state, input)).toMatchObject({ vehicleRate: 900_000, driverRate: 300_000, deposit: 100_000, lateFee: 99_000, bufferMinutes: 0 });
    expect(conflict(state, 'vehicle', 't1-v1', plus(prior.end, 2 * HOUR - 1), plus(prior.end, 26 * HOUR))).not.toBeNull();
    state = book(state, 'b2', input);
    expect(state.bookings[1].pricing?.total).toBe(1_200_000);
    rejectUnchanged(state, { type: 'draft', value: draft('b1', { note: 'Sửa' }) }, /draft/);
  });
});

describe('reservations and lifecycle / TC-05–08, TC-19–26, TC-37', () => {
  it('drafts do not block or invoice, but only one conflicting draft can confirm', () => {
    let state = book(fixture(), 'b1', {}, false); state = book(state, 'b2', {}, false);
    expect(state.invoices).toHaveLength(0);
    expect(conflict(state, 'vehicle', 't1-v1', NOW, plus(NOW, HOUR))).toBeNull();
    state = applyAction(state, { type: 'confirm', id: 'b1' });
    rejectUnchanged(state, { type: 'confirm', id: 'b2' }, /bertabrakan/);
    rejectUnchanged(state, { type: 'confirm', id: 'b1' }, /draft/);
    expect(state.invoices).toHaveLength(1);
  });
  it('can check another vehicle when editing a draft while excluding that draft', () => {
    const state = book(fixture(), 'b1', {}, false);
    expect(conflict(state, 'vehicle', 't1-v2', NOW, plus(NOW, HOUR), 'b1')).toBeNull();
  });
  it('allows draft edits and past drafts, but never a past confirmation', () => {
    let state = book(fixture(), 'b1', { start: plus(NOW, -HOUR) }, false);
    rejectUnchanged(state, { type: 'confirm', id: 'b1' }, /masa lalu/);
    state = applyAction(state, { type: 'draft', value: draft('b1', { note: 'Jadwal diperbarui' }) });
    expect(state.bookings).toHaveLength(1);
    expect(state.bookings[0].createdAt).toBe(NOW);
    expect(applyAction(state, { type: 'confirm', id: 'b1' }).bookings[0].status).toBe('confirmed');
  });
  it('checks both ends of a candidate interval including its own buffer', () => {
    const end = wib('2026-11-14', '10:00');
    const state = book(fixture(), 'b1', { end });
    expect(conflict(state, 'vehicle', 't1-v1', wib('2026-11-14', '11:59'), plus(end, 24 * HOUR))).not.toBeNull();
    expect(conflict(state, 'vehicle', 't1-v1', wib('2026-11-14', '12:00'), plus(end, 24 * HOUR))).toBeNull();
    const future = book(fixture(), 'b1', { start: wib('2026-11-14', '12:00'), end: wib('2026-11-14', '16:00') });
    expect(conflict(future, 'vehicle', 't1-v1', wib('2026-11-14', '08:00'), wib('2026-11-14', '10:00'))).toBeNull();
    expect(conflict(future, 'vehicle', 't1-v1', wib('2026-11-14', '08:00'), wib('2026-11-14', '10:01'))).not.toBeNull();
  });
  it('rejects shared drivers across different cars without giving drivers a cleaning buffer', () => {
    const state = book(fixture(), 'b1', { driverId: 't1-d1', service: 'driver' });
    const next = book(state, 'b2', { vehicleId: 't1-v2', driverId: 't1-d1', service: 'driver' }, false);
    rejectUnchanged(next, { type: 'confirm', id: 'b2' }, /bertabrakan/);
    const end = state.bookings[0].end;
    expect(conflict(state, 'driver', 't1-d1', end, plus(end, HOUR))).toBeNull();
  });
  it.each(['maintenance', 'inactive'] as const)('blocks %s vehicles at confirm and checkout', status => {
    let state = fixture(); state.vehicles[0].status = status;
    state = book(state, 'b1', {}, false);
    rejectUnchanged(state, { type: 'confirm', id: 'b1' }, /Mobil/);
    const confirmed = deposit(book()); confirmed.vehicles[0].status = status;
    rejectUnchanged(confirmed, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true }, /Mobil/);
  });
  it('revalidates inactive/archived drivers and archived customers at confirmation', () => {
    for (const problem of ['driver-inactive', 'driver-archived', 'customer-archived', 'vehicle-archived']) {
      const state = book(fixture(), 'b1', { service: 'driver', driverId: 't1-d1' }, false);
      if (problem === 'driver-inactive') state.drivers[0].status = 'inactive';
      if (problem === 'driver-archived') state.drivers[0].archived = true;
      if (problem === 'customer-archived') state.customers[0].archived = true;
      if (problem === 'vehicle-archived') state.vehicles[0].archived = true;
      rejectUnchanged(state, { type: 'confirm', id: 'b1' });
    }
  });
  it('checks the exact checkout window and forward-only clock', () => {
    const start = plus(NOW, 15 * 60_000), end = plus(NOW, 45 * 60_000);
    const state = deposit(book(fixture(), 'b1', { start, end }));
    rejectUnchanged(state, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true }, /waktu mulai/);
    const onTime = applyAction(state, { type: 'clock', at: start });
    expect(applyAction(onTime, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true }).handovers[0].at).toBe(start);
    for (const at of [NOW, start]) rejectUnchanged(onTime, { type: 'clock', at }, /maju/);
    const expired = applyAction(state, { type: 'clock', at: end });
    rejectUnchanged(expired, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true }, /sebelum waktu selesai/);
  });
  it('requires verification, sufficient deposit and explicit debt acknowledgement', () => {
    let state = fixture(); state.customers[0].verified = false;
    state = book(state);
    rejectUnchanged(state, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true }, /terverifikasi/);
    state = applyAction(state, { type: 'customer', value: { ...state.customers[0], verified: true } });
    state = deposit(state, 'b1', 499_999);
    rejectUnchanged(state, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true }, /Deposit/);
    state = deposit(state, 'b1', 1);
    rejectUnchanged(state, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: false }, /Piutang/);
    rejectUnchanged(state, raw({ type: 'out', id: 'b1', value: OUT, acknowledgeDebt: 'yes' }));
    expect(applyAction(state, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true }).bookings[0].status).toBe('active');
    state = payment(state, 350_000);
    expect(applyAction(state, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: false }).bookings[0].status).toBe('active');
  });
  it('makes each checkout/checkin and final invoice atomic and unique', () => {
    let state = active();
    rejectUnchanged(state, { type: 'out', id: 'b1', value: OUT, acknowledgeDebt: true }, /confirmed/);
    state = returned(state, 50_000, 'BBM tambahan');
    expect(state.handovers.map(item => item.direction)).toEqual(['out', 'in']);
    expect(state.invoices.filter(item => item.kind === 'final')).toHaveLength(1);
    rejectUnchanged(state, { type: 'in', id: 'b1', value: IN, extra: 50_000, reason: 'BBM tambahan' }, /active/);
  });
  it.each([
    { odometer: -1 }, { odometer: 10_000_000 }, { odometer: 1.5 }, { fuel: -1 }, { fuel: 101 }, { fuel: NaN }, { fuel: '75' },
    { body: ' ' }, { interior: '' }, { equipment: false }, { equipment: 'true' },
  ])('requires valid complete handover input %j', patch => {
    rejectUnchanged(deposit(book()), raw({ type: 'out', id: 'b1', value: { ...OUT, ...patch }, acknowledgeDebt: true }));
    rejectUnchanged(active(), raw({ type: 'in', id: 'b1', value: { ...IN, ...patch }, extra: 0, reason: '' }));
  });
  it('rejects decreasing odometer, invalid extras, and missing reasons with no partial invoice/checklist', () => {
    const state = active();
    rejectUnchanged(state, { type: 'in', id: 'b1', value: { ...IN, odometer: 999 }, extra: 0, reason: '' }, /Odometer/);
    rejectUnchanged(state, { type: 'in', id: 'b1', value: IN, extra: 1, reason: ' ' }, /Alasan/);
    for (const extra of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) rejectUnchanged(state, { type: 'in', id: 'b1', value: IN, extra, reason: 'Biaya' });
  });
  it('rejects aggregate debt overflow atomically even when each individual invoice is safe', () => {
    rejectUnchanged(active(), { type: 'in', id: 'b1', value: IN, extra: Number.MAX_SAFE_INTEGER, reason: 'Biaya sangat besar' }, /perhitungan/);
  });
  it.each([[0, 0], [1, 50_000], [60 * 60_000, 50_000], [61 * 60_000, 100_000]])('charges exact lateness of %s ms as %s', (late, charge) => {
    let state = active();
    state = applyAction(state, { type: 'clock', at: plus(state.bookings[0].end, late) });
    state = returned(state);
    expect(state.invoices.filter(item => item.kind === 'final').reduce((total, item) => total + item.total, 0)).toBe(charge);
    expect(state.invoices.find(item => item.kind === 'final')?.due ?? state.now).toBe(state.now);
  });
  it('uses snapshot late fees and actual return buffer; releases the driver immediately', () => {
    let state = active(book(fixture(), 'b1', { service: 'driver', driverId: 't1-d1' }));
    state = applyAction(state, { type: 'settings', value: { tenantId: 't1', deposit: 0, bufferMinutes: 0, lateFee: 999_000 } });
    state = applyAction(state, { type: 'clock', at: plus(state.bookings[0].end, 61 * 60_000) });
    state = returned(state, 75_000, 'BBM');
    expect(state.invoices.find(item => item.kind === 'final')?.lines.map(item => item.amount)).toEqual([100_000, 75_000]);
    expect(conflict(state, 'vehicle', 't1-v1', plus(state.now, 2 * HOUR - 1), plus(state.now, 3 * HOUR))).not.toBeNull();
    expect(conflict(state, 'vehicle', 't1-v1', plus(state.now, 2 * HOUR), plus(state.now, 3 * HOUR))).toBeNull();
    expect(conflict(state, 'driver', 't1-d1', state.now, plus(state.now, HOUR))).toBeNull();
  });
  it('permits early return with debt, no proration/refund, and releases the old scheduled interval', () => {
    let state = active(); state = applyAction(state, { type: 'clock', at: plus(NOW, HOUR) });
    state = returned(state);
    expect(state.bookings[0].status).toBe('completed');
    expect(state.invoices).toHaveLength(1); expect(bookingDebt(state, 'b1')).toBe(350_000);
    expect(depositBalance(state, 'b1')).toBe(500_000);
    expect(conflict(state, 'vehicle', 't1-v1', plus(state.now, 2 * HOUR), plus(state.now, 4 * HOUR))).toBeNull();
  });
  it('treats active as overdue only strictly after end, then blocks all future confirmations for car and driver', () => {
    let state = active(book(fixture(), 'b1', { service: 'driver', driverId: 't1-d1' }));
    const end = state.bookings[0].end, start = plus(end, 7 * 24 * HOUR), finish = plus(start, HOUR);
    state = applyAction(state, { type: 'clock', at: end });
    expect(conflict(state, 'vehicle', 't1-v1', start, finish)).toBeNull();
    expect(conflict(state, 'driver', 't1-d1', start, finish)).toBeNull();
    state = book(state, 'b2', { start, end: finish }, false);
    state = book(state, 'b3', { vehicleId: 't1-v2', service: 'driver', driverId: 't1-d1', start, end: finish }, false);
    state = applyAction(state, { type: 'clock', at: plus(end, 1) });
    rejectUnchanged(state, { type: 'confirm', id: 'b2' }, /terlambat/);
    rejectUnchanged(state, { type: 'confirm', id: 'b3' }, /terlambat/);
    state = returned(state);
    expect(applyAction(state, { type: 'confirm', id: 'b2' }).bookings.find(item => item.id === 'b2')?.status).toBe('confirmed');
    expect(applyAction(state, { type: 'confirm', id: 'b3' }).bookings.find(item => item.id === 'b3')?.status).toBe('confirmed');
  });
  it.each(['vehicle', 'driver'] as const)('blocks checkout while the previous %s is still active, even exactly at scheduled end', kind => {
    let state = fixture(); state.settings[0].bufferMinutes = 0;
    state = book(state, 'b1', { service: 'driver', driverId: 't1-d1', end: plus(NOW, HOUR) });
    state = book(state, 'b2', { vehicleId: kind === 'driver' ? 't1-v2' : 't1-v1', driverId: kind === 'driver' ? 't1-d1' : null, service: kind === 'driver' ? 'driver' : 'self', start: plus(NOW, HOUR), end: plus(NOW, 2 * HOUR) });
    state = deposit(active(state), 'b2');
    state = applyAction(state, { type: 'clock', at: plus(NOW, HOUR) });
    rejectUnchanged(state, { type: 'out', id: 'b2', value: OUT, acknowledgeDebt: true }, /masih active/);
  });
  it('keeps next confirmed booking unchanged and checks actual late-return buffer at checkout', () => {
    let state = book(fixture(), 'b1', { end: plus(NOW, HOUR) });
    state = book(state, 'b2', { start: plus(NOW, 3 * HOUR), end: plus(NOW, 8 * HOUR) });
    state = deposit(active(state), 'b2');
    state = applyAction(state, { type: 'clock', at: plus(NOW, 3 * HOUR) });
    const scheduled = structuredClone(state.bookings[1]);
    rejectUnchanged(state, { type: 'out', id: 'b2', value: OUT, acknowledgeDebt: true }, /active/);
    state = returned(state);
    expect(state.bookings[1]).toEqual(scheduled);
    rejectUnchanged(state, { type: 'out', id: 'b2', value: OUT, acknowledgeDebt: true }, /buffer/);
    state = applyAction(state, { type: 'clock', at: plus(NOW, 5 * HOUR) });
    expect(applyAction(state, { type: 'out', id: 'b2', value: OUT, acknowledgeDebt: true }).bookings[1].status).toBe('active');
  });
});

describe('ledgers, cancellation and refunds / TC-13–18, TC-30, TC-34', () => {
  function example(): State {
    return deposit(payment(book(fixture(), 'b1', { service: 'driver', driverId: 't1-d1', end: plus(NOW, 25 * HOUR) }), 400_000));
  }
  it('keeps partial rental payments and deposit in different ledgers', () => {
    let state = example(); const bill = invoice(state);
    expect(invoicePaid(state, bill)).toBe(400_000); expect(invoiceBalance(state, bill)).toBe(700_000);
    expect(invoiceStatus(state, bill)).toBe('partial'); expect(depositBalance(state, 'b1')).toBe(500_000);
    expect(state.cash.filter(item => item.kind === 'rental_payment').reduce((sum, item) => sum + item.amount, 0)).toBe(400_000);
    state = payment(state, 700_000, 'b1', 'PELUNASAN');
    expect(invoiceStatus(state, bill)).toBe('paid'); expect(bookingDebt(state, 'b1')).toBe(0);
    expect(invoiceStatus(book(), invoice(book()))).toBe('open');
  });
  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 350_001, '100'])('rejects invalid or excessive payment %s', amount => {
    const state = book();
    rejectUnchanged(state, raw({ type: 'cash', bookingId: 'b1', invoiceId: invoice(state).id, kind: 'rental_payment', amount, method: 'cash', reference: '' }));
  });
  it('rejects repeated submission without blocking separately referenced payments', () => {
    const original = book();
    const action: Action = { type: 'cash', bookingId: 'b1', invoiceId: invoice(original).id, kind: 'rental_payment', amount: 100_000, method: 'cash', reference: 'DP-1' };
    const state = applyAction(original, action);
    rejectUnchanged(state, action, /identik/);
    expect(applyAction(state, { ...action, reference: 'DP-2' }).cash).toHaveLength(2);
  });
  it('validates financial enums and requires correct invoice allocation', () => {
    const state = book();
    const base = { type: 'cash', bookingId: 'b1', invoiceId: invoice(state).id, kind: 'rental_payment', amount: 100, method: 'cash', reference: '' };
    for (const patch of [{ kind: 'donation' }, { method: 'card' }, { invoiceId: null }, { kind: 'deposit_received' }, { reference: null }]) rejectUnchanged(state, raw({ ...base, ...patch }));
  });
  it('caps deposit receipts and only accepts them for confirmed/active bookings', () => {
    const state = deposit(book());
    rejectUnchanged(state, { type: 'cash', bookingId: 'b1', invoiceId: null, kind: 'deposit_received', amount: 1, method: 'cash', reference: '' }, /melebihi/);
    for (const other of [book(fixture(), 'b1', {}, false), returned(), applyAction(book(), { type: 'cancel', id: 'b1', reason: 'Batal' })]) rejectUnchanged(other, { type: 'cash', bookingId: 'b1', invoiceId: null, kind: 'deposit_received', amount: 1, method: 'cash', reference: '' }, /confirmed/);
  });
  it('voids atomically on cancellation while leaving all refund obligations intact', () => {
    let state = example();
    rejectUnchanged(state, { type: 'cancel', id: 'b1', reason: ' ' }, /Alasan/);
    state = applyAction(state, { type: 'cancel', id: 'b1', reason: 'Acara dibatalkan' });
    expect(state.bookings[0].status).toBe('cancelled'); expect(invoiceStatus(state, invoice(state))).toBe('void');
    expect(bookingDebt(state, 'b1')).toBe(0); expect(invoicePaid(state, invoice(state))).toBe(400_000);
    expect(depositBalance(state, 'b1')).toBe(500_000);
    expect(conflict(state, 'vehicle', 't1-v1', NOW, plus(NOW, HOUR))).toBeNull();
    rejectUnchanged(state, { type: 'cash', bookingId: 'b1', invoiceId: invoice(state).id, kind: 'rental_payment', amount: 1, method: 'cash', reference: '' }, /void/);
    rejectUnchanged(state, { type: 'cancel', id: 'b1', reason: 'Ulang' });
  });
  it('voids every calendar invoice and preserves earlier payments when cancelling a monthly contract', () => {
    let state = book(fixture(), 'b1', { basis: 'monthly', months: 12, end: addMonths(NOW, 12) });
    state = payment(state, 100_000);
    state = applyAction(state, { type: 'cancel', id: 'b1', reason: 'Kontrak batal sebelum mulai' });
    expect(state.invoices).toHaveLength(12);
    expect(state.invoices.every(item => item.void)).toBe(true);
    expect(bookingDebt(state, 'b1')).toBe(0);
    expect(invoicePaid(state, invoice(state))).toBe(100_000);
  });
  it('supports partial/manual refunds to zero without over-refunds or implicit deposit deductions', () => {
    let state = applyAction(example(), { type: 'cancel', id: 'b1', reason: 'Batal' });
    const rental: Action = { type: 'cash', bookingId: 'b1', invoiceId: invoice(state).id, kind: 'rental_refund', amount: 150_000, method: 'transfer', reference: 'REF-1' };
    state = applyAction(state, rental);
    expect(invoicePaid(state, invoice(state))).toBe(250_000);
    state = applyAction(state, { ...rental, amount: 250_000, reference: 'REF-2' });
    const refund: Action = { type: 'cash', bookingId: 'b1', invoiceId: null, kind: 'deposit_refund', amount: 200_000, method: 'transfer', reference: 'DEP-REF-1' };
    state = applyAction(state, refund); expect(depositBalance(state, 'b1')).toBe(300_000);
    state = applyAction(state, { ...refund, amount: 300_000, reference: 'DEP-REF-2' });
    expect(depositBalance(state, 'b1')).toBe(0); expect(invoicePaid(state, invoice(state))).toBe(0);
    expect(state.cash.filter(item => item.kind.startsWith('rental_')).reduce((sum, item) => sum + (item.kind === 'rental_payment' ? item.amount : -item.amount), 0)).toBe(0);
    rejectUnchanged(state, { ...rental, amount: 1, reference: 'EXTRA' }, /melebihi/);
    rejectUnchanged(state, { ...refund, amount: 1, reference: 'EXTRA' }, /melebihi/);
  });
  it('permits deposit refund with completed unpaid debt, but never a noncancelled rental refund', () => {
    let state = returned();
    state = applyAction(state, { type: 'cash', bookingId: 'b1', invoiceId: null, kind: 'deposit_refund', amount: 500_000, method: 'cash', reference: '' });
    expect(bookingDebt(state, 'b1')).toBe(350_000); expect(depositBalance(state, 'b1')).toBe(0);
    rejectUnchanged(state, { type: 'cash', bookingId: 'b1', invoiceId: invoice(state).id, kind: 'rental_refund', amount: 1, method: 'cash', reference: '' }, /void/);
  });
  it.each(['confirmed', 'active'] as const)('forbids deposit refunds while %s', status => {
    const state = status === 'active' ? active() : deposit(book());
    rejectUnchanged(state, { type: 'cash', bookingId: 'b1', invoiceId: null, kind: 'deposit_refund', amount: 1, method: 'cash', reference: '' }, /pembatalan atau pengembalian/);
  });
  it.each(['active', 'completed'] as const)('forbids cancellation while %s', status => {
    rejectUnchanged(status === 'active' ? active() : returned(), { type: 'cancel', id: 'b1', reason: 'Batal' }, /draft atau confirmed/);
  });
  it('handles refund-only reporting periods as negative rental cash, not negative balances', () => {
    let state = example(); const tomorrow = plus(NOW, 24 * HOUR);
    state = run(state, { type: 'clock', at: tomorrow }, { type: 'cancel', id: 'b1', reason: 'Tidak jadi berangkat' });
    state = applyAction(state, { type: 'cash', bookingId: 'b1', invoiceId: invoice(state).id, kind: 'rental_refund', amount: 400_000, method: 'transfer', reference: 'BESOK' });
    const net = state.cash.filter(item => item.at === tomorrow && item.kind.startsWith('rental_')).reduce((sum, item) => sum + (item.kind === 'rental_payment' ? item.amount : -item.amount), 0);
    expect(net).toBe(-400_000); expect(bookingDebt(state, 'b1')).toBe(0); expect(depositBalance(state, 'b1')).toBe(500_000);
  });
  it('has strict due-time boundaries without changing invoice status or stored due dates', () => {
    const state = book(), bill = invoice(state);
    const overdue = (s: State) => Date.parse(s.now) > Date.parse(bill.due) && invoiceBalance(s, bill) > 0;
    expect(overdue(state)).toBe(false);
    const next = applyAction(state, { type: 'clock', at: plus(NOW, 1) });
    expect(overdue(next)).toBe(true); expect(invoiceStatus(next, bill)).toBe('open'); expect(next.invoices).toEqual(state.invoices);
  });
});

describe('realistic deterministic seed integrity / TC-36', () => {
  it('has two tenants with useful current-day schedules and all required scenarios', () => {
    const seed = makeSeed();
    expect(seed).toMatchObject({ now: NOW, tenantId: 't1', role: 'owner', version: 1 });
    expect(seed.tenants.map(item => [item.id, item.name])).toEqual([['t1', 'Nusantara Rent'], ['t2', 'Langit Rental']]);
    for (const tenantId of ['t1', 't2']) {
      const state = applyAction(seed, { type: 'context', tenantId, role: 'owner' });
      expect(state.vehicles.filter(item => item.tenantId === tenantId)).toHaveLength(6);
      expect(state.customers.filter(item => item.tenantId === tenantId)).toHaveLength(8);
      expect(state.drivers.filter(item => item.tenantId === tenantId)).toHaveLength(3);
      const bookings = state.bookings.filter(item => item.tenantId === tenantId);
      expect(bookings).toHaveLength(10);
      expect(new Set(bookings.map(item => item.status))).toEqual(new Set(['draft', 'confirmed', 'active', 'completed', 'cancelled']));
      expect(new Set(bookings.map(item => item.basis))).toEqual(new Set(['daily', 'monthly']));
      expect(bookings.some(item => item.status === 'active' && item.end < NOW)).toBe(true);
      expect(bookings.some(item => item.status === 'active' && item.end > NOW)).toBe(true);
      expect(bookings.filter(item => item.status === 'confirmed' && item.start.startsWith('2026-11-13'))).toHaveLength(2);
      expect(conflict(state, 'vehicle', `${tenantId}-v1`, NOW, plus(NOW, 24 * HOUR))).toBeNull();
      expect(state.settings.find(item => item.tenantId === tenantId)).toMatchObject({ deposit: 500_000, bufferMinutes: 120, lateFee: 50_000 });
      const checkout = deposit(applyAction(state, { type: 'confirm', id: `${tenantId}-b9` }), `${tenantId}-b9`);
      expect(applyAction(checkout, { type: 'out', id: `${tenantId}-b9`, value: { ...OUT, odometer: 25_000 }, acknowledgeDebt: true }).bookings.find(item => item.id === `${tenantId}-b9`)?.status).toBe('active');
      const future = applyAction(state, { type: 'clock', at: plus(NOW, 15 * 60_000) });
      expect(applyAction(future, { type: 'out', id: `${tenantId}-b7`, value: { ...OUT, odometer: 18_500 }, acknowledgeDebt: false }).bookings.find(item => item.id === `${tenantId}-b7`)?.status).toBe('active');
    }
  });
  it('has unique IDs/numbers, same-tenant references, balanced ledgers and chronological handovers/activities', () => {
    const seed = makeSeed();
    const ids = [seed.tenants, seed.vehicles, seed.customers, seed.drivers, seed.bookings, seed.invoices, seed.cash, seed.handovers, seed.activities].flatMap(rows => rows.map(item => item.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const tenantId of ['t1', 't2']) {
      const state = applyAction(seed, { type: 'context', tenantId, role: 'owner' });
      for (const rows of [state.bookings, state.invoices]) {
        const numbers = rows.filter(item => item.tenantId === tenantId).map(item => item.number);
        expect(new Set(numbers).size).toBe(numbers.length);
      }
      for (const booking of state.bookings.filter(item => item.tenantId === tenantId)) {
        expect(state.vehicles.find(item => item.id === booking.vehicleId)?.tenantId).toBe(tenantId);
        expect(state.customers.find(item => item.id === booking.customerId)?.tenantId).toBe(tenantId);
        if (booking.driverId) expect(state.drivers.find(item => item.id === booking.driverId)?.tenantId).toBe(tenantId);
        if (booking.basis === 'monthly') expect(booking.end).toBe(addMonths(booking.start, booking.months));
        const bills = state.invoices.filter(item => item.bookingId === booking.id);
        if (booking.pricing) expect(bills.filter(item => item.kind === 'rental').reduce((sum, item) => sum + item.total, 0)).toBe(booking.pricing.total);
        else expect(bills).toHaveLength(0);
        expect(depositBalance(state, booking.id)).toBeGreaterThanOrEqual(0);
        expect(depositBalance(state, booking.id)).toBeLessThanOrEqual(booking.pricing?.deposit ?? 0);
        const handovers = state.handovers.filter(item => item.bookingId === booking.id);
        expect(handovers).toHaveLength(booking.status === 'completed' ? 2 : booking.status === 'active' ? 1 : 0);
        for (const handover of handovers) { expect(handover.tenantId).toBe(tenantId); expect(handover.at >= booking.createdAt && handover.at <= state.now).toBe(true); }
        if (handovers.length === 2) { expect(handovers[1].at >= handovers[0].at).toBe(true); expect(handovers[1].odometer >= handovers[0].odometer).toBe(true); }
        for (const bill of bills) {
          expect(bill.tenantId).toBe(tenantId); expect(bill.total).toBe(bill.lines.reduce((sum, item) => sum + item.amount, 0));
          expect(bill.lines.every(item => item.amount === item.quantity * item.rate)).toBe(true);
          expect(invoiceBalance(state, bill)).toBeGreaterThanOrEqual(0);
          expect(invoicePaid(state, bill)).toBeLessThanOrEqual(bill.total);
        }
      }
    }
    for (const entry of seed.cash) {
      const booking = seed.bookings.find(item => item.id === entry.bookingId)!;
      expect(entry.tenantId).toBe(booking.tenantId); expect(entry.at >= booking.createdAt && entry.at <= NOW).toBe(true);
      if (entry.invoiceId) { const bill = seed.invoices.find(item => item.id === entry.invoiceId)!; expect(bill.tenantId).toBe(entry.tenantId); expect(bill.bookingId).toBe(booking.id); }
      expect(['owner', 'staff', 'platform']).toContain(entry.actor);
    }
    for (const entry of seed.activities) {
      expect(seed.tenants.some(item => item.id === entry.tenantId)).toBe(true); expect(entry.at <= NOW).toBe(true);
      if (entry.bookingId) expect(seed.bookings.find(item => item.id === entry.bookingId)?.tenantId).toBe(entry.tenantId);
      expect(['owner', 'staff', 'platform']).toContain(entry.actor);
    }
  });
  it('contains no overlapping effective reservations or actual completed vehicle/driver intervals', () => {
    const state = makeSeed();
    for (const kind of ['vehicle', 'driver'] as const) {
      const intervals = state.bookings.filter(item => ['confirmed', 'active', 'completed'].includes(item.status) && (kind === 'vehicle' || item.driverId !== null)).map(booking => {
        const completed = booking.status === 'completed';
        const out = state.handovers.find(item => item.bookingId === booking.id && item.direction === 'out');
        const returned = state.handovers.find(item => item.bookingId === booking.id && item.direction === 'in');
        return { id: booking.id, tenantId: booking.tenantId, resource: kind === 'vehicle' ? booking.vehicleId : booking.driverId,
          start: Date.parse(completed ? out!.at : booking.start), end: Date.parse(completed ? returned!.at : booking.end) + (kind === 'vehicle' ? booking.pricing!.bufferMinutes * 60_000 : 0) };
      });
      for (let i = 0; i < intervals.length; i++) for (let j = i + 1; j < intervals.length; j++) {
        const a = intervals[i], b = intervals[j];
        if (a.tenantId === b.tenantId && a.resource === b.resource) expect(a.start < b.end && b.start < a.end, `${kind}: ${a.id} / ${b.id}`).toBe(false);
      }
    }
  });
});
