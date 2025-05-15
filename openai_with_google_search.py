import os
import requests
import json
from openai import OpenAI

# 환경 변수 설정 (또는 직접 입력)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-openai-api-key")
MCP_SERVER_URL = "http://127.0.0.1:3030"  # 포트 변경

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=OPENAI_API_KEY)

def get_search_tool_definition():
    """MCP 서버에서 도구 정의를 가져옵니다."""
    response = requests.get(f"{MCP_SERVER_URL}/openai/tools")
    if response.status_code != 200:
        raise Exception(f"도구 정의를 가져오는 데 실패했습니다: {response.text}")
    return response.json()

def run_search_tool(name, arguments):
    """MCP 서버에서 검색 도구를 실행합니다."""
    response = requests.post(
        f"{MCP_SERVER_URL}/openai/run",
        json={"name": name, "arguments": arguments}
    )
    if response.status_code != 200:
        raise Exception(f"도구 실행에 실패했습니다: {response.text}")
    return response.json()

def chat_with_tools(user_message):
    """OpenAI API를 사용하여 도구가 있는 채팅을 실행합니다."""
    # 도구 정의 가져오기
    tools = get_search_tool_definition()
    
    # 첫 번째 API 호출 - 도구 호출 결정
    response = client.chat.completions.create(
        model="gpt-4o",  # 또는 "gpt-3.5-turbo" 등 사용 가능한 모델
        messages=[
            {
                "role": "system", 
                "content": "당신은 웹 검색이 가능한 도우미입니다. 사용자의 질문에 답변하기 위해 필요하다면 웹 검색을 사용하세요."
            },
            {"role": "user", "content": user_message}
        ],
        tools=tools,
        tool_choice="auto"
    )
    
    # 응답 처리
    message = response.choices[0].message
    
    # 도구 호출이 없는 경우
    if not message.tool_calls:
        return message.content
    
    # 도구 호출 실행
    messages = [
        {
            "role": "system", 
            "content": "당신은 웹 검색이 가능한 도우미입니다. 사용자의 질문에 답변하기 위해 필요하다면 웹 검색을 사용하세요."
        },
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": None, "tool_calls": message.tool_calls}
    ]
    
    # 각 도구 호출 실행
    for tool_call in message.tool_calls:
        function_name = tool_call.function.name
        function_args = json.loads(tool_call.function.arguments)
        
        # MCP 서버에서 도구 실행
        function_response = run_search_tool(function_name, function_args)
        
        # 도구 응답 추가
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(function_response, ensure_ascii=False)
        })
    
    # 두 번째 API 호출 - 최종 응답 생성
    second_response = client.chat.completions.create(
        model="gpt-4o",  # 또는 "gpt-3.5-turbo" 등 사용 가능한 모델
        messages=messages
    )
    
    return second_response.choices[0].message.content

def main():
    print("========================================")
    print("OpenAI + Google 검색 예제")
    print("(종료하려면 'exit' 또는 'quit'를 입력하세요)")
    print("========================================")
    
    while True:
        user_input = input("\n질문을 입력하세요: ")
        if user_input.lower() in ["exit", "quit"]:
            break
            
        try:
            response = chat_with_tools(user_input)
            print("\n응답:")
            print(response)
        except Exception as e:
            print(f"\n오류: {str(e)}")

if __name__ == "__main__":
    main()
