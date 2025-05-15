import express, { Request, Response, Router, RequestHandler } from "express";
import cors from "cors";
import { GoogleSearchTool } from "./tools/googleSearchTool";
import dotenv from 'dotenv';

// .env 파일에서 환경 변수 로드
dotenv.config();

// 타입 정의 - 직접 정의하여 임포트 문제 해결
interface OpenAIFunctionDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: any;
    };
}

// MCP 서버 설정
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Express 앱 생성
const app = express();
// CORS 설정 - OpenAI API 호출 허용
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({limit: '10mb'}));
app.use(express.static(__dirname)); // 정적 파일 제공

// 라우터 생성
const router = Router();

// Google 검색 도구 인스턴스 생성
const searchTool = new GoogleSearchTool();

// 도구 목록 조회 엔드포인트
const getToolsHandler: RequestHandler = (_req: Request, res: Response) => {
    // OpenAI Function Calling 형식으로 도구 정의 변환
    const openAIToolDefinition: OpenAIFunctionDefinition = {
        type: "function",
        function: {
            name: searchTool.name,
            description: searchTool.description,
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "검색 쿼리"
                    },
                    num: {
                        type: "number",
                        description: "결과 수 (1-10, 기본값 5)"
                    }
                },
                required: ["query"]
            }
        }
    };

    res.json({
        tools: [{
            name: searchTool.name,
            description: searchTool.description,
            inputSchema: searchTool.inputSchema
        }],
        openai_tools: [openAIToolDefinition]  // OpenAI 형식의 도구 정의 추가
    });
};

// 도구 실행 엔드포인트
const callToolHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const { name, arguments: args } = req.body;
        console.log(`도구 호출: ${name}`, args);

        if (name !== searchTool.name) {
            console.log(`알 수 없는 도구 요청: ${name}`);
            res.status(400).json({
                content: [{ type: "text", text: `Unknown tool: ${name}` }],
                isError: true
            });
            return; // void 반환
        }

        console.log('검색 도구 실행 시작...');
        const result = await searchTool.execute(args);
        console.log('검색 결과 받음:', typeof result);
        
        if (typeof result === "string") {
            res.json({
                content: [{ type: "text", text: result }],
                isError: false
            });
            return; // void 반환
        }

        res.json({
            content: [
                { type: "text", text: result.summary },
                { type: "text", text: "\n\nDetailed search results:\n" + result.results }
            ],
            isError: false
        });
        // return 문 제거

    } catch (error) {
        console.error("도구 실행 오류:", error);
        // 오류 상세 정보 출력
        if (error instanceof Error) {
            console.error("오류 이름:", error.name);
            console.error("오류 메시지:", error.message);
            console.error("오류 스택:", error.stack);
        }
        res.status(500).json({
            content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
        });
        // return 문 제거
    }
};

// 라우터에 핸들러 등록
router.get("/", (_req: Request, res: Response) => {
    res.json({
        name: "Google Search MCP Server",
        version: "1.0.0",
        endpoints: [
            { method: "GET", path: "/tools", description: "사용 가능한 도구 목록 조회" },
            { method: "POST", path: "/tools/call", description: "도구 실행 (MCP 형식)" },
            { method: "POST", path: "/openai/tools", description: "OpenAI Function Calling 형식의 도구 정의 조회" },
            { method: "POST", path: "/openai/run", description: "OpenAI Function Calling 형식으로 도구 실행" },
            { method: "GET", path: "/api-test", description: "API 키와 CSE ID 테스트" }
        ]
    });
});

// 상태 확인용 테스트 API 엔드포인트
router.get("/api-test", (req: Request, res: Response) => {
    // 테스트 쿼리
    const testQuery = "hello world";
    
    // API 키와 CSE ID 가져오기
    const googleApiKey = process.env.GOOGLE_API_KEY || "";
    const googleCseId = process.env.GOOGLE_CSE_ID || "";
    
    // 초기 상태 정보 전송
    res.json({
        status: "API 키 테스트 중",
        apiKeyStatus: googleApiKey ? "값 있음" : "값 없음",
        apiKeyLength: googleApiKey.length,
        apiKeyStart: googleApiKey.substring(0, 10) + "...",
        cseIdStatus: googleCseId ? "값 있음" : "값 없음",
        cseIdLength: googleCseId.length,
        cseIdValue: googleCseId,
        message: "테스트 정보만 반환합니다. 실제 테스트는 다른 엔드포인트를 사용해주세요."
    });
});
router.get("/tools", getToolsHandler);
router.get("/test-api", (req: Request, res: Response) => {
    // API 키와 CSE ID 가져오기
    const googleApiKey = process.env.GOOGLE_API_KEY || "";
    const googleCseId = process.env.GOOGLE_CSE_ID || "";
    
    // Google API 테스트 요청 - 비동기적으로 처리
    const testUrl = new URL('https://www.googleapis.com/customsearch/v1');
    testUrl.searchParams.set('q', 'test'); // 가장 간단한 쿼리
    testUrl.searchParams.set('cx', googleCseId);
    testUrl.searchParams.set('key', googleApiKey);
    
    fetch(testUrl.toString(), {
        headers: { 'Accept': 'application/json' }
    })
    .then(response => {
        if (response.ok) {
            return response.json().then(data => {
                res.json({
                    status: "success",
                    message: "API 키와 CSE ID가 정상적으로 작동합니다",
                    response_status: response.status,
                    result_count: data.items?.length || 0,
                    api_key_length: googleApiKey.length,
                    cse_id_length: googleCseId.length,
                    cse_id: googleCseId
                });
            });
        } else {
            return response.text().then(errorText => {
                res.status(response.status).json({
                    status: "error",
                    message: "오류가 발생했습니다",
                    error: errorText,
                    response_status: response.status,
                    api_key_length: googleApiKey.length,
                    cse_id_length: googleCseId.length,
                    cse_id: googleCseId
                });
            });
        }
    })
    .catch(error => {
        res.status(500).json({
            status: "error",
            message: "예외가 발생했습니다",
            error: error.message
        });
    });
});
router.post("/tools/call", callToolHandler);

// OpenAI Function Calling 형식에 맞춘 엔드포인트 추가
router.post("/openai/tools", (_req: Request, res: Response) => {
    const openAIToolDefinition: OpenAIFunctionDefinition = {
        type: "function",
        function: {
            name: searchTool.name,
            description: searchTool.description,
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "검색 쿼리"
                    },
                    num: {
                        type: "number",
                        description: "결과 수 (1-10, 기본값 5)"
                    }
                },
                required: ["query"]
            }
        }
    };
    
    res.json([openAIToolDefinition]);
});

// OpenAI Function Calling 호출 처리 엔드포인트
router.post("/openai/run", async (req: Request, res: Response) => {
    try {
        const { name, arguments: args } = req.body;

        if (name !== searchTool.name) {
            res.status(400).json({ error: `Unknown tool: ${name}` });
            return;
        }

        const result = await searchTool.execute(args);
        
        if (typeof result === "string") {
            res.json({ result });
            return;
        }

        res.json({
            summary: result.summary,
            results: result.results
        });

    } catch (error) {
        console.error("Tool execution error:", error);
        res.status(500).json({ error: `Error: ${error instanceof Error ? error.message : String(error)}` });
    }
});

// 라우터를 앱에 마운트
app.use("/", router);

// 서버 시작
app.listen(PORT, () => {
    console.log(`MCP Server running on http://localhost:${PORT}`);
});