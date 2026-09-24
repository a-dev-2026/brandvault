import { FolderKanban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Asset Library</h1>
        <p className="text-sm text-muted-foreground">
          Browse, filter, and organize your brand assets and folders.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FolderKanban className="h-6 w-6" />
          </div>
          <CardTitle className="mt-2">Library Placeholder</CardTitle>
          <CardDescription>
            Asset grid, folder navigation, search, and upload functionality will be rendered here.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-xs text-muted-foreground">
          BrandVault Asset Service & UI Layer Ready.
        </CardContent>
      </Card>
    </div>
  );
}
