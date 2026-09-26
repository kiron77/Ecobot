import { useState } from "react";
import { useAdminMe } from "@/lib/admin";
import { Link, useLocation } from "wouter";
import { useUser, useClerk, useAuth } from "@clerk/react";
import {
  LayoutDashboard,
  Code2,
  FolderGit2,
  Bot,
  Cpu,
  GraduationCap,
  Settings as SettingsIcon,
  Wrench,
  Crown,
  LogOut,
  Home,
  ShoppingCart,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard",  shortLabel: "Home",    href: "/dashboard" },
  { icon: Code2,           label: "Code Editor", shortLabel: "Editor",  href: "/editor" },
  { icon: FolderGit2,      label: "Projects",    shortLabel: "Projects", href: "/projects" },
  { icon: Bot,             label: "Sprocket",    shortLabel: "Sprocket", href: "/tutor" },
  { icon: GraduationCap,   label: "Lessons",     shortLabel: "Lessons", href: "/lessons" },
  { icon: Cpu,             label: "Modules",     shortLabel: "Modules", href: "/modules" },
  { icon: SettingsIcon,    label: "Settings",    shortLabel: "Settings", href: "/settings" },
];

function useCartCount(getToken: () => Promise<string | null>) {
  const { data } = useQuery<number>({
    queryKey: ["cart-count"],
    queryFn: async () => {
      const token = await getToken();
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch("/api/cart", { headers });
      if (!r.ok) return 0;
      const items = (await r.json()) as unknown[];
      return items.length;
    },
    staleTime: 30_000,
  });
  return data ?? 0;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const cartCount = useCartCount(getToken);
  const { data: me } = useAdminMe();
  const [menuOpen, setMenuOpen] = useState(false);

  // Admin nav links, gated by role.
  const adminItems = [];
  if (me?.canManageContent) {
    adminItems.push({ icon: Wrench, label: "Manage Modules", shortLabel: "Modules+", href: "/admin/modules" });
  }
  if (me?.canManageRoles) {
    adminItems.push({ icon: Crown, label: "Manage Roles", shortLabel: "Roles", href: "/admin/roles" });
  }
  const navItems = [...NAV_ITEMS, ...adminItems];

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "Engineer";

  const sidebarNav = (onNavigate?: () => void) => (
    <>
      {navItems.map((item) => {
        const active =
          location === item.href ||
          (item.href !== "/dashboard" && location.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
              active
                ? "bg-primary text-primary-foreground hover-elevate shadow-[0_0_20px_-6px_hsl(148_84%_47%/0.6)]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground hover-elevate",
            )}
            data-testid={`link-sidebar-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/cart"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
          location === "/cart"
            ? "bg-primary text-primary-foreground hover-elevate shadow-[0_0_20px_-6px_hsl(148_84%_47%/0.6)]"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground hover-elevate",
        )}
        data-testid="link-sidebar-cart"
      >
        <div className="relative">
          <ShoppingCart className="w-4 h-4" />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </div>
        Cart
        {cartCount > 0 && (
          <span className="ml-auto bg-amber-500/20 text-amber-700 text-xs rounded-full px-1.5 py-0.5 font-medium">
            {cartCount}
          </span>
        )}
      </Link>
    </>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col shrink-0">
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <img src="/ecobot-logo.png" alt="EcoBot" className="h-7 w-auto" />
        </div>

        {/* Profile area */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt="Profile"
                className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {displayName[0]?.toUpperCase() ?? "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {user?.emailAddresses?.[0]?.emailAddress ?? ""}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {sidebarNav()}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile top header ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-sidebar border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/ecobot-logo.png" alt="EcoBot" className="h-6 w-auto" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* ── Mobile slide-in menu Sheet ── */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col bg-sidebar">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-left">
              <img src="/ecobot-logo.png" alt="EcoBot" className="h-6 w-auto" />
            </SheetTitle>
          </SheetHeader>

          {/* Profile */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {displayName[0]?.toUpperCase() ?? "U"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-none truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {user?.emailAddresses?.[0]?.emailAddress ?? ""}
                </p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {sidebarNav(() => setMenuOpen(false))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border space-y-1">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
            <button
              onClick={() => { setMenuOpen(false); signOut({ redirectUrl: "/" }); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-hidden flex flex-col relative pt-12 md:pt-0 pb-16 md:pb-0">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, hsl(142 40% 50% / 0.04), transparent)",
          }}
        />
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 z-10">
          <div className="mx-auto max-w-6xl w-full h-full">{children}</div>
        </div>
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-sidebar border-t border-border flex items-center justify-evenly px-1">
        {NAV_ITEMS.map((item) => {
          const active =
            location === item.href ||
            (item.href !== "/dashboard" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0",
                active ? "text-primary" : "text-muted-foreground",
              )}
              data-testid={`link-bottom-${item.shortLabel.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none">{item.shortLabel}</span>
            </Link>
          );
        })}
        <Link
          href="/cart"
          className={cn(
            "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors relative",
            location === "/cart" ? "text-primary" : "text-muted-foreground",
          )}
          data-testid="link-bottom-cart"
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5 shrink-0" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium leading-none">Cart</span>
        </Link>
      </nav>
    </div>
  );
}
