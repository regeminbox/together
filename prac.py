import streamlit as st
import requests
import os
import json
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url="https://api.openai.com/v1"
)

# MCP server URL
MCP_SERVER_URL = "http://localhost:3000"

def init_session_state():
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "google_api_key" not in st.session_state:
        st.session_state.google_api_key = os.getenv("GOOGLE_API_KEY", "")
    if "google_cse_id" not in st.session_state:
        st.session_state.google_cse_id = os.getenv("GOOGLE_CSE_ID", "")
    if "openai_api_key" not in st.session_state:
        st.session_state.openai_api_key = os.getenv("OPENAI_API_KEY", "")

def display_message(role, content):
    with st.chat_message(role):
        st.write(content)

def google_search_mcp(query):
    try:
        response = requests.post(
            f"{MCP_SERVER_URL}/tools/call",
            json={
                "name": "google_search",
                "arguments": {
                    "query": query
                }
            }
        )
        response.raise_for_status()
        result = response.json()
        
        if result.get("isError", False):
            return f"Error: {result['content'][0]['text']}"
        
        return result["content"][0]["text"]
    except Exception as e:
        return f"Error: {str(e)}"

def chat_message_llm(role, model, messages):
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    st.title("Google Search MCP Chat")
    
    # Initialize session state
    init_session_state()
    
    # Sidebar for API keys
    with st.sidebar:
        st.header("API Settings")
        google_api_key = st.text_input("Google API Key", value=st.session_state.google_api_key, type="password")
        google_cse_id = st.text_input("Google CSE ID", value=st.session_state.google_cse_id, type="password")
        openai_api_key = st.text_input("OpenAI API Key", value=st.session_state.openai_api_key, type="password")
        
        if st.button("Save Settings"):
            st.session_state.google_api_key = google_api_key
            st.session_state.google_cse_id = google_cse_id
            st.session_state.openai_api_key = openai_api_key
            os.environ["GOOGLE_API_KEY"] = google_api_key
            os.environ["GOOGLE_CSE_ID"] = google_cse_id
            os.environ["OPENAI_API_KEY"] = openai_api_key
            st.success("Settings saved!")
    
    # Display chat messages
    for message in st.session_state.messages:
        display_message(message["role"], message["content"])
    
    # Chat input
    if prompt := st.chat_input("Type 'search:' followed by your query"):
        # Add user message
        st.session_state.messages.append({"role": "user", "content": prompt})
        display_message("user", prompt)
        
        # Check if it's a search query
        if prompt.lower().startswith("search:"):
            query = prompt[7:].strip()
            search_result = google_search_mcp(query)
            st.session_state.messages.append({"role": "assistant", "content": search_result})
            display_message("assistant", search_result)
        else:
            # Regular chat message
            msgs = [{"role": m["role"], "content": m["content"]} for m in st.session_state.messages]
            msg_llm = chat_message_llm("assistant", "gpt-3.5-turbo", msgs)
            st.session_state.messages.append({"role": "assistant", "content": msg_llm})
            display_message("assistant", msg_llm)

if __name__ == "__main__":
    main()