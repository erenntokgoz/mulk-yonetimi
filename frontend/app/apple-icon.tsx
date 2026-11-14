import { ImageResponse } from "next/og";
import { brandMarkSvg } from "@/lib/brand-mark-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

const brandMarkDataUri = `data:image/svg+xml;base64,${Buffer.from(brandMarkSvg).toString("base64")}`;

export default function AppleIcon() {
  return new ImageResponse(
    <img src={brandMarkDataUri} alt="" width={180} height={180} />,
    size,
  );
}
