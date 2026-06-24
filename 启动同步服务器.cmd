@echo off
chcp 65001 >nul
title 产品开发进度 - 同步服务器
cd /d "C:\Users\admin\WorkBuddy\2026-06-21-15-31-50"
node git-sync.js
