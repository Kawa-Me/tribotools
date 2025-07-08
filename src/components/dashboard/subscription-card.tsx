'use client';

import { useAuth } from '@/lib/hooks';
import { useProducts } from '@/hooks/use-products';
import { Button } from '@/components/ui/button';
import { CheckoutModal } from '@/components/checkout-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Package } from 'lucide-react';

export function SubscriptionCard() {
    const { user } = useAuth();
    const { products } = useProducts();

    if (user?.isAnonymous) {
        return (
            <Card className="bg-card/80 backdrop-blur-sm border-white/10">
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Nossos Planos</CardTitle>
                    <CardDescription className="text-xs">
                        Faça um upgrade para ter acesso ilimitado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <CheckoutModal>
                        <Button size="sm" className="w-full mt-2">Ver Planos</Button>
                    </CheckoutModal>
                </CardContent>
            </Card>
        );
    }

    const userSubscriptions = user?.subscriptions ? Object.entries(user.subscriptions) : [];
    
    return (
        <Card className="bg-card/80 backdrop-blur-sm border-white/10">
            <CardHeader className="p-4">
                <CardTitle className="text-base">Minhas Assinaturas</CardTitle>
                {user?.role === 'admin' && <CardDescription className="text-xs">Plano: Administrador</CardDescription>}
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
                {user?.role === 'admin' ? (
                     <div className="text-xs text-muted-foreground">Acesso vitalício a todos os produtos.</div>
                ) : userSubscriptions.length > 0 ? (
                    userSubscriptions.map(([productId, sub]) => {
                        let daysLeft: number | null = null;
                        if (sub.status === 'active' && sub.expiresAt) {
                            const now = new Date();
                            const expires = sub.expiresAt.toDate();
                            now.setHours(0, 0, 0, 0);
                            expires.setHours(0, 0, 0, 0);
                            const diffTime = expires.getTime() - now.getTime();
                            daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }

                        const productName = products.find(p => p.id === productId)?.name || productId;

                        return (
                            <div key={productId} className="text-xs space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-foreground flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{productName}</span>
                                    <span className={`font-bold ${sub.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                                        {sub.status === 'active' ? 'Ativa' : 'Expirada'}
                                    </span>
                                </div>
                                {daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && (
                                    <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-950/50 p-2 mt-1">
                                        <div className="flex items-center gap-2 text-amber-300">
                                            <AlertTriangle className="h-4 w-4" />
                                            <p className="text-xs font-semibold">Atenção!</p>
                                        </div>
                                        <p className="text-xs text-amber-400">
                                            {daysLeft === 0 ? 'Sua assinatura expira hoje.' : `Expira em ${daysLeft} dias.`}
                                        </p>
                                    </div>
                                )}
                                {sub.status !== 'active' && <p className="text-muted-foreground">Renove para reativar o acesso.</p>}
                            </div>
                        );
                    })
                ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma assinatura ativa.</p>
                )}
                <CheckoutModal>
                    <Button size="sm" className="w-full mt-2">
                        {userSubscriptions.length > 0 ? 'Gerenciar / Adicionar Planos' : 'Ver Planos'}
                    </Button>
                </CheckoutModal>
            </CardContent>
        </Card>
    );
}
