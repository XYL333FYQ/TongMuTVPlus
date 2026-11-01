// Platform-independent recovery gate; verified with rustc --test on CI.
#[derive(Clone, Copy, Debug)]
pub enum Failure {
    Navigation,
    RendererExit,
    RendererUnresponsive,
    BrowserExit,
    GpuExit,
    SubframeExit,
    UtilityExit,
}

#[derive(Default)]
pub struct RecoveryGate {
    handled: bool,
    restart: bool,
}

impl RecoveryGate {
    pub fn offer(&mut self, failure: Failure) -> bool {
        if matches!(
            failure,
            Failure::GpuExit | Failure::SubframeExit | Failure::UtilityExit
        ) {
            return false;
        }
        if matches!(failure, Failure::BrowserExit) {
            self.restart = true;
        }
        if self.handled {
            return false;
        }
        self.handled = true;
        true
    }

    pub fn restart_required(&self) -> bool {
        self.restart
    }
    pub fn has_failure(&self) -> bool {
        self.handled
    }

    pub fn retry(&mut self) {
        self.handled = false;
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum AbortDecision {
    Download,
    Pending,
    Untracked,
}

// Only one current main-frame navigation is retained, never a URL history.
#[derive(Default)]
pub struct DownloadNavigation {
    id: u64,
    uri: String,
    download: bool,
    pending: bool,
}

impl DownloadNavigation {
    pub fn start(&mut self, id: u64, uri: &str) {
        let uri = uri.split('#').next().unwrap_or("");
        let uri = if uri.len() <= 8192 { uri } else { "" };
        if self.id != id || self.uri != uri {
            self.download = false;
            self.pending = false;
        }
        self.id = id;
        self.uri = uri.into();
    }

    pub fn matches_uri(&self, uri: &str) -> bool {
        let uri = uri.split('#').next().unwrap_or("");
        !self.uri.is_empty() && self.uri == uri
    }

    pub fn download_started(&mut self, uri: &str) -> bool {
        if !self.matches_uri(uri) {
            return false;
        }
        self.download = true;
        self.pending = false;
        true
    }

    pub fn attachment_response(&mut self, uri: &str, disposition: &str) -> bool {
        if disposition.len() > 8192
            || disposition
                .bytes()
                .any(|byte| byte == 127 || (byte < 32 && byte != b'\t'))
            || !disposition
                .split(';')
                .next()
                .unwrap_or("")
                .trim()
                .eq_ignore_ascii_case("attachment")
        {
            return false;
        }
        self.download_started(uri)
    }

    pub fn aborted(&mut self, id: u64) -> AbortDecision {
        if self.id != id || id == 0 {
            return AbortDecision::Untracked;
        }
        if self.download {
            return AbortDecision::Download;
        }
        self.pending = true;
        AbortDecision::Pending
    }

    pub fn report_abort(&mut self, id: u64) -> bool {
        if self.id != id {
            return false;
        }
        let pending = std::mem::take(&mut self.pending);
        pending && !self.download
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn automatic_gpu_and_subframe_recovery_does_not_replace_the_application() {
        let mut gate = RecoveryGate::default();
        for cause in [
            Failure::GpuExit,
            Failure::SubframeExit,
            Failure::UtilityExit,
        ] {
            assert!(!gate.offer(cause));
        }
        assert!(!gate.restart_required());
    }

    #[test]
    fn main_renderer_failure_gets_one_native_prompt_without_a_restart_requirement() {
        let mut gate = RecoveryGate::default();
        assert!(gate.offer(Failure::RendererExit));
        assert!(!gate.offer(Failure::RendererExit));
        assert!(!gate.restart_required());
    }

    #[test]
    fn browser_failure_upgrades_an_open_renderer_prompt_to_restart() {
        let mut gate = RecoveryGate::default();
        assert!(gate.offer(Failure::RendererExit));
        assert!(!gate.offer(Failure::BrowserExit));
        assert!(gate.restart_required());
    }

    #[test]
    fn explicit_retry_can_open_a_new_prompt_but_ordinary_error_callbacks_cannot() {
        let mut gate = RecoveryGate::default();
        assert!(gate.offer(Failure::Navigation));
        assert!(!gate.offer(Failure::Navigation));
        gate.retry();
        assert!(gate.offer(Failure::RendererUnresponsive));
    }

    #[test]
    fn a_confirmed_download_is_not_a_page_failure_in_either_callback_order() {
        for download_first in [true, false] {
            let mut nav = DownloadNavigation::default();
            nav.start(1, "https://fixture.test/file#fragment");
            if download_first {
                assert!(nav.download_started("https://fixture.test/file"));
                assert_eq!(nav.aborted(1), AbortDecision::Download);
            } else {
                assert_eq!(nav.aborted(1), AbortDecision::Pending);
                assert!(nav.download_started("https://fixture.test/file"));
            }
            assert!(!nav.report_abort(1));
        }
    }

    #[test]
    fn a_real_abort_is_reported_once_and_unrelated_downloads_cannot_mask_it() {
        let mut nav = DownloadNavigation::default();
        nav.start(2, "https://fixture.test/page");
        assert_eq!(nav.aborted(2), AbortDecision::Pending);
        assert!(!nav.download_started("https://fixture.test/other"));
        assert!(nav.report_abort(2));
        assert!(!nav.report_abort(2));
    }

    #[test]
    fn attachment_headers_confirm_only_the_current_download_before_its_late_event() {
        let mut nav = DownloadNavigation::default();
        nav.start(20, "https://fixture.test/file");
        assert_eq!(nav.aborted(20), AbortDecision::Pending);
        assert!(nav.attachment_response(
            "https://fixture.test/file",
            " ATTACHMENT ; filename=\"a;b.txt\""
        ));
        assert!(!nav.report_abort(20));
        assert!(nav.download_started("https://fixture.test/file"));
        nav.start(21, "https://fixture.test/page");
        assert_eq!(nav.aborted(21), AbortDecision::Pending);
        assert!(!nav.attachment_response("https://fixture.test/file", "attachment"));
        assert!(nav.report_abort(21));
    }

    #[test]
    fn inline_malformed_or_oversized_headers_cannot_hide_a_connection_failure() {
        for header in [
            "inline; filename=attachment",
            "attachment-other; filename=x",
            "attachment\r\nInjected: value",
            "attachment\0",
            &format!("attachment; filename={}", "x".repeat(8192)),
        ] {
            let mut nav = DownloadNavigation::default();
            nav.start(22, "https://fixture.test/file");
            assert_eq!(nav.aborted(22), AbortDecision::Pending);
            assert!(!nav.attachment_response("https://fixture.test/file", header));
            assert!(nav.report_abort(22));
        }
    }

    #[test]
    fn replacement_navigation_cannot_inherit_a_download_or_late_failure() {
        let mut nav = DownloadNavigation::default();
        nav.start(3, "https://fixture.test/file");
        assert!(nav.download_started("https://fixture.test/file"));
        nav.start(4, "https://fixture.test/file");
        assert_eq!(nav.aborted(4), AbortDecision::Pending);
        assert!(!nav.report_abort(3));
        assert!(nav.report_abort(4));
        nav.start(5, "https://fixture.test/page");
        assert_eq!(nav.aborted(5), AbortDecision::Pending);
        nav.start(6, "https://fixture.test/next");
        assert!(!nav.report_abort(5));
    }

    #[test]
    fn redirects_only_match_the_latest_uri_and_untracked_aborts_are_not_ignored() {
        let mut nav = DownloadNavigation::default();
        assert_eq!(nav.aborted(7), AbortDecision::Untracked);
        nav.start(7, "https://fixture.test/redirect");
        nav.start(7, "https://fixture.test/final");
        assert!(!nav.download_started("https://fixture.test/redirect"));
        assert_eq!(nav.aborted(7), AbortDecision::Pending);
        assert!(nav.download_started("https://fixture.test/final"));
        assert!(!nav.report_abort(7));
        nav.start(8, &"x".repeat(8193));
        assert!(!nav.download_started(&"x".repeat(8193)));
        assert_eq!(nav.aborted(8), AbortDecision::Pending);
        assert!(nav.report_abort(8));
    }
}
