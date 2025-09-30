import { API_CONFIG } from '@/lib/constants';

export interface MegaSenaDrawData {
  numero: number;
  dataApuracao: string;
  listaDezenas: string[];
  rateioProcessamento?: Array<{
    descricaoFaixa: string;
    numeroDeGanhadores: number;
    valorPremio: number;
  }>;
  valorArrecadado?: number;
  valorAcumuladoConcurso?: number;
  valorEstimadoProximoConcurso?: number;
  acumulado?: boolean;
  tipoJogo?: string;
}

export class CaixaAPIClient {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = API_CONFIG.CAIXA_BASE_URL;
    this.timeout = API_CONFIG.REQUEST_TIMEOUT;
  }

  async fetchDraw(contestNumber?: number): Promise<MegaSenaDrawData> {
    const url = contestNumber
      ? `${this.baseURL}/megasena/${contestNumber}`
      : `${this.baseURL}/megasena`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MegaSenaAnalyser/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }
        throw new Error(`Failed to fetch draw: ${error.message}`);
      }
      throw error;
    }
  }

  async fetchAllDraws(startContest: number = 1, endContest?: number): Promise<MegaSenaDrawData[]> {
    const draws: MegaSenaDrawData[] = [];
    
    // First, get the latest draw to know the range
    if (!endContest) {
      const latestDraw = await this.fetchDraw();
      endContest = latestDraw.numero;
    }

    console.log(`Fetching draws from ${startContest} to ${endContest}...`);

    for (let contest = startContest; contest <= endContest; contest++) {
      try {
        const draw = await this.fetchDraw(contest);
        draws.push(draw);
        
        if (contest % 100 === 0) {
          console.log(`Fetched ${contest}/${endContest} draws...`);
        }

        // Rate limiting
        await this.delay(API_CONFIG.RATE_LIMIT_DELAY);
      } catch (error) {
        console.error(`Error fetching contest ${contest}:`, error);
        // Continue with next contest
      }
    }

    return draws;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const caixaClient = new CaixaAPIClient();

