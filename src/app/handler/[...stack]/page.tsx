import { StackHandler } from "@stackframe/stack";
import { notFound } from "next/navigation";
import { stackServerApp } from "@/stack";

export default function Handler(props: unknown) {
  if (!stackServerApp) notFound();
  return <StackHandler fullPage app={stackServerApp} routeProps={props} />;
}
