import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

export interface Tool {
  name: string;
  description?: string;

  /**
   * 실제 도구를 실행하는 함수
   * @param args - 도구가 실행에 필요한 인자
   * @returns Promise<any> - 실행 결과
   */
  execute(args: any): Promise<any>;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class NewsSummarizerTool implements Tool {
  name = "news_summarizer";
  description = "뉴스 기사 내용을 요약하고 경제 용어를 설명해주는 도구입니다.";

  inputSchema = {
    type: "object",
    properties: {
        content: {
        type: "string",
        description: "요약하고 싶은 뉴스 기사 본문"
        }
    },
    required: ["content"]
  };

  async execute({ content }: { content: string }): Promise<any> {
    const prompt = `
다음 뉴스 기사를 요약해줘. 구성은 아래와 같이 해줘:
✅ 기사 요약
뉴스 전체 흐름과 핵심 내용을 간결하게 요약해줘.

🧾 등장한 경제 용어 설명
기사에 등장했거나 관련 있는 **모든 경제 용어를 최대한 많이** 찾아서 **각 용어마다 상세한 설명**을 해줘.  
한두 줄이 아니라, 초보자도 이해할 수 있도록 예시와 함께 **꼼꼼히 설명**해줘.

🔚 핵심 요약 (3~4줄)
기사를 통해 얻을 수 있는 핵심 요점을 3~4줄 이내로 간결하게 정리해줘.

[뉴스 기사 시작]
${content}
[뉴스 기사 끝]
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    return {
      summary: completion.choices[0].message.content ?? "요약 실패",
    };
  }
}

export const newsTool = new NewsSummarizerTool();