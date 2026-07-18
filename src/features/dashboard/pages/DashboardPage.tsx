import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BedDouble, Users, CalendarCheck, Wallet } from "lucide-react";
import { useRooms } from "@/features/rooms/api/rooms";
import { useReservations } from "@/features/reservations/api/reservations";
import { useGuests } from "@/features/guests/api/guests";
import { useInvoices } from "@/features/finance/api/finance";
import { Skeleton } from "@/components/ui/skeleton";

export const DashboardPage = () => {
  const { data: rooms, isLoading: isLoadingRooms } = useRooms();
  const { data: reservations, isLoading: isLoadingReservations } = useReservations();
  const { data: guests, isLoading: isLoadingGuests } = useGuests();
  const { data: invoices, isLoading: isLoadingInvoices } = useInvoices();

  const totalRooms = rooms?.length || 0;
  const availableRooms = rooms?.filter(r => r.current_status === 'AVAILABLE').length || 0;
  
  const activeReservations = reservations?.filter(r => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status)).length || 0;
  const totalGuests = guests?.length || 0;
  
  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Jami Xonalar</CardTitle>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingRooms ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold">{totalRooms}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bo'sh: {availableRooms} ta
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Faol Bandlovlar</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingReservations ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold">{activeReservations}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Jami bandlovlardan
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mehmonlar</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingGuests ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold">{totalGuests}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bazada ro'yxatdan o'tgan
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tushumlar</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingInvoices ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  To'langan summalar yig'indisi
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
