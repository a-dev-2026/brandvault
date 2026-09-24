import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '@/server/auth';

export default async function UnauthenticatedAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      redirect('/');
    }
  }

  return <>{children}</>;
}
