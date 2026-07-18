import { useRooms } from "../api/rooms";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const RoomsPage = () => {
  const { data: rooms, isLoading, isError } = useRooms();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Xonalar</h1>
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'default';
      case 'OCCUPIED': return 'destructive';
      case 'CLEANING': return 'outline';
      case 'MAINTENANCE': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Xonalar</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Raqami</TableHead>
              <TableHead>Narxi</TableHead>
              <TableHead>Sig'imi</TableHead>
              <TableHead>Holati</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">Ma'lumot topilmadi</TableCell>
              </TableRow>
            ) : (
              rooms?.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.room_number}</TableCell>
                  <TableCell>${room.base_price?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>{room.capacity || '-'} kishi</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(room.current_status)}>
                      {room.current_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
