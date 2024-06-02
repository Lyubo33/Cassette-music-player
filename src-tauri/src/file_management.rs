use std::fs;
use std::path::PathBuf;
use std::error::Error;

// Define supported music file extensions
const MUSIC_EXTENSIONS: &[&str] = &["mp3", "wav"];


fn is_music_file(path: &PathBuf) -> bool {
    if let Some(ext) = path.extension() {
        if let Some(ext_str) = ext.to_str() {
            return MUSIC_EXTENSIONS.contains(&ext_str.to_lowercase().as_str());
        }
    }
    false
}

pub fn scan_directory_for_music(dir_path: &str) -> Result<Vec<PathBuf>, Box<dyn Error>> {
    let mut music_files = Vec::new();
    let mut dirs_to_visit = vec![PathBuf::from(dir_path)];

    while let Some(dir) = dirs_to_visit.pop() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                dirs_to_visit.push(path);
            } else if path.is_file() && is_music_file(&path) {
                music_files.push(path);
            }
        }
    }

    Ok(music_files)
}
