import { addMonths, applyAction, invoiceBalance } from './domain';
import type { Action, CashKind, DraftInput, HandoverInput, State } from './types';

const DEMO_NOW = '2026-11-13T02:00:00.000Z';
const at = (date: string, time = '09:00') => new Date(`${date}T${time}:00+07:00`).toISOString();
const OUT: HandoverInput = { odometer: 24_600, fuel: 100, body: 'Baik, gores kecil lama sudah dicatat', interior: 'Bersih dan rapi', equipment: true, notes: 'Kunci cadangan, dongkrak, dan ban serep diperiksa bersama.' };

/** Fictional, deterministic fixtures, created through the same guarded flows as the UI. */
export function makeSeed(): State {
  let state: State = {
    version: 1, now: at('2026-10-25'), tenantId: '', role: 'platform', tenants: [], settings: [],
    vehicles: [], customers: [], drivers: [], bookings: [], invoices: [], cash: [], handovers: [], activities: [],
  };
  const act = (action: Action) => { state = applyAction(state, action); };
  const context = (tenantId: string) => act({ type: 'context', tenantId, role: 'owner' });
  const clock = (time: string) => { if (state.now !== time) act({ type: 'clock', at: time }); };
  const tenants = ['t1', 't2'];
  for (const [index, tenantId] of tenants.entries()) {
    act({ type: 'tenant', value: { id: tenantId, name: index === 0 ? 'Nusantara Rent' : 'Langit Rental', code: index === 0 ? 'NUSANTARA' : 'LANGIT', status: 'active', contact: `08xx-0000-000${index + 1}` } });
  }

  const models = [
    { make: 'Toyota', model: 'Avanza Veloz', category: 'MPV', dailyRate: 350_000, monthlyRate: 6_000_000, color: '#dce3eb' },
    { make: 'Toyota', model: 'Innova Zenix', category: 'Premium MPV', dailyRate: 650_000, monthlyRate: 10_000_000, color: '#374151' },
    { make: 'Mitsubishi', model: 'Xpander Ultimate', category: 'MPV', dailyRate: 450_000, monthlyRate: 7_500_000, color: '#9ba8b8' },
    { make: 'Toyota', model: 'Rush TRD', category: 'SUV', dailyRate: 400_000, monthlyRate: 7_000_000, color: '#bac5d1' },
    { make: 'Hyundai', model: 'Stargazer Prime', category: 'MPV', dailyRate: 425_000, monthlyRate: 7_200_000, color: '#667f9b' },
    { make: 'Honda', model: 'Brio Satya', category: 'City Car', dailyRate: 275_000, monthlyRate: 4_500_000, color: '#b7ac79' },
  ];
  const customerNames = [
    ['Aruna Prameswari', 'Bima Adiwangsa', 'Citra Wening', 'Damar Kencana', 'Elang Pradipta', 'Farah Larasati', 'Gilang Mahesa', 'Hana Puspita'],
    ['Intan Sasmita', 'Jati Wiranata', 'Kirana Lestari', 'Lintang Sagara', 'Maya Nirmala', 'Naufal Daniswara', 'Oki Paramarta', 'Prita Sekar'],
  ];
  const driverNames = [['Surya Wicaksana', 'Raka Gumilang', 'Bayu Santosa'], ['Tirta Pranawa', 'Bagas Wisesa', 'Yuda Anggara']];
  for (const [tenantIndex, tenantId] of tenants.entries()) {
    context(tenantId);
    act({ type: 'settings', value: { tenantId, bufferMinutes: 120, deposit: 500_000, lateFee: 50_000 } });
    models.forEach((model, index) => act({ type: 'vehicle', value: {
      ...model, id: `${tenantId}-v${index + 1}`, tenantId, archived: false,
      plate: `${tenantIndex === 0 ? 'B' : 'D'} ${1421 + index} ${tenantIndex === 0 ? 'NRA' : 'LRA'}`,
      transmission: index === 5 ? 'Manual' : 'Automatic', seats: index === 5 ? 5 : 7,
      status: index === 4 ? 'maintenance' : index === 5 ? 'inactive' : 'ready',
    } }));
    customerNames[tenantIndex].forEach((name, index) => act({ type: 'customer', value: {
      id: `${tenantId}-c${index + 1}`, tenantId, archived: false, name,
      phone: `08xx-${tenantIndex === 0 ? '1000' : '2000'}-000${index + 1}`, verified: index !== 3,
      note: index === 3 ? 'Data fiktif; pemeriksaan dokumen simulasi belum selesai.' : 'Pelanggan fiktif untuk demonstrasi; tidak ada dokumen identitas asli.',
    } }));
    driverNames[tenantIndex].forEach((name, index) => act({ type: 'driver', value: {
      id: `${tenantId}-d${index + 1}`, tenantId, archived: false, name, phone: `08xx-${tenantIndex === 0 ? '1100' : '2100'}-000${index + 1}`,
      dailyRate: 200_000, monthlyRate: 3_000_000, status: 'active',
    } }));

    const draft = (n: number, vehicle: number, customer: number, start: string, end: string, note: string, driver: number | null = null, months = 1, basis: DraftInput['basis'] = 'daily') => act({ type: 'draft', value: {
      id: `${tenantId}-b${n}`, vehicleId: `${tenantId}-v${vehicle}`, customerId: `${tenantId}-c${customer}`,
      driverId: driver === null ? null : `${tenantId}-d${driver}`, service: driver === null ? 'self' : 'driver', basis, start, end, months, note,
    } });
    const confirm = (n: number) => act({ type: 'confirm', id: `${tenantId}-b${n}` });
    const cash = (n: number, kind: CashKind, amount: number, reference: string) => {
      const bookingId = `${tenantId}-b${n}`;
      const invoiceId = kind.startsWith('rental_') ? state.invoices.find(invoice => invoice.bookingId === bookingId)!.id : null;
      act({ type: 'cash', bookingId, invoiceId, kind, amount, method: 'transfer', reference });
    };

    draft(1, 1, 1, at('2026-11-07'), at('2026-11-08'), 'Liburan keluarga ke kawasan Puncak. Selesai tepat waktu.');
    draft(2, 2, 2, at('2026-11-09', '08:00'), at('2026-11-09', '20:00'), 'Kunjungan kerja dengan sopir; pengembalian terlambat 61 menit.', 3);
    draft(3, 3, 3, at('2026-11-14'), at('2026-11-15'), 'Rencana perjalanan dibatalkan; sebagian refund masih tertunda.');
    confirm(3);
    cash(3, 'rental_payment', 300_000, 'SIM-DP-BATAL');
    cash(3, 'deposit_received', 500_000, 'SIM-JAMINAN-BATAL');
    act({ type: 'cancel', id: `${tenantId}-b3`, reason: 'Acara keluarga dijadwalkan ulang oleh penyewa.' });
    cash(3, 'rental_refund', 100_000, 'SIM-REFUND-SEWA-1');
    cash(3, 'deposit_refund', 200_000, 'SIM-REFUND-JAMINAN-1');
    draft(4, 4, 4, at('2027-01-10'), at('2027-02-10'), 'Draft kontrak yang tidak dilanjutkan.', null, 1, 'monthly');
    act({ type: 'cancel', id: `${tenantId}-b4`, reason: 'Kebutuhan kendaraan belum disetujui tim penyewa.' });
    const monthlyStart = at('2026-10-31');
    draft(5, 3, 5, monthlyStart, addMonths(monthlyStart, 2), 'Kontrak operasional dua bulan dengan sopir. Tagihan kedua belum jatuh tempo.', 1, 2, 'monthly');
    draft(6, 4, 6, at('2026-11-11', '08:00'), at('2026-11-12', '18:00'), 'Perjalanan luar kota; mobil belum kembali dan perlu ditindaklanjuti.', 2);
    draft(7, 2, 7, at('2026-11-13', '09:15'), at('2026-11-13', '09:45'), 'Antar tamu ke stasiun. Majukan jam ke 09.15 WIB untuk check-out.', 3);
    draft(8, 2, 8, at('2026-11-13', '12:00'), at('2026-11-13', '18:00'), 'Jadwal keluar siang setelah buffer perjalanan pagi.');
    draft(9, 1, 1, at('2026-11-13'), at('2026-11-14'), 'Mobil siap dan bebas hari ini. Konfirmasi draft, catat deposit, lalu check-out.');
    const january = at('2027-01-31');
    draft(10, 1, 2, january, addMonths(january, 2), 'Contoh kontrak kalender: 31 Januari → 28 Februari → 31 Maret.', null, 2, 'monthly');
    for (const n of [1, 2, 5, 6, 7, 8]) confirm(n);
    for (const n of [1, 2, 5, 6, 7]) cash(n, 'deposit_received', 500_000, `SIM-DEPOSIT-${n}`);
    cash(5, 'rental_payment', 6_000_000, 'SIM-DP-KONTRAK');
  }

  // Replay actual handovers chronologically across both tenants; the clock never goes back.
  const events: { time: string; booking: number; direction: 'out' | 'in'; odometer: number; extra?: number }[] = [
    { time: at('2026-10-31'), booking: 5, direction: 'out', odometer: 31_200 },
    { time: at('2026-11-07'), booking: 1, direction: 'out', odometer: 24_600 },
    { time: at('2026-11-08'), booking: 1, direction: 'in', odometer: 24_920 },
    { time: at('2026-11-09', '08:00'), booking: 2, direction: 'out', odometer: 18_100 },
    { time: at('2026-11-09', '21:01'), booking: 2, direction: 'in', odometer: 18_260, extra: 75_000 },
    { time: at('2026-11-11', '08:00'), booking: 6, direction: 'out', odometer: 42_100 },
  ];
  for (const event of events) {
    clock(event.time);
    for (const tenantId of tenants) {
      context(tenantId);
      const id = `${tenantId}-b${event.booking}`;
      const value = { ...OUT, odometer: event.odometer, fuel: event.direction === 'out' ? 100 : 75 };
      if (event.direction === 'out') {
        if ([1, 2, 6].includes(event.booking)) {
          const invoice = state.invoices.find(item => item.bookingId === id)!;
          act({ type: 'cash', bookingId: id, invoiceId: invoice.id, kind: 'rental_payment', amount: event.booking === 6 ? 400_000 : invoiceBalance(state, invoice), method: 'transfer', reference: 'SIM-BAYAR-SAAT-AMBIL' });
        }
        act({ type: 'out', id, value, acknowledgeDebt: true });
      } else {
        act({ type: 'in', id, value, extra: event.extra ?? 0, reason: event.extra ? 'Penggantian BBM sesuai checklist pengembalian' : '' });
        if (event.booking === 1) act({ type: 'cash', bookingId: id, invoiceId: null, kind: 'deposit_refund', amount: 500_000, method: 'transfer', reference: 'SIM-JAMINAN-KEMBALI-LUNAS' });
      }
    }
  }
  clock(DEMO_NOW);
  for (const tenantId of tenants) {
    context(tenantId);
    for (const n of [7, 8]) {
      const bookingId = `${tenantId}-b${n}`;
      const invoice = state.invoices.find(item => item.bookingId === bookingId)!;
      act({ type: 'cash', bookingId, invoiceId: invoice.id, kind: 'rental_payment', amount: n === 7 ? invoiceBalance(state, invoice) : 200_000, method: 'transfer', reference: 'SIM-BOOKING-HARI-INI' });
    }
  }
  context('t1');
  return state;
}
