# 🔍 AI 검색 & 📈 주식 분석 플랫폼

Google 검색 API와 OpenAI를 활용한 통합 웹 애플리케이션입니다. 실시간 검색과 AI 기반 주식 분석 기능을 제공합니다.

## ✨ 주요 기능

- **🔍 AI 검색**: Google 검색 결과를 AI가 요약해서 제공
- **📈 주식 분석**: **실제 주가 데이터** 또는 더미 데이터와 뉴스를 종합하여 AI가 분석
- **📊 인터랙티브 차트**: Chart.js를 활용한 주가 시각화
- **🎯 Alpha Vantage 연동**: 실제 주가 데이터 사용 가능 (선택)

## 🚀 빠른 시작

### 1. 프로젝트 클론
```bash
git clone [repository-url]
cd [project-name]
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
```bash
# .env.example을 복사하여 .env 파일 생성
cp .env.example .env

# .env 파일을 열어 실제 API 키들을 입력하세요
```

### 4. 서버 실행
```bash
npm start
```

### 5. 웹 브라우저에서 접속
```
http://localhost:3030
```

## 🔑 API 키 발급 방법

### Google API 키
1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" → "사용자 인증 정보" → "API 키 만들기"
4. Custom Search API 활성화
5. 생성된 API 키를 `.env` 파일에 입력

### Google Custom Search Engine ID
1. [Programmable Search Engine](https://programmablesearchengine.google.com/)에 접속
2. "Get started" 클릭하여 검색 엔진 생성
3. 검색 범위 설정 (전체 웹 또는 특정 사이트)
4. 생성 후 "Customize" → "Overview"에서 Search engine ID 복사
5. 복사한 ID를 `.env` 파일에 입력

### OpenAI API 키
1. [OpenAI Platform](https://platform.openai.com/api-keys)에 접속
2. "Create new secret key" 클릭
3. 생성된 API 키를 `.env` 파일에 입력

### Alpha Vantage API 키 (선택)
1. [Alpha Vantage](https://www.alphavantage.co/support/#api-key)에 접속
2. 무료 계정 생성 후 API 키 발급 받기
3. 생성된 API 키를 `.env` 파일에 입력
4. **없어도 됩니다!** - 더미 데이터가 사용됨

## 📁 프로젝트 구조

```
├── public/
│   └── index.html          # 웹 인터페이스
├── tools/
│   ├── googleSearchTool.ts # Google 검색 도구
│   └── stockAnalysisTool.ts # 주식 분석 도구
├── googleSearch.ts         # Express 서버 메인 파일
├── .env.example           # 환경 변수 템플릿
├── .gitignore            # Git 무시 파일 목록
├── package.json          # 프로젝트 설정
└── tsconfig.json         # TypeScript 설정
```

## 🛠️ 기술 스택

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: HTML, CSS, JavaScript, Chart.js
- **AI**: OpenAI GPT-3.5-turbo
- **검색**: Google Custom Search JSON API
- **아키텍처**: MCP (Model Context Protocol)

## 💡 사용 방법

### 구글 검색
1. "구글 검색" 탭 선택
2. 검색어 입력 후 "검색하기" 클릭
3. AI가 요약한 검색 결과 확인

### 주식 분석
1. "주식 분석" 탭 선택
2. 종목명 입력 (예: 삼성전자, 애플, AAPL, 테슬라, TSLA)
3. 분석 기간 설정 (시작일 ~ 종료일)
4. "분석하기" 클릭
5. **실제 주가 차트** (Alpha Vantage API 있을 때), AI 분석, 관련 뉴스 확인

**지원 종목:**
- 한국 주식: 삼성전자, SK하이닉스, 네이버, 현대차, 기아, LG에너지솔루션
- 미국 주식: 애플(AAPL), 테슬라(TSLA), 구글(GOOGL), 마이크로소프트(MSFT), 아마존(AMZN), 메타(META), 엔비디아(NVDA) 등

## ⚠️ 사용 제한

- Google Custom Search API: 무료 계정 하루 100쿼리
- OpenAI API: 사용량에 따른 과금
- Alpha Vantage API: 무료 계정 분당 5회, 하루 500회 제한
- 주가 데이터: Alpha Vantage API 없으면 더미 데이터 사용

## 🔒 보안 주의사항

- **절대로** `.env` 파일을 Git에 커밋하지 마세요
- API 키는 환경 변수로만 관리하세요
- 프로덕션 환경에서는 API 키 제한 설정을 권장합니다

## 📝 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

## 🤝 기여하기

1. Fork 후 브랜치 생성
2. 변경사항 커밋
3. Pull Request 생성

## 📞 문의사항

이슈가 있으시면 GitHub Issues를 이용해 주세요.
