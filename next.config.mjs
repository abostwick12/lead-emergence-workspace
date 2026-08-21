const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const localSupabaseOrigin = configuredSupabaseUrl.match(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/)?.[0] ?? "";
const localSupabaseConnectSources = localSupabaseOrigin
  ? ` ${localSupabaseOrigin} ${localSupabaseOrigin.replace(/^http:/, "ws:")}`
  : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; base-uri 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co${localSupabaseConnectSources}; font-src 'self' data:; frame-ancestors 'none'; img-src 'self' data: blob: https:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'`
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
