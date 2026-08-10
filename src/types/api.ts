export interface Guest {
  id: string;
  hotel_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  // Backend maydon nomlari (app/application/dto/guest.py)
  passport_number?: string;
  id_document_type?: string;
  id_document_number?: string;
  birth_date?: string;
  notes?: string;
  nationality?: string;
  address?: string;
  city?: string;
  country?: string;
  preferences?: string;
  is_blacklisted: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomType {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  base_price: number;
  amenities: any[];
  is_active: boolean;
  created_at: string;
}

export interface Floor {
  id: string;
  hotel_id: string;
  branch_id: string;
  floor_number: number;
  name?: string;
  created_at: string;
}

export interface Room {
  id: string;
  hotel_id: string;
  branch_id: string;
  floor_id: string;
  room_type_id: string;
  room_number: string;
  base_price: number;
  capacity?: number;
  current_status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'INSPECTION' | 'OUT_OF_SERVICE';
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomDetail extends Room {
  room_type?: RoomType;
  floor?: Floor;
}

export interface Reservation {
  id: string;
  hotel_id: string;
  branch_id: string;
  reservation_number: string;
  guest_id: string;
  room_id: string;
  booking_type: string;
  check_in_date: string;
  check_out_date: string;
  check_in_datetime?: string;
  check_out_datetime?: string;
  adults: number;
  children: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
  total_amount: number;
  paid_amount: number;
  payment_status: string;
  discount_amount: number;
  discount_percent: number;
  notes?: string;
  cancelled_reason?: string;
  cancelled_at?: string;
  /** Resepsiya "mehmon chiqmoqda" deb belgilagan vaqt (chiqish jarayonida) */
  checkout_requested_at?: string | null;
  /** Xona ko'chirishlar auditi — kim, qachon, qaysi xonadan qaysinisiga */
  room_moves?: RoomMove[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoomMove {
  from_room_id: string;
  from_room_number?: string | null;
  to_room_id: string;
  to_room_number?: string | null;
  old_total: number;
  new_total: number;
  moved_by: string;
  moved_by_name?: string | null;
  moved_at: string;
}

export interface ReservationDetail extends Reservation {
  guest?: Guest;
  room?: Room;
  services: any[];
  invoice?: any;
}

// --- Boshqaruv bo'limlari (admin/menejer) uchun tiplar ---

export interface Amenity {
  id: string;
  name: string;
  icon?: string | null;
  is_active: boolean;
  created_at: string;
}

// Global xizmatlar katalogi (GET /services/)
export interface ServiceCatalogItem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  category: string;
  is_active: boolean;
  created_at?: string | null;
}

// Mehmonxona xizmatlari — narx bilan (GET /hotel-services/ yassi javob qaytaradi)
export interface HotelServiceItem {
  id: string;
  service_id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  is_active: boolean;
}

export type HousekeepingTaskType =
  | 'CLEANING'
  | 'DEEP_CLEANING'
  | 'MAINTENANCE'
  | 'INSPECTION'
  | 'TURN_DOWN';
export type HousekeepingTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type HousekeepingTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface HousekeepingTask {
  id: string;
  hotel_id: string;
  branch_id: string;
  room_id: string;
  task_type: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  priority: HousekeepingTaskPriority;
  assigned_to?: string | null;
  notes?: string | null;
  scheduled_date?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  /** Scheduler tomonidan avtomatik yakunlangan (qo'lda emas) */
  auto_completed?: boolean;
  created_by: string;
  created_at: string;
  photo_count: number;
  room?: { id: string; room_number: string } | null;
  assigned_user?: { id: string; first_name: string; last_name: string } | null;
  branch?: { id: string; name: string } | null;
}

// Xo'jalik vazifasi fotohisoboti (GET /tasks/{id}/photos)
export interface TaskPhoto {
  id: string;
  file_name: string;
  mime_type?: string;
  file_size?: number;
  uploaded_by?: string | null;
  created_at?: string | null;
  download_url?: string;
}

// Xodim (GET /employees/ — backend UserResponse)
export interface Employee {
  id: string;
  user_type: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';
  hotel_id?: string | null;
  branch_id?: string | null;
  username: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
  hire_date?: string | null;
  // Ish jadvali: kunlik soat va ish vaqti oralig'i ("HH:MM")
  work_hours_per_day?: number;
  work_start?: string;
  work_end?: string;
  termination_date?: string | null;
  is_deleted: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string | null;
}

// Xarajat (chiqim) yozuvi (GET /expenses/) — kim kiritgani bilan birga
export interface Expense {
  id: string;
  hotel_id: string;
  branch_id?: string | null;
  title: string;
  category?: string | null;
  amount: number;
  payment_method: string;
  expense_date: string;
  notes?: string | null;
  created_by: string;
  created_by_name?: string | null;
  created_at?: string | null;
}

// To'lov yozuvi (GET /finance/payments)
export interface PaymentRecord {
  id: string;
  hotel_id: string;
  invoice_id: string;
  payment_number: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  hotel_id: string;
  reservation_id: string;
  guest_id: string;
  invoice_number: string;
  invoice_date?: string;
  due_date?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID' | 'REFUNDED';
  notes?: string;
  created_at: string;
  updated_at: string;
}
