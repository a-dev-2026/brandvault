'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Folder,
  FolderPlus,
  Search,
  ArrowUpDown,
  ChevronRight,
  Home,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Type as FontIcon,
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  Plus,
  Tag,
  Calendar,
  ExternalLink,
  MoreVertical,
  Edit,
  FolderInput,
  Trash2,
  X,
  Sparkles,
  Info,
  Check,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';

// Types
export interface FolderItem {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FolderDetails extends FolderItem {
  breadcrumbs: Array<{ id: string; name: string }>;
}

export interface AssetItem {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  url: string;
  folderId?: string | null;
  size: number;
  mimeType: string;
  tags: string[];
  aiTags: string[];
  description?: string | null;
  usageSuggestion?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  folder?: {
    id: string;
    name: string;
  } | null;
}

export interface AssetsResponse {
  items: AssetItem[];
  nextCursor: string | null;
}

export interface AiSuggestionResponse {
  tags: string[];
  description: string;
  usage_suggestion: string;
}

const ASSET_TYPES = ['LOGO', 'ICON', 'BANNER', 'FONT', 'VIDEO', 'DOCUMENT', 'OTHER'] as const;

// Schemas
const newFolderSchema = z.object({
  name: z.string().trim().min(1, 'Folder name is required').max(60, 'Folder name must be at most 60 characters'),
});

const assetSchema = z.object({
  name: z.string().trim().min(1, 'Asset name is required').max(120, 'Name must be at most 120 characters'),
  type: z.enum(ASSET_TYPES, { message: 'Please select a valid asset type' }),
  url: z
    .string()
    .trim()
    .min(1, 'URL is required')
    .url('Must be a valid URL')
    .refine((val) => val.startsWith('https://'), 'URL must start with https://'),
  folderId: z.string().nullable().optional(),
});

type NewFolderFormValues = z.infer<typeof newFolderSchema>;
type AssetFormValues = z.infer<typeof assetSchema>;

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const currentFolderId = searchParams.get('folder') || '';
  const urlQuery = searchParams.get('q') || '';
  const currentSort = searchParams.get('sort') || 'updated_desc';

  // Local search state for 300ms debouncing
  const [searchTerm, setSearchTerm] = useState(urlQuery);

  useEffect(() => {
    setSearchTerm(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== urlQuery) {
        const params = new URLSearchParams(searchParams.toString());
        const trimmed = searchTerm.trim();
        if (!trimmed) {
          params.delete('q');
        } else {
          params.set('q', trimmed);
        }
        router.push(`/?${params.toString()}`);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, urlQuery, searchParams, router]);

  // Modal Dialog States
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [folderServerError, setFolderServerError] = useState<string | null>(null);

  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [assetServerError, setAssetServerError] = useState<string | null>(null);

  const [movingAsset, setMovingAsset] = useState<AssetItem | null>(null);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string>('root');

  // Asset Detail Modal State
  const [viewingAssetDetail, setViewingAssetDetail] = useState<AssetItem | null>(null);

  // AI Tagging Dialog States
  const [aiTaggingAsset, setAiTaggingAsset] = useState<AssetItem | null>(null);
  const [editableAiTags, setEditableAiTags] = useState<string[]>([]);
  const [editableDescription, setEditableDescription] = useState<string>('');
  const [editableUsage, setEditableUsage] = useState<string>('');
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [aiError, setAiError] = useState<{ status?: number; code?: string; message: string } | null>(null);

  // Track failed image URLs
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/?${params.toString()}`);
  };

  const clearSearch = () => {
    setSearchTerm('');
    updateParams({ q: null });
  };

  // 1. Fetch Current Folder Details & Breadcrumbs
  const {
    data: folderDetails,
    isLoading: isFolderDetailsLoading,
    isError: isFolderDetailsError,
    refetch: refetchFolderDetails,
  } = useQuery<FolderDetails, ApiClientError>({
    queryKey: ['folder', currentFolderId],
    queryFn: () => apiClient.get<FolderDetails>(`/api/folders/${currentFolderId}`),
    enabled: Boolean(currentFolderId),
  });

  // 2. Fetch Subfolders in Current Folder
  const parentIdParam = currentFolderId || 'root';
  const {
    data: folders = [],
    isLoading: isFoldersLoading,
    isError: isFoldersError,
    refetch: refetchFolders,
  } = useQuery<FolderItem[], ApiClientError>({
    queryKey: ['folders', parentIdParam],
    queryFn: () => apiClient.get<FolderItem[]>(`/api/folders?parentId=${parentIdParam}`),
    enabled: !urlQuery,
  });

  // 3. Fetch All Workspace Folders
  const { data: allFolders = [] } = useQuery<FolderItem[], ApiClientError>({
    queryKey: ['all-folders'],
    queryFn: () => apiClient.get<FolderItem[]>('/api/folders'),
  });

  // 4. Fetch Assets
  const folderIdParam = currentFolderId || 'root';
  const assetsQueryKey = ['assets', folderIdParam, urlQuery, currentSort];
  const {
    data: assetsData,
    isLoading: isAssetsLoading,
    isError: isAssetsError,
    refetch: refetchAssets,
  } = useQuery<AssetsResponse, ApiClientError>({
    queryKey: assetsQueryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (urlQuery) {
        params.set('q', urlQuery);
      } else if (currentFolderId) {
        params.set('folderId', currentFolderId);
      } else {
        params.set('folderId', 'root');
      }
      if (currentSort) params.set('sort', currentSort);

      return apiClient.get<AssetsResponse>(`/api/assets?${params.toString()}`);
    },
  });

  // 5. Create Folder Form Setup
  const {
    register: registerFolder,
    handleSubmit: handleSubmitFolder,
    reset: resetFolderForm,
    setError: setFolderError,
    formState: { errors: folderFormErrors, isSubmitting: isCreatingFolder },
  } = useForm<NewFolderFormValues>({
    resolver: zodResolver(newFolderSchema),
    defaultValues: { name: '' },
  });

  const createFolderMutation = useMutation({
    mutationFn: (values: NewFolderFormValues) =>
      apiClient.post<FolderItem>('/api/folders', {
        name: values.name,
        parentId: currentFolderId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['all-folders'] });
      toast.success('Folder created successfully!');
      setIsNewFolderOpen(false);
      resetFolderForm();
      setFolderServerError(null);
    },
    onError: (err: ApiClientError) => {
      const msg = err.message || 'Failed to create folder';
      setFolderServerError(msg);
      if (err.code === 'MAX_DEPTH') {
        setFolderError('name', { message: 'Folder depth cannot exceed 3 levels' });
      } else if (err.code === 'CONFLICT' || err.status === 409) {
        setFolderError('name', { message: 'A folder with this name already exists in this directory' });
      }
    },
  });

  const onCreateFolderSubmit = (values: NewFolderFormValues) => {
    setFolderServerError(null);
    createFolderMutation.mutate(values);
  };

  // 6. Asset Form Setup (Add & Edit)
  const {
    register: registerAsset,
    handleSubmit: handleSubmitAsset,
    reset: resetAssetForm,
    setValue: setAssetValue,
    setError: setAssetError,
    watch: watchAsset,
    formState: { errors: assetFormErrors, isSubmitting: isSavingAsset },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: '',
      type: 'LOGO',
      url: '',
      folderId: currentFolderId || 'root',
    },
  });

  const selectedAssetType = watchAsset('type');
  const selectedAssetFolderId = watchAsset('folderId');

  useEffect(() => {
    if (editingAsset) {
      resetAssetForm({
        name: editingAsset.name,
        type: editingAsset.type as any,
        url: editingAsset.url,
        folderId: editingAsset.folderId || 'root',
      });
    } else {
      resetAssetForm({
        name: '',
        type: 'LOGO',
        url: '',
        folderId: currentFolderId || 'root',
      });
    }
  }, [editingAsset, currentFolderId, resetAssetForm]);

  const addAssetMutation = useMutation({
    mutationFn: (values: AssetFormValues) =>
      apiClient.post<AssetItem>('/api/assets', {
        name: values.name,
        type: values.type,
        url: values.url,
        folderId: values.folderId === 'root' ? null : values.folderId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset added successfully!');
      setIsAssetDialogOpen(false);
      resetAssetForm();
      setAssetServerError(null);
    },
    onError: (err: ApiClientError) => {
      handleAssetApiError(err);
    },
  });

  const editAssetMutation = useMutation({
    mutationFn: (values: AssetFormValues) => {
      if (!editingAsset) throw new Error('No asset selected');
      return apiClient.patch<AssetItem>(`/api/assets/${editingAsset.id}`, {
        name: values.name,
        type: values.type,
        url: values.url,
        folderId: values.folderId === 'root' ? null : values.folderId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset updated successfully!');
      setIsAssetDialogOpen(false);
      setEditingAsset(null);
      resetAssetForm();
      setAssetServerError(null);
    },
    onError: (err: ApiClientError) => {
      handleAssetApiError(err);
    },
  });

  const handleAssetApiError = (err: ApiClientError) => {
    const msg = err.message || 'Failed to save asset';
    setAssetServerError(msg);
    if (Array.isArray(err.details)) {
      err.details.forEach((detail: { field: string; message: string }) => {
        if (detail.field) {
          setAssetError(detail.field as any, { message: detail.message });
        }
      });
    }
  };

  const onAssetSubmit = (values: AssetFormValues) => {
    setAssetServerError(null);
    if (editingAsset) {
      editAssetMutation.mutate(values);
    } else {
      addAssetMutation.mutate(values);
    }
  };

  // 7. Move Asset to Folder Mutation
  const moveAssetMutation = useMutation({
    mutationFn: ({ assetId, targetFolderId }: { assetId: string; targetFolderId: string }) =>
      apiClient.patch<AssetItem>(`/api/assets/${assetId}`, {
        folderId: targetFolderId === 'root' ? null : targetFolderId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset moved successfully!');
      setMovingAsset(null);
    },
    onError: (err: ApiClientError) => {
      toast.error(err.message || 'Failed to move asset');
    },
  });

  // 8. Optimistic Trash & Interactive Undo Toast
  const restoreAssetMutation = useMutation({
    mutationFn: (assetId: string) => apiClient.post(`/api/assets/${assetId}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset restored!');
    },
    onError: (err: ApiClientError) => {
      toast.error(err.message || 'Failed to restore asset');
    },
  });

  const trashAssetMutation = useMutation({
    mutationFn: (assetId: string) => apiClient.post(`/api/assets/${assetId}/trash`),
    onMutate: async (assetId: string) => {
      await queryClient.cancelQueries({ queryKey: assetsQueryKey });
      const previousAssetsData = queryClient.getQueryData<AssetsResponse>(assetsQueryKey);

      if (previousAssetsData) {
        queryClient.setQueryData<AssetsResponse>(assetsQueryKey, {
          ...previousAssetsData,
          items: previousAssetsData.items.filter((item) => item.id !== assetId),
        });
      }

      return { previousAssetsData };
    },
    onError: (err: ApiClientError, _assetId, context) => {
      if (context?.previousAssetsData) {
        queryClient.setQueryData(assetsQueryKey, context.previousAssetsData);
      }
      toast.error(err.message || 'Failed to move asset to trash');
    },
    onSuccess: (_data, assetId) => {
      toast('Asset moved to trash', {
        action: {
          label: 'Undo',
          onClick: () => restoreAssetMutation.mutate(assetId),
        },
      });
    },
  });

  // 9. AI Tag Generation & Saving Mutations
  const generateAiTagsMutation = useMutation({
    mutationFn: (assetId: string) =>
      apiClient.post<AiSuggestionResponse>(`/api/assets/${assetId}/ai-tags`),
    onSuccess: (data) => {
      setEditableAiTags(data.tags || []);
      setEditableDescription(data.description || '');
      setEditableUsage(data.usage_suggestion || '');
      setAiError(null);
    },
    onError: (err: ApiClientError) => {
      if (err.status === 502 || err.code === 'AI_UNAVAILABLE' || err.code === 'AI_INVALID_RESPONSE') {
        setAiError({
          status: 502,
          code: err.code,
          message: 'AI service is temporarily unavailable',
        });
      } else if (err.status === 429 || err.code === 'RATE_LIMIT_EXCEEDED') {
        setAiError({
          status: 429,
          code: err.code,
          message: 'Too many requests, try again shortly',
        });
      } else {
        setAiError({
          status: err.status || 400,
          code: err.code,
          message: err.message || 'Failed to generate AI tags',
        });
      }
    },
  });

  const saveAiTagsMutation = useMutation({
    mutationFn: ({
      assetId,
      payload,
    }: {
      assetId: string;
      payload: { tags: string[]; description?: string | null; usage_suggestion?: string | null };
    }) => apiClient.patch<AssetItem>(`/api/assets/${assetId}/ai-tags/save`, payload),
    onSuccess: (updatedAsset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      if (viewingAssetDetail && viewingAssetDetail.id === updatedAsset.id) {
        setViewingAssetDetail(updatedAsset);
      }
      toast.success('AI tags and metadata saved!');
      setAiTaggingAsset(null);
    },
    onError: (err: ApiClientError) => {
      toast.error(err.message || 'Failed to save AI metadata');
    },
  });

  const handleStartAiTagging = (asset: AssetItem) => {
    setAiTaggingAsset(asset);
    setAiError(null);
    setEditableAiTags([]);
    setEditableDescription('');
    setEditableUsage('');
    generateAiTagsMutation.mutate(asset.id);
  };

  const handleAddCustomTag = () => {
    const trimmed = newTagInput.trim().toLowerCase();
    if (trimmed && !editableAiTags.includes(trimmed)) {
      setEditableAiTags([...editableAiTags, trimmed]);
      setNewTagInput('');
    }
  };

  const handleRemoveAiTag = (tagToRemove: string) => {
    setEditableAiTags(editableAiTags.filter((t) => t !== tagToRemove));
  };

  const isGlobalLoading = isFolderDetailsLoading || isFoldersLoading || isAssetsLoading;
  const isGlobalError = isFolderDetailsError || isFoldersError || isAssetsError;

  const handleRetryAll = () => {
    if (currentFolderId) refetchFolderDetails();
    refetchFolders();
    refetchAssets();
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'LOGO':
      case 'ICON':
      case 'BANNER':
        return <ImageIcon className="h-4 w-4 text-indigo-500" />;
      case 'FONT':
        return <FontIcon className="h-4 w-4 text-emerald-500" />;
      case 'VIDEO':
        return <VideoIcon className="h-4 w-4 text-rose-500" />;
      default:
        return <FileText className="h-4 w-4 text-amber-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Toolbar */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asset Library</h1>
          <p className="text-sm text-muted-foreground">
            Manage your workspace brand assets, images, fonts, and subfolders.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* New Folder Dialog */}
          <Dialog
            open={isNewFolderOpen}
            onOpenChange={(open) => {
              setIsNewFolderOpen(open);
              if (!open) {
                resetFolderForm();
                setFolderServerError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogDescription>
                  {currentFolderId
                    ? `Create a subfolder inside "${folderDetails?.name || 'current folder'}".`
                    : 'Create a new top-level folder in your library.'}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmitFolder(onCreateFolderSubmit)} className="space-y-4 pt-2">
                {folderServerError && (
                  <div className="flex items-center space-x-2 rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive border border-destructive/20">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{folderServerError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="folderName">Folder Name</Label>
                  <Input
                    id="folderName"
                    placeholder="e.g. Social Media Assets"
                    disabled={isCreatingFolder}
                    {...registerFolder('name')}
                    className={folderFormErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {folderFormErrors.name && (
                    <p className="text-xs font-medium text-destructive">
                      {folderFormErrors.name.message}
                    </p>
                  )}
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsNewFolderOpen(false)}
                    disabled={isCreatingFolder}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreatingFolder}>
                    {isCreatingFolder ? 'Creating...' : 'Create Folder'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Add / Edit Asset Dialog */}
          <Button
            size="sm"
            onClick={() => {
              setEditingAsset(null);
              setAssetServerError(null);
              setIsAssetDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Shared Add / Edit Asset Dialog Modal */}
      <Dialog
        open={isAssetDialogOpen}
        onOpenChange={(open) => {
          setIsAssetDialogOpen(open);
          if (!open) {
            setEditingAsset(null);
            resetAssetForm();
            setAssetServerError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
            <DialogDescription>
              {editingAsset
                ? 'Update asset details, type, or parent folder.'
                : 'Upload or register a new brand asset URL in your workspace.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitAsset(onAssetSubmit)} className="space-y-4 pt-2" noValidate>
            {assetServerError && (
              <div className="flex items-center space-x-2 rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive border border-destructive/20">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{assetServerError}</span>
              </div>
            )}

            {/* Asset Name */}
            <div className="space-y-1.5">
              <Label htmlFor="assetName">Asset Name *</Label>
              <Input
                id="assetName"
                placeholder="e.g. Primary Logo Vector"
                disabled={isSavingAsset}
                {...registerAsset('name')}
                className={assetFormErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {assetFormErrors.name && (
                <p className="text-xs font-medium text-destructive">{assetFormErrors.name.message}</p>
              )}
            </div>

            {/* Asset Type Select */}
            <div className="space-y-1.5">
              <Label htmlFor="assetType">Asset Type *</Label>
              <Select
                value={selectedAssetType}
                onValueChange={(val) => setAssetValue('type', val as any, { shouldValidate: true })}
                disabled={isSavingAsset}
              >
                <SelectTrigger id="assetType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assetFormErrors.type && (
                <p className="text-xs font-medium text-destructive">{assetFormErrors.type.message}</p>
              )}
            </div>

            {/* Asset URL */}
            <div className="space-y-1.5">
              <Label htmlFor="assetUrl">Asset URL (HTTPS) *</Label>
              <Input
                id="assetUrl"
                placeholder="https://example.com/assets/logo.svg"
                disabled={isSavingAsset}
                {...registerAsset('url')}
                className={assetFormErrors.url ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {assetFormErrors.url && (
                <p className="text-xs font-medium text-destructive">{assetFormErrors.url.message}</p>
              )}
            </div>

            {/* Folder Select */}
            <div className="space-y-1.5">
              <Label htmlFor="assetFolder">Folder</Label>
              <Select
                value={selectedAssetFolderId || 'root'}
                onValueChange={(val) => setAssetValue('folderId', val, { shouldValidate: true })}
                disabled={isSavingAsset}
              >
                <SelectTrigger id="assetFolder">
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Root Directory</SelectItem>
                  {allFolders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssetDialogOpen(false)}
                disabled={isSavingAsset}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingAsset}>
                {isSavingAsset ? 'Saving...' : editingAsset ? 'Save Changes' : 'Add Asset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move to Folder Dialog Modal */}
      <Dialog
        open={Boolean(movingAsset)}
        onOpenChange={(open) => {
          if (!open) setMovingAsset(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Asset to Folder</DialogTitle>
            <DialogDescription>
              Select a target folder for &quot;{movingAsset?.name}&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="targetFolder">Destination Folder</Label>
              <Select
                value={targetMoveFolderId}
                onValueChange={(val) => setTargetMoveFolderId(val)}
                disabled={moveAssetMutation.isPending}
              >
                <SelectTrigger id="targetFolder">
                  <SelectValue placeholder="Select destination folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Root Directory</SelectItem>
                  {allFolders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMovingAsset(null)}
                disabled={moveAssetMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (movingAsset) {
                    moveAssetMutation.mutate({
                      assetId: movingAsset.id,
                      targetFolderId: targetMoveFolderId,
                    });
                  }
                }}
                disabled={moveAssetMutation.isPending}
              >
                {moveAssetMutation.isPending ? 'Moving...' : 'Move Asset'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Asset Detail View Modal Dialog */}
      <Dialog
        open={Boolean(viewingAssetDetail)}
        onOpenChange={(open) => {
          if (!open) setViewingAssetDetail(null);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate pr-4">{viewingAssetDetail?.name}</span>
              <Badge variant="outline" className="font-mono text-xs uppercase">
                {viewingAssetDetail?.type}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Folder: {viewingAssetDetail?.folder ? viewingAssetDetail.folder.name : 'Root Directory'}
            </DialogDescription>
          </DialogHeader>

          {viewingAssetDetail && (
            <div className="space-y-6 pt-2">
              {/* Asset Preview */}
              <div className="flex h-48 w-full items-center justify-center rounded-lg border bg-muted/30 overflow-hidden">
                {viewingAssetDetail.mimeType.startsWith('image/') ||
                ['LOGO', 'ICON', 'BANNER'].includes(viewingAssetDetail.type) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={viewingAssetDetail.url}
                    alt={viewingAssetDetail.name}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    {getAssetTypeIcon(viewingAssetDetail.type)}
                    <span className="mt-2 text-sm uppercase font-mono">{viewingAssetDetail.type}</span>
                  </div>
                )}
              </div>

              {/* Tags Section */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tags
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {/* User Tags */}
                  {viewingAssetDetail.tags?.map((tag, idx) => (
                    <Badge key={`user-${idx}`} variant="secondary" className="text-xs">
                      <Tag className="mr-1 h-3 w-3 opacity-60" />
                      {tag}
                    </Badge>
                  ))}
                  {/* AI Tags */}
                  {viewingAssetDetail.aiTags?.map((tag, idx) => (
                    <Badge
                      key={`ai-${idx}`}
                      variant="secondary"
                      className="bg-purple-500/15 text-purple-700 dark:text-purple-300 text-xs border-purple-500/20"
                    >
                      <Sparkles className="mr-1 h-3 w-3 text-purple-500" />
                      {tag}
                    </Badge>
                  ))}
                  {(!viewingAssetDetail.tags || viewingAssetDetail.tags.length === 0) &&
                    (!viewingAssetDetail.aiTags || viewingAssetDetail.aiTags.length === 0) && (
                      <p className="text-xs text-muted-foreground">No tags attached yet.</p>
                    )}
                </div>
              </div>

              {/* Description Section */}
              {viewingAssetDetail.description && (
                <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    AI Description
                  </Label>
                  <p className="text-sm leading-relaxed">{viewingAssetDetail.description}</p>
                </div>
              )}

              {/* Usage Suggestion Section */}
              {viewingAssetDetail.usageSuggestion && (
                <div className="space-y-1.5 rounded-lg border bg-indigo-500/5 border-indigo-500/20 p-3">
                  <Label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Usage Suggestion
                  </Label>
                  <p className="text-sm text-foreground leading-relaxed">
                    {viewingAssetDetail.usageSuggestion}
                  </p>
                </div>
              )}

              {/* Asset URL & Metadata */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>Updated: {formatDate(viewingAssetDetail.updatedAt)}</span>
                <a
                  href={viewingAssetDetail.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center text-primary font-medium hover:underline"
                  aria-label="Open original asset file in new tab"
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  View Original File
                </a>
              </div>

              <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentAsset = viewingAssetDetail;
                    setViewingAssetDetail(null);
                    handleStartAiTagging(currentAsset);
                  }}
                  className="text-purple-600 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Generate AI Tags
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingAssetDetail(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Tagging Engine Dialog Modal */}
      <Dialog
        open={Boolean(aiTaggingAsset)}
        onOpenChange={(open) => {
          if (!open) {
            setAiTaggingAsset(null);
            setAiError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-purple-600" />
              AI Asset Metadata Review
            </DialogTitle>
            <DialogDescription>
              AI Suggestions for &quot;<span className="font-semibold">{aiTaggingAsset?.name}</span>&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* 1. Loading State */}
            {generateAiTagsMutation.isPending && (
              <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-sm font-medium text-foreground">Analyzing asset details...</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Extracting context from asset name, type, brand guidelines, and folder location.
                </p>
              </div>
            )}

            {/* 2. Error State */}
            {!generateAiTagsMutation.isPending && aiError && (
              <div className="space-y-4 py-4">
                <div className="flex items-start space-x-3 rounded-lg border bg-destructive/10 p-4 text-destructive border-destructive/20">
                  <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold">
                      {aiError.status === 429
                        ? 'Rate Limit Reached'
                        : 'AI Generation Failed'}
                    </h4>
                    <p className="mt-1 text-xs">{aiError.message}</p>
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setAiTaggingAsset(null)}
                  >
                    Cancel
                  </Button>
                  {aiError.status !== 429 && aiTaggingAsset && (
                    <Button
                      onClick={() => generateAiTagsMutation.mutate(aiTaggingAsset.id)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry
                    </Button>
                  )}
                </DialogFooter>
              </div>
            )}

            {/* 3. Editable Review Form */}
            {!generateAiTagsMutation.isPending && !aiError && aiTaggingAsset && (
              <div className="space-y-4">
                {/* Disclaimer Note */}
                <div className="flex items-start space-x-2 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground border">
                  <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <span>
                    AI-generated from name, type, URL, folder and brand only. Review before saving.
                  </span>
                </div>

                {/* Editable Tags Chips */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tags ({editableAiTags.length})
                  </Label>
                  <div className="flex flex-wrap gap-1.5 rounded-lg border bg-background p-2.5 min-h-[42px]">
                    {editableAiTags.map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-purple-500/15 text-purple-700 dark:text-purple-300 text-xs flex items-center gap-1 pr-1 border-purple-500/20"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAiTag(tag)}
                          className="rounded-full hover:bg-purple-500/20 p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>

                  {/* Add Tag Input */}
                  <div className="flex items-center space-x-2 pt-1">
                    <Input
                      placeholder="Add custom tag..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomTag();
                        }
                      }}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCustomTag}
                      className="h-8 text-xs"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add
                    </Button>
                  </div>
                </div>

                {/* Editable Description Textarea */}
                <div className="space-y-1.5">
                  <Label htmlFor="aiDesc" className="text-xs font-semibold">
                    Description
                  </Label>
                  <textarea
                    id="aiDesc"
                    rows={3}
                    value={editableDescription}
                    onChange={(e) => setEditableDescription(e.target.value)}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="AI generated asset description..."
                  />
                </div>

                {/* Editable Usage Suggestion Textarea */}
                <div className="space-y-1.5">
                  <Label htmlFor="aiUsage" className="text-xs font-semibold">
                    Usage Suggestion
                  </Label>
                  <textarea
                    id="aiUsage"
                    rows={2}
                    value={editableUsage}
                    onChange={(e) => setEditableUsage(e.target.value)}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="AI generated usage recommendation..."
                  />
                </div>

                {/* Form Buttons */}
                <DialogFooter className="pt-3 flex items-center justify-between sm:justify-between w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => generateAiTagsMutation.mutate(aiTaggingAsset.id)}
                    disabled={saveAiTagsMutation.isPending}
                    className="text-xs text-muted-foreground"
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    Regenerate
                  </Button>

                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAiTaggingAsset(null)}
                      disabled={saveAiTagsMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        saveAiTagsMutation.mutate({
                          assetId: aiTaggingAsset.id,
                          payload: {
                            tags: editableAiTags,
                            description: editableDescription.trim() || null,
                            usage_suggestion: editableUsage.trim() || null,
                          },
                        });
                      }}
                      disabled={saveAiTagsMutation.isPending}
                    >
                      {saveAiTagsMutation.isPending ? (
                        'Saving...'
                      ) : (
                        <>
                          <Check className="mr-1.5 h-3.5 w-3.5" /> Save
                        </>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Breadcrumb Pathing */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm">
        <button
          onClick={() => updateParams({ folder: null })}
          className={`flex items-center space-x-1 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            !currentFolderId ? 'font-semibold text-primary' : 'text-muted-foreground'
          }`}
        >
          <Home className="h-4 w-4" />
          <span>Library</span>
        </button>

        {folderDetails?.breadcrumbs?.map((crumb) => {
          const isCurrent = crumb.id === currentFolderId;
          return (
            <div key={crumb.id} className="flex items-center space-x-1">
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              <button
                onClick={() => updateParams({ folder: crumb.id })}
                className={`truncate max-w-[160px] hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground'
                }`}
              >
                {crumb.name}
              </button>
            </div>
          );
        })}
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search assets across workspace..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-8"
            aria-label="Search workspace assets"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Clear search input"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={currentSort} onValueChange={(val) => updateParams({ sort: val })}>
            <SelectTrigger className="w-[180px]" aria-label="Sort order selection">
              <SelectValue placeholder="Sort order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_desc">Recently Updated</SelectItem>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Search Results Banner */}
      {urlQuery && (
        <div className="flex items-center justify-between rounded-lg border bg-primary/5 px-4 py-2.5">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Results for &quot;<span className="font-semibold text-primary">{urlQuery}</span>&quot; across workspace
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={clearSearch} className="h-7 px-2 text-xs">
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      {/* RENDER CONTENT STATES */}

      {/* 1. Global Loading Skeleton */}
      {isGlobalLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {/* 2. Error State with Retry */}
      {!isGlobalLoading && isGlobalError && (
        <div className="flex flex-col items-center justify-center space-y-4 py-16 text-center border rounded-xl bg-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Failed to load library data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              An error occurred while fetching folders or assets. Please check your connection and retry.
            </p>
          </div>
          <Button onClick={handleRetryAll} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* 3. Normal Data Render */}
      {!isGlobalLoading && !isGlobalError && (
        <div className="space-y-8">
          {/* Subfolders Section */}
          {!urlQuery && folders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Folders ({folders.length})
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => updateParams({ folder: f.id })}
                    className="flex flex-col items-start p-3 text-left rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/50 transition-all shadow-sm group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform mb-2">
                      <Folder className="h-5 w-5 fill-primary/20" />
                    </div>
                    <span className="w-full truncate text-sm font-semibold tracking-tight">
                      {f.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assets Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {urlQuery ? 'Matching Assets' : 'Assets'} ({assetsData?.items.length || 0})
              </h2>
            </div>

            {assetsData?.items && assetsData.items.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {assetsData.items.map((asset) => {
                  const isImageLike =
                    asset.mimeType.startsWith('image/') ||
                    ['LOGO', 'ICON', 'BANNER'].includes(asset.type);
                  const isFailedImage = failedImageUrls[asset.url];
                  const folderName = asset.folder ? asset.folder.name : 'Root';

                  return (
                    <Card key={asset.id} className="overflow-hidden hover:shadow-md transition-shadow group relative flex flex-col justify-between">
                      {/* Top Action Menu Button */}
                      <div className="absolute right-2 top-2 z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-7 w-7 opacity-80 group-hover:opacity-100 bg-background/80 backdrop-blur"
                              aria-label={`Asset actions for ${asset.name}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingAssetDetail(asset)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStartAiTagging(asset)}>
                              <Sparkles className="mr-2 h-4 w-4 text-purple-600" />
                              Generate AI Tags
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingAsset(asset);
                                setAssetServerError(null);
                                setIsAssetDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Asset
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setMovingAsset(asset);
                                setTargetMoveFolderId(asset.folderId || 'root');
                              }}
                            >
                              <FolderInput className="mr-2 h-4 w-4" />
                              Move to Folder
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => trashAssetMutation.mutate(asset.id)}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Move to Trash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Thumbnail / Image Preview */}
                      <button
                        type="button"
                        onClick={() => setViewingAssetDetail(asset)}
                        className="relative flex h-36 w-full items-center justify-center bg-muted/40 border-b overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`View details for ${asset.name}`}
                      >
                        {isImageLike && !isFailedImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="h-full w-full object-contain p-2"
                            onError={() => {
                              setFailedImageUrls((prev) => ({ ...prev, [asset.url]: true }));
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            {getAssetTypeIcon(asset.type)}
                            <span className="mt-1 text-xs uppercase font-mono">{asset.type}</span>
                          </div>
                        )}
                      </button>

                      <CardContent className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2 pr-6">
                            <h3
                              className="text-sm font-semibold truncate flex-1 cursor-pointer hover:text-primary transition-colors"
                              title={asset.name}
                              onClick={() => setViewingAssetDetail(asset)}
                            >
                              {asset.name}
                            </h3>
                            <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                              {asset.type}
                            </Badge>
                          </div>

                          {/* User & AI Tags Badges */}
                          <div className="flex flex-wrap gap-1">
                            {/* Standard Tags */}
                            {asset.tags?.slice(0, 2).map((tag, idx) => (
                              <span
                                key={`tag-${idx}`}
                                className="inline-flex items-center text-[10px] bg-secondary text-secondary-foreground rounded px-1.5 py-0.5"
                              >
                                <Tag className="mr-0.5 h-2.5 w-2.5 opacity-60" />
                                {tag}
                              </span>
                            ))}

                            {/* AI Tags Badges */}
                            {asset.aiTags?.slice(0, 2).map((tag, idx) => (
                              <span
                                key={`aitag-${idx}`}
                                className="inline-flex items-center text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 rounded px-1.5 py-0.5 font-medium"
                              >
                                <Sparkles className="mr-0.5 h-2.5 w-2.5 text-purple-500" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Details Footer with Folder Path Badge */}
                        <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground border-t mt-auto">
                          <span className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3" />
                            {formatDate(asset.updatedAt)}
                          </span>
                          <Badge variant="secondary" className="text-[10px] font-medium" title={`Folder: ${folderName}`}>
                            <Folder className="mr-1 h-2.5 w-2.5" />
                            {folderName}
                          </Badge>
                          <a
                            href={asset.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            title="Open asset link"
                            aria-label={`Open asset ${asset.name} link in new tab`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* Empty Search & Directory States */
              urlQuery ? (
                <div className="flex flex-col items-center justify-center space-y-4 py-16 text-center border border-dashed rounded-xl bg-card">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Search className="h-6 w-6" />
                  </div>
                  <div className="max-w-sm">
                    <h3 className="text-lg font-bold tracking-tight">No assets match &quot;{urlQuery}&quot;</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      We couldn&apos;t find any assets matching your search term across the workspace.
                    </p>
                  </div>
                  <Button onClick={clearSearch} variant="outline" size="sm">
                    Clear Search
                  </Button>
                </div>
              ) : (
                folders.length === 0 && (
                  <div className="flex flex-col items-center justify-center space-y-4 py-16 text-center border border-dashed rounded-xl bg-card">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Folder className="h-6 w-6" />
                    </div>
                    <div className="max-w-sm">
                      <h3 className="text-lg font-bold tracking-tight">No assets or subfolders here</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Get started by creating a folder or adding your first asset.
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button onClick={() => setIsNewFolderOpen(true)} variant="outline" size="sm">
                        <FolderPlus className="mr-2 h-4 w-4" />
                        Create Folder
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingAsset(null);
                          setAssetServerError(null);
                          setIsAssetDialogOpen(true);
                        }}
                        size="sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Asset
                      </Button>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <LibraryContent />
    </Suspense>
  );
}
