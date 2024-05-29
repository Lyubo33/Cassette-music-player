#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

mod audio_playback;
mod file_management;

use audio_playback::{AudioControl, AudioPlayer};
use file_management::scan_directory_for_music;
use std::path::PathBuf;
use std::time::Duration;
use tauri::State;
use std::fs::File;
use std::io::{self, BufReader, BufWriter};
use std::path::Path;
use std::sync::Mutex;


const PLAYLISTS_FILE: &str = "playlists.json";

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct Playlist{
     title: String,
     songs: Vec<PathBuf>,
}

struct AppState {
    player: AudioPlayer,
    music_files: Vec<PathBuf>,
    playlists:Mutex<Vec<Playlist>>,
    active_songs: Mutex<Vec<PathBuf>>,
    current_index: Mutex<usize>,
}
#[tauri::command]
fn play(state: State<'_, AppState>) {
    state.player.send_control(AudioControl::Play).unwrap();
}

#[tauri::command]
fn play_file(state: State<'_, AppState>, file_path: String) {
    state.player.send_control(AudioControl::PlayFile(PathBuf::from(file_path))).unwrap();
}

#[tauri::command]
fn pause(state: State<'_, AppState>) {
    state.player.send_control(AudioControl::Pause).unwrap();
}

#[tauri::command]
fn stop(state: State<'_, AppState>) {
    state.player.send_control(AudioControl::Stop).unwrap();
}

#[tauri::command]
fn next(state: State<'_, AppState>) {
    state.player.send_control(AudioControl::Next).expect("Failed next command");
}

#[tauri::command]
fn previous(state: State<'_, AppState>) {
    state.player.send_control(AudioControl::Previous).expect("Failed previous command");
}

#[tauri::command]
fn get_songs(state: State<'_, AppState>) -> Vec<PathBuf> {
    let files = state.active_songs.lock().unwrap().clone();
    if files.is_empty(){
        eprintln!("No files found in default directory");
    }
    files
}
#[tauri::command]
fn get_current_song(state: State<'_,AppState>)->PathBuf{
     let current_song = state.player.get_current_song();
     current_song
}
#[tauri::command]
fn get_current_position(state: State<'_,AppState>)-> u64{
     let current_position = state.player.get_current_position();
     current_position.as_secs() as u64
}
#[tauri::command]
fn get_total_duration(state: State<'_,AppState>)-> u64{
    let total_duration = state.player.get_total_duration();
    total_duration.as_secs() as u64
}
#[tauri::command]
fn seek_position(state: State<'_,AppState>,position: u64){
    let duration_to_seek = Duration::from_secs(position);
    state.player.send_control(AudioControl::Seek(duration_to_seek)).unwrap();
}
#[tauri::command]
fn check_and_play_next(state: State<'_,AppState>){
    let elapsed_time = state.player.get_current_position();
    let total_duration = state.player.get_total_duration();
    if elapsed_time > total_duration {
        state.player.send_control(AudioControl::Pause).expect("Failed to send Pause control");
        state.player.send_control(AudioControl::Next).expect("Failed to send Next control");
    }
}

#[tauri::command]
fn create_playlist(state: State<'_, AppState>, title: String, songs: Vec<String>) -> Result<(), String> {
    let songs: Vec<PathBuf> = songs.into_iter().map(PathBuf::from).collect();
    let playlist = Playlist { title, songs };
    
    let mut playlists = state.playlists.lock().unwrap();
    playlists.push(playlist);
    save_playlists_to_file(&playlists).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_playlists(state: State<'_, AppState>) -> Vec<Playlist> {
    let playlists = state.playlists.lock().unwrap();
    playlists.clone()
}

#[tauri::command]
fn delete_playlist(state: State<'_, AppState>, title: String) -> Result<(), String> {
    let mut playlists = state.playlists.lock().unwrap();
    playlists.retain(|p| p.title != title);
    save_playlists_to_file(&playlists).map_err(|e| e.to_string())
}

#[tauri::command]
fn play_playlist(state: State<'_, AppState>, title: String) -> Result<(), String> {
    let playlists = state.playlists.lock().unwrap();
    if let Some(playlist) = playlists.iter().find(|p| p.title == title) {
        let new_songs = playlist.songs.clone();
        state.player.send_control(AudioControl::Reinitialize(new_songs)).unwrap();
        Ok(())
    } else {
        Err("Playlist not found".to_string())
    }
}

#[tauri::command]
fn play_all_songs(state: State<'_, AppState>) {
    let music_files = state.music_files.clone();
    state.player.send_control(AudioControl::Reinitialize(music_files)).unwrap();
}

// Function to save playlists to a file
fn save_playlists_to_file(playlists: &Vec<Playlist>) -> io::Result<()> {
    let file = File::create(PLAYLISTS_FILE)?;
    let writer = BufWriter::new(file);
    serde_json::to_writer(writer, playlists)?;
    Ok(())
}

// Function to load playlists from a file
fn load_playlists_from_file() -> io::Result<Vec<Playlist>> {
    if Path::new(PLAYLISTS_FILE).exists() {
        let file = File::open(PLAYLISTS_FILE)?;
        let reader = BufReader::new(file);
        let playlists = serde_json::from_reader(reader)?;
        Ok(playlists)
    } else {
        Ok(Vec::new())
    }
}


fn main() {
    let dir_path = if cfg!(target_os = "windows") {
        "C:\\Users\\Public\\Music"
    } else if cfg!(target_os = "linux") {
        "/usr/share/music"
    } else if cfg!(target_os = "android") {
        "/storage/emulated/0/Music"
    } else {
        ""
    };

    if dir_path.is_empty() {
        eprintln!("Unsupported platform.");
        return;
    }
    let music_files = match scan_directory_for_music(dir_path) {
        Ok(files) => {
                files
        },
        Err(_) => {
            eprintln!("Error reading files.");
            return;
        }
    };
    let active_songs = Mutex::new(music_files.clone());
    let audio_player = match AudioPlayer::new(active_songs.lock().unwrap().clone()) {
        Ok(player) => player,
        Err(_) => {
            eprintln!("Failed to create audio player.");
            return;
        }
    };
    let playlists = match load_playlists_from_file() {
        Ok(playlists) => playlists,
        Err(_) => {
            eprintln!("Failed to load playlists.");
            Vec::new()
        }
    };

    tauri::Builder::default()
    .manage(AppState {
        player: audio_player,
        music_files: music_files.clone(),
        playlists: Mutex::new(playlists),
        active_songs: active_songs,  // Start with all songs as the active list
        current_index: Mutex::new(0),
    })
        .invoke_handler(tauri::generate_handler![
            play,
            play_file,
            pause,
            stop,
            next,
            previous,
            get_songs,
            get_current_song,
            get_current_position,
            get_total_duration,
            seek_position,
            check_and_play_next,
            create_playlist,
            get_playlists,
            delete_playlist,
            play_playlist,
            play_all_songs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
