from langchain.agents import create_agent
from model.factory import chat_model
from utils.prompt_loader import load_system_prompts
from agent.tools.agent_tools import (
    rag_summarize,
    get_alerts,
    check_service_status,
    query_logs,
    get_server_metrics,
    network_diagnose,
    check_db_connection,
    get_config,
    deploy_service,
    process_manage,
)
from agent.tools.middleware import monitor_tool, log_before_model


class React_Agent:
    def __init__(self):
        self.agent = create_agent(
            model=chat_model,
            system_prompt=load_system_prompts(),
            tools=[
                rag_summarize,
                get_alerts,
                check_service_status,
                query_logs,
                get_server_metrics,
                network_diagnose,
                check_db_connection,
                get_config,
                deploy_service,
                process_manage,
            ],
            middleware=[monitor_tool, log_before_model],
        )

    def execute_stream(self,query: str):
        input_dict = {
            "messages":[
                {"role": "user","content": query}
            ]
        }

        #第三个参数context就是上下文runtime中的信息,就是我们做提示词切换的标记
        for chunk in self.agent.stream(input_dict,stream_mode="values",context={"report":False}):
            latest_message = chunk["messages"][-1]
            yield latest_message.content.strip() + "\n"

if __name__ == '__main__':
    agent = React_Agent()
    for chunk in agent.execute_stream("order-service 发布后访问超时，帮我排查"):
        print(chunk,end="",flush=True)





