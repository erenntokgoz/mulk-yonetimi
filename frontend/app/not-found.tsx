import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>
      <p className="text-sm text-muted-foreground">İstenen adres bu uygulamada yok.</p>
      <Link href="/" className="min-h-11 w-fit rounded-md border px-4 py-3 text-sm underline">
        Ana sayfaya dön
      </Link>
    </main>
  );
}
