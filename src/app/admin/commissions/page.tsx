import { CommissionManager } from "@/components/admin/commission-manager";

export default function AdminCommissionsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciar Comissões</h1>
        <p className="text-muted-foreground">
          Aprove ou cancele comissões de afiliados e reverta saldos.
        </p>
      </div>
      <CommissionManager />
    </div>
  );
}
