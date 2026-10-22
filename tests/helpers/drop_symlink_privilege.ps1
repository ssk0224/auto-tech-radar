# Windows の CI（管理者で動く）を、owner PC と同じ「権限の要る symlink を作れない」状態にする。
# このスクリプトを . で読み込んだシェル（pwsh）のプロセスから SeCreateSymbolicLinkPrivilege を取り除く（SE_PRIVILEGE_REMOVED。元に戻せない）。
# そのシェルから起動する npm test・node・cmd の mklink はすべてこのトークンを受け継ぐので、どの書き方の symlink も owner PC と同じく EPERM になる。
# 開発者モード（権限なしで symlink を作れる設定）も切る。
# 外せたかどうかは、テストの中で実際に symlink を作って確かめる（tests/env_portability.test.mjs と tests/helpers/owner_host.json の canCreateSymlink）。
$ErrorActionPreference = "Stop"

$devMode = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock"
if (-not (Test-Path $devMode)) { New-Item -Path $devMode -Force | Out-Null }
Set-ItemProperty -Path $devMode -Name AllowDevelopmentWithoutDevLicense -Type DWord -Value 0

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AtrTokenPrivilege {
  [StructLayout(LayoutKind.Sequential)] public struct LUID { public uint LowPart; public int HighPart; }
  [StructLayout(LayoutKind.Sequential)] public struct TOKEN_PRIVILEGES { public uint PrivilegeCount; public LUID Luid; public uint Attributes; }
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool LookupPrivilegeValue(string system, string name, out LUID luid);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool AdjustTokenPrivileges(IntPtr token, bool disableAll, ref TOKEN_PRIVILEGES state, uint length, IntPtr previous, IntPtr returnLength);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  const uint TOKEN_ADJUST_PRIVILEGES = 0x20, TOKEN_QUERY = 0x8, SE_PRIVILEGE_REMOVED = 0x4;
  // 0: 取り除いた / 1300 (ERROR_NOT_ALL_ASSIGNED): 元から持っていない / それ以外: 失敗
  public static int Remove(string name) {
    IntPtr token;
    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, out token)) return Marshal.GetLastWin32Error();
    try {
      LUID luid;
      if (!LookupPrivilegeValue(null, name, out luid)) return Marshal.GetLastWin32Error();
      TOKEN_PRIVILEGES tp = new TOKEN_PRIVILEGES { PrivilegeCount = 1, Luid = luid, Attributes = SE_PRIVILEGE_REMOVED };
      if (!AdjustTokenPrivileges(token, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero)) return Marshal.GetLastWin32Error();
      return Marshal.GetLastWin32Error();
    } finally { CloseHandle(token); }
  }
}
'@

$code = [AtrTokenPrivilege]::Remove("SeCreateSymbolicLinkPrivilege")
if ($code -ne 0 -and $code -ne 1300) { throw "SeCreateSymbolicLinkPrivilege を外せなかった (Win32 error $code)" }
Write-Host "SeCreateSymbolicLinkPrivilege: $(if ($code -eq 0) { 'removed' } else { 'not held' })"
