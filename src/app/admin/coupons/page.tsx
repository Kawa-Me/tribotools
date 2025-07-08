import { CouponEditor } from "@/components/admin/coupon-editor";

export default function AdminCouponsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciar Cupons</h1>
        <p className="text-muted-foreground">
          Crie, edite e gerencie os cupons de desconto da plataforma.
        </p>
      </div>
      <CouponEditor />
    </div>
  );
}
