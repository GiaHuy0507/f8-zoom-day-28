const $ = (selector) => document.querySelector(selector);

const musicPlayer = {
    NEXT_SONG: 1,
    PREV_SONG: -1,
    PREV_RESET_TIME: 2, // Quá 2 giây thì nút "trước" sẽ reset bài hiện tại

    STORAGE_KEYS: {
        CURRENT_SONG_INDEX: "musicPlayer_currentSongIndex",
        CURRENT_TIME: "musicPlayer_currentTime",
        VOLUME: "musicPlayer_volume",
        LOOP_MODE: "musicPlayer_loopMode",
        SHUFFLE_MODE: "musicPlayer_shuffleMode",
    },

    playlistContainer: $(".playlist"),
    playToggleBtn: $(".btn-toggle-play"),
    currentSongTitle: $(".current-song-title"),
    currentSongArtist: $(".current-song-artist"),
    audioPlayer: $(".audio-player"),
    playIcon: $(".play-icon"),
    prevBtn: $(".btn-prev"),
    nextBtn: $(".btn-next"),
    loopBtn: $(".btn-loop"),
    shuffleBtn: $(".btn-shuffle"),
    progressBar: $(".progress-bar"),
    currentTimeLabel: $(".current-time"),
    durationLabel: $(".duration-time"),
    volumeBar: $(".volume-bar"),

    songList: [
        { id: 1, filePath: "./songs/ChayNgayDi-SonTungMTP-5468704.mp3", title: "Chạy ngay đi", artist: "Sơn Tùng M-TP", duration: 248.03 },
        { id: 2, filePath: "./songs/GioThi-buitruonglinh-16952778.mp3", title: "Gió Thị", artist: "Bùi Trường Linh", duration: 234.17 },
        { id: 3, filePath: "./songs/HayTraoChoAnh-SonTungMTPSnoopDogg-6010660.mp3", title: "Hãy trao cho anh", artist: "Sơn Tùng M-TP ft. Snoop Dogg", duration: 245.66 },
        { id: 4, filePath: "./songs/MatKetNoi-DuongDomic-16783113.mp3", title: "Mất kết nối", artist: "Dương Domic", duration: 207.47 },
        { id: 5, filePath: "./songs/TaiSinh-TungDuong-16735175.mp3", title: "Tái sinh", artist: "Tùng Dương", duration: 240.0 },
    ],

    currentSongIndex: 0,
    isPlaying: false,
    isLoopMode: false,
    isShuffleMode: false,
    volume: 1,
    savedCurrentTime: 0,
    lastSavedCurrentTime: 0,

    initialize() {
        this.loadPlayerState();
        this.renderPlaylist();
        this.setupEventListeners();
        this.setupCurrentSong();
    },

    loadPlayerState() {
        const K = this.STORAGE_KEYS;
        // Trả về số đã lưu nếu hợp lệ, ngược lại trả về giá trị mặc định
        const read = (key, isValid, fallback) => {
            const raw = localStorage.getItem(key);
            return raw !== null && isValid(Number(raw)) ? Number(raw) : fallback;
        };

        this.currentSongIndex = read(K.CURRENT_SONG_INDEX, (n) => Number.isInteger(n) && n >= 0 && n < this.songList.length, this.currentSongIndex);
        this.savedCurrentTime = read(K.CURRENT_TIME, (n) => Number.isFinite(n) && n >= 0, this.savedCurrentTime);
        this.volume = read(K.VOLUME, (n) => n >= 0 && n <= 1, this.volume);
        this.isLoopMode = localStorage.getItem(K.LOOP_MODE) === "true";
        this.isShuffleMode = localStorage.getItem(K.SHUFFLE_MODE) === "true";

        this.audioPlayer.volume = this.volume;
        this.volumeBar.value = this.volume * 100;
    },

    setupEventListeners() {
        const audio = this.audioPlayer;
        const bar = this.progressBar;

        this.playToggleBtn.onclick = () => this.togglePlayPause();
        window.addEventListener("pagehide", () => this.savePlayerState());

        this.playlistContainer.onclick = (e) => {
            const song = e.target.closest(".song");
            if (song) this.selectPlaylistSong(song);
        };
        this.playlistContainer.onkeydown = (e) => {
            const song = e.target.closest(".song");
            if (!song || (e.key !== "Enter" && e.key !== " ")) return;
            e.preventDefault();
            this.selectPlaylistSong(song);
        };

        audio.onplay = () => this.setPlayingUI(true);
        audio.onpause = () => {
            this.setPlayingUI(false);
            this.savePlayerState();
        };
        audio.oncanplay = () => {
            if (this.isPlaying) audio.play();
        };
        audio.onended = () => this.handleSongNavigation(this.NEXT_SONG);

        this.prevBtn.onclick = () => this.handleSongNavigation(this.PREV_SONG);
        this.nextBtn.onclick = () => this.handleSongNavigation(this.NEXT_SONG);

        this.loopBtn.onclick = () => {
            this.isLoopMode = !this.isLoopMode;
            this.updateLoopButtonState();
            this.savePlayerState();
        };
        this.shuffleBtn.onclick = () => {
            this.isShuffleMode = !this.isShuffleMode;
            this.updateShuffleButtonState();
            this.savePlayerState();
        };

        audio.ontimeupdate = () => {
            if (bar.seeking) return; // Đang kéo thanh tiến trình
            this.updateProgressUI(audio.currentTime);
            if (Math.abs(audio.currentTime - this.lastSavedCurrentTime) >= 5) {
                this.savePlayerState();
            }
        };

        bar.onpointerdown = () => (bar.seeking = true);
        bar.onpointerup = bar.onchange = () => this.commitProgressChange();
        bar.oninput = () => this.updateProgressAppearance();

        this.volumeBar.oninput = () => {
            this.volume = Number(this.volumeBar.value) / 100;
            audio.volume = this.volume;
        };
        this.volumeBar.onchange = () => this.savePlayerState();

        audio.onloadedmetadata = () => {
            this.durationLabel.textContent = this.formatTime(audio.duration);
            if (this.savedCurrentTime > 0) {
                audio.currentTime = Math.min(this.savedCurrentTime, Math.max(0, audio.duration - 0.1));
                this.updateProgressUI(audio.currentTime);
                this.savedCurrentTime = 0;
            }
            this.savePlayerState();
        };
    },

    setPlayingUI(playing) {
        this.isPlaying = playing;
        this.playIcon.classList.toggle("fa-play", !playing);
        this.playIcon.classList.toggle("fa-pause", playing);
        this.playToggleBtn.setAttribute("aria-label", playing ? "Tạm dừng" : "Phát");
    },

    updateProgressUI(time) {
        this.progressBar.value = (time / this.audioPlayer.duration) * 100 || 0;
        this.currentTimeLabel.textContent = this.formatTime(time);
        this.updateProgressAppearance();
    },

    handleSongNavigation(direction) {
        this.isPlaying = true; // Luôn phát khi chuyển bài

        // Nhấn "trước" khi đã phát > 2 giây thì về đầu bài
        if (direction === this.PREV_SONG && this.audioPlayer.currentTime > this.PREV_RESET_TIME) {
            this.audioPlayer.currentTime = 0;
            this.updateProgressUI(0);
            this.savePlayerState(0);
            return;
        }

        this.currentSongIndex = this.isShuffleMode
            ? this.getRandomSongIndex()
            : this.currentSongIndex + direction;
        this.handleNewSongIndex();
    },

    // Bài ngẫu nhiên khác bài hiện tại
    getRandomSongIndex() {
        const n = this.songList.length;
        if (n <= 1) return this.currentSongIndex;
        const r = Math.floor(Math.random() * (n - 1));
        return r >= this.currentSongIndex ? r + 1 : r;
    },

    handleNewSongIndex() {
        const n = this.songList.length;
        this.currentSongIndex = (this.currentSongIndex + n) % n; // -1 -> n-1, n -> 0
        this.savedCurrentTime = 0;
        this.setupCurrentSong();
        this.renderPlaylist();
        this.savePlayerState(0);
    },

    updateLoopButtonState() {
        this.audioPlayer.loop = this.isLoopMode;
        this.loopBtn.classList.toggle("active", this.isLoopMode);
    },

    updateShuffleButtonState() {
        this.shuffleBtn.classList.toggle("active", this.isShuffleMode);
    },

    setupCurrentSong() {
        const song = this.getCurrentSong();
        this.currentSongTitle.textContent = song.title;
        this.currentSongArtist.textContent = song.artist;
        this.durationLabel.textContent = this.formatTime(song.duration);
        this.updateProgressUI(0);
        this.audioPlayer.src = song.filePath;
        this.updateLoopButtonState();
        this.updateShuffleButtonState();
    },

    getCurrentSong() {
        return this.songList[this.currentSongIndex];
    },

    togglePlayPause() {
        this.audioPlayer.paused ? this.audioPlayer.play() : this.audioPlayer.pause();
    },

    selectPlaylistSong(songElement) {
        const index = Number(songElement.dataset.index);
        if (index === this.currentSongIndex) return this.togglePlayPause();
        this.currentSongIndex = index;
        this.isPlaying = true;
        this.handleNewSongIndex();
    },

    commitProgressChange() {
        const seekTime = (this.audioPlayer.duration / 100) * Number(this.progressBar.value);
        if (Number.isFinite(seekTime)) {
            this.audioPlayer.currentTime = seekTime;
            this.currentTimeLabel.textContent = this.formatTime(seekTime);
            this.savePlayerState();
        }
        this.progressBar.seeking = false;
    },

    savePlayerState(currentTime = this.audioPlayer.currentTime) {
        const K = this.STORAGE_KEYS;
        if (Number.isFinite(currentTime)) {
            localStorage.setItem(K.CURRENT_TIME, currentTime);
            this.lastSavedCurrentTime = currentTime;
        }
        [
            [K.CURRENT_SONG_INDEX, this.currentSongIndex],
            [K.VOLUME, this.volume],
            [K.LOOP_MODE, this.isLoopMode],
            [K.SHUFFLE_MODE, this.isShuffleMode],
        ].forEach(([key, value]) => localStorage.setItem(key, value));
    },

    renderPlaylist() {
        this.playlistContainer.innerHTML = this.songList
            .map((song, index) => {
                const title = this.escapeHTML(song.title);
                return `<div class="song ${index === this.currentSongIndex ? "active" : ""}" data-index="${index}" role="button" tabindex="0" aria-label="Phát ${title}">
                    <span class="track-number">${index + 1}</span>
                    <div class="body">
                        <h3 class="title">${title}</h3>
                        <p class="author">${this.escapeHTML(song.artist)}</p>
                    </div>
                    <span class="song-duration">${this.formatTime(song.duration)}</span>
                </div>`;
            })
            .join("");
    },

    formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
        const secs = String(Math.floor(seconds % 60)).padStart(2, "0");
        return `${Math.floor(seconds / 60)}:${secs}`;
    },

    updateProgressAppearance() {
        const p = Number(this.progressBar.value);
        this.progressBar.style.background = `linear-gradient(to right, var(--accent-color) ${p}%, #343635 ${p}%)`;
    },

    escapeHTML(html) {
        if (typeof html !== "string") return "";
        const div = document.createElement("div");
        div.textContent = html; // textContent tự escape ký tự đặc biệt
        return div.innerHTML;
    },
};

musicPlayer.initialize();
