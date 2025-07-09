import { ModuleEditor } from "@/components/admin/module-editor";

export default function AdminModulesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciar Módulos</h1>
        <p className="text-muted-foreground">
          Adicione, edite ou remova módulos e suas respectivas aulas.
        </p>
      </div>
      <ModuleEditor />
    </div>
  );
}
