param([Parameter(Mandatory)][string]$Executable)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'This fault-injection script is only for a disposable GitHub runner.' }
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms, System.Drawing
$out = New-Item -ItemType Directory -Force 'recovery-out'
$driver = Join-Path $PSScriptRoot 'recovery-cdp.cjs'
$fixture = $null
$client = $null
$createdPolicies = @()
$exeName = Split-Path -Leaf $Executable
function Set-CiPolicy([string]$Policy, [string]$Value) {
    $key = "HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2\$Policy"
    New-Item -Path $key -Force | Out-Null
    $existing = Get-ItemProperty -LiteralPath $key -ErrorAction Stop
    if ($null -ne $existing.PSObject.Properties[$exeName]) { throw "Existing test-app policy must not be overwritten: $Policy" }
    New-ItemProperty -LiteralPath $key -Name $exeName -Value $Value -PropertyType String | Out-Null
    $script:createdPolicies += $key
}
function Clear-CiPolicy([string]$Policy) {
    $key = "HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2\$Policy"
    if ($createdPolicies -notcontains $key) { throw "Policy was not created by this test: $Policy" }
    Remove-ItemProperty -LiteralPath $key -Name $exeName
    $script:createdPolicies = @($createdPolicies | Where-Object { $_ -ne $key })
}
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
    # A recently stopped WebView may retain its port briefly. Never accept its
    # document as evidence for the replacement/current client.
    $listeners = @(Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue)
    $owned = $false
    foreach ($listener in $listeners) {
        $browser = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
        if ($browser.Name -eq 'msedgewebview2.exe' -and $browser.ParentProcessId -eq $client.Id) {
            $owned = $true
        }
    }
    if (-not $owned) { return $false }
    & node $driver $Action $Url
    return $LASTEXITCODE -eq 0
}
try {
    # Runtime 150+ deliberately ignores WEBVIEW2_* overrides in elevated hosts.
    # Use the documented per-executable machine policy only on this disposable
    # runner, and remove each value in finally. No release-app debug switches.
    # https://github.com/MicrosoftEdge/WebView2Feedback/issues/5645
    $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    Write-Host "Elevated runner: $($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))"
    Set-CiPolicy 'AdditionalBrowserArguments' '--remote-debugging-port=9222'
    $fixture = Start-Process node -ArgumentList @($driver, 'serve') -WindowStyle Hidden -PassThru
    $client = Start-Process -FilePath (Resolve-Path $Executable) -PassThru
    Wait-Check {
        try { $null = Invoke-RestMethod 'http://127.0.0.1:9222/json/list'; return $true }
        catch { return $false }
    } 'client DevTools reachable'
    $ownedBrowser = Get-CimInstance Win32_Process -Filter "Name = 'msedgewebview2.exe'" |
        Where-Object { $_.ParentProcessId -eq $client.Id -and $_.CommandLine -notmatch '--type=' }
    if ($ownedBrowser.ExecutablePath) {
        Write-Host "WebView2 version: $((Get-Item -LiteralPath $ownedBrowser.ExecutablePath).VersionInfo.FileVersion)"
    }
    if (-not (Cdp 'navigate' 'http://127.0.0.1:8085/ready')) { throw 'Initial fixture navigation failed' }
    Wait-Check { Cdp 'ready' } 'ready before attachment download'
    $downloadDir = New-Item -ItemType Directory -Force (Join-Path $out.FullName 'downloads')
    if (-not (Cdp 'download' $downloadDir.FullName)) { throw 'Attachment navigation failed' }
    $downloadFile = Join-Path $downloadDir.FullName 'tm-client-audit.txt'
    Wait-Check { Test-Path -LiteralPath $downloadFile } 'real WebView attachment file received'
    if ([IO.File]::ReadAllText($downloadFile) -ne 'TongMu native download fixture') { throw 'Unexpected downloaded bytes' }
    Start-Sleep -Seconds 3
    Capture '00-attachment-download'
    if ($null -ne (Native-Button '重新打开')) { throw 'A legitimate attachment download was treated as whole-app failure' }
    if (-not (Cdp 'download-ready')) { throw 'Download discarded the current document' }
    Write-Host 'PASS: attachment download keeps the current document without native error'
    if (-not (Cdp 'navigate' 'http://127.0.0.1:8085/unavailable')) { throw 'Navigate failed' }
    Wait-Check { $null -ne (Native-Button '重新打开') } 'HTTP 503 native recovery'
    Capture '01-http-native'
    if ($null -eq (Native-Button '查看详情')) { throw 'Collapsed details has the wrong native label' }
    Click-Native '查看详情'
    Wait-Check { $null -ne (Native-Button '收起详情') } 'expanded details native label'
    Capture '01-http-expanded'
    Click-Native '收起详情'
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
    Set-CiPolicy 'BrowserExecutableFolder' (Join-Path $env:RUNNER_TEMP 'tm-deliberately-missing-runtime')
    $client = Start-Process -FilePath $exePath -PassThru
    $cancelCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty, '2')
    Wait-Check { $null -ne (Native-Element $cancelCondition) } 'startup failure has native Cancel without WebView'
    Capture '09-startup-native'
    $retryCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty, '4')
    $startupPid = $client.Id
    Clear-CiPolicy 'BrowserExecutableFolder'
    $retry = Native-Element $retryCondition
    if ($null -eq $retry) { throw 'Startup fallback has no Retry button' }
    $retry.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    Wait-Check { Cdp 'local' } 'startup Retry continues after runtime is available'
    if ($client.Id -ne $startupPid -or $client.HasExited) { throw 'Startup Retry unexpectedly lost the host' }
    Capture '10-startup-repaired'
    Stop-Process -Id $client.Id -Force
    $client.WaitForExit()
    Set-CiPolicy 'BrowserExecutableFolder' (Join-Path $env:RUNNER_TEMP 'tm-deliberately-missing-runtime')
    $client = Start-Process -FilePath $exePath -PassThru
    Wait-Check { $null -ne (Native-Element $cancelCondition) } 'startup failure Cancel available on next launch'
    $cancel = Native-Element $cancelCondition
    $cancel.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    Wait-Check { $client.HasExited } 'startup fallback Cancel exits client'
    'HTTP retry, actual renderer crash, same host PID, network settings, browser restart and runtime startup fallback passed.' |
        Set-Content (Join-Path $out.FullName 'result.txt')
} finally {
    try { Capture 'final' } catch { Write-Warning "Final screenshot unavailable: $_" }
    if ($client -and -not $client.HasExited) { Stop-Process -Id $client.Id -Force -ErrorAction SilentlyContinue }
    if ($fixture -and -not $fixture.HasExited) { Stop-Process -Id $fixture.Id -Force -ErrorAction SilentlyContinue }
    foreach ($key in $createdPolicies) {
        Remove-ItemProperty -LiteralPath $key -Name $exeName -ErrorAction Continue
    }
}
