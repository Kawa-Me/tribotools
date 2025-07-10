import { AffiliateEditor } from "@/components/admin/affiliate-editor";

export default function AdminAffiliatesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciar Afiliados</h1>
        <p className="text-muted-foreground">
          Crie, edite e gerencie os parceiros afiliados da plataforma.
        </p>
      </div>
      <AffiliateEditor />
    </div>
  );
}
