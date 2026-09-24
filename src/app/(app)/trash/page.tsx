import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function TrashPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trash</h1>
        <p className="text-sm text-muted-foreground">
          View soft-deleted assets. Restore them to your library or permanently delete them.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="h-6 w-6" />
          </div>
          <CardTitle className="mt-2">Trash Placeholder</CardTitle>
          <CardDescription>
            Trashed assets grid, restore buttons, and permanent deletion controls will be rendered here.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-xs text-muted-foreground">
          Trashed assets endpoint ready (`/api/assets?trashed=true`).
        </CardContent>
      </Card>
    </div>
  );
}
