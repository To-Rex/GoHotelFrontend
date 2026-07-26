// Backend xatosidan o'qiladigan matn tuzish (FastAPI 422 -> detail massiv
// bo'lishi mumkin). Boshqaruv sahifalarida umumiy ishlatiladi.
export function apiErrorMessage(error: any): string {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join("\n");
  }
  return "Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.";
}
