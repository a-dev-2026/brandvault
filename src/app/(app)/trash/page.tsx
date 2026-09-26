'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  Video as VideoIcon,
  Type as FontIcon,
  FileText,
  Clock,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/dialog';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';

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

// Relative time formatter
function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'Trashed recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (isNaN(diffInSeconds) || diffInSeconds < 30) return 'Trashed just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Trashed ${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Trashed ${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `Trashed ${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
}

export default function TrashPage() {
  const queryClient = useQueryClient();
  const [assetToDelete, setAssetToDelete] = useState<AssetItem | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});

  // 1. Fetch Trashed Assets
  const {
    data: trashedData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AssetsResponse, ApiClientError>({
    queryKey: ['trashed-assets'],
    queryFn: () => apiClient.get<AssetsResponse>('/api/assets?trashed=true'),
  });

  // 2. Restore Asset Mutation
  const restoreMutation = useMutation({
    mutationFn: (assetId: string) => apiClient.post(`/api/assets/${assetId}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trashed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset restored successfully!');
    },
    onError: (err: ApiClientError) => {
      toast.error(err.message || 'Failed to restore asset');
    },
  });

  // 3. Permanent Delete Mutation
  const deletePermanentMutation = useMutation({
    mutationFn: (assetId: string) => apiClient.del(`/api/assets/${assetId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trashed-assets'] });
      toast.success('Asset permanently deleted');
      setAssetToDelete(null);
    },
    onError: (err: ApiClientError) => {
      toast.error(err.message || 'Failed to delete asset permanently');
    },
  });

  // Asset type icon selector
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

  const trashedItems = trashedData?.items || [];

  // RENDER STATES
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trash</h1>
          <p className="text-sm text-muted-foreground">
            Soft-deleted workspace assets. Restore assets to your library or permanently delete them.
          </p>
        </div>
      </div>

      {/* Confirmation Dialog for Permanent Deletion */}
      <Dialog
        open={Boolean(assetToDelete)}
        onOpenChange={(open) => {
          if (!open) setAssetToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Delete Permanently?
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete &quot;<span className="font-semibold text-foreground">{assetToDelete?.name}</span>&quot;?
              <br />
              <strong className="text-destructive font-medium">This action cannot be undone.</strong> The asset will be permanently erased from your workspace.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssetToDelete(null)}
              disabled={deletePermanentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (assetToDelete) {
                  deletePermanentMutation.mutate(assetToDelete.id);
                }
              }}
              disabled={deletePermanentMutation.isPending}
            >
              {deletePermanentMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1. Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* 2. Error State with Retry */}
      {!isLoading && isError && (
        <div className="flex flex-col items-center justify-center space-y-4 py-16 text-center border rounded-xl bg-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Failed to load trash</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message || 'An error occurred while fetching trashed assets.'}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* 3. Normal Data / Empty State */}
      {!isLoading && !isError && (
        <>
          {trashedItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {trashedItems.map((asset) => {
                const isImageLike =
                  asset.mimeType.startsWith('image/') ||
                  ['LOGO', 'ICON', 'BANNER'].includes(asset.type);
                const isFailedImage = failedImageUrls[asset.url];
                const isRestoring = restoreMutation.isPending && restoreMutation.variables === asset.id;

                return (
                  <Card key={asset.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {/* Thumbnail / Image Preview */}
                    <div className="relative flex h-36 w-full items-center justify-center bg-muted/40 border-b overflow-hidden opacity-85">
                      {isImageLike && !isFailedImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={asset.url}
                          alt={asset.name}
                          className="h-full w-full object-contain p-2 grayscale"
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

                      {/* Trashed Badge Overlay */}
                      <Badge variant="destructive" className="absolute top-2 left-2 text-[10px] font-medium">
                        Trashed
                      </Badge>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold truncate" title={asset.name}>
                          {asset.name}
                        </h3>
                        <p className="flex items-center text-[11px] text-muted-foreground mt-0.5">
                          <Clock className="mr-1 h-3 w-3 shrink-0" />
                          {formatRelativeTime(asset.deletedAt)}
                        </p>
                      </div>

                      {/* Tags */}
                      {asset.tags && asset.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {asset.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center text-[10px] bg-secondary text-secondary-foreground rounded px-1.5 py-0.5"
                            >
                              <Tag className="mr-0.5 h-2.5 w-2.5 opacity-60" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => restoreMutation.mutate(asset.id)}
                          disabled={isRestoring}
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                          {isRestoring ? 'Restoring...' : 'Restore'}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setAssetToDelete(asset)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Empty Trash State */
            <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center border border-dashed rounded-xl bg-card">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Trash2 className="h-7 w-7" />
              </div>
              <div className="max-w-sm">
                <h3 className="text-xl font-bold tracking-tight">Trash is empty</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Items you delete from your library will appear here before permanent deletion.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
