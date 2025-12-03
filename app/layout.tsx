import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/components/theme-provider';

const GA_MEASUREMENT_ID = 'G-V7N39D5EYL';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: 'Mega-Sena Analyzer | Análise Estatística e Gerador de Apostas',
  description:
    'Análise avançada de dados da Mega-Sena com estatísticas, padrões e gerador inteligente de apostas baseado em ciência de dados.',
  keywords: ['mega-sena', 'loteria', 'estatística', 'análise', 'apostas', 'gerador'],
  authors: [{ name: 'Mega-Sena Analyzer' }],
  robots: 'index, follow',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Mega-Sena Analyzer',
    description: 'Análise estatística avançada e gerador inteligente de apostas',
    type: 'website',
    url: baseUrl,
    siteName: 'Mega-Sena Analyzer',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mega-Sena Analyzer',
    description: 'Análise estatística avançada e gerador inteligente de apostas',
  },
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce is set by middleware and automatically applied to Next.js scripts
  // No need to manually pass nonce to HTML elements - only to custom <Script> components
  // See: https://nextjs.org/docs/app/guides/content-security-policy

  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
      <body className="antialiased flex min-h-screen flex-col">
        <ThemeProvider defaultTheme="system">
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
