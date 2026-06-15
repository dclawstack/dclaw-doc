import { redirect } from "next/navigation";
import { and, asc, count, desc, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { documents, folders } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ensureDefaultWorkspace } from "@/lib/workspace";
import { seedWorkspaceIfEmpty } from "@/lib/seed";
import { FolderSidebar } from "@/components/FolderSidebar";
import { DashboardDocs } from "@/components/DashboardDocs";
import type { DocRow } from "@/components/DocTable";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { folderId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/handler/sign-in");
  const workspace = await ensureDefaultWorkspace(user);
  await seedWorkspaceIfEmpty(workspace, user.id);
  const folderId = searchParams.folderId;

  const conditions: SQL[] = [
    eq(documents.workspaceId, workspace.id),
    isNull(documents.deletedAt),
  ];
  if (folderId) conditions.push(eq(documents.folderId, folderId));
  const where = and(...conditions);

  const [folderList, docs, totalRows] = await Promise.all([
    db()
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(eq(folders.workspaceId, workspace.id))
      .orderBy(asc(folders.name)),
    db()
      .select({
        id: documents.id,
        title: documents.title,
        status: documents.status,
        sensitivity: documents.sensitivity,
        version: documents.version,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(where)
      .orderBy(desc(documents.updatedAt))
      .limit(50),
    db().select({ total: count() }).from(documents).where(where),
  ]);

  const items: DocRow[] = docs.map((d) => ({
    ...d,
    updatedAt: d.updatedAt.toISOString(),
  }));
  const activeFolder = folderList.find((f) => f.id === folderId);

  return (
    <div className="flex gap-8">
      <aside className="w-56 shrink-0">
        <FolderSidebar folders={folderList} activeFolderId={folderId} />
      </aside>
      <section className="min-w-0 flex-1">
        <h1 className="mb-4 text-lg font-semibold tracking-tight text-zinc-900">
          {activeFolder ? activeFolder.name : "All documents"}
        </h1>
        <DashboardDocs
          initialItems={items}
          initialTotal={totalRows[0]?.total ?? 0}
          folderId={folderId}
        />
      </section>
    </div>
  );
}
