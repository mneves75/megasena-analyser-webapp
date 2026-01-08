import type { Metadata, Viewport } from 'next';
import { Geist, Space_Grotesk } from 'next/font/google';
import './globals.css';
import '@/lib/log-sink.server';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/components/theme-provider';
import { MultiJsonLd } from '@/components/seo/json-ld';
import {
  generateOrganizationSchema,
  generateWebApplicationSchema,
  generateWebSiteSchema,
} from '@/lib/seo/schemas';
import { pt } from '@/lib/i18n';

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-title',
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: pt.meta.home.title,
    template: '%s | Mega-Sena Analyzer',
  },
  description: pt.meta.home.description,
  keywords: [
    'mega-sena',
    'loteria',
    'estatística',
    'análise',
    'apostas',
    'gerador',
    'números sorteados',
    'frequência',
    'caixa',
    'brasil',
  ],
  authors: [{ name: 'Mega-Sena Analyzer' }],
  creator: 'Mega-Sena Analyzer',
  publisher: 'Mega-Sena Analyzer',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: baseUrl,
    siteName: 'Mega-Sena Analyzer',
    title: pt.meta.home.title,
    description: pt.meta.home.openGraphDescription,
    images: [
      {
        url: `${baseUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: 'Mega-Sena Analyzer - Análise Estatística',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: pt.meta.home.title,
    description: pt.meta.home.openGraphDescription,
    images: [`${baseUrl}/twitter-image`],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mega-Sena Analyzer',
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.json',
  category: 'finance',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const schemas = [
    generateOrganizationSchema(),
    generateWebApplicationSchema(),
    generateWebSiteSchema(),
  ];

  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased flex min-h-screen flex-col font-sans">
        <MultiJsonLd schemas={schemas} />
        <ThemeProvider defaultTheme="system">
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
