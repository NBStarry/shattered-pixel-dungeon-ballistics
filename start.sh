#!/bin/bash

echo "🦞 破碎像素地牢 - 弹道计算器"
echo "================================"
echo ""

# 检测操作系统
OS="$(uname -s)"

case "${OS}" in
    Linux*)     
        echo "检测到Linux系统"
        if command -v python3 &> /dev/null; then
            echo "启动Python HTTP服务器..."
            python3 -m http.server 8000
        elif command -v python &> /dev/null; then
            echo "启动Python HTTP服务器..."
            python -m SimpleHTTPServer 8000
        else
            echo "❌ 未找到Python，请手动打开index.html"
        fi
        ;;
    Darwin*)    
        echo "检测到macOS系统"
        if command -v python3 &> /dev/null; then
            echo "启动Python HTTP服务器..."
            echo "浏览器将自动打开 http://localhost:8000"
            sleep 1
            open http://localhost:8000 &
            python3 -m http.server 8000
        else
            echo "直接打开index.html..."
            open index.html
        fi
        ;;
    MINGW*|MSYS*|CYGWIN*)
        echo "检测到Windows系统"
        if command -v python &> /dev/null; then
            echo "启动Python HTTP服务器..."
            start http://localhost:8000
            python -m http.server 8000
        else
            echo "直接打开index.html..."
            start index.html
        fi
        ;;
    *)          
        echo "❌ 未知操作系统: ${OS}"
        echo "请手动打开index.html"
        ;;
esac
