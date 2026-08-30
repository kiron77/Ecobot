import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  Cpu,
  Search,
  Plus,
  Trash2,
  Eye,
  Zap,
  Radio,
  Gauge,
  Camera,
  Joystick,
  Grid3x3,
  Mic,
  Droplets,
  Compass,
  CircleDot,
  Circle,
  ShoppingCart,
  CheckCircle2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CatalogModule {
  id: string;
  group: string;
  displayName: string;
  model: string;
  description: string;
  sensors: string[];
  pinHints: string;
  notes: string;
}

interface UserModule {
  userId: string;
  moduleId: string;
  quantity: number;
  notes: string;
  addedAt: string;
  catalogInfo: CatalogModule | null;
}

interface CartItem {
  userId: string;
  moduleId: string;
  addedAt: string;
  catalogInfo: CatalogModule | null;
}

const GROUP_ICONS: Record<string, React.ElementType> = {
  "Eyes & Senses": Eye,
  "Motion & Muscle": Zap,
  "Interaction & Output": Radio,
};

const MODULE_ICONS: Record<string, React.ElementType> = {
  "ultrasonic-hcsr04": Gauge,
  "ir-obstacle-fc51": Eye,
  "microphone-ky037": Mic,
  "water-level-analog": Droplets,
  "magnetometer-hmc5883l": Compass,
  "imu-mpu9250": CircleDot,
  "camera-ov7670": Camera,
  "tt-gear-motors": Zap,
  "wheels-tt": Circle,
  "servo-sg90": CircleDot,
  "joystick-ky023": Joystick,
  "led-matrix-max7219": Grid3x3,
};

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

function useUserModules(getToken: () => Promise<string | null>) {
  return useQuery<UserModule[]>({
    queryKey: ["user-modules"],
    queryFn: async () => {
      const r = await authFetch("/api/modules/user", getToken);
      if (!r.ok) throw new Error("Failed to load modules");
      return r.json() as Promise<UserModule[]>;
    },
  });
}

function useCatalog() {
  return useQuery<CatalogModule[]>({
    queryKey: ["modules-catalog"],
    queryFn: async () => {
      const r = await fetch("/api/catalog-modules");
      if (!r.ok) throw new Error("Failed to load catalog");
      const data = await r.json();
      return Array.isArray(data) ? (data as CatalogModule[]) : [];
    },
  });
}

function useCartItems(getToken: () => Promise<string | null>) {
  return useQuery<CartItem[]>({
    queryKey: ["cart"],
    queryFn: async () => {
      const r = await authFetch("/api/cart", getToken);
      if (!r.ok) throw new Error("Failed to load cart");
      return r.json() as Promise<CartItem[]>;
    },
  });
}

function CollectionModuleCard({
  mod,
  onRemove,
  isRemoving,
}: {
  mod: CatalogModule;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const Icon = MODULE_ICONS[mod.id] ?? Cpu;
  const GroupIcon = GROUP_ICONS[mod.group] ?? Cpu;
  const [hovered, setHovered] = useState(false);

  return (
    <Card
      className="flex flex-col border-primary/30 bg-primary/[0.02] transition-all duration-200 overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <div className="w-11 h-11 rounded-lg bg-primary/12 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-sm leading-tight">{mod.displayName}</CardTitle>
          <div className="flex items-center gap-1.5 mt-1">
            <GroupIcon className="w-3 h-3 text-muted-foreground" />
            <CardDescription className="text-xs">{mod.group}</CardDescription>
            <span className="text-muted-foreground/40">·</span>
            <CardDescription className="font-mono text-xs">{mod.model}</CardDescription>
          </div>
        </div>
        <Badge variant="default" className="text-xs shrink-0">Owned</Badge>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-2 pt-0">
        <p className="text-xs text-muted-foreground leading-relaxed">{mod.description}</p>

        {mod.sensors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mod.sensors.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs font-normal">{s}</Badge>
            ))}
          </div>
        )}

        <div
          style={{
            maxHeight: hovered ? "40px" : "0px",
            opacity: hovered ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.2s ease, opacity 0.15s ease",
          }}
        >
          <Button
            size="sm"
            variant="ghost"
            className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-8 mt-1"
            onClick={onRemove}
            disabled={isRemoving}
          >
            <Trash2 className="w-3 h-3" />
            {isRemoving ? "Removing..." : "Remove from collection"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BrowseCatalogCard({
  mod,
  owned,
  inCart,
  onAddToCart,
  isAdding,
}: {
  mod: CatalogModule;
  owned: boolean;
  inCart: boolean;
  onAddToCart: () => void;
  isAdding: boolean;
}) {
  const Icon = MODULE_ICONS[mod.id] ?? Cpu;
  const GroupIcon = GROUP_ICONS[mod.group] ?? Cpu;

  return (
    <Card className={`flex flex-col transition-all border-2 ${owned ? "border-primary/40 bg-primary/[0.03]" : inCart ? "border-amber-500/30 bg-amber-500/[0.03]" : ""}`}>
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${owned ? "bg-primary/12" : "bg-secondary"}`}>
          <Icon className={`w-5 h-5 ${owned ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-sm leading-tight">{mod.displayName}</CardTitle>
          <div className="flex items-center gap-1.5 mt-1">
            <GroupIcon className="w-3 h-3 text-muted-foreground" />
            <CardDescription className="text-xs">{mod.group}</CardDescription>
            <span className="text-muted-foreground/40">·</span>
            <CardDescription className="font-mono text-xs">{mod.model}</CardDescription>
          </div>
        </div>
        {owned ? (
          <Badge variant="default" className="text-xs shrink-0">Owned</Badge>
        ) : inCart ? (
          <Badge variant="outline" className="text-xs shrink-0 text-amber-600 border-amber-500/40">In Cart</Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 pt-0">
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">{mod.description}</p>
        {mod.sensors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mod.sensors.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs font-normal">{s}</Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-xs font-semibold text-primary">FREE</span>
          <Button
            size="sm"
            className="gap-1.5 text-xs h-8 flex-1"
            onClick={onAddToCart}
            disabled={owned || inCart || isAdding}
            variant={owned ? "secondary" : inCart ? "outline" : "default"}
          >
            {owned ? (
              <><CheckCircle2 className="w-3 h-3" />Already Owned</>
            ) : inCart ? (
              <><ShoppingCart className="w-3 h-3" />In Cart</>
            ) : isAdding ? (
              "Adding..."
            ) : (
              <><ShoppingCart className="w-3 h-3" />Add to Cart</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CollectionCatalogCard({
  mod,
  owned,
  onAdd,
  isAdding,
}: {
  mod: CatalogModule;
  owned: boolean;
  onAdd: () => void;
  isAdding: boolean;
}) {
  const Icon = MODULE_ICONS[mod.id] ?? Cpu;
  const GroupIcon = GROUP_ICONS[mod.group] ?? Cpu;

  return (
    <Card className={`flex flex-col transition-all border-2 ${owned ? "border-primary/30 bg-primary/[0.02]" : ""}`}>
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${owned ? "bg-primary/12" : "bg-secondary"}`}>
          <Icon className={`w-5 h-5 ${owned ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-sm leading-tight">{mod.displayName}</CardTitle>
          <div className="flex items-center gap-1.5 mt-1">
            <GroupIcon className="w-3 h-3 text-muted-foreground" />
            <CardDescription className="text-xs">{mod.group}</CardDescription>
          </div>
        </div>
        {owned && <Badge variant="default" className="text-xs shrink-0">Owned</Badge>}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 pt-0">
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">{mod.description}</p>
        <Button
          size="sm"
          className="w-full gap-2 mt-1 text-xs h-8"
          onClick={onAdd}
          disabled={owned || isAdding}
          variant={owned ? "secondary" : "default"}
        >
          {owned ? "Already owned" : isAdding ? "Adding..." : <><Plus className="w-3 h-3" />Add to collection</>}
        </Button>
      </CardContent>
    </Card>
  );
}

function AddModuleSheet({
  open,
  onOpenChange,
  ownedIds,
  catalog,
  onAdd,
  addingId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ownedIds: Set<string>;
  catalog: CatalogModule[];
  onAdd: (id: string) => void;
  addingId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("All");

  const groups = useMemo(() => {
    const seen = new Set<string>();
    catalog.forEach((m) => seen.add(m.group));
    return ["All", ...Array.from(seen)];
  }, [catalog]);

  const filtered = useMemo(() => {
    return catalog.filter((m) => {
      const matchGroup = group === "All" || m.group === group;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        m.displayName.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.sensors.some((s) => s.includes(q));
      return matchGroup && matchSearch;
    });
  }, [catalog, group, search]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Add to Collection</SheetTitle>
          <SheetDescription>Find and add EcoBot PCB modules to your personal collection.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search by name, model or sensor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const GIcon = g !== "All" ? GROUP_ICONS[g] : null;
              return (
                <Button
                  key={g}
                  size="sm"
                  variant={group === g ? "default" : "outline"}
                  onClick={() => setGroup(g)}
                  className="text-xs h-8 gap-1.5"
                >
                  {GIcon && <GIcon className="w-3.5 h-3.5" />}
                  {g}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((mod) => (
            <CollectionCatalogCard
              key={mod.id}
              mod={mod}
              owned={ownedIds.has(mod.id)}
              onAdd={() => { onAdd(mod.id); }}
              isAdding={addingId === mod.id}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No modules match your search.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function Modules() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cartAddingId, setCartAddingId] = useState<string | null>(null);

  const { data: catalogRaw, isLoading: catalogLoading } = useCatalog();
  const catalog = Array.isArray(catalogRaw) ? catalogRaw : [];
  const { data: userModulesRaw, isLoading: userLoading } = useUserModules(getToken);
  const userModules = Array.isArray(userModulesRaw) ? userModulesRaw : [];
  const { data: cartItemsRaw } = useCartItems(getToken);
  const cartItems = Array.isArray(cartItemsRaw) ? cartItemsRaw : [];

  const ownedIds = useMemo(() => new Set((userModules ?? []).map((m) => m.moduleId)), [userModules]);
  const cartIds = useMemo(() => new Set((cartItems ?? []).map((m) => m.moduleId)), [cartItems]);

  const addMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      setAddingId(moduleId);
      const r = await authFetch("/api/modules/user", getToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      });
      if (!r.ok) throw new Error("Failed to add");
      return r.json();
    },
    onSuccess: (_, moduleId) => {
      qc.invalidateQueries({ queryKey: ["user-modules"] });
      setAddingId(null);
      const mod = catalog?.find((m) => m.id === moduleId);
      if (mod) toast({ title: `Added ${mod.displayName} to your collection` });
    },
    onError: () => {
      setAddingId(null);
      toast({ title: "Failed to add module", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      setRemovingId(moduleId);
      const r = await authFetch(`/api/modules/user/${moduleId}`, getToken, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to remove");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user-modules"] }); setRemovingId(null); },
    onError: () => setRemovingId(null),
  });

  const addToCartMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      setCartAddingId(moduleId);
      const r = await authFetch("/api/cart", getToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      });
      if (!r.ok) throw new Error("Failed to add to cart");
      return r.json();
    },
    onSuccess: (_, moduleId) => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      setCartAddingId(null);
      const mod = catalog?.find((m) => m.id === moduleId);
      toast({ title: `${mod?.displayName ?? "Module"} added to cart` });
    },
    onError: () => {
      setCartAddingId(null);
      toast({ title: "Failed to add to cart", variant: "destructive" });
    },
  });

  const handleAdd = useCallback((moduleId: string) => { addMutation.mutate(moduleId); }, [addMutation]);
  const handleRemove = useCallback((moduleId: string) => { removeMutation.mutate(moduleId); }, [removeMutation]);
  const handleAddToCart = useCallback((moduleId: string) => { addToCartMutation.mutate(moduleId); }, [addToCartMutation]);

  const isLoading = userLoading || catalogLoading;
  const cartCount = cartItems?.length ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-primary">The catalog</div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Module Registry</h1>
          <p className="text-muted-foreground mt-2">Your EcoBot PCB module collection — browse to add more.</p>
        </div>
        <div className="flex items-center gap-2">
          {userModules && (
            <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              {userModules.length} owned
            </Badge>
          )}
          {cartCount > 0 && (
            <Badge variant="secondary" className="text-sm px-3 py-1.5 gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" />
              {cartCount} in cart
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="mine">
        <TabsList className="mb-8">
          <TabsTrigger value="mine">
            My Collection
            {userModules && userModules.length > 0 && (
              <span className="ml-2 bg-primary/20 text-primary text-xs rounded-full px-1.5 py-0.5">
                {userModules.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="catalog">
            Browse All
            {cartCount > 0 && (
              <span className="ml-2 bg-amber-500/20 text-amber-600 text-xs rounded-full px-1.5 py-0.5">
                {cartCount} in cart
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* === My Collection Tab === */}
        <TabsContent value="mine">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}><CardHeader><Skeleton className="h-20 w-full" /></CardHeader></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(userModules ?? [])
                .filter((m) => m.catalogInfo)
                .map((m) => (
                  <CollectionModuleCard
                    key={m.moduleId}
                    mod={m.catalogInfo!}
                    onRemove={() => handleRemove(m.moduleId)}
                    isRemoving={removingId === m.moduleId}
                  />
                ))}

              <button
                onClick={() => setSheetOpen(true)}
                className="group flex flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-primary/30 bg-primary/[0.02] hover:bg-primary/[0.06] hover:border-primary/50 transition-all duration-200 min-h-[160px] cursor-pointer"
                data-testid="button-add-module"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                  <Plus className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-primary">Add a module</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Browse the full catalog</p>
                </div>
              </button>
            </div>
          )}

          {!isLoading && userModules?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-10 mb-4">
              No modules yet. Click the card above to add your first one.
            </p>
          )}
        </TabsContent>

        {/* === Browse All Tab === */}
        <TabsContent value="catalog">
          {catalogLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i}><CardHeader><Skeleton className="h-20 w-full" /></CardHeader></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(catalog ?? []).map((mod) => (
                <BrowseCatalogCard
                  key={mod.id}
                  mod={mod}
                  owned={ownedIds.has(mod.id)}
                  inCart={cartIds.has(mod.id)}
                  onAddToCart={() => handleAddToCart(mod.id)}
                  isAdding={cartAddingId === mod.id}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddModuleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        ownedIds={ownedIds}
        catalog={catalog ?? []}
        onAdd={(id) => { handleAdd(id); }}
        addingId={addingId}
      />
    </div>
  );
}
