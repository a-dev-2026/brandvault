import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '@/server/auth';
import { db } from '@/lib/db';
import { AppLayoutShell } from '@/components/layout/app-layout-shell';

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    redirect('/login');
  }

  const session = await verifySessionToken(token);
  if (!session) {
    redirect('/login');
  }

  const workspace = await db.workspace.findUnique({
    where: { id: session.workspaceId },
    select: { name: true },
  });

  const workspaceName = workspace?.name || 'Main';

  return (
    <AppLayoutShell user={{ ...session, workspaceName }}>
      {children}
    </AppLayoutShell>
  );
}