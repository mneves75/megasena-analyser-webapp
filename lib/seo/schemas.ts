/**
 * JSON-LD Schema Generators for SEO
 * Following Schema.org specifications and Google's structured data guidelines
 */

import { APP_INFO, BASE_URL as baseUrl } from '@/lib/constants';

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
    description: 'Análise estatística avançada e gerador inteligente de apostas da Mega-Sena',
    foundingDate: '2025',
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
      'Ferramenta gratuita de análise estatística da Mega-Sena com visualização de frequências, padrões históricos e gerador de apostas.',
    featureList: [
      'Estatísticas de frequência de números',
      'Análise de padrões históricos',
      'Gerador de apostas aleatórias',
      'Dados atualizados da CAIXA',
    ],
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    softwareVersion: APP_INFO.VERSION,
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
    description: 'Análise estatística avançada e gerador inteligente de apostas da Mega-Sena',
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
  faqs: ReadonlyArray<{ question: string; answer: string }>
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
