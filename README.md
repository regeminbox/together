# OpenAI와 Google 커스텀 서치 통합 가이드

이 프로젝트는 Google Custom Search API를 MCP(Model Context Protocol) 서버로 구현하여 OpenAI API와 통합하는 방법을 보여줍니다.

## 설정 방법

### 1. 필요한 API 키 준비

- **Google API 키**: [Google Cloud Console](https://console.cloud.google.com/)에서 발급
- **Google Custom Search Engine ID**: [Google Programmable Search Engine](https://programmablesearchengine.google.com/about/)에서 생성
- **OpenAI API 키**: [OpenAI 웹사이트](https://platform.openai.com/)에서 발급

### 2. 환경 변수 설정

```bash
# Windows
set GOOGLE_API_KEY=your-google-api-key
set GOOGLE_CSE_ID=your-custom-search-engine-id
set OPENAI_API_KEY=your-openai-api-key

# Linux/Mac
export GOOGLE_API_KEY=your-google-api-key
export GOOGLE_CSE_ID=your-custom-search-engine-id
export OPENAI_API_KEY=your-openai-api-key
```

### 3. 의존성 설치

```bash
# Node.js 의존성 설치
npm install

# Python 의존성 설치
pip install -r requirements.txt
```

## 시작하기

### 1. MCP 서버 실행

```bash
# 의존성 설치
npm install

# 서버 실행
npm start
```

이 명령은 `googleSearch.ts` 파일을 실행하여 3000번 포트에서 MCP 서버를 시작합니다.

개발 모드로 실행하려면 (코드 변경시 자동 재시작):

```bash
npm run dev
```

### 2. OpenAI API와 통합하기

서버가 실행 중인 상태에서, 다음 중 하나의 방법으로 통합을 시도할 수 있습니다:

#### a. Python 스크립트 사용

```bash
python openai_with_google_search.py
```

이 스크립트는 OpenAI API와 MCP 서버를 연결하여 사용자 질문에 대한 답변을 제공합니다.

#### b. Streamlit 웹 인터페이스 사용

```bash
streamlit run prac.py
```

웹 브라우저에서 Streamlit 인터페이스를 통해 검색 및 대화를 할 수 있습니다.

## API 엔드포인트

MCP 서버는 다음과 같은 API 엔드포인트를 제공합니다:

- `GET /tools`: 사용 가능한 도구 목록 조회
- `POST /tools/call`: 도구 실행 (MCP 형식)
- `POST /openai/tools`: OpenAI Function Calling 형식의 도구 정의 조회
- `POST /openai/run`: OpenAI Function Calling 형식으로 도구 실행

## 커스터마이징

### Google 검색 도구 수정

`tools/googleSearchTool.ts` 파일을 수정하여 검색 기능을 커스터마이징할 수 있습니다:

- 검색 결과 수 조정
- 결과 요약 방식 변경
- 속도 제한 조정

### OpenAI 통합 수정

`openai_with_google_search.py` 파일에서 다음 항목을 조정할 수 있습니다:

- 사용하는 OpenAI 모델 변경
- 시스템 프롬프트 수정
- 결과 표시 형식 변경

## 도커 배포

프로젝트 루트 디렉토리에 포함된 Dockerfile을 사용하여 MCP 서버를 컨테이너화할 수 있습니다:

```bash
docker build -t google-search-mcp .
docker run -p 3000:3000 -e GOOGLE_API_KEY=your-key -e GOOGLE_CSE_ID=your-id -e OPENAI_API_KEY=your-key google-search-mcp
```
