#!/bin/bash
cd "$(dirname "$0")"
echo "============================================"
echo "  成长轨迹 - 已启动"
echo "  浏览器访问: http://localhost:8080"
echo "  按 Ctrl+C 停止"
echo "============================================"
python3 -m http.server 8080
