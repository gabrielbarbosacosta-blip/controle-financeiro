@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js nao foi encontrado.
  echo Instale o Node.js LTS em https://nodejs.org/ e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

echo.
echo Iniciando Controle Financeiro localmente...
echo Na primeira execucao, a Vercel pode pedir login e vinculacao do projeto.
echo.

call npx --yes vercel@latest dev

echo.
echo O servidor local foi encerrado.
pause
