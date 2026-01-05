import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Construction className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg text-muted-foreground">功能开发中...</p>
        </CardContent>
      </Card>
    </div>
  );
}
