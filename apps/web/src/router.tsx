import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { getMe } from "./lib/api";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { KnowledgeGraphPage } from "./pages/KnowledgeGraphPage";

// Root layout — just renders children
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Login / Register (public)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage,
});

// Protected layout — redirects to /login if not authenticated
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: async () => {
    try {
      await getMe();
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});

// /projects
const projectsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/projects",
  component: ProjectsPage,
});

// /projects/:projectId/workbench
const workbenchRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/projects/$projectId/workbench",
  component: WorkbenchPage,
});

// /projects/:projectId/graph
const graphRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/projects/$projectId/graph",
  component: KnowledgeGraphPage,
});

// /settings
const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/settings",
  component: SettingsPage,
});

// Redirect / → /projects
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/projects" });
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  protectedRoute.addChildren([projectsRoute, workbenchRoute, graphRoute, settingsRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
