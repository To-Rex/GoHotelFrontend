import { useGuests } from "../api/guests";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export const GuestsPage = () => {
  const { data: guests, isLoading, isError } = useGuests();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Mehmonlar</h1>
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
        <h1 className="text-2xl font-bold tracking-tight">Mehmonlar</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ism Familiya</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Hujjat raqami</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guests?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">Ma'lumot topilmadi</TableCell>
              </TableRow>
            ) : (
              guests?.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell className="font-medium">
                    {guest.first_name} {guest.last_name}
                  </TableCell>
                  <TableCell>{guest.phone || '-'}</TableCell>
                  <TableCell>{guest.email || '-'}</TableCell>
                  <TableCell>{guest.passport_number || guest.id_document_number || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
