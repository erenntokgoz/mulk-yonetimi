import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

// Apple simgesi tam kare çizilir; köşeleri iOS kendisi yuvarlar.
export default function AppleIcon() {
  return new ImageResponse(
    <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 32 32">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6aa5ff" />
          <stop offset=".48" stopColor="#2f7bff" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" fill="url(#g)" />
      <g transform="translate(4 4)">
        <path d="M3.5 20.5V10.4L8 6.6l4 3.3 4-3.3 4.5 3.8v10.1z" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinejoin="round" />
        <rect x="10.4" y="13.4" width="3.2" height="3.6" rx=".8" fill="#ffc56b" />
      </g>
    </svg>,
    size,
  );
}
