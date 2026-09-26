import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import '@/lib/log-sink.server';
import { Footer } from '@/components/footer';
import { StorageDisclosure } from '@/components/storage-disclosure';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeScript } from '@/components/theme-script';
import { SiteHeader } from '@/components/site-header';
import { MultiJsonLd } from '@/components/seo/json-ld';
import {
  generateOrganizationSchema,
  generateWebApplicationSchema,
  generateWebSiteSchema,
} from '@/lib/seo/schemas';
import { pt } from '@/lib/i18n';
import { BASE_URL as baseUrl } from '@/lib/constants';
import { fontVariables } from '@/app/_lib/fonts';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfdfe' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0f12' },
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
  // No site-wide canonical or og:url: each page declares its own through
  // buildPageMetadata (lib/seo/metadata.ts). Social images come from the
  // opengraph-image / twitter-image file conventions, per segment.
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Mega-Sena Analyzer',
  },
  twitter: {
    card: 'summary_large_image',
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const schemas = [
    generateOrganizationSchema(),
    generateWebApplicationSchema(),
    generateWebSiteSchema(),
  ];

  return (
    <html
      lang="pt-BR"
      className={fontVariables}
      suppressHydrationWarning
    >
      <body className="antialiased flex min-h-screen flex-col font-sans">
        <ThemeScript nonce={nonce} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
        >
          Pular para o conteúdo principal
        </a>
        <MultiJsonLd schemas={schemas} nonce={nonce} />
        <ThemeProvider defaultTheme="system">
          <SiteHeader />
          <main id="main-content" className="flex-1">{children}</main>
          <Footer />
          <StorageDisclosure />
        </ThemeProvider>
      </body>
    </html>
  );
}
