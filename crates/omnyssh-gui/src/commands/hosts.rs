use tauri::{AppHandle, State};
use tauri_specta::Event;

use omnyssh_core::config::{load_hosts, save_hosts};
use omnyssh_core::ssh::client::Host;

use crate::dto::{HostDto, HostInputDto};
use crate::error::CommandError;
use crate::events;
use crate::state::GuiState;

/// Return the cached host list (populated at startup / on reload, tech-gui.md §4.2).
#[tauri::command]
#[specta::specta]
pub fn list_hosts(state: State<'_, GuiState>) -> Result<Vec<HostDto>, CommandError> {
    Ok(state.host_dtos())
}

/// Trigger an immediate metric poll of every host (tech-gui.md §4.2). Used by the
/// settings-driven refresh cadence (§4.3); a no-op before the pollers start.
#[tauri::command]
#[specta::specta]
pub fn refresh_metrics(state: State<'_, GuiState>) -> Result<(), CommandError> {
    state.refresh_metrics();
    Ok(())
}

/// Reload hosts from the shared config, refresh the cache, restart the pollers,
/// and broadcast the new list via `hosts-loaded` (tech-gui.md §4.2).
#[tauri::command]
#[specta::specta]
pub async fn reload_hosts(app: AppHandle, state: State<'_, GuiState>) -> Result<(), CommandError> {
    // Parsing hosts.toml + ~/.ssh/config is blocking I/O — keep it off the async
    // worker so in-flight commands and the event bridge don't stall.
    let hosts = tauri::async_runtime::spawn_blocking(omnyssh_core::config::load_all_hosts)
        .await
        .map_err(|e| CommandError {
            message: format!("host load task failed: {e}"),
        })?
        .map_err(|e| CommandError {
            message: e.to_string(),
        })?;
    state.set_hosts(hosts);
    state.restart_pollers();
    let _ = events::HostsLoaded(state.host_dtos()).emit(&app);
    Ok(())
}

/// Add, edit, or rename a **manual** host and persist to `hosts.toml` (tech-gui.md
/// §4.2, Stage 4.1). `previous_name` identifies the existing record during an edit,
/// allowing an atomic rename that preserves backend-only secrets and metadata.
/// SSH-config hosts remain read-only imports and are never written.
#[tauri::command]
#[specta::specta]
pub async fn save_host(
    input: HostInputDto,
    previous_name: Option<String>,
) -> Result<(), CommandError> {
    persist(move |hosts| upsert(hosts, input, previous_name.as_deref())).await
}

/// Delete a manual host by name and persist (tech-gui.md §4.2, Stage 4.1). Only manual
/// entries live in `hosts.toml`, so an SSH-config name — or a missing one — is a no-op
/// success: the desired end state (absent) already holds.
#[tauri::command]
#[specta::specta]
pub async fn delete_host(name: String) -> Result<(), CommandError> {
    persist(move |hosts| {
        remove(hosts, &name);
        Ok(())
    })
    .await
}

/// Upsert `input` into the manual host list. A new host appends; an edit locates the
/// record by `previous_name`, so changing the name remains an in-place replacement.
/// Reject a rename collision rather than overwriting another host. Every edit
/// **preserves every active field the form cannot observe**
/// — password, identity file, and proxy jump (the outbound `HostDto` omits all three,
/// §3.4, so the form leaves them blank on edit), plus the SSH-config rename origin.
/// Editing e.g. notes therefore never drops a stored secret. A provided secret still
/// overwrites the old one.
fn upsert(
    hosts: &mut Vec<Host>,
    input: HostInputDto,
    previous_name: Option<&str>,
) -> Result<(), String> {
    let mut host = Host::from(input);
    let lookup_name = previous_name.unwrap_or(&host.name);
    if lookup_name != host.name && hosts.iter().any(|h| h.name == host.name) {
        return Err(format!("A host named \"{}\" already exists", host.name));
    }
    match hosts.iter().position(|h| h.name == lookup_name) {
        Some(i) => {
            let existing = &hosts[i];
            host.password = host.password.or_else(|| existing.password.clone());
            host.identity_file = host
                .identity_file
                .or_else(|| existing.identity_file.clone());
            host.proxy_jump = host.proxy_jump.or_else(|| existing.proxy_jump.clone());
            host.original_ssh_host = existing.original_ssh_host.clone();
            hosts[i] = host;
        }
        None if previous_name.is_some() => {
            return Err(format!("Host \"{lookup_name}\" no longer exists"));
        }
        None => hosts.push(host),
    }
    Ok(())
}

/// Drop the host named `name` from the manual list. A missing name is a no-op — the
/// desired end state (absent) already holds (tech-gui.md §4.2).
fn remove(hosts: &mut Vec<Host>, name: &str) {
    hosts.retain(|h| h.name != name);
}

/// Load the manual host list, apply `mutate`, and write it back off the async worker
/// (parsing + atomic write are blocking I/O). `save_hosts` re-filters to manual, so
/// SSH-config imports are never persisted (tech-gui.md §4.2).
async fn persist(
    mutate: impl FnOnce(&mut Vec<Host>) -> Result<(), String> + Send + 'static,
) -> Result<(), CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut hosts = load_hosts().map_err(|e| e.to_string())?;
        mutate(&mut hosts)?;
        save_hosts(&hosts).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| CommandError {
        message: format!("host save task failed: {e}"),
    })?
    .map_err(|message| CommandError { message })
}

#[cfg(test)]
mod tests {
    use super::*;
    use omnyssh_core::ssh::client::HostSource;

    fn input(name: &str) -> HostInputDto {
        HostInputDto {
            name: name.to_string(),
            hostname: "example.com".to_string(),
            user: "root".to_string(),
            port: 22,
            identity_file: None,
            password: None,
            proxy_jump: None,
            startup_command: None,
            tags: vec![],
            notes: None,
        }
    }

    #[test]
    fn upsert_appends_a_new_manual_host() {
        let mut hosts = vec![];
        upsert(&mut hosts, input("web"), None).unwrap();
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].name, "web");
        assert_eq!(hosts[0].source, HostSource::Manual);
    }

    #[test]
    fn upsert_replaces_editable_fields_in_place() {
        let mut hosts = vec![Host {
            name: "web".to_string(),
            hostname: "old.example.com".to_string(),
            notes: Some("old".to_string()),
            source: HostSource::Manual,
            ..Host::default()
        }];
        let mut edit = input("web");
        edit.hostname = "new.example.com".to_string();
        edit.notes = Some("new".to_string());
        edit.startup_command = Some("ssh nested".to_string());
        upsert(&mut hosts, edit, Some("web")).unwrap();
        assert_eq!(hosts.len(), 1, "edit is in-place, not an append");
        assert_eq!(hosts[0].hostname, "new.example.com");
        assert_eq!(hosts[0].notes.as_deref(), Some("new"));
        assert_eq!(hosts[0].startup_command.as_deref(), Some("ssh nested"));
    }

    #[test]
    fn upsert_preserves_hidden_fields() {
        // The edit form is seeded from `HostDto`, which omits password/identity/proxy
        // (§3.4); a blank submission must not wipe them.
        let mut hosts = vec![Host {
            name: "web".to_string(),
            password: Some("keep-me".to_string()),
            identity_file: Some("/keys/id".to_string()),
            proxy_jump: Some("bastion".to_string()),
            original_ssh_host: Some("web-old".to_string()),
            source: HostSource::Manual,
            ..Host::default()
        }];
        upsert(&mut hosts, input("web"), Some("web")).unwrap();
        let h = &hosts[0];
        assert_eq!(h.password.as_deref(), Some("keep-me"));
        assert_eq!(h.identity_file.as_deref(), Some("/keys/id"));
        assert_eq!(h.proxy_jump.as_deref(), Some("bastion"));
        assert_eq!(h.original_ssh_host.as_deref(), Some("web-old"));
    }

    #[test]
    fn upsert_overwrites_a_secret_when_a_new_one_is_provided() {
        let mut hosts = vec![Host {
            name: "web".to_string(),
            password: Some("old".to_string()),
            source: HostSource::Manual,
            ..Host::default()
        }];
        let mut edit = input("web");
        edit.password = Some("rotated".to_string());
        upsert(&mut hosts, edit, Some("web")).unwrap();
        assert_eq!(hosts[0].password.as_deref(), Some("rotated"));
    }

    #[test]
    fn upsert_renames_in_place_and_preserves_hidden_fields() {
        let mut hosts = vec![Host {
            name: "old".to_string(),
            password: Some("keep-me".to_string()),
            identity_file: Some("/keys/id".to_string()),
            source: HostSource::Manual,
            ..Host::default()
        }];
        let mut renamed = input("new");
        renamed.hostname = "new.example.com".to_string();

        upsert(&mut hosts, renamed, Some("old")).unwrap();

        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].name, "new");
        assert_eq!(hosts[0].hostname, "new.example.com");
        assert_eq!(hosts[0].password.as_deref(), Some("keep-me"));
        assert_eq!(hosts[0].identity_file.as_deref(), Some("/keys/id"));
    }

    #[test]
    fn upsert_rejects_a_rename_collision_without_mutating_hosts() {
        let mut hosts = vec![
            Host {
                name: "old".to_string(),
                ..Host::default()
            },
            Host {
                name: "taken".to_string(),
                ..Host::default()
            },
        ];

        let error = upsert(&mut hosts, input("taken"), Some("old")).unwrap_err();

        assert!(error.contains("already exists"));
        assert_eq!(hosts[0].name, "old");
        assert_eq!(hosts[1].name, "taken");
    }

    #[test]
    fn remove_drops_only_the_named_host() {
        let mut hosts = vec![
            Host {
                name: "a".to_string(),
                ..Host::default()
            },
            Host {
                name: "b".to_string(),
                ..Host::default()
            },
        ];
        remove(&mut hosts, "a");
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].name, "b");
    }

    #[test]
    fn remove_is_a_no_op_for_a_missing_name() {
        // An SSH-config name (absent from hosts.toml) or an already-gone one changes
        // nothing — the desired end state already holds (tech-gui.md §4.2).
        let mut hosts = vec![Host {
            name: "a".to_string(),
            ..Host::default()
        }];
        remove(&mut hosts, "ghost");
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].name, "a");
    }
}
