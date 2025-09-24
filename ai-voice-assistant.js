/**
 * AI Voice Assistant for Mental Health Support
 * Features: Voice-to-Voice, Voice-to-Text, Text-to-Text with Hugging Face APIs
 */

class AIVoiceAssistant {
    constructor() {
        this.isListening = false;
        this.isPlaying = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentLanguage = 'en';
        
        // Hugging Face API configuration (using free inference API)
        this.hfApiKey = null; // Will work with free tier without API key
        this.hfBaseUrl = 'https://api-inference.huggingface.co/models';
        
        // Model endpoints
        this.models = {
            speechToText: 'openai/whisper-large-v3',
            textGeneration: 'microsoft/DialoGPT-medium', // Alternative: 'facebook/blenderbot-400M-distill'
            textToSpeech: 'microsoft/speecht5_tts' // Alternative: 'espnet/kan-bayashi_ljspeech_vits'
        };

        this.initializeAudio();
        this.setupEventListeners();
    }

    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });
            console.log('Audio initialized successfully');
        } catch (error) {
            console.error('Error initializing audio:', error);
            this.showError('Microphone access denied. Voice features will be limited.');
        }
    }

    setupEventListeners() {
        // Voice control buttons
        const voiceBtn = document.getElementById('voiceBtn');
        const stopBtn = document.getElementById('stopVoiceBtn');
        
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => this.toggleVoiceRecording());
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopVoiceRecording());
        }
    }

    async toggleVoiceRecording() {
        if (this.isListening) {
            await this.stopVoiceRecording();
        } else {
            await this.startVoiceRecording();
        }
    }

    async startVoiceRecording() {
        if (!this.stream) {
            await this.initializeAudio();
        }

        try {
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(this.stream);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.processVoiceInput(audioBlob);
            };

            this.mediaRecorder.start();
            this.isListening = true;
            this.updateVoiceUI(true);
            
            console.log('Voice recording started');
        } catch (error) {
            console.error('Error starting voice recording:', error);
            this.showError('Failed to start voice recording');
        }
    }

    async stopVoiceRecording() {
        if (this.mediaRecorder && this.isListening) {
            this.mediaRecorder.stop();
            this.isListening = false;
            this.updateVoiceUI(false);
            console.log('Voice recording stopped');
        }
    }

    async processVoiceInput(audioBlob) {
        try {
            this.showProcessingIndicator('Converting speech to text...');
            
            // Convert speech to text using Hugging Face Whisper
            const transcription = await this.speechToText(audioBlob);
            
            if (transcription) {
                // Add user message to chat
                this.addMessageToChat(transcription, 'user');
                
                this.showProcessingIndicator('Generating response...');
                
                // Generate AI response
                const aiResponse = await this.generateAIResponse(transcription);
                
                // Add AI response to chat
                this.addMessageToChat(aiResponse, 'bot');
                
                this.showProcessingIndicator('Converting to speech...');
                
                // Convert response to speech and play
                await this.textToSpeech(aiResponse);
            }
            
            this.hideProcessingIndicator();
            
        } catch (error) {
            console.error('Error processing voice input:', error);
            this.showError('Failed to process voice input');
            this.hideProcessingIndicator();
        }
    }

    async speechToText(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.wav');

            const response = await fetch(`${this.hfBaseUrl}/${this.models.speechToText}`, {
                method: 'POST',
                headers: this.hfApiKey ? {
                    'Authorization': `Bearer ${this.hfApiKey}`
                } : {},
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.text || (result[0] && result[0].text) || '';
            
        } catch (error) {
            console.error('Speech to text error:', error);
            
            // Fallback: Use Web Speech API if available
            if ('webkitSpeechRecognition' in window) {
                return await this.fallbackSpeechToText();
            }
            
            throw error;
        }
    }

    async fallbackSpeechToText() {
        return new Promise((resolve, reject) => {
            const recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = this.currentLanguage === 'en' ? 'en-US' : 'mr-IN';

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                resolve(transcript);
            };

            recognition.onerror = (event) => {
                reject(new Error(`Speech recognition error: ${event.error}`));
            };

            recognition.start();
        });
    }

    async generateAIResponse(message) {
        try {
            // Enhanced mental health focused response generation
            const mentalHealthPrompt = this.createMentalHealthPrompt(message);
            
            const response = await fetch(`${this.hfBaseUrl}/${this.models.textGeneration}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.hfApiKey ? { 'Authorization': `Bearer ${this.hfApiKey}` } : {})
                },
                body: JSON.stringify({
                    inputs: mentalHealthPrompt,
                    parameters: {
                        max_length: 150,
                        temperature: 0.7,
                        do_sample: true,
                        top_p: 0.9,
                        return_full_text: false
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            let aiResponse = '';
            
            if (Array.isArray(result) && result[0]) {
                aiResponse = result[0].generated_text || result[0].text || '';
            } else if (result.generated_text) {
                aiResponse = result.generated_text;
            }

            // Clean and enhance the response
            aiResponse = this.enhanceResponse(aiResponse.trim(), message);
            
            return aiResponse || this.getFallbackResponse(message);
            
        } catch (error) {
            console.error('AI response generation error:', error);
            return this.getFallbackResponse(message);
        }
    }

    createMentalHealthPrompt(userMessage) {
        const context = `You are an empathetic AI mental health support assistant specifically designed for students. 
        You provide compassionate, understanding responses while encouraging professional help when needed.
        
        User: ${userMessage}
        Assistant: `;
        
        return context;
    }

    enhanceResponse(aiResponse, userMessage) {
        // Remove any prompt repetition
        const cleanResponse = aiResponse.replace(/^(You are an empathetic|Assistant:|User:).*$/gm, '').trim();
        
        // Add empathy and student-specific guidance if response is too generic
        if (cleanResponse.length < 20) {
            return this.getFallbackResponse(userMessage);
        }
        
        // Ensure response ends appropriately
        let enhanced = cleanResponse;
        if (!enhanced.endsWith('.') && !enhanced.endsWith('!') && !enhanced.endsWith('?')) {
            enhanced += '.';
        }
        
        // Add gentle encouragement for professional help if discussing serious topics
        const seriousTopics = ['suicide', 'self-harm', 'hopeless', 'crisis', 'emergency'];
        if (seriousTopics.some(topic => userMessage.toLowerCase().includes(topic))) {
            enhanced += " Remember, if you're having thoughts of self-harm, please reach out immediately to a crisis helpline or emergency services.";
        }
        
        return enhanced;
    }

    getFallbackResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        const responses = {
            anxiety: [
                "I understand that anxiety can feel overwhelming, especially as a student. Would you like to try a quick breathing exercise together?",
                "Anxiety is very common among students. What specific situation is making you feel anxious right now?",
                "I hear that you're feeling anxious. Remember, these feelings are temporary. Let's talk about some coping strategies."
            ],
            stress: [
                "Student life can be incredibly stressful. What's the biggest source of stress for you right now?",
                "I can sense you're feeling stressed. Sometimes breaking things down into smaller, manageable steps helps. What's on your mind?",
                "Stress is a normal part of student life, but it doesn't have to overwhelm you. Let's work through this together."
            ],
            depression: [
                "I'm sorry you're going through a difficult time. These feelings are valid, and you don't have to face them alone.",
                "Depression can make everything feel harder, especially balancing studies and personal life. Have you been able to talk to anyone about how you're feeling?",
                "Thank you for sharing something so personal with me. Remember that seeking help is a sign of strength, not weakness."
            ],
            default: [
                "I'm here to listen and support you. Can you tell me more about what's on your mind?",
                "It sounds like you're going through something challenging. I'm here to help however I can.",
                "Thank you for reaching out. Sometimes just talking about what we're feeling can be really helpful. What would you like to share?"
            ]
        };

        let category = 'default';
        if (lowerMessage.includes('anxious') || lowerMessage.includes('anxiety') || lowerMessage.includes('worried')) {
            category = 'anxiety';
        } else if (lowerMessage.includes('stress') || lowerMessage.includes('overwhelmed') || lowerMessage.includes('pressure')) {
            category = 'stress';
        } else if (lowerMessage.includes('sad') || lowerMessage.includes('depressed') || lowerMessage.includes('hopeless')) {
            category = 'depression';
        }

        const categoryResponses = responses[category];
        return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
    }

    async textToSpeech(text) {
        try {
            const response = await fetch(`${this.hfBaseUrl}/${this.models.textToSpeech}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.hfApiKey ? { 'Authorization': `Bearer ${this.hfApiKey}` } : {})
                },
                body: JSON.stringify({
                    inputs: text
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const audioBuffer = await response.arrayBuffer();
            await this.playAudioBuffer(audioBuffer);
            
        } catch (error) {
            console.error('Text to speech error:', error);
            
            // Fallback: Use Web Speech API
            if ('speechSynthesis' in window) {
                this.fallbackTextToSpeech(text);
            }
        }
    }

    async playAudioBuffer(audioBuffer) {
        try {
            const audioContext = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
            const audioBufferDecoded = await audioContext.decodeAudioData(audioBuffer);
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBufferDecoded;
            source.connect(audioContext.destination);
            
            this.isPlaying = true;
            this.updatePlaybackUI(true);
            
            source.onended = () => {
                this.isPlaying = false;
                this.updatePlaybackUI(false);
            };
            
            source.start();
            
        } catch (error) {
            console.error('Audio playback error:', error);
            this.isPlaying = false;
            this.updatePlaybackUI(false);
        }
    }

    fallbackTextToSpeech(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.currentLanguage === 'en' ? 'en-US' : 'mr-IN';
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            
            utterance.onstart = () => {
                this.isPlaying = true;
                this.updatePlaybackUI(true);
            };
            
            utterance.onend = () => {
                this.isPlaying = false;
                this.updatePlaybackUI(false);
            };
            
            speechSynthesis.speak(utterance);
        }
    }

    // Enhanced text-to-text functionality
    async sendTextMessage(message) {
        if (!message.trim()) return;
        
        try {
            // Add user message to chat
            this.addMessageToChat(message, 'user');
            
            this.showProcessingIndicator('Generating response...');
            
            // Generate AI response
            const aiResponse = await this.generateAIResponse(message);
            
            // Add AI response to chat
            this.addMessageToChat(aiResponse, 'bot');
            
            this.hideProcessingIndicator();
            
        } catch (error) {
            console.error('Error sending text message:', error);
            this.showError('Failed to generate response');
            this.hideProcessingIndicator();
        }
    }

    // Voice-to-text only (accessibility feature)
    async voiceToTextOnly() {
        try {
            await this.startVoiceRecording();
            
            // Override the normal voice processing to only do transcription
            const originalProcessVoiceInput = this.processVoiceInput;
            this.processVoiceInput = async (audioBlob) => {
                try {
                    this.showProcessingIndicator('Converting speech to text...');
                    const transcription = await this.speechToText(audioBlob);
                    
                    if (transcription) {
                        // Just insert the transcription into the input field
                        const chatInput = document.getElementById('chatInput');
                        if (chatInput) {
                            chatInput.value = transcription;
                            chatInput.focus();
                        }
                    }
                    
                    this.hideProcessingIndicator();
                } catch (error) {
                    console.error('Voice to text error:', error);
                    this.showError('Failed to convert speech to text');
                    this.hideProcessingIndicator();
                }
                
                // Restore original function
                this.processVoiceInput = originalProcessVoiceInput;
            };
            
        } catch (error) {
            console.error('Voice to text only error:', error);
            this.showError('Failed to start voice to text');
        }
    }

    // UI Helper Methods
    addMessageToChat(text, sender) {
        // Use existing addMessage function if available, otherwise implement
        if (typeof addMessage === 'function') {
            addMessage(text, sender);
        } else {
            this.fallbackAddMessage(text, sender);
        }
    }

    fallbackAddMessage(text, sender) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = text;
        
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateVoiceUI(isListening) {
        const voiceBtn = document.getElementById('voiceBtn');
        const stopBtn = document.getElementById('stopVoiceBtn');
        const voiceIndicator = document.getElementById('voiceIndicator');
        
        if (voiceBtn) {
            voiceBtn.disabled = isListening;
            voiceBtn.classList.toggle('listening', isListening);
        }
        
        if (stopBtn) {
            stopBtn.style.display = isListening ? 'inline-block' : 'none';
        }
        
        if (voiceIndicator) {
            voiceIndicator.style.display = isListening ? 'inline-block' : 'none';
        }
    }

    updatePlaybackUI(isPlaying) {
        const playbackIndicator = document.getElementById('playbackIndicator');
        
        if (playbackIndicator) {
            playbackIndicator.style.display = isPlaying ? 'inline-block' : 'none';
        }
    }

    showProcessingIndicator(message) {
        const indicator = document.getElementById('processingIndicator');
        if (indicator) {
            indicator.textContent = message;
            indicator.style.display = 'block';
        }
    }

    hideProcessingIndicator() {
        const indicator = document.getElementById('processingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('voiceError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        } else {
            console.error('Voice Assistant Error:', message);
        }
    }

    setLanguage(language) {
        this.currentLanguage = language;
    }
}

// Export for use in HTML files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIVoiceAssistant;
}