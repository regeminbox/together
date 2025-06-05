import { OpenAI } from "openai";
import { StockDataService } from "../services/stockDataService";
import { StockData } from "../services/fssApi";

// 뉴스 아이템 타입
interface NewsItem {
    title: string;
    description: string;
    url: string;
    date: string;
}

// 주식 분석 결과 타입
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
        currency: string;
    };
    chartData: {
        labels: string[];
        prices: number[];
        volumes: number[];
    };
    market: 'KR' | 'US';
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
    private readonly stockDataService: StockDataService;

    constructor() {
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        this.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
        this.GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || "";
        const FSS_API_KEY = process.env.FSS_API_KEY || "";
        const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || "";

        if (!OPENAI_API_KEY || !this.GOOGLE_API_KEY || !this.GOOGLE_CSE_ID) {
            throw new Error("OPENAI_API_KEY, GOOGLE_API_KEY, and GOOGLE_CSE_ID are required");
        }

        this.openai = new OpenAI({
            apiKey: OPENAI_API_KEY
        });

        // 주식 데이터 서비스 초기화
        this.stockDataService = new StockDataService(FSS_API_KEY, ALPHA_VANTAGE_API_KEY);
    }

    /**
     * 통화 포맷팅 함수
     */
    private formatPrice(price: number, isKorean: boolean): string {
        if (isKorean) {
            return `₩${price.toLocaleString('ko-KR')}`;
        } else {
            return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    }
    
    /**
     * 통화 기호 반환
     */
    private getCurrencySymbol(isKorean: boolean): string {
        return isKorean ? '₩' : '$';
    }

    /**
     * 다각도 뉴스 검색 - 개선된 버전
     */
    private async searchNews(symbol: string, startDate: string, endDate: string): Promise<NewsItem[]> {
        try {
            // 기본 검색 + 종목별 맞춤 검색
            const baseQuery = `${symbol} 주가 뉴스 ${startDate} ${endDate}`;
            const queries = [baseQuery];
            
            // 종목별 특화 쿼리 추가
            const cleanSymbol = symbol.replace(/\.(KS|KQ|NYSE|NASDAQ)$/i, '');
            if (cleanSymbol.toLowerCase().includes('nvda') || cleanSymbol.toLowerCase().includes('nvidia')) {
                queries.push(
                    `NVIDIA AI chip ${startDate}`,
                    `엔비디아 사우디 계약 ${startDate}`,
                    `NVIDIA 블랙웰 ${startDate}`
                );
            } else if (cleanSymbol.includes('삼성전자')) {
                queries.push(
                    `삼성전자 반도체 ${startDate}`,
                    `삼성 HBM 메모리 ${startDate}`
                );
            }
            
            const allNews: NewsItem[] = [];
            const seenUrls = new Set<string>();

            console.log(`다각도 뉴스 검색: ${queries.length}개 쿼리`);

            for (const query of queries.slice(0, 5)) { // 최대 5개 쿼리
                try {
                    const url = new URL('https://www.googleapis.com/customsearch/v1');
                    url.searchParams.set('q', query);
                    url.searchParams.set('cx', this.GOOGLE_CSE_ID);
                    url.searchParams.set('key', this.GOOGLE_API_KEY);
                    url.searchParams.set('num', '5');
                    
                    const response = await fetch(url.toString());
                    
                    if (!response.ok) continue;
                    
                    const data = await response.json() as any;
                    
                    if (data.items) {
                        for (const item of data.items) {
                            if (!seenUrls.has(item.link)) {
                                seenUrls.add(item.link);
                                allNews.push({
                                    title: item.title || '',
                                    description: item.snippet || '',
                                    url: item.link || '',
                                    date: startDate
                                });
                            }
                        }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`쿼리 "${query}" 실패:`, error);
                    continue;
                }
            }

            console.log(`총 ${allNews.length}개 뉴스 발견`);
            return allNews.slice(0, 10); // 상위 10개 반환

        } catch (error) {
            console.error('뉴스 검색 오류:', error);
            return [];
        }
    }

    /**
     * AI를 사용한 주가 분석
     */
    private async analyzeStockMovement(
        symbol: string, 
        stockData: StockData[], 
        news: NewsItem[],
        market: 'KR' | 'US'
    ): Promise<string> {
        try {
            const firstPrice = stockData[0]?.close || 0;
            const lastPrice = stockData[stockData.length - 1]?.close || 0;
            const priceChange = lastPrice - firstPrice;
            const percentChange = ((priceChange / firstPrice) * 100).toFixed(2);

            // 통화 단위 판단
            const isKoreanStock = market === 'KR';
            
            const stockDataText = stockData.map(data => {
                const formattedPrice = this.formatPrice(data.close, isKoreanStock);
                return `${data.date}: 종가 ${formattedPrice} (거래량: ${data.volume.toLocaleString()})`;
            }).join('\n');

            const newsText = news.length > 0 ? 
                news.map(item => `- ${item.title}: ${item.description}`).join('\n') :
                '관련 뉴스를 찾을 수 없습니다.';

            // 기술적 분석 지표 계산
            const priceArray = stockData.map(d => d.close);
            const volumeArray = stockData.map(d => d.volume);
            
            const avgVolume = volumeArray.reduce((a, b) => a + b, 0) / volumeArray.length;
            const maxPrice = Math.max(...priceArray);
            const minPrice = Math.min(...priceArray);
            const volatility = ((maxPrice - minPrice) / minPrice * 100).toFixed(2);

            const prompt = `전문 주식 분석 요청:

📊 **기본 정보**
종목: ${symbol} (${market === 'KR' ? '한국' : '미국'} 시장)
기간: ${stockData[0]?.date} ~ ${stockData[stockData.length - 1]?.date}

📈 **주가 데이터**
${stockDataText}

📉 **주요 지표**
- 가격 변동: ${priceChange > 0 ? '+' : ''}${this.formatPrice(Math.abs(priceChange), isKoreanStock)} (${percentChange}%)
- 최고가: ${this.formatPrice(maxPrice, isKoreanStock)}
- 최저가: ${this.formatPrice(minPrice, isKoreanStock)}
- 변동성: ${volatility}%
- 평균 거래량: ${avgVolume.toLocaleString()}

📰 **관련 뉴스**
${newsText}

**분석 요청:**
1. **핵심 원인 분석** - 주가 변동의 가장 직접적인 원인 1-2가지 명확히 식별
2. **뉴스-주가 상관관계** - 뉴스 발표와 주가 움직임의 시간적 연관성
3. **기술적 분석** - 거래량, 트렌드, 지지/저항선
4. **위험도 평가** - 단기 위험 요인 및 기회 요인
5. **단기 전망** - 1-2주 내 주가 전망 (정보 제공 목적)

**기준:** 구체적 수치와 사실에 기반, 투자 권유 아닌 정보 제공, 핵심 포인트는 **굵은 글씨**로 강조`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `당신은 15년 경력의 전문 주식 애널리스트입니다.

**전문 영역:**
- 뉴스와 시장 이벤트의 주가 영향 분석 전문가
- 펀더멘털 및 기술적 분석 모두 능숙
- 글로벌 시장 동향과 업계별 특성 전문 지식

**분석 원칙:**
1. 객관적 데이터와 구체적 사실에 기반
2. 명확한 근거와 논리적 인과관계 제시
3. 투자 권유가 아닌 정보 제공 목적
4. 불확실성과 위험 요소 명시
5. 핵심 포인트를 굵은 글씨로 강조하여 가독성 제고`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3, // 더 일관되고 객관적인 분석
                max_tokens: 1500 // 더 상세한 분석을 위해 증가
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

            // 1. 주가 데이터 수집
            console.log('주가 데이터 수집 중...');
            const stockResult = await this.stockDataService.fetchStockData(symbol, startDate, endDate);

            if (!stockResult.success || !stockResult.data) {
                throw new Error(`죄송합니다. 주식 찾기를 실패했습니다.\n오류: ${stockResult.error}`);
            }

            const stockData = stockResult.data;
            const market = stockResult.market!;

            // 2. 관련 뉴스 검색
            console.log('관련 뉴스 검색 중...');
            const news = await this.searchNews(symbol, startDate, endDate);

            // 3. AI 분석
            console.log('AI 분석 시작...');
            const analysis = await this.analyzeStockMovement(symbol, stockData, news, market);

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

            // 통화 정보
            const currency = this.getCurrencySymbol(market === 'KR');
            
            const result: StockAnalysisResult = {
                symbol,
                period: `${startDate} ~ ${endDate}`,
                stockData,
                news,
                analysis,
                priceChange: {
                    absolute: priceChangeAbs,
                    percentage: priceChangePercent,
                    direction,
                    currency: currency
                },
                chartData,
                market
            };

            console.log('주식 분석 완료');
            return result;

        } catch (error) {
            console.error('주식 분석 오류:', error);
            throw error;
        }
    }
}