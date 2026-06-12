import "server-only";
import { StackServerApp } from "@stackframe/stack";

function realValue(v: string | undefined): boolean {
  return !!v && !/^\*+$/.test(v);
}

// Neon Auth (Stack) is only wired when real keys are present; otherwise the
// app falls back to a dev identity (see src/lib/auth.ts).
export const stackEnabled =
  realValue(process.env.NEXT_PUBLIC_STACK_PROJECT_ID) &&
  realValue(process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY) &&
  realValue(process.env.STACK_SECRET_SERVER_KEY);

export const stackServerApp = stackEnabled
  ? new StackServerApp({
      tokenStore: "nextjs-cookie",
      urls: {
        signIn: "/handler/sign-in",
        afterSignIn: "/dashboard",
        afterSignUp: "/dashboard",
        afterSignOut: "/",
      },
    })
  : null;
