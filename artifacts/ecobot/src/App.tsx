import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  Switch,
  Route,
  useLocation,
  Router as WouterRouter,
  Redirect,
} from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Editor from "@/pages/editor";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Tutor from "@/pages/tutor";
import Modules from "@/pages/modules";
import Lessons from "@/pages/lessons";
import Cart from "@/pages/cart";
import Settings from "@/pages/settings";
import AdminRoles from "@/pages/admin-roles";
import AdminModules from "@/pages/admin-modules";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#16a34a",
    colorForeground: "#111827",
    colorMutedForeground: "#6b7280",
    colorDanger: "#ef4444",
    colorBackground: "#ffffff",
    colorInput: "#f9fafb",
    colorInputForeground: "#111827",
    colorNeutral: "#d1d5db",
    fontFamily: "system-ui, -apple-system, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-bold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButtonText: "text-gray-700",
    formFieldLabel: "text-gray-700 font-medium",
    footerActionLink: "text-green-600 font-semibold",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-green-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-gray-700",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50",
    formButtonPrimary: "bg-green-600 hover:bg-green-700 text-white",
    formFieldInput: "border-gray-200 bg-gray-50 text-gray-900",
    footerAction: "bg-gray-50",
    dividerLine: "bg-gray-200",
    alert: "bg-red-50",
    otpCodeFieldInput: "border-gray-200",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background px-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 horizon-glow opacity-60" />
      <div className="relative z-10 w-full max-w-md">
        <img src="/ecobot-logo.png" alt="EcoBot" className="mx-auto mb-8 h-9 w-auto" />
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background px-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 horizon-glow opacity-60" />
      <div className="relative z-10 w-full max-w-md">
        <img src="/ecobot-logo.png" alt="EcoBot" className="mx-auto mb-8 h-9 w-auto" />
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Component />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to your EcoBot account" } },
        signUp: { start: { title: "Join EcoBot", subtitle: "Start building real robots today" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/">
              {() => (
                <>
                  <Show when="signed-in">
                    <Redirect to="/dashboard" />
                  </Show>
                  <Show when="signed-out">
                    <Landing />
                  </Show>
                </>
              )}
            </Route>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/dashboard">
              {() => <ProtectedRoute component={Dashboard} />}
            </Route>
            <Route path="/editor">
              {() => <ProtectedRoute component={Editor} />}
            </Route>
            <Route path="/projects/:id">
              {() => <ProtectedRoute component={ProjectDetail} />}
            </Route>
            <Route path="/projects">
              {() => <ProtectedRoute component={Projects} />}
            </Route>
            <Route path="/tutor">
              {() => <ProtectedRoute component={Tutor} />}
            </Route>
            <Route path="/modules">
              {() => <ProtectedRoute component={Modules} />}
            </Route>
            <Route path="/lessons">
              {() => <ProtectedRoute component={Lessons} />}
            </Route>
            <Route path="/settings">
              {() => <ProtectedRoute component={Settings} />}
            </Route>
            <Route path="/admin/roles">
              {() => <ProtectedRoute component={AdminRoles} />}
            </Route>
            <Route path="/admin/modules">
              {() => <ProtectedRoute component={AdminModules} />}
            </Route>
            <Route path="/cart">
              {() => <ProtectedRoute component={Cart} />}
            </Route>
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
