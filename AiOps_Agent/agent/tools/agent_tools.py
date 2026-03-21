import datetime as dt
from pathlib import Path

from langchain_core.tools import tool

from rag.rag_service import RagSummarizeService
from utils.loger_handler import logger
from utils.path_tool import get_abs_path

rag = RagSummarizeService()


def _audit(event: str, operator: str, detail: str) -> None:
    audit_file = Path(get_abs_path("logs/ops_audit.log"))
    audit_file.parent.mkdir(parents=True, exist_ok=True)
    line = f"{dt.datetime.now().isoformat()} | operator={operator} | event={event} | detail={detail}\n"
    with open(audit_file, "a", encoding="utf-8") as f:
        f.write(line)


def _mask_sensitive(text: str) -> str:
    if not text:
        return text
    masked = text
    for key in ["password", "passwd", "secret", "token", "apikey", "key"]:
        masked = masked.replace(key, "***")
        masked = masked.replace(key.upper(), "***")
    return masked


def _mock_host(host: str) -> dict:
    return {
        "host": host,
        "cpu": 52.3,
        "mem": 68.1,
        "disk": 74.6,
        "load1": 1.28,
        "load5": 1.07,
        "load15": 0.96,
    }


@tool(description="从向量存储中检索运维知识并返回建议")
def rag_summarize(query: str) -> str:
    return rag.rag_summarize(query)


@tool(description="查询指定主机告警列表，返回告警摘要")
def get_alerts(host: str, level: str = "all") -> str:
    alerts = [
        {"id": "ALM-1201", "level": "high", "title": "CPU持续高于90%", "status": "firing"},
        {"id": "ALM-1188", "level": "medium", "title": "磁盘使用率超过75%", "status": "firing"},
        {"id": "ALM-1150", "level": "low", "title": "接口5xx偶发抖动", "status": "resolved"},
    ]
    filtered = [a for a in alerts if level == "all" or a["level"] == level]
    return f"host={host} 告警: {filtered}"


@tool(description="检查服务状态并返回健康信息")
def check_service_status(host: str, service_name: str) -> str:
    data = {
        "nginx": "running",
        "mysql": "running",
        "redis": "running",
        "order-service": "degraded",
        "payment-service": "running",
    }
    status = data.get(service_name, "unknown")
    return f"host={host}, service={service_name}, status={status}"


@tool(description="查询服务日志，支持关键字与行数")
def query_logs(host: str, service_name: str, keyword: str = "", lines: int = 120) -> str:
    logs = [
        "2026-03-21 10:10:01 INFO startup completed",
        "2026-03-21 10:11:15 WARN db pool usage high",
        "2026-03-21 10:11:42 ERROR timeout when calling inventory-service",
    ]
    if keyword:
        logs = [x for x in logs if keyword.lower() in x.lower()]
    return f"host={host}, service={service_name}, lines={lines}, logs={logs[:max(1, min(lines, 200))]}"


@tool(description="获取服务器资源指标（CPU/内存/磁盘/负载）")
def get_server_metrics(host: str) -> str:
    metrics = _mock_host(host)
    return f"主机指标: {metrics}"


@tool(description="执行网络诊断，支持 ping 或 tcp 两种模式")
def network_diagnose(host: str, target: str, mode: str = "ping", port: int = 80) -> str:
    if mode not in {"ping", "tcp"}:
        return "mode 仅支持 ping 或 tcp"
    if mode == "ping":
        return f"host={host} ping {target}: avg_latency=18ms, loss=0%"
    return f"host={host} tcp_connect {target}:{port}: success, handshake=32ms"


@tool(description="检查数据库连接健康状态")
def check_db_connection(host: str, db_type: str, db_name: str) -> str:
    return f"host={host}, db_type={db_type}, db_name={db_name}, status=ok, latency=24ms"


@tool(description="获取服务当前配置摘要（敏感字段已脱敏）")
def get_config(host: str, service_name: str) -> str:
    cfg = {
        "replicas": 3,
        "image": f"registry.local/{service_name}:stable",
        "env": {"LOG_LEVEL": "INFO", "PASSWORD": "******"},
        "resources": {"cpu": "500m", "memory": "512Mi"},
    }
    return _mask_sensitive(f"host={host}, service={service_name}, config={cfg}")


@tool(description="执行服务部署（写操作，需二次确认）")
def deploy_service(
    host: str,
    service_name: str,
    version: str,
    operator: str,
    confirmed: bool = False,
    change_ticket: str = "",
) -> str:
    if not confirmed:
        return "拒绝执行：deploy_service 属于写操作，需 confirmed=true 二次确认。"
    detail = f"host={host}, service={service_name}, version={version}, change_ticket={change_ticket}"
    _audit("deploy_service", operator=operator, detail=detail)
    logger.info("[deploy_service] %s", detail)
    return f"部署成功：{detail}"


@tool(description="进程管理（restart/stop/start，写操作需二次确认）")
def process_manage(
    host: str,
    process_name: str,
    action: str,
    operator: str,
    confirmed: bool = False,
) -> str:
    allowed = {"restart", "stop", "start"}
    if action not in allowed:
        return f"非法 action: {action}，仅支持 {sorted(allowed)}"
    if not confirmed:
        return "拒绝执行：process_manage 属于高危写操作，需 confirmed=true 二次确认。"
    detail = f"host={host}, process={process_name}, action={action}"
    _audit("process_manage", operator=operator, detail=detail)
    logger.info("[process_manage] %s", detail)
    return f"执行成功：{detail}"









