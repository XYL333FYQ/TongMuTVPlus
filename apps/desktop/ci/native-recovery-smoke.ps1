param([Parameter(Mandatory)][string]$Executable)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms, System.Drawing
$out = New-Item -ItemType Directory -Force 'recovery-out'
$driver = Join-Path $PSScriptRoot 'recovery-cdp.cjs'
$fixture = $null
$client = $null
function Capture([string]$Name) {
    $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $bitmap = [System.Drawing.Bitmap]::new($bounds.Width, $bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bitmap.Size)
        $bitmap.Save((Join-Path $out.FullName "$Name.png"))
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
    try {
        if ($client -and -not $client.HasExited) {
            $condition = [System.Windows.Automation.PropertyCondition]::new(
                [System.Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$client.Id)
            $elements = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
                [System.Windows.Automation.TreeScope]::Descendants, $condition)
            @($elements | Select-Object -First 200 | ForEach-Object {
                [pscustomobject]@{
                    name = $_.Current.Name
                    automationId = $_.Current.AutomationId
                    controlType = $_.Current.ControlType.ProgrammaticName
                }
            }) | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $out.FullName "$Name-uia.json")
        }
    } catch { Write-Warning "UIAutomation snapshot unavailable: $_" }
}
function Wait-Check([scriptblock]$Check, [string]$Label) {
    $deadline = [DateTime]::UtcNow.AddSeconds(35)
    do {
        if (& $Check) { Write-Host "PASS: $Label"; return }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    Capture 'failure'
    throw "Timed out: $Label"
}
function Native-Element([System.Windows.Automation.Condition]$Match) {
    $pidCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$client.Id)
    $condition = [System.Windows.Automation.AndCondition]::new($pidCondition, $Match)
    return [System.Windows.Automation.AutomationElement]::RootElement.FindFirst(
        [System.Windows.Automation.TreeScope]::Descendants, $condition)
}
function Native-Button([string]$Name) {
    $nameCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::NameProperty, $Name)
    return Native-Element $nameCondition
}
function Click-Native([string]$Name) {
    Wait-Check { $null -ne (Native-Button $Name) } "native button $Name"
    $button = Native-Button $Name
    $pattern = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $pattern.Invoke()
}
function Cdp([string]$Action, [string]$Url = '') {
    & node $driver $Action $Url
    return $LASTEXITCODE -eq 0
}
try {
    $fixture = Start-Process node -ArgumentList @($driver, 'serve') -WindowStyle Hidden -PassThru
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9222'
    $client = Start-Process -FilePath (Resolve-Path $Executable) -PassThru
    Wait-Check {
        try { $null = Invoke-RestMethod 'http://127.0.0.1:9222/json/list'; return $true }
        catch { return $false }
    } 'client DevTools reachable'
    if (-not (Cdp 'navigate' 'http://127.0.0.1:8085/unavailable')) { throw 'Navigate failed' }
    Wait-Check { $null -ne (Native-Button '重新打开') } 'HTTP 503 native recovery'
    Capture '01-http-native'
    Click-Native '重新打开'
    Wait-Check { Cdp 'ready' } 'HTTP retry renders recovered content'
    Capture '02-http-recovered'
    $hostPid = $client.Id
    if (-not (Cdp 'crash')) { throw 'Crash command failed' }
    Wait-Check { $null -ne (Native-Button '重新打开') } 'renderer crash native recovery'
    if (-not (Get-Process -Id $hostPid -ErrorAction SilentlyContinue)) { throw 'Host died with renderer' }
    Capture '03-renderer-native'
    Click-Native '重新打开'
    Wait-Check { Cdp 'ready' } 'renderer retry creates working content'
    if ($client.Id -ne $hostPid -or $client.HasExited) { throw 'Unexpected host restart' }
    Capture '04-renderer-recovered'
    if (-not (Cdp 'navigate' 'http://127.0.0.1:1/')) { throw 'Network navigation failed' }
    Wait-Check { $null -ne (Native-Button '服务器设置') } 'network failure native recovery'
    Capture '05-network-native'
    Click-Native '服务器设置'
    Wait-Check { Cdp 'settings' } 'native recovery opens local settings'
    Capture '06-settings'
    if (-not (Cdp 'navigate' 'http://127.0.0.1:8085/ready')) { throw 'Ready navigation failed' }
    Wait-Check { Cdp 'ready' } 'ready before browser process failure'
    # Only kill the browser directly owned by this isolated test client. Never
    # terminate all WebView2 processes, which could belong to another program.
    $browsers = @(Get-CimInstance Win32_Process -Filter "Name = 'msedgewebview2.exe'" |
        Where-Object { $_.ParentProcessId -eq $client.Id -and $_.CommandLine -notmatch '--type=' })
    if ($browsers.Count -ne 1) { throw "Expected exactly one owned browser, got $($browsers.Count)" }
    Stop-Process -Id $browsers[0].ProcessId -Force
    Wait-Check { $null -ne (Native-Button '服务器设置') } 'browser process exit native recovery'
    Capture '07-browser-native'
    $oldPid = $client.Id
    $exePath = (Resolve-Path $Executable).Path
    Click-Native '服务器设置'
    Wait-Check {
        $replacement = @(Get-CimInstance Win32_Process | Where-Object {
            $_.ExecutablePath -eq $exePath -and $_.ProcessId -ne $oldPid
        })
        if ($replacement.Count -ne 1) { return $false }
        $script:client = Get-Process -Id $replacement[0].ProcessId
        return $true
    } 'browser failure restarts only the client'
    Wait-Check { Cdp 'settings' } 'restarted client opens local settings'
    Capture '08-browser-restarted-settings'
    Stop-Process -Id $client.Id -Force
    $client.WaitForExit()
    # Official WebView2 environment override simulates unavailable runtime
    # without uninstalling or changing the runner's installed browser engine:
    # https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl
    $env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER = Join-Path $env:RUNNER_TEMP 'tm-deliberately-missing-runtime'
    $client = Start-Process -FilePath $exePath -PassThru
    $cancelCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty, '2')
    Wait-Check { $null -ne (Native-Element $cancelCondition) } 'startup failure has native Cancel without WebView'
    Capture '09-startup-native'
    $cancel = Native-Element $cancelCondition
    $cancel.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    Wait-Check { $client.HasExited } 'startup fallback Cancel exits client'
    'HTTP retry, actual renderer crash, same host PID, network settings, browser restart and runtime startup fallback passed.' |
        Set-Content (Join-Path $out.FullName 'result.txt')
} finally {
    Capture 'final'
    if ($client -and -not $client.HasExited) { Stop-Process -Id $client.Id -Force }
    if ($fixture -and -not $fixture.HasExited) { Stop-Process -Id $fixture.Id -Force }
    Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
    Remove-Item Env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER -ErrorAction SilentlyContinue
}
