
let currentUserId = null;
let selectedUserId = null;
let socket = null;
const API_BASE = globalThis.__API_BASE__ || '';

// Fetch current user info
async function getCurrentUser() {
  const res = await fetch(API_BASE + '/api/me');
  if (res.ok) return res.json();
  return null;
}

// Fetch user list
async function getUserList() {
  const res = await fetch(API_BASE + '/api/users');
  if (res.ok) return res.json();
  return [];
}

// Fetch chat history
async function getChatHistory(userId) {
  const res = await fetch(API_BASE + `/chat/${userId}`);
  if (res.ok) return res.json();
  return [];
}

// Render user list with unread badges
async function renderUserList() {
  const userList = await getUserList();
  const ul = document.getElementById('user-list');
  ul.innerHTML = '';
  userList.forEach(user => {
    if (user.id === currentUserId) return;
    const li = document.createElement('li');
    li.className = 'chat-user';
    li.dataset.userId = user.id;
    li.innerHTML = `<div class="chat-user-name">${user.username}</div><div class="unread-badge" data-count="0"></div>`;
    li.onclick = () => selectUser(user.id, user.username);
    ul.appendChild(li);
  });
}

// Render chat header
function renderChatHeader(username) {
  const header = document.getElementById('chat-header');
  header.innerHTML = `<strong>${username}</strong>`;
}

// Render chat messages with meta
function renderMessages(messages) {
  const box = document.getElementById('chat-messages');
  box.innerHTML = '';
  messages.forEach(msg => {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-row ' + (msg.from_user_id === currentUserId ? 'sent-row' : 'received-row');
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.innerHTML = `<span class="meta-name">${msg.from_username}</span> <span class="meta-time">${new Date(msg.created_at).toLocaleString()}</span>`;
    const div = document.createElement('div');
    div.className = 'message ' + (msg.from_user_id === currentUserId ? 'sent' : 'received');
    div.textContent = msg.content;
    wrapper.appendChild(meta);
    wrapper.appendChild(div);
    box.appendChild(wrapper);
  });
  box.scrollTop = box.scrollHeight;
}

// Select a user and join room
async function selectUser(userId, username) {
  selectedUserId = userId;
  // reset unread badge
  const li = document.querySelector(`#user-list li[data-user-id="${userId}"]`);
  if (li) {
    const badge = li.querySelector('.unread-badge');
    if (badge) { badge.setAttribute('data-count', '0'); badge.textContent = ''; }
  }
  renderChatHeader(username);
  const messages = await getChatHistory(userId);
  renderMessages(messages);
  if (socket) {
    socket.emit('joinRoom', { userA: currentUserId, userB: userId });
  }
}

// Send message
async function sendMessage() {
  const input = document.getElementById('message-input');
  const messageText = input.value.trim();
  if (!messageText || !selectedUserId) return;
  await fetch(API_BASE + `/chat/${selectedUserId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: messageText })
  });
  // Emit real-time event
  socket.emit('chatMessage', { fromUserId: currentUserId, toUserId: selectedUserId, content: messageText });
  // Append locally
  const box = document.getElementById('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.className = 'message-row sent-row';
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.innerHTML = `<span class="meta-name">You</span> <span class="meta-time">${new Date().toLocaleString()}</span>`;
  const div = document.createElement('div');
  div.className = 'message sent';
  div.textContent = messageText;
  wrapper.appendChild(meta);
  wrapper.appendChild(div);
  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;
  input.value = '';
}

// Socket setup
function setupSocket() {
  if (API_BASE && API_BASE.startsWith('http')) {
    socket = io(API_BASE);
  } else {
    socket = io();
  }
  socket.on('chatMessage', ({ fromUserId, toUserId, content }) => {
    const partnerId = (fromUserId === currentUserId) ? toUserId : fromUserId;
    if (partnerId.toString() === (selectedUserId || '').toString()) {
      // append to current conversation
      const box = document.getElementById('chat-messages');
      const wrapper = document.createElement('div');
      wrapper.className = 'message-row received-row';
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.innerHTML = `<span class="meta-name">${fromUserId}</span> <span class="meta-time">${new Date().toLocaleString()}</span>`;
      const div = document.createElement('div');
      div.className = 'message received';
      div.textContent = content;
      wrapper.appendChild(meta);
      wrapper.appendChild(div);
      box.appendChild(wrapper);
      box.scrollTop = box.scrollHeight;
    } else {
      // increment unread badge
      const li = document.querySelector(`#user-list li[data-user-id="${partnerId}"]`);
      if (li) {
        const badge = li.querySelector('.unread-badge');
        const current = parseInt(badge.getAttribute('data-count') || '0', 10) + 1;
        badge.setAttribute('data-count', current);
        badge.textContent = current;
      }
    }
  });
}

globalThis.addEventListener('DOMContentLoaded', async () => {
  const me = await getCurrentUser();
  if (!me) return;
  currentUserId = me.id;
  setupSocket();
  await renderUserList();
  // Auto-open ?to=ID conversations
  const params = new URLSearchParams(globalThis.location.search);
  const to = params.get('to');
  if (to) {
    // wait a tick while list renders
    setTimeout(() => {
      const li = document.querySelector(`#user-list li[data-user-id="${to}"]`);
      const username = li ? li.querySelector('.chat-user-name').textContent : 'Seller';
      selectUser(to, username);
    }, 200);
  }
  document.getElementById('send-btn').onclick = sendMessage;
});
