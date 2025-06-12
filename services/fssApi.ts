/**
 * 금융위원회 주식시세정보 API 서비스
 * 공공데이터포털의 금융위원회 API를 사용하여 한국 주식 데이터를 가져옵니다.
 */

// 주식 데이터 타입 정의
export interface StockData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  currency: string;
}

// 금융위원회 API 응답 타입
interface FSS_APIResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: {
        item: any[] | any;
      };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

export class FinancialServicesCommissionAPI {
  private readonly API_KEY: string;
  private readonly BASE_URL =
    "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService";

  constructor(apiKey: string) {
    this.API_KEY = apiKey;
  }

  /**
   * 종목명을 종목코드로 변환
   */
  private convertToStockCode(symbol: string): string | null {
    const stockCodes: { [key: string]: string } = {
      // 주요 한국 주식들
      삼성전자: "005930",
      SAMSUNG: "005930",
      SK하이닉스: "000660",
      SKHYNIX: "000660",
      네이버: "035420",
      NAVER: "035420",
      현대차: "005380",
      HYUNDAI: "005380",
      기아: "000270",
      KIA: "000270",
      LG에너지솔루션: "373220",
      LGES: "373220",
      POSCO: "005490",
      포스코: "005490",
      LG화학: "051910",
      LGCHEM: "051910",
      카카오: "035720",
      KAKAO: "035720",
      셀트리온: "068270",
      CELLTRION: "068270",
      KB금융: "105560",
      신한지주: "055550",
      한국전력: "015760",
      KEPCO: "015760",
      LG디스플레이: "034220",
      AMOREPACIFIC: "090430",
      아모레퍼시픽: "090430",
      // 추가 종목들
      삼성바이오로직스: "207940",
      카카오뱅크: "323410",
      크래프톤: "259960",
      하이브: "352820",
      HMM: "011200",
      한화솔루션: "009830",
    };

    // 직접 종목코드인 경우 (6자리 숫자)
    if (/^\d{6}$/.test(symbol.replace(".KS", "").replace(".KQ", ""))) {
      return symbol.replace(".KS", "").replace(".KQ", "");
    }

    // 종목명에서 종목코드 찾기 (대소문자 무관)
    const upperSymbol = symbol.toUpperCase();
    for (const [name, code] of Object.entries(stockCodes)) {
      if (upperSymbol.includes(name.toUpperCase())) {
        return code;
      }
    }

    return null;
  }

  /**
   * 날짜 형식 변환 (YYYY-MM-DD -> YYYYMMDD)
   */
  private formatDate(dateStr: string): string {
    return dateStr.replace(/-/g, "");
  }

  /**
   * 날짜 형식 변환 (YYYYMMDD -> YYYY-MM-DD)
   */
  private parseDate(dateStr: string): string {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(
      4,
      6
    )}-${dateStr.substring(6, 8)}`;
  }

  /**
   * API URL 생성
   */
  private buildApiUrl(
    stockCode: string,
    startDate: string,
    endDate: string
  ): string {
    const url = new URL(`${this.BASE_URL}/getStockPriceInfo`);

    // 필수 파라미터
    url.searchParams.set("serviceKey", this.API_KEY);
    url.searchParams.set("numOfRows", "100"); // 더 많은 데이터
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("resultType", "json");

    // 기간 검색 (범위 지정)
    url.searchParams.set("beginBasDt", this.formatDate(startDate)); // 시작일
    url.searchParams.set("endBasDt", this.formatDate(endDate)); // 종료일

    // 종목 검색 (종목코드로 검색)
    url.searchParams.set("likeSrtnCd", stockCode); // 단축코드로 검색

    return url.toString();
  }

  /**
   * XML 오류 응답 파싱
   */
  private parseXmlError(xmlText: string): string {
    try {
      // XML에서 오류 메시지 추출
      const errMsgMatch = xmlText.match(/<errMsg>(.*?)<\/errMsg>/);
      const returnAuthMsgMatch = xmlText.match(
        /<returnAuthMsg>(.*?)<\/returnAuthMsg>/
      );
      const returnReasonCodeMatch = xmlText.match(
        /<returnReasonCode>(.*?)<\/returnReasonCode>/
      );

      const errMsg = errMsgMatch ? errMsgMatch[1] : "알 수 없는 오류";
      const authMsg = returnAuthMsgMatch ? returnAuthMsgMatch[1] : "";
      const reasonCode = returnReasonCodeMatch ? returnReasonCodeMatch[1] : "";

      if (reasonCode === "30") {
        return 'API 키가 등록되지 않았습니다. 공공데이터포털에서 "금융위원회_주식시세정보" 서비스를 신청해주세요.';
      }

      return `API 오류 (코드: ${reasonCode}): ${errMsg} ${authMsg}`.trim();
    } catch (parseError) {
      return `XML 파싱 오류: ${xmlText.substring(0, 100)}...`;
    }
  }

  /**
   * API 응답 파싱
   */
  private parseApiResponse(data: FSS_APIResponse): StockData[] {
    if (!data.response || !data.response.body || !data.response.body.items) {
      throw new Error("올바르지 않은 API 응답 구조입니다.");
    }

    const items = data.response.body.items.item;
    if (!items || (Array.isArray(items) && items.length === 0)) {
      throw new Error("주가 데이터가 없습니다.");
    }

    const stockData: StockData[] = [];
    const dataArray = Array.isArray(items) ? items : [items];

    for (const item of dataArray) {
      stockData.push({
        date: this.parseDate(item.basDt),
        open: parseFloat(item.mkp || item.clpr || 0), // 시가 (없으면 종가)
        high: parseFloat(item.hipr || item.clpr || 0), // 고가
        low: parseFloat(item.lopr || item.clpr || 0), // 저가
        close: parseFloat(item.clpr || 0), // 종가
        volume: parseInt(item.trqu || 0), // 거래량
        currency: "₩", // 한국 주식은 원화
      });
    }

    // 날짜순으로 정렬
    stockData.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return stockData;
  }

  /**
   * 한국 주식 데이터 가져오기
   */
  async fetchStockData(
    symbol: string,
    startDate: string,
    endDate: string
  ): Promise<StockData[]> {
    try {
      console.log(`금융위원회 API: ${symbol} 데이터 요청 시작`);

      // 종목코드 변환
      const stockCode = this.convertToStockCode(symbol);
      if (!stockCode) {
        throw new Error(`지원하지 않는 종목입니다: ${symbol}`);
      }

      console.log(`종목코드 변환: ${symbol} -> ${stockCode}`);

      // API 호출
      const apiUrl = this.buildApiUrl(stockCode, startDate, endDate);
      console.log("API 호출:", apiUrl.replace(this.API_KEY, "[API_KEY]"));

      const response = await fetch(apiUrl);
      const responseText = await response.text();

      console.log("HTTP 상태 코드:", response.status);
      console.log("응답 내용 (첫 200자):", responseText.substring(0, 200));

      // HTTP 500 오류 처리
      if (response.status === 500) {
        console.error("500 오류 상세 응답:", responseText);

        // XML 오류 응답 확인
        if (
          responseText.includes("<OpenAPI_ServiceResponse>") ||
          responseText.includes("<errMsg>")
        ) {
          const errorMessage = this.parseXmlError(responseText);
          throw new Error(errorMessage);
        }

        // 일반적인 500 오류 원인들
        if (responseText.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR")) {
          throw new Error(
            'API 키가 등록되지 않았거나 서비스 신청이 승인되지 않았습니다. 공공데이터포털에서 "금융위원회_주식시세정보" 서비스를 신청하고 승인을 받아주세요.'
          );
        }

        if (responseText.includes("INVALID_REQUEST_PARAMETER_ERROR")) {
          throw new Error(
            "잘못된 요청 파라미터입니다. 날짜 형식이나 종목코드를 확인해주세요."
          );
        }

        if (responseText.includes("QUOTA_EXCEED")) {
          throw new Error(
            "API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
          );
        }

        throw new Error(
          `서버 내부 오류 (HTTP 500): 공공데이터포털 API 서버에 문제가 있습니다. 잠시 후 다시 시도해주세요.`
        );
      }

      if (!response.ok) {
        throw new Error(`HTTP 오류: ${response.status} ${response.statusText}`);
      }

      // XML 오류 응답 확인
      if (
        responseText.includes("<OpenAPI_ServiceResponse>") ||
        responseText.includes("<errMsg>")
      ) {
        const errorMessage = this.parseXmlError(responseText);
        throw new Error(errorMessage);
      }

      // JSON 파싱 시도
      let data: FSS_APIResponse;
      try {
        data = JSON.parse(responseText) as FSS_APIResponse;
      } catch (jsonError) {
        console.error(
          "JSON 파싱 실패. 응답 내용:",
          responseText.substring(0, 500)
        );
        throw new Error(
          "예상치 못한 응답 형식입니다. API 서버에서 JSON이 아닌 응답을 반환했습니다."
        );
      }

      console.log(
        "API 응답 상태:",
        data.response?.header?.resultCode,
        data.response?.header?.resultMsg
      );

      // 응답 코드 확인
      if (data.response?.header?.resultCode !== "00") {
        const resultMsg = data.response?.header?.resultMsg || "알 수 없는 오류";

        // 일반적인 오류 코드들 처리
        if (
          resultMsg.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR") ||
          resultMsg.includes("30")
        ) {
          throw new Error(
            "API 키가 등록되지 않았거나 서비스 신청이 승인되지 않았습니다."
          );
        }

        if (resultMsg.includes("NO_DATA")) {
          throw new Error(
            "해당 기간에 주가 데이터가 없습니다. 다른 날짜 범위를 시도해보세요."
          );
        }

        throw new Error(`API 오류: ${resultMsg}`);
      }

      // 데이터 파싱
      const stockData = this.parseApiResponse(data);

      console.log(`${stockData.length}개의 실제 주가 데이터를 가져왔습니다.`);
      return stockData;
    } catch (error) {
      console.error("금융위원회 API 오류:", error);
      throw error; // 상위에서 폴백 처리하도록 에러 전파
    }
  }

  /**
   * API 키 유효성 테스트
   */
  async testApiKey(): Promise<boolean> {
    try {
      // 테스트용 URL 생성
      const testUrl = `${
        this.BASE_URL
      }/getStockPriceInfo?serviceKey=${encodeURIComponent(
        this.API_KEY
      )}&numOfRows=1&pageNo=1&resultType=json&likeSrtnCd=005930&basDt=20240101`;
      console.log("테스트 URL (브라우저에서 테스트 가능):", testUrl);

      // 삼성전자로 간단한 테스트
      await this.fetchStockData("삼성전자", "2024-01-01", "2024-01-02");
      return true;
    } catch (error) {
      console.error("API 키 테스트 실패:", error);
      return false;
    }
  }

  /**
   * 지원하는 종목 목록 반환
   */
  getSupportedStocks(): string[] {
    return [
      "삼성전자",
      "SK하이닉스",
      "네이버",
      "현대차",
      "기아",
      "LG에너지솔루션",
      "POSCO",
      "LG화학",
      "카카오",
      "셀트리온",
      "KB금융",
      "신한지주",
      "한국전력",
      "LG디스플레이",
      "아모레퍼시픽",
      "삼성바이오로직스",
      "카카오뱅크",
      "크래프톤",
      "하이브",
      "HMM",
      "한화솔루션",
    ];
  }
}
