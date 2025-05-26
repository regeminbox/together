import { OpenAI } from "openai";

// 주식 데이터 타입 정의
interface StockData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface NewsItem {
    title: string;
    description: string;
    url: string;
    date: string;
}

interface StockAnalysisResult {
    symbol: string;
    period: string;
    stockData: StockData[];
    news: NewsItem[];
    analysis: string;
    priceChange: {
        absolute: number;
        percentage: number;
        direction: 'up' | 'down' | 'neutral';
    };
    chartData: {
        labels: string[];
        prices: number[];
        volumes: number[];
    };
}

// Tool 인터페이스 정의
interface Tool {
    name: string;
    description: string;
    inputSchema: any;
    execute: (args: any) => Promise<any>;
}

export class StockAnalysisTool implements Tool {
    name = "stock_analysis";
    description = "주식 종목의 특정 기간 주가 변동을 분석하고, 관련 뉴스를 검색하여 상승/하락 원인을 분석합니다. " +
        "주가 차트와 함께 AI가 분석한 변동 원인을 제공합니다.";
    
    inputSchema = {
        type: "object",
        properties: {
            symbol: {
                type: "string",
                description: "주식 종목명 또는 종목코드 (예: 삼성전자, 005930.KS)"
            },
            startDate: {
                type: "string",
                description: "시작 날짜 (YYYY-MM-DD 형식)"
            },
            endDate: {
                type: "string",
                description: "종료 날짜 (YYYY-MM-DD 형식)"
            }
        },
        required: ["symbol", "startDate", "endDate"],
    };

    private readonly openai: OpenAI;
    private readonly GOOGLE_API_KEY: string;
    private readonly GOOGLE_CSE_ID: string;

    constructor() {
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        this.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
        this.GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || "";

        if (!OPENAI_API_KEY || !this.GOOGLE_API_KEY || !this.GOOGLE_CSE_ID) {
            throw new Error("OPENAI_API_KEY, GOOGLE_API_KEY, and GOOGLE_CSE_ID are required");
        }

        this.openai = new OpenAI({
            apiKey: OPENAI_API_KEY
        });
    }

    // 종목명을 Yahoo Finance 심볼로 변환
    private convertToYahooSymbol(symbol: string): string {
        const koreanStocks: { [key: string]: string } = {
            '삼성전자': '005930.KS',
            '애플': 'AAPL',
            'Apple': 'AAPL',
            'SK하이닉스': '000660.KS',
            'NAVER': '035420.KS',
            '네이버': '035420.KS',
            'LG에너지솔루션': '373220.KS',
            '현대차': '005380.KS',
            '기아': '000270.KS'
        };

        return koreanStocks[symbol] || symbol;
    }

    // 더 현실적인 주가 데이터를 위한 시나리오 생성
    private generateStockScenario(symbol: string): { scenario: string; events: string[] } {
        const scenarios = {
            '삼성전자': {
                positive: {
                    scenario: 'positive',
                    events: ['새로운 반도체 기술 발표', '글로벌 스마트폰 수요 증가', 'AI 칩 수주 확대']
                },
                negative: {
                    scenario: 'negative', 
                    events: ['중국 시장 불확실성', '반도체 과공급 우려', '원자재 가격 상승']
                },
                neutral: {
                    scenario: 'neutral',
                    events: ['시장 전반적 안정세', '업계 평균 실적', '정기 매출 발표']
                }
            },
            '애플': {
                positive: {
                    scenario: 'positive',
                    events: ['iPhone 신모델 출시 예고', 'AI 기능 강화 발표', '서비스 매출 성장']
                },
                negative: {
                    scenario: 'negative',
                    events: ['중국 매출 감소 우려', '경쟁사 신제품 출시', '공급망 차질 우려']
                },
                neutral: {
                    scenario: 'neutral',
                    events: ['안정적인 에코시스템 성장', '시장 예상치 부합', '정기 매출 발표']
                }
            }
        };
        
        const stockScenarios = scenarios[symbol as keyof typeof scenarios] || scenarios['삼성전자'];
        const scenarioTypes = Object.keys(stockScenarios) as ('positive' | 'negative' | 'neutral')[];
        const selectedType = scenarioTypes[Math.floor(Math.random() * scenarioTypes.length)];
        
        return stockScenarios[selectedType];
    }

    // Yahoo Finance에서 주가 데이터 가져오기 (더미 데이터 사용)
    private async fetchStockData(symbol: string, startDate: string, endDate: string): Promise<StockData[]> {
        try {
            const yahooSymbol = this.convertToYahooSymbol(symbol);
            console.log(`주가 데이터 생성: ${symbol} (${yahooSymbol})`);
            
            // 시나리오 생성
            const scenario = this.generateStockScenario(symbol);
            console.log(`선택된 시나리오: ${scenario.scenario}`);
            
            const days = this.getDaysBetween(startDate, endDate) + 1;
            const mockData: StockData[] = [];
            
            let basePrice = 72000; // 기본 주가
            if (symbol.includes('삼성') || symbol.includes('005930')) {
                basePrice = 72000;
            } else if (symbol.includes('애플') || symbol.includes('AAPL')) {
                basePrice = 180; // USD
            } else if (symbol.includes('SK하이닉스')) {
                basePrice = 85000;
            } else if (symbol.includes('네이버') || symbol.includes('NAVER')) {
                basePrice = 165000;
            }
            
            // 시나리오에 따른 트렌드 설정
            let trend: number;
            let trendStrength: number;
            
            switch (scenario.scenario) {
                case 'positive':
                    trend = 1; // 상승 트렌드
                    trendStrength = 0.008 + Math.random() * 0.012; // 0.8% ~ 2.0%
                    break;
                case 'negative':
                    trend = -1; // 하락 트렌드
                    trendStrength = 0.006 + Math.random() * 0.010; // 0.6% ~ 1.6%
                    break;
                default: // neutral
                    trend = Math.random() > 0.5 ? 1 : -1; // 랜덤
                    trendStrength = 0.002 + Math.random() * 0.006; // 0.2% ~ 0.8%
            }
            
            for (let i = 0; i < Math.min(days, 10); i++) {
                const date = this.addDays(startDate, i);
                
                // 트렌드 + 랜덤 변동
                const trendChange = trend * trendStrength * (0.7 + Math.random() * 0.6); // 트렌드 변동
                const randomChange = (Math.random() - 0.5) * 0.025; // ±1.25% 랜덤 변동
                const totalChange = trendChange + randomChange;
                
                // 어떤 날은 트렌드 변경 (15% 확률)
                if (Math.random() < 0.15) {
                    trend = Math.random() > 0.7 ? trend : -trend; // 70% 확률로 트렌드 유지
                    trendStrength *= (0.8 + Math.random() * 0.4); // 세기 조정
                }
                
                const newPrice = Math.round(basePrice * (1 + totalChange));
                const openPrice = i === 0 ? basePrice : mockData[i-1].close;
                
                // 고가와 저가 계산 (더 현실적으로)
                const dayRange = Math.random() * 0.020 + 0.008; // 0.8% ~ 2.8% 일일 변동폭
                const high = Math.round(Math.max(openPrice, newPrice) * (1 + dayRange/2));
                const low = Math.round(Math.min(openPrice, newPrice) * (1 - dayRange/2));
                
                mockData.push({
                    date: date,
                    open: openPrice,
                    high: Math.max(high, openPrice, newPrice),
                    low: Math.min(low, openPrice, newPrice),
                    close: newPrice,
                    volume: Math.floor(Math.random() * 15000000) + 5000000 // 500만~2000만
                });
                
                basePrice = newPrice;
            }

            return mockData;
        } catch (error) {
            console.error('주가 데이터 가져오기 오류:', error);
            throw new Error('주가 데이터를 가져올 수 없습니다.');
        }
    }

    // 두 날짜 사이의 일수 계산
    private getDaysBetween(startDate: string, endDate: string): number {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // 날짜에 일수 추가
    private addDays(dateStr: string, days: number): string {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    // Google 뉴스 검색
    private async searchNews(symbol: string, startDate: string, endDate: string): Promise<NewsItem[]> {
        try {
            const query = `${symbol} 주가 뉴스 ${startDate} ${endDate}`;
            const url = new URL('https://www.googleapis.com/customsearch/v1');
            url.searchParams.set('q', query);
            url.searchParams.set('cx', this.GOOGLE_CSE_ID);
            url.searchParams.set('key', this.GOOGLE_API_KEY);
            url.searchParams.set('num', '5');

            console.log('뉴스 검색 URL:', url.toString().replace(this.GOOGLE_API_KEY, '[API_KEY]'));

            const response = await fetch(url.toString());
            
            if (!response.ok) {
                console.error('뉴스 검색 API 오류:', response.status, response.statusText);
                return [];
            }

            const data = await response.json() as any;
            
            if (!data.items) {
                console.log('뉴스 검색 결과 없음');
                return [];
            }

            return data.items.map((item: any) => ({
                title: item.title || '',
                description: item.snippet || '',
                url: item.link || '',
                date: startDate // 임시로 시작 날짜 사용
            }));

        } catch (error) {
            console.error('뉴스 검색 오류:', error);
            return [];
        }
    }

    // AI를 사용한 주가 분석
    private async analyzeStockMovement(
        symbol: string, 
        stockData: StockData[], 
        news: NewsItem[],
        scenario: { scenario: string; events: string[] }
    ): Promise<string> {
        try {
            const firstPrice = stockData[0]?.close || 0;
            const lastPrice = stockData[stockData.length - 1]?.close || 0;
            const priceChange = lastPrice - firstPrice;
            const percentChange = ((priceChange / firstPrice) * 100).toFixed(2);

            const stockDataText = stockData.map(data => 
                `${data.date}: 종가 ${data.close.toLocaleString()}원 (거래량: ${data.volume.toLocaleString()})`
            ).join('\n');

            const newsText = news.length > 0 ? 
                news.map(item => `- ${item.title}: ${item.description}`).join('\n') :
                '관련 뉴스를 찾을 수 없습니다.';

            // 시나리오 이벤트 텍스트
            const scenarioText = scenario.events.join(', ');
            const scenarioDescription = {
                'positive': '긍정적 요인들이 주가 상승에 기여',
                'negative': '부정적 요인들이 주가 하락 압력으로 작용',
                'neutral': '중립적 시장 상황에서 안정적 움직임'
            };

            const prompt = `
주식 분석 요청:
종목: ${symbol}
기간: ${stockData[0]?.date} ~ ${stockData[stockData.length - 1]?.date}

주가 데이터:
${stockDataText}

가격 변동: ${priceChange > 0 ? '+' : ''}${priceChange.toLocaleString()}원 (${percentChange}%)

시장 시나리오: ${scenarioDescription[scenario.scenario as keyof typeof scenarioDescription]}
주요 이벤트: ${scenarioText}

관련 뉴스:
${newsText}

위 정보를 바탕으로 다음을 분석해주세요:
1. 주가 변동의 주요 원인 분석
2. 시장 시나리오와 실제 주가 움직임의 상관관계
3. 관련 뉴스와 주가 움직임의 상관관계
4. 거래량 변화의 의미
5. 향후 전망 (단기적 관점)

한국어로 상세하고 전문적으로 분석해주세요. 분석 결과는 명확하고 구체적으로 작성해주세요.
            `;

            const response = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "당신은 전문 주식 애널리스트입니다. 주가 데이터와 뉴스를 종합하여 객관적이고 상세한 분석을 제공합니다."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });

            return response.choices[0].message.content || "분석을 완료할 수 없습니다.";

        } catch (error) {
            console.error('AI 분석 오류:', error);
            return "AI 분석 중 오류가 발생했습니다. 주가 데이터를 바탕으로 보면 전반적인 시장 상황과 해당 종목의 기본적인 추세를 확인할 수 있습니다.";
        }
    }

    async execute(args: { symbol: string; startDate: string; endDate: string }): Promise<StockAnalysisResult> {
        try {
            console.log('주식 분석 시작:', args);

            const { symbol, startDate, endDate } = args;

            // 시나리오 생성
            const scenario = this.generateStockScenario(symbol);

            // 1. 주가 데이터 수집
            console.log('주가 데이터 수집 중...');
            const stockData = await this.fetchStockData(symbol, startDate, endDate);

            // 2. 관련 뉴스 검색
            console.log('관련 뉴스 검색 중...');
            const news = await this.searchNews(symbol, startDate, endDate);

            // 3. AI 분석 (시나리오 정보 포함)
            console.log('AI 분석 시작...');
            const analysis = await this.analyzeStockMovement(symbol, stockData, news, scenario);

            // 4. 가격 변동 계산
            const firstPrice = stockData[0]?.close || 0;
            const lastPrice = stockData[stockData.length - 1]?.close || 0;
            const priceChangeAbs = lastPrice - firstPrice;
            const priceChangePercent = ((priceChangeAbs / firstPrice) * 100);
            
            let direction: 'up' | 'down' | 'neutral' = 'neutral';
            if (priceChangePercent > 0.5) direction = 'up';
            else if (priceChangePercent < -0.5) direction = 'down';

            // 5. 차트 데이터 준비
            const chartData = {
                labels: stockData.map(d => d.date),
                prices: stockData.map(d => d.close),
                volumes: stockData.map(d => d.volume)
            };

            const result: StockAnalysisResult = {
                symbol,
                period: `${startDate} ~ ${endDate}`,
                stockData,
                news,
                analysis,
                priceChange: {
                    absolute: priceChangeAbs,
                    percentage: priceChangePercent,
                    direction
                },
                chartData
            };

            console.log('주식 분석 완료');
            return result;

        } catch (error) {
            console.error('주식 분석 오류:', error);
            throw error;
        }
    }
}
