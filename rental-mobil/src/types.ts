export type Role = 'owner' | 'staff' | 'platform';
export type BookingStatus = 'draft' | 'confirmed' | 'active' | 'completed' | 'cancelled';
export interface Tenant { id: string; name: string; code: string; status: 'active' | 'inactive'; contact: string }
export interface Settings { tenantId: string; bufferMinutes: number; deposit: number; lateFee: number }
export interface Entity { id: string; tenantId: string; archived: boolean }
export interface Vehicle extends Entity { plate: string; make: string; model: string; category: string; transmission: 'Automatic' | 'Manual'; seats: number; color: string; dailyRate: number | null; monthlyRate: number | null; status: 'ready' | 'maintenance' | 'inactive' }
export interface Customer extends Entity { name: string; phone: string; verified: boolean; note: string }
export interface Driver extends Entity { name: string; phone: string; dailyRate: number | null; monthlyRate: number | null; status: 'active' | 'inactive' }
export interface Pricing { vehicleRate: number; driverRate: number; quantity: number; total: number; deposit: number; bufferMinutes: number; lateFee: number }
export interface Booking { id: string; tenantId: string; number: string; customerId: string; vehicleId: string; driverId: string | null; service: 'self' | 'driver'; basis: 'daily' | 'monthly'; start: string; end: string; months: number; status: BookingStatus; pricing: Pricing | null; note: string; createdAt: string; cancellationReason?: string }
export interface InvoiceLine { label: string; quantity: number; rate: number; amount: number }
export interface Invoice { id: string; tenantId: string; number: string; bookingId: string; kind: 'rental' | 'final'; start: string; end: string; due: string; lines: InvoiceLine[]; total: number; void: boolean }
export type CashKind = 'rental_payment' | 'rental_refund' | 'deposit_received' | 'deposit_refund';
export interface CashEntry { id: string; tenantId: string; bookingId: string; invoiceId: string | null; kind: CashKind; amount: number; method: 'transfer' | 'cash'; reference: string; at: string; actor: string }
export interface Handover { id: string; tenantId: string; bookingId: string; direction: 'out' | 'in'; at: string; odometer: number; fuel: number; body: string; interior: string; equipment: boolean; notes: string }
export interface Activity { id: string; tenantId: string; bookingId?: string; action: string; summary: string; at: string; actor: string }
export interface State { version: 1; now: string; tenantId: string; role: Role; tenants: Tenant[]; settings: Settings[]; vehicles: Vehicle[]; customers: Customer[]; drivers: Driver[]; bookings: Booking[]; invoices: Invoice[]; cash: CashEntry[]; handovers: Handover[]; activities: Activity[] }
export type DraftInput = Pick<Booking, 'customerId' | 'vehicleId' | 'driverId' | 'service' | 'basis' | 'start' | 'end' | 'months' | 'note'> & { id?: string };
export type HandoverInput = Pick<Handover, 'odometer' | 'fuel' | 'body' | 'interior' | 'equipment' | 'notes'>;
export type Action =
  | { type: 'context'; tenantId: string; role: Role }
  | { type: 'clock'; at: string }
  | { type: 'tenant'; value: Tenant }
  | { type: 'settings'; value: Settings }
  | { type: 'vehicle'; value: Vehicle }
  | { type: 'customer'; value: Customer }
  | { type: 'driver'; value: Driver }
  | { type: 'draft'; value: DraftInput }
  | { type: 'confirm'; id: string }
  | { type: 'cancel'; id: string; reason: string }
  | { type: 'cash'; bookingId: string; invoiceId: string | null; kind: CashKind; amount: number; method: 'transfer' | 'cash'; reference: string }
  | { type: 'out'; id: string; value: HandoverInput; acknowledgeDebt: boolean }
  | { type: 'in'; id: string; value: HandoverInput; extra: number; reason: string };
