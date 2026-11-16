"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  // Sayfa verisi yüklenmeden form açılırsa boş seçimlerle açılır; bu yüzden hazır olana kadar beklenir.
  ready: boolean;
  // Parametre değerine göre formu açar ve odaklanacak alanı bulan işlevi döner. Açılamıyorsa null döner.
  onIntent: (value: string) => Promise<(() => HTMLElement | null) | null> | (() => HTMLElement | null) | null;
};

// Kurulum sihirbazından gelen "?yeni=" bağlantısını okur, ilgili formu açar, ilk alana odaklanır ve parametreyi
// adres çubuğundan kaldırır. Böylece yenileme veya geri dönüş formu tekrar açmaz.
export function CreateIntent(props: Props) {
  return (
    <Suspense fallback={null}>
      <CreateIntentListener {...props} />
    </Suspense>
  );
}

function CreateIntentListener({ ready, onIntent }: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const value = params.get("yeni");
  const handled = useRef<string | null>(null);
  const handler = useRef(onIntent);
  const mounted = useRef(true);
  useEffect(() => {
    handler.current = onIntent;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!value) handled.current = null;
    if (!ready || !value) return;
    const key = `${pathname}?${params.toString()}`;
    if (handled.current === key) return;
    handled.current = key;
    void (async () => {
      const find = await handler.current(value);
      if (!mounted.current) return;
      const rest = new URLSearchParams(params.toString());
      rest.delete("yeni");
      const query = rest.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      if (!find) return;
      // Form bir sonraki çizimde görünür; birkaç kare içinde alan bulunamazsa odak denemesi bırakılır.
      let frames = 0;
      const focus = () => {
        if (!mounted.current) return;
        const field = find();
        if (field) {
          field.focus();
          return;
        }
        if (++frames < 30) requestAnimationFrame(focus);
      };
      requestAnimationFrame(focus);
    })();
  }, [ready, value, pathname, params, router]);

  return null;
}
