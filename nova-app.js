(() => {
  "use strict";

  /* =========================
     NOVA APP
  ========================== */

  const API =
    window.NOVA_CONFIG?.API ||
    "https://red-mountain-f307.motiharijan123456.workers.dev/chat";

  const $ = (id) => document.getElementById(id);


  /* =========================
     ELEMENTS
  ========================== */

  const elements = {
    sidebar: $("sidebar"),
    menuBtn: $("menuBtn"),
    closeSidebar: $("closeSidebar"),

    newChatBtn: $("newChatBtn"),
    searchChatsBtn: $("searchChatsBtn"),
    testConnectionBtn: $("testConnectionBtn"),
    googleSearchBtn: $("googleSearchBtn"),
    memoryBtn: $("memoryBtn"),
    settingsBtn: $("settingsBtn"),

    messages: $("messages"),
    welcomeScreen: $("welcomeScreen"),
    typingIndicator: $("typingIndicator"),

    messageInput: $("messageInput"),
    sendBtn: $("sendBtn"),
    micBtn: $("micBtn"),
    attachBtn: $("attachBtn"),
    fileInput: $("fileInput"),

    hudBtn: $("hudBtn"),
    hudPanel: $("hudPanel"),
    hudToggle: $("hudToggle"),

    settingsPanel: $("settingsPanel"),
    closeSettings: $("closeSettings"),

    memoryPanel: $("memoryPanel"),
    closeMemory: $("closeMemory"),
    memoryContent: $("memoryContent"),

    searchPanel: $("searchPanel"),
    closeSearch: $("closeSearch"),
    chatSearchInput: $("chatSearchInput"),
    searchResults: $("searchResults"),

    autoSpeakToggle: $("autoSpeakToggle"),
    voiceToggle: $("voiceToggle"),

    connectionStatus: $("connectionStatus"),
    modeText: $("modeText"),

    hudStatus: $("hudStatus"),
    hudCore: $("hudCore"),
    hudVoice: $("hudVoice"),
    hudTools: $("hudTools"),

    filePreview: $("filePreview"),
    fileName: $("fileName"),
    removeFile: $("removeFile"),

    toast: $("toast")
  };


  /* =========================
     STORAGE
  ========================== */

  const STORAGE = {
    messages: "nova_messages",
    memory: "nova_memory",
    autoSpeak: "nova_autospeak"
  };


  let messages = loadJSON(STORAGE.messages, []);
  let memory = loadJSON(STORAGE.memory, []);
  let selectedFile = null;
  let isSending = false;
  let recognition = null;


  /* =========================
     HELPERS
  ========================== */

  function loadJSON(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }


  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors.
    }
  }


  function showToast(message) {
    if (!elements.toast) return;

    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      elements.toast.classList.add("hidden");
    }, 2200);
  }


  function setStatus(text, online = false) {
    if (elements.connectionStatus) {
      elements.connectionStatus.textContent = text;
    }

    const dot =
      document.querySelector(".status-dot");

    if (dot) {
      dot.style.background = online ? "#00d9ff" : "#777";
    }

    if (elements.modeText) {
      elements.modeText.textContent = text;
    }
  }


  function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }


  /* =========================
     CHAT RENDER
  ========================== */

  function renderMessages() {
    if (!elements.messages) return;

    elements.messages.innerHTML = "";

    if (!messages.length) {
      elements.welcomeScreen?.classList.remove("hidden");
      return;
    }

    elements.welcomeScreen?.classList.add("hidden");

    messages.forEach((message) => {
      addMessageToScreen(
        message.role,
        message.content,
        false
      );
    });

    scrollChat();
  }


  function addMessageToScreen(
    role,
    content,
    scroll = true
  ) {
    if (!elements.messages) return;

    const wrapper = document.createElement("div");

    wrapper.className =
      `message ${role === "user" ? "user" : "nova"}`;

    const bubble = document.createElement("div");

    bubble.className = "message-bubble";

    bubble.innerHTML = escapeHTML(content);

    wrapper.appendChild(bubble);

    elements.messages.appendChild(wrapper);

    if (scroll) {
      scrollChat();
    }
  }


  function scrollChat() {
    if (!elements.chatArea) {
      const area = $("chatArea");

      if (area) {
        area.scrollTop = area.scrollHeight;
      }

      return;
    }

    elements.chatArea.scrollTop =
      elements.chatArea.scrollHeight;
  }


  /* =========================
     MESSAGE
  ========================== */

  function addMessage(role, content) {
    messages.push({
      role,
      content,
      time: Date.now()
    });

    saveJSON(STORAGE.messages, messages);

    addMessageToScreen(role, content);
  }


  /* =========================
     SEND MESSAGE
  ========================== */

  async function sendMessage(customText = null) {
    if (isSending) return;

    const text =
      customText !== null
        ? customText.trim()
        : elements.messageInput.value.trim();

    if (!text && !selectedFile) {
      showToast("Type something first.");
      return;
    }

    let finalText = text;

    if (selectedFile) {
      finalText +=
        `\n\n[Attached file: ${selectedFile.name}]`;
    }

    if (elements.messageInput) {
      elements.messageInput.value = "";
    }

    clearSelectedFile();

    addMessage("user", finalText);

    setTyping(true);
    setStatus("Nova Thinking...");

    isSending = true;

    try {
      const reply = await askNova(finalText);

      addMessage("nova", reply);

      setStatus("Nova Online", true);

      if (
        elements.autoSpeakToggle?.checked &&
        elements.voiceToggle?.checked
      ) {
        speak(reply);
      }

    } catch (error) {
      console.error(error);

      const fallback =
        "Sorry, Nova is having trouble connecting right now.";

      addMessage("nova", fallback);

      setStatus("Connection Error");
      showToast("Nova connection failed.");
    }

    setTyping(false);
    isSending = false;
  }


  /* =========================
     WORKER / AI
  ========================== */

  async function askNova(message) {
    const response = await fetch(API, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        message,

        messages: messages.slice(-20),

        memory
      })
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (typeof data.reply === "string") {
      return data.reply;
    }

    if (typeof data.message === "string") {
      return data.message;
    }

    return "Nova received the request, but no reply was returned.";
  }


  /* =========================
     TYPING
  ========================== */

  function setTyping(show) {
    if (!elements.typingIndicator) return;

    elements.typingIndicator.classList.toggle(
      "hidden",
      !show
    );

    if (show) {
      setTimeout(scrollChat, 50);
    }
  }


  /* =========================
     NEW CHAT
  ========================== */

  function newChat() {
    messages = [];

    saveJSON(STORAGE.messages, messages);

    renderMessages();

    closePanels();

    showToast("New chat started.");
  }


  /* =========================
     SIDEBAR
  ========================== */

  function openSidebar() {
    elements.sidebar?.classList.add("open");
  }


  function closeSidebar() {
    elements.sidebar?.classList.remove("open");
  }


  /* =========================
     PANELS
  ========================== */

  function closePanels() {
    elements.settingsPanel?.classList.add("hidden");
    elements.memoryPanel?.classList.add("hidden");
    elements.searchPanel?.classList.add("hidden");
  }


  function openSettings() {
    closePanels();

    elements.settingsPanel?.classList.remove("hidden");
  }


  function openMemory() {
    closePanels();

    elements.memoryPanel?.classList.remove("hidden");

    renderMemory();
  }


  function openSearch() {
    closePanels();

    elements.searchPanel?.classList.remove("hidden");

    elements.chatSearchInput?.focus();
  }


  /* =========================
     MEMORY
  ========================== */

  function renderMemory() {
    if (!elements.memoryContent) return;

    if (!memory.length) {
      elements.memoryContent.innerHTML =
        `<p class="empty-state">
          No saved memory yet.
        </p>`;

      return;
    }

    elements.memoryContent.innerHTML =
      memory.map((item) => {
        return `
          <div class="setting-item">
            <div>
              <strong>${escapeHTML(item)}</strong>
            </div>
          </div>
        `;
      }).join("");
  }


  function saveMemory(text) {
    if (!text) return;

    memory.push(text);

    saveJSON(STORAGE.memory, memory);

    renderMemory();
  }


  /* =========================
     SEARCH CHATS
  ========================== */

  function searchChats(query) {
    if (!elements.searchResults) return;

    const q = query.trim().toLowerCase();

    if (!q) {
      elements.searchResults.innerHTML = "";
      return;
    }

    const results = messages.filter((message) =>
      message.content.toLowerCase().includes(q)
    );

    if (!results.length) {
      elements.searchResults.innerHTML =
        `<p class="empty-state">No chats found.</p>`;

      return;
    }

    elements.searchResults.innerHTML =
      results.map((message) => `
        <div class="setting-item">
          <div>
            <strong>
              ${escapeHTML(
                message.role === "user"
                  ? "You"
                  : "Nova"
              )}
            </strong>

            <small>
              ${escapeHTML(message.content)}
            </small>
          </div>
        </div>
      `).join("");
  }


  /* =========================
     VOICE
  ========================== */

  function setupVoiceRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      recognition = null;
      return;
    }

    recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setStatus("Listening...");
      showToast("Nova is listening...");
    };

    recognition.onresult = (event) => {
      const text =
        event.results[0][0].transcript;

      if (elements.messageInput) {
        elements.messageInput.value = text;
      }

      setStatus("Nova Ready");
    };

    recognition.onerror = () => {
      setStatus("Voice Error");
      showToast("Voice input failed.");
    };

    recognition.onend = () => {
      if (!isSending) {
        setStatus("Nova Ready");
      }
    };
  }


  function startVoice() {
    if (!recognition) {
      showToast(
        "Voice input is not supported in this browser."
      );

      return;
    }

    try {
      recognition.start();
    } catch {
      // Recognition may already be running.
    }
  }


  function speak(text) {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  }


  /* =========================
     FILE
  ========================== */

  function openFilePicker() {
    elements.fileInput?.click();
  }


  function handleFile(file) {
    if (!file) return;

    if (file.size > 200 * 1024) {
      showToast("File is larger than 200 KB.");
      return;
    }

    selectedFile = file;

    if (elements.fileName) {
      elements.fileName.textContent = file.name;
    }

    elements.filePreview?.classList.remove("hidden");

    showToast(`Attached: ${file.name}`);
  }


  function clearSelectedFile() {
    selectedFile = null;

    elements.filePreview?.classList.add("hidden");

    if (elements.fileInput) {
      elements.fileInput.value = "";
    }
  }


  /* =========================
     HUD
  ========================== */

  function toggleHUD() {
    if (!elements.hudPanel) return;

    const isHidden =
      elements.hudPanel.classList.contains("hidden");

    elements.hudPanel.classList.toggle(
      "hidden",
      !isHidden
    );

    if (isHidden) {
      elements.hudStatus.textContent = "ACTIVE";
      elements.hudCore.textContent = "ONLINE";
      elements.hudVoice.textContent = "READY";
      elements.hudTools.textContent = "READY";
    } else {
      elements.hudStatus.textContent = "STANDBY";
    }
  }


  /* =========================
     CONNECTION TEST
  ========================== */

  async function testConnection() {
    showToast("Testing Nova connection...");
    setStatus("Testing...");

    try {
      const response = await fetch(API, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          message: "Hello Nova"
        })
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (data.ok === true || data.reply) {
        setStatus("Nova Online", true);
        showToast("Nova connection is working.");
      } else {
        setStatus("Connected");
        showToast("Worker responded.");
      }

    } catch (error) {
      console.error(error);

      setStatus("Offline");
      showToast("Nova connection failed.");
    }
  }


  /* =========================
     GOOGLE SEARCH
  ========================== */

  function googleSearch() {
    const query =
      elements.messageInput?.value.trim();

    if (!query) {
      showToast("Type a search query first.");
      elements.messageInput?.focus();
      return;
    }

    const url =
      "https://www.google.com/search?q=" +
      encodeURIComponent(query);

    window.open(url, "_blank");
  }


  /* =========================
     QUICK ACTIONS
  ========================== */

  function setupQuickActions() {
    document
      .querySelectorAll(".quick-btn")
      .forEach((button) => {

        button.addEventListener("click", () => {

          const prompt =
            button.dataset.prompt;

          if (prompt) {
            sendMessage(prompt);
          }

        });

      });
  }


  /* =========================
     EVENT LISTENERS
  ========================== */

  function setupEvents() {

    elements.menuBtn?.addEventListener(
      "click",
      openSidebar
    );

    elements.closeSidebar?.addEventListener(
      "click",
      closeSidebar
    );

    elements.newChatBtn?.addEventListener(
      "click",
      newChat
    );

    elements.settingsBtn?.addEventListener(
      "click",
      openSettings
    );

    elements.memoryBtn?.addEventListener(
      "click",
      openMemory
    );

    elements.searchChatsBtn?.addEventListener(
      "click",
      openSearch
    );

    elements.closeSettings?.addEventListener(
      "click",
      closePanels
    );

    elements.closeMemory?.addEventListener(
      "click",
      closePanels
    );

    elements.closeSearch?.addEventListener(
      "click",
      closePanels
    );

    elements.sendBtn?.addEventListener(
      "click",
      () => sendMessage()
    );

    elements.micBtn?.addEventListener(
      "click",
      startVoice
    );

    elements.attachBtn?.addEventListener(
      "click",
      openFilePicker
    );

    elements.fileInput?.addEventListener(
      "change",
      (event) => {
        handleFile(event.target.files?.[0]);
      }
    );

    elements.removeFile?.addEventListener(
      "click",
      clearSelectedFile
    );

    elements.hudBtn?.addEventListener(
      "click",
      toggleHUD
    );

    elements.hudToggle?.addEventListener(
      "change",
      (event) => {

        if (event.target.checked) {
          elements.hudBtn?.classList.remove("hidden");
        } else {
          elements.hudPanel?.classList.add("hidden");
          elements.hudBtn?.classList.add("hidden");
        }

      }
    );

    elements.testConnectionBtn?.addEventListener(
      "click",
      testConnection
    );

    elements.googleSearchBtn?.addEventListener(
      "click",
      googleSearch
    );

    elements.chatSearchInput?.addEventListener(
      "input",
      (event) => {
        searchChats(event.target.value);
      }
    );

    elements.messageInput?.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();
          sendMessage();
        }

      }
    );

    elements.autoSpeakToggle?.addEventListener(
      "change",
      (event) => {

        localStorage.setItem(
          STORAGE.autoSpeak,
          String(event.target.checked)
        );

        showToast(
          event.target.checked
            ? "Auto Speak ON"
            : "Auto Speak OFF"
        );

      }
    );

    setupQuickActions();
  }


  /* =========================
     LOAD SETTINGS
  ========================== */

  function loadSettings() {

    const savedAutoSpeak =
      localStorage.getItem(
        STORAGE.autoSpeak
      );

    if (elements.autoSpeakToggle) {
      elements.autoSpeakToggle.checked =
        savedAutoSpeak === "true";
    }

    if (elements.hudToggle) {
      elements.hudToggle.checked = true;
    }

    if (elements.voiceToggle) {
      elements.voiceToggle.checked = true;
    }
  }


  /* =========================
     START NOVA
  ========================== */

  function init() {

    setupEvents();

    setupVoiceRecognition();

    loadSettings();

    renderMessages();

    setStatus("Nova Ready");

    if (elements.hudCore) {
      elements.hudCore.textContent = "ONLINE";
    }

    if (elements.hudVoice) {
      elements.hudVoice.textContent =
        recognition ? "READY" : "LIMITED";
    }

    if (elements.hudTools) {
      elements.hudTools.textContent = "READY";
    }

    console.log(
      "Nova AI initialized."
    );
  }


  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();
