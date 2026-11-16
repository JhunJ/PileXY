$ErrorActionPreference = 'Stop'
$taskRoot = 'D:\정헌재 선임_2025\건축_BIM\PileXY\tmp\upseong_resave_20261013'
$sourcePath = 'D:\정헌재 선임_2025\건축_BIM\현장지원\천안업성_261013_파일마스터\26.08.10 업성푸르지오 레이크시티 1단지 좌표성과표_Rev.1.xlsx'
$previousResult = Get-Content -LiteralPath (Join-Path $taskRoot 'native_resave_result.json') -Raw | ConvertFrom-Json
$outputPath = $previousResult.output
$excelApp = $null
$sourceWorkbook = $null
$copyWorkbook = $null
$report = [ordered]@{ source = $sourcePath; output = $outputPath; copied = $false; saved = $false }
function Get-CellContentHash($value) {
    $json = ConvertTo-Json -InputObject $value -Depth 5 -Compress
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($json)))).Replace('-', '') }
    finally { $sha.Dispose() }
}
function Get-WorkbookSnapshot($book) {
    $items = @()
    for ($i = 1; $i -le $book.Worksheets.Count; $i++) {
        $sheet = $book.Worksheets.Item($i)
        $range = $sheet.UsedRange
        $items += [ordered]@{
            name = $sheet.Name
            address = $range.Address()
            rows = $range.Rows.Count
            columns = $range.Columns.Count
            valuesHash = Get-CellContentHash $range.Value2
            formulasHash = Get-CellContentHash $range.Formula
            printArea = $sheet.PageSetup.PrintArea
            orientation = $sheet.PageSetup.Orientation
            paperSize = $sheet.PageSetup.PaperSize
        }
    }
    return ,$items
}
try {
    if (-not $previousResult.saved -or -not (Test-Path -LiteralPath $outputPath)) { throw 'Expected task-created output was not found.' }
    $report.sourceHashBefore = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
    $excelApp = New-Object -ComObject Excel.Application
    $excelApp.Visible = $false
    $excelApp.DisplayAlerts = $false
    $excelApp.AskToUpdateLinks = $false
    $control = $excelApp.Workbooks.Open('D:\정헌재 선임_2025\건축_BIM\PileXY\docs\manual\assets\coordinate_compare_sample.xlsx', 0, $true)
    $control.Close($false)
    [Runtime.InteropServices.Marshal]::FinalReleaseComObject($control) | Out-Null
    $sourceWorkbook = $excelApp.Workbooks.Open($sourcePath, 0, $true, [Type]::Missing, '', '', $true)
    $report.sourceSheets = Get-WorkbookSnapshot $sourceWorkbook
    Write-Output 'Copying all worksheets into a new workbook using Excel.'
    $sourceWorkbook.Worksheets.Copy()
    $copyWorkbook = $excelApp.ActiveWorkbook
    if ($copyWorkbook.FullName -eq $sourceWorkbook.FullName) { throw 'Excel did not create a separate workbook.' }
    $report.copied = $true
    $report.copyPermissionEnabled = $copyWorkbook.Permission.Enabled
    $report.copySheets = Get-WorkbookSnapshot $copyWorkbook
    $report.contentMatches = (ConvertTo-Json -InputObject $report.sourceSheets -Depth 8 -Compress) -ceq (ConvertTo-Json -InputObject $report.copySheets -Depth 8 -Compress)
    if (-not $report.contentMatches) { throw 'Copied sheet contents or print setup do not match source.' }
    $copyWorkbook.SaveAs($outputPath, 51, '', '', $false, $false)
    $report.saved = $true
    $report.sourceHashAfter = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
    $report.originalUnchanged = $report.sourceHashBefore -eq $report.sourceHashAfter
} catch {
    $report.error = $_.Exception.Message
    Write-Output ('Copy operation failed: ' + $_.Exception.Message)
} finally {
    if ($null -ne $copyWorkbook) { try { $copyWorkbook.Close($false) } catch {}; [Runtime.InteropServices.Marshal]::FinalReleaseComObject($copyWorkbook) | Out-Null }
    if ($null -ne $sourceWorkbook) { try { $sourceWorkbook.Close($false) } catch {}; [Runtime.InteropServices.Marshal]::FinalReleaseComObject($sourceWorkbook) | Out-Null }
    if ($null -ne $excelApp) { try { $excelApp.Quit() } catch {}; [Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelApp) | Out-Null }
    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $taskRoot 'copy_to_new_result.json') -Encoding UTF8
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
[ordered]@{copied=$report.copied; saved=$report.saved; contentMatches=$report.contentMatches; copyPermissionEnabled=$report.copyPermissionEnabled; originalUnchanged=$report.originalUnchanged; error=$report.error} | ConvertTo-Json
