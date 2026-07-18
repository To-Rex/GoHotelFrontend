import { useInvoices } from "../api/finance";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const FinancePage = () => {
  const { data: invoices, isLoading, isError } = useInvoices();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Moliya</h1>
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
      case 'PAID': return 'default';
      case 'DRAFT': return 'secondary';
      case 'ISSUED': return 'outline';
      case 'PARTIALLY_PAID': return 'secondary';
      case 'VOID': return 'destructive';
      case 'REFUNDED': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Hisob-fakturalar (Invoices)</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Raqami</TableHead>
              <TableHead>Sana</TableHead>
              <TableHead>Muddati</TableHead>
              <TableHead>Holati</TableHead>
              <TableHead className="text-right">Umumiy Summa</TableHead>
              <TableHead className="text-right">To'landi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Ma'lumot topilmadi</TableCell>
              </TableRow>
            ) : (
              invoices?.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.invoice_date || '-'}</TableCell>
                  <TableCell>{inv.due_date || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(inv.status)}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">${inv.total_amount?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">${inv.paid_amount?.toFixed(2) || '0.00'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
