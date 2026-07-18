Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($scriptDir)) { $scriptDir = "." }
$srcFile = Join-Path $scriptDir "..\cspos.png"

$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

$resDir = Join-Path $scriptDir "..\android-app\app\src\main\res"

# Load source image
$srcImg = [System.Drawing.Image]::FromFile($srcFile)

foreach ($folder in $sizes.Keys) {
    $size = $sizes[$folder]
    $targetDir = Join-Path $resDir $folder
    
    # Ensure dir exists
    if (!(Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force
    }

    # Delete old webp files to avoid duplicates
    Remove-Item (Join-Path $targetDir "ic_launcher.webp") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $targetDir "ic_launcher_round.webp") -ErrorAction SilentlyContinue

    # Create resized bitmap
    $destImg = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($destImg)
    
    # Set high quality resize settings
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Draw image
    $g.DrawImage($srcImg, 0, 0, $size, $size)
    
    # Save as PNG
    $destImg.Save((Join-Path $targetDir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $destImg.Save((Join-Path $targetDir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)

    # Clean up
    $g.Dispose()
    $destImg.Dispose()
}

$srcImg.Dispose()
Write-Output "Successfully generated launcher icons!"
