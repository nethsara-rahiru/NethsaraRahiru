const GROQ_API_KEY = "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";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

const chatForm = document.getElementById('ai-chat-form');
const chatMessages = document.getElementById('ai-chat-messages');
const userInput = document.getElementById('ai-user-input');

let chatHistory = [
    {
        role: "system",
        content: "You are a professional, encouraging, and highly skilled Mathematics Tutor. Your goal is to help students understand mathematical concepts, solve problems step-by-step, and prepare for exams. Use clear, simple language but remain mathematically rigorous. If a student asks a non-math question, politely redirect them back to mathematics. You are part of the 'Nethsara Rahiru Student Self-learning Environment (SSLE)'."
    }
];

const appendMessage = (role, text) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    msgDiv.innerText = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
};

const getAIResponse = async (userText) => {
    const typingMsg = appendMessage('ai', 'Thinking...');
    
    chatHistory.push({ role: "user", content: userText });

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: chatHistory,
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        const data = await response.json();
        const aiText = data.choices[0].message.content;
        
        typingMsg.innerText = aiText;
        chatHistory.push({ role: "assistant", content: aiText });
        
        // Limit history to keep it performant
        if (chatHistory.length > 10) {
            chatHistory = [chatHistory[0], ...chatHistory.slice(-9)];
        }

    } catch (error) {
        console.error('Groq AI Error:', error);
        typingMsg.innerText = "I'm sorry, I'm having trouble connecting to my brain right now. Please try again in a moment.";
    }
};

chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    userInput.value = '';
    
    getAIResponse(text);
});
