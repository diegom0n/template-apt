# Script PowerShell para iniciar ambos servidores
Write-Host "🚀 Iniciando servidores..." -ForegroundColor Green

# Terminal 1: Servidor Express
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host '📧 Servidor Express - Puerto 3001' -ForegroundColor Cyan; node server.js"

# Esperar un segundo
Start-Sleep -Seconds 2

# Terminal 2: Vite
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host '⚡ Vite - Puerto 5173' -ForegroundColor Yellow; npm run dev"

Write-Host "✅ Servidores iniciados en ventanas separadas" -ForegroundColor Green
Write-Host "📧 Servidor Express: http://localhost:3001" -ForegroundColor Cyan
Write-Host "⚡ Vite: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Abre tu navegador en http://localhost:5173" -ForegroundColor White



