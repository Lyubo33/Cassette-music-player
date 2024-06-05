use rodio::{Decoder, OutputStream, Sink, Source};
use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};


pub struct AudioPlayer {
    control_sender: mpsc::Sender<AudioControl>,
    music_files: Arc<Mutex<Vec<PathBuf>>>,
    current_index: Arc<Mutex<usize>>,
    start_time: Arc<Mutex<Option<Instant>>>,
    elapsed_time: Arc<Mutex<Duration>>,
    total_duration: Arc<Mutex<Duration>>,
}

pub enum AudioControl {
    Play,
    PlayFile(PathBuf),
    Pause,
    Stop,
    Next,
    Previous,
    Seek(Duration),
    Reinitialize(Vec<PathBuf>),
}

impl AudioPlayer {
    pub fn new(music_files: Vec<PathBuf>) -> Result<Self, Box<dyn Error>> {
        let (control_sender, control_receiver) = mpsc::channel();
        let music_files = Arc::new(Mutex::new(music_files));
        let current_index = Arc::new(Mutex::new(0));
        let start_time = Arc::new(Mutex::new(None));
        let elapsed_time = Arc::new(Mutex::new(Duration::from_secs(0)));
        let total_duration = Arc::new(Mutex::new(Duration::from_secs(0)));


        let music_files_clone = Arc::clone(&music_files);
        let current_index_clone = Arc::clone(&current_index);
        let start_time_clone = Arc::clone(&start_time);
        let elapsed_time_clone = Arc::clone(&elapsed_time);
        let total_duration_clone = Arc::clone(&total_duration);

        // Spawn a thread to handle audio control events
        thread::spawn(move || {
            let (_stream, stream_handle) = OutputStream::try_default().unwrap();
            let sink = Arc::new(Mutex::new(Sink::try_new(&stream_handle).unwrap()));

            for control in control_receiver.iter() {
                let sink = sink.lock().unwrap();
                match control {
                    AudioControl::Play => {
                        if sink.empty(){
                        let files = music_files_clone.lock().unwrap();
                        if !files.is_empty() {
                            let index = *current_index_clone.lock().unwrap();
                            let file_path = &files[index];
                            let file = File::open(file_path).unwrap();
                            let source = Decoder::new(BufReader::new(file)).unwrap();
                            *total_duration_clone.lock().unwrap() = source.total_duration().unwrap();
                            sink.append(source);
                            *start_time_clone.lock().unwrap()= Some(Instant::now());
                        }else{sink.stop();} 
                    }else{
                      if sink.is_paused(){
                        *start_time_clone.lock().unwrap()= Some(Instant::now());
                      }
                      sink.play();
                    }
                    },
                    AudioControl::PlayFile(file_path) =>{
                        let  files = music_files_clone.lock().unwrap();
                        let mut index = current_index_clone.lock().unwrap();
                        if let Some(pos) = files.iter().position(|p| p == &file_path) {
                            *index = pos;
                            let file = File::open(&file_path).unwrap();
                            let source = Decoder::new(BufReader::new(file)).unwrap();
                            *total_duration_clone.lock().unwrap() = source.total_duration().unwrap();
                            sink.stop();
                            sink.append(source);
                            sink.play();
                            *start_time_clone.lock().unwrap() = Some(Instant::now());
                            *elapsed_time_clone.lock().unwrap() = Duration::from_secs(0);
                        }
                    },
                    AudioControl::Pause => {
                        sink.pause();
                        let start_time = *start_time_clone.lock().unwrap();
                        if let Some(start_time) = start_time {
                            let elapsed = start_time.elapsed();
                            *elapsed_time_clone.lock().unwrap() += elapsed;
                            *start_time_clone.lock().unwrap() = None;
                        }
                    },
                    AudioControl::Stop => {
                        sink.stop();
                        *start_time_clone.lock().unwrap() = None;
                        *elapsed_time_clone.lock().unwrap() = Duration::from_secs(0);
                        *total_duration_clone.lock().unwrap()= Duration::from_secs(0);
                    },
                    AudioControl::Next => {
                        let mut index = current_index_clone.lock().unwrap();
                        let files = music_files_clone.lock().unwrap();
                        if !files.is_empty() {
                            *index = (*index + 1) % files.len();
                            let file_path = &files[*index];
                            let file = File::open(file_path).unwrap();
                            let source = Decoder::new(BufReader::new(file)).unwrap();
                            *total_duration_clone.lock().unwrap() = source.total_duration().unwrap();
                            sink.stop();
                            sink.append(source);
                            sink.play();
                            *start_time_clone.lock().unwrap()= Some(Instant::now());
                            *elapsed_time_clone.lock().unwrap() = Duration::from_secs(0);
                        }else{sink.stop();}
                    },
                    AudioControl::Previous => {
                        let mut index = current_index_clone.lock().unwrap();
                        let files = music_files_clone.lock().unwrap();
                        if !files.is_empty() {
                            if *index == 0 {
                                *index = files.len() - 1;
                            } else {
                                *index -= 1;
                            }
                            let file_path = &files[*index];
                            let file = File::open(file_path).unwrap();
                            let source = Decoder::new(BufReader::new(file)).unwrap();
                            *total_duration_clone.lock().unwrap() = source.total_duration().unwrap();
                            sink.stop();
                            sink.append(source);
                            sink.play();
                            *start_time_clone.lock().unwrap() = Some(Instant::now());
                            *elapsed_time_clone.lock().unwrap() = Duration::from_secs(0);
                        }else{sink.stop();}
                    },
                    AudioControl::Seek(duration) =>{
                         sink.try_seek(duration).unwrap();
                         *elapsed_time_clone.lock().unwrap() = duration;
                         
                    }
                    AudioControl::Reinitialize(new_songs) => {
                        *music_files_clone.lock().unwrap() = new_songs.clone();
                        *current_index_clone.lock().unwrap() = 0;
                        if !new_songs.is_empty() {
                            let file_path = &new_songs[0];
                            let file = File::open(file_path).unwrap();
                            let source = Decoder::new(BufReader::new(file)).unwrap();
                            *total_duration_clone.lock().unwrap() = source.total_duration().unwrap();
                            sink.stop();
                            sink.append(source);
                            sink.play();
                            *start_time_clone.lock().unwrap() = Some(Instant::now());
                            *elapsed_time_clone.lock().unwrap() = Duration::from_secs(0);
                        }
             
                    }
                }
            }
        });

        Ok(Self {
            control_sender,
            music_files,
            current_index,
            start_time,
            elapsed_time,
            total_duration,
        })
    }

    pub fn get_current_song(&self)->PathBuf{
        let index = *self.current_index.lock().unwrap();
        let songs = self.music_files.lock().unwrap();
        songs[index].clone()
    }
    pub fn send_control(&self, control: AudioControl) -> Result<(), mpsc::SendError<AudioControl>> {
        self.control_sender.send(control)
    }
    pub fn get_current_position(&self) -> Duration {
        let start_time = *self.start_time.lock().unwrap();
        let elapsed_time = *self.elapsed_time.lock().unwrap();
        if let Some(start_time) = start_time {
            elapsed_time + start_time.elapsed()
        } else {
            elapsed_time
        }
    }
    pub fn get_total_duration(&self)->Duration{
        *self.total_duration.lock().unwrap()
    }
}