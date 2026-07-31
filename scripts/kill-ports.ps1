# Kill anything bound to the dev ports
foreach ($port in 3000, 5173, 5174, 5175) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    Write-Host "Killing PID $($c.OwningProcess) on port $port"
    try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
  }
}
Start-Sleep -Seconds 1
$remaining = 0
foreach ($port in 3000, 5173, 5174, 5175) {
  $remaining += (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count
}
Write-Host "Remaining listeners on dev ports: $remaining"