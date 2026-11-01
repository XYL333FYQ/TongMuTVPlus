param([Parameter(Mandatory)][string]$Executable)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'This fault-injection script is only for a disposable GitHub runner.' }
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms, System.Drawing
$out = New-Item -ItemType Directory -Force 'recovery-out'
$driver = Join-Path $PSScriptRoot 'recovery-cdp.cjs'
$fixture = $null
$client = $null
$tlsDir = $null
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
    # A restarted GUI can be behind the runner's terminal even when its page is
    # ready. Activate only our enabled, onscreen window for visual inspection;
    # this is a test interaction, not proof of automatic foreground activation.
    if ($client -and -not $client.HasExited) {
        try {
            $owned = [System.Windows.Automation.PropertyCondition]::new(
                [System.Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$client.Id)
            $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
                [System.Windows.Automation.TreeScope]::Children, $owned)
            foreach ($window in $windows) {
                if ($window.Current.IsEnabled -and -not $window.Current.IsOffscreen) {
                    $window.SetFocus()
                    Write-Host "Screenshot activation: $Name"
                    Start-Sleep -Milliseconds 150
                    break
                }
            }
        } catch { Write-Warning "Screenshot window activation unavailable: $_" }
    }
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
function Wait-Check([scriptblock]$Check, [string]$Label, [int]$Seconds = 35) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
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
function Save-OwnedDownload([string]$Destination) {
    $english = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::NameProperty, 'Save As')
    $chinese = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::NameProperty, '另存为')
    $names = [System.Windows.Automation.OrCondition]::new($english, $chinese)
    $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
        [System.Windows.Automation.TreeScope]::Children, $names)
    foreach ($dialog in $windows) {
        $ownerId = $dialog.Current.ProcessId
        $owned = $false
        for ($depth = 0; $depth -lt 8 -and $ownerId -gt 0; $depth++) {
            if ($ownerId -eq $client.Id) { $owned = $true; break }
            $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerId"
            if (-not $process) { break }
            $ownerId = $process.ParentProcessId
        }
        if (-not $owned) { continue }
        Capture '00-native-save-dialog'
        $editType = [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Edit)
        $edits = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editType)
        $filename = @($edits | Where-Object { $_.Current.AutomationId -eq '1001' -or $_.Current.Name -eq 'File name:' })
        if ($filename.Count -ne 1) { throw 'Cannot identify the owned Save As filename field' }
        $filename[0].GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($Destination)
        $saveId = [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::AutomationIdProperty, '1')
        $save = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $saveId)
        if (-not $save) { throw 'Owned Save As dialog has no Save action' }
        $save.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        return $true
    }
    return $false
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
    $tlsDir = Join-Path $env:RUNNER_TEMP ('tm-native-tls-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tlsDir | Out-Null
    $opensslCommand = Get-Command openssl -ErrorAction SilentlyContinue
    $opensslPath = if ($opensslCommand) { $opensslCommand.Source } else { Join-Path $env:ProgramFiles 'Git/usr/bin/openssl.exe' }
    if (-not (Test-Path -LiteralPath $opensslPath)) { throw 'The CI Git/OpenSSL fixture tool is unavailable' }
    $tlsCert = Join-Path $tlsDir 'cert.pem'
    $tlsKey = Join-Path $tlsDir 'key.pem'
    & $opensslPath req -x509 -newkey rsa:2048 -nodes -keyout $tlsKey -out $tlsCert -subj '/CN=smoke.invalid' -days 1 *> (Join-Path $out.FullName 'tls-setup.log')
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the isolated untrusted TLS fixture' }
    $fixture = Start-Process node -ArgumentList @($driver, 'serve', $tlsCert, $tlsKey) -WindowStyle Hidden -PassThru
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
    $serverAddress = 'http://127.0.0.1:8085'
    Wait-Check { Cdp 'local' } 'local server form ready'
    if (-not (Cdp 'connect' $serverAddress)) { throw 'Actual server form connection failed' }
    Wait-Check { Cdp 'ready' } 'server form connects to the configured server'
    if (-not (Cdp 'navigate' "$serverAddress/seed")) { throw 'Profile fixture seeding failed' }
    Wait-Check { Cdp 'profile' } 'HttpOnly fixture cookie seeded through HTTP'
    Capture '00-profile-configured'
    $firstHostPid = $client.Id
    $firstBrowserPid = $ownedBrowser.ProcessId
    if (-not (Cdp 'close')) { throw 'Injected window Close command failed' }
    Wait-Check { $client.HasExited } 'window Close exits the first host normally'
    Wait-Check { -not (Get-Process -Id $firstBrowserPid -ErrorAction SilentlyContinue) } 'first browser exits and flushes its profile'
    $client = Start-Process -FilePath (Resolve-Path $Executable) -PassThru
    Wait-Check { Cdp 'ready' } 'configured server opens automatically after relaunch'
    if ($client.Id -eq $firstHostPid) { throw 'Relaunch did not create a new host process' }
    Wait-Check { Cdp 'profile' } 'persistent HttpOnly cookie survives normal relaunch'
    Capture '00-profile-relaunched'
    if (-not (Cdp 'popup')) { throw 'Automatic popup probe did not execute' }
    if ((Invoke-RestMethod 'http://127.0.0.1:8085/diagnostics').automaticRequests -ne 0) { throw 'Automatic popup escaped to an external browser' }
    if (-not (Cdp 'external')) { throw 'External link click failed' }
    Wait-Check { $null -ne (Invoke-RestMethod 'http://127.0.0.1:8085/diagnostics').externalReport } 'external link reports from its destination'
    $externalStats = Invoke-RestMethod 'http://127.0.0.1:8085/diagnostics'
    if ($externalStats.externalRequests -lt 1 -or $externalStats.externalReport.webview -or $externalStats.externalReport.desktopBridge) {
        throw 'External content was not opened in a separate system browser'
    }
    if (-not (Cdp 'external-ready')) { throw 'External link discarded the client document' }
    Capture '00-external-return'
    Wait-Check { Cdp 'ready' } 'ready before attachment download'
    $downloadDir = New-Item -ItemType Directory -Force (Join-Path $out.FullName 'downloads')
    $downloadFile = Join-Path $downloadDir.FullName 'native-attachment.txt'
    $defaultDownloadFile = Join-Path $env:USERPROFILE 'Downloads/tm-client-audit.txt'
    if (Test-Path -LiteralPath $defaultDownloadFile) { throw 'Unexpected preexisting fixture file; do not overwrite it' }
    if (-not (Cdp 'download-native' $out.FullName)) { throw 'Native attachment click failed' }
    $script:downloadSaveInvoked = $false
    Wait-Check {
        if ($null -ne (Native-Button '重新打开')) {
            Click-Native '查看详情'
            Capture '00-attachment-native-error'
            throw 'A legitimate attachment download triggered native page recovery'
        }
        if (-not $downloadSaveInvoked) {
            $script:downloadSaveInvoked = Save-OwnedDownload $downloadFile
        }
        (Test-Path -LiteralPath $downloadFile) -or (Test-Path -LiteralPath $defaultDownloadFile)
    } 'real WebView attachment file received'
    if (-not (Test-Path -LiteralPath $downloadFile)) {
        Copy-Item -LiteralPath $defaultDownloadFile -Destination $downloadFile
    }
    if ([IO.File]::ReadAllText($downloadFile) -ne 'TongMu native download fixture') { throw 'Unexpected downloaded bytes' }
    Start-Sleep -Seconds 3
    Capture '00-attachment-download'
    if ($null -ne (Native-Button '重新打开')) { throw 'A legitimate attachment download was treated as whole-app failure' }
    if (-not (Cdp 'download-native-ready')) { throw 'Download discarded the current document' }
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
    Wait-Check { Cdp 'profile' } 'persistent HttpOnly cookie survives renderer recovery'
    Capture '04-renderer-recovered'
    if (-not (Cdp 'navigate' 'http://127.0.0.1:1/')) { throw 'Network navigation failed' }
    Wait-Check { $null -ne (Native-Button '服务器设置') } 'network failure native recovery'
    Capture '05-network-native'
    Click-Native '服务器设置'
    Wait-Check { Cdp 'settings' } 'native recovery opens local settings'
    Capture '06-settings'
    if (-not (Cdp 'navigate' 'https://127.0.0.1:8445/untrusted')) { throw 'TLS navigation failed' }
    Wait-Check { $null -ne (Native-Button '重新打开') } 'untrusted certificate native recovery'
    Click-Native '查看详情'
    $detailCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'ExpandedInformationText')
    $detail = Native-Element $detailCondition
    if (-not $detail -or $detail.Current.Name -notmatch '^连接错误 [1-6]。') { throw 'TLS fixture did not report a certificate error' }
    $stats = Invoke-RestMethod 'http://127.0.0.1:8085/diagnostics'
    if ($stats.tlsRequests -ne 0) { throw 'Untrusted certificate was bypassed' }
    Capture '06a-tls-native'
    Click-Native '服务器设置'
    Wait-Check { Cdp 'settings' } 'TLS failure returns to local settings'
    if (-not (Cdp 'navigate' 'http://127.0.0.1:8085/broken')) { throw 'Broken transport navigation failed' }
    Wait-Check { $null -ne (Native-Button '重新打开') } 'real broken transport still reports native failure'
    Capture '06b-broken-native'
    Click-Native '服务器设置'
    Wait-Check { Cdp 'settings' } 'broken transport returns to local settings'
    if (-not (Cdp 'navigate' 'http://127.0.0.1:8085/ready')) { throw 'Ready before timeout failed' }
    Wait-Check { Cdp 'ready' } 'ready before native timeout'
    $waitingAt = [DateTime]::UtcNow
    if (-not (Cdp 'hang')) { throw 'Hanging navigation did not start' }
    Wait-Check { $null -ne (Native-Button '重新打开') } 'native 40-second watchdog' 55
    $instructionCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'MainInstruction')
    if ((Native-Element $instructionCondition).Current.Name -ne '连接时间较长') { throw 'Unexpected failure instead of watchdog timeout' }
    if (([DateTime]::UtcNow - $waitingAt).TotalSeconds -lt 39) { throw 'Native timeout fired prematurely' }
    $stats = Invoke-RestMethod 'http://127.0.0.1:8085/diagnostics'
    if ($stats.hangingRequests -lt 1 -or $stats.brokenRequests -lt 1) { throw 'Failure fixture was not exercised' }
    Capture '06c-timeout-native'
    Click-Native '服务器设置'
    Wait-Check { Cdp 'settings' } 'native timeout returns to local settings'
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
    Wait-Check { Cdp 'settings' $serverAddress } 'restarted client keeps the configured server in settings'
    Capture '08-browser-restarted-settings'
    if (-not (Cdp 'navigate' "$serverAddress/ready")) { throw 'Profile check navigation after browser restart failed' }
    Wait-Check { Cdp 'profile' } 'persistent HttpOnly cookie survives browser process restart'
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
    Wait-Check { Cdp 'ready' } 'startup Retry returns to the configured server after runtime is available'
    Wait-Check { Cdp 'profile' } 'persistent HttpOnly cookie survives startup recovery'
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
    'Server form, persistent HttpOnly cookie across relaunch and recoveries, default attachment save, same document, HTTP retry, TLS rejection, broken transport, native timeout, renderer recovery, browser restart and runtime startup fallback passed.' |
        Set-Content (Join-Path $out.FullName 'result.txt')
} finally {
    try { Capture 'final' } catch { Write-Warning "Final screenshot unavailable: $_" }
    if ($client -and -not $client.HasExited) { Stop-Process -Id $client.Id -Force -ErrorAction SilentlyContinue }
    if ($fixture -and -not $fixture.HasExited) { Stop-Process -Id $fixture.Id -Force -ErrorAction SilentlyContinue }
    foreach ($key in $createdPolicies) {
        Remove-ItemProperty -LiteralPath $key -Name $exeName -ErrorAction Continue
    }
    if ($tlsDir) {
        foreach ($name in @('cert.pem', 'key.pem')) {
            $file = Join-Path $tlsDir $name
            if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -ErrorAction Continue }
        }
        try { [IO.Directory]::Delete($tlsDir) } catch { Write-Warning "TLS fixture cleanup: $_" }
    }
}
