function sendMessage() {
  const input = document.getElementById("message-input");
  const messageText = input.value.trim();
  if (messageText === "") return;
let currentUser = "Me"; // logged-in user
let currentChatUser = null;

// Automatically load first user
window.onload = () => {
  showChat('Nobahle Nzimande');
};

// Show chat when a user is clicked
function showChat(user) {
  currentChatUser = user;
  document.getElementById("chat-header-username").textContent = user;
  loadMessages(user);
}

// Load messages from backend
function loadMessages(otherUser) {
  fetch(`http://localhost:3001/messages/${otherUser}`)
    .then(res => res.json())
    .then(messages => {
      const chatBox = document.getElementById("chat-messages");
      chatBox.innerHTML = "";

      messages.forEach(msg => {
        const div = document.createElement("div");
        div.className = msg.sender === currentUser ? "message sent" : "message received";

        const textNode = document.createElement("span");
        textNode.textContent = msg.text;
        div.appendChild(textNode);

        const timeNode = document.createElement("div");
        timeNode.className = "message-time";
        timeNode.textContent = new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        div.appendChild(timeNode);

        chatBox.appendChild(div);
      });

      chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch(err => console.error("Error loading messages:", err));
}

// Send message
function sendMessage() {
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text || !currentChatUser) return;

  const message = {
    sender: currentUser,
    receiver: currentChatUser,
    text
  };

  fetch("http://localhost:3001/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  })
  .then(res => res.json())
  .then(() => {
    input.value = "";
    loadMessages(currentChatUser);
  })
  .catch(err => console.error("Error sending message:", err));
}

  // Create message bubble
  const message = document.createElement("div");
  message.className = "message sent";
  message.textContent = messageText;

  // Append to chat
  const chatBox = document.getElementById("chat-messages");
  chatBox.appendChild(message);

  // Scroll to bottom
  chatBox.scrollTop = chatBox.scrollHeight;

  // Clear input
  input.value = "";
}
