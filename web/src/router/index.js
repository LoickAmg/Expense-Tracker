import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth.js";

const routes = [
  { path: "/login", name: "login", component: () => import("@/views/LoginView.vue"), meta: { public: true } },
  { path: "/", name: "dashboard", component: () => import("@/views/DashboardView.vue") },
  { path: "/transactions", name: "transactions", component: () => import("@/views/TransactionsView.vue") },
  { path: "/settings", name: "settings", component: () => import("@/views/SettingsView.vue") },
  { path: "/mention-legales", name: "mentions", component: () => import("@/views/LegalView.vue"), props: { page: "mentions-legales" }, meta: { public: true } },
  { path: "/confidentialite", name: "confidentialite", component: () => import("@/views/LegalView.vue"), props: { page: "confidentialite" }, meta: { public: true } },
  { path: "/contact", name: "contact", component: () => import("@/views/LegalView.vue"), props: { page: "contact" }, meta: { public: true } },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("@/views/NotFoundView.vue"),
    meta: { public: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (auth.status === "idle") {
    await auth.fetchCurrentUser();
  }

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "login" && auth.isAuthenticated) {
    return { name: "dashboard" };
  }
  return true;
});
