import { PlanEditor } from "@/components/admin/plan-editor";

export default function AdminPlansPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciar Planos</h1>
        <p className="text-muted-foreground">
          Adicione, edite ou remova produtos e seus respectivos planos de assinatura.
        </p>
      </div>
      <PlanEditor />
    </div>
  );
}
