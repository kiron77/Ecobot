import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Trash2, CheckCircle2, Package, ArrowRight, Cpu } from "lucide-react";
import { useLocation } from "wouter";

interface CartItem {
  userId: string;
  moduleId: string;
  addedAt: string;
  catalogInfo: {
    id: string;
    group: string;
    displayName: string;
    model: string;
    description: string;
    sensors: string[];
  } | null;
}

async function authFetch(
  url: string,
  getToken: () => Promise<string | null>,
  init?: RequestInit
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export default function Cart() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const success = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("success") === "true";

  const { data: items, isLoading } = useQuery<CartItem[]>({
    queryKey: ["cart"],
    queryFn: async () => {
      const r = await authFetch("/api/cart", getToken);
      if (!r.ok) throw new Error("Failed to load cart");
      return r.json() as Promise<CartItem[]>;
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      const r = await authFetch(`/api/cart/${moduleId}`, getToken, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to remove");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cart"] }); },
    onError: () => toast({ title: "Failed to remove from cart", variant: "destructive" }),
  });

  const checkout = async () => {
    if (!items || items.length === 0) return;
    setIsCheckingOut(true);
    try {
      const r = await authFetch("/api/cart/checkout", getToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Checkout failed");
      const data = await r.json() as { url?: string; success?: boolean; simulated?: boolean };

      if (data.url) {
        window.location.href = data.url;
      } else if (data.success) {
        qc.invalidateQueries({ queryKey: ["cart"] });
        qc.invalidateQueries({ queryKey: ["user-modules"] });
        toast({ title: "Modules added to your collection!" });
        setLocation("/modules");
      }
    } catch {
      toast({ title: "Checkout failed. Please try again.", variant: "destructive" });
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20 animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Modules Unlocked!</h1>
          <p className="text-muted-foreground mt-2">Your modules have been added to your collection.</p>
        </div>
        <Button onClick={() => setLocation("/modules")} className="gap-2 mt-2">
          <Package className="w-4 h-4" />
          Go to My Collection
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  const total = items?.length ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-primary" />
            My Cart
          </h1>
          <p className="text-muted-foreground mt-2">Review your selected EcoBot modules before checkout.</p>
        </div>
        {total > 0 && (
          <Badge variant="outline" className="text-sm px-3 py-1.5">
            {total} module{total !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <ShoppingCart className="w-12 h-12 text-muted-foreground/30" />
            <div>
              <p className="text-lg font-semibold">Your cart is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Browse the module catalog and add some to your cart.
              </p>
            </div>
            <Button onClick={() => setLocation("/modules")} className="gap-2 mt-2">
              Browse Modules
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-3">
            {items?.map((item) => (
              <Card key={item.moduleId} className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Cpu className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">
                    {item.catalogInfo?.displayName ?? item.moduleId}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.catalogInfo?.group}</p>
                  {item.catalogInfo?.sensors && item.catalogInfo.sensors.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.catalogInfo.sensors.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs font-normal">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-primary">FREE</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => removeMutation.mutate(item.moduleId)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modules ({total})</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base border-t pt-2">
                    <span>Total</span>
                    <span className="text-primary">$0.00</span>
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={checkout}
                  disabled={isCheckingOut || total === 0}
                >
                  {isCheckingOut ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Checkout
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Modules will be added to your collection instantly.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
