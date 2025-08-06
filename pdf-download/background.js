// Background script for Google Drive PDF Downloader

class BackgroundService {
    constructor() {
        this.init();
    }
    
    init() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                console.log('Google Drive PDF Downloader installed');
            } else if (details.reason === 'update') {
                console.log('Google Drive PDF Downloader updated');
            }
        });
        
        // Handle messages from content script and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open
        });
        
        // Handle tab updates to inject content script if needed
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('drive.google.com')) {
                this.injectContentScript(tabId);
            }
        });
    }
    
    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'openPopup':
                    // Open the extension popup
                    await chrome.action.openPopup();
                    sendResponse({ success: true });
                    break;
                    
                case 'getVersion':
                    const manifest = chrome.runtime.getManifest();
                    sendResponse({ version: manifest.version });
                    break;
                    
                case 'openDevTools':
                    // Try to open developer tools for the current tab
                    if (sender.tab && sender.tab.id) {
                        try {
                            // Note: This may not work due to Chrome security restrictions
                            await chrome.debugger.attach({ tabId: sender.tab.id }, "1.0");
                            await chrome.debugger.detach({ tabId: sender.tab.id });
                            sendResponse({ success: true });
                        } catch (error) {
                            console.log('Could not open developer tools:', error);
                            sendResponse({ success: false, error: error.message });
                        }
                    } else {
                        sendResponse({ success: false, error: 'No tab context' });
                    }
                    break;
                    
                default:
                    // Forward other messages to all tabs (for popup communication)
                    if (message.type) {
                        this.forwardMessageToAllTabs(message);
                    }
                    sendResponse({ success: true });
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async injectContentScript(tabId) {
        try {
            // Check if content script is already injected
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => window.googleDrivePDFDownloaderInjected
            });
            
            if (!results[0]?.result) {
                // Inject content script
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                });
                
                // Mark as injected
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => { window.googleDrivePDFDownloaderInjected = true; }
                });
            }
        } catch (error) {
            console.error('Failed to inject content script:', error);
        }
    }
    
    async forwardMessageToAllTabs(message) {
        try {
            const tabs = await chrome.tabs.query({ url: 'https://drive.google.com/*' });
            
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, message);
                } catch (error) {
                    // Tab might not have content script loaded yet
                    console.log('Could not send message to tab:', tab.id);
                }
            }
        } catch (error) {
            console.error('Error forwarding message:', error);
        }
    }
}

// Initialize background service
new BackgroundService();
