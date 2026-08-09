import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Employee, Permission } from '@/types/api';

export const EMPLOYEE_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const EMPLOYEE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

/** Xodim suratini /files/upload ga yuklaydi (entity_type="user"). */
export const uploadEmployeePhoto = async (
  userId: string,
  file: File,
  hotelId?: string
) => {
  const form = new FormData();
  const ext = (file.name.split('.').pop() || 'jpg')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  form.append('file', file, `photo_${Date.now()}.${ext}`);
  form.append('entity_type', 'user');
  form.append('entity_id', userId);
  form.append('category', 'photo');
  const { data } = await api.post('/files/upload', form, {
    params: hotelId ? { hotel_id: hotelId } : {},
    // Content-Type ni brauzer o'zi (boundary bilan) qo'yadi
    headers: { 'Content-Type': undefined as any },
  });
  return data;
};

/** Xodim suratlari: user id -> eng so'nggi surat URL xaritasi (bitta so'rov). */
export const useEmployeePhotos = () => {
  return useQuery({
    queryKey: ['employeePhotos'],
    queryFn: async () => {
      const { data } = await api.get<any[]>('/files/by-entity', {
        params: { entity_type: 'user', category: 'photo' },
      });
      const map: Record<string, string> = {};
      // Ro'yxat yangi->eski tartibda: har xodim uchun birinchisi eng so'nggisi
      for (const f of data || []) {
        if (!map[f.entity_id] && f.download_url) map[f.entity_id] = f.download_url;
      }
      return map;
    },
  });
};

export const useEmployees = () => {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data } = await api.get<{ items: Employee[] }>('/employees/', {
        params: { limit: 500 },
      });
      const list = Array.isArray(data) ? data : (data.items || []);
      // Soft-delete qilinganlar ro'yxatda ko'rsatilmaydi
      return list.filter((e) => !e.is_deleted);
    },
  });
};

interface EmployeeCreatePayload {
  hotel_id: string;
  branch_id: string;
  first_name: string;
  last_name: string;
  username: string;
  password: string;
  email?: string;
  phone?: string;
  hire_date?: string;
  work_hours_per_day?: number;
  work_start?: string;
  work_end?: string;
}

export const useCreateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: EmployeeCreatePayload) => {
      const { data } = await api.post<Employee>('/employees/', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
};

interface EmployeeUpdatePayload {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  branch_id?: string;
  status?: string;
  work_hours_per_day?: number;
  work_start?: string;
  work_end?: string;
}

export const useUpdateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: EmployeeUpdatePayload) => {
      const { data } = await api.put<Employee>(`/employees/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
};

export const useDeleteEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/employees/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
};

// --- Ruxsatnomalar ---

export const usePermissionsList = () => {
  return useQuery({
    queryKey: ['permissionsList'],
    queryFn: async () => {
      const { data } = await api.get<Permission[]>('/permissions/');
      return Array.isArray(data) ? data : [];
    },
  });
};

// Xodimga biriktirilgan ruxsatlar
export const useUserPermissions = (userId?: string) => {
  return useQuery({
    queryKey: ['userPermissions', userId],
    queryFn: async () => {
      const { data } = await api.get<{ user_id: string; permissions: Permission[] }>(
        `/permissions/${userId}/permissions`
      );
      return Array.isArray(data) ? data : (data.permissions || []);
    },
    enabled: !!userId,
  });
};

// Ruxsatlarni to'liq almashtirish. Backend bo'sh ro'yxatni qabul qilmaydi —
// hammasi olib tashlansa, har bir mavjud ruxsat alohida bekor qilinadi.
export const useSetUserPermissions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      permissionIds,
      currentIds,
    }: {
      userId: string;
      permissionIds: string[];
      currentIds: string[];
    }) => {
      if (permissionIds.length > 0) {
        await api.put(`/permissions/${userId}/permissions`, {
          permission_ids: permissionIds,
        });
      } else {
        for (const pid of currentIds) {
          await api.delete(`/permissions/${userId}/permissions/${pid}`);
        }
      }
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['userPermissions', vars.userId] }),
  });
};
