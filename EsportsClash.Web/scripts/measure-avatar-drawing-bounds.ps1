Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class DrawingBounds {
 public static int[] Read(string path) {
  using(var bitmap=new Bitmap(path)) {
   var rect=new Rectangle(0,0,bitmap.Width,bitmap.Height);
   var bits=bitmap.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
   try {
    var bytes=new byte[Math.Abs(bits.Stride)*bitmap.Height];Marshal.Copy(bits.Scan0,bytes,0,bytes.Length);
    int left=bitmap.Width,top=bitmap.Height,right=0,bottom=0;
    for(int y=0;y<bitmap.Height;y++)for(int x=0;x<bitmap.Width;x++)if(bytes[y*bits.Stride+x*4+3]>=96){left=Math.Min(left,x);top=Math.Min(top,y);right=Math.Max(right,x);bottom=Math.Max(bottom,y);}
    return new[]{bitmap.Width,bitmap.Height,Math.Max(0,left-3),Math.Max(0,top-3),Math.Min(bitmap.Width,right+4),Math.Min(bitmap.Height,bottom+4)};
   }finally{bitmap.UnlockBits(bits);}
  }
 }
}
"@
$drawingManifest=Get-Content 'docs/arena-2d/avatar-drawings-v1/manifest.json' -Raw | ConvertFrom-Json
$drawingBounds=@{}
foreach($entry in $drawingManifest.avatars){$drawingBounds[$entry.avatarId]=[DrawingBounds]::Read((Join-Path (Get-Location) $entry.file))}
$drawingBounds | ConvertTo-Json -Depth 3 | Set-Content 'docs/arena-2d/avatar-drawings-v1/live-bounds.json'
