import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AgileAppContent } from "./App";
import "./index.css";
import { createIdbPersister, createQueryClient } from "./lib/queryClient";

const queryClient = createQueryClient();
const persister = createIdbPersister();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 12,
      }}
    >
      <AgileAppContent />
    </PersistQueryClientProvider>
  </StrictMode>,
);
