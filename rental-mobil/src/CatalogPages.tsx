import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArrowUpRight, Building2, CarFront, Gauge, History, Pencil, Plus, Power, ShieldCheck, Users } from 'lucide-react';
import { confirmLeave, useApp } from './store';
import { dateLabel, money, timeLabel, uid } from './format';
import { Badge, CarIllustration, Empty, Field, FormFooter, Modal, PageHeading, SearchBox, SectionTitle } from './ui';
import type { Customer, Driver, Tenant, Vehicle } from './types';

type CatalogKind = 'vehicles' | 'customers' | 'drivers';
type CatalogEntry =
  | { type: 'vehicle'; value: Vehicle }
  | { type: 'customer'; value: Customer }
  | { type: 'driver'; value: Driver };
type Editor = CatalogEntry & { isNew: boolean };

const COLORS = [
  { name: 'Biru', value: '#667f9b' },
  { name: 'Putih', value: '#dce3eb' },
  { name: 'Abu-abu', value: '#9ba8b8' },
  { name: 'Hitam', value: '#374151' },
  { name: 'Silver', value: '#bac5d1' },
  { name: 'Merah', value: '#a65c66' },
  { name: 'Hijau', value: '#7c968b' },
  { name: 'Kuning', value: '#b7ac79' },
];
const CATALOG = {
  vehicles: {
    title: 'Armada', singular: 'mobil',
    description: 'Armada yang terawat, perjalanan yang lebih nyaman.',
    search: 'Cari pelat, merek, atau model…',
    statuses: [['all', 'Semua armada'], ['ready', 'Siap jalan'], ['maintenance', 'Perawatan'], ['inactive', 'Nonaktif']],
  },
  customers: {
    title: 'Pelanggan', singular: 'pelanggan',
    description: 'Kenali pelanggan Anda dan lihat setiap perjalanannya.',
    search: 'Cari nama atau kontak pelanggan…',
    statuses: [['all', 'Semua pelanggan'], ['verified', 'Terverifikasi'], ['unverified', 'Belum diverifikasi']],
  },
  drivers: {
    title: 'Sopir', singular: 'sopir',
    description: 'Kelola tim di balik setiap perjalanan.',
    search: 'Cari nama atau kontak sopir…',
    statuses: [['all', 'Semua sopir'], ['active', 'Aktif'], ['inactive', 'Nonaktif']],
  },
} as const;

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '—';
}
function colorPreset(color: string) {
  return COLORS.find(preset => preset.value === color || preset.name.toLocaleLowerCase('id-ID') === color.trim().toLocaleLowerCase('id-ID')) ?? COLORS[0];
}
function safeColor(color: string) { return colorPreset(color).value; }
function rateLabel(rate: number | null) { return rate === null ? 'Belum diatur' : money(rate); }
function text(data: FormData, name: string) { return String(data.get(name) ?? '').trim(); }
function nullableNumber(data: FormData, name: string) { const value = text(data, name); return value === '' ? null : Number(value); }
function markSaved(form: HTMLFormElement) { form.dataset.dirty = 'false'; }

function AccessNotice({ title, description }: { title: string; description: string }) {
  return <><PageHeading eyebrow="Ruang kerja" title={title} /><div className="notice" role="status"><ShieldCheck size={20} aria-hidden="true" /><p>{description}</p></div></>;
}

function CatalogActions({ label, archived, onEdit, onArchive }: { label: string; archived: boolean; onEdit: () => void; onArchive: () => void }) {
  return <div className="inline-actions">
    <button type="button" className="button secondary small" onClick={onEdit} aria-label={`Edit ${label}`}><Pencil size={14} aria-hidden="true" />Edit</button>
    {!archived && <button type="button" className="button secondary small" onClick={onArchive} aria-label={`Arsipkan ${label}`}><Archive size={14} aria-hidden="true" />Arsipkan</button>}
  </div>;
}

export function CatalogPage({ kind }: { kind: CatalogKind }) {
  const { state, tenant } = useApp();
  if (state.role === 'platform') return <AccessNotice title={CATALOG[kind].title} description="Data operasional hanya tersedia untuk pemilik dan staf perusahaan. Pengelola platform hanya melihat ringkasan perusahaan." />;
  if (tenant.status !== 'active') return <AccessNotice title="Perusahaan nonaktif" description="Akses operasional dinonaktifkan. Pilih perusahaan aktif melalui kontrol demo." />;
  return <CatalogContent key={`${tenant.id}:${state.role}:${kind}`} kind={kind} />;
}

function CatalogContent({ kind }: { kind: CatalogKind }) {
  const { state, tenant, vehicles, customers, drivers, bookings, run } = useApp();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const config = CATALOG[kind];
  const needle = query.trim().toLocaleLowerCase('id-ID');
  const matches = (values: string[]) => values.join(' ').toLocaleLowerCase('id-ID').includes(needle);
  const visibleVehicles = vehicles.filter(vehicle => (showArchived || !vehicle.archived) && (status === 'all' || vehicle.status === status) && matches([vehicle.plate, vehicle.make, vehicle.model, vehicle.category]));
  const visibleCustomers = customers.filter(customer => (showArchived || !customer.archived) && (status === 'all' || (customer.verified ? 'verified' : 'unverified') === status) && matches([customer.name, customer.phone]));
  const visibleDrivers = drivers.filter(driver => (showArchived || !driver.archived) && (status === 'all' || driver.status === status) && matches([driver.name, driver.phone]));
  const count = kind === 'vehicles' ? visibleVehicles.length : kind === 'customers' ? visibleCustomers.length : visibleDrivers.length;
  const total = (kind === 'vehicles' ? vehicles : kind === 'customers' ? customers : drivers).filter(item => showArchived || !item.archived).length;
  const hasFilters = needle !== '' || status !== 'all';
  const historyCustomer = customers.find(customer => customer.id === historyId);
  const resetFilters = () => { setQuery(''); setStatus('all'); };
  const closeEditor = () => { if (confirmLeave()) setEditor(null); };

  function add() {
    const base = { id: uid(), tenantId: tenant.id, archived: false };
    if (kind === 'vehicles') setEditor({ type: 'vehicle', isNew: true, value: { ...base, plate: '', make: '', model: '', category: 'MPV', transmission: 'Automatic', seats: 7, color: COLORS[0].value, dailyRate: null, monthlyRate: null, status: 'ready' } });
    else if (kind === 'customers') setEditor({ type: 'customer', isNew: true, value: { ...base, name: '', phone: '', verified: false, note: '' } });
    else setEditor({ type: 'driver', isNew: true, value: { ...base, name: '', phone: '', dailyRate: null, monthlyRate: null, status: 'active' } });
  }

  function archive(entry: CatalogEntry) {
    const label = entry.type === 'vehicle' ? `${entry.value.make} ${entry.value.model} (${entry.value.plate})` : entry.value.name;
    if (!window.confirm(`Arsipkan ${label}? Data tidak dihapus dan riwayat tetap tersimpan. Data yang masih terkait penyewaan terjadwal atau berjalan tidak dapat diarsipkan.`)) return;
    const message = `${entry.type === 'vehicle' ? 'Mobil' : entry.type === 'customer' ? 'Pelanggan' : 'Sopir'} berhasil diarsipkan.`;
    if (entry.type === 'vehicle') run({ type: 'vehicle', value: { ...entry.value, archived: true } }, message);
    else if (entry.type === 'customer') run({ type: 'customer', value: { ...entry.value, archived: true } }, message);
    else run({ type: 'driver', value: { ...entry.value, archived: true } }, message);
  }

  return <>
    <PageHeading eyebrow={`${tenant.name} / Data operasional`} title={config.title} description={config.description} actions={<button type="button" className="button primary" onClick={add}><Plus size={18} aria-hidden="true" />Tambah {config.singular}</button>} />
    <section className="panel" aria-label={`Filter ${config.title.toLowerCase()}`}>
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder={config.search} />
        <label className="checkbox-line"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Tampilkan arsip</label>
      </div>
      <div className="tabs" role="group" aria-label="Filter status">
        {config.statuses.map(([value, label]) => <button type="button" key={value} className={`tab${status === value ? ' active' : ''}`} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}
      </div>
    </section>
    <div className="section-title"><p className="muted" role="status">Menampilkan {count} dari {total} {config.singular}{showArchived ? ', termasuk arsip' : ''}</p>{hasFilters && <button type="button" className="button secondary small" onClick={resetFilters}>Reset filter</button>}</div>
    {state.role === 'staff' && kind !== 'customers' && <div className="notice"><ShieldCheck size={18} aria-hidden="true" /><p>Staf dapat mengelola data operasional. Tarif diatur oleh pemilik; data baru belum dapat dikonfirmasi untuk sewa sampai tarifnya diisi.</p></div>}
    {count === 0 ? <section className="panel"><Empty title={hasFilters ? 'Tidak ada hasil yang cocok' : `Belum ada ${config.singular}`} description={hasFilters ? 'Coba kata kunci lain atau reset filter status.' : `Tambahkan ${config.singular} untuk melengkapi data operasional perusahaan ini.`} action={<button type="button" className="button secondary" onClick={hasFilters ? resetFilters : add}>{hasFilters ? 'Reset filter' : `Tambah ${config.singular}`}</button>} /></section> : kind === 'vehicles' ? <div className="fleet-grid">
      {visibleVehicles.map(vehicle => {
        const current = bookings.find(booking => booking.vehicleId === vehicle.id && booking.status === 'active');
        const scheduled = bookings.filter(booking => booking.vehicleId === vehicle.id && booking.status === 'confirmed').length;
        return <article key={vehicle.id} className="fleet-card">
          <div className="fleet-visual"><CarIllustration color={safeColor(vehicle.color)} /></div>
          <div className="fleet-info">
            <div className="inline-actions"><span className="plate">{vehicle.plate}</span><Badge status={vehicle.archived ? 'inactive' : vehicle.status}>{vehicle.archived ? 'Diarsipkan' : undefined}</Badge></div>
            <h3>{vehicle.make} {vehicle.model}</h3>
            <div className="fleet-specs"><span>{vehicle.category}</span><span><Gauge size={14} aria-hidden="true" />{vehicle.transmission === 'Automatic' ? 'Otomatis' : 'Manual'}</span><span><Users size={14} aria-hidden="true" />{vehicle.seats} kursi</span></div>
            {current ? <p className="cell-sub"><Badge status={Date.parse(state.now) > Date.parse(current.end) ? 'overdue' : 'active'}>{Date.parse(state.now) > Date.parse(current.end) ? 'Terlambat kembali' : 'Sedang disewa'}</Badge></p> : <p className="cell-sub">{scheduled > 0 ? `${scheduled} penyewaan terjadwal` : 'Tidak ada penyewaan terjadwal'}</p>}
            <div className="detail-grid">
              <div className="detail-item"><span className="cell-sub">Tarif harian</span><strong>{rateLabel(vehicle.dailyRate)}</strong></div>
              <div className="detail-item"><span className="cell-sub">Tarif bulanan</span><strong>{rateLabel(vehicle.monthlyRate)}</strong></div>
            </div>
          </div>
          <div className="fleet-footer"><CatalogActions label={`${vehicle.make} ${vehicle.model}, ${vehicle.plate}`} archived={vehicle.archived} onEdit={() => setEditor({ type: 'vehicle', value: vehicle, isNew: false })} onArchive={() => archive({ type: 'vehicle', value: vehicle })} /></div>
        </article>;
      })}
    </div> : kind === 'customers' ? <section className="panel">
      <div className="table-wrap" role="region" aria-label="Daftar pelanggan" tabIndex={0}>
        <table className="data-table"><caption className="sr-only">Pelanggan perusahaan {tenant.name}</caption><thead><tr><th scope="col">Pelanggan</th><th scope="col">Verifikasi</th><th scope="col">Catatan</th><th scope="col">Penyewaan</th><th scope="col">Tindakan</th></tr></thead><tbody>
          {visibleCustomers.map(customer => <tr key={customer.id}>
            <th scope="row"><div className="inline-actions"><span className="avatar" aria-hidden="true">{initials(customer.name)}</span><div><div className="cell-title">{customer.name}</div><div className="cell-sub">{customer.phone || 'Kontak belum diisi'}</div></div></div></th>
            <td><div className="stack"><Badge status={customer.verified ? 'verified' : 'unverified'} />{customer.archived && <Badge status="inactive">Diarsipkan</Badge>}</div></td>
            <td>{customer.note || <span className="muted">Belum ada catatan</span>}</td>
            <td><button type="button" className="button secondary small" onClick={() => setHistoryId(customer.id)} aria-label={`Riwayat penyewaan ${customer.name}`}><History size={14} aria-hidden="true" />{bookings.filter(booking => booking.customerId === customer.id).length} penyewaan</button></td>
            <td><CatalogActions label={customer.name} archived={customer.archived} onEdit={() => setEditor({ type: 'customer', value: customer, isNew: false })} onArchive={() => archive({ type: 'customer', value: customer })} /></td>
          </tr>)}
        </tbody></table>
      </div>
    </section> : <section className="panel">
      <div className="table-wrap" role="region" aria-label="Daftar sopir" tabIndex={0}>
        <table className="data-table"><caption className="sr-only">Sopir perusahaan {tenant.name}</caption><thead><tr><th scope="col">Sopir</th><th scope="col">Status</th><th scope="col">Tarif harian</th><th scope="col">Tarif bulanan</th><th scope="col">Penugasan</th><th scope="col">Tindakan</th></tr></thead><tbody>
          {visibleDrivers.map(driver => {
            const assignments = bookings.filter(booking => booking.driverId === driver.id && (booking.status === 'confirmed' || booking.status === 'active'));
            return <tr key={driver.id}>
              <th scope="row"><div className="inline-actions"><span className="avatar" aria-hidden="true">{initials(driver.name)}</span><div><div className="cell-title">{driver.name}</div><div className="cell-sub">{driver.phone || 'Kontak belum diisi'}</div></div></div></th>
              <td><Badge status={driver.archived || driver.status === 'inactive' ? 'inactive' : 'available'}>{driver.archived ? 'Diarsipkan' : driver.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge></td>
              <td>{rateLabel(driver.dailyRate)}</td><td>{rateLabel(driver.monthlyRate)}</td>
              <td><div className="cell-title">{assignments.length} penugasan</div><div className="cell-sub">{assignments.some(booking => booking.status === 'active') ? 'Sedang bertugas' : assignments.length > 0 ? 'Terjadwal' : 'Belum ada penugasan'}</div></td>
              <td><CatalogActions label={driver.name} archived={driver.archived} onEdit={() => setEditor({ type: 'driver', value: driver, isNew: false })} onArchive={() => archive({ type: 'driver', value: driver })} /></td>
            </tr>;
          })}
        </tbody></table>
      </div>
    </section>}
    {editor && <CatalogEditor key={editor.value.id} editor={editor} onClose={closeEditor} onSaved={() => setEditor(null)} />}
    {historyCustomer && <CustomerHistory customer={historyCustomer} onClose={() => { if (confirmLeave()) setHistoryId(null); }} />}
  </>;
}

function TariffFields({ entity, owner, vehicle }: { entity: Vehicle | Driver; owner: boolean; vehicle: boolean }) {
  if (!owner) return <div className="field-wide"><SectionTitle title="Tarif sewa" subtitle="Hanya pemilik yang dapat mengubah tarif. Nilai saat ini akan dipertahankan." /><div className="detail-grid"><div className="detail-item"><span className="cell-sub">Harian</span><strong>{rateLabel(entity.dailyRate)}</strong></div><div className="detail-item"><span className="cell-sub">Bulanan</span><strong>{rateLabel(entity.monthlyRate)}</strong></div></div></div>;
  const hint = vehicle ? 'Kosong = belum diatur. Jika diisi, minimal Rp1.' : 'Kosong = belum diatur. Rp0 diperbolehkan jika ditetapkan secara sengaja.';
  return <>
    <Field label="Tarif harian (Rp)" hint={hint}><input name="dailyRate" type="number" min={vehicle ? 1 : 0} max={Number.MAX_SAFE_INTEGER} step={1} inputMode="numeric" defaultValue={entity.dailyRate ?? ''} placeholder="Belum diatur" /></Field>
    <Field label="Tarif bulanan (Rp)" hint={hint}><input name="monthlyRate" type="number" min={vehicle ? 1 : 0} max={Number.MAX_SAFE_INTEGER} step={1} inputMode="numeric" defaultValue={entity.monthlyRate ?? ''} placeholder="Belum diatur" /></Field>
    <p className="field-wide muted">Perubahan tarif hanya berlaku untuk konfirmasi berikutnya. Tarif penyewaan yang sudah dikonfirmasi tidak berubah.</p>
  </>;
}

function CatalogEditor({ editor, onClose, onSaved }: { editor: Editor; onClose: () => void; onSaved: () => void }) {
  const { state, tenant, vehicles, customers, drivers, run, notify } = useApp();
  const owner = state.role === 'owner';
  const noun = editor.type === 'vehicle' ? 'mobil' : editor.type === 'customer' ? 'pelanggan' : 'sopir';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const message = `${noun === 'mobil' ? 'Mobil' : noun === 'pelanggan' ? 'Pelanggan' : 'Sopir'} berhasil ${editor.isNew ? 'ditambahkan' : 'diperbarui'}.`;
    if (editor.value.tenantId !== tenant.id) { notify('Data tidak ditemukan di perusahaan ini.', true); return; }
    let action: CatalogEntry;
    if (editor.type === 'vehicle') {
      const current = vehicles.find(vehicle => vehicle.id === editor.value.id);
      if (!editor.isNew && !current) { notify('Mobil tidak ditemukan di perusahaan ini.', true); return; }
      const base = current ?? editor.value;
      action = { type: 'vehicle', value: {
        ...base, plate: text(data, 'plate'), make: text(data, 'make'), model: text(data, 'model'), category: text(data, 'category'),
        transmission: text(data, 'transmission') as Vehicle['transmission'], seats: Number(data.get('seats')),
        color: colorPreset(text(data, 'color')).value,
        status: text(data, 'status') as Vehicle['status'],
        dailyRate: owner ? nullableNumber(data, 'dailyRate') : current?.dailyRate ?? null,
        monthlyRate: owner ? nullableNumber(data, 'monthlyRate') : current?.monthlyRate ?? null,
      } };
    } else if (editor.type === 'customer') {
      const current = customers.find(customer => customer.id === editor.value.id);
      if (!editor.isNew && !current) { notify('Pelanggan tidak ditemukan di perusahaan ini.', true); return; }
      action = { type: 'customer', value: { ...(current ?? editor.value), name: text(data, 'name'), phone: text(data, 'phone'), verified: data.get('verified') === 'on', note: text(data, 'note') } };
    } else {
      const current = drivers.find(driver => driver.id === editor.value.id);
      if (!editor.isNew && !current) { notify('Sopir tidak ditemukan di perusahaan ini.', true); return; }
      action = { type: 'driver', value: {
        ...(current ?? editor.value), name: text(data, 'name'), phone: text(data, 'phone'), status: text(data, 'status') as Driver['status'],
        dailyRate: owner ? nullableNumber(data, 'dailyRate') : current?.dailyRate ?? null,
        monthlyRate: owner ? nullableNumber(data, 'monthlyRate') : current?.monthlyRate ?? null,
      } };
    }
    if (run(action, message)) { markSaved(form); onSaved(); }
  }

  return <Modal open onClose={onClose} title={`${editor.isNew ? 'Tambah' : 'Edit'} ${noun}`} description={`Data ${noun} untuk ${tenant.name}. Gunakan data fiktif, bukan dokumen atau kontak pribadi asli.`} wide={editor.type === 'vehicle'}>
    <form onSubmit={submit} data-dirty="false">
      {editor.value.archived && <div className="notice"><Archive size={18} aria-hidden="true" /><p>Data ini diarsipkan. Perubahan tidak mengaktifkannya kembali untuk penyewaan baru.</p></div>}
      <div className="form-grid">
        {editor.type === 'vehicle' ? <>
          <Field label="Nomor pelat" hint="Pelat harus unik di perusahaan ini."><input name="plate" required defaultValue={editor.value.plate} placeholder="B 1234 DEM" autoCapitalize="characters" /></Field>
          <Field label="Merek"><input name="make" required defaultValue={editor.value.make} placeholder="Toyota" /></Field>
          <Field label="Model"><input name="model" required defaultValue={editor.value.model} placeholder="Avanza Veloz" /></Field>
          <Field label="Kategori"><input name="category" required defaultValue={editor.value.category} placeholder="MPV" /></Field>
          <Field label="Transmisi"><select name="transmission" required defaultValue={editor.value.transmission}><option value="Automatic">Otomatis</option><option value="Manual">Manual</option></select></Field>
          <Field label="Jumlah kursi"><input name="seats" type="number" required min={1} max={60} step={1} inputMode="numeric" defaultValue={editor.value.seats} /></Field>
          <Field label="Warna kendaraan"><select name="color" required defaultValue={colorPreset(editor.value.color).name}>{COLORS.map(color => <option key={color.value} value={color.name}>{color.name}</option>)}</select></Field>
          <Field label="Status operasional"><select name="status" required defaultValue={editor.value.status}><option value="ready">Siap jalan</option><option value="maintenance">Perawatan</option><option value="inactive">Nonaktif</option></select></Field>
          <p className="field-wide muted">Status disewa ditentukan oleh penyewaan, bukan diubah manual. Kendaraan dengan penyewaan terjadwal atau berjalan tidak dapat dinonaktifkan, dirawat, atau diarsipkan.</p>
          <TariffFields entity={editor.value} owner={owner} vehicle />
        </> : <>
          <Field label={`Nama ${noun}`}><input name="name" required defaultValue={editor.value.name} placeholder={`Nama ${noun} fiktif`} /></Field>
          <Field label="Kontak fiktif (opsional)" hint="Nomor simulasi saja, bukan nomor pribadi asli."><input name="phone" type="tel" defaultValue={editor.value.phone} placeholder="08xx-0000-0000" /></Field>
          {editor.type === 'customer' ? <>
            <label className="checkbox-line field-wide"><input name="verified" type="checkbox" defaultChecked={editor.value.verified} />Pemeriksaan identitas telah diverifikasi (simulasi)</label>
            <p className="field-wide muted">Pelanggan belum terverifikasi boleh membuat booking, tetapi tidak dapat menerima kendaraan saat serah-terima.</p>
            <Field label="Catatan verifikasi / pelanggan" wide hint="Catat hasil pemeriksaan simulasi tanpa nomor KTP, SIM, atau dokumen asli."><textarea name="note" rows={3} defaultValue={editor.value.note} placeholder="Catatan pemeriksaan dan kebutuhan pelanggan" /></Field>
          </> : <>
            <Field label="Status sopir" wide><select name="status" required defaultValue={editor.value.status}><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></Field>
            <p className="field-wide muted">Sopir dengan penyewaan terjadwal atau berjalan tidak dapat dinonaktifkan atau diarsipkan.</p>
            <TariffFields entity={editor.value} owner={owner} vehicle={false} />
          </>}
        </>}
      </div>
      <FormFooter onClose={onClose} label={editor.isNew ? `Tambah ${noun}` : 'Simpan perubahan'} />
    </form>
  </Modal>;
}

function CustomerHistory({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { bookings, vehicles } = useApp();
  const history = bookings.filter(booking => booking.customerId === customer.id).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  const vehicleById = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
  return <Modal open onClose={onClose} title={`Riwayat ${customer.name}`} description="Seluruh penyewaan pelanggan ini di perusahaan aktif, termasuk draft dan pembatalan." wide>
    <div className="profile-card"><div className="inline-actions"><span className="avatar" aria-hidden="true">{initials(customer.name)}</span><div><h3>{customer.name}</h3><p className="muted">{customer.phone || 'Kontak belum diisi'}</p></div><Badge status={customer.verified ? 'verified' : 'unverified'} />{customer.archived && <Badge status="inactive">Diarsipkan</Badge>}</div>{customer.note && <p>{customer.note}</p>}</div>
    {history.length === 0 ? <Empty title="Belum ada riwayat penyewaan" description="Penyewaan pelanggan ini akan tampil di sini setelah booking dibuat." /> : <div className="table-wrap" role="region" aria-label={`Riwayat penyewaan ${customer.name}`} tabIndex={0}>
      <table className="data-table"><caption className="sr-only">{history.length} penyewaan milik {customer.name}</caption><thead><tr><th scope="col">Penyewaan</th><th scope="col">Kendaraan</th><th scope="col">Periode (WIB)</th><th scope="col">Status</th><th scope="col">Nilai sewa</th></tr></thead><tbody>
        {history.map(booking => {
          const vehicle = vehicleById.get(booking.vehicleId);
          return <tr key={booking.id}>
            <th scope="row"><Link to={`/penyewaan/${encodeURIComponent(booking.id)}`} className="button secondary small" onClick={event => { if (!confirmLeave()) event.preventDefault(); }} aria-label={`Buka penyewaan ${booking.number}`}>{booking.number}<ArrowUpRight size={14} aria-hidden="true" /></Link><div className="cell-sub">{booking.service === 'self' ? 'Lepas kunci' : 'Dengan sopir'} · {booking.basis === 'daily' ? 'Harian' : 'Bulanan'}</div></th>
            <td><div className="cell-title">{vehicle ? `${vehicle.make} ${vehicle.model}` : 'Kendaraan tidak ditemukan'}</div><div className="cell-sub">{vehicle?.plate ?? '—'}</div></td>
            <td><div>{dateLabel(booking.start, { year: 'numeric' })}, {timeLabel(booking.start)}</div><div className="cell-sub">s.d. {dateLabel(booking.end, { year: 'numeric' })}, {timeLabel(booking.end)}</div></td>
            <td><Badge status={booking.status} /></td><td>{booking.pricing ? money(booking.pricing.total) : <span className="muted">Belum dikonfirmasi</span>}</td>
          </tr>;
        })}
      </tbody></table>
    </div>}
    <div className="form-footer"><button type="button" className="button secondary" onClick={onClose}>Tutup riwayat</button></div>
  </Modal>;
}

export function SettingsPage() {
  const { state, tenant } = useApp();
  if (state.role !== 'owner') return <AccessNotice title="Pengaturan" description="Hanya pemilik perusahaan yang dapat melihat dan mengubah pengaturan kebijakan rental." />;
  if (tenant.status !== 'active') return <AccessNotice title="Perusahaan nonaktif" description="Pengaturan tidak tersedia untuk perusahaan nonaktif. Pilih perusahaan aktif melalui kontrol demo." />;
  return <SettingsContent key={`${tenant.id}:${state.role}`} />;
}

function SettingsContent() {
  const { tenant, settings, run } = useApp();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const result = run({ type: 'settings', value: { tenantId: tenant.id, bufferMinutes: Number(data.get('bufferMinutes')), deposit: Number(data.get('deposit')), lateFee: Number(data.get('lateFee')) } }, 'Pengaturan berhasil disimpan. Penyewaan yang sudah dikonfirmasi tidak berubah.');
    if (result) markSaved(form);
  }
  function cancel() {
    if (!confirmLeave()) return;
    if (formRef.current) { formRef.current.reset(); markSaved(formRef.current); }
  }

  return <>
    <PageHeading eyebrow={`${tenant.name} / Ruang kerja`} title="Pengaturan" description="Kebijakan yang jelas untuk setiap perjalanan." />
    <div className="settings-grid">
      <section className="panel profile-card" aria-labelledby="company-profile-title">
        <Building2 size={30} aria-hidden="true" /><h2 id="company-profile-title">Profil perusahaan</h2><p className="muted">Informasi ruang kerja perusahaan Anda.</p>
        <dl className="detail-grid">
          <div className="detail-item"><dt>Nama perusahaan</dt><dd>{tenant.name}</dd></div>
          <div className="detail-item"><dt>Kode perusahaan</dt><dd>{tenant.code}</dd></div>
          <div className="detail-item"><dt>Kontak fiktif</dt><dd>{tenant.contact || 'Belum diisi'}</dd></div>
          <div className="detail-item"><dt>Status</dt><dd><Badge status="available">Aktif</Badge></dd></div>
          <div className="detail-item"><dt>Mata uang</dt><dd>Rupiah (IDR)</dd></div>
          <div className="detail-item"><dt>Zona waktu</dt><dd>Asia/Jakarta (WIB)</dd></div>
        </dl>
        <p className="muted">Profil perusahaan hanya dapat diperbarui oleh pengelola platform melalui halaman perusahaan.</p>
      </section>
      <section className="panel" aria-label="Kebijakan penyewaan">
        <SectionTitle title="Kebijakan penyewaan" subtitle="Berlaku untuk booking yang dikonfirmasi setelah perubahan disimpan." />
        <form ref={formRef} onSubmit={submit} data-dirty="false">
          <div className="form-grid">
            <Field label="Buffer kendaraan (menit)" wide hint="Waktu persiapan kendaraan antarsewa. Tidak berlaku untuk sopir."><input type="number" name="bufferMinutes" required min={0} max={Number.MAX_SAFE_INTEGER} step={1} inputMode="numeric" defaultValue={settings.bufferMinutes} /></Field>
            <Field label="Deposit default (Rp)" hint="Jaminan terpisah dari tagihan sewa. Isi 0 jika tidak diwajibkan."><input type="number" name="deposit" required min={0} max={Number.MAX_SAFE_INTEGER} step={1} inputMode="numeric" defaultValue={settings.deposit} /></Field>
            <Field label="Tarif keterlambatan (Rp/jam)" hint="Dibulatkan ke atas per jam terlambat. Isi 0 jika tidak dikenakan."><input type="number" name="lateFee" required min={0} max={Number.MAX_SAFE_INTEGER} step={1} inputMode="numeric" defaultValue={settings.lateFee} /></Field>
          </div>
          <div className="notice"><ShieldCheck size={20} aria-hidden="true" /><p>Tarif, deposit, buffer, dan biaya keterlambatan pada penyewaan terkonfirmasi tetap mengikuti nilai yang tersimpan saat konfirmasi.</p></div>
          <FormFooter onClose={cancel} label="Simpan pengaturan" />
        </form>
      </section>
    </div>
  </>;
}

export function PlatformPage() {
  const { state } = useApp();
  if (state.role !== 'platform') return <AccessNotice title="Perusahaan rental" description="Halaman ini hanya tersedia untuk pengelola platform. Gunakan kontrol peran demo untuk beralih konteks." />;
  return <PlatformContent />;
}

function PlatformContent() {
  const { state, run } = useApp();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [editor, setEditor] = useState<{ tenant: Tenant; isNew: boolean } | null>(null);
  const needle = query.trim().toLocaleLowerCase('id-ID');
  const tenants = state.tenants.filter(tenant => (status === 'all' || tenant.status === status) && `${tenant.name} ${tenant.code} ${tenant.contact}`.toLocaleLowerCase('id-ID').includes(needle));
  const counts = new Map(state.tenants.map(tenant => [tenant.id, { vehicles: 0, bookings: 0 }]));
  for (const vehicle of state.vehicles) { const count = counts.get(vehicle.tenantId); if (count) count.vehicles += 1; }
  for (const booking of state.bookings) { const count = counts.get(booking.tenantId); if (count) count.bookings += 1; }
  const close = () => { if (confirmLeave()) setEditor(null); };
  const add = () => setEditor({ tenant: { id: uid(), name: '', code: '', contact: '', status: 'active' }, isNew: true });
  const resetFilters = () => { setQuery(''); setStatus('all'); };

  function toggle(tenant: Tenant) {
    const nextStatus = tenant.status === 'active' ? 'inactive' : 'active';
    const message = nextStatus === 'inactive'
      ? `Nonaktifkan ${tenant.name}? Pemilik dan staf tidak dapat mengakses ruang kerja ini. Seluruh data tetap tersimpan dan akses dapat diaktifkan kembali.`
      : `Aktifkan kembali ${tenant.name}? Pemilik dan staf dapat kembali mengakses ruang kerja dan data yang tersimpan.`;
    if (window.confirm(message)) run({ type: 'tenant', value: { ...tenant, status: nextStatus } }, `Perusahaan berhasil ${nextStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`);
  }

  return <>
    <PageHeading eyebrow="Administrasi platform" title="Perusahaan rental" description="Kelola ruang kerja. Biarkan setiap rental mengelola perjalanannya." actions={<button type="button" className="button primary" onClick={add}><Plus size={18} aria-hidden="true" />Tambah perusahaan</button>} />
    <div className="notice"><ShieldCheck size={20} aria-hidden="true" /><p>Ringkasan platform hanya menampilkan profil perusahaan dan jumlah kendaraan serta booking. Identitas pelanggan dan rincian transaksi tidak ditampilkan.</p></div>
    <section className="panel" aria-label="Filter perusahaan"><div className="toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Cari nama atau kode perusahaan…" /><label className="field"><span>Status perusahaan</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label></div></section>
    <div className="section-title"><p className="muted" role="status">{tenants.length} dari {state.tenants.length} perusahaan</p>{(needle !== '' || status !== 'all') && <button type="button" className="button secondary small" onClick={resetFilters}>Reset filter</button>}</div>
    {tenants.length === 0 ? <section className="panel"><Empty title={state.tenants.length === 0 ? 'Belum ada perusahaan' : 'Perusahaan tidak ditemukan'} description={state.tenants.length === 0 ? 'Tambahkan perusahaan demo untuk membuat ruang kerja kosong dengan pengaturan default.' : 'Coba kata kunci lain atau reset filter.'} action={<button type="button" className="button secondary" onClick={state.tenants.length === 0 ? add : resetFilters}>{state.tenants.length === 0 ? 'Tambah perusahaan' : 'Reset filter'}</button>} /></section> : <div className="info-grid">
      {tenants.map(tenant => <article className="panel profile-card" key={tenant.id}>
        <div className="section-title"><span className="avatar" aria-hidden="true"><Building2 size={23} /></span><Badge status={tenant.status === 'active' ? 'available' : 'inactive'}>{tenant.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge></div>
        <div className="eyebrow">{tenant.code}</div><h2>{tenant.name}</h2><p className="muted">{tenant.contact || 'Kontak belum diisi'}</p>
        <dl className="detail-grid"><div className="detail-item"><dt><CarFront size={16} aria-hidden="true" /> Kendaraan</dt><dd>{counts.get(tenant.id)?.vehicles ?? 0}</dd></div><div className="detail-item"><dt><History size={16} aria-hidden="true" /> Booking</dt><dd>{counts.get(tenant.id)?.bookings ?? 0}</dd></div></dl>
        <div className="inline-actions"><button type="button" className="button secondary small" onClick={() => setEditor({ tenant, isNew: false })} aria-label={`Edit perusahaan ${tenant.name}`}><Pencil size={15} aria-hidden="true" />Edit profil</button><button type="button" className={`button ${tenant.status === 'active' ? 'danger' : 'secondary'} small`} onClick={() => toggle(tenant)} aria-label={`${tenant.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'} perusahaan ${tenant.name}`}><Power size={15} aria-hidden="true" />{tenant.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</button></div>
      </article>)}
    </div>}
    {editor && <TenantEditor key={editor.tenant.id} tenant={editor.tenant} isNew={editor.isNew} onClose={close} onSaved={() => setEditor(null)} />}
  </>;
}

function TenantEditor({ tenant, isNew, onClose, onSaved }: { tenant: Tenant; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const { state, run, notify } = useApp();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const current = state.tenants.find(item => item.id === tenant.id);
    if (!isNew && !current) { notify('Perusahaan tidak ditemukan.', true); return; }
    const value: Tenant = { ...(current ?? tenant), name: text(data, 'name'), code: text(data, 'code'), contact: text(data, 'contact') };
    if (run({ type: 'tenant', value }, isNew ? 'Perusahaan demo berhasil dibuat dengan ruang kerja kosong.' : 'Profil perusahaan berhasil diperbarui.')) { markSaved(form); onSaved(); }
  }
  return <Modal open onClose={onClose} title={isNew ? 'Tambah perusahaan' : 'Edit profil perusahaan'} description="Gunakan nama dan kontak fiktif. Kode perusahaan harus unik di seluruh platform.">
    <form onSubmit={submit} data-dirty="false"><div className="form-grid">
      <Field label="Nama perusahaan" wide><input name="name" required defaultValue={tenant.name} placeholder="Nusa Rental Demo" /></Field>
      <Field label="Kode perusahaan" hint="Kode unik untuk mengenali ruang kerja."><input name="code" required defaultValue={tenant.code} placeholder="NUSA" autoCapitalize="characters" /></Field>
      <Field label="Kontak fiktif (opsional)"><input name="contact" defaultValue={tenant.contact} placeholder="Kontak simulasi perusahaan" /></Field>
    </div>{isNew && <div className="notice"><Building2 size={20} aria-hidden="true" /><p>Perusahaan dibuat aktif dengan pengaturan default dan tanpa data operasional. Pemilik dan staf simulasi dapat dipilih melalui kontrol demo.</p></div>}<FormFooter onClose={onClose} label={isNew ? 'Tambah perusahaan' : 'Simpan profil'} /></form>
  </Modal>;
}
