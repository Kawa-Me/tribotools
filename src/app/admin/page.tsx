import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Package, TicketPercent, CreditCard, Webhook, Handshake } from "lucide-react";
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
              Crie, edite ou remova módulos e aulas.
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cupons de Desconto</CardTitle>
            <TicketPercent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Crie e gerencie cupons de desconto para os produtos.
            </p>
            <Link href="/admin/coupons" className="mt-2 inline-block">
                <span className="text-primary hover:underline">Gerenciar cupons</span>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Afiliados</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Gerencie seus parceiros e suas comissões de vendas.
            </p>
            <Link href="/admin/affiliates" className="mt-2 inline-block">
                <span className="text-primary hover:underline">Gerenciar afiliados</span>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Histórico de Pagamentos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Visualize todos os pagamentos gerados e seus status.
            </p>
            <Link href="/admin/payments" className="mt-2 inline-block">
                <span className="text-primary hover:underline">Ver pagamentos</span>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos de Webhook</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Visualize os eventos de webhook recebidos da PushinPay.
            </p>
            <Link href="/admin/webhooks" className="mt-2 inline-block">
                <span className="text-primary hover:underline">Ver webhooks</span>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
