import { WorkspaceCopilot } from "@/components/copilot/workspace-panel";

/**
 * Shared layout for the authenticated app surface.
 *
 * Lives in the (app) route group so the landing page at / doesn't show
 * the floating workspace copilot (or any other in-app chrome).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <WorkspaceCopilot />
    </>
  );
}
