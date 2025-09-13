const API_KEY = "AIzaSyCx9IOR6I_xtoyBkybS5-phOWl67ma0osQ";

const chatContainer = document.querySelector(".chat-window .chat");
const inputForm = document.querySelector(".chat-window .input-area");
const inputEl = document.querySelector(".chat-window .input-area input");
const sendBtn = document.querySelector(".chat-window .input-area button");
const toastEl = document.querySelector(".chat-window .toast");

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendMessage(role, text) {
  const roleClass = role === "user" ? "user" : "model";
  const html = `
    <div class="message ${roleClass}">
      <p>${text}</p>
    </div>
  `;
  chatContainer.insertAdjacentHTML("beforeend", html);
  scrollToBottom();
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.hidden = true;
  }, 3000);
}

async function callModel(input) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: input }] }] }),
        signal: controller.signal,
      }
    );
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw new Error("Network error. Check your connection.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json();
      detail = data.error?.message || JSON.stringify(data);
    } catch (_) {}
    throw new Error(`API error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from model.");
  return text;
}

async function handleSend(message) {
  if (!message.trim()) return;

  inputEl.value = "";
  appendMessage("user", message);

  // loading bubble
  const loadingId = `load-${Date.now()}`;
  chatContainer.insertAdjacentHTML(
    "beforeend",
    `<div id="${loadingId}" class="message model loading"><p>Thinking…</p></div>`
  );
  scrollToBottom();

  sendBtn.disabled = true;
  try {
    const response = await callModel(message);
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();
    appendMessage("model", response);
  } catch (e) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    const errorId = `err-${Date.now()}`;
    chatContainer.insertAdjacentHTML(
      "beforeend",
      `<div id="${errorId}" class="message model error">
        <p>${e.message || "Something went wrong."}<br>
        <button class="retry-btn" data-retry="${message}">Retry</button></p>
      </div>`
    );
    scrollToBottom();
    showToast(e.message || "Something went wrong.");
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

inputForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleSend(inputEl.value);
});

sendBtn.addEventListener("click", () => handleSend(inputEl.value));

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend(inputEl.value);
  }
});

window.addEventListener("load", () => {
  inputEl.focus();
  scrollToBottom();
});

// Delegate retry button clicks
chatContainer.addEventListener("click", (e) => {
  const target = e.target;
  if (target && target.classList.contains("retry-btn")) {
    const msg = target.getAttribute("data-retry") || "";
    const container = target.closest(".message.error");
    if (container) container.remove();
    handleSend(msg);
  }
});
