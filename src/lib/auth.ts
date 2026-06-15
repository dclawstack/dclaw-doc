import "server-only";
import { stackEnabled, stackServerApp } from "@/stack";

export type AppUser = {
  id: string;
  email: string;
  name: string;
};

export const DEV_USER: AppUser = {
  id: "dev-user",
  email: "dev@localhost",
  name: "Dev User",
};

/**
 * Returns the signed-in user, or null when signed out.
 * When Neon Auth keys are not configured, every request is the dev user so
 * the product is fully usable before auth credentials arrive.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  if (!stackEnabled || !stackServerApp) return DEV_USER;
  const user = await stackServerApp.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.primaryEmail ?? "",
    name: user.displayName ?? user.primaryEmail ?? "User",
  };
}

/** Like getCurrentUser, but throws a 401-shaped error for API routes. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return user;
}
