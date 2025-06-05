import { OpenAI } from "openai";

// Tool 인터페이스 정의
interface Tool {
    name: string;
    description: string;
    inputSchema: any;
    execute: (args: any) => Promise<any>;
}

// 타입 정의
interface SearchResult {
    title: string;
    link: string;
    snippet: string;
}

interface GoogleSearchResponse {
    items?: SearchResult[];
}

interface SearchResultWithSummary {
    summary: string;
    results: string;
}

export class GoogleSearchTool implements Tool {
    name = "google_web_search";
    description = "Google Custom Search API를 사용하여 웹 검색을 수행하고 결과를 요약합니다. " +
        "일반적인 정보 검색, 뉴스, 기사 및 온라인 컨텐츠 탐색에 이상적입니다. " +
        "최신 정보가 필요하거나 다양한 웹 소스가 필요할 때 사용하세요. " +
        "검색 결과는 5개까지 제공되며, AI가 요약 및 설명을 제공합니다.";
    inputSchema = {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "검색 쿼리"
            },
            num: {
                type: "number",
                description: "결과 수 (고정값 5)",
                default: 5
            },
            isSummary: {
                type: "boolean",
                description: "용어 요약 요청 여부",
                default: false
            }
        },
        required: ["query"],
    };

    private readonly GOOGLE_API_KEY: string;
    private readonly GOOGLE_CSE_ID: string;
    private readonly openai: OpenAI;
    private requestCount = {
        second: 0,
        day: 0,
        lastReset: Date.now(),
        lastDayReset: new Date().setHours(0, 0, 0, 0)
    };

    private readonly RATE_LIMIT = {
        perSecond: 1,
        perDay: 100  // 무료 Google API 제한
    };

    constructor() {
        this.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
        this.GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || "";
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

        if (!this.GOOGLE_API_KEY || !this.GOOGLE_CSE_ID || !OPENAI_API_KEY) {
            throw new Error("GOOGLE_API_KEY, GOOGLE_CSE_ID, and OPENAI_API_KEY environment variables are required");
        }

        this.openai = new OpenAI({
            apiKey: OPENAI_API_KEY
        });
    }

    private checkRateLimit() {
        const now = Date.now();
        
        // 초당 제한 초기화
        if (now - this.requestCount.lastReset > 1000) {
            this.requestCount.second = 0;
            this.requestCount.lastReset = now;
        }
        
        // 일별 제한 초기화
        const today = new Date().setHours(0, 0, 0, 0);
        if (today !== this.requestCount.lastDayReset) {
            this.requestCount.day = 0;
            this.requestCount.lastDayReset = today;
        }
        
        // 제한 초과 확인
        if (this.requestCount.second >= this.RATE_LIMIT.perSecond ||
            this.requestCount.day >= this.RATE_LIMIT.perDay) {
            throw new Error('Rate limit exceeded');
        }
        
        // 카운터 증가
        this.requestCount.second++;
        this.requestCount.day++;
    }

    async execute(args: { query: string; num?: number; isSummary?: boolean }): Promise<SearchResultWithSummary | string> {
        try {
            console.log('검색 시작:', args);
            this.checkRateLimit();
            
            const { query, num = 5, isSummary = false } = args;
            
            // 환경 변수 확인
            console.log('Google API 키 설정 상태:', this.GOOGLE_API_KEY ? '값 있음' : '값 없음');
            console.log('Google CSE ID 설정 상태:', this.GOOGLE_CSE_ID ? '값 있음' : '값 없음');
            
            // Google Custom Search API URL 구성 - 기본 주소 사용
            const url = new URL('https://www.googleapis.com/customsearch/v1');
            
            // API 키와 CSE ID를 분리해서 로그로 확인
            console.log('API 키 값 일부:', this.GOOGLE_API_KEY.substring(0, 5) + '...');
        console.log('CSE ID 값 일부:', this.GOOGLE_CSE_ID.substring(0, 5) + '...');
        
        // 지원되는 옵션 필수 매개변수만 설정
    url.searchParams.set('q', query);
        url.searchParams.set('cx', this.GOOGLE_CSE_ID);
            url.searchParams.set('key', this.GOOGLE_API_KEY);
            
            // 결과 수를 5개로 고정
            url.searchParams.set('num', '5');
            
    console.log('검색 URL 생성:', url.toString().replace(this.GOOGLE_API_KEY, '[API_KEY]'));

    // API 요청 - 최소한의 헤더만 설정
        const response = await fetch(url.toString());

            console.log('API 응답 상태코드:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Google API 오류 상세:');
                console.error('- 상태 코드:', response.status);
                console.error('- 상태 텍스트:', response.statusText);
                console.error('- 응답 본문:', errorText);
                
                // JSON 파싱 시도
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('- 파싱된 오류:', JSON.stringify(errorJson, null, 2));
                } catch (parseError) {
                    console.error('- JSON 파싱 실패:', parseError);
                }
                
                throw new Error(`Google API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            // 응답 파싱
            const data = await response.json() as GoogleSearchResponse;
            console.log('검색 결과 개수:', data.items?.length || 0);
            
            // 검색 결과가 없는 경우
            if (!data.items || data.items.length === 0) {
                return "검색 결과가 없습니다.";
            }

            // 결과 포맷팅
            const results = data.items.map((item: SearchResult, index: number) => {
                const title = item.title || "제목 없음";
                const link = item.link || "#";
                const snippet = item.snippet || "내용 없음";
                
                return `[${index + 1}] ${title}\n${snippet}\nURL: ${link}`;
            });
            
            console.log('OpenAI로 결과 요약 시작...');

        // OpenAI를 사용하여 검색 결과 요약 및 설명
    const systemPrompt = isSummary ? 
        "당신은 전문적인 지식을 가진 AI 어시스턴트입니다. 사용자가 요청한 용어나 개념에 대해 친절하고 상세하게 설명해주세요. 검색 결과를 바탕으로 정확한 정보를 제공하되, 이해하기 쉽게 설명해주세요." :
        "당신은 유용한 AI 어시스턴트입니다. 검색 결과를 바탕으로 사용자의 질문에 대해 정확하고 도움이 되는 답변을 제공해주세요. 필요한 경우 추가 설명이나 맥락을 제공하여 사용자가 더 잘 이해할 수 있도록 도와주세요.";

    const userPrompt = isSummary ?
        `사용자가 '${query}'에 대해 알고 싶어합니다. 다음 검색 결과를 바탕으로 이 용어/개념을 상세하고 이해하기 쉽게 설명해주세요:\n\n${results.join('\n\n')}` :
        `사용자의 질문: '${query}'\n\n다음은 관련 검색 결과입니다:\n\n${results.join('\n\n')}\n\n이 정보를 바탕으로 사용자의 질문에 대해 유용하고 정확한 답변을 제공해주세요.`;

    const summary = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                content: systemPrompt
            },
                {
                role: "user",
       content: userPrompt
            }
        ],
        temperature: 0.7,
            max_tokens: 500
    });

    return {
        summary: summary.choices[0].message.content || "",
            results: results.join('\n\n')
    };

    } catch (error) {
        console.error("Search error:", error);
            throw error;
        }
    }
} 