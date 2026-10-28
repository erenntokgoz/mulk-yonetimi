import { Card, CardContent } from "@/components/ui/card";

export function UnavailableSection({ message }: { message: string }) {
  return (
    <Card data-testid="unavailable-state" className="max-w-3xl shadow-none">
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}
