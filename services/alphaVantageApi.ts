/**
 * Alpha Vantage API 서비스
 * 미국 주식 데이터를 가져옵니다.
 */

import { StockData } from './fssApi';

// Alpha Vantage API 응답 타입
interface AlphaVantageTimeSeriesData {
    [key: string]: {
        '1. open': string;
        '2. high': string;
        '3. low': string;
        '4. close': string;
        '5. volume': string;
    };
}

interface AlphaVantageResponse {
    'Meta Data': {
        '1. Information': string;
        '2. Symbol': string;
        '3. Last Refreshed': string;
        '4. Output Size': string;
        '5. Time Zone': string;
    };
    'Time Series (Daily)': AlphaVantageTimeSeriesData;
}

export class AlphaVantageAPI {
    private readonly API_KEY: string;
    private readonly BASE_URL = 'https://www.alphavantage.co/query';

    constructor(apiKey: string) {
        this.API_KEY = apiKey;
    }

    /**
     * 종목명을 Alpha Vantage 심볼로 변환
     */
    private convertToAlphaVantageSymbol(symbol: string): string {
        const stockSymbols: { [key: string]: string } = {
            // 미국 주식 (Alpha Vantage에서 잘 지원됨)
            '애플': 'AAPL',
            'Apple': 'AAPL',
            '마이크로소프트': 'MSFT',
            'Microsoft': 'MSFT',
            '구글': 'GOOGL',
            'Google': 'GOOGL',
            '테슬라': 'TSLA',
            'Tesla': 'TSLA',
            '아마존': 'AMZN',
            'Amazon': 'AMZN',
            '메타': 'META',
            'Meta': 'META',
            '엔비디아': 'NVDA',
            'NVIDIA': 'NVDA',
            '넷플릭스': 'NFLX',
            'Netflix': 'NFLX',
            // 추가 미국 주식들
            '팀 쿡': 'AAPL', // 애플 CEO로 검색하는 경우
            '일론 머스크': 'TSLA', // 테슬라 CEO로 검색하는 경우
            'JPMorgan': 'JPM',
            'JP모건': 'JPM',
            '존슨앤존슨': 'JNJ',
            'Johnson': 'JNJ',
            '코카콜라': 'KO',
            'Coca Cola': 'KO',
            '맥도날드': 'MCD',
            'McDonalds': 'MCD',
            '디즈니': 'DIS',
            'Disney': 'DIS'
        };

        return stockSymbols[symbol] || symbol.toUpperCase();
    }

    /**
     * 미국 주식 여부 확인
     */
    isUSStock(symbol: string): boolean {
        const usStocks = [
            'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'META', 'NVDA', 'NFLX',
            'JPM', 'JNJ', 'KO', 'MCD', 'DIS',
            '애플', '마이크로소프트', '구글', '테슬라', '아마존', '메타', '엔비디아', '넷플릭스'
        ];
        
        return usStocks.some(stock => 
            symbol.toUpperCase().includes(stock.toUpperCase())
        );
    }

    /**
     * API URL 생성
     */
    private buildApiUrl(symbol: string): string {
        const url = new URL(this.BASE_URL);
        url.searchParams.set('function', 'TIME_SERIES_DAILY');
        url.searchParams.set('symbol', symbol);
        url.searchParams.set('apikey', this.API_KEY);
        url.searchParams.set('outputsize', 'compact'); // 최근 100일 데이터
        
        return url.toString();
    }

    /**
     * API 응답 파싱
     */
    private parseApiResponse(data: AlphaVantageResponse, startDate: string, endDate: string): StockData[] {
        if (!data['Time Series (Daily)']) {
            if ((data as any)['Note']) {
                throw new Error('API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
            }
            if ((data as any)['Error Message']) {
                throw new Error(`Alpha Vantage 오류: ${(data as any)['Error Message']}`);
            }
            throw new Error('주가 데이터를 찾을 수 없습니다. 종목 심볼을 확인해주세요.');
        }

        const timeSeries = data['Time Series (Daily)'];
        const stockData: StockData[] = [];
        
        // 날짜 범위 필터링
        const startDateTime = new Date(startDate).getTime();
        const endDateTime = new Date(endDate).getTime();
        
        // 데이터를 날짜순으로 정렬하고 범위 내 데이터만 추출
        const sortedDates = Object.keys(timeSeries)
            .filter(date => {
                const dateTime = new Date(date).getTime();
                return dateTime >= startDateTime && dateTime <= endDateTime;
            })
            .sort();

        for (const date of sortedDates) {
            const dailyData = timeSeries[date];
            
            stockData.push({
                date: date,
                open: parseFloat(dailyData['1. open']),
                high: parseFloat(dailyData['2. high']),
                low: parseFloat(dailyData['3. low']),
                close: parseFloat(dailyData['4. close']),
                volume: parseInt(dailyData['5. volume']),
                currency: '$' // 미국 주식은 달러
            });
        }

        if (stockData.length === 0) {
            throw new Error('지정된 날짜 범위에 주가 데이터가 없습니다. 주말이나 공휴일이 아닌 거래일을 선택해주세요.');
        }

        return stockData;
    }

    /**
     * 미국 주식 데이터 가져오기
     */
    async fetchStockData(symbol: string, startDate: string, endDate: string): Promise<StockData[]> {
        try {
            console.log(`Alpha Vantage API: ${symbol} 데이터 요청 시작`);
            
            const alphaSymbol = this.convertToAlphaVantageSymbol(symbol);
            console.log(`종목 심볼 변환: ${symbol} -> ${alphaSymbol}`);
            
            // API 호출
            const apiUrl = this.buildApiUrl(alphaSymbol);
            console.log('Alpha Vantage API 호출:', apiUrl.replace(this.API_KEY, '[API_KEY]'));
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP 오류: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json() as AlphaVantageResponse;
            
            // 데이터 파싱
            const stockData = this.parseApiResponse(data, startDate, endDate);
            
            console.log(`${stockData.length}개의 실제 주가 데이터를 가져왔습니다.`);
            return stockData;
            
        } catch (error) {
            console.error('Alpha Vantage API 오류:', error);
            throw error; // 상위에서 폴백 처리하도록 에러 전파
        }
    }

    /**
     * API 키 유효성 테스트
     */
    async testApiKey(): Promise<boolean> {
        try {
            // AAPL로 간단한 테스트
            await this.fetchStockData('AAPL', '2024-01-01', '2024-01-02');
            return true;
        } catch (error) {
            console.error('API 키 테스트 실패:', error);
            return false;
        }
    }

    /**
     * 지원하는 종목 목록 반환
     */
    getSupportedStocks(): string[] {
        return [
            'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'META', 'NVDA', 'NFLX',
            'JPM', 'JNJ', 'KO', 'MCD', 'DIS',
            '애플', '마이크로소프트', '구글', '테슬라', '아마존', '메타', '엔비디아', '넷플릭스'
        ];
    }
}