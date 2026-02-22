use crate::audio_capture::{AudioCaptureState, AudioInputDevice};
use base64::{engine::general_purpose, Engine as _};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, HostId, SampleFormat, StreamConfig};
use hound::{WavSpec, WavWriter};
use std::io::Cursor;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

#[derive(Clone)]
struct EnumeratedInputDevice {
    id: String,
    name: String,
    is_default: bool,
    is_loopback: bool,
    host: String,
    device: Device,
}

pub async fn start_capture(
    state: &AudioCaptureState,
    max_duration_secs: u32,
    selected_device_id: Option<String>,
) -> Result<(), String> {
    state.reset();

    let samples = state.samples.clone();
    let sample_rate_arc = state.sample_rate.clone();
    let channels_arc = state.channels.clone();
    let stop_tx = state.stop_tx.clone();
    let error_arc = state.error.clone();

    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_flag_clone = stop_flag.clone();

    let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(1);
    *stop_tx.lock().unwrap() = Some(tx);

    tokio::spawn(async move {
        rx.recv().await;
        stop_flag_clone.store(true, Ordering::Relaxed);
    });

    thread::spawn(move || {
        let (device, device_name, used_loopback) =
            match select_input_device(selected_device_id.as_deref()) {
            Ok(result) => result,
            Err(e) => {
                *error_arc.lock().unwrap() = Some(e);
                return;
            }
            };

        let source_type = if used_loopback { "loopback/monitor" } else { "microphone/input" };
        eprintln!(
            "Linux audio capture: using {} source '{}'",
            source_type, device_name
        );

        let supported_config = match device.default_input_config() {
            Ok(config) => config,
            Err(e) => {
                *error_arc.lock().unwrap() = Some(format!(
                    "Failed to get default input config for '{}': {}",
                    device_name, e
                ));
                return;
            }
        };

        let sample_rate = supported_config.sample_rate().0;
        let channels = supported_config.channels();
        *sample_rate_arc.lock().unwrap() = sample_rate;
        *channels_arc.lock().unwrap() = channels;

        let config = StreamConfig {
            channels,
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Default,
        };

        let stream_error_arc = error_arc.clone();
        let stream_error_device_name = device_name.clone();
        let err_fn = move |err| {
            let msg = format!(
                "Audio input stream error on '{}': {}",
                stream_error_device_name, err
            );
            eprintln!("{}", msg);
            *stream_error_arc.lock().unwrap() = Some(msg);
        };

        let stream_result = match supported_config.sample_format() {
            SampleFormat::F32 => {
                let samples = samples.clone();
                device.build_input_stream(
                    &config,
                    move |data: &[f32], _| {
                        let mut guard = samples.lock().unwrap();
                        guard.extend_from_slice(data);
                    },
                    err_fn,
                    None,
                )
            }
            SampleFormat::I16 => {
                let samples = samples.clone();
                device.build_input_stream(
                    &config,
                    move |data: &[i16], _| {
                        let mut guard = samples.lock().unwrap();
                        guard.extend(data.iter().map(|s| *s as f32 / i16::MAX as f32));
                    },
                    err_fn,
                    None,
                )
            }
            SampleFormat::U16 => {
                let samples = samples.clone();
                device.build_input_stream(
                    &config,
                    move |data: &[u16], _| {
                        let mut guard = samples.lock().unwrap();
                        guard.extend(
                            data.iter()
                                .map(|s| (*s as f32 / u16::MAX as f32) * 2.0 - 1.0),
                        );
                    },
                    err_fn,
                    None,
                )
            }
            other => {
                *error_arc.lock().unwrap() = Some(format!(
                    "Unsupported Linux input sample format on '{}': {:?}",
                    device_name, other
                ));
                return;
            }
        };

        let stream = match stream_result {
            Ok(stream) => stream,
            Err(e) => {
                *error_arc.lock().unwrap() = Some(format!(
                    "Failed to build Linux input stream for '{}': {}",
                    device_name, e
                ));
                return;
            }
        };

        if let Err(e) = stream.play() {
            *error_arc.lock().unwrap() = Some(format!(
                "Failed to start Linux input stream for '{}': {}",
                device_name, e
            ));
            return;
        }

        while !stop_flag.load(Ordering::Relaxed) {
            thread::sleep(std::time::Duration::from_millis(50));
        }

        drop(stream);
    });

    let stop_tx_clone = state.stop_tx.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(max_duration_secs as u64)).await;
        let tx = stop_tx_clone.lock().unwrap().take();
        if let Some(tx) = tx {
            let _ = tx.send(()).await;
        }
    });

    Ok(())
}

pub async fn stop_capture(state: &AudioCaptureState) -> Result<String, String> {
    if let Some(tx) = state.stop_tx.lock().unwrap().take() {
        let _ = tx.send(());
    }

    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

    if let Some(error) = state.error.lock().unwrap().as_ref() {
        return Err(error.clone());
    }

    let samples = state.samples.lock().unwrap().clone();
    let sample_rate = *state.sample_rate.lock().unwrap();
    let channels = *state.channels.lock().unwrap();

    if samples.is_empty() {
        return Err(
            "No audio samples captured. On WSL2, verify host microphone access is enabled for WSL/WSLg."
                .to_string(),
        );
    }

    let wav_data = samples_to_wav(&samples, sample_rate, channels)?;
    let base64_data = general_purpose::STANDARD.encode(&wav_data);
    Ok(base64_data)
}

pub fn is_supported() -> bool {
    enumerate_input_devices()
        .map(|devices| !devices.is_empty())
        .unwrap_or(false)
}

pub fn list_input_devices() -> Result<Vec<AudioInputDevice>, String> {
    let devices = enumerate_input_devices()?;
    Ok(devices
        .into_iter()
        .map(|device| AudioInputDevice {
            id: device.id,
            name: device.name,
            is_default: device.is_default,
            availability: "available".to_string(),
            permission_state: "unknown".to_string(),
            host: Some(device.host),
            diagnostics: if device.is_loopback {
                Some("loopback_source".to_string())
            } else {
                None
            },
        })
        .collect())
}

fn select_input_device(selected_device_id: Option<&str>) -> Result<(Device, String, bool), String> {
    let devices = enumerate_input_devices()?;

    if let Some(selected_id) = selected_device_id {
        if let Some(candidate) = devices.iter().find(|d| d.id == selected_id) {
            return Ok((
                candidate.device.clone(),
                candidate.name.clone(),
                candidate.is_loopback,
            ));
        }
        return Err(format!(
            "Selected input device '{}' is not available. Refresh the device list and try again.",
            selected_id
        ));
    }

    if let Some(candidate) = devices.iter().find(|d| d.is_default) {
        return Ok((
            candidate.device.clone(),
            candidate.name.clone(),
            candidate.is_loopback,
        ));
    }

    if let Some(candidate) = devices.iter().find(|d| d.is_loopback) {
        return Ok((
            candidate.device.clone(),
            candidate.name.clone(),
            candidate.is_loopback,
        ));
    }

    if let Some(candidate) = devices.first() {
        return Ok((
            candidate.device.clone(),
            candidate.name.clone(),
            candidate.is_loopback,
        ));
    }

    Err(
        "No Linux input devices found. If running in WSL2, ensure WSLg/PulseAudio is available and the host microphone is enabled."
            .to_string(),
    )
}

fn enumerate_input_devices() -> Result<Vec<EnumeratedInputDevice>, String> {
    let host_ids = cpal::available_hosts();
    let mut result = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    for host_id in host_ids {
        let host = match cpal::host_from_id(host_id) {
            Ok(host) => host,
            Err(e) => {
                warnings.push(format!("host {:?} unavailable: {}", host_id, e));
                continue;
            }
        };

        let default_name = host.default_input_device().and_then(|d| d.name().ok());
        let devices = match host.input_devices() {
            Ok(devices) => devices,
            Err(e) => {
                warnings.push(format!("host {:?} input enumeration failed: {}", host_id, e));
                continue;
            }
        };

        for (index, device) in devices.enumerate() {
            let raw_name = device
                .name()
                .unwrap_or_else(|_| "Unknown input device".to_string());
            let id = build_input_device_id(host_id, index, &raw_name);
            let is_default = default_name
                .as_ref()
                .map(|default| default == &raw_name)
                .unwrap_or(false);

            // Include host label to avoid ambiguity between duplicated device names.
            let display_name = format!("{} [{}]", raw_name, format!("{:?}", host_id));

            result.push(EnumeratedInputDevice {
                id,
                name: display_name,
                is_default,
                is_loopback: is_loopback_source(&raw_name),
                host: format!("{:?}", host_id),
                device,
            });
        }
    }

    if result.is_empty() {
        let pulse_server = std::env::var("PULSE_SERVER").ok();
        let pulse_plugin_missing = pulse_server.is_some() && !alsa_pulse_plugin_installed();
        let warning_suffix = if warnings.is_empty() {
            String::new()
        } else {
            format!(" Details: {}", warnings.join("; "))
        };
        let mut message = format!(
            "No Linux input devices found across CPAL hosts. On WSL2, ensure WSLg/PulseAudio is available and Windows microphone privacy access is enabled for desktop apps."
        );
        if pulse_plugin_missing {
            message.push_str(" ALSA Pulse plugin is missing. Install it in WSL: sudo apt-get update && sudo apt-get install -y libasound2-plugins pulseaudio-utils alsa-utils");
        }
        message.push_str(&warning_suffix);
        return Err(message);
    }

    Ok(result)
}

fn alsa_pulse_plugin_installed() -> bool {
    std::path::Path::new("/usr/lib/x86_64-linux-gnu/alsa-lib/libasound_module_pcm_pulse.so")
        .exists()
        || std::path::Path::new("/usr/lib64/alsa-lib/libasound_module_pcm_pulse.so").exists()
}

fn build_input_device_id(host_id: HostId, index: usize, name: &str) -> String {
    let mut slug = String::with_capacity(name.len());
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
        } else {
            slug.push('_');
        }
    }
    while slug.contains("__") {
        slug = slug.replace("__", "_");
    }
    let slug = slug.trim_matches('_').to_string();
    let host_slug = format!("{:?}", host_id).to_lowercase();
    format!("input_{}_{}_{}", host_slug, index, slug)
}

fn is_loopback_source(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("monitor")
        || lower.contains("loopback")
        || lower.contains("stereo mix")
        || lower.contains("what u hear")
}

fn samples_to_wav(samples: &[f32], sample_rate: u32, channels: u16) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();
    let cursor = Cursor::new(&mut buffer);

    let spec = WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = WavWriter::new(cursor, spec)
        .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

    for sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let i16_sample = (clamped * 32767.0) as i16;
        writer
            .write_sample(i16_sample)
            .map_err(|e| format!("Failed to write WAV sample: {}", e))?;
    }

    writer
        .finalize()
        .map_err(|e| format!("Failed to finalize WAV data: {}", e))?;

    Ok(buffer)
}
