/**
 * 통합 주식 데이터 서비스
 * 한국 주식(금융위원회 API)과 미국 주식(Alpha Vantage API)을 통합 관리합니다.
 */

import { FinancialServicesCommissionAPI, StockData } from './fssApi';
import { AlphaVantageAPI } from './alphaVantageApi';

export class StockDataService {
    private fssApi: FinancialServicesCommissionAPI;
    private alphaVantageApi: AlphaVantageAPI;

    constructor(fssApiKey: string, alphaVantageApiKey: string) {
        this.fssApi = new FinancialServicesCommissionAPI(fssApiKey);
        this.alphaVantageApi = new AlphaVantageAPI(alphaVantageApiKey);
    }

    /**
     * 한국 주식 여부 확인
     */
    private isKoreanStock(symbol: string): boolean {
        const koreanStocks = [
            '삼성전자', 'SAMSUNG', '005930',
            'SK하이닉스', 'SKHYNIX', '000660',
            '네이버', 'NAVER', '035420',
            '현대차', 'HYUNDAI', '005380',
            '기아', 'KIA', '000270',
            'LG에너지솔루션', 'LGES', '373220',
            'POSCO', '포스코', '005490',
            'LG화학', 'LGCHEM', '051910',
            '카카오', 'KAKAO', '035720',
            '셀트리온', 'CELLTRION', '068270'
        ];
        
        // .KS 또는 .KQ 접미사가 있는 경우도 한국 주식으로 판단
        if (symbol.includes('.KS') || symbol.includes('.KQ')) {
            return true;
        }
        
        return koreanStocks.some(stock => 
            symbol.toUpperCase().includes(stock.toUpperCase())
        );
    }

    /**
     * 주식 데이터 가져오기 (한국/미국 자동 판별)
     */
    async fetchStockData(symbol: string, startDate: string, endDate: string): Promise<{
        success: boolean;
        data?: StockData[];
        market?: 'KR' | 'US';
        error?: string;
    }> {
        try {
            const isKorean = this.isKoreanStock(symbol);
            
            if (isKorean) {
                console.log(`한국 주식으로 판별: ${symbol}`);
                
                try {
                    const data = await this.fssApi.fetchStockData(symbol, startDate, endDate);
                    return {
                        success: true,
                        data: data,
                        market: 'KR'
                    };
                } catch (error) {
                    console.error('금융위원회 API 실패:', error);
                    
                    // API 키 문제인 경우 사용자 친화적 메시지
                    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
                    
                    if (errorMessage.includes('API 키가 등록되지 않았습니다') || errorMessage.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR')) {
                        return {
                            success: false,
                            error: `한국 주식 데이터를 가져올 수 없습니다.

해결 방법:
1. 공공데이터포털(https://www.data.go.kr/) 로그인
2. 마이페이지 → 오픈API → 신청현황
3. "금융위원회_주식시세정보" 서비스 신청/승인

현재는 미국 주식만 사용 가능합니다.`
                        };
                    }
                    
                    if (errorMessage.includes('지원하지 않는 종목입니다')) {
                        return {
                            success: false,
                            error: `"지원하지 않는 한국 주식입니다: ${symbol}

지원하는 한국 주식:
삼성전자, SK하이닉스, 네이버, 현대차, 기아,
LG에너지솔루션, POSCO, LG화학, 카카오, 셀트리온 등

또는 6자리 종목코드를 입력해주세요.
예: 005930 (삼성전자)"`
                        };
                    }
                    
                    if (errorMessage.includes('해당 기간에 주가 데이터가 없습니다')) {
                        return {
                            success: false,
                            error: `"해당 기간(${startDate} ~ ${endDate})에 ${symbol} 주가 데이터가 없습니다.

가능한 원인:
1. 주말/공휴일 또는 비거래일
2. 상장폐지된 종목
3. 새로 상장된 종목 (데이터 부족)

해결 방법:
• 다른 날짜 범위를 시도해보세요
• 최근 1-2주 기간으로 설정해보세요"`
                        };
                    }
                    
                    return {
                        success: false,
                        error: `한국 주식 데이터를 가져올 수 없습니다: ${errorMessage}`
                    };
                }
            } else {
                console.log(`미국 주식으로 판별: ${symbol}`);
                
                try {
                    const data = await this.alphaVantageApi.fetchStockData(symbol, startDate, endDate);
                    return {
                        success: true,
                        data: data,
                        market: 'US'
                    };
                } catch (error) {
                    console.error('Alpha Vantage API 실패:', error);
                    return {
                        success: false,
                        error: `미국 주식 데이터를 가져올 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
                    };
                }
            }
        } catch (error) {
            console.error('주식 데이터 가져오기 오류:', error);
            return {
                success: false,
                error: `주식 데이터를 가져오는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
            };
        }
    }

    /**
     * API 키 테스트
     */
    async testApis(): Promise<{
        fss: boolean;
        alphaVantage: boolean;
    }> {
        const [fssResult, alphaVantageResult] = await Promise.allSettled([
            this.fssApi.testApiKey(),
            this.alphaVantageApi.testApiKey()
        ]);

        return {
            fss: fssResult.status === 'fulfilled' ? fssResult.value : false,
            alphaVantage: alphaVantageResult.status === 'fulfilled' ? alphaVantageResult.value : false
        };
    }

    /**
     * 지원하는 종목 목록 반환
     */
    getSupportedStocks(): {
        korean: string[];
        us: string[];
    } {
        return {
            korean: this.fssApi.getSupportedStocks(),
            us: this.alphaVantageApi.getSupportedStocks()
        };
    }

    /**
     * 종목 정보 반환
     */
    getStockInfo(symbol: string): {
        market: 'KR' | 'US';
        isSupported: boolean;
        suggestion?: string;
    } {
        const isKorean = this.isKoreanStock(symbol);
        const supportedStocks = this.getSupportedStocks();
        
        if (isKorean) {
            const isSupported = supportedStocks.korean.some(stock => 
                symbol.toUpperCase().includes(stock.toUpperCase())
            );
            
            return {
                market: 'KR',
                isSupported,
                suggestion: isSupported ? undefined : '지원하는 한국 주식: ' + supportedStocks.korean.slice(0, 5).join(', ') + ' 등'
            };
        } else {
            const isSupported = supportedStocks.us.some(stock => 
                symbol.toUpperCase().includes(stock.toUpperCase())
            );
            
            return {
                market: 'US',
                isSupported,
                suggestion: isSupported ? undefined : '지원하는 미국 주식: ' + supportedStocks.us.slice(0, 5).join(', ') + ' 등'
            };
        }
    }
}