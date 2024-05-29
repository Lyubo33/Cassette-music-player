const { invoke } = window.__TAURI__.tauri;


async function fetchSongs() {
  const response = await invoke('get_songs');
  return response;
}

async function fetchPlaylists() {
  const response = await invoke('get_playlists');
  return response;
}

async function createPlaylist(title, songs) {
  await invoke('create_playlist', { title, songs });
}

async function deletePlaylist(title) {
  await invoke('delete_playlist', { title });
}

fetchSongs().then(fetchedSongs => {
  const songList = document.getElementById('song-list');
  
  fetchedSongs.forEach((song, index) => {
    const li = document.createElement('li');
    let song_name = song.replace(/^.*[\\\/]/, '');
    li.className="song-item";
    li.textContent = song_name;
    li.onclick = () => playFile(song);
    songList.appendChild(li);
  });
});


// Open modal for playlist creation
document.querySelector('.playlist-create').addEventListener('click', () => {
  const modal = document.getElementById('playlist-modal');
  modal.style.display = 'block';
  fetchSongs().then(fetchedSongs => {
    const songSelection = document.getElementById('song-selection');
    songSelection.innerHTML = '';  // Clear previous song list
    fetchedSongs.forEach(song => {
      const li = document.createElement('li');
      li.textContent = song.replace(/^.*[\\\/]/, '');
      li.dataset.path = song;
      li.classList.add('selectable-song');
      li.onclick = () => li.classList.toggle('selected');
      songSelection.appendChild(li);
    });
  });
});

// Close modal
document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('playlist-modal').style.display = 'none';
});

// Create playlist
document.getElementById('create-playlist-btn').addEventListener('click', async () => {
  const title = document.getElementById('playlist-title').value;
  const selectedSongs = Array.from(document.querySelectorAll('.selectable-song.selected'))
                             .map(li => li.dataset.path);
  await createPlaylist(title, selectedSongs);
  document.getElementById('playlist-modal').style.display = 'none';
  displayPlaylists();
});

// Display playlists
async function displayPlaylists() {
  const playlists = await fetchPlaylists();
  const playlistList = document.querySelector('.sidebar ul');
  playlistList.innerHTML = '';  // Clear previous playlists
  playlists.forEach(playlist => {
    const li = document.createElement('li');
    li.textContent = playlist.title;
    li.onclick = () => loadPlaylist(playlist);
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      await deletePlaylist(playlist.title);
      displayPlaylists();
    };
    li.appendChild(deleteBtn);
    playlistList.appendChild(li);
  });
}

// Load playlist
async function loadPlaylist(playlist) {
  await playPlaylist(playlist.title);
  const songList = document.getElementById('song-list');
  songList.innerHTML = '';  // Clear previous song list
  playlist.songs.forEach(song => {
    const li = document.createElement('li');
    let song_name = song.replace(/^.*[\\\/]/, '');
    li.className="song-item";
    li.textContent = song_name;
    li.onclick = () => playFile(song);
    songList.appendChild(li);
    
  });
}
async function playPlaylist(title) {
   await invoke('play_playlist',{title});
   startUpdatingSongDetails();
}

// Initial display of playlists
displayPlaylists();

async function Play() {
  try {
    await invoke('play');
    await GetSong();
    await startUpdatingSongDetails();
  } catch (error) {
    console.error('Error invoking play command:', error);
  }
}
async function GetSong(){
  try {
    let song = await invoke('get_current_song');
    let current_song = document.getElementById('current-song');
    current_song.textContent = song.replace(/^.*[\\\/]/, '');
  } catch (error) {
    console.error('Error invoking play command:', error);
  }
}
async function playFile(filePath) {
  try{
     await invoke('play_file', { filePath });
     await GetSong();
     await startUpdatingSongDetails();
   }catch(error){
     console.error('Error invoking play file command')
  }
}

async function Pause() {
  try {
    await invoke('pause');
    stopUpdatingSongDetails();
  } catch (error) {
    console.error('Error invoking pause command:', error);
  }
}

async function Stop() {
  try {
    await invoke('stop');
    stopUpdatingSongDetails();
    resetSongDetails();
  } catch (error) {
    console.error('Error invoking stop command:', error);
  }
}

async function Next() {
  try {
    await invoke('next');
    await GetSong();
    await startUpdatingSongDetails();
  } catch (error) {
    console.error('Error invoking next command:', error);
  }
}

async function hasEnded() {
  try {
    await invoke('check_and_play_next');
    await GetSong();
  } catch (error) {
    console.error('Error invoking check_and_play_next command:', error);
  }
}

async function Previous() {
  try {
    await invoke('previous');
    await GetSong();
    await startUpdatingSongDetails();
  } catch (error) {
    console.error('Error invoking previous command:', error);
  }
}

async function startUpdatingSongDetails() {
  // Update the song details immediately
  await updateDetails();
  
  
  // Update the song details every second
  UpdateInterval=setInterval(updateDetails, 1000);
}

function stopUpdatingSongDetails(){
  clearInterval(UpdateInterval);
}

async function updateDetails() {
  try {
    const CurrentPosition = await invoke('get_current_position');
    const TotalDuration = await invoke('get_total_duration');
    const FormattedCurrentPosition = formatDuration(CurrentPosition);
    const FormattedTotalDuration = formatDuration(TotalDuration);

    document.getElementById('current-song-position').textContent = FormattedCurrentPosition;
    document.getElementById('total-song-duration').textContent = FormattedTotalDuration;

    const Seekbar = document.getElementById('seek-bar');
    Seekbar.max = TotalDuration;
    Seekbar.value = CurrentPosition;
    await hasEnded();
  }catch (e) {
    postMessage("Error updating song details",e);
  }
}

function resetSongDetails() {
  document.getElementById('current-song-position').textContent = formatDuration(0);
  document.getElementById('total-song-duration').textContent = formatDuration(0);
  document.getElementById('seek-bar').value = 0;
}

function formatDuration(duration) {
  const seconds = Math.floor(duration % 60);
  const minutes = Math.floor((duration / 60) % 60);
  const hours = Math.floor(duration / 3600);

  return hours > 0
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

document.getElementById('seek-bar').addEventListener('input', async (event) => {
    let seekPosition = event.target.value;
    await invoke('seek_position', { position: parseInt(seekPosition, 10) });
    resetSongDetails();
    await startUpdatingSongDetails(); // Update the displayed position immediately
});
async function getAllSongs() {
    await  fetchSongs();
    await invoke('play_all_songs');  
}

document.getElementById('play-button').addEventListener('click', Play);
document.getElementById('pause-button').addEventListener('click', Pause);
document.getElementById('stop-button').addEventListener('click', Stop);
document.getElementById('next-button').addEventListener('click', Next);
document.getElementById('previous-button').addEventListener('click', Previous);
document.getElementById('all-songs').addEventListener('click', getAllSongs);