//! Sonic Daemon Lifecycle Manager
//!
//! Manages the Sonic search daemon as a child process of the Tauri app.
//! Provides start/stop/restart with health checks and exponential backoff auto-restart.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Sonic daemon state managed across the application lifetime
pub struct SonicDaemonState {
    inner: Mutex<SonicDaemonInner>,
}

struct SonicDaemonInner {
    process: Option<Child>,
    restart_count: u32,
    last_start: Option<Instant>,
    config_path: PathBuf,
    binary_path: PathBuf,
    store_path: PathBuf,
}

/// Default Sonic port
const SONIC_PORT: u16 = 1491;
/// Maximum restart attempts before giving up
const MAX_RESTART_ATTEMPTS: u32 = 5;
/// Base backoff delay in milliseconds
const BASE_BACKOFF_MS: u64 = 500;
/// Maximum wait time for Sonic to become ready (ms)
const STARTUP_TIMEOUT_MS: u64 = 10_000;
/// Health check connection timeout
const HEALTH_CHECK_TIMEOUT_MS: u64 = 2_000;

impl SonicDaemonState {
    /// Create a new daemon state with paths resolved relative to the app
    pub fn new(app_data_dir: PathBuf, sonic_binary: PathBuf, config_template: PathBuf) -> Self {
        let store_path = app_data_dir.join("sonic-index");
        Self {
            inner: Mutex::new(SonicDaemonInner {
                process: None,
                restart_count: 0,
                last_start: None,
                config_path: config_template,
                binary_path: sonic_binary,
                store_path,
            }),
        }
    }

    /// Start the Sonic daemon process
    pub fn start(&self) -> Result<String, String> {
        let mut inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;

        // Check if already running
        if inner.process.is_some() && is_port_ready(SONIC_PORT) {
            return Ok("Sonic daemon already running".to_string());
        }

        // Ensure store directories exist
        let kv_path = inner.store_path.join("kv");
        let fst_path = inner.store_path.join("fst");
        std::fs::create_dir_all(&kv_path)
            .map_err(|e| format!("Failed to create KV store dir: {}", e))?;
        std::fs::create_dir_all(&fst_path)
            .map_err(|e| format!("Failed to create FST store dir: {}", e))?;

        // Generate runtime config with resolved paths
        let runtime_config = generate_runtime_config(&inner.config_path, &inner.store_path)?;
        let runtime_config_path = inner.store_path.join("sonic-runtime.cfg");
        std::fs::write(&runtime_config_path, runtime_config)
            .map_err(|e| format!("Failed to write runtime config: {}", e))?;

        // Launch Sonic binary
        let child = Command::new(&inner.binary_path)
            .arg("-c")
            .arg(&runtime_config_path)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start Sonic daemon: {}", e))?;

        let pid = child.id();
        inner.process = Some(child);
        inner.last_start = Some(Instant::now());

        // Wait for daemon to become ready
        let ready = wait_for_ready(SONIC_PORT, STARTUP_TIMEOUT_MS);
        if ready {
            inner.restart_count = 0;
            Ok(format!("Sonic daemon started (PID: {})", pid))
        } else {
            // Kill the process if it didn't become ready
            if let Some(ref mut proc) = inner.process {
                let _ = proc.kill();
            }
            inner.process = None;
            Err("Sonic daemon started but did not become ready within timeout".to_string())
        }
    }

    /// Stop the Sonic daemon gracefully
    pub fn stop(&self) -> Result<String, String> {
        let mut inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;

        if let Some(ref mut process) = inner.process {
            // Try graceful shutdown via QUIT command on the channel
            let _ = send_quit_command();

            // Give it a moment to shut down gracefully
            std::thread::sleep(Duration::from_millis(500));

            // Check if it exited
            match process.try_wait() {
                Ok(Some(_status)) => {
                    inner.process = None;
                    Ok("Sonic daemon stopped gracefully".to_string())
                }
                Ok(None) => {
                    // Still running, force kill
                    process.kill().map_err(|e| format!("Failed to kill Sonic: {}", e))?;
                    let _ = process.wait();
                    inner.process = None;
                    Ok("Sonic daemon force-killed".to_string())
                }
                Err(e) => {
                    inner.process = None;
                    Err(format!("Error checking Sonic process status: {}", e))
                }
            }
        } else {
            Ok("Sonic daemon was not running".to_string())
        }
    }

    /// Restart the Sonic daemon with exponential backoff
    pub fn restart(&self) -> Result<String, String> {
        self.stop()?;

        let backoff = {
            let inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;
            if inner.restart_count >= MAX_RESTART_ATTEMPTS {
                return Err(format!(
                    "Max restart attempts ({}) reached. Manual intervention required.",
                    MAX_RESTART_ATTEMPTS
                ));
            }
            let delay = BASE_BACKOFF_MS * 2u64.pow(inner.restart_count);
            delay.min(10_000) // Cap at 10 seconds
        };

        std::thread::sleep(Duration::from_millis(backoff));

        {
            let mut inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;
            inner.restart_count += 1;
        }

        self.start()
    }

    /// Check health of the Sonic daemon
    pub fn health_check(&self) -> Result<SonicHealth, String> {
        let inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;

        let port_open = is_port_ready(SONIC_PORT);
        let process_alive = if let Some(ref _proc) = inner.process {
            true // Process handle exists
        } else {
            false
        };

        // Try a PING on the channel for full health verification
        let responds_to_ping = if port_open { check_sonic_ping() } else { false };

        let status = if port_open && responds_to_ping {
            "healthy"
        } else if process_alive && !port_open {
            "starting"
        } else {
            "unavailable"
        };

        Ok(SonicHealth {
            status: status.to_string(),
            port_open,
            process_alive,
            responds_to_ping,
            restart_count: inner.restart_count,
        })
    }

    /// Auto-restart if daemon has crashed (called periodically)
    pub fn ensure_running(&self) -> Result<(), String> {
        let needs_restart = {
            let mut inner = self.inner.lock().map_err(|e| format!("Lock error: {}", e))?;
            if let Some(ref mut process) = inner.process {
                match process.try_wait() {
                    Ok(Some(_)) => {
                        // Process has exited
                        inner.process = None;
                        true
                    }
                    Ok(None) => {
                        // Still running, but check if port is responsive
                        !is_port_ready(SONIC_PORT)
                    }
                    Err(_) => true,
                }
            } else {
                // No process tracked — check if something is listening on port
                !is_port_ready(SONIC_PORT)
            }
        };

        if needs_restart {
            eprintln!("Sonic daemon not responding, attempting restart...");
            self.restart().map(|_| ())
        } else {
            Ok(())
        }
    }
}

impl Drop for SonicDaemonState {
    fn drop(&mut self) {
        if let Ok(mut inner) = self.inner.lock() {
            if let Some(ref mut process) = inner.process {
                let _ = send_quit_command();
                std::thread::sleep(Duration::from_millis(300));
                let _ = process.kill();
                let _ = process.wait();
            }
        }
    }
}

/// Health status returned by health check
#[derive(serde::Serialize, Clone, Debug)]
pub struct SonicHealth {
    pub status: String,
    pub port_open: bool,
    pub process_alive: bool,
    pub responds_to_ping: bool,
    pub restart_count: u32,
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn start_sonic(
    state: tauri::State<'_, SonicDaemonState>,
) -> Result<String, String> {
    state.start()
}

#[tauri::command]
pub async fn stop_sonic(
    state: tauri::State<'_, SonicDaemonState>,
) -> Result<String, String> {
    state.stop()
}

#[tauri::command]
pub async fn sonic_health(
    state: tauri::State<'_, SonicDaemonState>,
) -> Result<SonicHealth, String> {
    state.health_check()
}

// --- Helper Functions ---

/// Check if Sonic port is accepting connections
fn is_port_ready(port: u16) -> bool {
    let addr = format!("[::1]:{}", port);
    TcpStream::connect_timeout(
        &addr.parse().unwrap_or_else(|_| {
            format!("127.0.0.1:{}", port).parse().unwrap()
        }),
        Duration::from_millis(HEALTH_CHECK_TIMEOUT_MS),
    )
    .is_ok()
}

/// Wait for Sonic to become ready on its port
fn wait_for_ready(port: u16, timeout_ms: u64) -> bool {
    let start = Instant::now();
    let timeout = Duration::from_millis(timeout_ms);

    while start.elapsed() < timeout {
        if is_port_ready(port) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    false
}

/// Send QUIT command to Sonic to trigger graceful shutdown
fn send_quit_command() -> Result<(), String> {
    let addr = format!("[::1]:{}", SONIC_PORT);
    let mut stream = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Parse error: {}", e))?,
        Duration::from_millis(HEALTH_CHECK_TIMEOUT_MS),
    )
    .map_err(|e| format!("Connect error: {}", e))?;

    stream
        .set_read_timeout(Some(Duration::from_millis(2000)))
        .ok();
    stream
        .set_write_timeout(Some(Duration::from_millis(2000)))
        .ok();

    // Read the CONNECTED banner
    let mut buf = [0u8; 256];
    let _ = stream.read(&mut buf);

    // Send QUIT directly (works in uninitialized mode too)
    stream
        .write_all(b"QUIT\n")
        .map_err(|e| format!("Write error: {}", e))?;

    Ok(())
}

/// Verify Sonic responds to PING via search channel
fn check_sonic_ping() -> bool {
    let addr = format!("[::1]:{}", SONIC_PORT);
    let stream = TcpStream::connect_timeout(
        &match addr.parse() {
            Ok(a) => a,
            Err(_) => return false,
        },
        Duration::from_millis(HEALTH_CHECK_TIMEOUT_MS),
    );

    let mut stream = match stream {
        Ok(s) => s,
        Err(_) => return false,
    };

    stream
        .set_read_timeout(Some(Duration::from_millis(2000)))
        .ok();
    stream
        .set_write_timeout(Some(Duration::from_millis(2000)))
        .ok();

    // Read CONNECTED banner
    let mut buf = [0u8; 512];
    if stream.read(&mut buf).is_err() {
        return false;
    }

    // Start search mode
    if stream
        .write_all(b"START search maestro_scaffolder_key\n")
        .is_err()
    {
        return false;
    }

    // Read STARTED response
    let mut buf = [0u8; 512];
    if stream.read(&mut buf).is_err() {
        return false;
    }

    // Send PING
    if stream.write_all(b"PING\n").is_err() {
        return false;
    }

    // Read PONG
    let mut buf = [0u8; 64];
    match stream.read(&mut buf) {
        Ok(n) => {
            let response = String::from_utf8_lossy(&buf[..n]);
            response.contains("PONG")
        }
        Err(_) => false,
    }
}

/// Generate a runtime configuration file with resolved storage paths
fn generate_runtime_config(template_path: &PathBuf, store_path: &PathBuf) -> Result<String, String> {
    let template = std::fs::read_to_string(template_path)
        .map_err(|e| format!("Failed to read config template '{}': {}", template_path.display(), e))?;

    let store_str = store_path.to_string_lossy();
    let resolved = template.replace("${SONIC_STORE_PATH}", &store_str);

    Ok(resolved)
}
