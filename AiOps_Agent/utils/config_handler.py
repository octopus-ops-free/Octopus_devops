"""
配置文件处理工具
yaml
k:v
"""
import yaml

from utils.path_tool import get_abs_path

def load_rag_config(config_path:str=get_abs_path("config/rag.yml"),encoding:str="utf-8"):
    with open(config_path,"r",encoding=encoding) as f:
        return yaml.load(f,Loader=yaml.FullLoader)

def load_chroma_config(config_path:str=get_abs_path("config/chroma.yml"),encoding:str="utf-8"):
    with open(config_path,"r",encoding=encoding) as f:
        return yaml.load(f,Loader=yaml.FullLoader)

def load_prompts_config(config_path:str=get_abs_path("config/prompts.yml"),encoding:str="utf-8"):
    with open(config_path,"r",encoding=encoding) as f:
        return yaml.load(f,Loader=yaml.FullLoader)

def load_agents_config(config_path:str=get_abs_path("config/agents.yml"),encoding:str="utf-8"):
    with open(config_path,"r",encoding=encoding) as f:
        return yaml.load(f,Loader=yaml.FullLoader)

rag_conf = load_rag_config()
chroma_conf = load_chroma_config()
prompts_conf = load_prompts_config()
agents_conf = load_agents_config()

if __name__ == '__main__':
    print(prompts_conf["main_prompt_path"])


