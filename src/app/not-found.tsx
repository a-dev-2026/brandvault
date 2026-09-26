import Link from 'next/link';
import { ShieldAlert, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight">404 - Page Not Found</h1>
      <p className="mt-2 text-base text-muted-foreground max-w-md">
        The page or resource you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Button asChild size="lg">
          <Link href="/">
            <Home className="mr-2 h-5 w-5" />
            Return to Library
          </Link>
        </Button>
      </div>
    </div>
  );
}
