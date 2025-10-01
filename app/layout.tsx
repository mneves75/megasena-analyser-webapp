import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Mega-Sena Analyser | Análise Estatística e Gerador de Apostas',
  description:
    'Análise avançada de dados da Mega-Sena com estatísticas, padrões e gerador inteligente de apostas baseado em ciência de dados.',
  keywords: ['mega-sena', 'loteria', 'estatística', 'análise', 'apostas', 'gerador'],
  authors: [{ name: 'Mega-Sena Analyser' }],
  robots: 'index, follow',
  openGraph: {
    title: 'Mega-Sena Analyser',
    description: 'Análise estatística avançada e gerador inteligente de apostas',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased flex min-h-screen flex-col">
        <ThemeProvider defaultTheme="system">
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}

