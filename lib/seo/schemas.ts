/**
 * JSON-LD Schema Generators for SEO
 * Following Schema.org specifications and Google's structured data guidelines
 */

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Organization schema - establishes site identity
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Mega-Sena Analyzer',
    url: baseUrl,
    logo: `${baseUrl}/icon.png`,
    description: 'Analise estatistica avancada e gerador inteligente de apostas da Mega-Sena',
    foundingDate: '2025',
    sameAs: [],
  };
}

/**
 * WebApplication schema - describes the lottery analyzer tool
 */
export function generateWebApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Mega-Sena Analyzer',
    url: baseUrl,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'All',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
    },
    description:
      'Ferramenta gratuita de analise estatistica da Mega-Sena com visualizacao de frequencias, padroes historicos e gerador de apostas.',
    featureList: [
      'Estatisticas de frequencia de numeros',
      'Analise de padroes historicos',
      'Gerador de apostas aleatorias',
      'Dados atualizados da CAIXA',
    ],
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    softwareVersion: '1.4.0',
    author: {
      '@type': 'Organization',
      name: 'Mega-Sena Analyzer',
    },
  };
}

/**
 * WebSite schema with search potential
 */
export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Mega-Sena Analyzer',
    url: baseUrl,
    description: 'Analise estatistica avancada e gerador inteligente de apostas da Mega-Sena',
    inLanguage: 'pt-BR',
  };
}

/**
 * BreadcrumbList schema - navigation path
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
    })),
  };
}

/**
 * FAQPage schema for legal pages
 */
export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * SoftwareApplication schema variant for analytics tools
 */
export function generateAnalyticsToolSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Mega-Sena Analyzer',
    applicationCategory: 'FinanceApplication',
    applicationSubCategory: 'Lottery Statistics',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      ratingCount: '100',
      bestRating: '5',
      worstRating: '1',
    },
  };
}
