let currentUser = null;
let activeSessionId = null;
let chatSessions = [];
let selectedFile = null;
let pressureTimer = null;
let pressureCountdownSeconds = 20;
let lastStressReport = '';
let isSignUpMode = false;

// Conversation state representing Socratic steps
let currentState = {
  step: 1,
  depth: 'Medium',
  variables: {}
};
let chatHistory = []; // Tracks [{ role: 'user'|'assistant', content: '...' }]

// Load user sessions and initialize page
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('forceLogin') === 'true') {
    localStorage.removeItem('qualm_user');
  }

  currentUser = JSON.parse(localStorage.getItem('qualm_user'));
  if (currentUser) {
    showChatSection();
  } else {
    showLoginSection();
  }

  // Load custom values if saved
  const savedGoogleId = localStorage.getItem('qualm_google_client_id') || '';
  const savedGeminiKey = localStorage.getItem('qualm_gemini_api_key') || '';
  document.getElementById('google-client-id').value = savedGoogleId === 'mock' ? '' : savedGoogleId;
  document.getElementById('api-key').value = savedGeminiKey;

  // Auto-expand textarea
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
  });
});

function showLoginSection() {
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('chat-section').classList.add('hidden');
}

function showChatSection() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('chat-section').classList.remove('hidden');

  // Sync profile details
  document.getElementById('header-avatar').src = currentUser.avatar;
  document.getElementById('sidebar-avatar').src = currentUser.avatar;
  document.getElementById('sidebar-user-name').textContent = currentUser.name;
  document.getElementById('sidebar-user-email').textContent = currentUser.email;

  // Render greeting
  document.getElementById('greeting-text').innerHTML = getGreeting();

  loadChatSessions();
}

function getGreeting() {
  return `Welcome back.`;
}

function toggleAuthMode(e) {
  if (e) e.preventDefault();
  isSignUpMode = !isSignUpMode;
  
  const title = document.getElementById('login-title');
  const submitText = document.getElementById('login-submit-text');
  const toggleLink = document.getElementById('toggle-auth-mode');
  const usernameContainer = document.getElementById('username-container');
  
  // Reset errors
  document.getElementById('email-error').classList.add('hidden');
  document.getElementById('password-error').classList.add('hidden');
  document.getElementById('username-error').classList.add('hidden');
  
  if (isSignUpMode) {
    title.textContent = "Create Account";
    submitText.textContent = "Register";
    toggleLink.textContent = "Already have an account? Login";
    usernameContainer.classList.remove('hidden');
  } else {
    title.textContent = "Welcome Back";
    submitText.textContent = "Login";
    toggleLink.textContent = "Create an account";
    usernameContainer.classList.add('hidden');
  }
}

// Credentials Form Login/Register
async function handleFormLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const usernameInput = document.getElementById('username');
  
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const usernameError = document.getElementById('username-error');

  let isValid = true;
  emailError.classList.add('hidden');
  passwordError.classList.add('hidden');
  usernameError.classList.add('hidden');

  if (isSignUpMode && !usernameInput.value.trim()) {
    usernameError.classList.remove('hidden');
    isValid = false;
  }
  if (!emailInput.value || !emailInput.value.includes('@')) {
    emailError.classList.remove('hidden');
    isValid = false;
  }
  if (!passwordInput.value || passwordInput.value.length < 6) {
    passwordError.classList.remove('hidden');
    isValid = false;
  }

  if (!isValid) return;

  const payload = {
    email: emailInput.value.trim(),
    password: passwordInput.value
  };
  
  if (isSignUpMode) {
    payload.username = usernameInput.value.trim();
  }

  const endpoint = isSignUpMode ? '/api/auth/register' : '/api/auth/login';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Authentication failed");
    }

    const name = data.user.name;
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1A1A1A&color=ffb300&bold=true&size=128`;

    currentUser = {
      name: name,
      email: data.user.email,
      avatar: avatarUrl,
      provider: 'credentials'
    };

    localStorage.setItem('qualm_user', JSON.stringify(currentUser));
    
    // Reset login form fields
    emailInput.value = '';
    passwordInput.value = '';
    usernameInput.value = '';
    if (isSignUpMode) toggleAuthMode(); // Toggle back to login mode internally

    showChatSection();

  } catch (error) {
    console.error("Auth error:", error);
    alert(error.message);
  }
}

// Google OAuth Modal handlers
const googleModal = document.getElementById('google-modal');
const googleModalContent = document.getElementById('google-modal-content');
const googleConfigStep = document.getElementById('google-config-step');
const googleEmailStep = document.getElementById('google-email-step');
const googleNameStep = document.getElementById('google-name-step');
const googleLoading = document.getElementById('google-loading');
const googleLoadingText = document.getElementById('google-loading-text');

function openGoogleModal() {
  googleModal.classList.remove('pointer-events-none', 'opacity-0');
  googleModalContent.classList.remove('scale-95');
  googleModalContent.classList.add('scale-100');

  const savedGoogleId = localStorage.getItem('qualm_google_client_id');
  if (savedGoogleId && savedGoogleId !== 'mock') {
    closeGoogleModal();
    triggerRealGoogleOAuth(savedGoogleId);
  } else {
    showGoogleConfigStep();
  }
}

function closeGoogleModal() {
  googleModal.classList.add('pointer-events-none', 'opacity-0');
  googleModalContent.classList.add('scale-95');
  googleModalContent.classList.remove('scale-100');
}

function showGoogleConfigStep() {
  googleConfigStep.classList.remove('hidden');
  googleEmailStep.classList.add('hidden');
  googleNameStep.classList.add('hidden');
  googleLoading.classList.add('hidden');

  document.getElementById('google-modal-title').textContent = "Google Sign-In Options";
  document.getElementById('google-modal-subtitle').classList.add('hidden');

  const savedGoogleId = localStorage.getItem('qualm_google_client_id') || '';
  document.getElementById('google-client-id-input').value = savedGoogleId === 'mock' ? '' : savedGoogleId;
}

function saveAndLaunchRealGoogleOAuth() {
  const clientId = document.getElementById('google-client-id-input').value.trim();
  if (!clientId) {
    alert("Please enter a Google Client ID to connect.");
    return;
  }
  localStorage.setItem('qualm_google_client_id', clientId);
  closeGoogleModal();
  triggerRealGoogleOAuth(clientId);
}

function triggerRealGoogleOAuth(clientId) {
  try {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      alert("Google Client script loading, please try again in a few seconds.");
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          showGoogleLoadingState("Retrieving profile from Google...");

          fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
          })
          .then(res => res.json())
          .then(profile => {
            currentUser = {
              name: profile.name,
              email: profile.email,
              avatar: profile.picture,
              provider: 'google'
            };
            localStorage.setItem('qualm_user', JSON.stringify(currentUser));
            showChatSection();
            closeGoogleModal();
          })
          .catch(err => {
            console.error(err);
            alert("Failed loading profile info from Google API.");
            showGoogleConfigStep();
          });
        }
      },
      error_callback: (err) => {
        console.error(err);
        alert("Google Authentication failed.");
        showGoogleConfigStep();
      }
    });

    client.requestAccessToken({ prompt: 'select_account' });
  } catch (e) {
    console.error(e);
    alert("OAuth Client connection error.");
    showGoogleConfigStep();
  }
}

function showGoogleLoadingState(text) {
  googleModal.classList.remove('pointer-events-none', 'opacity-0');
  googleModalContent.classList.remove('scale-95');
  googleModalContent.classList.add('scale-100');

  googleConfigStep.classList.add('hidden');
  googleEmailStep.classList.add('hidden');
  googleNameStep.classList.add('hidden');
  googleLoading.classList.remove('hidden');
  googleLoadingText.textContent = text;
}

function launchSimulatedLogin() {
  localStorage.setItem('qualm_google_client_id', 'mock');
  googleConfigStep.classList.add('hidden');
  googleEmailStep.classList.remove('hidden');
  googleNameStep.classList.add('hidden');

  document.getElementById('google-modal-title').textContent = "Sign in with Google";
  document.getElementById('google-modal-subtitle').classList.remove('hidden');

  setTimeout(() => { document.getElementById('google-email-input').focus(); }, 100);
}

function handleGoogleEmailKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    goToGoogleNameStep();
  }
}

function handleGoogleNameKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitGoogleLogin();
  }
}

function goToGoogleNameStep() {
  const emailInput = document.getElementById('google-email-input');
  const error = document.getElementById('google-email-error');
  error.classList.add('hidden');

  if (!emailInput.value || !emailInput.value.includes('@')) {
    error.classList.remove('hidden');
    return;
  }

  googleEmailStep.classList.add('hidden');
  googleNameStep.classList.remove('hidden');
  document.getElementById('google-selected-email-pill').textContent = emailInput.value;
  document.getElementById('google-modal-title').textContent = "Welcome";
  document.getElementById('google-modal-subtitle').classList.add('hidden');

  setTimeout(() => { document.getElementById('google-name-input').focus(); }, 100);
}

function goBackToGoogleEmailStep() {
  googleNameStep.classList.add('hidden');
  googleEmailStep.classList.remove('hidden');
  document.getElementById('google-modal-title').textContent = "Sign in with Google";
  document.getElementById('google-modal-subtitle').classList.remove('hidden');
}

function submitGoogleLogin() {
  const nameInput = document.getElementById('google-name-input');
  const emailInput = document.getElementById('google-email-input');
  const error = document.getElementById('google-name-error');
  error.classList.add('hidden');

  if (!nameInput.value.trim()) {
    error.classList.remove('hidden');
    return;
  }

  googleNameStep.classList.add('hidden');
  googleLoading.classList.remove('hidden');
  googleLoadingText.textContent = "Connecting to Google...";

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameInput.value)}&background=1A1A1A&color=ffb300&bold=true&size=128`;

  setTimeout(() => {
    currentUser = {
      name: nameInput.value.trim(),
      email: emailInput.value,
      avatar: avatarUrl,
      provider: 'google'
    };
    localStorage.setItem('qualm_user', JSON.stringify(currentUser));
    showChatSection();
    closeGoogleModal();
  }, 1200);
}

// Sidebar Drawer
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
  const isClosed = sidebar.classList.contains('-translate-x-full');
  if (isClosed) {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('pointer-events-none', 'opacity-0');
  } else {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('pointer-events-none', 'opacity-0');
  }
}

// Settings Modal
const settingsModal = document.getElementById('settings-modal');
const settingsContent = document.getElementById('settings-modal-content');

function openSettingsModal() {
  document.getElementById('settings-avatar').src = currentUser.avatar;
  document.getElementById('settings-user-name').textContent = currentUser.name;
  document.getElementById('settings-user-email').textContent = currentUser.email;
  document.getElementById('settings-provider-badge').textContent = 
    currentUser.provider === 'google' ? 'Google Account' : 'Standard Account';

  settingsModal.classList.remove('pointer-events-none', 'opacity-0');
  settingsContent.classList.remove('scale-95');
  settingsContent.classList.add('scale-100');
}

function closeSettingsModal() {
  settingsModal.classList.add('pointer-events-none', 'opacity-0');
  settingsContent.classList.add('scale-95');
  settingsContent.classList.remove('scale-100');
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key');
  const icon = document.getElementById('api-key-visibility-icon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    icon.textContent = 'visibility';
  }
}

function saveSettings() {
  const apiKey = document.getElementById('api-key').value.trim();
  const googleId = document.getElementById('google-client-id').value.trim();

  localStorage.setItem('qualm_gemini_api_key', apiKey);
  localStorage.setItem('qualm_google_client_id', googleId);

  closeSettingsModal();
  showToast('Settings saved successfully');
}

function handleLogOut() {
  localStorage.removeItem('qualm_user');
  localStorage.removeItem('qualm_chats');
  localStorage.removeItem('qualm_google_client_id');
  localStorage.removeItem('qualm_gemini_api_key');
  
  closeSettingsModal();
  showLoginSection();
}

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const message = document.getElementById('toast-message');

  message.textContent = msg;
  if (isError) {
    icon.textContent = 'error';
    icon.className = 'material-symbols-outlined text-red-500 text-base';
  } else {
    icon.textContent = 'check_circle';
    icon.className = 'material-symbols-outlined text-green-500 text-base';
  }

  toast.classList.remove('opacity-0', 'pointer-events-none');
  toast.classList.add('opacity-100');

  setTimeout(() => {
    toast.classList.add('opacity-0', 'pointer-events-none');
    toast.classList.remove('opacity-100');
  }, 3000);
}

// File Attachment handling
function triggerFileInput() {
  document.getElementById('file-input').click();
}

function handleFileSelected(e) {
  const file = e.target.files[0];
  if (file) {
    selectedFile = file;
    const bar = document.getElementById('attachment-bar');
    const nameLabel = document.getElementById('attached-file-name');
    nameLabel.textContent = `${file.name} (${formatBytes(file.size)})`;
    bar.classList.remove('hidden');
  }
}

function removeAttachment() {
  selectedFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('attachment-bar').classList.add('hidden');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Suggested prompt selection
function selectSuggestedPrompt(title, text) {
  const input = document.getElementById('chat-input');
  input.value = text;
  input.focus();
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
}

// Chat Send Engine
function handleKeyPress(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function updateSliderLabel(val) {
  const label = document.getElementById('slider-label');
  const depths = ['Gentle', 'Medium', 'Brutal'];
  label.textContent = depths[val - 1];
}

function lockDepthSlider() {
  const val = document.getElementById('depth-slider').value;
  const depths = ['Gentle', 'Medium', 'Brutal'];
  const chosenDepth = depths[val - 1];

  currentState.depth = chosenDepth;

  // Hide depth slider controls
  document.getElementById('depth-slider-container').classList.add('hidden');
  document.getElementById('message-controls-container').classList.remove('hidden');

  // Submit locked depth as the step 5 message
  sendStepPayload(`I choose ${chosenDepth} depth.`);
}

function sendStepPayload(messageText) {
  // Clear any active pressure timer if they reply
  if (pressureTimer) {
    clearInterval(pressureTimer);
    pressureTimer = null;
    document.getElementById('pressure-timer-bar-container').classList.add('hidden');
  }

  // Display change states
  document.getElementById('initial-state').classList.add('hidden');
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.classList.remove('hidden');

  // Helper to save session to Supabase
  async function saveSessionToDatabase(session) {
    if (!currentUser) return;
    try {
      await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: session.id,
          user_email: currentUser.email,
          title: session.title,
          history: session.history,
          state: session.state,
          timestamp: session.timestamp
        })
      });
    } catch (err) {
      console.error("Failed to save session to Supabase:", err);
    }
  }

  // Setup sessionId if none is active
  if (!activeSessionId) {
    activeSessionId = Date.now().toString();
    const firstText = messageText || (selectedFile ? `Document: ${selectedFile.name}` : "Discourse Session");
    const title = firstText.substring(0, 30) + (firstText.length > 30 ? '...' : '');
    
    const newSession = {
      id: activeSessionId,
      title: title,
      history: [],
      state: JSON.parse(JSON.stringify(currentState)),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    chatSessions.unshift(newSession);
    saveSessions();
    saveSessionToDatabase(newSession);
    renderRecentSessionsList();
  }

  const userMsg = {
    role: 'user',
    content: messageText,
    file: selectedFile ? { name: selectedFile.name, size: selectedFile.size } : null
  };

  // Push to history
  chatHistory.push({ role: 'user', content: messageText });
  renderUserMessage(userMsg);

  // Clean inputs
  document.getElementById('chat-input').value = '';
  document.getElementById('chat-input').style.height = 'auto';
  removeAttachment();

  // Scroll to bottom
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

  // Render thinking loader
  const loaderId = renderThinkingLoader();

  // Trigger POST call
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: messageText,
      history: chatHistory,
      state: currentState
    })
  })
  .then(res => {
    if (!res.ok) throw new Error("HTTP error " + res.status);
    return res.json();
  })
  .then(data => {
    removeLoader(loaderId);

    // Update global state variables
    currentState = data.state;
    chatHistory.push({ role: 'assistant', content: data.response });

    if (currentState.step === 10) {
      lastStressReport = data.response;
    }

    // Render response
    renderAIMessage(data.response, currentState.step);

    // Save updated session
    const currentSession = chatSessions.find(s => s.id === activeSessionId);
    if (currentSession) {
      currentSession.history = JSON.parse(JSON.stringify(chatHistory));
      currentSession.state = JSON.parse(JSON.stringify(currentState));
      saveSessions();
      saveSessionToDatabase(currentSession);
    }

    // Post-step triggers
    handlePostStepLogic();

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  })
  .catch(err => {
    console.error(err);
    removeLoader(loaderId);
    renderErrorMessage("Failed to communicate with Qualm AI. Verify your local server connection.");
  });
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text && !selectedFile) return;

  sendStepPayload(text);
}

function handlePostStepLogic() {
  // Step 5: Slider Prompt Selection
  if (currentState.step === 5) {
    document.getElementById('message-controls-container').classList.add('hidden');
    document.getElementById('depth-slider-container').classList.remove('hidden');
  }

  // Step 7: Trigger the Pressure Simulator Timer
  if (currentState.step === 7) {
    triggerPressureSimulatorCountdown();
  }

  // Step 9: Disable input panel on final step
  if (currentState.step === 10) {
    document.getElementById('message-controls-container').classList.add('hidden');
    document.getElementById('depth-slider-container').classList.add('hidden');
  }
}

function triggerPressureSimulatorCountdown() {
  const barContainer = document.getElementById('pressure-timer-bar-container');
  const bar = document.getElementById('pressure-timer-bar');
  
  barContainer.classList.remove('hidden');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  
  // Trigger layout flush
  bar.offsetHeight;
  
  bar.style.transition = `width ${pressureCountdownSeconds}s linear`;
  bar.style.width = '0%';

  let secondsRemaining = pressureCountdownSeconds;
  
  pressureTimer = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      clearInterval(pressureTimer);
      pressureTimer = null;
      barContainer.classList.add('hidden');
      
      // Auto-submit countdown expiration choice
      sendStepPayload("Time expired: I froze under pressure.");
    }
  }, 1000);
}

function renderUserMessage(msg) {
  const container = document.getElementById('chat-messages');
  let fileHtml = '';
  
  if (msg.file) {
    fileHtml = `
      <div class="mt-2 flex items-center gap-3 p-3 rounded-xl border border-charcoal/10 bg-charcoal/5 w-fit">
        <span class="material-symbols-outlined text-[20px] text-primary">description</span>
        <div class="text-left select-none">
          <p class="text-xs font-semibold text-charcoal truncate max-w-[150px]">${msg.file.name}</p>
          <p class="text-[9px] text-stone uppercase tracking-wider font-bold">${formatBytes(msg.file.size)}</p>
        </div>
      </div>
    `;
  }

  const html = `
    <div class="flex flex-row-reverse gap-4 max-w-2xl ml-auto animate-in fade-in duration-200">
      <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 border border-charcoal/10 overflow-hidden shadow">
        <img class="w-full h-full object-cover" src="${currentUser ? currentUser.avatar : ''}" alt="User">
      </div>
      <div class="bg-primary p-4 rounded-xl max-w-[85%] text-right md:text-left shadow-md">
        <p class="text-sm text-cream leading-relaxed break-words whitespace-pre-wrap">${msg.content}</p>
        ${fileHtml}
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

function renderThinkingLoader() {
  const container = document.getElementById('chat-messages');
  const id = 'loader-' + Date.now();
  const html = `
    <div id="${id}" class="flex gap-4 max-w-2xl animate-pulse-subtle">
      <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
        <span class="material-symbols-outlined text-primary/60 text-[18px]">temp_preferences_custom</span>
      </div>
      <div class="flex items-center gap-1.5 py-3">
        <span class="w-1.5 h-1.5 bg-charcoal rounded-full animate-bounce" style="animation-delay: 0ms"></span>
        <span class="w-1.5 h-1.5 bg-charcoal rounded-full animate-bounce" style="animation-delay: 150ms"></span>
        <span class="w-1.5 h-1.5 bg-charcoal rounded-full animate-bounce" style="animation-delay: 300ms"></span>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
  return id;
}

function removeLoader(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function renderAIMessage(content, step) {
  const container = document.getElementById('chat-messages');
  
  let formattedHtml = '';
  
  if (step === 10) {
    // Rend final Step 9 Reasoning Stress Report Card
    formattedHtml = `
      <div class="w-full bg-white/80 border border-charcoal/10 rounded-2xl p-6 shadow-2xl space-y-6">
        <div class="flex items-center gap-2 border-b border-charcoal/10 pb-4">
          <span class="material-symbols-outlined text-charcoal text-2xl">gavel</span>
          <h2 class="text-xl font-bold font-serif text-charcoal tracking-tight italic">Reasoning Stress Report</h2>
        </div>
        <div class="prose max-w-none text-sm text-charcoal space-y-4">
          ${parseMarkdown(content)}
        </div>
        <div class="border-t border-charcoal/10 pt-4 flex gap-4">
          <button onclick="downloadReport()" class="flex-1 py-3 border border-charcoal text-charcoal font-semibold text-xs rounded-xl hover:bg-charcoal/5 transition-colors uppercase tracking-wider flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-base">download</span>
            Download Report
          </button>
          <button onclick="resetChat()" class="flex-grow py-3 bg-charcoal text-cream font-semibold text-xs rounded-xl hover:bg-stone transition-colors uppercase tracking-wider flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-base">refresh</span>
            New Decision Test
          </button>
        </div>
      </div>
    `;
  } else {
    // Normal Socratic message bubble
    formattedHtml = `
      <div class="flex gap-4 max-w-2xl animate-in fade-in duration-200">
        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1 shadow-lg">
          <span class="material-symbols-outlined text-cream text-[18px]">temp_preferences_custom</span>
        </div>
        <div class="space-y-3 flex-grow">
          <div class="glass-panel p-4 rounded-xl border-charcoal/5 text-sm text-charcoal leading-relaxed break-words whitespace-pre-wrap">
            ${parseMarkdown(content)}
          </div>
        </div>
      </div>
    `;
  }

  container.insertAdjacentHTML('beforeend', formattedHtml);
}

function renderErrorMessage(msg) {
  const container = document.getElementById('chat-messages');
  const html = `
    <div class="flex gap-4 max-w-2xl">
      <div class="w-8 h-8 rounded bg-red-950/20 border border-red-900/30 flex items-center justify-center shrink-0 mt-1">
        <span class="material-symbols-outlined text-red-600 text-base">error</span>
      </div>
      <div class="p-4 bg-red-950/10 border border-red-900/20 rounded text-red-600 text-xs flex-grow font-sans leading-relaxed">
        <p class="font-bold flex items-center gap-1"><span class="material-symbols-outlined text-xs">warning</span> Connection Interrupted</p>
        <p class="mt-1">${msg}</p>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

// Simple markdown compiler
function parseMarkdown(text) {
  return text
    .replace(/### (.*)/g, '<h3 class="text-md font-bold text-primary mt-4 mb-1 uppercase tracking-wider">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-primary">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-primary">$1</em>')
    .replace(/^\* (.*)/gm, '<li class="list-disc list-inside ml-4 py-0.5 text-stone">$1</li>')
    .replace(/^\d+\. (.*)/gm, '<li class="list-decimal list-inside ml-4 py-0.5 text-stone">$1</li>')
    .replace(/\n\n/g, '<div class="h-2"></div>')
    .replace(/\n/g, '<br>');
}

// Local Storage History logs
async function loadChatSessions() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/chats/${encodeURIComponent(currentUser.email)}`);
    if (!res.ok) throw new Error("Failed to load sessions");
    chatSessions = await res.json();
    renderRecentSessionsList();
  } catch (err) {
    console.error("Failed loading chat sessions from database:", err);
    // Fallback to local storage
    const raw = localStorage.getItem('qualm_chats');
    if (raw) {
      chatSessions = JSON.parse(raw);
      renderRecentSessionsList();
    }
  }
}

function saveSessions() {
  localStorage.setItem('qualm_chats', JSON.stringify(chatSessions));
}

function renderRecentSessionsList() {
  const list = document.getElementById('recent-chats-list');
  if (chatSessions.length === 0) {
    list.innerHTML = '<p class="text-xs text-stone/40 italic px-2">No recent tests.</p>';
    return;
  }

  list.innerHTML = chatSessions.map(s => `
    <div class="group flex items-center justify-between px-3 py-2 hover:bg-primary/5 rounded transition-all text-left w-full ${s.id === activeSessionId ? 'bg-primary/10 text-primary font-semibold' : 'text-stone'}">
      <button onclick="loadSession('${s.id}')" class="flex-grow flex items-center gap-2 truncate text-left">
        <span class="material-symbols-outlined text-[16px] text-stone/50">gavel</span>
        <span class="text-xs truncate max-w-[160px]">${s.title}</span>
      </button>
      <button onclick="deleteSession(event, '${s.id}')" class="material-symbols-outlined text-[14px] text-stone hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">delete</button>
    </div>
  `).join('');
}

function loadSession(id) {
  const session = chatSessions.find(s => s.id === id);
  if (!session) return;

  activeSessionId = id;
  chatHistory = JSON.parse(JSON.stringify(session.history));
  currentState = JSON.parse(JSON.stringify(session.state));

  if (currentState.step === 10 && chatHistory.length > 0) {
    const lastMsg = chatHistory[chatHistory.length - 1];
    if (lastMsg.role === 'assistant') {
      lastStressReport = lastMsg.content;
    }
  } else {
    lastStressReport = '';
  }

  // Hide suggested prompt hero
  document.getElementById('initial-state').classList.add('hidden');
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.innerHTML = '';
  chatMessages.classList.remove('hidden');

  // Render messages
  let stepIndex = 1;
  session.history.forEach((msg, idx) => {
    if (msg.role === 'user') {
      renderUserMessage({ content: msg.content, file: null });
    } else {
      // AI messages
      // Determine what step this message belonged to
      let currentMsgStep = 1;
      // We can estimate based on iteration or just send the current step if it's the last one
      if (idx === session.history.length - 1) {
        currentMsgStep = currentState.step;
      }
      renderAIMessage(msg.content, currentMsgStep);
    }
  });

  // Show/Hide inputs based on step
  document.getElementById('message-controls-container').classList.remove('hidden');
  document.getElementById('depth-slider-container').classList.add('hidden');
  document.getElementById('pressure-timer-bar-container').classList.add('hidden');

  handlePostStepLogic();

  toggleSidebar(); // Close side panel
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
}

async function deleteSession(e, id) {
  e.stopPropagation();
  chatSessions = chatSessions.filter(s => s.id !== id);
  saveSessions();
  renderRecentSessionsList();

  if (activeSessionId === id) {
    resetChat();
  }

  // Delete from database
  try {
    await fetch(`/api/chats/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.error("Failed to delete session from Supabase:", err);
  }
}

function resetChat() {
  activeSessionId = null;
  selectedFile = null;
  chatHistory = [];
  currentState = {
    step: 1,
    depth: 'Medium',
    variables: {}
  };

  // Clear timers
  if (pressureTimer) {
    clearInterval(pressureTimer);
    pressureTimer = null;
  }

  document.getElementById('file-input').value = '';
  document.getElementById('attachment-bar').classList.add('hidden');
  document.getElementById('pressure-timer-bar-container').classList.add('hidden');
  document.getElementById('depth-slider-container').classList.add('hidden');
  document.getElementById('message-controls-container').classList.remove('hidden');

  document.getElementById('initial-state').classList.remove('hidden');
  document.getElementById('chat-messages').classList.add('hidden');
  document.getElementById('chat-messages').innerHTML = '';

  renderRecentSessionsList();
  
  if (!sidebar.classList.contains('-translate-x-full')) {
    toggleSidebar();
  }
}

function downloadReport() {
  if (!lastStressReport) {
    showToast('No report available to download.', true);
    return;
  }
  
  const decisionText = currentState.variables.decision || "My Decision";
  const header = `# Qualm AI - Reasoning Stress Report\nDecision: "${decisionText}"\nDate: ${new Date().toLocaleDateString()}\n\n---\n\n`;
  const fileContent = header + lastStressReport;
  
  const blob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  
  const cleanDecisionName = decisionText
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .substring(0, 35)
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
    
  link.download = `Stress_Report_${cleanDecisionName || 'discourse'}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Report downloaded successfully');
}

// Mock pages toast
function openMemoir() {
  showToast('Memoir compiling logged. (Simulation)');
}

function openAnalytics() {
  showToast('Analytical factors aggregated. (Simulation)');
}
