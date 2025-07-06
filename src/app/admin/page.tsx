import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Package } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Painel do Administrador</h1>
        <p className="text-muted-foreground">Gerencie usuários, conteúdos e planos da plataforma.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Visualize e gerencie os usuários cadastrados.
            </p>
            <Link href="/admin/users" className="mt-2 inline-block">
                <span className="text-primary hover:underline">Ver usuários</span>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Módulos</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Crie, edite ou remova módulos e lições.
            </p>
            <Link href="/admin/modules" className="mt-2 inline-block">
                <span className="text-primary hover:underline">Gerenciar módulos</span>
            </Link>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Gerencie os produtos e planos de assinatura.
            </p>
            <Link href="/admin/plans" className="mt-2 inline-block">
                <span className="text-primary hover:underline">Gerenciar planos</span>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
