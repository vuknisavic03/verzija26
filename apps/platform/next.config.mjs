import { withPayload } from '@payloadcms/next/withPayload'

import { securityHeaders } from './security-headers.mjs'

const isDevelopment = process.env.NODE_ENV !== 'production'
const enableHSTS = process.env.SECURITY_ENABLE_HSTS === 'true'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        headers: securityHeaders({ enableHSTS, isDevelopment }),
        source: '/:path*',
      },
    ]
  },
  output: 'standalone',
  // Fajlovi koje kod čita sa diska, a standalone build ih sam ne prati:
  // font za sve PDF-ove (ugovor, fakture, Job Offer, prevodi) i jezički fajl za lokalni OCR.
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf',
      './node_modules/@tesseract.js-data/eng/4.0.0_best_int/**',
    ],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['tesseract.js', 'sharp', 'exceljs', 'pdf-lib', '@pdf-lib/fontkit'],
}

export default withPayload(nextConfig)

