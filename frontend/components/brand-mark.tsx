import { brandMarkSvg } from "@/lib/brand-mark-svg";

const uri = `data:image/svg+xml,${encodeURIComponent(brandMarkSvg)}`;

/* Marka işareti lib/brand-mark-svg.ts içinden gelir; sekme simgesi app/icon.svg'dir. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={uri}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      decoding="async"
      className={`brand-mark ${className ?? ""}`}
    />
  );
}
