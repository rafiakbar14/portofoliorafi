import type {
  Action, Booking, CashKind, Customer, DraftInput, Driver, Entity, HandoverInput,
  Invoice, InvoiceLine, Pricing, Settings, State, Tenant, Vehicle,
} from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WIB = 7 * HOUR;
const DEFAULTS = { bufferMinutes: 120, deposit: 500_000, lateFee: 0 };

function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown): asserts value is Record<string, unknown> {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), 'Data masukan tidak valid.');
}
function text(value: unknown, label: string, required = true, limit = 2_000): string {
  requireThat(typeof value === 'string', `${label} harus berupa teks.`);
  const result = value.trim();
  requireThat((!required || result.length > 0) && result.length <= limit, `${label} wajib valid (maksimal ${limit} karakter).`);
  return result;
}
function choice<T extends string>(value: unknown, values: readonly T[], label: string): T {
  requireThat(typeof value === 'string' && values.includes(value as T), `${label} tidak valid.`);
  return value as T;
}
function integer(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  requireThat(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, `${label} harus berupa bilangan bulat antara ${min} dan ${max}.`);
  return value;
}
function boolean(value: unknown, label: string): boolean {
  requireThat(typeof value === 'boolean', `${label} harus berupa pilihan benar atau salah.`);
  return value;
}
function sum(values: number[]): number {
  return values.reduce((total, value) => integer(total + value, 'Hasil perhitungan uang'), 0);
}
function product(a: number, b: number): number {
  return integer(a * b, 'Hasil perhitungan');
}
function daysInMonth(year: number, month: number): number {
  return [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

// Require an explicit offset: input must never depend on the browser/machine timezone.
function instant(value: unknown): number {
  requireThat(typeof value === 'string', 'Waktu harus berupa ISO dengan zona waktu.');
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  requireThat(parts, 'Waktu tidak valid; gunakan ISO UTC atau offset WIB +07:00.');
  const [, y, m, d, h, minute, second, , zone] = parts;
  const year = Number(y), month = Number(m), day = Number(d);
  requireThat(year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
    && Number(h) <= 23 && Number(minute) <= 59 && Number(second ?? 0) <= 59, 'Tanggal atau jam tidak valid.');
  if (zone !== 'Z') {
    const offsetHours = Number(zone.slice(1, 3)), offsetMinutes = Number(zone.slice(4, 6));
    requireThat(offsetHours <= 14 && offsetMinutes <= 59 && (offsetHours < 14 || offsetMinutes === 0), 'Offset zona waktu tidak valid.');
  }
  const result = Date.parse(value);
  requireThat(Number.isFinite(result), 'Waktu di luar batas kalender.');
  return result;
}
function iso(value: unknown): string { return new Date(instant(value)).toISOString(); }
function interval(start: string, end: string): [number, number] {
  const a = instant(start), b = instant(end);
  requireThat(a < b, 'Waktu selesai harus sesudah waktu mulai.');
  return [a, b];
}
function buffered(at: number, minutes: number): number {
  const result = at + product(minutes, MINUTE);
  requireThat(Number.isSafeInteger(result) && Math.abs(result) <= 8.64e15, 'Waktu buffer di luar batas kalender.');
  return result;
}

/** Add N months to the original contract anchor, clamping only the target month in WIB. */
export function addMonths(start: string, n: number): string {
  integer(n, 'Jumlah pergeseran bulan', -120_000, 120_000);
  const local = new Date(instant(start) + WIB);
  const target = local.getUTCFullYear() * 12 + local.getUTCMonth() + n;
  const year = Math.floor(target / 12), month = target - year * 12;
  requireThat(year >= 1 && year <= 9999, 'Tahun di luar batas kalender.');
  const result = new Date(0);
  result.setUTCFullYear(year, month, Math.min(local.getUTCDate(), daysInMonth(year, month + 1)));
  result.setUTCHours(local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds());
  return new Date(result.getTime() - WIB).toISOString();
}

function workspace(state: State): Tenant {
  choice(state.role, ['owner', 'staff', 'platform'], 'Peran');
  requireThat(state.role !== 'platform', 'Pengelola platform tidak dapat mengakses data operasional perusahaan.');
  const tenant = state.tenants.find(item => item.id === state.tenantId);
  requireThat(tenant && tenant.status === 'active', 'Perusahaan tidak ditemukan atau sedang nonaktif.');
  return tenant;
}
function own<T extends { id: string; tenantId: string }>(state: State, rows: T[], id: string): T {
  text(id, 'ID', true, 160);
  const item = rows.find(row => row.id === id);
  requireThat(item && item.tenantId === state.tenantId, 'Data tidak ditemukan di perusahaan ini.');
  return item;
}
function policies(value: Settings, tenantId: string): Settings {
  object(value);
  requireThat(value.tenantId === tenantId, 'Pengaturan bukan milik perusahaan ini.');
  return {
    tenantId,
    bufferMinutes: integer(value.bufferMinutes, 'Buffer kendaraan'),
    deposit: integer(value.deposit, 'Deposit'),
    lateFee: integer(value.lateFee, 'Tarif keterlambatan'),
  };
}
function settings(state: State): Settings {
  const value = state.settings.find(item => item.tenantId === state.tenantId);
  requireThat(value, 'Pengaturan perusahaan belum tersedia.');
  return policies(value, state.tenantId);
}
function references(state: State, booking: Pick<Booking, 'customerId' | 'vehicleId' | 'driverId' | 'service'>) {
  const customer = own(state, state.customers, booking.customerId);
  const vehicle = own(state, state.vehicles, booking.vehicleId);
  choice(booking.service, ['self', 'driver'], 'Layanan');
  requireThat(booking.service === 'driver' ? typeof booking.driverId === 'string' && booking.driverId.length > 0 : booking.driverId === null,
    'Layanan dengan sopir wajib memilih sopir; lepas kunci tidak boleh memiliki sopir.');
  const driver = booking.driverId === null ? null : own(state, state.drivers, booking.driverId);
  return { customer, vehicle, driver };
}
function bookingById(state: State, id: string): Booking {
  const booking = own(state, state.bookings, id);
  references(state, booking);
  return booking;
}
function invoiceById(state: State, id: string): Invoice {
  const invoice = own(state, state.invoices, id);
  bookingById(state, invoice.bookingId);
  return invoice;
}
function storedInvoice(state: State, invoice: Invoice): Invoice {
  workspace(state);
  object(invoice);
  requireThat(invoice.tenantId === state.tenantId, 'Data tidak ditemukan di perusahaan ini.');
  const stored = invoiceById(state, invoice.id);
  requireThat(stored.bookingId === invoice.bookingId, 'Relasi tagihan tidak valid.');
  return stored;
}
function netPaid(state: State, invoice: Invoice): number {
  const entries = state.cash.filter(entry => entry.tenantId === state.tenantId && entry.invoiceId === invoice.id && entry.bookingId === invoice.bookingId);
  const received = sum(entries.filter(entry => entry.kind === 'rental_payment').map(entry => entry.amount));
  const refunded = sum(entries.filter(entry => entry.kind === 'rental_refund').map(entry => entry.amount));
  return integer(received - refunded, 'Saldo pembayaran');
}
export function invoicePaid(state: State, invoice: Invoice): number {
  return netPaid(state, storedInvoice(state, invoice));
}
export function invoiceBalance(state: State, invoice: Invoice): number {
  const stored = storedInvoice(state, invoice);
  return stored.void ? 0 : integer(stored.total - netPaid(state, stored), 'Sisa tagihan');
}
export function invoiceStatus(state: State, invoice: Invoice): 'open' | 'partial' | 'paid' | 'void' {
  const stored = storedInvoice(state, invoice);
  if (stored.void) return 'void';
  const paid = netPaid(state, stored);
  return paid === stored.total ? 'paid' : paid === 0 ? 'open' : 'partial';
}
export function depositBalance(state: State, bookingId: string): number {
  workspace(state);
  bookingById(state, bookingId);
  const entries = state.cash.filter(entry => entry.tenantId === state.tenantId && entry.bookingId === bookingId && entry.invoiceId === null);
  return integer(sum(entries.filter(entry => entry.kind === 'deposit_received').map(entry => entry.amount))
    - sum(entries.filter(entry => entry.kind === 'deposit_refund').map(entry => entry.amount)), 'Saldo deposit');
}
export function bookingDebt(state: State, bookingId: string): number {
  workspace(state);
  bookingById(state, bookingId);
  return sum(state.invoices.filter(invoice => invoice.tenantId === state.tenantId && invoice.bookingId === bookingId)
    .map(invoice => invoiceBalance(state, invoice)));
}

function draftInput(state: State, value: DraftInput): DraftInput {
  object(value);
  const service = choice(value.service, ['self', 'driver'], 'Layanan');
  const basis = choice(value.basis, ['daily', 'monthly'], 'Basis tarif');
  const start = iso(value.start), end = iso(value.end);
  interval(start, end);
  const months = integer(value.months, 'Jumlah bulan', 1, 12);
  if (basis === 'monthly') requireThat(end === addMonths(start, months), 'Akhir kontrak harus mengikuti jumlah bulan kalender dari tanggal awal.');
  const result: DraftInput = {
    customerId: text(value.customerId, 'Pelanggan', true, 160),
    vehicleId: text(value.vehicleId, 'Mobil', true, 160),
    driverId: value.driverId === null ? null : text(value.driverId, 'Sopir', true, 160),
    service, basis, start, end, months: basis === 'monthly' ? months : 1,
    note: text(value.note, 'Catatan', false),
  };
  const { customer, vehicle, driver } = references(state, result);
  requireThat(!customer.archived && !vehicle.archived && !driver?.archived, 'Data arsip tidak dapat dipilih untuk booking baru.');
  return result;
}
function rate(value: unknown, label: string, driver = false): number | null {
  return value === null ? null : integer(value, label, driver ? 0 : 1);
}
/** A live estimate only; confirmation is responsible for availability and the immutable snapshot. */
export function quote(state: State, input: DraftInput): Pricing {
  workspace(state);
  const draft = draftInput(state, input);
  const { vehicle, driver } = references(state, draft);
  const key = draft.basis === 'daily' ? 'dailyRate' : 'monthlyRate';
  const vehicleRate = rate(vehicle[key], 'Tarif mobil');
  const driverRate = driver ? rate(driver[key], 'Tarif sopir', true) : 0;
  requireThat(vehicleRate !== null && driverRate !== null, 'Tarif untuk basis sewa ini belum diatur oleh pemilik.');
  const quantity = draft.basis === 'monthly' ? draft.months : Math.max(1, Math.ceil((instant(draft.end) - instant(draft.start)) / DAY));
  const policy = settings(state);
  return { vehicleRate, driverRate, quantity, total: product(quantity, sum([vehicleRate, driverRate])),
    deposit: policy.deposit, bufferMinutes: policy.bufferMinutes, lateFee: policy.lateFee };
}

/** Returns a human-readable unavailability reason, or null for a free half-open interval. */
export function conflict(state: State, kind: 'vehicle' | 'driver', id: string, start: string, end: string, excludeId?: string): string | null {
  workspace(state);
  choice(kind, ['vehicle', 'driver'], 'Jenis sumber daya');
  const resource = kind === 'vehicle' ? own(state, state.vehicles, id) : own(state, state.drivers, id);
  const [a, scheduledEnd] = interval(start, end);
  const excluded = excludeId === undefined ? undefined : bookingById(state, excludeId);
  if (resource.archived) return 'Sumber daya telah diarsipkan.';
  if (kind === 'vehicle' ? resource.status !== 'ready' : resource.status !== 'active') return kind === 'vehicle' ? 'Mobil sedang maintenance atau nonaktif.' : 'Sopir sedang nonaktif.';
  const snapshotBuffer = excluded?.vehicleId === id ? excluded.pricing?.bufferMinutes : undefined;
  const candidateBuffer = kind === 'vehicle' ? (snapshotBuffer ?? settings(state).bufferMinutes) : 0;
  const b = buffered(scheduledEnd, candidateBuffer);
  for (const booking of state.bookings) {
    if (booking.tenantId !== state.tenantId || booking.id === excludeId || (kind === 'vehicle' ? booking.vehicleId : booking.driverId) !== id) continue;
    if (!['confirmed', 'active', 'completed'].includes(booking.status)) continue;
    references(state, booking);
    if (booking.status === 'active' && instant(state.now) > instant(booking.end)) return `Sewa ${booking.number} terlambat dan belum dikembalikan.`;
    requireThat(booking.pricing, 'Snapshot booking belum tersedia.');
    let c = instant(booking.start), d = instant(booking.end);
    if (booking.status === 'completed') {
      const out = state.handovers.find(item => item.tenantId === state.tenantId && item.bookingId === booking.id && item.direction === 'out');
      const returned = state.handovers.find(item => item.tenantId === state.tenantId && item.bookingId === booking.id && item.direction === 'in');
      requireThat(out && returned, 'Catatan serah-terima booking selesai tidak lengkap.');
      c = instant(out.at); d = instant(returned.at);
    }
    if (kind === 'vehicle') d = buffered(d, booking.pricing.bufferMinutes);
    if (c < d && a < d && c < b) return `Jadwal bertabrakan dengan ${booking.number}${kind === 'vehicle' ? ' atau buffer kendaraan' : ''}.`;
  }
  return null;
}

function allIds(state: State): Set<string> {
  return new Set([state.tenants, state.vehicles, state.customers, state.drivers, state.bookings,
    state.invoices, state.cash, state.handovers, state.activities].flatMap(rows => rows.map(row => row.id)));
}
function nextId(state: State, prefix: string): string {
  const ids = allIds(state);
  let n = 1;
  while (ids.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}
function freshId(state: State, id: string): string {
  text(id, 'ID', true, 160);
  requireThat(id === id.trim() && !allIds(state).has(id), 'ID sudah digunakan atau tidak valid.');
  return id;
}
function numberFor(state: State, kind: 'booking' | 'invoice'): string {
  const prefix = kind === 'booking' ? 'BK' : 'INV';
  const rows = kind === 'booking' ? state.bookings : state.invoices;
  let n = 1;
  while (rows.some(row => row.tenantId === state.tenantId && row.number === `${prefix}-${String(n).padStart(4, '0')}`)) n++;
  return `${prefix}-${String(n).padStart(4, '0')}`;
}
function activity(state: State, action: string, summary: string, bookingId?: string, tenantId = state.tenantId): void {
  state.activities.push({ id: nextId(state, 'activity'), tenantId, ...(bookingId ? { bookingId } : {}), action, summary, at: state.now, actor: state.role });
}
function entityBase(state: State, value: Entity): Entity {
  object(value);
  requireThat(value.tenantId === state.tenantId, 'Data tidak ditemukan di perusahaan ini.');
  const id = text(value.id, 'ID', true, 160);
  requireThat(id === value.id, 'ID tidak boleh mengandung spasi di awal atau akhir.');
  return { id, tenantId: state.tenantId, archived: boolean(value.archived, 'Status arsip') };
}
function existing<T extends Entity>(state: State, rows: T[], id: string): T | undefined {
  const item = rows.find(row => row.id === id);
  if (item) return own(state, rows, id);
  freshId(state, id);
  return undefined;
}
function upsert<T extends { id: string }>(rows: T[], value: T): void {
  const index = rows.findIndex(row => row.id === value.id);
  if (index < 0) rows.push(value); else rows[index] = value;
}
function bound(state: State, kind: 'vehicleId' | 'customerId' | 'driverId', id: string): boolean {
  return state.bookings.some(booking => booking.tenantId === state.tenantId && booking[kind] === id && ['confirmed', 'active'].includes(booking.status));
}
function tariffPermission(state: State, previous: Vehicle | Driver | undefined, value: Vehicle | Driver): void {
  if (state.role === 'staff') requireThat(value.dailyRate === (previous?.dailyRate ?? null) && value.monthlyRate === (previous?.monthlyRate ?? null), 'Hanya pemilik yang boleh menetapkan atau mengubah tarif master.');
}
function readyReferences(state: State, booking: Booking): void {
  const { vehicle, customer, driver } = references(state, booking);
  requireThat(!customer.archived, 'Pelanggan sudah diarsipkan.');
  requireThat(!vehicle.archived && vehicle.status === 'ready', 'Mobil harus siap operasional dan tidak diarsipkan.');
  requireThat(!driver || (!driver.archived && driver.status === 'active'), 'Sopir harus aktif dan tidak diarsipkan.');
}
function checklist(value: HandoverInput): HandoverInput {
  object(value);
  const odometer = integer(value.odometer, 'Odometer', 0, 9_999_999);
  requireThat(typeof value.fuel === 'number' && Number.isFinite(value.fuel) && value.fuel >= 0 && value.fuel <= 100, 'Bahan bakar harus berada antara 0 dan 100 persen.');
  requireThat(boolean(value.equipment, 'Kelengkapan'), 'Checklist kelengkapan wajib diselesaikan.');
  return { odometer, fuel: value.fuel, body: text(value.body, 'Kondisi bodi'), interior: text(value.interior, 'Kondisi interior'), equipment: true, notes: text(value.notes, 'Catatan', false) };
}
function issueInvoice(state: State, booking: Booking, kind: 'rental' | 'final', start: string, end: string, lines: InvoiceLine[]): void {
  const total = sum(lines.map(line => line.amount));
  requireThat(total > 0, 'Total tagihan harus positif.');
  state.invoices.push({ id: nextId(state, 'invoice'), tenantId: state.tenantId, number: numberFor(state, 'invoice'), bookingId: booking.id, kind, start, end, due: start, lines, total, void: false });
}
function line(label: string, quantity: number, amount: number): InvoiceLine {
  return { label, quantity, rate: amount, amount: product(quantity, amount) };
}

/** Atomic local-domain transaction: all changes happen on a detached copy or not at all. */
export function applyAction(state: State, action: Action): State {
  object(action);
  const next = structuredClone(state);
  next.now = iso(next.now);
  choice(next.role, ['owner', 'staff', 'platform'], 'Peran');
  if (action.type === 'context') {
    const role = choice(action.role, ['owner', 'staff', 'platform'], 'Peran');
    const tenantId = text(action.tenantId, 'Perusahaan', role !== 'platform', 160);
    const tenant = next.tenants.find(item => item.id === tenantId);
    requireThat((role === 'platform' && tenantId === '') || tenant, 'Perusahaan tidak ditemukan.');
    requireThat(role === 'platform' || tenant?.status === 'active', 'Perusahaan sedang nonaktif.');
    next.role = role; next.tenantId = tenantId;
    return next;
  }
  if (action.type === 'clock') {
    if (next.role !== 'platform') workspace(next);
    const at = iso(action.at);
    requireThat(instant(at) > instant(next.now), 'Jam demo hanya boleh bergerak maju.');
    next.now = at;
    if (next.tenants.some(tenant => tenant.id === next.tenantId)) activity(next, 'clock', 'Jam demo dimajukan.');
    return next;
  }
  if (action.type === 'tenant') {
    requireThat(next.role === 'platform', 'Hanya pengelola platform yang boleh mengelola perusahaan.');
    object(action.value);
    const value = action.value;
    const id = text(value.id, 'ID perusahaan', true, 160);
    const previous = next.tenants.find(tenant => tenant.id === id);
    if (!previous) freshId(next, id);
    const code = text(value.code, 'Kode perusahaan', true, 32).toUpperCase();
    requireThat(/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/.test(code), 'Kode perusahaan hanya boleh berisi huruf, angka, tanda hubung, atau garis bawah.');
    requireThat(!next.tenants.some(tenant => tenant.id !== id && tenant.code.trim().toUpperCase() === code), 'Kode perusahaan sudah digunakan.');
    const tenant: Tenant = { id, code, name: text(value.name, 'Nama perusahaan', true, 120), status: choice(value.status, ['active', 'inactive'], 'Status perusahaan'), contact: text(value.contact, 'Kontak fiktif', false, 120) };
    upsert(next.tenants, tenant);
    if (!previous) next.settings.push({ tenantId: id, ...DEFAULTS });
    activity(next, 'tenant', `${previous ? 'Memperbarui' : 'Membuat'} perusahaan ${tenant.name}.`, undefined, id);
    return next;
  }
  workspace(next);
  switch (action.type) {
    case 'settings': {
      requireThat(next.role === 'owner', 'Hanya pemilik yang boleh mengubah pengaturan.');
      const value = policies(action.value, next.tenantId);
      const index = next.settings.findIndex(item => item.tenantId === next.tenantId);
      if (index < 0) next.settings.push(value); else next.settings[index] = value;
      activity(next, 'settings', 'Memperbarui kebijakan untuk konfirmasi booking berikutnya.');
      break;
    }
    case 'vehicle': {
      const base = entityBase(next, action.value), previous = existing(next, next.vehicles, base.id), v = action.value;
      const plate = text(v.plate, 'Pelat', true, 32).toUpperCase().replace(/\s+/g, ' ');
      requireThat(!next.vehicles.some(item => item.id !== base.id && item.tenantId === next.tenantId && item.plate.replace(/\s/g, '').toUpperCase() === plate.replace(/\s/g, '')), 'Pelat kendaraan sudah digunakan di perusahaan ini.');
      const value: Vehicle = { ...base, plate, make: text(v.make, 'Merek', true, 80), model: text(v.model, 'Model', true, 80), category: text(v.category, 'Kategori', true, 80), transmission: choice(v.transmission, ['Automatic', 'Manual'], 'Transmisi'), seats: integer(v.seats, 'Jumlah kursi', 1, 60), color: text(v.color, 'Warna', true, 80), dailyRate: rate(v.dailyRate, 'Tarif harian mobil'), monthlyRate: rate(v.monthlyRate, 'Tarif bulanan mobil'), status: choice(v.status, ['ready', 'maintenance', 'inactive'], 'Status mobil') };
      tariffPermission(next, previous, value);
      requireThat(!(value.archived || value.status !== 'ready') || !bound(next, 'vehicleId', value.id), 'Mobil masih terikat booking confirmed atau active.');
      upsert(next.vehicles, value);
      activity(next, 'vehicle', `Menyimpan kendaraan ${value.plate}.`);
      break;
    }
    case 'customer': {
      const base = entityBase(next, action.value); existing(next, next.customers, base.id);
      const v = action.value;
      const value: Customer = { ...base, name: text(v.name, 'Nama pelanggan', true, 120), phone: text(v.phone, 'Telepon fiktif', false, 80), verified: boolean(v.verified, 'Verifikasi pelanggan'), note: text(v.note, 'Catatan', false) };
      requireThat(!value.archived || !bound(next, 'customerId', value.id), 'Pelanggan masih terikat booking confirmed atau active.');
      upsert(next.customers, value);
      activity(next, 'customer', `Menyimpan pelanggan ${value.name}.`);
      break;
    }
    case 'driver': {
      const base = entityBase(next, action.value), previous = existing(next, next.drivers, base.id), v = action.value;
      const value: Driver = { ...base, name: text(v.name, 'Nama sopir', true, 120), phone: text(v.phone, 'Telepon fiktif', false, 80), dailyRate: rate(v.dailyRate, 'Tarif harian sopir', true), monthlyRate: rate(v.monthlyRate, 'Tarif bulanan sopir', true), status: choice(v.status, ['active', 'inactive'], 'Status sopir') };
      tariffPermission(next, previous, value);
      requireThat(!(value.archived || value.status !== 'active') || !bound(next, 'driverId', value.id), 'Sopir masih terikat booking confirmed atau active.');
      upsert(next.drivers, value);
      activity(next, 'driver', `Menyimpan sopir ${value.name}.`);
      break;
    }
    case 'draft': {
      const value = draftInput(next, action.value);
      const id = action.value.id === undefined ? nextId(next, 'booking') : text(action.value.id, 'ID booking', true, 160);
      const previous = next.bookings.find(booking => booking.id === id);
      if (previous) requireThat(bookingById(next, id).status === 'draft', 'Hanya booking draft yang dapat diubah.');
      else freshId(next, id);
      const booking: Booking = { ...value, id, tenantId: next.tenantId, number: previous?.number ?? numberFor(next, 'booking'), status: 'draft', pricing: null, createdAt: previous?.createdAt ?? next.now };
      upsert(next.bookings, booking);
      activity(next, 'draft', `Menyimpan draft ${booking.number}.`, id);
      break;
    }
    case 'confirm': {
      const booking = bookingById(next, action.id);
      requireThat(booking.status === 'draft', 'Hanya booking draft yang dapat dikonfirmasi.');
      requireThat(instant(booking.start) >= instant(next.now), 'Booking tidak boleh dikonfirmasi dengan waktu mulai di masa lalu.');
      readyReferences(next, booking);
      const pricing = quote(next, booking);
      const collision = conflict(next, 'vehicle', booking.vehicleId, booking.start, booking.end, booking.id)
        ?? (booking.driverId ? conflict(next, 'driver', booking.driverId, booking.start, booking.end, booking.id) : null);
      requireThat(!collision, collision ?? 'Jadwal tidak tersedia.');
      requireThat(!next.invoices.some(invoice => invoice.bookingId === booking.id), 'Tagihan booking ini sudah tersedia.');
      booking.pricing = pricing; booking.status = 'confirmed';
      const periods = booking.basis === 'monthly' ? booking.months : 1;
      for (let index = 0; index < periods; index++) {
        const start = booking.basis === 'monthly' ? addMonths(booking.start, index) : booking.start;
        const end = booking.basis === 'monthly' ? addMonths(booking.start, index + 1) : booking.end;
        const quantity = booking.basis === 'monthly' ? 1 : pricing.quantity;
        const lines = [line(booking.basis === 'monthly' ? 'Sewa mobil per bulan' : 'Sewa mobil per hari', quantity, pricing.vehicleRate)];
        if (booking.driverId) lines.push(line(booking.basis === 'monthly' ? 'Jasa sopir per bulan' : 'Jasa sopir per hari', quantity, pricing.driverRate));
        issueInvoice(next, booking, 'rental', start, end, lines);
      }
      activity(next, 'confirm', `Mengonfirmasi ${booking.number}; harga dan kebijakan dikunci.`, booking.id);
      break;
    }
    case 'cancel': {
      const booking = bookingById(next, action.id);
      requireThat(['draft', 'confirmed'].includes(booking.status), 'Hanya booking draft atau confirmed yang dapat dibatalkan.');
      const reason = text(action.reason, 'Alasan pembatalan');
      booking.status = 'cancelled'; booking.cancellationReason = reason;
      for (const invoice of next.invoices.filter(item => item.bookingId === booking.id)) {
        requireThat(invoice.tenantId === next.tenantId, 'Relasi tagihan lintas perusahaan tidak valid.');
        invoice.void = true;
      }
      activity(next, 'cancel', `Membatalkan ${booking.number}: ${reason}. Refund harus dicatat terpisah.`, booking.id);
      break;
    }
    case 'cash': {
      const booking = bookingById(next, action.bookingId);
      const kind = choice<CashKind>(action.kind, ['rental_payment', 'rental_refund', 'deposit_received', 'deposit_refund'], 'Jenis transaksi');
      const amount = integer(action.amount, 'Nominal transaksi', 1);
      const method = choice(action.method, ['transfer', 'cash'], 'Metode pembayaran');
      const reference = text(action.reference, 'Referensi', false, 200);
      const isRental = kind === 'rental_payment' || kind === 'rental_refund';
      let invoice: Invoice | null = null;
      if (isRental) {
        requireThat(typeof action.invoiceId === 'string', 'Pembayaran atau refund sewa harus memilih tagihan.');
        invoice = invoiceById(next, action.invoiceId);
        requireThat(invoice.bookingId === booking.id, 'Tagihan bukan milik booking ini.');
        if (kind === 'rental_payment') {
          requireThat(!invoice.void && ['confirmed', 'active', 'completed'].includes(booking.status), 'Tagihan void atau booking ini tidak menerima pembayaran sewa.');
          requireThat(amount <= invoiceBalance(next, invoice), 'Pembayaran melebihi sisa tagihan.');
        } else {
          requireThat(invoice.void && booking.status === 'cancelled', 'Refund sewa hanya untuk tagihan void dari pembatalan.');
          requireThat(amount <= invoicePaid(next, invoice), 'Refund sewa melebihi penerimaan bersih tagihan.');
        }
      } else {
        requireThat(action.invoiceId === null, 'Transaksi deposit tidak boleh dialokasikan ke tagihan sewa.');
        const balance = depositBalance(next, booking.id);
        if (kind === 'deposit_received') {
          requireThat(['confirmed', 'active'].includes(booking.status) && booking.pricing, 'Deposit hanya dapat diterima untuk booking confirmed atau active.');
          requireThat(amount <= booking.pricing.deposit - balance, 'Penerimaan deposit melebihi kekurangan deposit yang disepakati.');
        } else {
          requireThat(['cancelled', 'completed'].includes(booking.status), 'Refund deposit hanya setelah pembatalan atau pengembalian.');
          requireThat(amount <= balance, 'Refund deposit melebihi saldo yang dipegang.');
        }
      }
      // The simplified action has no request ID. Identical submissions at the same demo
      // instant are rejected; a genuinely separate entry can use a different reference.
      requireThat(!next.cash.some(entry => entry.tenantId === next.tenantId && entry.bookingId === booking.id && entry.invoiceId === (invoice?.id ?? null)
        && entry.kind === kind && entry.amount === amount && entry.method === method && entry.reference === reference && instant(entry.at) === instant(next.now)), 'Transaksi identik pada waktu demo ini sudah dicatat. Gunakan referensi berbeda untuk transaksi yang terpisah.');
      next.cash.push({ id: nextId(next, 'cash'), tenantId: next.tenantId, bookingId: booking.id, invoiceId: invoice?.id ?? null, kind, amount, method, reference, at: next.now, actor: next.role });
      activity(next, kind, `${kind}: Rp${amount.toLocaleString('id-ID')} dicatat manual (${method}).`, booking.id);
      break;
    }
    case 'out': {
      const booking = bookingById(next, action.id);
      requireThat(booking.status === 'confirmed', 'Check-out hanya untuk booking confirmed.');
      const now = instant(next.now);
      requireThat(now >= instant(booking.start) && now < instant(booking.end), 'Check-out hanya saat waktu mulai telah tiba dan sebelum waktu selesai.');
      readyReferences(next, booking);
      requireThat(references(next, booking).customer.verified, 'Pelanggan harus terverifikasi sebelum check-out.');
      requireThat(booking.pricing && depositBalance(next, booking.id) >= booking.pricing.deposit, 'Deposit belum mencukupi untuk check-out.');
      requireThat(!next.bookings.some(other => other.tenantId === next.tenantId && other.id !== booking.id && other.status === 'active'
        && (other.vehicleId === booking.vehicleId || (booking.driverId !== null && other.driverId === booking.driverId))), 'Mobil atau sopir masih active pada sewa sebelumnya.');
      const collision = conflict(next, 'vehicle', booking.vehicleId, next.now, booking.end, booking.id)
        ?? (booking.driverId ? conflict(next, 'driver', booking.driverId, next.now, booking.end, booking.id) : null);
      requireThat(!collision, collision ?? 'Jadwal tidak tersedia.');
      const debt = bookingDebt(next, booking.id);
      boolean(action.acknowledgeDebt, 'Pengakuan piutang');
      requireThat(debt === 0 || action.acknowledgeDebt, 'Piutang sewa belum lunas; staf harus mengakui peringatan sebelum check-out.');
      const value = checklist(action.value);
      requireThat(!next.handovers.some(item => item.bookingId === booking.id && item.direction === 'out'), 'Check-out sudah tercatat.');
      next.handovers.push({ ...value, id: nextId(next, 'handover'), tenantId: next.tenantId, bookingId: booking.id, direction: 'out', at: next.now });
      booking.status = 'active';
      activity(next, 'out', `Serah-terima keluar ${booking.number}.${debt > 0 ? ` Piutang Rp${debt.toLocaleString('id-ID')} diakui staf.` : ''}`, booking.id);
      break;
    }
    case 'in': {
      const booking = bookingById(next, action.id);
      requireThat(booking.status === 'active' && booking.pricing, 'Check-in hanya untuk booking active.');
      const out = next.handovers.find(item => item.bookingId === booking.id && item.direction === 'out');
      requireThat(out && out.tenantId === next.tenantId, 'Catatan check-out tidak ditemukan di perusahaan ini.');
      requireThat(instant(next.now) >= instant(out.at), 'Waktu pengembalian tidak boleh mendahului check-out.');
      requireThat(!next.handovers.some(item => item.bookingId === booking.id && item.direction === 'in'), 'Check-in sudah tercatat.');
      const value = checklist(action.value);
      requireThat(value.odometer >= out.odometer, 'Odometer akhir tidak boleh lebih kecil dari odometer awal.');
      const extra = integer(action.extra, 'Biaya tambahan');
      const reason = text(action.reason, 'Alasan biaya tambahan', extra > 0);
      const hours = Math.max(0, Math.ceil((instant(next.now) - instant(booking.end)) / HOUR));
      const lines: InvoiceLine[] = [];
      if (hours > 0 && booking.pricing.lateFee > 0) lines.push(line('Keterlambatan per jam', hours, booking.pricing.lateFee));
      if (extra > 0) lines.push(line(reason, 1, extra));
      if (lines.length > 0) issueInvoice(next, booking, 'final', next.now, next.now, lines);
      bookingDebt(next, booking.id); // Reject aggregate rupiah overflow before committing the return.
      next.handovers.push({ ...value, id: nextId(next, 'handover'), tenantId: next.tenantId, bookingId: booking.id, direction: 'in', at: next.now });
      booking.status = 'completed';
      activity(next, 'in', `Pengembalian ${booking.number}; terlambat ${hours} jam. Deposit dan piutang diselesaikan terpisah.`, booking.id);
      break;
    }
    default:
      throw new Error('Tindakan tidak dikenal.');
  }
  return next;
}
