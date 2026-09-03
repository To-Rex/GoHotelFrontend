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
  /* QORA RO'YXAT.

     Ilgari bu yerda ishlatilmaydigan `is_blacklisted: boolean` turgan edi —
     backendda bunday maydon yo'q edi va hech qayerda o'qilmasdi. Endi
     haqiqiy maydonlar: sana qo'yilgan bo'lsa mehmon ro'yxatda, sabab esa
     "nega?" degan savolga javob beradi. */
  blacklisted_at?: string | null;
  blacklist_reason?: string | null;
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
  /** Joriy holatga qachon o'tgani. `updated_at` bu ish uchun yaramaydi —
   *  u narx yoki izoh tahrirlansa ham yangilanadi. */
  status_changed_at?: string | null;
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

/** Vazifadagi bitta ish bandi — farrosh mobil ilovada belgilaydi */
export interface TaskChecklistItem {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
}

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
  /** Farrosh belgilaydigan ish bandlari — veb ekranida faqat ko'rsatiladi */
  checklist?: TaskChecklistItem[];
  checklist_done?: number;
  checklist_total?: number;
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

/** To'lov usuli bo'yicha bir qator (GET /finance/summary) */
export interface FinanceMethodRow {
  key: string;
  pay: number;
  shop: number;
  expense: number;
}

/** Xarajat toifasi bo'yicha bir qator (GET /finance/summary) */
export interface FinanceCategoryRow {
  name: string;
  total: number;
  count: number;
}

/**
 * Moliya sahifasining yig'ma ko'rsatkichlari (GET /finance/summary).
 *
 * Jadvallar sahifalab olinadi — davrning to'liq ro'yxati brauzerga
 * kelmaydi, shuning uchun yig'indi serverda hisoblanadi.
 */
export interface FinanceSummary {
  income: number;
  payment_count: number;
  refunds: number;
  invoice_total: number;
  invoice_discount: number;
  invoice_paid: number;
  invoice_count: number;
  debt: number;
  expense_total: number;
  expense_count: number;
  expense_categories: FinanceCategoryRow[];
  shop_revenue: number;
  shop_paid_count: number;
  shop_debt: number;
  shop_debt_count: number;
  methods: FinanceMethodRow[];
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
