import { Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function BrandKitPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brand Kit</h1>
        <p className="text-sm text-muted-foreground">
          Manage your brand identity, primary colors, typography, and guidelines.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Palette className="h-6 w-6" />
          </div>
          <CardTitle className="mt-2">Brand Kit Placeholder</CardTitle>
          <CardDescription>
            Brand color palette editor, logo management, and usage guidelines editor will be rendered here.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-xs text-muted-foreground">
          Brand Service backend endpoints fully connected (`/api/brand`).
        </CardContent>
      </Card>
    </div>
  );
}
