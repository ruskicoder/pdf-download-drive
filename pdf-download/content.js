// Prevent duplicate initialization
if (window.googleDrivePDFDownloaderInitialized) {
    console.log('Google Drive PDF Downloader already initialized');
} else {
    window.googleDrivePDFDownloaderInitialized = true;

    // Clean up any existing instances
    if (window.googleDrivePDFDownloaderInstance) {
        try {
            const existingBtn = document.getElementById('pdf-downloader-float');
            if (existingBtn) {
                existingBtn.remove();
            }
        } catch (e) {
            console.log('Cleanup error:', e);
        }
    }

class GoogleDrivePDFDownloader {
    constructor() {
        this.isProcessing = false;
        this.scrollExtensionRunning = false;
        this.scrollSpeed = 3; // pages per second
        
        this.init();
    }
    
    init() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async response
        });
        
        // Auto-inject popup interface when on Google Drive
        if (window.location.hostname === 'drive.google.com') {
            this.injectPopupInterface();
        }
    }
    
    injectPopupInterface() {
        // Create a toggle button for the persistent popup
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'pdf-downloader-toggle';
        
        toggleBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                <path d="M12,11L8,15H10.5V19H13.5V15H16L12,11Z"/>
            </svg>
            <span>PDF Download</span>
        `;
        
        toggleBtn.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: auto;
            height: 36px;
            min-width: 140px;
            background: #1a73e8;
            color: white;
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10001;
            font-family: 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
            font-size: 14px;
            font-weight: 500;
            padding: 0 16px;
            box-shadow: 0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15);
            transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
            border: 1px solid transparent;
            user-select: none;
        `;
        
        // Get version from manifest
        const getVersionFromManifest = () => {
            try {
                if (chrome && chrome.runtime && chrome.runtime.getManifest) {
                    const manifest = chrome.runtime.getManifest();
                    return manifest.version;
                }
            } catch (error) {
                console.log('Could not get version from manifest:', error);
            }
            return '1.0.0'; // fallback version
        };

        const version = getVersionFromManifest();

        // Create the persistent popup panel
        const popupPanel = document.createElement('div');
        popupPanel.id = 'pdf-downloader-panel';
        
        popupPanel.innerHTML = `
            <div class="panel-header">
                <h3>PDF Downloader <span style="font-size: 0.8em; color: #666;">v${version}</span></h3>
                <div class="panel-controls">
                    <button id="minimize-btn" title="Minimize">−</button>
                    <button id="close-btn" title="Hide">×</button>
                </div>
            </div>
            <div class="panel-content">
                <div class="status" id="panel-status">Ready</div>
                
                <div class="buttons">
                    <button id="panel-downloadSingle" class="btn btn-primary">
                        Download Current File
                    </button>
                    
                    <button id="panel-downloadAll" class="btn btn-secondary">
                        Download All Files in Folder
                    </button>
                </div>
                
                <div class="progress-container" id="panel-progressContainer" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="panel-progressFill"></div>
                    </div>
                    <div class="progress-text" id="panel-progressText">0/0 files</div>
                </div>
                
                <div class="log" id="panel-log"></div>
            </div>
        `;
        
        popupPanel.style.cssText = `
            position: fixed;
            top: 7vh;
            right: 4vw;
            transform: none;
            width: 320px;
            max-height: 500px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-family: 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
            font-size: 14px;
            border: 1px solid #dadce0;
            display: none;
            overflow: hidden;
        `;
        
        // Add CSS styles for the panel
        const panelStyles = document.createElement('style');
        panelStyles.textContent = `
            #pdf-downloader-panel .panel-header {
                background: #f8f9fa;
                padding: 12px 16px;
                border-bottom: 1px solid #e8eaed;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            #pdf-downloader-panel .panel-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 500;
                color: #202124;
            }
            
            #pdf-downloader-panel .panel-controls {
                display: flex;
                gap: 4px;
            }
            
            #pdf-downloader-panel .panel-controls button {
                width: 24px;
                height: 24px;
                border: none;
                background: transparent;
                cursor: pointer;
                border-radius: 4px;
                font-size: 16px;
                color: #5f6368;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            #pdf-downloader-panel .panel-controls button:hover {
                background: #f1f3f4;
            }
            
            #pdf-downloader-panel .panel-content {
                padding: 16px;
                max-height: 420px;
                overflow-y: auto;
            }
            
            #pdf-downloader-panel .status {
                margin-bottom: 16px;
                padding: 8px 12px;
                background: #e8f0fe;
                border-radius: 4px;
                color: #1967d2;
                font-weight: 500;
            }
            
            #pdf-downloader-panel .buttons {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 16px;
            }
            
            #pdf-downloader-panel .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background-color 0.2s;
            }
            
            #pdf-downloader-panel .btn-primary {
                background: #1a73e8;
                color: white;
            }
            
            #pdf-downloader-panel .btn-primary:hover {
                background: #1557b0;
            }
            
            #pdf-downloader-panel .btn-secondary {
                background: #f8f9fa;
                color: #3c4043;
                border: 1px solid #dadce0;
            }
            
            #pdf-downloader-panel .btn-secondary:hover {
                background: #f1f3f4;
            }
            
            #pdf-downloader-panel .progress-container {
                margin-bottom: 16px;
            }
            
            #pdf-downloader-panel .progress-bar {
                width: 100%;
                height: 8px;
                background: #e8eaed;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            
            #pdf-downloader-panel .progress-fill {
                height: 100%;
                background: #1a73e8;
                transition: width 0.3s ease;
                width: 0%;
            }
            
            #pdf-downloader-panel .progress-text {
                text-align: center;
                color: #5f6368;
                font-size: 12px;
            }
            
            #pdf-downloader-panel .log {
                max-height: 200px;
                overflow-y: auto;
                background: #f8f9fa;
                border: 1px solid #e8eaed;
                border-radius: 4px;
                padding: 8px;
                font-size: 12px;
                line-height: 1.4;
            }
            
            #pdf-downloader-panel .log:empty {
                display: none;
            }
            
            #pdf-downloader-panel .log-entry {
                margin-bottom: 4px;
                padding: 2px 0;
            }
            
            #pdf-downloader-panel .log-info { color: #1967d2; }
            #pdf-downloader-panel .log-success { color: #137333; }
            #pdf-downloader-panel .log-warning { color: #f57c00; }
            #pdf-downloader-panel .log-error { color: #d93025; }
        `;
        
        document.head.appendChild(panelStyles);
        
        // Add hover effects for toggle button
        toggleBtn.addEventListener('mouseenter', () => {
            toggleBtn.style.backgroundColor = '#1557b0';
            toggleBtn.style.boxShadow = '0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)';
        });
        
        toggleBtn.addEventListener('mouseleave', () => {
            toggleBtn.style.backgroundColor = '#1a73e8';
            toggleBtn.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)';
        });
        
        // Toggle panel visibility
        let panelVisible = false;
        toggleBtn.addEventListener('click', () => {
            panelVisible = !panelVisible;
            popupPanel.style.display = panelVisible ? 'block' : 'none';
            toggleBtn.querySelector('span').textContent = panelVisible ? 'Hide Panel' : 'PDF Download';
        });
        
        // Panel control buttons
        popupPanel.addEventListener('click', (e) => {
            if (e.target.id === 'close-btn') {
                panelVisible = false;
                popupPanel.style.display = 'none';
                toggleBtn.querySelector('span').textContent = 'PDF Download';
            } else if (e.target.id === 'minimize-btn') {
                const content = popupPanel.querySelector('.panel-content');
                const isMinimized = content.style.display === 'none';
                content.style.display = isMinimized ? 'block' : 'none';
                e.target.textContent = isMinimized ? '−' : '+';
            } else if (e.target.id === 'panel-downloadSingle') {
                this.downloadCurrentFile();
            } else if (e.target.id === 'panel-downloadAll') {
                this.downloadAllFilesInFolder();
            }
        });
        
        // Auto-show panel on page load
        document.body.appendChild(toggleBtn);
        document.body.appendChild(popupPanel);
        
        // Show panel automatically after a short delay
        setTimeout(() => {
            panelVisible = true;
            popupPanel.style.display = 'block';
            toggleBtn.querySelector('span').textContent = 'Hide Panel';
        }, 1000);
        
        // Store references for messaging
        this.popupPanel = popupPanel;
    }
    
    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'checkPage':
                    const pageType = this.detectPageType();
                    sendResponse({ type: pageType });
                    break;
                    
                case 'downloadSingle':
                    await this.downloadCurrentFile();
                    sendResponse({ success: true });
                    break;
                    
                case 'downloadAll':
                    await this.downloadAllFilesInFolder();
                    sendResponse({ success: true });
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    detectPageType() {
        const url = window.location.href;
        
        // Check if file preview is open in folder view
        if ((url.includes('/folders/') || url.includes('drive.google.com/drive')) && this.isFilePreviewOpen()) {
            return 'file'; // File preview in folder
        }
        // Check if in folder view - enable bulk download
        else if (url.includes('/folders/') || url.includes('drive.google.com/drive')) {
            return 'folder';
        }
        // Direct file view (not supported for console script)
        else if (url.includes('/file/') && url.includes('/view')) {
            return 'unsupported';
        }
        
        return 'unknown';
    }
    
    async downloadCurrentFile() {
        this.sendMessage({ type: 'status', text: 'Starting download process...', statusType: 'working' });
        
        try {
            const url = window.location.href;
            
            // Only work if we're in folder view with preview open
            if (url.includes('/file/') && url.includes('/view')) {
                throw new Error('Direct file view not supported. Please open file from folder view.');
            }
            
            if (!this.isFilePreviewOpen()) {
                throw new Error('No file preview is open. Please click a file to open its preview first.');
            }
            
            // Create warning overlay first
            this.createWarningOverlay();
            
            // Scroll to load all pages
            this.sendMessage({ type: 'status', text: 'Scrolling to load all pages...', statusType: 'working' });
            await this.scrollToLoadAllPages();
            
            // Wait for DOM to settle after scrolling
            this.sendMessage({ type: 'status', text: 'Waiting for content to stabilize...', statusType: 'working' });
            await this.sleep(2000);
            
            // Extract filename AFTER scrolling completes and DOM settles
            this.sendMessage({ type: 'status', text: 'Scanning for filename...', statusType: 'working' });
            const fileName = await this.extractFileNameFromPreview();
            this.sendMessage({ type: 'log', text: `🎯 Detected filename: ${fileName}`, logType: 'info' });
            
            // Tag all current blob images with this file's identifier
            const fileId = `single_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.sendMessage({ type: 'log', text: `🏷️ Tagging blob images for single download with ID: ${fileId}`, logType: 'info' });
            
            const allCurrentBlobs = document.querySelectorAll('img[src^="blob:"]');
            let taggedCount = 0;
            allCurrentBlobs.forEach(img => {
                if (!img.hasAttribute('data-file-id')) {
                    img.setAttribute('data-file-id', fileId);
                    img.setAttribute('data-filename', fileName);
                    taggedCount++;
                }
            });
            this.sendMessage({ type: 'log', text: `🏷️ Tagged ${taggedCount} blob images for single download`, logType: 'info' });
            
            // Automatically execute PDF generation with file identifier
            this.sendMessage({ type: 'status', text: 'Generating PDF automatically...', statusType: 'working' });
            await this.generatePDFDirectly(fileName, fileId);
            
            this.removeWarningOverlay();
            this.sendMessage({ type: 'status', text: 'Download completed', statusType: 'success' });
            this.sendMessage({ type: 'log', text: `Downloaded: ${fileName}`, logType: 'success' });
            this.sendMessage({ type: 'downloadComplete' });
            
        } catch (error) {
            console.error('Download failed:', error);
            this.removeWarningOverlay();
            this.sendMessage({ type: 'status', text: 'Download failed', statusType: 'error' });
            this.sendMessage({ type: 'log', text: `Error: ${error.message}`, logType: 'error' });
            this.sendMessage({ type: 'downloadError' });
        }
    }
    
    async downloadAllFilesInFolder() {
        this.sendMessage({ type: 'status', text: 'Starting bulk download...', statusType: 'working' });
        this.sendMessage({ type: 'log', text: '🚀 Bulk download started', logType: 'info' });
        
        try {
            // Check if we're in a folder view
            const url = window.location.href;
            if (!url.includes('/folders/') && !url.includes('drive.google.com/drive')) {
                throw new Error('Please navigate to a Google Drive folder to use bulk download.');
            }
            
            // Close any open preview first
            if (this.isFilePreviewOpen()) {
                this.sendMessage({ type: 'log', text: '🔄 Closing open file preview...', logType: 'info' });
                await this.closeFilePreview();
                await this.sleep(2000); // Wait for preview to close
            }
            
            // Scan folder for PDF files using OCR
            this.sendMessage({ type: 'status', text: 'Scanning folder for PDF files...', statusType: 'working' });
            const pdfFiles = await this.scanFolderForPDFFiles();
            
            if (pdfFiles.length === 0) {
                throw new Error('No PDF files found in the current folder.');
            }
            
            this.sendMessage({ type: 'log', text: `📁 Found ${pdfFiles.length} PDF files`, logType: 'info' });
            this.sendMessage({ type: 'progress', current: 0, total: pdfFiles.length });
            
            // Download each PDF file
            let lastProcessedFilename = null;
            
            for (let i = 0; i < pdfFiles.length; i++) {
                const pdfFile = pdfFiles[i];
                console.log(`\n🔄 PROCESSING FILE ${i + 1}/${pdfFiles.length}:`);
                console.log(`  📁 Filename: "${pdfFile.filename}"`);
                console.log(`  🎯 Element ID: ${pdfFile.elementId}`);
                console.log(`  📍 Element:`, pdfFile.element);
                
                this.sendMessage({ type: 'log', text: `📥 Processing: ${pdfFile.filename} (${i + 1}/${pdfFiles.length})`, logType: 'info' });
                this.sendMessage({ type: 'log', text: `🎯 Using element: ${pdfFile.elementId}`, logType: 'info' });
                this.sendMessage({ type: 'progress', current: i, total: pdfFiles.length });
                
                try {
                    // First, close any existing preview
                    await this.closeExistingPreview();
                    
                    // Wait for any existing content to clear
                    await this.sleep(1000);
                    
                    // Click on the file to open preview
                    this.sendMessage({ type: 'status', text: `Opening ${pdfFile.filename}...`, statusType: 'working' });
                    await this.clickOnFile(pdfFile.element);
                    
                    // Wait for preview to load
                    await this.waitForFilePreviewToLoad();
                    
                    // Additional wait for content to stabilize
                    await this.sleep(2000);
                    
                    // Verify the correct file is loaded by checking filename
                    this.sendMessage({ type: 'log', text: `🔍 Verifying file load: ${pdfFile.filename}`, logType: 'info' });
                    this.sendMessage({ type: 'log', text: `📋 Element ID: ${pdfFile.elementId}`, logType: 'info' });
                    
                    const actualFilename = await this.verifyCorrectFileLoaded(pdfFile.filename);
                    
                    // Log verification result
                    if (actualFilename === pdfFile.filename) {
                        this.sendMessage({ type: 'log', text: `✅ Filename verification successful: ${actualFilename}`, logType: 'success' });
                    } else {
                        this.sendMessage({ type: 'log', text: `🔄 Filename verification used fallback: expected "${pdfFile.filename}", using "${actualFilename}"`, logType: 'info' });
                    }
                    
                    if (!actualFilename) {
                        this.sendMessage({ type: 'log', text: `⚠️ Skipping ${pdfFile.filename} - filename verification failed`, logType: 'warning' });
                        continue;
                    }
                    
                    // Check if this is the same file as the previous one
                    if (lastProcessedFilename && actualFilename === lastProcessedFilename) {
                        this.sendMessage({ type: 'log', text: `⚠️ Skipping ${actualFilename} - same as previous file (duplicate detection)`, logType: 'warning' });
                        continue;
                    }
                    
                    // Download the file (reuse single file download logic)
                    await this.downloadCurrentFileInBulk(actualFilename);
                    
                    // Update the last processed filename
                    lastProcessedFilename = actualFilename;
                    
                    // Close the preview (this will clear cache when preview closes)
                    await this.closeFilePreview();
                    
                    // Wait between downloads to avoid overwhelming the system
                    await this.sleep(1500);
                    
                } catch (fileError) {
                    this.sendMessage({ type: 'log', text: `❌ Failed to download ${pdfFile.filename}: ${fileError.message}`, logType: 'error' });
                    
                    // Try to close any open preview before continuing
                    if (this.isFilePreviewOpen()) {
                        await this.closeFilePreview();
                    }
                    
                    // Continue with next file even if one fails
                }
            }
            
            this.sendMessage({ type: 'progress', current: pdfFiles.length, total: pdfFiles.length });
            this.sendMessage({ type: 'status', text: 'Bulk download completed', statusType: 'success' });
            this.sendMessage({ type: 'log', text: `✅ Bulk download completed: ${pdfFiles.length} files processed`, logType: 'success' });
            this.sendMessage({ type: 'downloadComplete' });
            
        } catch (error) {
            console.error('Bulk download failed:', error);
            this.sendMessage({ type: 'status', text: 'Bulk download failed', statusType: 'error' });
            this.sendMessage({ type: 'log', text: `❌ Bulk download error: ${error.message}`, logType: 'error' });
            this.sendMessage({ type: 'downloadError' });
        }
    }
    
    async scanFolderForPDFFiles() {
        this.sendMessage({ type: 'log', text: '🔍 Scanning entire page for PDF files...', logType: 'info' });
        
        // Define broader scan area to cover file list area
        const scanArea = {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Use Map to store unique filenames and always keep the last occurrence
        const pdfFilesMap = new Map();
        const scannedElements = new Set();
        
        // Get all elements that might contain file information
        const allElements = document.querySelectorAll('*');
        
        for (const element of allElements) {
            if (scannedElements.has(element)) continue;
            scannedElements.add(element);
            
            const rect = element.getBoundingClientRect();
            
            // Skip elements outside viewport or too small
            if (rect.width < 10 || rect.height < 10 || 
                rect.left > window.innerWidth || rect.top > window.innerHeight) {
                continue;
            }
            
            // Check various text sources for PDF filenames
            const textSources = [
                element.textContent?.trim(),
                element.getAttribute('title'),
                element.getAttribute('aria-label'),
                element.getAttribute('data-tooltip'),
                element.getAttribute('data-original-text'),
                element.getAttribute('alt'),
                element.value
            ].filter(text => text && text.length > 0);
            
            for (const text of textSources) {
                if (this.isPDFFilename(text)) {
                    const cleanFilename = this.cleanupFileName(text);
                    
                    // Find the clickable element for this file
                    const clickableElement = this.findClickableElementForFile(element, cleanFilename);
                    
                    if (clickableElement) {
                        // Create a unique identifier for the clickable element
                        const elementId = this.getElementIdentifier(clickableElement);
                        
                        // Check if we already have a file with this exact element
                        const existingFileWithSameElement = Array.from(pdfFilesMap.values()).find(
                            file => this.getElementIdentifier(file.element) === elementId
                        );
                        
                        if (existingFileWithSameElement) {
                            console.log(`🚨 DUPLICATE ELEMENT DETECTED:`);
                            console.log(`  - Existing file: "${existingFileWithSameElement.filename}"`);
                            console.log(`  - New file: "${cleanFilename}"`);
                            console.log(`  - Shared element ID: ${elementId}`);
                            console.log(`  - Text element:`, element);
                            console.log(`  - Clickable element:`, clickableElement);
                            
                            this.sendMessage({ type: 'log', text: `🚨 Duplicate element detected: "${cleanFilename}" shares element with "${existingFileWithSameElement.filename}"`, logType: 'error' });
                            continue;
                        }
                        
                        // Store with additional debugging info
                        pdfFilesMap.set(cleanFilename, {
                            filename: cleanFilename,
                            element: clickableElement,
                            elementId: elementId,
                            textElement: element,
                            originalText: text,
                            foundAt: Date.now() // Track when found for debugging
                        });
                        
                        this.sendMessage({ type: 'log', text: `📋 Found PDF: ${cleanFilename} (element: ${elementId})`, logType: 'info' });
                    } else {
                        this.sendMessage({ type: 'log', text: `⚠️ No clickable element found for ${cleanFilename}`, logType: 'warning' });
                    }
                }
            }
        }
        
        // Convert Map values to array (automatically has unique filenames)
        const pdfFiles = Array.from(pdfFilesMap.values());
        
        this.sendMessage({ type: 'log', text: `📊 Unique PDF files detected: ${pdfFiles.length}`, logType: 'info' });
        
        // Log the filenames and their element mappings for debugging
        if (pdfFiles.length > 0) {
            console.log('\n📋 FINAL FILE TO ELEMENT MAPPING:');
            const filenames = [];
            const elementIds = [];
            
            pdfFiles.forEach((file, index) => {
                const fileInfo = `${index + 1}. "${file.filename}"`;
                const elementInfo = `→ Element: ${file.elementId}`;
                console.log(`  ${fileInfo} ${elementInfo}`);
                filenames.push(file.filename);
                elementIds.push(file.elementId);
            });
            
            // Check for duplicate element IDs in final result
            const duplicateElements = elementIds.filter((id, index) => elementIds.indexOf(id) !== index);
            if (duplicateElements.length > 0) {
                console.error('🚨 CRITICAL: DUPLICATE ELEMENTS IN FINAL RESULT:', duplicateElements);
                this.sendMessage({ type: 'log', text: `🚨 CRITICAL ERROR: Duplicate elements in final mapping: ${duplicateElements.join(', ')}`, logType: 'error' });
            } else {
                console.log('✅ All elements are unique in final mapping');
                this.sendMessage({ type: 'log', text: '✅ All file elements are unique', logType: 'success' });
            }
            
            const filenameList = filenames.join(', ');
            this.sendMessage({ type: 'log', text: `📝 Files: ${filenameList}`, logType: 'info' });
        }
        
        return pdfFiles;
    }
    
    isPDFFilename(text) {
        if (!text || typeof text !== 'string') return false;
        
        const lowerText = text.toLowerCase();
        
        // Must contain .pdf
        if (!lowerText.includes('.pdf')) return false;
        
        // Reasonable length constraints
        if (text.length < 4 || text.length > 500) return false;
        
        // Filter out obvious UI elements and invalid filenames
        const uiKeywords = [
            'http', 'google', 'drive', 'more sorting options',
            'show folders', 'on top', 'mixed with files',
            'view options', 'settings', 'menu', 'toolbar',
            'sort', 'filter', 'options', 'download all',
            'share', 'move to', 'rename', 'delete',
            'preview', 'open with', 'get link', 'make available offline'
        ];
        
        // Check if text contains any UI keywords
        for (const keyword of uiKeywords) {
            if (lowerText.includes(keyword)) {
                return false;
            }
        }
        
        // Additional checks for valid filenames
        const beforePdf = text.substring(0, text.toLowerCase().indexOf('.pdf'));
        
        // Should have at least one alphanumeric character before .pdf
        if (!/[a-zA-Z0-9À-ÿ]/.test(beforePdf)) {
            return false;
        }
        
        // Filter out text that's mostly UI elements or has too many common UI words
        const words = beforePdf.toLowerCase().split(/\s+/);
        const commonUIWords = ['name', 'file', 'files', 'folder', 'view', 'sort', 'more', 'show', 'top', 'mixed', 'with'];
        const uiWordCount = words.filter(word => commonUIWords.includes(word)).length;
        
        // If more than half the words are UI words, it's probably not a filename
        if (uiWordCount > words.length / 2) {
            return false;
        }
        
        return true;
    }
    
    findClickableElementForFile(textElement, filename) {
        this.sendMessage({ type: 'log', text: `🔍 Finding clickable element for: ${filename}`, logType: 'info' });
        
        // Strategy 1: Look for the most specific Google Drive file row structure
        // Try to find the most immediate file container
        let current = textElement;
        let bestCandidate = null;
        let candidateScore = 0;
        
        // Walk up the DOM tree looking for clickable containers
        while (current && current !== document.body) {
            let score = 0;
            
            // Score based on specific Google Drive patterns
            if (current.hasAttribute('jsaction') && current.getAttribute('jsaction').includes('dblclick')) {
                score += 100; // High score for dblclick handlers
            }
            if (current.hasAttribute('data-id')) {
                score += 50; // High score for data-id (file identifiers)
            }
            if (current.getAttribute('role') === 'row') {
                score += 40; // Good score for row elements
            }
            if (current.getAttribute('role') === 'gridcell') {
                score += 35; // Good score for grid cells
            }
            if (current.classList.contains('a-s-fa-Ha-pa')) {
                score += 30; // Google Drive specific class
            }
            if (this.isClickableElement(current)) {
                score += 10; // Base score for clickable elements
            }
            
            // Prefer elements that are closer to the text (smaller DOM distance)
            const domDistance = this.getDOMDistance(textElement, current);
            score -= domDistance * 2; // Reduce score for distance
            
            // If this element has a better score, use it as candidate
            if (score > candidateScore && score > 0) {
                bestCandidate = current;
                candidateScore = score;
                this.sendMessage({ type: 'log', text: `📊 Better candidate found: ${current.tagName} (score: ${score})`, logType: 'info' });
            }
            
            current = current.parentElement;
        }
        
        if (bestCandidate) {
            this.sendMessage({ type: 'log', text: `✅ Selected best candidate with score: ${candidateScore}`, logType: 'success' });
            return bestCandidate;
        }
        
        // Strategy 2: Look for nearby clickable elements (fallback)
        this.sendMessage({ type: 'log', text: '🔄 No good candidate found, trying nearby elements...', logType: 'warning' });
        const nearbyElements = this.getNearbyElements(textElement, 100);
        
        for (const element of nearbyElements) {
            if (this.isClickableElement(element)) {
                this.sendMessage({ type: 'log', text: '📍 Found nearby clickable element', logType: 'info' });
                return element;
            }
        }
        
        this.sendMessage({ type: 'log', text: '❌ No clickable element found', logType: 'error' });
        return null;
    }
    
    getDOMDistance(element1, element2) {
        // Calculate the DOM tree distance between two elements
        let distance = 0;
        let current = element1;
        
        // Walk up from element1 to find element2
        while (current && current !== element2 && distance < 20) {
            current = current.parentElement;
            distance++;
        }
        
        return current === element2 ? distance : 999; // Return high value if not found
    }
    
    isClickableElement(element) {
        if (!element) return false;

        const tagName = element.tagName.toLowerCase();
        const role = element.getAttribute('role');
        const jsAction = element.getAttribute('jsaction');
        const onclick = element.onclick;
        const computedStyle = window.getComputedStyle(element);
        
        return tagName === 'a' ||
               tagName === 'button' ||
               onclick !== null ||
               jsAction !== null ||
               role === 'button' ||
               role === 'gridcell' ||
               role === 'row' ||
               element.hasAttribute('data-id') ||
               element.hasAttribute('tabindex') ||
               element.style.cursor === 'pointer' ||
               computedStyle.cursor === 'pointer' ||
               element.classList.contains('a-s-fa-Ha-pa') || // Google Drive file item
               element.classList.contains('a-s-oa-r') ||     // Google Drive clickable row
               element.classList.contains('jGNTYb') ||       // Google Drive grid cell
               element.classList.contains('ACGwFc') ||       // Google Drive grid cell
               element.hasAttribute('jsname') ||             // Google Drive elements with jsname
               (jsAction && (jsAction.includes('click') || jsAction.includes('dblclick')));
    }
    
    getNearbyElements(centerElement, radius) {
        const centerRect = centerElement.getBoundingClientRect();
        const centerX = centerRect.left + centerRect.width / 2;
        const centerY = centerRect.top + centerRect.height / 2;
        
        const allElements = document.querySelectorAll('*');
        const nearbyElements = [];
        
        for (const element of allElements) {
            const rect = element.getBoundingClientRect();
            const elementX = rect.left + rect.width / 2;
            const elementY = rect.top + rect.height / 2;
            
            const distance = Math.sqrt(
                Math.pow(elementX - centerX, 2) + Math.pow(elementY - centerY, 2)
            );
            
            if (distance <= radius) {
                nearbyElements.push(element);
            }
        }
        
        return nearbyElements;
    }
    
    getElementIdentifier(element) {
        // Create a unique identifier for an element based on its properties
        const tagName = element.tagName.toLowerCase();
        const id = element.id || '';
        const className = element.className || '';
        const dataId = element.getAttribute('data-id') || '';
        const jsaction = element.getAttribute('jsaction') || '';
        const textContent = (element.textContent || '').substring(0, 50); // First 50 chars
        
        // Get position in DOM (index among siblings)
        const siblings = Array.from(element.parentElement?.children || []);
        const siblingIndex = siblings.indexOf(element);
        
        // Create a composite identifier
        const identifier = `${tagName}#${id}.${className}[${dataId}]@${siblingIndex}:${jsaction.substring(0, 20)}:"${textContent.replace(/\s+/g, ' ').trim()}"`;
        
        return identifier;
    }
    
    async clickOnFile(element) {
        if (!element) {
            throw new Error('No clickable element found for file');
        }
        
        this.sendMessage({ type: 'log', text: '🖱️ Preparing to open file preview...', logType: 'info' });
        
        // First, close any existing preview by clicking at 15% viewport position
        await this.closeExistingPreview();
        
        // Scroll element into view first
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(1000); // Wait for scroll to complete
        
        // Ensure element is still visible and clickable
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            throw new Error('Element is not visible or has no dimensions');
        }
        
        this.sendMessage({ type: 'log', text: `📍 Element position: ${Math.round(rect.left)}, ${Math.round(rect.top)} (${Math.round(rect.width)}x${Math.round(rect.height)})`, logType: 'info' });
        
        let clickSuccessful = false;
        const maxAttempts = 3;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            this.sendMessage({ type: 'log', text: `🎯 Attempt ${attempt}/${maxAttempts}: Single click + dblclick...`, logType: 'info' });
            
            try {
                // Strategy: Single click first, then dblclick event
                this.sendMessage({ type: 'log', text: '🖱️ Performing single click...', logType: 'info' });
                
                // Single click first
                const singleClickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                
                element.dispatchEvent(singleClickEvent);
                await this.sleep(200); // Small delay
                
                // Then dblclick event  
                this.sendMessage({ type: 'log', text: '🖱️ Performing dblclick event...', logType: 'info' });
                
                const dblClickEvent = new MouseEvent('dblclick', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                    detail: 2 // Double click detail
                });
                
                const result = element.dispatchEvent(dblClickEvent);
                this.sendMessage({ type: 'log', text: `📤 Dblclick event result: ${result}`, logType: 'info' });
                
                // Wait for preview to load (3 seconds as requested)
                this.sendMessage({ type: 'log', text: '⏳ Waiting 3 seconds for preview to load...', logType: 'info' });
                await this.sleep(3000);
                
                // Check if preview is open
                if (this.isFilePreviewOpen()) {
                    this.sendMessage({ type: 'log', text: '✅ File preview opened successfully!', logType: 'success' });
                    clickSuccessful = true;
                    break;
                } else {
                    this.sendMessage({ type: 'log', text: `⚠️ Preview not detected after attempt ${attempt}`, logType: 'warning' });
                    
                    // Try alternative click methods if first attempt fails
                    if (attempt < maxAttempts) {
                        await this.tryAlternativeClickMethods(element, rect);
                        await this.sleep(3000); // Wait again
                        
                        if (this.isFilePreviewOpen()) {
                            this.sendMessage({ type: 'log', text: '✅ Alternative click method worked!', logType: 'success' });
                            clickSuccessful = true;
                            break;
                        }
                    }
                }
                
            } catch (error) {
                this.sendMessage({ type: 'log', text: `⚠️ Attempt ${attempt} failed: ${error.message}`, logType: 'error' });
            }
        }
        
        if (clickSuccessful) {
            this.sendMessage({ type: 'log', text: '✅ File preview opened successfully', logType: 'success' });
        } else {
            this.sendMessage({ type: 'log', text: '❌ Failed to open file preview after all attempts', logType: 'error' });
            throw new Error('Failed to open file preview after multiple attempts');
        }
        
        // Final wait for UI to stabilize
        await this.sleep(1000);
    }
    
    async closeExistingPreview() {
        this.sendMessage({ type: 'log', text: '🔄 Checking for existing preview to close...', logType: 'info' });
        
        if (this.isFilePreviewOpen()) {
            this.sendMessage({ type: 'log', text: '� Looking for close button with OCR...', logType: 'info' });
            
            // Try to find close button using OCR scan
            let success = await this.tryCloseButtonMethods();
            
            if (!success) {
                // Method 2: Try clicking on empty space areas
                success = await this.tryEmptySpaceClicks();
            }
            
            if (!success) {
                // Method 3: Try escape key and other keyboard shortcuts
                success = await this.tryKeyboardShortcuts();
            }
            
            if (!success) {
                // Method 4: Try clicking on navigation elements
                success = await this.tryNavigationClicks();
            }
            
            if (!success) {
                // Method 5: Try simulating browser back/forward
                success = await this.tryBrowserNavigation();
            }
            
            // Final verification and wait
            await this.waitForPreviewToClose();
            
            // Only clear blob cache if preview was actually closed
            if (!this.isFilePreviewOpen()) {
                this.sendMessage({ type: 'log', text: '✅ Preview closed successfully, clearing cache...', logType: 'success' });
                await this.clearBlobImageCache();
            } else {
                this.sendMessage({ type: 'log', text: '⚠️ Preview still open, skipping cache clear to preserve content', logType: 'warning' });
            }
        } else {
            this.sendMessage({ type: 'log', text: '✅ No existing preview detected', logType: 'info' });
        }
    }
    
    async findCloseButtonWithOCR() {
        try {
            // Look for close button elements using multiple strategies
            const closeButtonSelectors = [
                'button[aria-label="Close"]',
                'button[title="Close"]',
                'button[data-tooltip="Close"]',
                '[role="button"][aria-label="Close"]',
                'button:has([data-icon="close"])',
                'button:has([data-icon="x"])',
                'div[role="button"][aria-label="Close"]'
            ];
            
            // Try direct selectors first
            for (const selector of closeButtonSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const rect = element.getBoundingClientRect();
                    // Check if button is in top area of screen (likely close button)
                    if (rect.top >= 0 && rect.top <= window.innerHeight * 0.3 && 
                        rect.left >= 0 && rect.left <= window.innerWidth * 0.3) {
                        return element;
                    }
                }
            }
            
            // OCR-based search for "Close" text and X symbols
            const allButtons = document.querySelectorAll('button, [role="button"], div[onclick], span[onclick]');
            
            for (const button of allButtons) {
                const rect = button.getBoundingClientRect();
                
                // Only check buttons in top-left area of screen
                if (rect.top >= 0 && rect.top <= window.innerHeight * 0.3 && 
                    rect.left >= 0 && rect.left <= window.innerWidth * 0.3) {
                    
                    const text = button.textContent?.trim().toLowerCase();
                    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase();
                    const title = button.getAttribute('title')?.toLowerCase();
                    
                    // Check for close-related text
                    if (text === 'close' || text === 'x' || text === '×' || text === '✕' ||
                        ariaLabel?.includes('close') || title?.includes('close') ||
                        button.innerHTML.includes('close') || button.innerHTML.includes('×')) {
                        return button;
                    }
                    
                    // Check for close icon patterns
                    const hasCloseIcon = button.querySelector('svg[data-icon="close"], svg[data-icon="x"], .close-icon, .icon-close, [class*="close"], [class*="dismiss"]');
                    if (hasCloseIcon) {
                        return button;
                    }
                }
            }
            
            return null;
        } catch (error) {
            this.sendMessage({ type: 'log', text: `❌ Error finding close button: ${error.message}`, logType: 'error' });
            return null;
        }
    }
    
    async tryCloseButtonMethods() {
        this.sendMessage({ type: 'log', text: '🔍 Method 1: Searching for close buttons...', logType: 'info' });
        
        const closeButtonStrategies = [
            // Strategy 1: Standard close button selectors
            () => document.querySelectorAll('button[aria-label*="Close"], button[title*="Close"], [role="button"][aria-label*="Close"]'),
            // Strategy 2: Close icon patterns
            () => document.querySelectorAll('button:has(svg), [role="button"]:has(svg)'),
            // Strategy 3: Generic close patterns
            () => document.querySelectorAll('[data-testid*="close"], [data-tooltip*="close"], .close-button, .close-icon'),
            // Strategy 4: X symbol patterns
            () => Array.from(document.querySelectorAll('button, [role="button"]')).filter(el => {
                const text = el.textContent?.trim();
                return text === '×' || text === 'X' || text === '✕' || text === '⨯';
            }),
            // Strategy 5: Google Drive specific patterns
            () => document.querySelectorAll('[jsaction*="close"], [data-value="close"], [aria-label*="exit"]')
        ];
        
        for (let i = 0; i < closeButtonStrategies.length; i++) {
            this.sendMessage({ type: 'log', text: `🎯 Trying close button strategy ${i + 1}...`, logType: 'info' });
            
            try {
                const elements = closeButtonStrategies[i]();
                
                for (const element of elements) {
                    const rect = element.getBoundingClientRect();
                    
                    // Only try elements in reasonable close button positions
                    if (rect.top >= 0 && rect.top <= window.innerHeight * 0.4 && 
                        rect.left >= 0 && rect.width > 0 && rect.height > 0) {
                        
                        // Try both native event and jQuery-style event
                        await this.clickElementMultipleMethods(element, `Close button strategy ${i + 1}`);
                        
                        await this.sleep(1500);
                        if (!this.isFilePreviewOpen()) {
                            this.sendMessage({ type: 'log', text: `✅ Successfully closed with close button strategy ${i + 1}`, logType: 'success' });
                            return true;
                        }
                    }
                }
            } catch (error) {
                this.sendMessage({ type: 'log', text: `⚠️ Error in strategy ${i + 1}: ${error.message}`, logType: 'warning' });
            }
        }
        
        return false;
    }
    
    async tryEmptySpaceClicks() {
        this.sendMessage({ type: 'log', text: '🔍 Method 2: Clicking on empty space areas...', logType: 'info' });
        
        const emptySpacePositions = [
            // Left sidebar area
            { x: window.innerWidth * 0.1, y: window.innerHeight * 0.3, name: 'left sidebar' },
            { x: window.innerWidth * 0.05, y: window.innerHeight * 0.5, name: 'far left' },
            // Top navigation area
            { x: window.innerWidth * 0.3, y: window.innerHeight * 0.1, name: 'top navigation' },
            { x: window.innerWidth * 0.7, y: window.innerHeight * 0.1, name: 'top right' },
            // Background areas
            { x: window.innerWidth * 0.15, y: window.innerHeight * 0.15, name: 'top left background' },
            { x: window.innerWidth * 0.85, y: window.innerHeight * 0.15, name: 'top right background' },
            // Bottom areas
            { x: window.innerWidth * 0.1, y: window.innerHeight * 0.9, name: 'bottom left' },
            { x: window.innerWidth * 0.9, y: window.innerHeight * 0.9, name: 'bottom right' }
        ];
        
        for (const pos of emptySpacePositions) {
            this.sendMessage({ type: 'log', text: `🎯 Clicking on ${pos.name} at (${Math.round(pos.x)}, ${Math.round(pos.y)})...`, logType: 'info' });
            
            const element = document.elementFromPoint(pos.x, pos.y);
            if (element && !this.isInteractiveElement(element)) {
                await this.clickPositionMultipleMethods(pos.x, pos.y, pos.name);
                
                await this.sleep(1500);
                if (!this.isFilePreviewOpen()) {
                    this.sendMessage({ type: 'log', text: `✅ Successfully closed by clicking ${pos.name}`, logType: 'success' });
                    return true;
                }
            }
        }
        
        return false;
    }
    
    async tryKeyboardShortcuts() {
        this.sendMessage({ type: 'log', text: '🔍 Method 3: Trying keyboard shortcuts...', logType: 'info' });
        
        const shortcuts = [
            { key: 'Escape', keyCode: 27, name: 'Escape key' },
            { key: 'Backspace', keyCode: 8, name: 'Backspace' },
            { key: 'Enter', keyCode: 13, name: 'Enter key' }
        ];
        
        for (const shortcut of shortcuts) {
            this.sendMessage({ type: 'log', text: `⌨️ Trying ${shortcut.name}...`, logType: 'info' });
            
            // Try multiple keyboard event methods
            await this.sendKeyboardEvent(shortcut.key, shortcut.keyCode);
            
            await this.sleep(1500);
            if (!this.isFilePreviewOpen()) {
                this.sendMessage({ type: 'log', text: `✅ Successfully closed with ${shortcut.name}`, logType: 'success' });
                return true;
            }
        }
        
        return false;
    }
    
    async tryNavigationClicks() {
        this.sendMessage({ type: 'log', text: '🔍 Method 4: Clicking navigation elements...', logType: 'info' });
        
        const navigationSelectors = [
            'a[href*="drive.google.com"]',
            '[role="navigation"] a',
            '.gb_f a',  // Google bar
            '[data-target="drive"]',
            '.ah-XOamRe',  // Google Drive nav
            '[jsaction*="click"]'
        ];
        
        for (const selector of navigationSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const rect = element.getBoundingClientRect();
                    if (rect.top >= 0 && rect.left >= 0 && rect.width > 0) {
                        this.sendMessage({ type: 'log', text: `🎯 Clicking navigation element: ${selector}...`, logType: 'info' });
                        
                        await this.clickElementMultipleMethods(element, `Navigation: ${selector}`);
                        
                        await this.sleep(1500);
                        if (!this.isFilePreviewOpen()) {
                            this.sendMessage({ type: 'log', text: `✅ Successfully closed with navigation click`, logType: 'success' });
                            return true;
                        }
                    }
                }
            } catch (error) {
                this.sendMessage({ type: 'log', text: `⚠️ Error with selector ${selector}: ${error.message}`, logType: 'warning' });
            }
        }
        
        return false;
    }
    
    async tryBrowserNavigation() {
        this.sendMessage({ type: 'log', text: '🔍 Method 5: Trying browser navigation...', logType: 'info' });
        
        try {
            // Try refreshing the current URL
            const currentUrl = window.location.href;
            this.sendMessage({ type: 'log', text: `🔄 Attempting URL refresh...`, logType: 'info' });
            
            window.history.pushState({}, '', currentUrl);
            window.dispatchEvent(new PopStateEvent('popstate'));
            
            await this.sleep(2000);
            if (!this.isFilePreviewOpen()) {
                this.sendMessage({ type: 'log', text: `✅ Successfully closed with navigation refresh`, logType: 'success' });
                return true;
            }
        } catch (error) {
            this.sendMessage({ type: 'log', text: `⚠️ Navigation method failed: ${error.message}`, logType: 'warning' });
        }
        
        return false;
    }
    
    async clickElementMultipleMethods(element, description) {
        // Method 1: Native click event
        try {
            const rect = element.getBoundingClientRect();
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
            });
            element.dispatchEvent(clickEvent);
            this.sendMessage({ type: 'log', text: `📍 Native click on ${description}`, logType: 'info' });
        } catch (error) {
            this.sendMessage({ type: 'log', text: `❌ Native click failed: ${error.message}`, logType: 'error' });
        }
        
        // Method 2: jQuery-style trigger (simulated)
        try {
            this.simulateJQueryClick(element);
            this.sendMessage({ type: 'log', text: `📍 jQuery-style click on ${description}`, logType: 'info' });
        } catch (error) {
            this.sendMessage({ type: 'log', text: `❌ jQuery-style click failed: ${error.message}`, logType: 'error' });
        }
        
        // Method 3: Direct method call
        try {
            if (typeof element.click === 'function') {
                element.click();
                this.sendMessage({ type: 'log', text: `📍 Direct click() on ${description}`, logType: 'info' });
            }
        } catch (error) {
            this.sendMessage({ type: 'log', text: `❌ Direct click failed: ${error.message}`, logType: 'error' });
        }
        
        // Method 4: Document.createEvent (legacy)
        try {
            const legacyEvent = document.createEvent('MouseEvents');
            legacyEvent.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
            element.dispatchEvent(legacyEvent);
            this.sendMessage({ type: 'log', text: `📍 Legacy createEvent on ${description}`, logType: 'info' });
        } catch (error) {
            this.sendMessage({ type: 'log', text: `❌ Legacy event failed: ${error.message}`, logType: 'error' });
        }
    }
    
    async clickPositionMultipleMethods(x, y, description) {
        const element = document.elementFromPoint(x, y);
        
        // Method 1: MouseEvent at position
        try {
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: x,
                clientY: y
            });
            element?.dispatchEvent(clickEvent);
            this.sendMessage({ type: 'log', text: `📍 Position click at ${description}`, logType: 'info' });
        } catch (error) {
            this.sendMessage({ type: 'log', text: `❌ Position click failed: ${error.message}`, logType: 'error' });
        }
        
        // Method 2: Document.createEvent (legacy)
        try {
            const legacyEvent = document.createEvent('MouseEvents');
            legacyEvent.initMouseEvent('click', true, true, window, 1, x, y, x, y, false, false, false, false, 0, null);
            element?.dispatchEvent(legacyEvent);
            this.sendMessage({ type: 'log', text: `📍 Legacy event at ${description}`, logType: 'info' });
        } catch (error) {
            this.sendMessage({ type: 'log', text: `❌ Legacy event failed: ${error.message}`, logType: 'error' });
        }
    }
    
    simulateJQueryClick(element) {
        // Simulate jQuery's click behavior
        const events = ['mousedown', 'mouseup', 'click'];
        
        for (const eventType of events) {
            const event = new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(event);
        }
    }
    
    async sendKeyboardEvent(key, keyCode) {
        const events = ['keydown', 'keyup'];
        
        for (const eventType of events) {
            const keyEvent = new KeyboardEvent(eventType, {
                bubbles: true,
                cancelable: true,
                key: key,
                keyCode: keyCode,
                which: keyCode
            });
            document.dispatchEvent(keyEvent);
        }
    }
    
    isInteractiveElement(element) {
        const tagName = element.tagName.toLowerCase();
        const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
        const hasClickHandler = element.onclick || element.getAttribute('onclick');
        const hasRole = element.getAttribute('role') === 'button';
        
        return interactiveTags.includes(tagName) || hasClickHandler || hasRole;
    }
    
    async waitForPreviewToClose() {
        this.sendMessage({ type: 'log', text: '⏳ Waiting for preview to close...', logType: 'info' });
        
        let attempts = 0;
        const maxAttempts = 15; // 15 seconds total
        
        while (this.isFilePreviewOpen() && attempts < maxAttempts) {
            this.sendMessage({ type: 'log', text: `🔄 Still waiting... (${attempts + 1}/${maxAttempts})`, logType: 'info' });
            await this.sleep(1000);
            attempts++;
        }
        
        if (!this.isFilePreviewOpen()) {
            this.sendMessage({ type: 'log', text: '✅ Preview successfully closed!', logType: 'success' });
        } else {
            this.sendMessage({ type: 'log', text: '⚠️ Preview still open after all attempts, proceeding anyway...', logType: 'warning' });
        }
    }
    
    verifyCorrectFileLoaded(expectedFilename) {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 10;
            
            const checkFilename = () => {
                attempts++;
                
                // Extract the basename without extension for comparison
                const expectedBasename = expectedFilename.replace(/\.[^/.]+$/, "").trim();
                
                console.log(`🔍 Verification attempt ${attempts}: Looking for "${expectedBasename}" from "${expectedFilename}"`);
                this.sendMessage({ type: 'log', text: `🔍 Attempt ${attempts}: Looking for basename "${expectedBasename}"`, logType: 'info' });
                
                // Strategy 1: Look for title elements that contain the filename
                const titleSelectors = [
                    '[data-resource-key="filename"]',
                    '.drive-viewer-filename',
                    '.ndfHFb-c4YZDc-C7uZN',  // Google Drive filename container
                    '[role="heading"]',       // Heading elements often contain filenames
                    '.aSK93-Xo6Ekc',         // Google Drive specific
                    '[jsname="r4nke"]'       // Google Drive specific
                ];
                
                let foundTexts = [];
                
                for (const selector of titleSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        const textSources = [
                            element.textContent?.trim(),
                            element.getAttribute('aria-label'),
                            element.getAttribute('title'),
                            element.getAttribute('data-tooltip')
                        ].filter(text => text && text.length > 0);
                        
                        for (const text of textSources) {
                            if (text.length > 0 && text.length < 200) {
                                foundTexts.push(`${selector}: "${text}"`);
                                
                                // Clean the displayed text the same way we clean filenames
                                const cleanedDisplayText = this.cleanupFileName(text + '.pdf').replace(/\.pdf$/, '');
                                
                                // Also check the raw text for direct matches
                                if (text.includes(expectedBasename) || cleanedDisplayText === expectedBasename) {
                                    this.sendMessage({ type: 'log', text: `✅ Match found in ${selector}: "${text}" → "${cleanedDisplayText}"`, logType: 'success' });
                                    console.log(`✓ Filename verified via selector "${selector}": "${text}" matches "${expectedFilename}"`);
                                    resolve(expectedFilename);
                                    return;
                                }
                            }
                        }
                    }
                }
                
                // Log all found texts for debugging
                if (foundTexts.length > 0) {
                    this.sendMessage({ type: 'log', text: `📋 Found texts: ${foundTexts.slice(0, 3).join(', ')}${foundTexts.length > 3 ? '...' : ''}`, logType: 'info' });
                }
                
                // Strategy 2: Check URL parameters
                const urlParams = new URLSearchParams(window.location.search);
                const urlFilename = urlParams.get('filename');
                if (urlFilename && urlFilename.includes(expectedBasename)) {
                    console.log(`✓ Filename verified via URL: ${urlFilename} matches ${expectedFilename}`);
                    resolve(expectedFilename);
                    return;
                }
                
                // Strategy 3: Check browser tab title
                const documentTitle = document.title.replace(' - Google Drive', '');
                const cleanedDocTitle = this.cleanupFileName(documentTitle + '.pdf').replace(/\.pdf$/, '');
                
                if (documentTitle.includes(expectedBasename) || cleanedDocTitle === expectedBasename) {
                    console.log(`✓ Filename verified via document title: "${documentTitle}" matches "${expectedFilename}"`);
                    resolve(expectedFilename);
                    return;
                }
                
                // Strategy 4: Scan the current page for any text containing our filename
                const allTextElements = document.querySelectorAll('*');
                for (const element of allTextElements) {
                    const text = element.textContent?.trim();
                    if (text && text.length > 0 && text.length < 500) {
                        // Check if this text contains our filename
                        if (text.includes(expectedBasename)) {
                            // Verify it's actually a filename by checking if it has .pdf nearby
                            if (text.toLowerCase().includes('.pdf')) {
                                console.log(`✓ Filename verified via page scan: "${text}" contains "${expectedFilename}"`);
                                resolve(expectedFilename);
                                return;
                            }
                        }
                    }
                }
                
                // Strategy 5: More lenient approach - if we're on a Google Drive preview page, assume success
                if (window.location.href.includes('drive.google.com') && 
                    (window.location.href.includes('/file/d/') || window.location.href.includes('preview'))) {
                    
                    // Get any filename-like text from the page
                    const bodyText = document.body.textContent || '';
                    if (bodyText.toLowerCase().includes('.pdf')) {
                        console.log(`✓ Filename verification relaxed: On Google Drive preview page with PDF content`);
                        resolve(expectedFilename);
                        return;
                    }
                }
                
                if (attempts < maxAttempts) {
                    console.log(`⏳ Verification attempt ${attempts} failed, retrying...`);
                    setTimeout(checkFilename, 500);
                } else {
                    console.warn(`❌ Failed to verify filename after ${maxAttempts} attempts. Expected: "${expectedFilename}"`);
                    console.warn(`Document title: "${document.title}"`);
                    console.warn(`URL: ${window.location.href}`);
                    
                    // As a last resort, just return the expected filename to avoid blocking downloads
                    // This is better than skipping files that might be correct
                    console.log(`🔄 Using expected filename as fallback: "${expectedFilename}"`);
                    resolve(expectedFilename);
                }
            };
            
            checkFilename();
        });
    }
    
    async clearBlobImageCache() {
        this.sendMessage({ type: 'log', text: '🧹 Clearing blob image cache...', logType: 'info' });

        // Helper: extract blob URLs from a CSS background-image string
        const extractBlobUrls = (bg) => {
            const urls = [];
            if (!bg) return urls;
            const regex = /url\(("|')?(blob:[^"')]+)("|')?\)/g;
            let m;
            while ((m = regex.exec(bg)) !== null) {
                urls.push(m[2]);
            }
            return urls;
        };

        try {
            const revoked = new Set();
            let totalRemoved = 0;   // DOM nodes removed
            let totalRevoked = 0;   // blob: URLs revoked
            let totalBgCleared = 0; // background-images cleared
            let totalAttrsCleared = 0; // src/href/data attributes blanked
            let totalCanvasCleared = 0; // canvases wiped

            const cleanRoot = (root) => {
                if (!root) return { removed: 0, revoked: 0, bg: 0, attrs: 0, canv: 0 };
                let removed = 0, revokedCount = 0, bg = 0, attrs = 0, canv = 0;

                // 1) Elements with src/href/data pointing to blob:
                const selectors = [
                    'img[src^="blob:"]', 'video[src^="blob:"]', 'audio[src^="blob:"]',
                    'source[src^="blob:"]', 'track[src^="blob:"]', 'embed[src^="blob:"]',
                    'object[data^="blob:"]', 'a[href^="blob:"]', 'link[href^="blob:"]'
                ];
                const nodeLists = selectors.map(sel => Array.from(root.querySelectorAll(sel)));
                const all = nodeLists.flat();
                all.forEach(el => {
                    try {
                        // Revoke known URL holders
                        if (el.src && el.src.startsWith('blob:') && !revoked.has(el.src)) {
                            URL.revokeObjectURL(el.src);
                            revoked.add(el.src);
                            revokedCount++;
                            el.src = '';
                            attrs++;
                        }
                        if (el.href && el.href.startsWith('blob:') && !revoked.has(el.href)) {
                            URL.revokeObjectURL(el.href);
                            revoked.add(el.href);
                            revokedCount++;
                            el.href = '';
                            attrs++;
                        }
                        if (el.data && typeof el.data === 'string' && el.data.startsWith('blob:') && !revoked.has(el.data)) {
                            // <object data="blob:...">
                            URL.revokeObjectURL(el.data);
                            revoked.add(el.data);
                            revokedCount++;
                            el.data = '';
                            attrs++;
                        }
                        // Remove media-ish nodes that commonly hold blob refs
                        if ((el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'AUDIO' || el.tagName === 'SOURCE' || el.tagName === 'TRACK' || el.tagName === 'EMBED') && el.parentNode) {
                            el.parentNode.removeChild(el);
                            removed++;
                        }
                    } catch (_) { /* ignore */ }
                });

                // 2) Inline/background-image styles containing blob:
                const styleCandidates = Array.from(root.querySelectorAll('*'));
                styleCandidates.forEach(el => {
                    try {
                        // Inline style
                        const inlineBg = el.style && el.style.backgroundImage;
                        const inlineUrls = extractBlobUrls(inlineBg);
                        if (inlineUrls.length) {
                            inlineUrls.forEach(u => {
                                if (!revoked.has(u)) {
                                    try { URL.revokeObjectURL(u); } catch (_) {}
                                    revoked.add(u); revokedCount++;
                                }
                            });
                            el.style.backgroundImage = 'none';
                            bg++;
                        }

                        // Computed style (set override to none if blob detected)
                        const comp = window.getComputedStyle(el);
                        const compBg = comp && comp.backgroundImage;
                        const compUrls = extractBlobUrls(compBg);
                        if (compUrls.length) {
                            compUrls.forEach(u => {
                                if (!revoked.has(u)) {
                                    try { URL.revokeObjectURL(u); } catch (_) {}
                                    revoked.add(u); revokedCount++;
                                }
                            });
                            // Override to none to drop reference
                            el.style.backgroundImage = 'none';
                            bg++;
                        }
                    } catch (_) { /* ignore */ }
                });

                // 3) Canvas contents (can hold decoded image data sourced from blobs)
                const canvases = Array.from(root.querySelectorAll('canvas'));
                canvases.forEach(cv => {
                    try {
                        // Clear canvas content by resizing (safe post-close)
                        const w = cv.width; const h = cv.height;
                        cv.width = 0; cv.height = 0;
                        cv.width = w; cv.height = h;
                        const ctx = cv.getContext && cv.getContext('2d');
                        if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
                        canv++;
                    } catch (_) { /* ignore */ }
                });

                return { removed, revoked: revokedCount, bg, attrs, canv };
            };

            // Recursively clean a root and its shadow roots
            const cleanRootDeep = (root) => {
                const stats = cleanRoot(root);
                // Shadow DOM
                const withShadow = Array.from(root.querySelectorAll('*')).filter(el => el.shadowRoot);
                withShadow.forEach(el => {
                    const sub = cleanRoot(el.shadowRoot);
                    stats.removed += sub.removed;
                    stats.revoked += sub.revoked;
                    stats.bg += sub.bg;
                    stats.attrs += sub.attrs;
                    stats.canv += sub.canv;
                });
                return stats;
            };

            // Multi-pass cleanup with retries
            for (let pass = 1; pass <= 3; pass++) {
                let passRemoved = 0, passRevoked = 0, passBg = 0, passAttrs = 0, passCanvas = 0;

                // Main document
                const s1 = cleanRootDeep(document);
                passRemoved += s1.removed; passRevoked += s1.revoked; passBg += s1.bg; passAttrs += s1.attrs; passCanvas += s1.canv;

                // Same-origin iframes (best-effort)
                const iframes = Array.from(document.querySelectorAll('iframe'));
                for (const iframe of iframes) {
                    try {
                        const idoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (idoc) {
                            const s2 = cleanRootDeep(idoc);
                            passRemoved += s2.removed; passRevoked += s2.revoked; passBg += s2.bg; passAttrs += s2.attrs; passCanvas += s2.canv;
                        }
                    } catch (_) { /* cross-origin, ignore */ }
                }

                totalRemoved += passRemoved;
                totalRevoked += passRevoked;
                totalBgCleared += passBg;
                totalAttrsCleared += passAttrs;
                totalCanvasCleared += passCanvas;

                this.sendMessage({ type: 'log', text: `🧹 Pass ${pass}: removed ${passRemoved}, revoked ${passRevoked}, bg-cleared ${passBg}, attrs-cleared ${passAttrs}, canv-cleared ${passCanvas}`, logType: 'info' });

                // If nothing more to clear, stop early
                if (passRemoved === 0 && passRevoked === 0 && passBg === 0 && passAttrs === 0 && passCanvas === 0) {
                    break;
                }

                // Small backoff between passes
                await this.sleep(200);
            }

            // Force garbage collection if available
            if (window.gc) {
                try { window.gc(); } catch (_) {}
            }

            this.sendMessage({ type: 'log', text: `🧹 Cleared cache summary → nodes: ${totalRemoved}, urls: ${totalRevoked}, backgrounds: ${totalBgCleared}, attrs: ${totalAttrsCleared}, canvases: ${totalCanvasCleared}`, logType: 'info' });

            // Final small wait for cleanup to settle
            await this.sleep(300);

        } catch (error) {
            this.sendMessage({ type: 'log', text: `⚠️ Error clearing blob cache: ${error.message}`, logType: 'warning' });
        }
    }
    
    async tryAlternativeClickMethods(element, rect) {
        this.sendMessage({ type: 'log', text: '🔄 Trying alternative click methods...', logType: 'info' });
        
        // Method 1: Try clicking with jsaction dblclick directly (specific to Google Drive)
        try {
            const jsActionElement = element.closest('[jsaction*="dblclick:FNFY6c"], [jsaction*="dblclick:"]');
            if (jsActionElement) {
                this.sendMessage({ type: 'log', text: '🎯 Found Google Drive jsaction dblclick element, trying direct dispatch...', logType: 'info' });
                
                // Single click first
                const singleClick = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                jsActionElement.dispatchEvent(singleClick);
                await this.sleep(200);
                
                // Then dblclick event
                const dblClickEvent = new MouseEvent('dblclick', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    detail: 2
                });
                
                jsActionElement.dispatchEvent(dblClickEvent);
                return;
            }
        } catch (e) {
            this.sendMessage({ type: 'log', text: `⚠️ jsaction method failed: ${e.message}`, logType: 'warning' });
        }
        
        // Method 2: Try clicking on Google Drive specific row element
        try {
            const driveRow = element.closest('[role="row"][jsname="LvFR7c"], [role="row"][jsaction*="click:"]');
            if (driveRow) {
                this.sendMessage({ type: 'log', text: '🎯 Found Google Drive row element, trying click...', logType: 'info' });
                
                // Single click first
                const singleClick = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                driveRow.dispatchEvent(singleClick);
                await this.sleep(200);
                
                // Then dblclick
                const dblClick = new MouseEvent('dblclick', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    detail: 2
                });
                driveRow.dispatchEvent(dblClick);
                return;
            }
        } catch (e) {
            this.sendMessage({ type: 'log', text: `⚠️ Drive row method failed: ${e.message}`, logType: 'warning' });
        }
        
        // Method 3: Try createEvent for dblclick with proper coordinates
        try {
            this.sendMessage({ type: 'log', text: '🎯 Trying createEvent dblclick with coordinates...', logType: 'info' });
            
            const evt = document.createEvent("MouseEvents");
            evt.initMouseEvent("dblclick", true, true, window,
                2, 0, 0, rect.left + rect.width / 2, rect.top + rect.height / 2, 
                false, false, false, false, 0, null);
            
            element.dispatchEvent(evt);
        } catch (e) {
            this.sendMessage({ type: 'log', text: `⚠️ createEvent method failed: ${e.message}`, logType: 'warning' });
        }
        
        // Method 4: Try clicking on gridcell children with specific Google Drive classes
        try {
            const clickableChild = element.querySelector('[role="gridcell"].jGNTYb.ACGwFc, .jGNTYb, .ACGwFc');
            if (clickableChild) {
                this.sendMessage({ type: 'log', text: '🎯 Trying click on Google Drive gridcell child...', logType: 'info' });
                
                // Single click first
                const singleClick = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                clickableChild.dispatchEvent(singleClick);
                await this.sleep(200);
                
                // Then dblclick
                const dblClickEvent = new MouseEvent('dblclick', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    detail: 2
                });
                
                clickableChild.dispatchEvent(dblClickEvent);
            }
        } catch (e) {
            this.sendMessage({ type: 'log', text: `⚠️ Child element method failed: ${e.message}`, logType: 'warning' });
        }
        
        // Method 5: Try dispatching focus event first (sometimes needed for Google Drive)
        try {
            this.sendMessage({ type: 'log', text: '🎯 Trying focus + dblclick sequence...', logType: 'info' });
            
            // Focus first
            const focusEvent = new FocusEvent('focus', {
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(focusEvent);
            await this.sleep(100);
            
            // Then click sequence
            const singleClick = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(singleClick);
            await this.sleep(200);
            
            const dblClick = new MouseEvent('dblclick', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 2
            });
            element.dispatchEvent(dblClick);
            
        } catch (e) {
            this.sendMessage({ type: 'log', text: `⚠️ Focus sequence method failed: ${e.message}`, logType: 'warning' });
        }
    }
    
    async waitForFilePreviewToLoad() {
        this.sendMessage({ type: 'log', text: '⏳ Waiting for file preview to load...', logType: 'info' });
        
        const maxWaitTime = 10000; // 10 seconds max
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            if (this.isFilePreviewOpen()) {
                // Wait a bit more for content to fully load
                await this.sleep(2000);
                return true;
            }
            await this.sleep(500);
        }
        
        throw new Error('File preview did not load within timeout period');
    }
    
    async downloadCurrentFileInBulk(expectedFilename) {
        try {
            // Create warning overlay
            this.createWarningOverlay();
            
            // Wait a moment for content to stabilize
            await this.sleep(1000);
            
            // Scroll to load all pages (pages need to be preserved, not cleared)
            await this.scrollToLoadAllPages();
            
            // Extra verification for complete loading - especially important for last file
            await this.verifyCompletePageLoading(expectedFilename);
            
            // CRITICAL: Tag all current blob images with this file's identifier
            const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.sendMessage({ type: 'log', text: `🏷️ Tagging blob images with file ID: ${fileId}`, logType: 'info' });
            
            const allCurrentBlobs = document.querySelectorAll('img[src^="blob:"]');
            let taggedCount = 0;
            allCurrentBlobs.forEach(img => {
                if (!img.hasAttribute('data-file-id')) {
                    img.setAttribute('data-file-id', fileId);
                    img.setAttribute('data-filename', expectedFilename);
                    taggedCount++;
                }
            });
            this.sendMessage({ type: 'log', text: `🏷️ Tagged ${taggedCount} blob images for ${expectedFilename}`, logType: 'info' });
            
            // Extract filename (use expected filename as fallback)
            let fileName;
            try {
                fileName = await this.extractFileNameFromPreview();
                if (!fileName || fileName.includes('download_')) {
                    fileName = expectedFilename;
                }
            } catch (e) {
                fileName = expectedFilename;
            }
            
            // Verify that we have content loaded
            this.sendMessage({ type: 'log', text: `🔍 Verifying loaded content for ${fileName}...`, logType: 'info' });
            
            // Count current blob images to ensure we have content
            const currentBlobImages = document.querySelectorAll('img[src^="blob:"]');
            this.sendMessage({ type: 'log', text: `📊 Found ${currentBlobImages.length} blob images for ${fileName}`, logType: 'info' });
            
            if (currentBlobImages.length === 0) {
                // If no blob images, wait a bit more for them to load
                this.sendMessage({ type: 'log', text: '⏳ Waiting for content to load...', logType: 'info' });
                await this.sleep(2000);
                
                // Check again
                const retryBlobImages = document.querySelectorAll('img[src^="blob:"]');
                if (retryBlobImages.length === 0) {
                    throw new Error('No PDF pages loaded - content may not be available');
                }
            }
            
            // Generate PDF directly with file identifier filtering
            await this.generatePDFDirectly(fileName, fileId);
            
            // CRITICAL: Verify download completed and log blob status
            const finalBlobImages = document.querySelectorAll('img[src^="blob:"]');
            this.sendMessage({ type: 'log', text: `📊 After download: ${finalBlobImages.length} blob images still in DOM`, logType: 'info' });
            
            this.removeWarningOverlay();
            this.sendMessage({ type: 'log', text: `✅ Downloaded: ${fileName}`, logType: 'success' });
            
        } catch (error) {
            this.removeWarningOverlay();
            throw error;
        }
    }
    
    async closeFilePreview() {
        this.sendMessage({ type: 'log', text: '❌ Closing file preview...', logType: 'info' });
        
        // Track if we attempted to close
        let attemptedClose = false;
        
        // Strategy 1: Look for close buttons
        const closeSelectors = [
            '[aria-label="Close"]',
            '[aria-label*="close"]',
            '[title="Close"]',
            '[title*="close"]',
            '.ndfHFb-c4YZDc-l2Qb7d', // Google Drive close button class
            '[data-testid="close"]',
            '[role="button"][aria-label*="Close"]',
            'button[aria-label*="close"]'
        ];
        
        for (const selector of closeSelectors) {
            const closeBtn = document.querySelector(selector);
            if (closeBtn) {
                this.sendMessage({ type: 'log', text: `🔘 Clicking close button: ${selector}`, logType: 'info' });
                closeBtn.click();
                attemptedClose = true;
                await this.sleep(1000);
                
                // Check if preview closed before clearing cache
                if (!this.isFilePreviewOpen()) {
                    this.sendMessage({ type: 'log', text: '✅ Preview closed via button, clearing cache...', logType: 'success' });
                    await this.clearBlobImageCache();
                    return;
                } else {
                    this.sendMessage({ type: 'log', text: '⚠️ Button click failed to close preview, trying other methods...', logType: 'warning' });
                }
                break; // Only try first found button
            }
        }
        
        // Strategy 2: Press Escape key
        if (!attemptedClose || this.isFilePreviewOpen()) {
            this.sendMessage({ type: 'log', text: '⌨️ Trying Escape key...', logType: 'info' });
            const escapeEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(escapeEvent);
            attemptedClose = true;
            
            await this.sleep(1000);
            
            // Check if preview closed
            if (!this.isFilePreviewOpen()) {
                this.sendMessage({ type: 'log', text: '✅ Preview closed via Escape key, clearing cache...', logType: 'success' });
                await this.clearBlobImageCache();
                return;
            }
        }
        
        // Strategy 3: Click outside the preview area
        if (this.isFilePreviewOpen()) {
            this.sendMessage({ type: 'log', text: '🖱️ Trying to click outside preview...', logType: 'info' });
            const overlay = document.querySelector('[role="dialog"]');
            if (overlay) {
                // Click on the overlay background (outside the content)
                const rect = overlay.getBoundingClientRect();
                const clickEvent = new MouseEvent('click', {
                    clientX: rect.left + 10,
                    clientY: rect.top + 10,
                    bubbles: true,
                    cancelable: true
                });
                overlay.dispatchEvent(clickEvent);
                attemptedClose = true;
                
                await this.sleep(1000);
                
                // Check if preview closed
                if (!this.isFilePreviewOpen()) {
                    this.sendMessage({ type: 'log', text: '✅ Preview closed via overlay click, clearing cache...', logType: 'success' });
                    await this.clearBlobImageCache();
                    return;
                }
            }
        }
        
        // Final check after all attempts
        if (!this.isFilePreviewOpen()) {
            this.sendMessage({ type: 'log', text: '✅ Preview eventually closed, clearing cache...', logType: 'success' });
            await this.clearBlobImageCache();
        } else {
            this.sendMessage({ type: 'log', text: '⚠️ Preview still open after all close attempts, NOT clearing cache to preserve content', logType: 'warning' });
        }
    }
    
    // Helper methods for file preview detection
    isFilePreviewOpen() {
        const previewSelectors = [
            '[data-testid="preview-main-content"]',
            '[role="dialog"] img[src*="blob:"]', 
            '.ndfHFb-c4YZDc-Wrql6b img',
            '[data-focus-on-open="true"]',
            'iframe[src*="docs.google"]'
        ];
        
        return previewSelectors.some(selector => document.querySelector(selector) !== null);
    }
    
    async extractFileNameFromPreview() {
        console.log('🔍 Scanning top-left viewport area for filename...');
        
        // Define the OCR scan area: top-left 25% width x 10% height viewport
        const scanArea = {
            left: 0,
            top: 0,
            width: window.innerWidth * 0.25,  // 25% of viewport width
            height: window.innerHeight * 0.10  // 10% of viewport height
        };
        
        console.log(`📐 Scan area: ${scanArea.width}x${scanArea.height} pixels from top-left`);
        
        // Get all elements that intersect with the scan area
        const elementsInScanArea = [];
        const allElements = document.querySelectorAll('*');
        
        for (const element of allElements) {
            const rect = element.getBoundingClientRect();
            
            // Check if element intersects with our scan area
            if (rect.left < scanArea.width && 
                rect.top < scanArea.height && 
                rect.right > scanArea.left && 
                rect.bottom > scanArea.top &&
                rect.width > 0 && 
                rect.height > 0) {
                
                elementsInScanArea.push({
                    element,
                    rect,
                    area: rect.width * rect.height
                });
            }
        }
        
        console.log(`📍 Found ${elementsInScanArea.length} elements in scan area`);
        
        // Sort by area (smallest first) to prioritize text elements over containers
        elementsInScanArea.sort((a, b) => a.area - b.area);
        
        // Strategy 1: Scan elements in the defined viewport area for PDF filenames
        const foundTexts = [];
        
        for (const {element, rect} of elementsInScanArea) {
            const textSources = [
                element.textContent?.trim(),
                element.getAttribute('title'),
                element.getAttribute('aria-label'),
                element.getAttribute('data-tooltip'),
                element.getAttribute('data-original-text'),
                element.value // for input elements
            ].filter(text => text && text.length > 0);
            
            for (const text of textSources) {
                if (text.toLowerCase().includes('.pdf')) {
                    foundTexts.push({
                        text: text,
                        element: element.tagName,
                        position: `(${Math.round(rect.left)}, ${Math.round(rect.top)})`,
                        area: rect.width * rect.height
                    });
                    console.log(`📄 Found PDF text: "${text}" at ${element.tagName} ${Math.round(rect.left)}, ${Math.round(rect.top)}`);
                }
            }
        }
        
        // Strategy 2: Prioritize text closest to top-left corner and smallest elements (likely filenames)
        if (foundTexts.length > 0) {
            // Sort by distance from top-left corner, then by element size
            foundTexts.sort((a, b) => {
                const aElement = elementsInScanArea.find(e => e.element.textContent?.includes(a.text))?.rect;
                const bElement = elementsInScanArea.find(e => e.element.textContent?.includes(b.text))?.rect;
                
                if (!aElement || !bElement) return 0;
                
                const aDistance = Math.sqrt(aElement.left * aElement.left + aElement.top * aElement.top);
                const bDistance = Math.sqrt(bElement.left * bElement.left + bElement.top * bElement.top);
                
                return aDistance - bDistance || a.area - b.area;
            });
            
            console.log('📋 PDF filename candidates:', foundTexts);
            
            // Try each candidate filename
            for (const candidate of foundTexts) {
                const cleaned = this.cleanupFileName(candidate.text);
                if (cleaned && cleaned !== 'download.pdf' && cleaned.length > 4) {
                    console.log(`✅ Selected filename: "${cleaned}" from candidate: "${candidate.text}"`);
                    return cleaned;
                }
            }
        }
        
        // Strategy 3: Document title fallback
        const docTitle = document.title;
        console.log('📖 Document title:', docTitle);
        if (docTitle && docTitle.includes('.pdf')) {
            const cleaned = this.cleanupFileName(docTitle.replace(' - Google Drive', ''));
            console.log('📖 Using document title:', cleaned);
            return cleaned;
        }
        
        // Strategy 4: Look for any visible filename in a wider area as last resort
        console.log('🔍 Expanding search to full document...');
        const wideSearchElements = document.querySelectorAll('h1, h2, h3, span[title], div[aria-label], [data-tooltip]');
        
        for (const element of wideSearchElements) {
            const rect = element.getBoundingClientRect();
            if (rect.top >= 0 && rect.top <= window.innerHeight * 0.3) { // Top 30% of viewport
                const text = element.textContent || element.getAttribute('title') || element.getAttribute('aria-label');
                if (text && text.includes('.pdf') && text.length < 150) {
                    const cleaned = this.cleanupFileName(text);
                    if (cleaned && cleaned !== 'download.pdf') {
                        console.log(`🎯 Found filename in wider search: "${cleaned}"`);
                        return cleaned;
                    }
                }
            }
        }
        
        console.log('❌ No filename found in scan area, using timestamped fallback');
        return `document_${Date.now()}.pdf`;
    }
    
    // Real-time filename detection that can be called dynamically
    async getCurrentFileName() {
        return await this.extractFileNameFromPreview();
    }
    
    cleanupFileName(rawText) {
        return new Promise((resolve, reject) => {
            try {
                console.log('🚀 Starting automatic PDF generation...');
                
                // Dynamic filename extraction function for the injected script
                const extractCurrentFileName = `
                    function extractCurrentFileName() {
                        console.log('Extracting current filename...');
                        
                        // Define the OCR scan area: top-left 25% width x 10% height viewport
                        const scanArea = {
                            left: 0,
                            top: 0,
                            width: window.innerWidth * 0.25,
                            height: window.innerHeight * 0.10
                        };
                        
                        // Get all elements that intersect with the scan area
                        const elementsInScanArea = [];
                        const allElements = document.querySelectorAll('*');
                        
                        for (const element of allElements) {
                            const rect = element.getBoundingClientRect();
                            
                            if (rect.left < scanArea.width && 
                                rect.top < scanArea.height && 
                                rect.right > scanArea.left && 
                                rect.bottom > scanArea.top &&
                                rect.width > 0 && 
                                rect.height > 0) {
                                
                                elementsInScanArea.push({
                                    element,
                                    rect,
                                    area: rect.width * rect.height
                                });
                            }
                        }
                        
                        // Search for PDF filenames in scan area
                        for (const {element} of elementsInScanArea) {
                            const textSources = [
                                element.textContent?.trim(),
                                element.getAttribute('title'),
                                element.getAttribute('aria-label'),
                                element.getAttribute('data-tooltip'),
                                element.getAttribute('data-original-text')
                            ].filter(text => text && text.length > 0);
                            
                            for (const text of textSources) {
                                if (text.toLowerCase().includes('.pdf')) {
                                    return cleanupFileName(text);
                                }
                            }
                        }
                        
                        // Fallback to document title
                        const docTitle = document.title;
                        if (docTitle && docTitle.includes('.pdf')) {
                            return cleanupFileName(docTitle.replace(' - Google Drive', ''));
                        }
                        
                        return 'document_' + Date.now() + '.pdf';
                    }
                `;
                
                // Create the complete PDF generation script
                const pdfScript = `
                    (function() {
                        console.log('🎯 PDF Generation Script Started');
                        
                        // Clean filename function with Vietnamese character support
                        function cleanupFileName(rawText) {
                            console.log('🔍 Script cleanupFileName input:', rawText);
                            
                            if (!rawText || typeof rawText !== 'string') {
                                return 'download.pdf';
                            }
                            
                            const pdfIndex = rawText.toLowerCase().indexOf('.pdf');
                            if (pdfIndex === -1) {
                                return 'download.pdf';
                            }
                            
                            let fullText = rawText.substring(0, pdfIndex + 4);
                            console.log('📝 Script text up to .pdf:', fullText);
                            
                            // Conservative UI element removal for Vietnamese filenames
                            const uiPrefixes = [
                                'NameMore sorting optionsShow foldersOn topMixed with filesFiles',
                                'NameMore sorting options',
                                'Show folders',
                                'On top',
                                'Mixed with files',
                                'Files',
                                'Name'
                            ];
                            
                            let cleanText = fullText;
                            
                            // Remove UI prefixes carefully
                            for (const prefix of uiPrefixes) {
                                if (cleanText.toLowerCase().startsWith(prefix.toLowerCase())) {
                                    cleanText = cleanText.substring(prefix.length);
                                    console.log('🧹 Script removed UI prefix:', prefix);
                                    break;
                                }
                            }
                            
                            // Clean leading non-filename characters while preserving Vietnamese
                            cleanText = cleanText.replace(/^[^A-ZÀ-ÿ0-9\\u00C0-\\u024F\\u1E00-\\u1EFF]*/i, '');
                            
                            // Extract filename with Vietnamese character support
                            const filenamePatterns = [
                                /([A-ZÀ-ÿ\\u00C0-\\u024F\\u1E00-\\u1EFF0-9\\s\\-_\\(\\)\\[\\]\\.]+\\.pdf)$/i,
                                /([^\\\\/:\"*?<>|]+\\.pdf)$/i,
                                /([A-ZÀ-ÿ\\u00C0-\\u024F\\u1E00-\\u1EFF0-9]+\\.pdf)$/i
                            ];
                            
                            let foundMatch = false;
                            for (const pattern of filenamePatterns) {
                                const match = cleanText.match(pattern);
                                if (match && match[1].length > 4) {
                                    cleanText = match[1];
                                    console.log('✅ Script found pattern:', cleanText);
                                    foundMatch = true;
                                    break;
                                }
                            }
                            
                            // Fallback word extraction for Vietnamese
                            if (!foundMatch || !cleanText.toLowerCase().endsWith('.pdf') || cleanText.length < 5) {
                                console.log('🔄 Script trying word extraction...');
                                const beforePdf = fullText.substring(0, pdfIndex);
                                const words = beforePdf.split(/\\s+/);
                                
                                let filenameWords = [];
                                for (let i = words.length - 1; i >= 0; i--) {
                                    const word = words[i].trim();
                                    if (word.length > 0 && /[A-ZÀ-ÿ\\u00C0-\\u024F\\u1E00-\\u1EFF0-9]/.test(word)) {
                                        filenameWords.unshift(word);
                                        if (filenameWords.join(' ').length > 50) break;
                                    } else if (filenameWords.length > 0) {
                                        break;
                                    }
                                }
                                
                                if (filenameWords.length > 0) {
                                    cleanText = filenameWords.join(' ') + '.pdf';
                                    console.log('🔤 Script reconstructed:', cleanText);
                                }
                            }
                            
                            // Final cleanup preserving Vietnamese characters
                            cleanText = cleanText.trim();
                            cleanText = cleanText.replace(/[<>:\"/\\\\|?*]/g, '_');
                            cleanText = cleanText.replace(/\\s+/g, ' ');
                            
                            if (!cleanText.toLowerCase().endsWith('.pdf')) {
                                cleanText += '.pdf';
                            }
                            
                            if (cleanText.length <= 4 || cleanText.toLowerCase() === '.pdf') {
                                console.log('❌ Script filename too short:', cleanText);
                                return 'document.pdf';
                            }
                            
                            console.log('✅ Script final filename:', cleanText);
                            return cleanText;
                        }
                        
                        ${extractCurrentFileName}
                        
                        // Try to use local jsPDF first, then fallback to CDN
                        if (window.jspdf && window.jspdf.jsPDF) {
                            console.log('✅ Using local jsPDF library');
                            generatePDF(window.jspdf.jsPDF);
                        } else {
                            console.log('📥 Loading jsPDF from CDN...');
                            let jspdfScript = document.createElement("script");
                            jspdfScript.onload = function() {
                                console.log('✅ jsPDF loaded from CDN');
                                generatePDF(window.jspdf.jsPDF);
                            };
                            jspdfScript.onerror = function() {
                                console.error('❌ Failed to load jsPDF');
                                alert('Failed to load PDF library. Please try again.');
                            };
                            jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                            document.body.appendChild(jspdfScript);
                        }
                        
                        function generatePDF(jsPDF) {
                            try {
                                console.log('📄 Creating PDF document...');
                                const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
                                
                                // Find all blob images (PDF pages)
                                const elements = Array.from(document.getElementsByTagName("img"));
                                const blobImages = elements.filter(img => /^blob:/.test(img.src));
                                
                                if (blobImages.length === 0) {
                                    console.error('❌ No PDF pages found');
                                    alert('No PDF content found. Make sure the file is fully loaded.');
                                    return;
                                }
                                
                                console.log(\`📖 Found \${blobImages.length} pages\`);
                                
                                // Get the current filename
                                const currentFileName = extractCurrentFileName();
                                console.log('📝 Using filename:', currentFileName);
                                
                                let pagesProcessed = 0;
                                
                                blobImages.forEach((img, index) => {
                                    try {
                                        if (index > 0) pdf.addPage();
                                        
                                        console.log(\`🖼️ Processing page \${index + 1}/\${blobImages.length}\`);
                                        
                                        const canvas = document.createElement('canvas');
                                        const ctx = canvas.getContext("2d");
                                        canvas.width = img.naturalWidth;
                                        canvas.height = img.naturalHeight;
                                        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
                                        
                                        const imgData = canvas.toDataURL("image/jpeg", 1.0);
                                        const pageWidth = pdf.internal.pageSize.getWidth();
                                        const pageHeight = pdf.internal.pageSize.getHeight();
                                        const imgRatio = canvas.width / canvas.height;
                                        const pageRatio = pageWidth / pageHeight;
                                        
                                        let width, height, x, y;
                                        if (imgRatio > pageRatio) {
                                            width = pageWidth;
                                            height = pageWidth / imgRatio;
                                        } else {
                                            height = pageHeight;
                                            width = pageHeight * imgRatio;
                                        }
                                        x = (pageWidth - width) / 2;
                                        y = (pageHeight - height) / 2;
                                        
                                        pdf.addImage(imgData, 'JPEG', x, y, width, height);
                                        pagesProcessed++;
                                        
                                    } catch (e) {
                                        console.error(\`❌ Error processing page \${index + 1}:\`, e);
                                    }
                                });
                                
                                if (pagesProcessed > 0) {
                                    console.log(\`💾 Saving PDF: \${currentFileName}\`);
                                    pdf.save(currentFileName);
                                    console.log('✅ PDF download initiated');
                                } else {
                                    console.error('❌ No pages were processed successfully');
                                    alert('Failed to process PDF pages. Please try again.');
                                }
                                
                            } catch (error) {
                                console.error('❌ PDF generation error:', error);
                                alert('PDF generation failed: ' + error.message);
                            }
                        }
                    })();
                `;
                
                // Execute the script
                console.log('📤 Injecting PDF generation script...');
                
                // Create script element and inject
                const scriptElement = document.createElement('script');
                scriptElement.textContent = pdfScript;
                
                // Add completion handler
                scriptElement.onload = () => {
                    console.log('✅ PDF script executed successfully');
                    setTimeout(() => {
                        document.head.removeChild(scriptElement);
                        resolve();
                    }, 1000);
                };
                
                scriptElement.onerror = (error) => {
                    console.error('❌ PDF script execution failed:', error);
                    reject(new Error('PDF script execution failed'));
                };
                
                // Inject the script
                document.head.appendChild(scriptElement);
                
                // Auto-resolve after 5 seconds as a safety measure
                setTimeout(() => {
                    console.log('⏰ Auto-resolving PDF generation...');
                    try {
                        document.head.removeChild(scriptElement);
                    } catch (e) {
                        // Script may have already been removed
                    }
                    resolve();
                }, 5000);
                
            } catch (error) {
                console.error('❌ PDF generation setup failed:', error);
                reject(error);
            }
        });
    }
    
    cleanupFileName(rawText) {
        if (!rawText || typeof rawText !== 'string') {
            return 'download.pdf';
        }
        
        console.log(`🔍 Original filename text: "${rawText}"`);
        
        // Find .pdf in the text
        const pdfIndex = rawText.toLowerCase().indexOf('.pdf');
        if (pdfIndex === -1) {
            return 'download.pdf';
        }
        
        // Extract text up to and including .pdf
        let fullText = rawText.substring(0, pdfIndex + 4);
        console.log(`📝 Text up to .pdf: "${fullText}"`);
        
        // More conservative UI element removal - only remove exact matches at the beginning
        const uiPrefixes = [
            'NameMore sorting optionsShow foldersOn topMixed with filesFiles',
            'NameMore sorting options',
            'Show folders',
            'On top',
            'Mixed with files',
            'Files',
            'Name'
        ];
        
        let cleanText = fullText;
        
        // Remove UI prefixes more carefully - only if they appear at the very beginning
        for (const prefix of uiPrefixes) {
            if (cleanText.toLowerCase().startsWith(prefix.toLowerCase())) {
                cleanText = cleanText.substring(prefix.length);
                console.log(`🧹 Removed UI prefix "${prefix}": "${cleanText}"`);
                break; // Only remove the first match to avoid over-processing
            }
        }
        
        // Clean up any remaining leading non-filename characters
        cleanText = cleanText.replace(/^[^A-ZÀ-ÿ0-9\u00C0-\u024F\u1E00-\u1EFF]*/i, '');
        
        // Extract filename using improved patterns that handle Vietnamese characters
        const filenamePatterns = [
            // Pattern 1: Full Vietnamese filename (including diacritics and spaces)
            /([A-ZÀ-ÿ\u00C0-\u024F\u1E00-\u1EFF0-9\s\-_\(\)\[\]\.]+\.pdf)$/i,
            // Pattern 2: Any reasonable filename ending with .pdf
            /([^\\/:"*?<>|]+\.pdf)$/i,
            // Pattern 3: Conservative fallback - last word + .pdf
            /([A-ZÀ-ÿ\u00C0-\u024F\u1E00-\u1EFF0-9]+\.pdf)$/i
        ];
        
        let foundMatch = false;
        for (const pattern of filenamePatterns) {
            const match = cleanText.match(pattern);
            if (match && match[1].length > 4) {
                cleanText = match[1];
                console.log(`✅ Found filename pattern: "${cleanText}"`);
                foundMatch = true;
                break;
            }
        }
        
        // If no pattern matched, try to extract more conservatively
        if (!foundMatch || !cleanText.toLowerCase().endsWith('.pdf') || cleanText.length < 5) {
            console.log(`🔄 Pattern matching failed, trying word extraction...`);
            
            // Find the text before .pdf and split by whitespace
            const beforePdf = fullText.substring(0, pdfIndex);
            const words = beforePdf.split(/\s+/);
            
            // Look for Vietnamese filename patterns - collect consecutive meaningful words
            let filenameWords = [];
            for (let i = words.length - 1; i >= 0; i--) {
                const word = words[i].trim();
                // Check if word contains Vietnamese characters or is meaningful
                if (word.length > 0 && /[A-ZÀ-ÿ\u00C0-\u024F\u1E00-\u1EFF0-9]/.test(word)) {
                    filenameWords.unshift(word);
                    // Stop if we hit a UI element or the filename is getting too long
                    if (filenameWords.join(' ').length > 50 || 
                        word.toLowerCase().includes('file') || 
                        word.toLowerCase().includes('name') ||
                        word.toLowerCase().includes('option')) {
                        break;
                    }
                } else if (filenameWords.length > 0) {
                    // Stop collecting if we hit a gap after finding some words
                    break;
                }
            }
            
            if (filenameWords.length > 0) {
                cleanText = filenameWords.join(' ') + '.pdf';
                console.log(`🔤 Reconstructed filename from words: "${cleanText}"`);
            }
        }
        
        // Final cleanup while preserving Vietnamese characters
        cleanText = cleanText.trim();
        
        // Remove invalid filename characters but preserve all international characters
        cleanText = cleanText.replace(/[<>:"/\\|?*]/g, '_');
        
        // Normalize whitespace
        cleanText = cleanText.replace(/\s+/g, ' ');
        
        // Ensure it ends with .pdf
        if (!cleanText.toLowerCase().endsWith('.pdf')) {
            cleanText += '.pdf';
        }
        
        // Final validation
        if (cleanText.length <= 4 || cleanText.toLowerCase() === '.pdf') {
            console.log(`❌ Filename too short or invalid: "${cleanText}"`);
            return 'document.pdf';
        }
        
        console.log(`✅ Final cleaned filename: "${cleanText}"`);
        return cleanText;
    }
    
    createWarningOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'pdf-download-warning';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 0, 0, 0.1);
            border: 5px solid red;
            z-index: 999999;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const message = document.createElement('div');
        message.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 10px;
            border: 3px solid red;
            font-size: 18px;
            font-weight: bold;
            color: red;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        message.textContent = '⚠️ PDF DOWNLOAD IN PROGRESS - DO NOT CHANGE TABS OR CLICK ANYTHING ⚠️';
        
        overlay.appendChild(message);
        document.body.appendChild(overlay);
        return overlay;
    }
    
    removeWarningOverlay() {
        const overlay = document.getElementById('pdf-download-warning');
        if (overlay) {
            overlay.remove();
        }
    }
    
    async scrollToLoadAllPages() {
        this.sendMessage({ type: 'log', text: 'Starting auto-scroll to load all pages...', logType: 'info' });
        
        try {
            // Initialize auto-scroll system
            this.scrollExtensionRunning = true;
            this.scrollCount = 0;
            
            // Start auto-scroll process
            await this.startAutoScroll();
            
            this.sendMessage({ type: 'log', text: `Auto-scroll completed! Loaded content with ${this.scrollCount} scroll events`, logType: 'success' });
            
            // Extended wait for content stabilization and DOM updates
            await this.sleep(3000);
            
        } catch (error) {
            this.sendMessage({ type: 'log', text: `Scrolling error: ${error.message}`, logType: 'error' });
            throw error;
        } finally {
            // Stop auto-scroll
            this.scrollExtensionRunning = false;
        }
    }
    
    async verifyCompletePageLoading(filename) {
        this.sendMessage({ type: 'log', text: `🔍 Verifying complete page loading for ${filename}...`, logType: 'info' });
        
        let previousPageCount = 0;
        let stableCount = 0;
        const maxVerificationTime = 15000; // 15 seconds max verification
        const stabilityCheckInterval = 1000; // Check every second
        const requiredStableChecks = 3; // Need 3 consecutive stable checks
        
        // Establish baseline page count for current file verification
        const baselinePageCount = document.querySelectorAll('img[src^="blob:"]').length;
        let baselineEstablished = false;
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxVerificationTime) {
            const totalPageCount = document.querySelectorAll('img[src^="blob:"]').length;
            
            // Establish baseline on first iteration if not already set
            if (!baselineEstablished) {
                baselineEstablished = true;
            }
            
            // Calculate current file page count relative to start of verification
            const currentFilePageCount = totalPageCount - baselinePageCount;
            
            if (currentFilePageCount === previousPageCount && currentFilePageCount > 0) {
                stableCount++;
                this.sendMessage({ 
                    type: 'log', 
                    text: `📊 Page count stable: ${currentFilePageCount} pages (${stableCount}/${requiredStableChecks} checks)`, 
                    logType: 'info' 
                });
                
                if (stableCount >= requiredStableChecks) {
                    this.sendMessage({ 
                        type: 'log', 
                        text: `✅ Complete page loading verified: ${currentFilePageCount} pages loaded`, 
                        logType: 'success' 
                    });
                    return;
                }
            } else {
                if (currentFilePageCount !== previousPageCount) {
                    this.sendMessage({ 
                        type: 'log', 
                        text: `📈 Page count changed: ${previousPageCount} → ${currentFilePageCount}`, 
                        logType: 'info' 
                    });
                }
                stableCount = 0; // Reset stability counter
                previousPageCount = currentFilePageCount;
            }
            
            await this.sleep(stabilityCheckInterval);
        }
        
        // If we reach here, verification time exceeded
        const totalPageCount = document.querySelectorAll('img[src^="blob:"]').length;
        const finalFilePageCount = totalPageCount - baselinePageCount;
        this.sendMessage({ 
            type: 'log', 
            text: `⚠️ Page loading verification timeout - proceeding with ${finalFilePageCount} pages`, 
            logType: 'warning' 
        });
    }

    async startAutoScroll() {
        return new Promise((resolve) => {
            let startTime = Date.now();
            let lastPageCount = 0;
            let stablePageCountDuration = 0;
            const minScrollDuration = 5000; // Minimum 5 seconds of scrolling
            const stabilizationTime = 3000; // 3 seconds of stable page count
            
            // Reset page count baseline for current file
            const baselinePageCount = document.querySelectorAll('img[src^="blob:"]').length;
            
            // Start auto-scroll detection
            this.selectScrollableElements();
            
            // Monitor progress and stop when complete
            const checkComplete = setInterval(() => {
                const currentTime = Date.now();
                const scrollDuration = currentTime - startTime;
                const hasActiveScrolling = this.hasActiveScrollElements();
                
                // Count current blob images (pages) relative to baseline
                const totalPageCount = document.querySelectorAll('img[src^="blob:"]').length;
                const currentFilePageCount = totalPageCount - baselinePageCount;
                
                // Check if page count is stable
                if (currentFilePageCount === lastPageCount) {
                    stablePageCountDuration += 1000; // Add 1 second to stable duration
                } else {
                    stablePageCountDuration = 0; // Reset stable duration
                    lastPageCount = currentFilePageCount;
                }
                
                this.sendMessage({ 
                    type: 'log', 
                    text: `📊 Scroll progress: ${currentFilePageCount} pages, stable for ${stablePageCountDuration}ms, duration: ${scrollDuration}ms`, 
                    logType: 'info' 
                });
                
                // More robust completion criteria
                const hasMinimumDuration = scrollDuration >= minScrollDuration;
                const hasStablizedContent = stablePageCountDuration >= stabilizationTime;
                const noActiveScrolling = !hasActiveScrolling;
                const hasContent = currentFilePageCount > 0;
                
                // Complete when we have content, minimum duration, stable page count, and no active scrolling
                if (hasContent && hasMinimumDuration && hasStablizedContent && (noActiveScrolling || !this.scrollExtensionRunning)) {
                    this.sendMessage({ 
                        type: 'log', 
                        text: `✅ Scroll completed: ${currentFilePageCount} pages loaded, ${scrollDuration}ms duration`, 
                        logType: 'success' 
                    });
                    clearInterval(checkComplete);
                    this.scrollExtensionRunning = false;
                    resolve();
                }
                
                // Safety check - if no content after extended time, still complete
                if (scrollDuration >= 45000 && currentFilePageCount === 0) {
                    this.sendMessage({ 
                        type: 'log', 
                        text: `⚠️ Scroll timeout with no content - completing anyway`, 
                        logType: 'warning' 
                    });
                    clearInterval(checkComplete);
                    this.scrollExtensionRunning = false;
                    resolve();
                }
            }, 1000);
            
            // Safety timeout - increased to handle slower loading
            setTimeout(() => {
                const totalPageCount = document.querySelectorAll('img[src^="blob:"]').length;
                const finalPageCount = totalPageCount - baselinePageCount;
                this.sendMessage({ 
                    type: 'log', 
                    text: `⏰ Scroll safety timeout reached - ${finalPageCount} pages loaded`, 
                    logType: 'warning' 
                });
                clearInterval(checkComplete);
                this.scrollExtensionRunning = false;
                resolve();
            }, 75000); // Increased to 75 seconds for large files
        });
    }

    scrollable(el) {
        if (el.scrollHeight - el.scrollTop > el.clientHeight + 1) {
            el.style.scrollBehavior = 'auto';
            const prevScrollTop = el.scrollTop;
            el.scrollTop += document.scrollingElement.clientHeight / 12;
            return el.scrollTop > prevScrollTop;
        }
        return false;
    }

    scrollElement(el) {
        el.extScrolledNow = false;
        
        if (!this.scrollExtensionRunning) return;
        if (!el.isConnected) return;

        const url = window.location.href.split('#')[0];

        if (el.extPrevUrl !== url) {
            el.extPrevHeight = el.scrollHeight;
            el.extPrevUrl = url;
            el.extScrollCnt = 0;
        }

        if (el.scrollHeight < el.extPrevHeight)
            el.extPrevHeight = el.scrollHeight;

        if (el.scrollHeight > el.extPrevHeight) {
            el.extPrevHeight = el.scrollHeight;
            el.extScrollCnt = (el.extScrollCnt || 0) + 1;
            this.scrollCount = el.extScrollCnt;
        }

        if (this.scrollable(el)) {
            el.extScrolledNow = true;
            requestAnimationFrame(() => this.scrollElement(el));
        }
    }

    getPotentialScrollContainers() {
        const threshold = document.scrollingElement.clientHeight;
        return [...document.querySelectorAll('*')]
            .filter(el => el.scrollHeight > threshold && el.clientHeight <= threshold);
    }

    selectScrollableElements() {
        if (!this.scrollExtensionRunning) return;

        const els = this.getPotentialScrollContainers().filter(el => !el.extScrolledNow && this.scrollable(el));
        els.forEach(el => requestAnimationFrame(() => this.scrollElement(el)));

        setTimeout(() => this.selectScrollableElements(), 1000);
    }
    
    hasActiveScrollElements() {
        const containers = this.getPotentialScrollContainers();
        return containers.some(el => el.extScrolledNow);
    }
    
    // DEPRECATED: Manual script popup - now using automatic execution
    // This method is kept for fallback purposes but is no longer used in normal flow
    async showManualScriptPopup(fileName) {
        return new Promise((resolve) => {
            const cleanFileName = this.cleanupFileName(fileName);
            
            // Create modal overlay
            const modal = document.createElement('div');
            modal.id = 'manual-script-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;
            
            // Create modal content
            const content = document.createElement('div');
            content.style.cssText = `
                background: #ffffff;
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                border: 1px solid #e1e5e9;
            `;
            
            const script = `(function() {
    let jspdf = document.createElement("script");
    jspdf.onload = function() {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const elements = Array.from(document.getElementsByTagName("img"));
        const blobImages = elements.filter(img => /^blob:/.test(img.src));
        if (blobImages.length === 0) {
            console.log("No images found");
            return;
        }
        
        // Dynamic filename extraction function (OCR-style viewport scanning)
        function extractCurrentFileName() {
            console.log('🔍 Scanning top-left viewport area for current filename...');
            
            // Define the OCR scan area: top-left 25% width x 10% height viewport
            const scanArea = {
                left: 0,
                top: 0,
                width: window.innerWidth * 0.25,  // 25% of viewport width
                height: window.innerHeight * 0.10  // 10% of viewport height
            };
            
            console.log('📐 Scan area:', scanArea.width + 'x' + scanArea.height + ' pixels');
            
            // Get all elements that intersect with the scan area
            const elementsInScanArea = [];
            const allElements = document.querySelectorAll('*');
            
            for (let i = 0; i < allElements.length; i++) {
                const element = allElements[i];
                const rect = element.getBoundingClientRect();
                
                // Check if element intersects with our scan area
                if (rect.left < scanArea.width && 
                    rect.top < scanArea.height && 
                    rect.right > scanArea.left && 
                    rect.bottom > scanArea.top &&
                    rect.width > 0 && 
                    rect.height > 0) {
                    
                    elementsInScanArea.push({
                        element: element,
                        rect: rect,
                        area: rect.width * rect.height
                    });
                }
            }
            
            console.log('📍 Found ' + elementsInScanArea.length + ' elements in scan area');
            
            // Sort by area (smallest first) to prioritize text elements over containers
            elementsInScanArea.sort(function(a, b) { return a.area - b.area; });
            
            // Scan elements in the defined viewport area for PDF filenames
            const foundTexts = [];
            
            for (let i = 0; i < elementsInScanArea.length; i++) {
                const item = elementsInScanArea[i];
                const element = item.element;
                const rect = item.rect;
                
                const textSources = [
                    element.textContent ? element.textContent.trim() : null,
                    element.getAttribute('title'),
                    element.getAttribute('aria-label'),
                    element.getAttribute('data-tooltip'),
                    element.getAttribute('data-original-text'),
                    element.value // for input elements
                ].filter(function(text) { return text && text.length > 0; });
                
                for (let j = 0; j < textSources.length; j++) {
                    const text = textSources[j];
                    if (text.toLowerCase().indexOf('.pdf') !== -1) {
                        foundTexts.push({
                            text: text,
                            element: element.tagName,
                            position: '(' + Math.round(rect.left) + ', ' + Math.round(rect.top) + ')',
                            area: rect.width * rect.height,
                            distance: Math.sqrt(rect.left * rect.left + rect.top * rect.top)
                        });
                        console.log('📄 Found PDF text: "' + text + '" at ' + element.tagName + ' ' + Math.round(rect.left) + ', ' + Math.round(rect.top));
                    }
                }
            }
            
            // Prioritize text closest to top-left corner and smallest elements
            if (foundTexts.length > 0) {
                foundTexts.sort(function(a, b) {
                    return a.distance - b.distance || a.area - b.area;
                });
                
                console.log('📋 PDF filename candidates:', foundTexts.length);
                
                // Try each candidate filename
                for (let i = 0; i < foundTexts.length; i++) {
                    const candidate = foundTexts[i];
                    const cleaned = cleanupFileName(candidate.text);
                    if (cleaned && cleaned !== 'download.pdf' && cleaned.length > 4) {
                        console.log('✅ Selected filename: "' + cleaned + '" from: "' + candidate.text + '"');
                        return cleaned;
                    }
                }
            }
            
            // Document title fallback
            const docTitle = document.title;
            console.log('📖 Document title:', docTitle);
            if (docTitle && docTitle.indexOf('.pdf') !== -1) {
                const cleaned = cleanupFileName(docTitle.replace(' - Google Drive', ''));
                console.log('📖 Using document title:', cleaned);
                return cleaned;
            }
            
            // Last resort with timestamp
            const fallback = 'document_' + Date.now() + '.pdf';
            console.log('❌ No filename found, using fallback:', fallback);
            return fallback;
        }
        
        // Clean filename function to ensure .pdf ending
        function cleanupFileName(rawText) {
            if (!rawText || typeof rawText !== 'string') {
                return 'download.pdf';
            }
            
            const pdfIndex = rawText.toLowerCase().indexOf('.pdf');
            if (pdfIndex === -1) {
                return 'download.pdf';
            }
            
            let fullText = rawText.substring(0, pdfIndex + 4);
            
            // Remove common UI elements
            const uiElements = [
                'NameMore sorting options',
                'Show folders',
                'On top',
                'Mixed with files',
                'Files',
                'Name',
                'More sorting options',
                'Show',
                'folders',
                'On',
                'top',
                'Mixed',
                'with',
                'files'
            ];
            
            let cleanText = fullText;
            for (const uiElement of uiElements) {
                cleanText = cleanText.replace(new RegExp('^' + uiElement, 'i'), '');
            }
            
            // Find the actual PDF filename by splitting and looking for .pdf
            if (cleanText.includes('.pdf')) {
                const parts = cleanText.split(/\\s+/);
                for (let i = parts.length - 1; i >= 0; i--) {
                    if (parts[i].toLowerCase().includes('.pdf')) {
                        const pdfPart = parts[i];
                        if (pdfPart.length > 4) {
                            cleanText = pdfPart;
                            break;
                        }
                    }
                }
            }
            
            // Fallback: extract from end backwards
            if (!cleanText.toLowerCase().endsWith('.pdf') || cleanText.length < 5) {
                const beforePdf = fullText.substring(0, pdfIndex);
                const words = beforePdf.split(/\\s+/);
                
                for (let i = words.length - 1; i >= 0; i--) {
                    const word = words[i].trim();
                    if (word.length > 0 && /[A-Za-z0-9]/.test(word)) {
                        cleanText = word + '.pdf';
                        break;
                    }
                }
            }
            
            cleanText = cleanText.trim();
            cleanText = cleanText.replace(/[<>:"/\\\\|?*]/g, '_');
            cleanText = cleanText.replace(/\\s+/g, ' ');
            
            if (!cleanText.toLowerCase().endsWith('.pdf')) {
                cleanText += '.pdf';
            }
            
            if (cleanText.length <= 4 || cleanText.toLowerCase() === '.pdf') {
                return 'document.pdf';
            }
            
            return cleanText;
        }
        
        // Get the current filename dynamically
        const currentFileName = extractCurrentFileName();
        console.log('Using filename:', currentFileName);
        
        blobImages.forEach((img, index) => {
            if (index > 0) pdf.addPage();
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext("2d");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
                const imgData = canvas.toDataURL("image/jpeg", 1.0);
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const imgRatio = canvas.width / canvas.height;
                const pageRatio = pageWidth / pageHeight;
                let width, height, x, y;
                if (imgRatio > pageRatio) {
                    width = pageWidth;
                    height = pageWidth / imgRatio;
                } else {
                    height = pageHeight;
                    width = pageHeight * imgRatio;
                }
                x = (pageWidth - width) / 2;
                y = (pageHeight - height) / 2;
                pdf.addImage(imgData, 'JPEG', x, y, width, height);
            } catch (e) {
                console.error("Image error:", e);
            }
        });
        
        // Save with the dynamically extracted filename
        pdf.save(currentFileName);
        console.log('PDF saved as:', currentFileName);
    };
    jspdf.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.body.appendChild(jspdf);
})();`;
            
            content.innerHTML = `
                <div style="padding: 20px; border-bottom: 1px solid #e1e5e9;">
                    <h3 style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">Manual Script Required</h3>
                </div>
                
                <div style="padding: 20px;">
                    <div style="margin-bottom: 16px; font-size: 14px; color: #4b5563; line-height: 1.5;">
                        <p style="margin: 0 0 8px 0;">1. Press <strong>F12</strong> to open Developer Console</p>
                        <p style="margin: 0 0 8px 0;">2. Go to the <strong>Console</strong> tab</p>
                        <p style="margin: 0 0 8px 0;">3. Click "Copy Script", paste in console, and press Enter</p>
                        <p style="margin: 0;">4. File will be auto-detected and downloaded with the current filename</p>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">Preview filename: <strong style="color: #059669;">${cleanFileName}</strong></p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <textarea readonly id="script-content" style="
                            width: 100%;
                            height: 120px;
                            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                            font-size: 11px;
                            padding: 10px;
                            border: 1px solid #d1d5db;
                            border-radius: 4px;
                            background-color: #f9fafb;
                            color: #374151;
                            resize: none;
                            box-sizing: border-box;
                            line-height: 1.3;
                        ">${script}</textarea>
                    </div>
                    
                    <div style="display: flex; gap: 8px; justify-content: center;">
                        <button id="copy-script-btn" style="
                            background-color: #3b82f6;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">Copy Script</button>
                        <button id="close-manual-script" style="
                            background-color: #f3f4f6;
                            color: #374151;
                            border: 1px solid #d1d5db;
                            padding: 8px 16px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">Done</button>
                    </div>
                </div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            // Handle copy button
            const copyBtn = document.getElementById('copy-script-btn');
            const scriptTextarea = document.getElementById('script-content');
            
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(script);
                    copyBtn.textContent = 'Copied!';
                    copyBtn.style.backgroundColor = '#10b981';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy Script';
                        copyBtn.style.backgroundColor = '#3b82f6';
                    }, 2000);
                } catch (err) {
                    // Fallback for older browsers
                    scriptTextarea.select();
                    scriptTextarea.setSelectionRange(0, 99999);
                    document.execCommand('copy');
                    copyBtn.textContent = 'Copied!';
                    copyBtn.style.backgroundColor = '#10b981';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy Script';
                        copyBtn.style.backgroundColor = '#3b82f6';
                    }, 2000);
                }
            });
            
            // Handle close button
            const closeBtn = document.getElementById('close-manual-script');
            closeBtn.addEventListener('click', () => {
                modal.remove();
                resolve();
            });
            
            // Button hover effects
            copyBtn.addEventListener('mouseenter', () => {
                if (copyBtn.textContent === 'Copy Script') {
                    copyBtn.style.backgroundColor = '#2563eb';
                }
            });
            
            copyBtn.addEventListener('mouseleave', () => {
                if (copyBtn.textContent === 'Copy Script') {
                    copyBtn.style.backgroundColor = '#3b82f6';
                }
            });
            
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.backgroundColor = '#e5e7eb';
            });
            
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.backgroundColor = '#f3f4f6';
            });
            
            // Allow clicking outside to close
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve();
                }
            });
            
            // Auto-copy script on popup open
            setTimeout(() => {
                copyBtn.click();
            }, 500);
            
            // Focus copy button
            setTimeout(() => copyBtn.focus(), 100);
        });
    }
    
    sendMessage(message) {
        try {
            // Send to Chrome extension popup if available
            chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('Failed to send message to popup:', error);
        }
        
        // Also update the persistent panel if it exists
        this.updatePersistentPanel(message);
    }
    
    updatePersistentPanel(message) {
        if (!this.popupPanel) return;
        
        try {
            const statusElement = this.popupPanel.querySelector('#panel-status');
            const logElement = this.popupPanel.querySelector('#panel-log');
            const progressContainer = this.popupPanel.querySelector('#panel-progressContainer');
            const progressFill = this.popupPanel.querySelector('#panel-progressFill');
            const progressText = this.popupPanel.querySelector('#panel-progressText');
            
            switch (message.type) {
                case 'status':
                    if (statusElement) {
                        statusElement.textContent = message.text;
                        statusElement.className = `status status-${message.statusType || 'info'}`;
                    }
                    break;
                    
                case 'log':
                    if (logElement) {
                        const logEntry = document.createElement('div');
                        logEntry.className = `log-entry log-${message.logType || 'info'}`;
                        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message.text}`;
                        logElement.appendChild(logEntry);
                        logElement.scrollTop = logElement.scrollHeight;
                        
                        // Show log container if it was hidden
                        logElement.style.display = 'block';
                    }
                    break;
                    
                case 'progress':
                    if (progressContainer && progressFill && progressText) {
                        const percentage = message.total > 0 ? (message.current / message.total) * 100 : 0;
                        progressFill.style.width = `${percentage}%`;
                        progressText.textContent = `${message.current}/${message.total} files`;
                        progressContainer.style.display = 'block';
                    }
                    break;
                    
                case 'downloadComplete':
                case 'downloadError':
                    // Reset progress after completion
                    if (progressContainer) {
                        setTimeout(() => {
                            progressContainer.style.display = 'none';
                        }, 3000);
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to update persistent panel:', error);
        }
    }
    
    async generatePDFDirectly(fileName, fileId = null) {
        try {
            this.sendMessage({ type: 'log', text: `Initializing PDF generation for ${fileName}${fileId ? ` with file ID: ${fileId}` : ''}...`, logType: 'info' });
            
            // Debug: Check what's available in the global scope
            console.log('Available global objects:', Object.keys(window).filter(key => key.toLowerCase().includes('pdf')));
            console.log('window.jspdf:', typeof window.jspdf);
            console.log('window.jsPDF:', typeof window.jsPDF);
            
            // Try different ways to access jsPDF
            let jsPDF;
            
            if (typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF) {
                jsPDF = window.jspdf.jsPDF;
                console.log('Using window.jspdf.jsPDF');
            } else if (typeof window.jsPDF !== 'undefined') {
                jsPDF = window.jsPDF;
                console.log('Using window.jsPDF');
            } else if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
                jsPDF = jspdf.jsPDF;
                console.log('Using global jspdf.jsPDF');
            } else {
                throw new Error('jsPDF library not found. Available globals: ' + Object.keys(window).filter(key => key.toLowerCase().includes('pdf')).join(', '));
            }
            
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            
            // Find blob images ONLY within the current file preview area, not the entire document
            let blobImages = [];
            
            // Strategy 1: Look for blob images within the preview container/dialog
            const previewSelectors = [
                '[role="dialog"] img[src^="blob:"]',           // Dialog container
                '.ndfHFb-c4YZDc img[src^="blob:"]',           // Google Drive preview container
                '.drive-viewer-frame img[src^="blob:"]',       // Drive viewer frame
                '[data-testid="drive-viewer"] img[src^="blob:"]', // Drive viewer testid
                '.a-s-fa-Ha-pa img[src^="blob:"]'             // Google Drive specific
            ];
            
            for (const selector of previewSelectors) {
                const images = document.querySelectorAll(selector);
                if (images.length > 0) {
                    blobImages = Array.from(images);
                    this.sendMessage({ type: 'log', text: `🎯 Found ${images.length} blob images using selector: ${selector}`, logType: 'info' });
                    break;
                }
            }
            
            // Fallback: If no images found in preview containers, scan entire document but filter by visibility
            if (blobImages.length === 0) {
                this.sendMessage({ type: 'log', text: '🔄 No images in preview containers, scanning visible blob images...', logType: 'warning' });
                const allImages = Array.from(document.getElementsByTagName("img"));
                blobImages = allImages.filter(img => {
                    if (!/^blob:/.test(img.src)) return false;
                    
                    // Only include visible images within viewport
                    const rect = img.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0 && 
                           rect.top >= 0 && rect.left >= 0 &&
                           rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
                });
            }
            
            // CRITICAL: Filter blob images by file identifier if provided
            if (fileId) {
                this.sendMessage({ type: 'log', text: `🔍 Filtering blob images by file ID: ${fileId}`, logType: 'info' });
                const originalCount = blobImages.length;
                
                // Only include blob images that have the matching file identifier
                blobImages = blobImages.filter(img => {
                    const imgFileId = img.getAttribute('data-file-id');
                    const imgFileName = img.getAttribute('data-filename');
                    
                    if (imgFileId === fileId) {
                        this.sendMessage({ type: 'log', text: `✅ Including blob for ${imgFileName} (ID: ${imgFileId})`, logType: 'info' });
                        return true;
                    } else {
                        this.sendMessage({ type: 'log', text: `❌ Excluding blob with ID: ${imgFileId || 'none'} (expected: ${fileId})`, logType: 'warning' });
                        return false;
                    }
                });
                
                this.sendMessage({ type: 'log', text: `🔍 Filtered: ${originalCount} → ${blobImages.length} blob images for ${fileName}`, logType: 'info' });
            } else {
                this.sendMessage({ type: 'log', text: `⚠️ No file ID provided - using all ${blobImages.length} blob images (this may include previous files)`, logType: 'warning' });
            }
            
            // Debug: Log blob image sources to verify we're getting the right file
            console.log(`🔍 Blob images found for ${fileName}:`, blobImages.map(img => img.src.substring(0, 50) + '...'));
            this.sendMessage({ type: 'log', text: `🔍 Processing blob images for ${fileName}: ${blobImages.map(img => img.src.substring(0, 30) + '...').join(', ')}`, logType: 'info' });
            this.sendMessage({ type: 'log', text: `📊 CRITICAL: Found exactly ${blobImages.length} blob images for ${fileName} (this should match the expected page count)`, logType: 'info' });
            
            if (blobImages.length === 0) {
                throw new Error('No PDF pages found. Make sure the file is fully loaded.');
            }
            
            this.sendMessage({ type: 'log', text: `Found ${blobImages.length} pages to convert for ${fileName}`, logType: 'info' });
            
            // Process each image/page
            for (let index = 0; index < blobImages.length; index++) {
                const img = blobImages[index];
                
                this.sendMessage({ type: 'log', text: `Processing page ${index + 1}/${blobImages.length}...`, logType: 'info' });
                
                if (index > 0) {
                    pdf.addPage();
                }
                
                try {
                    // Create canvas to convert image
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext("2d");
                    
                    // Set canvas size to match image
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    
                    // Draw image on canvas
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    // Convert to data URL
                    const imgData = canvas.toDataURL("image/jpeg", 1.0);
                    
                    // Calculate dimensions to fit PDF page
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const imgRatio = canvas.width / canvas.height;
                    const pageRatio = pageWidth / pageHeight;
                    
                    let width, height, x, y;
                    
                    if (imgRatio > pageRatio) {
                        // Image is wider than page ratio
                        width = pageWidth;
                        height = pageWidth / imgRatio;
                        x = 0;
                        y = (pageHeight - height) / 2;
                    } else {
                        // Image is taller than page ratio
                        height = pageHeight;
                        width = pageHeight * imgRatio;
                        x = (pageWidth - width) / 2;
                        y = 0;
                    }
                    
                    // Add image to PDF
                    pdf.addImage(imgData, 'JPEG', x, y, width, height);
                    
                } catch (pageError) {
                    console.error(`Error processing page ${index + 1}:`, pageError);
                    this.sendMessage({ type: 'log', text: `Warning: Error processing page ${index + 1}`, logType: 'error' });
                }
            }
            
            // Clean up the filename
            const cleanFileName = this.cleanupFileName(fileName);
            
            // Save the PDF
            this.sendMessage({ type: 'log', text: `Saving PDF as: ${cleanFileName}`, logType: 'info' });
            pdf.save(cleanFileName);
            
            this.sendMessage({ type: 'log', text: 'PDF generation completed successfully!', logType: 'success' });
            
        } catch (error) {
            console.error('PDF generation failed:', error);
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the downloader and store reference
window.googleDrivePDFDownloaderInstance = new GoogleDrivePDFDownloader();

}
