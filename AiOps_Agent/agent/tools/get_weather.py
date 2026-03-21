import requests


def fetch_weather_data(city_code):
    """根据城市代码获取天气实况数据"""
    # 构造请求URL
    url = f"http://www.weather.com.cn/weather1d/{city_code}.shtml"

    try:
        # 发送GET请求
        response = requests.get(url, timeout=5)  # 设置超时时间，避免长时间等待
        # 检查HTTP状态码，200表示成功
        response.raise_for_status()

        # 通常接口会声明编码，如果没有，可以尝试用'apparent_encoding'或直接指定
        response.encoding = 'utf-8'

        return response.text  # 返回响应的文本内容（JSON字符串）

    except requests.exceptions.Timeout:
        print("请求超时，请检查网络或稍后重试。")
        return None
    except requests.exceptions.HTTPError as err:
        print(f"HTTP错误发生：{err}")
        return None
    except requests.exceptions.RequestException as err:
        print(f"请求异常：{err}")
        return None


# 使用示例
city_code = "101010100"  # 无锡的代码
raw_json_str = fetch_weather_data(city_code)
if raw_json_str:
    print("请求成功，原始数据如下：")
    print(raw_json_str[:200])  # 打印前200个字符预览

