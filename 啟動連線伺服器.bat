@echo off
chcp 65001 >nul
title 魔戒文字版 - 連線伺服器
echo 正在啟動連線伺服器（預設埠 2941、密語 mellon）...
node "%~dp0server.js"
pause
