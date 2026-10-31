// Platform-independent recovery gate; verified with rustc --test on CI.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn automatic_gpu_and_subframe_recovery_does_not_replace_the_application() {
        let mut gate = RecoveryGate::default();
        for cause in [Failure::GpuExit, Failure::SubframeExit, Failure::UtilityExit] {
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
}
