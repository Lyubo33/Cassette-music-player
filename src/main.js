const { invoke } = window.__TAURI__.tauri;

let currently_edited_playlist = null;
let allSongs = [];

async function fetchSongs() {
  try {
    const response = await invoke('get_songs');
    allSongs = response;
    return allSongs;
  } catch (error) {
    console.error('Error fetching songs:', error);
  }
}

function displaySongs() {
  const songList = document.getElementById('song-list');
  songList.innerHTML = ''; // Clear previous songs
  allSongs.forEach(song => {
    const li = document.createElement('li');
    let song_name = song.replace(/^.*[\\\/]/, '');
    li.className = "song-item";
    li.textContent = song_name;
    li.onclick = () => playFile(song);
    songList.appendChild(li);
  });
}

async function fetchPlaylists() {
  const response = await invoke('get_playlists');
  return response;
}

async function createPlaylist(title, songs) {
  await invoke('create_playlist', { title, songs });
}

async function deletePlaylist(title) {
  const confirmed = await confirm('Are you sure you want to delete this playlist?', { title: 'Delete Playlist', type: 'warning' });
  if (confirmed){
  await invoke('delete_playlist', { title });
  location.reload();
  }else{
     return;
  }
}

async function updatePlaylist(oldTitle, newTitle, songs) {
  console.log("Calling updatePlaylist with:", { oldTitle, newTitle, songs });
  await invoke('update_playlist', { oldTitle, newTitle, songs });
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

function validatePlaylist(title, selectedSongs) {
  const errors = [];
  if (!title.trim()) {
    errors.push("Title is required.");
  }
  if (selectedSongs.length < 2) {
    errors.push("At least 2 songs must be selected.");
  }
  return errors;
}

//Search for songs functionality
document.getElementById('search-box').addEventListener('input', (event) => {
  const searchTerm = event.target.value.toLowerCase();
  const filteredSongs = allSongs.filter(song => song.toLowerCase().includes(searchTerm));
  displaySearchResults(filteredSongs,searchTerm);
});

function displaySearchResults(songs,query) {
  const searchResults = document.getElementById('search-results');
  searchResults.innerHTML = '';  // Clear previous results
  
  songs.forEach(song => {
    const li = document.createElement('li');
    let song_name = song.replace(/^.*[\\\/]/, '');
    li.className = "search-song-item";
    li.textContent = song_name;
    li.onclick = () => playFile(song);
    searchResults.appendChild(li);
  });
 if(query === ''){ 
  searchResults.innerHTML = '';
 }
}
// Clear search results when clicking outside the search box
document.addEventListener('click', (event) => {
  const searchBox = document.getElementById('search-box');
  const searchResults = document.getElementById('search-results');
  if (!searchBox.contains(event.target) && !searchResults.contains(event.target)) {
    searchResults.innerHTML = '';
  }
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

// Close modal for playlist creation
document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('playlist-modal').style.display = 'none';
});

// Create playlist
document.getElementById('create-playlist-btn').addEventListener('click', async () => {
  const createModalErrors = document.getElementById('create-modal-errors');
  createModalErrors.innerHTML = '';  // Clear previous errors
  const title = document.getElementById('playlist-title').value;
  const selectedSongs = Array.from(document.querySelectorAll('.selectable-song.selected'))
                             .map(li => li.dataset.path);
  const errors = validatePlaylist(title, selectedSongs);
  if (errors.length > 0) {
    errors.forEach(error => {
      const errorElem = document.createElement('p');
      errorElem.textContent = error;
      createModalErrors.appendChild(errorElem);
    });
    return;  // Stop further processing if there are validation errors
  }
  await createPlaylist(title, selectedSongs);
  document.getElementById('playlist-modal').style.display = 'none';
  displayPlaylists();
});

//Edit playlist modal functionality
async function openEditModal(playlist) {
  const editModal = document.getElementById('edit-modal');
  editModal.style.display = 'block';
  currently_edited_playlist = playlist;
  const editTitleInput = document.getElementById('edit-playlist-title');
  editTitleInput.value = playlist.title;

  const editSongSelection = document.getElementById('edit-song-selection');
  editSongSelection.innerHTML = ''; // Clear previous song list
  const fetchedSongs = await fetchSongs();
  fetchedSongs.forEach(song => {
    const li = document.createElement('li');
    li.textContent = song.replace(/^.*[\\\/]/, '');
    li.dataset.path = song;
    li.classList.add('selectable-song');
    if (playlist.songs.includes(song)) {
      li.classList.add('selected');
    }
    li.onclick = () => li.classList.toggle('selected');
    editSongSelection.appendChild(li);
  });
}

// Close edit modal
document.getElementById('edit-modal-close').addEventListener('click', () => {
  document.getElementById('edit-modal').style.display = 'none';
});

document.getElementById('update-playlist-btn').addEventListener('click', async () => {
  await Stop();
  const editModalErrors = document.getElementById('edit-modal-errors');
  editModalErrors.innerHTML = '';  // Clear previous errors
  const editTitleInput = document.getElementById('edit-playlist-title');
  const oldTitle = currently_edited_playlist.title;
  const newTitle = editTitleInput.value;
  const selectedSongs = Array.from(document.querySelectorAll('#edit-song-selection .selectable-song.selected'))
                             .map(li => li.dataset.path);
  const errors = validatePlaylist(newTitle, selectedSongs);
  if (errors.length > 0) {
    errors.forEach(error => {
      const errorElem = document.createElement('p');
      errorElem.textContent = error;
      editModalErrors.appendChild(errorElem);
    });
    return;  // Stop further processing if there are validation errors
  }

  try {
    await updatePlaylist(oldTitle, newTitle, selectedSongs);
    document.getElementById('edit-modal').style.display = 'none';
    displayPlaylists();
    location.reload();
  } catch (error) {
    console.error('Error updating playlist:', error);
  }
});


// Display playlists
async function displayPlaylists() {
  try {
    const playlists = await fetchPlaylists();
    const playlistList = document.querySelector('#playlists');
    playlistList.innerHTML = ''; // Clear previous playlists
    playlists.forEach(playlist => {
      const li = document.createElement('li');
      li.id = 'playlist-item';
      li.style.listStyle='none';
      li.textContent = playlist.title;
      li.onclick = () => loadPlaylist(playlist);
      const deleteBtn = createDeleteButton(playlist);
      const editBtn = createEditButton(playlist);
      li.appendChild(deleteBtn);
      li.appendChild(editBtn);
      playlistList.appendChild(li);
    });
  } catch (error) {
    console.error('Error displaying playlists:', error);
  }
}

function createDeleteButton(playlist) {
  const deleteBtn = document.createElement('button');
  const deleteIcn = document.createElement('img');
  deleteIcn.id = 'del-icn';
  deleteIcn.alt = 'Delete';
  deleteIcn.src = 'assets/misc-icons/trash-solid.svg';
  deleteIcn.style.width = '15px';
  deleteIcn.style.height = '15px';
  deleteBtn.appendChild(deleteIcn);
  deleteBtn.style.fontSize = 'small';
  deleteBtn.style.width = '60px';
  deleteBtn.style.height = '40px';
  deleteBtn.style.marginLeft = '15px';
  deleteBtn.style.textAlign = 'center';
  deleteBtn.onclick = async (e) => {
    e.stopPropagation();
    await deletePlaylist(playlist.title);
    displayPlaylists();
  };
  return deleteBtn;
}

function createEditButton(playlist) {
  const editBtn = document.createElement('button');
  const editIcn = document.createElement('img');
  editIcn.id = 'edit-icn';
  editIcn.alt = 'Edit';
  editIcn.src = 'assets/misc-icons/pen-to-square-solid.svg';
  editIcn.style.width = '15px';
  editIcn.style.height = '15px';
  editBtn.appendChild(editIcn);
  editBtn.style.width = '60px';
  editBtn.style.height = '40px';
  editBtn.style.margingLeft = '15px';
  editBtn.onclick = async (e) => {
    e.stopPropagation();
    await openEditModal(playlist);
  };
  return editBtn;
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
   document.getElementById('main-title').textContent = title;
   startUpdatingSongDetails();
   const root = document.querySelector(':root');
   root.classList.add("animated-gradient");
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
     const root = document.querySelector(':root');
     root.classList.add("animated-gradient");
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
    updateSeekbarColor(CurrentPosition,TotalDuration);
    await hasEnded();
  }catch (e) {
    postMessage("Error updating song details",e);
  }
}
function clearSeekbarColor() {
  const Seekbar = document.getElementById('seek-bar');
  Seekbar.style.backgroundColor = `#282828`; // Reset to default background color
}

 async function resetSongDetails() {
  document.getElementById('current-song-position').textContent = formatDuration(0);
  document.getElementById('total-song-duration').textContent = formatDuration(0);
  const seekbar = document.getElementById('seek-bar');
  seekbar.value = 0;
  clearSeekbarColor();
  
}

function formatDuration(duration) {
  const seconds = Math.floor(duration % 60);
  const minutes = Math.floor((duration / 60) % 60);
  const hours = Math.floor(duration / 3600);

  return hours > 0
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
//Function to update seekbar color
function updateSeekbarColor(currentPosition, totalDuration) {
  const Seekbar = document.getElementById('seek-bar');
  const percentage = (currentPosition / totalDuration) * 100;
  Seekbar.style.background = `linear-gradient(to right, crimson ${percentage}%, #282828 ${percentage}%)`;
}

document.getElementById('seek-bar').addEventListener('input', async (event) => {
    let seekPosition = event.target.value;
    await invoke('seek_position', { position: parseInt(seekPosition, 10) });
    resetSongDetails();
    await startUpdatingSongDetails(); // Update the displayed position immediately
    // Update seekbar color
  updateSeekbarColor(seekPosition, event.target.max);
});
async function getAllSongs() {
    await invoke('play_all_songs');
    await fetchSongs();  
    const songList = document.getElementById('song-list');
    document.getElementById('main-title').textContent = 'All songs';
    fetchSongs().then(fetchedSongs => {
      songList.innerHTML = ''; // Clear previous songs
      fetchedSongs.forEach(song => {
        const li = document.createElement('li');
        let song_name = song.replace(/^.*[\\\/]/, '');
        li.className = "song-item";
        li.textContent = song_name;
        li.onclick = () => playFile(song);
        songList.appendChild(li);
      });
    });
    const root = document.querySelector(':root');
    root.classList.add("animated-gradient");
}

async function chooseDirectory() {
  try {
    const newDirectory = await invoke('select_directory');
    console.log('Selected Directory:', newDirectory);
    
    if (newDirectory) {
      await updateUIAfterDirectorySelection(newDirectory);
    } else {
      console.log("No directory selected or the selected directory doesn't contain songs.");
      alert("No directory selected or the selected directory doesn't contain songs.");
    }
  } catch (error) {
    console.error('Error selecting directory:', error);
    alert.error('Error selecting directory:', error);
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  async function checkDirectory() {
    try {
      const musicDirectory = await invoke('get_music_directory');
      console.log('Initial Music Directory:', musicDirectory);

      if (musicDirectory) {
        await updateUIAfterDirectorySelection(musicDirectory);
      } else {
        // Show initial prompt if no directory is set
        document.getElementById('initial-prompt').style.display = 'block';
        document.querySelector('.sidebar').style.display = 'none';
      document.getElementById('audio-control-div').style.display = 'none';
      document.getElementById('main-title').style.display = 'none';
      }
    } catch (error) {
      console.error('Error fetching music directory:', error);
    }
  }
  await checkDirectory();
  const root = document.querySelector(':root');
  const playButton = document.getElementById("play-button");
  const pauseButton = document.getElementById("pause-button");
  const stopButton = document.getElementById("stop-button");
  // Function to start the gradient animation
  const startGradientAnimation = () => {
    root.classList.add("animated-gradient");
  };

  // Function to stop the gradient animation
  const stopGradientAnimation = () => {
    root.classList.remove("animated-gradient");
  };

  // Add event listeners to the play, pause, and stop buttons
  playButton.addEventListener("click", startGradientAnimation);
  pauseButton.addEventListener("click", stopGradientAnimation);
  stopButton.addEventListener("click", stopGradientAnimation);
});

document.addEventListener('DOMContentLoaded', () => {
  const playlistToggle = document.getElementById('playlistToggle');
  const playlistDropdown = document.getElementById('playlistDropdown');

  playlistToggle.addEventListener('click', () => {
    if (playlistDropdown.style.display === 'flex') {
      playlistDropdown.style.display = 'none';
    } else {
      playlistDropdown.style.display = 'flex';
      playlistDropdown.style.flexDirection = 'column';
    }
  });
  playlistDropdown.style.display = 'none';
});

async function updateUIAfterDirectorySelection(newDirectory) {
  try {
    const fetchedSongs = await fetchSongs();
    console.log('Fetched Songs:', fetchedSongs);

    if (fetchedSongs.length > 0) {
      displaySongs(fetchedSongs);
      displayPlaylists();

      // Update the UI visibility
      document.getElementById('initial-prompt').style.display = 'none';
      document.querySelector('.sidebar').style.display = 'flex';
      document.getElementById('audio-control-div').style.display = 'block';
      document.getElementById('main-title').style.display = 'block';
    } else {
      console.log("The selected directory doesn't contain any songs.");
      alert("The selected directory doesn't contain any songs.");
    }
  } catch (error) {
    console.error('Error updating UI after directory selection:', error);
  }
}



document.getElementById('play-button').addEventListener('click', Play);
document.getElementById('pause-button').addEventListener('click', Pause);
document.getElementById('stop-button').addEventListener('click', Stop);
document.getElementById('next-button').addEventListener('click', Next);
document.getElementById('previous-button').addEventListener('click', Previous);
document.getElementById('all-songs').addEventListener('click', getAllSongs);
document.getElementById('choose-directory-main').addEventListener('click', chooseDirectory);
document.getElementById('choose-directory-sidebar').addEventListener('click', chooseDirectory);