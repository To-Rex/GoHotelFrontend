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
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReservationDetail extends Reservation {
  guest?: Guest;
  room?: Room;
  services: any[];
  invoice?: any;
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
