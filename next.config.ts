import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs is a Node-only library; keep it out of the client bundle.
  serverExternalPackages: ["exceljs", "bcryptjs"],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  poweredByHeader: false,
};

export default nextConfig;
