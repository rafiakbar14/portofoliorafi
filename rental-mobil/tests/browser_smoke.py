import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5173'
KEY = 'rental-mobil-demo:v1'
OUT = Path(__file__).resolve().parents[1] / 'test-results'
RESULTS = []
ERRORS = []


def passed(name):
    RESULTS.append(name)
    print(f'PASS {name}', flush=True)


def state(page):
    return page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}"))')


def go(page, path):
    page.goto(BASE + path)
    page.wait_for_load_state('networkidle')


def fresh(browser, width=1440, height=900):
    context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: ERRORS.append(str(error)))
    page.on('console', lambda message: ERRORS.append(message.text) if message.type == 'error' else None)
    page.on('dialog', lambda dialog: dialog.accept())
    go(page, '/')
    page.get_by_role('button', name='Atur demo').click()
    page.get_by_role('button', name='Buka ruang kerja', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    return page


def switch(page, tenant='t1', role='owner'):
    page.get_by_role('button', name='Atur demo').click()
    page.get_by_label('Perusahaan demo', exact=True).select_option(tenant)
    page.get_by_label('Peran simulasi', exact=True).select_option(role)
    page.get_by_role('button', name='Buka ruang kerja', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)


def clock(page, value):
    page.get_by_role('button', name='Atur demo').click()
    page.get_by_label('Maju ke tanggal / jam (WIB)', exact=True).fill(value)
    page.get_by_role('button', name='Terapkan', exact=True).click()
    page.get_by_role('button', name='Tutup dialog', exact=True).click()


def create_booking(page, start='2026-11-13T09:00', end='2026-11-14T10:00', basis='daily', service='self', customer='t1-c1', vehicle='t1-v1', driver='t1-d3', months='2', confirm=True):
    go(page, '/penyewaan/baru')
    page.get_by_label('Pelanggan', exact=True).select_option(customer)
    page.get_by_label('Jenis layanan', exact=True).select_option(service)
    page.get_by_label('Basis tarif', exact=True).select_option(basis)
    page.get_by_label('Mulai sewa', exact=True).fill(start)
    if basis == 'daily':
        page.get_by_label('Selesai sewa', exact=True).fill(end)
    else:
        page.get_by_label('Durasi kontrak', exact=True).select_option(months)
    page.get_by_role('button', name='Lanjutkan', exact=True).click()
    page.locator('label.vehicle-option').filter(has=page.locator(f'input[value="{vehicle}"]')).click()
    if service == 'driver':
        page.get_by_label('Sopir', exact=True).select_option(driver)
    page.get_by_role('button', name='Lanjutkan', exact=True).click()
    page.get_by_role('button', name='Konfirmasi booking' if confirm else 'Simpan draft', exact=True).click()
    expect(page).to_have_url(re.compile(r'/penyewaan/[^/]+$'))
    assert not page.url.endswith('/baru'), page.locator('body').inner_text()[-700:]
    return page.url.split('/')[-1]


def pay(page, amount=None):
    page.get_by_role('button', name=re.compile(r'^Tagihan \(')).click()
    page.get_by_role('button', name='Catat pembayaran', exact=True).first.click()
    if amount is not None:
        page.get_by_label('Nominal (Rp)', exact=True).fill(str(amount))
    page.get_by_role('button', name='Catat pembayaran sewa', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)


def deposit(page):
    page.get_by_role('button', name='Terima deposit', exact=True).click()
    page.get_by_role('dialog').get_by_role('button', name='Terima deposit', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)


def checkout(page, odometer=1000):
    page.get_by_role('button', name='Serah-terima', exact=True).first.click()
    page.get_by_label('Odometer (km)', exact=True).fill(str(odometer))
    page.get_by_label('Kunci, dokumen kendaraan, dan kelengkapan sudah diperiksa.').check()
    ack = page.get_by_label(re.compile('Saya memahami masih ada piutang'))
    if ack.count():
        ack.check()
    page.get_by_role('button', name='Konfirmasi serah-terima', exact=True).click()


def checkin(page, odometer=1200, extra=0):
    page.get_by_role('button', name='Kembalikan mobil', exact=True).click()
    page.get_by_label('Odometer (km)', exact=True).fill(str(odometer))
    page.get_by_label('Kunci, dokumen kendaraan, dan kelengkapan sudah diperiksa.').check()
    if extra:
        page.get_by_label('Biaya kerusakan / BBM (Rp)', exact=True).fill(str(extra))
        page.get_by_label('Alasan biaya tambahan', exact=True).fill('Penggantian BBM simulasi')
    page.get_by_role('button', name='Selesaikan pengembalian', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = fresh(browser)
    expect(page.get_by_role('heading', name='Ringkasan operasional', exact=True)).to_be_visible()
    page.screenshot(path=str(OUT / 'dashboard-desktop.png'), full_page=True, animations='disabled')
    passed('Dashboard initial render and local persistence')

    bid = create_booking(page)
    b = next(b for b in state(page)['bookings'] if b['id'] == bid)
    assert b['pricing']['total'] == 700000 and b['status'] == 'confirmed'
    deposit(page)
    pay(page, 400000)
    checkout(page)
    expect(page.get_by_role('dialog')).to_have_count(0)
    assert next(b for b in state(page)['bookings'] if b['id'] == bid)['status'] == 'active'
    clock(page, '2026-11-14T11:01')
    checkin(page, extra=75000)
    current = state(page)
    assert next(b for b in current['bookings'] if b['id'] == bid)['status'] == 'completed'
    assert next(i for i in current['invoices'] if i['bookingId'] == bid and i['kind'] == 'final')['total'] == 175000
    pay(page)
    pay(page)
    page.get_by_role('button', name='Kembalikan deposit', exact=True).click()
    page.get_by_role('dialog').get_by_role('button', name='Kembalikan deposit', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    current = state(page)
    ledger = [c for c in current['cash'] if c['bookingId'] == bid]
    assert sum(c['amount'] for c in ledger if c['kind'] == 'rental_payment') == 875000
    assert sum(c['amount'] * (1 if c['kind'] == 'deposit_received' else -1 if c['kind'] == 'deposit_refund' else 0) for c in ledger) == 0
    page.reload(); page.wait_for_load_state('networkidle')
    assert state(page)['now'] == current['now']
    page.screenshot(path=str(OUT / 'booking-completed.png'), full_page=True, animations='disabled')
    passed('Golden path: 25h booking, partial payment, deposit, checkout, late return, settlement and refund')

    page2 = fresh(browser)
    cancelled = create_booking(page2, end='2026-11-14T09:00')
    pay(page2, 100000)
    deposit(page2)
    page2.get_by_role('button', name='Batalkan penyewaan', exact=True).click()
    page2.get_by_label('Alasan pembatalan', exact=True).fill('Perjalanan dijadwalkan ulang')
    page2.get_by_role('button', name='Ya, batalkan penyewaan', exact=True).click()
    expect(page2.get_by_role('dialog')).to_have_count(0)
    assert all(i['void'] for i in state(page2)['invoices'] if i['bookingId'] == cancelled)
    page2.get_by_role('button', name=re.compile(r'^Refund Rp')).click()
    page2.get_by_role('button', name='Kembalikan uang sewa', exact=True).click()
    page2.get_by_role('button', name='Kembalikan deposit', exact=True).click()
    page2.get_by_role('dialog').get_by_role('button', name='Kembalikan deposit', exact=True).click()
    assert not page2.get_by_role('button', name=re.compile(r'^Refund Rp')).count()
    passed('Cancellation voids invoice and records separate rental/deposit refunds')

    page3 = fresh(browser)
    monthly = create_booking(page3, start='2027-01-31T09:00', basis='monthly', service='driver', driver='t1-d1')
    b = next(b for b in state(page3)['bookings'] if b['id'] == monthly)
    assert b['end'] == '2027-03-31T02:00:00.000Z'
    assert b['pricing']['total'] == 18000000
    bills = [i for i in state(page3)['invoices'] if i['bookingId'] == monthly]
    assert len(bills) == 2 and bills[1]['due'] == '2027-02-28T02:00:00.000Z'
    page3.get_by_role('button', name=re.compile(r'^Tagihan \(')).click()
    page3.screenshot(path=str(OUT / 'monthly-contract.png'), full_page=True, animations='disabled')
    passed('Monthly chauffeur contract: calendar boundaries, two invoices and correct total')

    short = fresh(browser)
    go(short, '/penyewaan/t1-b7')
    checkout(short)
    expect(short.get_by_role('dialog')).to_have_count(1)
    expect(short.locator('[role="alert"]').last).to_be_visible()
    short.get_by_role('button', name='Tutup dialog', exact=True).click()
    clock(short, '2026-11-13T09:15')
    checkout(short)
    expect(short.get_by_role('dialog')).to_have_count(0)
    clock(short, '2026-11-13T09:45')
    checkin(short)
    assert next(b for b in state(short)['bookings'] if b['id'] == 't1-b7')['status'] == 'completed'
    passed('Short booking: premature checkout blocked, exact 09:15/09:45 clock works')

    isolated = fresh(browser)
    switch(isolated, 't2')
    assert 'Langit Rental' in isolated.locator('main').inner_text()
    assert 'Aruna Prameswari' not in isolated.locator('main').inner_text()
    go(isolated, '/penyewaan/t1-b1')
    expect(isolated.get_by_role('heading', name='Penyewaan tidak ditemukan')).to_be_visible()
    switch(isolated, 't1', 'staff')
    go(isolated, '/pengaturan')
    expect(isolated.get_by_role('heading', name='Halaman khusus pemilik')).to_be_visible()
    go(isolated, '/armada')
    isolated.get_by_role('button', name='Tambah mobil', exact=True).click()
    assert isolated.get_by_label('Tarif harian (Rp)', exact=True).count() == 0
    isolated.get_by_role('button', name='Tutup dialog', exact=True).click()
    passed('Tenant switching, cross-tenant detail denial, staff settings/rate restriction')

    master = fresh(browser)
    go(master, '/pelanggan')
    master.get_by_role('button', name='Tambah pelanggan', exact=True).first.click()
    master.get_by_label('Nama pelanggan', exact=True).fill('Pelanggan Uji Demo')
    master.get_by_role('dialog').get_by_role('button', name='Tambah pelanggan', exact=True).click()
    expect(master.get_by_role('dialog')).to_have_count(0)
    cid = next(c['id'] for c in state(master)['customers'] if c['name'] == 'Pelanggan Uji Demo')
    verification = create_booking(master, end='2026-11-14T09:00', customer=cid)
    deposit(master)
    checkout(master)
    expect(master.get_by_role('dialog')).to_have_count(1)
    expect(master.locator('[role="alert"]').last).to_contain_text(re.compile(r'verifikasi', re.I))
    master.get_by_role('button', name='Tutup dialog', exact=True).click()
    go(master, '/pelanggan')
    master.get_by_role('button', name='Edit Pelanggan Uji Demo', exact=True).click()
    master.get_by_label('Pemeriksaan identitas telah diverifikasi (simulasi)', exact=True).check()
    master.get_by_role('button', name='Simpan perubahan', exact=True).click()
    go(master, '/penyewaan/' + verification)
    checkout(master)
    expect(master.get_by_role('dialog')).to_have_count(0)
    passed('Customer create/edit and verification prerequisite enforced during checkout')

    platform = fresh(browser)
    switch(platform, role='platform')
    assert 'Aruna Prameswari' not in platform.locator('main').inner_text()
    platform.get_by_role('button', name='Tambah perusahaan', exact=True).first.click()
    platform.get_by_label('Nama perusahaan', exact=True).fill('Demo Baru Rental')
    platform.get_by_label('Kode perusahaan', exact=True).fill('BARU')
    platform.get_by_role('dialog').get_by_role('button', name='Tambah perusahaan', exact=True).click()
    expect(platform.get_by_role('dialog')).to_have_count(0)
    new_id = next(t['id'] for t in state(platform)['tenants'] if t['code'] == 'BARU')
    assert next(s for s in state(platform)['settings'] if s['tenantId'] == new_id)['lateFee'] == 0
    platform.get_by_role('button', name='Nonaktifkan perusahaan Demo Baru Rental', exact=True).click()
    platform.get_by_role('button', name='Atur demo').click()
    platform.get_by_label('Perusahaan demo', exact=True).select_option(new_id)
    platform.get_by_label('Peran simulasi', exact=True).select_option('owner')
    platform.get_by_role('button', name='Buka ruang kerja', exact=True).click()
    expect(platform.get_by_role('alert')).to_contain_text('Perusahaan sedang nonaktif')
    platform.get_by_role('button', name='Tutup dialog', exact=True).click()
    platform.get_by_role('button', name='Aktifkan perusahaan Demo Baru Rental', exact=True).click()
    switch(platform, new_id, 'owner')
    assert len([v for v in state(platform)['vehicles'] if v['tenantId'] == new_id]) == 0
    expect(platform.get_by_role('heading', name='Ringkasan operasional')).to_be_visible()
    passed('Platform creates empty tenant, zero default late fee, deactivate/reactivate without data loss')

    responsive = fresh(browser)
    routes = ['/', '/jadwal', '/penyewaan', '/armada', '/pelanggan', '/sopir', '/keuangan', '/laporan', '/pengaturan', '/penyewaan/t1-b7']
    for width, height in [(390, 844), (768, 1024), (1440, 900)]:
        responsive.set_viewport_size({'width': width, 'height': height})
        for route in routes:
            go(responsive, route)
            metrics = responsive.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
            assert metrics['scroll'] <= metrics['width'] + 1, (width, route, metrics)
            expect(responsive.get_by_role('heading', level=1)).to_be_visible()
        if width == 390:
            go(responsive, '/')
            responsive.screenshot(path=str(OUT / 'dashboard-mobile.png'), full_page=True, animations='disabled')
            responsive.get_by_role('button', name='Buka navigasi', exact=True).click()
            responsive.get_by_role('navigation', name='Navigasi utama').get_by_role('link', name='Armada', exact=True).click()
            expect(responsive).to_have_url(BASE + '/armada')
        else:
            go(responsive, '/jadwal')
            responsive.screenshot(path=str(OUT / f'schedule-{width}.png'), full_page=True, animations='disabled')
    passed('Ten screens at 390/768/1440, no page overflow, mobile drawer navigation')

    report = fresh(browser)
    go(report, '/laporan')
    report.get_by_label('Tanggal awal laporan', exact=True).fill('2028-01-01')
    report.get_by_label('Tanggal akhir laporan', exact=True).fill('2028-01-31')
    expect(report.get_by_role('heading', name='Belum ada arus kas')).to_be_visible()
    assert 'Saldo saat ini' in report.locator('main').inner_text()
    report.get_by_label('Tanggal akhir laporan', exact=True).fill('2027-12-31')
    expect(report.get_by_role('alert')).to_contain_text('Tanggal akhir')
    passed('Report date filtering, empty period and invalid range validation')

    storage = fresh(browser)
    storage.evaluate('localStorage.setItem("unrelated-app", "keep")')
    storage.get_by_role('button', name='Atur demo').click()
    storage.get_by_role('button', name='+ 1 hari', exact=True).click()
    storage.get_by_role('button', name='Reset seluruh data demo', exact=True).click()
    assert state(storage)['now'] == '2026-11-13T02:00:00.000Z'
    assert storage.evaluate('localStorage.getItem("unrelated-app")') == 'keep'
    storage.get_by_role('button', name='Tutup dialog', exact=True).click()
    storage.evaluate(f'localStorage.setItem("{KEY}", "broken-json")')
    storage.reload(); storage.wait_for_load_state('networkidle')
    expect(storage.get_by_role('heading', name='Data demo perlu dipulihkan')).to_be_visible()
    assert storage.evaluate(f'localStorage.getItem("{KEY}")') == 'broken-json'
    storage.get_by_role('button', name='Reset data demo', exact=True).click()
    expect(storage.get_by_role('heading', name='Ringkasan operasional')).to_be_visible()
    passed('Reset limited to demo namespace; corrupt storage preserved until explicit recovery')

    keyboard = fresh(browser)
    keyboard.get_by_role('button', name='Atur demo').click()
    expect(keyboard.get_by_role('dialog')).to_be_visible()
    keyboard.keyboard.press('Tab')
    assert keyboard.evaluate('!!document.activeElement.closest("[role=dialog]")')
    keyboard.keyboard.press('Escape')
    expect(keyboard.get_by_role('dialog')).to_have_count(0)
    expect(keyboard.get_by_role('button', name='Atur demo')).to_be_focused()
    passed('Dialog keyboard focus containment, Escape and focus restoration')

    assert not ERRORS, ERRORS
    passed('No browser console errors or unhandled exceptions across all flows')
    (OUT / 'browser-results.json').write_text(json.dumps({'passed': RESULTS, 'errors': ERRORS}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Completed {len(RESULTS)} browser scenario groups.', flush=True)
    browser.close()
