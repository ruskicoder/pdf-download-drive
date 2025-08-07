class PopupController {
    constructor() {
        this.status = document.getElementById('status');
        this.log = document.getElementById('log');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.downloadSingleBtn = document.getElementById('downloadSingle');
        this.downloadAllBtn = document.getElementById('downloadAll');
        
        this.init();
    }
    
    init() {
        this.downloadSingleBtn.addEventListener('click', () => this.downloadSingle());
        this.downloadAllBtn.addEventListener('click', () => this.downloadAll());
        
        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
        });
        
        this.checkCurrentPage();
    }
    
    async checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('drive.google.com')) {
                this.setStatus('Please navigate to Google Drive', 'error');
                this.downloadSingleBtn.disabled = true;
                this.downloadAllBtn.disabled = true;
                return;
            }
            
            // Check if we're in a folder or file view
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkPage' });
            
            if (response && response.type === 'file') {
                this.setStatus('File preview detected - ready to download');
                this.downloadSingleBtn.disabled = false;
                this.downloadAllBtn.disabled = true;
            } else if (response && response.type === 'folder') {
                this.setStatus('Bulk download temporarily disabled. Open a file preview for single download.');
                this.downloadSingleBtn.disabled = true;
                this.downloadAllBtn.disabled = true;
            } else if (response && response.type === 'folder_disabled') {
                this.setStatus('Bulk download temporarily disabled. Open a file preview for single download.');
                this.downloadSingleBtn.disabled = true;
                this.downloadAllBtn.disabled = true;
            } else if (response && response.type === 'unsupported') {
                this.setStatus('Direct file view not supported. Open file from folder.', 'error');
                this.downloadSingleBtn.disabled = true;
                this.downloadAllBtn.disabled = true;
            } else {
                this.setStatus('Navigate to a Google Drive folder or open file preview');
                this.downloadSingleBtn.disabled = true;
                this.downloadAllBtn.disabled = true;
            }
        } catch (error) {
            this.setStatus('Error checking page', 'error');
            this.addLog('Error: ' + error.message, 'error');
        }
    }
    
    async downloadSingle() {
        try {
            this.setStatus('Downloading file...', 'working');
            this.downloadSingleBtn.disabled = true;
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, { action: 'downloadSingle' });
            
        } catch (error) {
            this.setStatus('Error downloading file', 'error');
            this.addLog('Error: ' + error.message, 'error');
            this.downloadSingleBtn.disabled = false;
        }
    }
    
    async downloadAll() {
        try {
            this.setStatus('Starting bulk download...', 'working');
            this.downloadAllBtn.disabled = true;
            this.showProgress();
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, { action: 'downloadAll' });
            
        } catch (error) {
            this.setStatus('Error starting download', 'error');
            this.addLog('Error: ' + error.message, 'error');
            this.downloadAllBtn.disabled = false;
            this.hideProgress();
        }
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'status':
                this.setStatus(message.text, message.statusType);
                break;
            case 'log':
                this.addLog(message.text, message.logType);
                break;
            case 'progress':
                this.updateProgress(message.current, message.total);
                break;
            case 'downloadComplete':
                this.setStatus('Download completed');
                this.downloadSingleBtn.disabled = false;
                this.downloadAllBtn.disabled = false;
                this.hideProgress();
                break;
            case 'downloadError':
                this.setStatus('Download failed', 'error');
                this.downloadSingleBtn.disabled = false;
                this.downloadAllBtn.disabled = false;
                this.hideProgress();
                break;
        }
    }
    
    setStatus(text, type = 'success') {
        this.status.textContent = text;
        this.status.className = 'status ' + type;
    }
    
    addLog(text, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `${new Date().toLocaleTimeString()}: ${text}`;
        this.log.appendChild(entry);
        this.log.scrollTop = this.log.scrollHeight;
    }
    
    showProgress() {
        this.progressContainer.style.display = 'block';
    }
    
    hideProgress() {
        this.progressContainer.style.display = 'none';
    }
    
    updateProgress(current, total) {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        this.progressFill.style.width = percentage + '%';
        this.progressText.textContent = `${current}/${total} files`;
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});
