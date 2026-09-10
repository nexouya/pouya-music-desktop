use std::sync::Arc;

use crate::core::Core;

/// Managed Tauri state: the Rust core + HTTP base URL for the UI.
pub struct AppState {
    pub core: Arc<Core>,
    api_base: parking_lot::RwLock<String>,
}

impl AppState {
    pub fn new(core: Arc<Core>) -> Self {
        Self {
            core,
            api_base: parking_lot::RwLock::new("http://127.0.0.1:0".into()),
        }
    }

    pub fn set_api_port(&self, port: u16) {
        *self.api_base.write() = format!("http://127.0.0.1:{port}");
    }

    pub fn api_base(&self) -> String {
        self.api_base.read().clone()
    }
}
