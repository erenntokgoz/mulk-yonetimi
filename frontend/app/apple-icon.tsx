import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function AppleIcon() {
  return new ImageResponse(
    <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#0f1a2e" stroke="#2f8bff" strokeWidth="2" />
      <path d="M12 48 L12 27 L22 17 L32 27 L42 17 L52 27 L52 48" fill="none" stroke="#2f8bff" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M32 27 L32 48" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
    </svg>,
    size,
  );
}
