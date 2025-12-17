import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/components/theme-provider';
import { MultiJsonLd } from '@/components/seo/json-ld';
import {
  generateOrganizationSchema,
  generateWebApplicationSchema,
  generateWebSiteSchema,
} from '@/lib/seo/schemas';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
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
    default: 'Mega-Sena Analyzer | Analise Estatistica e Gerador de Apostas',
    template: '%s | Mega-Sena Analyzer',
  },
  description:
    'Analise avancada de dados da Mega-Sena com estatisticas, padroes e gerador inteligente de apostas baseado em ciencia de dados. Ferramenta gratuita.',
  keywords: [
    'mega-sena',
    'loteria',
    'estatistica',
    'analise',
    'apostas',
    'gerador',
    'numeros sorteados',
    'frequencia',
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
    title: 'Mega-Sena Analyzer | Analise Estatistica e Gerador de Apostas',
    description: 'Analise estatistica avancada e gerador inteligente de apostas da Mega-Sena',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Mega-Sena Analyzer - Analise Estatistica',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mega-Sena Analyzer | Analise Estatistica',
    description: 'Analise estatistica avancada e gerador inteligente de apostas da Mega-Sena',
    images: ['/twitter-image'],
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
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased flex min-h-screen flex-col">
        <MultiJsonLd schemas={schemas} />
        <ThemeProvider defaultTheme="system">
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
