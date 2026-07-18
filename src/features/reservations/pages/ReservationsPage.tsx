import { useReservations } from "../api/reservations";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const ReservationsPage = () => {
  const { data: reservations, isLoading, isError } = useReservations();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Bandlovlar</h1>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return <div>Xatolik yuz berdi. Iltimos qayta urining.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Bandlovlar</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID / Raqam</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Holati</TableHead>
              <TableHead className="text-right">Summa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Ma'lumot topilmadi</TableCell>
              </TableRow>
            ) : (
              reservations?.map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="font-medium">{res.reservation_number || res.id.slice(0,8)}</TableCell>
                  <TableCell>{res.check_in_date}</TableCell>
                  <TableCell>{res.check_out_date}</TableCell>
                  <TableCell>
                    <Badge variant={res.status === 'CONFIRMED' || res.status === 'CHECKED_IN' ? 'default' : 'secondary'}>
                      {res.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">${res.total_amount?.toFixed(2) || '0.00'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
