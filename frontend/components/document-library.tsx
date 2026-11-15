"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { components } from "@/lib/api/generated";
import { ListSkeleton } from "@/components/ui/skeleton";

type Document = components["schemas"]["DocumentResponse"];
type DocumentPage = components["schemas"]["DocumentPage"];
type UploadIntent = components["schemas"]["DocumentUploadIntentResponse"];
type Property = components["schemas"]["PropertyResponse"];
const maximumFileSize = 25 * 1024 * 1024;
const acceptedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function uploadError(status: number, stage: "intent" | "upload" | "complete") {
  if (status === 401) return "Dosya yüklemek için giriş yapın.";
  if (status === 503 && stage === "intent")
    return "Dosya depolama hizmeti kullanılamıyor. R2 ayarları yapılandırılana kadar yükleme başlayamaz.";
  if (status === 503 && stage === "complete")
    return "Belge doğrulanamadı. R2 depolama veya zararlı dosya tarama hizmeti kullanılamıyor; etkin belge oluşturulmadı.";
  if (status === 422) return "Dosya güvenlik taramasından geçmedi ve etkinleştirilmedi.";
  if (status === 410) return "Yükleme süresi doldu. Dosyayı yeniden seçip deneyin.";
  if (stage === "upload")
    return "Dosya depolama alanına yüklenemedi. CORS ve bağlantı ayarlarını kontrol edin.";
  return "Belge yüklenemedi. Yeniden deneyin.";
}

export function DocumentLibrary() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentPage, setDocumentPage] = useState(1);
  const [moreDocuments, setMoreDocuments] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyPage, setPropertyPage] = useState(1);
  const [moreProperties, setMoreProperties] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [documentResponse, propertyResponse] = await Promise.all([
        fetch("/api/bff/documents?page=1&pageSize=100", { cache: "no-store" }),
        fetch("/api/bff/properties?page=1&pageSize=100", { cache: "no-store" }),
      ]);
      if (!documentResponse.ok)
        throw new Error(
          documentResponse.status === 401
            ? "Belgeleri görmek için giriş yapın."
            : documentResponse.status === 502 || documentResponse.status === 503
              ? "Belge hizmetine şu anda ulaşılamıyor. Bağlantıyı kontrol edip yeniden deneyin."
              : "Belgeler alınamadı. Yeniden deneyin.",
        );
      if (!propertyResponse.ok)
        throw new Error(
          propertyResponse.status === 401
            ? "Belgeleri görmek için giriş yapın."
            : "Mülk listesi alınamadı. Yeniden deneyin.",
        );
      const [documentPage, propertyPage] = await Promise.all([
        documentResponse.json() as Promise<DocumentPage>,
        propertyResponse.json() as Promise<{ items: Property[]; hasMore: boolean }>,
      ]);
      setDocuments(documentPage.items);
      setDocumentPage(1); setMoreDocuments(documentPage.hasMore);
      setProperties(propertyPage.items.filter((property) => !property.archivedAtUtc));
      setPropertyPage(1); setMoreProperties(propertyPage.hasMore);
      setDataLoaded(true);
    } catch (cause) {
      setDocuments([]);
      setProperties([]);
      setDataLoaded(false);
      setError(cause instanceof Error ? cause.message : "Belgeler alınamadı. Yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadMore(kind: "documents" | "properties") {
    setLoadingMore(true);
    try {
      const next = (kind === "documents" ? documentPage : propertyPage) + 1;
      const response = await fetch(`/api/bff/${kind}?page=${next}&pageSize=100`, { cache: "no-store" });
      if (!response.ok) throw new Error("Diğer kayıtlar alınamadı.");
      if (kind === "documents") {
        const result = (await response.json()) as DocumentPage;
        setDocuments((current) => [...current, ...result.items]);
        setDocumentPage(next); setMoreDocuments(result.hasMore);
      } else {
        const result = (await response.json()) as { items: Property[]; hasMore: boolean };
        setProperties((current) => [...current, ...result.items.filter((item) => !item.archivedAtUtc)]);
        setPropertyPage(next); setMoreProperties(result.hasMore);
      }
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Diğer kayıtlar alınamadı."); }
    finally { setLoadingMore(false); }
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !propertyId) {
      setError("Bir mülk ve dosya seçin.");
      return;
    }
    if (!acceptedTypes.has(file.type)) {
      setError("Yalnız PDF, JPEG veya PNG dosyaları yüklenebilir.");
      return;
    }
    if (file.size > maximumFileSize) {
      setError("Dosya boyutu 25 MiB sınırını aşamaz.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus("Yükleme bağlantısı alınıyor…");
    try {
      const intentResponse = await fetch("/api/bff/documents/upload-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          unitId: null,
          leaseId: null,
          originalName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!intentResponse.ok) throw new Error(uploadError(intentResponse.status, "intent"));
      const intent = (await intentResponse.json()) as UploadIntent;

      setStatus("Dosya özel depolama alanına gönderiliyor…");
      let putResponse: Response;
      try {
        putResponse = await fetch(intent.uploadUrl, {
          method: "PUT",
          headers: intent.requiredHeaders,
          body: file,
        });
      } catch {
        throw new Error(uploadError(0, "upload"));
      }
      if (!putResponse.ok) throw new Error(uploadError(putResponse.status, "upload"));

      setStatus("Dosya güvenlik taramasından geçiriliyor…");
      const completeResponse = await fetch(`/api/bff/documents/${encodeURIComponent(intent.id)}/complete`, {
        method: "POST",
      });
      if (!completeResponse.ok) throw new Error(uploadError(completeResponse.status, "complete"));
      const completed = (await completeResponse.json()) as Document;
      setDocuments((current) => [completed, ...current.filter((item) => item.id !== completed.id)]);
      setFile(null);
      setStatus("Belge tarandı ve kaydedildi.");
      if (fileInput.current) fileInput.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Belge yüklenemedi. Yeniden deneyin.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function download(document: Document) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/bff/documents/${encodeURIComponent(document.id)}/download-url`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          response.status === 503
            ? "İndirme hizmeti kullanılamıyor. R2 depolama ayarlarını kontrol edin."
            : response.status === 401
              ? "Belge indirmek için giriş yapın."
              : "İndirme bağlantısı alınamadı.",
        );
      const result = (await response.json()) as components["schemas"]["DocumentDownloadResponse"];
      // Signed URL is served with Content-Disposition: attachment, so same-tab navigation downloads without leaving the page and is not popup-blocked after await.
      window.location.assign(result.downloadUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Belge indirilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(document: Document) {
    if (!window.confirm(`${document.originalName} belgesini kaldırmak istiyor musunuz?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/bff/documents/${encodeURIComponent(document.id)}`, {
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Belgeyi kaldırmak için giriş yapın."
            : "Belge kaldırılamadı. Yeniden deneyin.",
        );
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setStatus("Belge listeden kaldırıldı.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Belge kaldırılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-5" aria-labelledby="documents-title">
      <div>
        <h1 id="documents-title" className="text-2xl font-semibold tracking-tight">
          Belgeler
        </h1>
      </div>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/50 bg-card p-4 text-sm"
        >
          <p>{error}</p>
          {error.includes("giriş yapın") && (
            <Link href="/giris" className="underline">
              Giriş yap
            </Link>
          )}
          {!dataLoaded && (
            <Button type="button" variant="outline" disabled={loading || busy} onClick={() => void load()}>
              Yeniden dene
            </Button>
          )}
        </div>
      )}
      {status && (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      )}
      {loading ? (
        <ListSkeleton label="Belgeler yükleniyor…" />
      ) : (
        dataLoaded && (
          <>
            <Card>
              <CardContent className="grid gap-4 p-5">
                <h2 className="text-lg font-semibold">Belge yükle</h2>
                {properties.length ? (
                  <>
                  <form
                    className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
                    onSubmit={(event) => void upload(event)}
                  >
                    <label className="grid gap-1 text-sm">
                      Mülk
                      <select
                        required
                        value={propertyId}
                        onChange={(event) => setPropertyId(event.target.value)}
                        className="h-10 rounded border bg-background px-3"
                      >
                        <option value="">Mülk seçin</option>
                        {properties.map((property) => (
                          <option key={property.id} value={property.id}>
                            {property.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      Dosya
                      <input
                        ref={fileInput}
                        aria-label="Dosya"
                        type="file"
                        required
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                        className="min-h-10 w-full rounded border bg-background px-3 py-2"
                      />
                    </label>
                    <Button type="submit" disabled={busy || !file || !propertyId}>
                      {busy ? "Yükleniyor…" : "Dosyayı yükle"}
                    </Button>
                  </form>
                  {moreProperties && <Button type="button" variant="outline" disabled={loadingMore}
                    onClick={() => void loadMore("properties")}>Diğer mülkleri yükle</Button>}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Önce bir mülk ekleyin.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-4 p-5">
                <h2 className="text-lg font-semibold">Kayıtlı belgeler</h2>
                {documents.length ? (
                  <ul className="grid gap-3">
                    {documents.map((document) => (
                      <li
                        key={document.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                      >
                        <div>
                          <h3 className="font-medium">{document.originalName}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {properties.find((property) => property.id === document.propertyId)?.name ??
                              "Mülk"}{" "}
                            · {document.contentType} · {Math.ceil(Number(document.sizeBytes) / 1024)} KiB
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            aria-label={`İndir ${document.originalName}`}
                            onClick={() => void download(document)}
                          >
                            İndir
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            aria-label={`Belgeyi sil ${document.originalName}`}
                            onClick={() => void remove(document)}
                          >
                            Kaldır
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Henüz belge yok.</p>
                )}
                {moreDocuments && <Button type="button" variant="outline" disabled={loadingMore}
                  onClick={() => void loadMore("documents")}>Diğer belgeleri yükle</Button>}
              </CardContent>
            </Card>
          </>
        )
      )}
    </section>
  );
}
