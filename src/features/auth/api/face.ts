import axios from 'axios';
import { api, API_URL } from '@/lib/api';

/* Yuz bilan kirish API qatlami. Rasm serverga yuboriladi, u yerda embedding
   hisoblanib xodimlar profillari bilan solishtiriladi — brauzerga model
   yuklab olinmaydi (tez va yengil). */

export const getFaceAvailability = async (): Promise<boolean> => {
  try {
    const { data } = await api.get<{ available: boolean }>('/auth/face/availability');
    return !!data?.available;
  } catch {
    return false;
  }
};

/** Qurilmada kamera bormi — tugmani ko'rsatish/yashirish uchun */
export const hasCamera = async (): Promise<boolean> => {
  try {
    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
      return false;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((d) => d.kind === 'videoinput');
  } catch {
    return false;
  }
};

export const faceLogin = async (photo: Blob) => {
  const form = new FormData();
  form.append('file', photo, 'face.jpg');
  // DIQQAT: global `api` emas, toza axios ishlatiladi. Yuz tanilmaganda
  // backend 401 qaytaradi — global interceptor esa har 401 da sahifani
  // /login'ga qayta yuklab, "begona shaxs" xabarini ko'rsatishga ulgurmasdi
  const { data } = await axios.post(`${API_URL}/auth/face/login`, form);
  return data as {
    access_token: string;
    refresh_token: string;
    user: any;
  };
};

export const getFaceStatus = async () => {
  const { data } = await api.get<{
    engine_available: boolean;
    enrolled: boolean;
    count: number;
  }>('/auth/face/status');
  return data;
};

export const enrollFace = async (photo: Blob) => {
  const form = new FormData();
  form.append('file', photo, 'face.jpg');
  const { data } = await api.post('/auth/face/enroll', form, {
    headers: { 'Content-Type': undefined as any },
  });
  return data;
};

export const deleteFaceProfiles = async () => {
  const { data } = await api.delete('/auth/face/enroll');
  return data;
};

/** Backend xatosidan foydalanuvchiga ko'rsatiladigan matn */
export const faceErrorMessage = (e: any): string => {
  const d = e?.response?.data;
  if (typeof d?.detail === 'string') return d.detail;
  if (typeof d?.message === 'string') return d.message;
  return "Xatolik yuz berdi. Qayta urinib ko'ring.";
};
