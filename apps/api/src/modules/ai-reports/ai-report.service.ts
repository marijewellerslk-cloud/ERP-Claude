import { logger } from '../../utils/logger.js';

/**
 * AI Report Service — Ollama Integration
 * 
 * SECURITY ARCHITECTURE:
 * - Ollama runs on localhost and receives ONLY text via HTTP
 * - NO database credentials or connection info is ever sent to the LLM
 * - Data is pre-aggregated by our service layer before being sent
 * - LLM only generates text analysis — never executable code
 * - Only summary/aggregate data is sent, never raw customer/financial records
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

interface OllamaResponse {
    model: string;
    response: string;
    done: boolean;
}

interface OllamaAvailability {
    available: boolean;
    models: string[];
}

class AIReportService {
    // Check if Ollama is running
    async checkAvailability(): Promise<OllamaAvailability> {
        try {
            const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
            if (res.ok) {
                const data = await res.json() as { models?: Array<{ name: string }> };
                return {
                    available: true,
                    models: (data.models || []).map((m: { name: string }) => m.name),
                };
            }
            return { available: false, models: [] };
        } catch {
            return { available: false, models: [] };
        }
    }

    // Generate a report analysis from Ollama
    async generateAnalysis(
        prompt: string,
        contextData: Record<string, any>
    ): Promise<{ success: boolean; analysis?: string; error?: string }> {
        try {
            // Check availability
            const status = await this.checkAvailability();
            if (!status.available) {
                return {
                    success: false,
                    error: 'Ollama is not running. Please start Ollama on this machine (ollama serve).',
                };
            }

            // Build the system prompt with context data
            const systemPrompt = this.buildSystemPrompt(contextData);

            // Call Ollama API
            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    prompt: `${systemPrompt}\n\nUser Question: ${prompt}`,
                    stream: false,
                    options: {
                        temperature: 0.3, // Lower temperature for analytical accuracy
                        top_p: 0.9,
                        num_predict: 1024, // Reasonable response length
                    },
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                logger.error('Ollama API error:', errText);
                return {
                    success: false,
                    error: `Ollama returned an error: ${response.status}. Make sure model "${OLLAMA_MODEL}" is installed.`,
                };
            }

            const data = await response.json() as OllamaResponse;

            return {
                success: true,
                analysis: data.response,
            };
        } catch (error: any) {
            logger.error('AI analysis error:', error);
            return {
                success: false,
                error: `Failed to generate analysis: ${error.message}`,
            };
        }
    }

    // Build system prompt with sanitized data context
    private buildSystemPrompt(contextData: Record<string, any>): string {
        const sections: string[] = [
            'You are a professional financial analyst for a jewelry and gold trading business (MARI Jewellers ERP).',
            'Analyze the data provided below and give clear, actionable insights.',
            'Format your response with headers, bullet points, and key takeaways.',
            'Be specific with numbers and percentages when referencing the data.',
            '',
            '=== BUSINESS DATA CONTEXT ===',
        ];

        for (const [key, value] of Object.entries(contextData)) {
            if (value !== null && value !== undefined) {
                sections.push(`\n--- ${key.toUpperCase()} ---`);
                sections.push(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
            }
        }

        sections.push('\n=== END OF DATA ===');
        sections.push('');
        sections.push('Provide analysis based ONLY on the data above. Do not fabricate data.');

        return sections.join('\n');
    }

    // Predefined report types
    getReportTypes() {
        return [
            {
                id: 'financial-health',
                name: 'Financial Health Check',
                description: 'Overall business health analysis',
                prompt: 'Analyze the financial health of this business. Consider income, expenses, cash position, and profitability.',
                requiredData: ['incomeStatement', 'balanceSheet', 'cashFlow'],
            },
            {
                id: 'gold-position',
                name: 'Gold Position Analysis',
                description: 'Gold inventory and market position review',
                prompt: 'Analyze the gold position of this jewelry business. Consider stock levels, purity distribution, sold gold, and revenue performance.',
                requiredData: ['goldPosition'],
            },
            {
                id: 'daily-briefing',
                name: 'Daily Business Briefing',
                description: 'Summary of today\'s business activity',
                prompt: 'Provide a concise daily business briefing. Summarize key metrics, highlight concerns, and suggest priorities for the day.',
                requiredData: ['incomeStatement', 'goldPosition'],
            },
            {
                id: 'custom',
                name: 'Custom Query',
                description: 'Ask any question about your business data',
                prompt: '',
                requiredData: [],
            },
        ];
    }
}

export const aiReportService = new AIReportService();
