import type { NextConfig } from "next";

// The image engines (@hyper-elements/react/image's optional peers) load a native module and fonts at run time, which
// Next.js can't bundle: they're required from node_modules as they are. Emails, pages and PDFs need nothing here.
const nextConfig: NextConfig = { serverExternalPackages: ["@resvg/resvg-js", "satori"] };

export default nextConfig;
