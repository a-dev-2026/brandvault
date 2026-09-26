'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, LogIn, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      await apiClient.post('/api/auth/login', values);
      toast.success('Signed in successfully');
      router.push('/library');
      router.refresh();
    } catch (err: any) {
      const msg = err.message || 'Invalid email or password';
      setServerError(msg);
      toast.error(msg);
    }
  };

  const handleDemoLogin = async () => {
    setServerError(null);
    setIsDemoLoading(true);
    try {
      await apiClient.post('/api/auth/demo');
      toast.success('Logged in as Demo User');
      router.push('/library');
      router.refresh();
    } catch (err: any) {
      const msg = err.message || 'Demo login failed';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const isPending = isSubmitting || isDemoLoading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Sign in to BrandVault</CardTitle>
          <CardDescription>
            Access your brand asset workspace
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Server Error Alert */}
          {serverError && (
            <div className="flex items-center space-x-2 rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive border border-destructive/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Prominent Demo Button */}
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md transition-all"
              onClick={handleDemoLogin}
              disabled={isPending}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {isDemoLoading ? 'Preparing Demo Workspace...' : 'Continue as Demo User'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Demo Credentials: <span className="font-mono font-medium text-foreground">brandvault@ignitebh.com</span> / <span className="font-mono font-medium text-foreground">Password123!</span>
            </p>
          </div>

          <div className="relative flex items-center justify-center text-xs uppercase text-muted-foreground my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <span className="relative bg-card px-2">Or sign in with email</span>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                disabled={isPending}
                {...register('email')}
                className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.email && (
                <p className="text-xs font-medium text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                disabled={isPending}
                {...register('password')}
                className={errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.password && (
                <p className="text-xs font-medium text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
              <LogIn className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t py-4 text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="ml-1 font-semibold text-primary underline-offset-4 hover:underline">
            Sign up
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
