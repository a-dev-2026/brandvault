'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sparkles,
  RefreshCw,
  ImageOff,
  AlertCircle,
  Save,
  CheckCircle2,
  Building2,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';

export interface BrandData {
  id: string;
  workspaceId: string;
  name: string;
  primaryColor: string;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  defaultFont?: string | null;
  tagline?: string | null;
  guidelines?: string | null;
}

export interface AssetItem {
  id: string;
  name: string;
  type: string;
  url: string;
}

export interface AssetsResponse {
  items: AssetItem[];
  nextCursor: string | null;
}

const hexRegex = /^#([0-9a-fA-F]{6})$/;

const brandFormSchema = z.object({
  name: z.string().trim().min(1, 'Brand name is required').max(80, 'Brand name must be at most 80 characters'),
  primaryColor: z
    .string()
    .trim()
    .regex(hexRegex, 'Primary color must be a valid 6-character hex code (e.g. #4F46E5)'),
  secondaryColor: z
    .string()
    .trim()
    .refine((val) => val === '' || hexRegex.test(val), {
      message: 'Secondary color must be a valid 6-character hex code (e.g. #10B981)',
    })
    .optional(),
  logoUrl: z
    .string()
    .trim()
    .refine((val) => val === '' || (val.startsWith('https://') && z.string().url().safeParse(val).success), {
      message: 'Logo URL must be a valid HTTPS URL (starting with https://)',
    })
    .optional(),
  defaultFont: z.string().trim().max(60, 'Font name must be at most 60 characters').optional(),
});

type BrandFormValues = z.infer<typeof brandFormSchema>;

const PRESET_FONTS = ['Inter', 'Roboto', 'Geist', 'Playfair Display', 'Outfit', 'Plus Jakarta Sans'];

export default function BrandKitPage() {
  const queryClient = useQueryClient();
  const [logoError, setLogoError] = useState(false);

  // 1. Fetch Brand Data
  const {
    data: brand,
    isLoading: isBrandLoading,
    isError,
    error,
    refetch,
  } = useQuery<BrandData, ApiClientError>({
    queryKey: ['brand'],
    queryFn: () => apiClient.get<BrandData>('/api/brand'),
    retry: (failureCount, err) => {
      if (err.status === 404) return false;
      return failureCount < 2;
    },
  });

  // 2. Fetch Workspace Assets to filter type = FONT
  const { data: assetsData, isLoading: isAssetsLoading } = useQuery<AssetsResponse, ApiClientError>({
    queryKey: ['assets-font-selection'],
    queryFn: () => apiClient.get<AssetsResponse>('/api/assets'),
  });

  const fontAssets = assetsData?.items?.filter((asset) => asset.type === 'FONT') || [];

  const isNotFound = isError && error?.status === 404;
  const isActualError = isError && !isNotFound;
  const isLoading = isBrandLoading || isAssetsLoading;

  // 3. React Hook Form Setup
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      name: '',
      primaryColor: '#4F46E5',
      secondaryColor: '#10B981',
      logoUrl: '',
      defaultFont: 'Inter',
    },
  });

  // Prefill form when brand data is loaded
  useEffect(() => {
    if (brand) {
      reset({
        name: brand.name,
        primaryColor: brand.primaryColor || '#4F46E5',
        secondaryColor: brand.secondaryColor || '#10B981',
        logoUrl: brand.logoUrl || '',
        defaultFont: brand.defaultFont || 'Inter',
      });
      setLogoError(false);
    }
  }, [brand, reset]);

  // Watched values for Live Preview
  const watchedName = watch('name');
  const watchedPrimary = watch('primaryColor');
  const watchedSecondary = watch('secondaryColor');
  const watchedLogoUrl = watch('logoUrl');
  const watchedFont = watch('defaultFont');

  // Reset logo error when logoUrl changes
  useEffect(() => {
    setLogoError(false);
  }, [watchedLogoUrl]);

  // 4. Create & Update Mutations
  const createMutation = useMutation({
    mutationFn: (values: BrandFormValues) => apiClient.post<BrandData>('/api/brand', values),
    onSuccess: (data) => {
      queryClient.setQueryData(['brand'], data);
      toast.success('Brand kit created successfully!');
    },
    onError: (err: ApiClientError) => {
      handleApiError(err);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: BrandFormValues) => apiClient.patch<BrandData>('/api/brand', values),
    onSuccess: (data) => {
      queryClient.setQueryData(['brand'], data);
      toast.success('Brand kit updated successfully!');
    },
    onError: (err: ApiClientError) => {
      handleApiError(err);
    },
  });

  const handleApiError = (err: ApiClientError) => {
    if (Array.isArray(err.details)) {
      err.details.forEach((detail: { field: string; message: string }) => {
        if (detail.field) {
          setError(detail.field as any, { message: detail.message });
        }
      });
    }
    toast.error(err.message || 'Failed to save brand kit');
  };

  const onSubmit = (values: BrandFormValues) => {
    const payload = {
      name: values.name,
      primaryColor: values.primaryColor.toUpperCase(),
      secondaryColor: values.secondaryColor ? values.secondaryColor.toUpperCase() : null,
      logoUrl: values.logoUrl || null,
      defaultFont: values.defaultFont || null,
    };

    if (isNotFound) {
      createMutation.mutate(payload as any);
    } else {
      updateMutation.mutate(payload as any);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Safe color formatters for live preview styles
  const validPrimary = hexRegex.test(watchedPrimary) ? watchedPrimary : '#4F46E5';
  const validSecondary =
    watchedSecondary && hexRegex.test(watchedSecondary) ? watchedSecondary : '#10B981';

  // ----------------------------------------------------
  // RENDER STATES
  // ----------------------------------------------------

  // A. Skeleton Loading State
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <Skeleton className="h-6 w-36 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Card className="lg:col-span-5">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // B. Error State with Retry
  if (isActualError) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Failed to load brand kit</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error?.message || 'An unexpected error occurred while fetching brand data.'}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight">Brand Kit</h1>
            {isNotFound ? (
              <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                Not Created Yet
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Active
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isNotFound
              ? 'Create your workspace brand kit to organize logo assets and color identity.'
              : 'Customize and manage your workspace brand colors, typography, and logo.'}
          </p>
        </div>
      </div>

      {/* Main Grid: Form + Live Preview */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Form Panel */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Building2 className="mr-2 h-5 w-5 text-primary" />
              {isNotFound ? 'Create Your Brand Kit' : 'Edit Brand Identity'}
            </CardTitle>
            <CardDescription>
              {isNotFound
                ? 'Fill out the initial details to configure your brand kit.'
                : 'Update your colors, logo URL, or default font family.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {/* Brand Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Brand Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Acme Studio"
                  disabled={isSaving}
                  {...register('name')}
                  className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.name && <p className="text-xs font-medium text-destructive">{errors.name.message}</p>}
              </div>

              {/* Primary Color Picker + Hex Input */}
              <div className="space-y-1.5">
                <Label htmlFor="primaryColor">Primary Color *</Label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    id="primaryColorPicker"
                    value={validPrimary}
                    onChange={(e) =>
                      setValue('primaryColor', e.target.value.toUpperCase(), {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    className="h-9 w-12 cursor-pointer rounded-md border p-1 bg-transparent"
                    disabled={isSaving}
                  />
                  <Input
                    id="primaryColor"
                    placeholder="#4F46E5"
                    disabled={isSaving}
                    {...register('primaryColor')}
                    className={`font-mono ${errors.primaryColor ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  />
                </div>
                {errors.primaryColor && (
                  <p className="text-xs font-medium text-destructive">{errors.primaryColor.message}</p>
                )}
              </div>

              {/* Secondary Color Picker + Hex Input */}
              <div className="space-y-1.5">
                <Label htmlFor="secondaryColor">Secondary Color (Optional)</Label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    id="secondaryColorPicker"
                    value={validSecondary}
                    onChange={(e) =>
                      setValue('secondaryColor', e.target.value.toUpperCase(), {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    className="h-9 w-12 cursor-pointer rounded-md border p-1 bg-transparent"
                    disabled={isSaving}
                  />
                  <Input
                    id="secondaryColor"
                    placeholder="#10B981"
                    disabled={isSaving}
                    {...register('secondaryColor')}
                    className={`font-mono ${errors.secondaryColor ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  />
                </div>
                {errors.secondaryColor && (
                  <p className="text-xs font-medium text-destructive">{errors.secondaryColor.message}</p>
                )}
              </div>

              {/* Logo URL */}
              <div className="space-y-1.5">
                <Label htmlFor="logoUrl">Logo URL (Optional)</Label>
                <Input
                  id="logoUrl"
                  placeholder="https://example.com/logo.png"
                  disabled={isSaving}
                  {...register('logoUrl')}
                  className={errors.logoUrl ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.logoUrl && <p className="text-xs font-medium text-destructive">{errors.logoUrl.message}</p>}
              </div>

              {/* Default Font Select (chosen from workspace FONT assets or presets) */}
              <div className="space-y-1.5">
                <Label htmlFor="defaultFont">Default Font Family</Label>
                <Select
                  value={watchedFont || 'Inter'}
                  onValueChange={(val) => setValue('defaultFont', val, { shouldValidate: true, shouldDirty: true })}
                  disabled={isSaving}
                >
                  <SelectTrigger id="defaultFont">
                    <SelectValue placeholder="Select a font" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Section 1: Uploaded Workspace Font Assets */}
                    {fontAssets.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="flex items-center text-xs text-primary font-bold">
                          <Type className="mr-1 h-3.5 w-3.5" /> Workspace Font Assets
                        </SelectLabel>
                        {fontAssets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.name}>
                            {asset.name} (Asset)
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}

                    {/* Section 2: Standard Presets */}
                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground font-semibold">
                        System Presets
                      </SelectLabel>
                      {PRESET_FONTS.map((font) => (
                        <SelectItem key={font} value={font}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fontAssets.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tip: Upload FONT assets in your Library to see custom brand fonts here.
                  </p>
                )}
                {errors.defaultFont && (
                  <p className="text-xs font-medium text-destructive">{errors.defaultFont.message}</p>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isNotFound ? 'Create Brand Kit' : 'Save Changes'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right Live Preview Panel */}
        <Card className="lg:col-span-5 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Sparkles className="mr-2 h-5 w-5 text-indigo-500" />
              Live Brand Preview
            </CardTitle>
            <CardDescription>
              See how your brand colors, logo, and typography look together.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            {/* Brand Logo & Title Box */}
            <div className="flex items-center space-x-4 rounded-xl border bg-muted/30 p-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background shadow-sm">
                {watchedLogoUrl && !logoError ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={watchedLogoUrl}
                    alt={watchedName || 'Brand Logo'}
                    className="h-full w-full object-contain p-1"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                    <span className="text-[10px]">No Logo</span>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold tracking-tight">
                  {watchedName || 'Brand Name'}
                </h3>
                <p className="text-xs text-muted-foreground">Brand Vault Identity</p>
              </div>
            </div>

            {/* Color Swatches */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Color Palette
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Primary Swatch */}
                <div className="flex flex-col rounded-lg border overflow-hidden shadow-sm">
                  <div className="h-16 w-full" style={{ backgroundColor: validPrimary }} />
                  <div className="bg-card p-2 text-center">
                    <p className="text-xs font-semibold">Primary</p>
                    <p className="text-xs font-mono text-muted-foreground">{validPrimary}</p>
                  </div>
                </div>

                {/* Secondary Swatch */}
                <div className="flex flex-col rounded-lg border overflow-hidden shadow-sm">
                  <div className="h-16 w-full" style={{ backgroundColor: validSecondary }} />
                  <div className="bg-card p-2 text-center">
                    <p className="text-xs font-semibold">Secondary</p>
                    <p className="text-xs font-mono text-muted-foreground">{validSecondary}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Typography Sample Line */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Typography Sample
                </Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {watchedFont || 'System Default'}
                </span>
              </div>
              <div className="rounded-lg border bg-background p-4 shadow-sm">
                <p
                  className="text-base font-medium leading-relaxed"
                  style={{ fontFamily: watchedFont ? `"${watchedFont}", sans-serif` : 'inherit' }}
                >
                  The quick brown fox jumps over the lazy dog.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
