"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import { Menu, ChevronDown, ChevronRight } from "lucide-react";
import { signOut } from "@/app/actions";
import { BrandLogo } from "@/components/app/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AppUser, RoleName } from "@/lib/database.types";
import { navGroups, type NavGroup } from "@/lib/navigation";

function Brand() {
  return (
    <div className="flex h-16 items-center gap-3 border-b px-4">
      <BrandLogo className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">RK Global</div>
        <div className="truncate text-xs text-muted-foreground">Fabric ERP</div>
      </div>
    </div>
  );
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-expand group containing active route on load/change
  useEffect(() => {
    const activeGroup = groups.find((g) => g.items.some((item) => pathname === item.href));
    if (activeGroup) {
      setExpanded({ [activeGroup.key]: true });
    }
  }, [pathname, groups]);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => (prev[key] ? {} : { [key]: true }));
  };

  return (
    <nav className="space-y-1.5 p-3 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {groups.map((group) => {
        const isExpanded = !!expanded[group.key];
        const hasActiveItem = group.items.some((item) => pathname === item.href);

        return (
          <div key={group.key} className="space-y-1">
            <button
              onClick={() => toggleGroup(group.key)}
              className={cn(
                "flex w-full min-h-10 items-center justify-between rounded-md px-3 py-2 text-xs font-semibold tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                hasActiveItem && "text-foreground bg-muted/40"
              )}
            >
              <span>{group.label}</span>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200" />
              )}
            </button>

            {isExpanded && (
              <div className="space-y-0.5 pl-3 border-l ml-4 mt-1 border-muted">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href as any}
                      prefetch={false}
                      onPointerEnter={() => router.prefetch(item.href as any)}
                      onFocus={() => router.prefetch(item.href as any)}
                      onClick={onNavigate}
                      className={cn(
                        "flex min-h-9 items-center rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        active && "bg-muted font-medium text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  permissions,
  children,
}: {
  user: AppUser & { roles: { name: RoleName } };
  permissions: string[];
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const groups = useMemo(() => {
    return navGroups
      .map((group) => {
        const items = group.items.filter(
          (item) => permissions.includes(item.permission) || item.roles.includes(user.roles.name)
        );
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0);
  }, [permissions, user.roles.name]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement && target.type === "number") {
        if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") {
          e.preventDefault();
        }
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement && target.type === "number") {
        const text = e.clipboardData?.getData("text");
        if (text && (Number(text) < 0 || isNaN(Number(text)))) {
          e.preventDefault();
        }
      }
    };

    const handleInput = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement && target.type === "number") {
        if (Number(target.value) < 0) {
          target.value = "0";
        }
      }
    };

    const addMinAttribute = () => {
      document.querySelectorAll('input[type="number"]').forEach((el) => {
        if (!el.hasAttribute("min")) {
          el.setAttribute("min", "0");
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("paste", handlePaste, { capture: true });
    window.addEventListener("input", handleInput, { capture: true });

    addMinAttribute();
    const observer = new MutationObserver(addMinAttribute);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("paste", handlePaste, { capture: true });
      window.removeEventListener("input", handleInput, { capture: true });
      observer.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-muted/30">
      <RouteTransitionBar />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-background lg:block">
        <Brand />
        <NavLinks groups={groups} />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b bg-background px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline" className="lg:hidden" aria-label="Open navigation">
                  <Menu className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="left-0 top-0 h-full w-[min(20rem,88vw)] translate-x-0 translate-y-0 overflow-y-auto rounded-none p-0">
                <DialogTitle className="sr-only">Navigation</DialogTitle>
                <Brand />
                <NavLinks groups={groups} onNavigate={() => setMobileNavOpen(false)} />
              </DialogContent>
            </Dialog>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user.full_name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge>{user.roles.name}</Badge>
            <form action={signOut}>
              <Button variant="outline" size="sm">
                Logout
              </Button>
            </form>
          </div>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

function RouteTransitionBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Hide progress bar once the route/search parameters update completes
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor) {
        const href = anchor.getAttribute("href");
        const targetAttr = anchor.getAttribute("target");

        // Show progress bar for internal link transitions (in same window/tab)
        if (
          href &&
          href.startsWith("/") &&
          (!targetAttr || targetAttr === "_self")
        ) {
          const currentUrl = window.location.pathname + window.location.search;
          if (href !== currentUrl) {
            setLoading(true);
          }
        }
      }
    };

    const handleFormSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      const action = form.getAttribute("action");

      // Show loading bar for internal form-based queries (e.g., search/filter forms)
      if (!action || action.startsWith("/")) {
        setLoading(true);
      }
    };

    document.addEventListener("click", handleAnchorClick);
    document.addEventListener("submit", handleFormSubmit);

    return () => {
      document.removeEventListener("click", handleAnchorClick);
      document.removeEventListener("submit", handleFormSubmit);
    };
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-primary overflow-hidden">
      <div className="h-full bg-primary-foreground/30 animate-infinite-loading progress-bar-shine" />
      <style>{`
        @keyframes infinite-loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-infinite-loading {
          animation: infinite-loading 1.2s infinite linear;
        }
        .progress-bar-shine {
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
        }
      `}</style>
    </div>
  );
}

export function RouteTransitionBar() {
  return (
    <Suspense fallback={null}>
      <RouteTransitionBarInner />
    </Suspense>
  );
}
