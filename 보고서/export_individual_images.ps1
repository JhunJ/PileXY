Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot '청주센텀자이_주요기능_4종_검증완료.png'
$source = [System.Drawing.Bitmap]::FromFile($sourcePath)

$items = @(
    @{ Name = '청주센텀자이_01_말뚝좌표오류자동검증.png'; X = 29;  Y = 83;  W = 562; H = 330 },
    @{ Name = '청주센텀자이_02_흙막이말뚝이격거리자동계산.png'; X = 610; Y = 83;  W = 562; H = 330 },
    @{ Name = '청주센텀자이_03_말뚝별관입길이관리.png'; X = 29;  Y = 552; W = 562; H = 330 },
    @{ Name = '청주센텀자이_04_PDAM기성자동계산.png'; X = 610; Y = 552; W = 562; H = 330 }
)

try {
    foreach ($item in $items) {
        $rect = [System.Drawing.Rectangle]::new($item.X, $item.Y, $item.W, $item.H)
        $crop = $source.Clone($rect, $source.PixelFormat)
        try {
            $destination = Join-Path $PSScriptRoot $item.Name
            $crop.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $crop.Dispose()
        }
    }
}
finally {
    $source.Dispose()
}
