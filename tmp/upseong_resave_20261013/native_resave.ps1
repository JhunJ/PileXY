$ErrorActionPreference = 'Stop'
$taskRoot = 'D:\정헌재 선임_2025\건축_BIM\PileXY\tmp\upseong_resave_20261013'
$sourcePath = 'D:\정헌재 선임_2025\건축_BIM\현장지원\천안업성_261013_파일마스터\26.08.10 업성푸르지오 레이크시티 1단지 좌표성과표_Rev.1.xlsx'
$outputDir = 'D:\정헌재 선임_2025\건축_BIM\PileXY\outputs\upseong_resave_20261013_21f9'
$outputPath = Join-Path $outputDir '26.08.10 업성푸르지오 레이크시티 1단지 좌표성과표_Rev.1_재저장.xlsx'
$excelApp = $null
$workbook = $null
$report = [ordered]@{ source = $sourcePath; output = $outputPath; opened = $false; saved = $false }
try {
    if (Test-Path -LiteralPath $outputPath) { throw 'Output already exists; refusing to overwrite.' }
    $previousExcelIds = @(Get-Process -Name EXCEL -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
    $report.sourceHashBefore = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
    $excelApp = New-Object -ComObject Excel.Application
    $excelApp.Visible = $false
    $excelApp.DisplayAlerts = $false
    $excelApp.AskToUpdateLinks = $false
    $ownedExcelIds = @(Get-Process -Name EXCEL -ErrorAction SilentlyContinue | Where-Object { $_.Id -notin $previousExcelIds } | Select-Object -ExpandProperty Id)
    $ownedExcelIds | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'owned_excel_pids.json') -Encoding UTF8
    Write-Output 'Opening source read-only through Excel.'
    $missing = [Type]::Missing
    $controlWorkbook = $excelApp.Workbooks.Open('D:\정헌재 선임_2025\건축_BIM\PileXY\docs\manual\assets\coordinate_compare_sample.xlsx', 0, $true)
    $report.controlOpened = $null -ne $controlWorkbook
    $controlWorkbook.Close($false)
    [Runtime.InteropServices.Marshal]::FinalReleaseComObject($controlWorkbook) | Out-Null
    Write-Output 'Unprotected control workbook opened successfully.'
    $workbook = $excelApp.Workbooks.Open($sourcePath, 0, $true, $missing, '', '', $true)
    $report.opened = $true
    $report.sheetCount = $workbook.Worksheets.Count
    $report.sheets = @($workbook.Worksheets | ForEach-Object { [ordered]@{ name = $_.Name; rows = $_.UsedRange.Rows.Count; columns = $_.UsedRange.Columns.Count } })
    $report.permissionEnabled = $workbook.Permission.Enabled
    Write-Output ('Opened {0} worksheets; saving a separate copy.' -f $report.sheetCount)
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    & 'C:\Users\AN-WKS\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Users\AN-WKS\.codex\plugins\cache\openai-primary-runtime\spreadsheets\26.1011.11113\skills\spreadsheets\container_tools\mark_artifact_operation_started.mjs' --operation-kind edit --expected-output-count 1 --output-format xlsx
    if ($LASTEXITCODE -ne 0) { throw 'Artifact operation marker failed.' }
    $workbook.SaveAs($outputPath, 51, '', '', $false, $false)
    $report.saved = Test-Path -LiteralPath $outputPath
    $report.sourceHashAfter = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
    $report.originalUnchanged = $report.sourceHashBefore -eq $report.sourceHashAfter
} catch {
    $report.error = $_.Exception.Message
    Write-Output ('Excel operation failed: ' + $_.Exception.Message)
} finally {
    if ($null -ne $workbook) {
        try { $workbook.Close($false) } catch {}
        [Runtime.InteropServices.Marshal]::FinalReleaseComObject($workbook) | Out-Null
    }
    if ($null -ne $excelApp) {
        try { $excelApp.Quit() } catch {}
        [Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelApp) | Out-Null
    }
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskRoot 'native_resave_result.json') -Encoding UTF8
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
$report | ConvertTo-Json -Depth 8
