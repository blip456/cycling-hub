// Must run first: snapshots the reset-link parameters before supabase-js strips them from the URL.
import "@/lib/auth/initial-url";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { AuthProvider } from "./lib/auth/AuthProvider";
import { UpdatePrompt } from "./pwa/UpdatePrompt";
import "./styles/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root is missing");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <UpdatePrompt />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
