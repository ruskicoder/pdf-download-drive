// Prevent duplicate initialization with better checking
if (window.googleDrivePDFDownloaderInitialized) {
    console.log('Google Drive PDF Downloader already initialized');
} else {
    window.googleDrivePDFDownloaderInitialized = true;

    // Clean up any existing instances
    if (window.googleDrivePDFDownloaderInstance) {
        try {
            // Remove existing floating button if any
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
        this.currentFiles = [];
        this.processedCount = 0;
        
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
        // Create a floating button that opens the popup
        const floatingBtn = document.createElement('div');
        floatingBtn.id = 'pdf-downloader-float';
        floatingBtn.innerHTML = '📄';
        floatingBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: #1a73e8;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10000;
            font-size: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: transform 0.2s;
        `;
        
        floatingBtn.addEventListener('mouseenter', () => {
            floatingBtn.style.transform = 'scale(1.1)';
        });
        
        floatingBtn.addEventListener('mouseleave', () => {
            floatingBtn.style.transform = 'scale(1)';
        });
        
        floatingBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'openPopup' });
        });
        
        document.body.appendChild(floatingBtn);
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
                    await this.downloadAllFiles();
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
        // Check if in folder view
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
        this.sendMessage({ type: 'status', text: 'Downloading current file...', statusType: 'working' });
        
        try {
            const url = window.location.href;
            
            // Only work if we're in folder view with preview open
            if (url.includes('/file/') && url.includes('/view')) {
                throw new Error('Direct file view not supported. Please open file from folder view.');
            }
            
            if (!this.isFilePreviewOpen()) {
                throw new Error('No file preview is open. Please click a file to open its preview first.');
            }
            
            // Get filename from preview
            const fileName = this.extractFileNameFromPreview();
            this.sendMessage({ type: 'log', text: `Processing file: ${fileName}`, logType: 'info' });
            
            // Scroll to load all pages
            await this.scrollToLoadAllPages();
            
            // Execute console script to download PDF
            await this.executeConsoleScript(fileName);
            
            this.sendMessage({ type: 'status', text: 'Download completed', statusType: 'success' });
            this.sendMessage({ type: 'log', text: `Downloaded: ${fileName}`, logType: 'success' });
            this.sendMessage({ type: 'downloadComplete' });
            
        } catch (error) {
            console.error('Download failed:', error);
            this.sendMessage({ type: 'status', text: 'Download failed', statusType: 'error' });
            this.sendMessage({ type: 'log', text: `Error: ${error.message}`, logType: 'error' });
            this.sendMessage({ type: 'downloadError' });
        }
    }
    
    async downloadAllFiles() {
        if (this.isProcessing) {
            this.sendMessage({ type: 'log', text: 'Download already in progress', logType: 'error' });
            return;
        }
        
        this.isProcessing = true;
        this.processedCount = 0;
        
        try {
            this.sendMessage({ type: 'status', text: 'Scanning folder...', statusType: 'working' });
            
            // Close any open preview first
            if (this.isFilePreviewOpen()) {
                await this.closeFilePreview();
            }
            
            // Get all file elements in the current folder
            const fileElements = await this.getAllFileElements();
            
            if (fileElements.length === 0) {
                this.sendMessage({ type: 'log', text: 'No files found in folder', logType: 'error' });
                this.sendMessage({ type: 'downloadError' });
                return;
            }
            
            this.sendMessage({ type: 'log', text: `Found ${fileElements.length} files`, logType: 'info' });
            this.sendMessage({ type: 'progress', current: 0, total: fileElements.length });
            
            for (let i = 0; i < fileElements.length; i++) {
                const fileElement = fileElements[i];
                
                try {
                    const fileName = this.getFileNameFromElement(fileElement);
                    this.sendMessage({ type: 'status', text: `Processing ${fileName}...`, statusType: 'working' });
                    this.sendMessage({ type: 'log', text: `Processing: ${fileName}`, logType: 'info' });
                    
                    // Click to open file preview
                    await this.clickFileElement(fileElement);
                    
                    // Wait for preview to load
                    await this.waitForPreviewToLoad();
                    
                    // Scroll to load all pages
                    await this.scrollToLoadAllPages();
                    
                    // Execute console script to download
                    await this.executeConsoleScript(fileName);
                    
                    // Close preview
                    await this.closeFilePreview();
                    
                    this.processedCount++;
                    this.sendMessage({ type: 'progress', current: this.processedCount, total: fileElements.length });
                    this.sendMessage({ type: 'log', text: `Downloaded: ${fileName}`, logType: 'success' });
                    
                    // Small delay between files
                    await this.sleep(1500);
                    
                } catch (error) {
                    console.error(`Failed to download file:`, error);
                    this.sendMessage({ type: 'log', text: `Failed: ${error.message}`, logType: 'error' });
                    
                    // Try to close preview if it's stuck open
                    try {
                        if (this.isFilePreviewOpen()) {
                            await this.closeFilePreview();
                        }
                    } catch (closeError) {
                        console.error('Error closing preview:', closeError);
                    }
                    
                    continue;
                }
            }
            
            this.sendMessage({ type: 'status', text: `Completed! Downloaded ${this.processedCount}/${fileElements.length} files`, statusType: 'success' });
            this.sendMessage({ type: 'downloadComplete' });
            
        } catch (error) {
            console.error('Bulk download failed:', error);
            this.sendMessage({ type: 'status', text: 'Bulk download failed', statusType: 'error' });
            this.sendMessage({ type: 'log', text: `Error: ${error.message}`, logType: 'error' });
            this.sendMessage({ type: 'downloadError' });
        } finally {
            this.isProcessing = false;
        }
    }
    
    async getAllFileElements() {
        // Wait for folder content to load
        await this.waitForFolderContent();
        
        // Multiple selectors for different Google Drive layouts
        const selectors = [
            '[data-target="file"]',
            '[role="gridcell"] [data-target]',
            '[role="listitem"] [data-target]',
            'div[role="gridcell"]',
            'div[role="row"] > div',
            '[data-tooltip][role="gridcell"]',
            'div[aria-label][jsaction*="click"]'
        ];
        
        let fileElements = [];
        
        for (const selector of selectors) {
            fileElements = Array.from(document.querySelectorAll(selector));
            if (fileElements.length > 0) {
                this.sendMessage({ type: 'log', text: `Found elements with selector: ${selector}`, logType: 'info' });
                break;
            }
        }
        
        // Filter to only include actual files (not folders or empty elements)
        fileElements = fileElements.filter(element => {
            const tooltip = element.getAttribute('data-tooltip') || 
                           element.querySelector('[data-tooltip]')?.getAttribute('data-tooltip') ||
                           element.getAttribute('aria-label') ||
                           element.textContent?.trim();
            
            // Exclude folders, empty elements, and non-PDF files
            const isFolder = element.querySelector('[data-target="folder"]') ||
                           tooltip?.toLowerCase().includes('folder') ||
                           element.getAttribute('data-target') === 'folder';
                           
            const hasContent = tooltip && tooltip.trim().length > 0;
            const isPDF = !tooltip || tooltip.toLowerCase().includes('.pdf') || 
                         tooltip.toLowerCase().includes('pdf') ||
                         !tooltip.includes('.') || // Assume files without extension might be PDFs
                         true; // Include all files for now, let user filter
            
            return hasContent && !isFolder && isPDF;
        });
        
        this.sendMessage({ type: 'log', text: `Found ${fileElements.length} file elements after filtering`, logType: 'info' });
        return fileElements;
    }
    
    async waitForFolderContent() {
        // Wait for any of these elements to indicate folder content is loaded
        const selectors = [
            '[role="main"]',
            '[role="grid"]',
            '[data-target="file"]',
            '[role="gridcell"]',
            '.a-s-fa-Ha-pa'
        ];
        
        let found = false;
        for (const selector of selectors) {
            try {
                await this.waitForElement(selector, 3000);
                found = true;
                break;
            } catch (e) {
                continue;
            }
        }
        
        if (!found) {
            throw new Error('Folder content not found. Make sure you are in a Google Drive folder.');
        }
        
        // Additional wait for content to settle
        await this.sleep(2000);
    }
    
    getFileNameFromElement(element) {
        // Try multiple methods to extract filename
        const methods = [
            () => element.getAttribute('data-tooltip'),
            () => element.querySelector('[data-tooltip]')?.getAttribute('data-tooltip'),
            () => element.getAttribute('aria-label'),
            () => element.querySelector('[aria-label]')?.getAttribute('aria-label'),
            () => element.textContent?.trim(),
            () => element.querySelector('span')?.textContent?.trim()
        ];
        
        for (const method of methods) {
            try {
                const result = method();
                if (result && result.length > 0) {
                    return result;
                }
            } catch (e) {
                continue;
            }
        }
        
        return `file-${Date.now()}.pdf`;
    }
    
    async clickFileElement(element) {
        this.sendMessage({ type: 'log', text: 'Clicking file to open preview...', logType: 'info' });
        
        // Find the clickable area within the element
        const clickTargets = [
            element.querySelector('[role="button"]'),
            element.querySelector('div[jsaction*="click"]'),
            element.querySelector('[data-target]'),
            element.querySelector('div[tabindex]'),
            element
        ];
        
        const clickTarget = clickTargets.find(target => target) || element;
        
        // Scroll element into view
        clickTarget.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'center'
        });
        await this.sleep(1500);
        
        // Ensure element is visible and clickable
        if (clickTarget.offsetParent === null) {
            throw new Error('File element is not visible');
        }
        
        // Try multiple click methods
        const clickMethods = [
            // Method 1: Direct click
            () => clickTarget.click(),
            // Method 2: Mouse event
            () => {
                const rect = clickTarget.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                
                clickTarget.dispatchEvent(new MouseEvent('mousedown', { 
                    bubbles: true, 
                    clientX: x, 
                    clientY: y 
                }));
                clickTarget.dispatchEvent(new MouseEvent('mouseup', { 
                    bubbles: true, 
                    clientX: x, 
                    clientY: y 
                }));
                clickTarget.dispatchEvent(new MouseEvent('click', { 
                    bubbles: true, 
                    clientX: x, 
                    clientY: y 
                }));
            },
            // Method 3: Double click (some files need it)
            () => {
                clickTarget.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            }
        ];
        
        for (let i = 0; i < clickMethods.length; i++) {
            try {
                this.sendMessage({ type: 'log', text: `Trying click method ${i + 1}...`, logType: 'info' });
                clickMethods[i]();
                await this.sleep(3000);
                
                // Check if preview opened
                if (this.isFilePreviewOpen()) {
                    this.sendMessage({ type: 'log', text: 'File preview opened successfully', logType: 'success' });
                    return;
                }
            } catch (error) {
                console.warn(`Click method ${i + 1} failed:`, error);
            }
        }
        
        // If no method worked, try waiting a bit more
        await this.sleep(2000);
        if (!this.isFilePreviewOpen()) {
            throw new Error('Failed to open file preview after multiple attempts');
        }
    }
    
    async waitForPreviewToLoad() {
        this.sendMessage({ type: 'log', text: 'Waiting for preview to load...', logType: 'info' });
        
        // Wait for preview container to appear
        const previewSelectors = [
            'img[src*="blob:"]',
            '[role="img"] img',
            '.ndfHFb-c4YZDc-Wrql6b img',
            'canvas',
            'iframe[src*="docs.google"]'
        ];
        
        let found = false;
        for (const selector of previewSelectors) {
            try {
                await this.waitForElement(selector, 8000);
                found = true;
                break;
            } catch (e) {
                continue;
            }
        }
        
        if (!found) {
            throw new Error('Preview failed to load');
        }
        
        // Extra time for content to fully load
        await this.sleep(3000);
    }
    
    async scrollToLoadAllPages() {
        this.sendMessage({ type: 'log', text: 'Physically scrolling to load all pages...', logType: 'info' });
        
        // Find the scrollable container for the preview
        const containers = [
            document.querySelector('[role="main"]'),
            document.querySelector('.ndfHFb-c4YZDc-Wrql6b'),
            document.querySelector('[data-testid="doc-viewer"]'),
            document.querySelector('[role="dialog"]'),
            document.documentElement
        ];
        
        const scrollContainer = containers.find(c => c && c.scrollHeight > c.clientHeight) || document.documentElement;
        
        // Create a visual indicator for scrolling
        const scrollIndicator = document.createElement('div');
        scrollIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(26, 115, 232, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            z-index: 999999;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        scrollIndicator.textContent = 'Loading all pages... Please wait';
        document.body.appendChild(scrollIndicator);
        
        let lastHeight = 0;
        let currentHeight = scrollContainer.scrollHeight;
        let scrollAttempts = 0;
        const maxScrollAttempts = 30;
        
        // Start from top
        scrollContainer.scrollTo({ top: 0, behavior: 'instant' });
        await this.sleep(1000);
        
        while (lastHeight !== currentHeight && scrollAttempts < maxScrollAttempts) {
            lastHeight = currentHeight;
            scrollAttempts++;
            
            scrollIndicator.textContent = `Loading pages... (${scrollAttempts}/${maxScrollAttempts})`;
            this.sendMessage({ type: 'log', text: `Loading pages... (${scrollAttempts}/${maxScrollAttempts})`, logType: 'info' });
            
            // Calculate scroll positions for very smooth, visible scrolling
            const viewportHeight = scrollContainer.clientHeight || window.innerHeight;
            const scrollStep = Math.max(150, Math.floor(viewportHeight / 3)); // Smaller steps for visibility
            const totalScrollDistance = currentHeight;
            const numberOfSteps = Math.ceil(totalScrollDistance / scrollStep);
            
            // Physically scroll down in very visible steps
            for (let step = 1; step <= numberOfSteps; step++) {
                const scrollTo = Math.min(step * scrollStep, totalScrollDistance);
                
                // Use smooth behavior for very visible scrolling
                scrollContainer.scrollTo({
                    top: scrollTo,
                    behavior: 'smooth'
                });
                
                // Update indicator
                const progress = Math.round((scrollTo / totalScrollDistance) * 100);
                scrollIndicator.textContent = `Scrolling... ${progress}% (${scrollAttempts}/${maxScrollAttempts})`;
                
                // Wait longer between scroll steps to make it very visible
                await this.sleep(1200);
                
                // Check if new content appeared during scrolling
                const newHeight = scrollContainer.scrollHeight;
                if (newHeight > currentHeight) {
                    currentHeight = newHeight;
                    scrollIndicator.textContent = `New content detected! Height: ${currentHeight}px`;
                    this.sendMessage({ type: 'log', text: `New content detected, height: ${currentHeight}`, logType: 'info' });
                    // Break inner loop to recalculate scroll distance
                    break;
                }
            }
            
            // Ensure we're at the very bottom with smooth behavior
            scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'smooth'
            });
            
            scrollIndicator.textContent = `Reached bottom, checking for more content...`;
            
            // Wait longer for any lazy loading to complete
            await this.sleep(4000);
            
            currentHeight = scrollContainer.scrollHeight;
        }
        
        // Final scroll to bottom to ensure everything is loaded
        scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
        });
        
        scrollIndicator.textContent = 'Finalizing page load...';
        await this.sleep(2500);
        
        // Scroll back to top smoothly for consistent state
        scrollContainer.scrollTo({ 
            top: 0, 
            behavior: 'smooth' 
        });
        
        scrollIndicator.textContent = 'All pages loaded successfully!';
        scrollIndicator.style.background = 'rgba(52, 168, 83, 0.9)';
        await this.sleep(2000);
        
        // Remove indicator
        document.body.removeChild(scrollIndicator);
        
        this.sendMessage({ type: 'log', text: `All pages loaded after ${scrollAttempts} scroll cycles`, logType: 'success' });
    }
    
    async closeFilePreview() {
        this.sendMessage({ type: 'log', text: 'Closing file preview...', logType: 'info' });
        
        // Try multiple close methods
        const closeMethods = [
            // Look for close button (X)
            () => {
                const closeBtn = document.querySelector('[aria-label*="Close"], [aria-label*="close"], [title*="Close"], [title*="close"]');
                if (closeBtn) {
                    closeBtn.click();
                    return true;
                }
                return false;
            },
            // Try escape key
            () => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
                return true;
            },
            // Click outside the preview
            () => {
                const overlay = document.querySelector('[role="dialog"], .ndfHFb-c4YZDc');
                if (overlay) {
                    const rect = overlay.getBoundingClientRect();
                    const x = rect.left - 10;
                    const y = rect.top + rect.height / 2;
                    document.elementFromPoint(x, y)?.click();
                    return true;
                }
                return false;
            }
        ];
        
        for (const method of closeMethods) {
            try {
                if (method()) {
                    await this.sleep(1500);
                    if (!this.isFilePreviewOpen()) {
                        return; // Successfully closed
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        // If still open, try one more escape
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        await this.sleep(1000);
    }
    
    isFilePreviewOpen() {
        // Check for various indicators that a file preview is open
        const indicators = [
            'img[src*="blob:"]',
            '.ndfHFb-c4YZDc-Wrql6b',
            '[role="dialog"] img',
            'canvas',
            'iframe[src*="docs.google"]',
            '[aria-label*="Document"]',
            '[data-testid="doc-viewer"]',
            '.WYuW0e', // Google Drive preview container
            '[role="dialog"][aria-modal="true"]',
            'div[jsmodel*="preview"]'
        ];
        
        const isOpen = indicators.some(selector => {
            const element = document.querySelector(selector);
            return element && element.offsetParent !== null; // Check if visible
        });
        
        // Additional check for URL changes indicating preview mode
        const urlIndicatesPreview = window.location.href.includes('preview=') || 
                                   document.querySelector('[data-focus-target="preview"]');
        
        return isOpen || urlIndicatesPreview;
    }
    
    extractFileNameFromPreview() {
        // Extract filename from document title or preview UI
        const title = document.title;
        
        // Extract filename from title like "example.pdf - Google Drive"
        const match = title.match(/^(.+?)\s*-\s*Google Drive$/);
        if (match) {
            let fileName = match[1].trim();
            // Ensure it has .pdf extension
            if (!fileName.toLowerCase().endsWith('.pdf')) {
                fileName += '.pdf';
            }
            return fileName;
        }
        
        // Fallback to timestamp-based name
        return `download-${Date.now()}.pdf`;
    }
    
    async executeConsoleScript(fileName) {
        this.sendMessage({ type: 'log', text: 'Opening developer console and preparing script...', logType: 'info' });
        
        return new Promise((resolve, reject) => {
            try {
                // Clean the filename for safe injection
                const safeFileName = fileName.replace(/[^\w\s.-]/g, '').replace(/"/g, '\\"') || 'download.pdf';
                
                // Create the exact working script
                const consoleScript = `(function() {
    let jspdf = document.createElement("script");
    jspdf.onload = function() {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const elements = Array.from(document.getElementsByTagName("img"));
        const blobImages = elements.filter(img => /^blob:/.test(img.src));
        if (blobImages.length === 0) { console.log("No blob images found"); return; }
        blobImages.forEach((img, index) => {
            if (index > 0) pdf.addPage();
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext("2d");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
                const imgData = canvas.toDataURL("image/jpeg", 1.0);
                const pw = pdf.internal.pageSize.getWidth();
                const ph = pdf.internal.pageSize.getHeight();
                const pr = pw / ph;
                const ir = canvas.width / canvas.height;
                let w, h, x, y;
                if (ir > pr) { w = pw; h = pw / ir; } else { h = ph; w = ph * ir; }
                x = (pw - w) / 2; y = (ph - h) / 2;
                pdf.addImage(imgData, 'JPEG', x, y, w, h);
            } catch (e) { console.error("Image error:", e); }
        });
        pdf.save("${safeFileName}");
    };
    jspdf.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.body.appendChild(jspdf);
})();`;

                // Show instructions to user via a modal/overlay
                this.showConsoleInstructions(consoleScript, safeFileName, resolve, reject);
                
            } catch (error) {
                this.sendMessage({ type: 'log', text: `Script preparation error: ${error.message}`, logType: 'error' });
                reject(error);
            }
        });
    }

    showConsoleInstructions(script, fileName, resolve, reject) {
        // Create a modal overlay with instructions
        const overlay = document.createElement('div');
        overlay.id = 'pdf-download-console-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #ffffff;
            padding: 30px;
            border-radius: 12px;
            max-width: 650px;
            max-height: 85vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
            border: 2px solid #1a73e8;
            color: #333333;
            line-height: 1.5;
        `;

        modal.innerHTML = `
            <div style="position: relative;">
                <button id="close-btn" style="position: absolute; top: -10px; right: -10px; background: #ea4335; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 2px 8px rgba(234,67,53,0.3);">×</button>
                <h2 style="margin-top: 0; color: #1a73e8; font-size: 20px; font-weight: bold; text-align: center;">📄 PDF Download Instructions</h2>
                <p style="color: #333; font-size: 14px; margin: 10px 0;"><strong style="color: #1a73e8;">File:</strong> <span style="color: #000; font-weight: bold;">${fileName}</span></p>
                <p style="color: #333; font-size: 14px; margin: 15px 0;">Due to security restrictions, you need to manually execute the download script:</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a73e8;">
                    <div style="color: #000; font-size: 14px; line-height: 1.8;">
                        <div style="margin-bottom: 8px;"><strong style="color: #1a73e8;">Step 1:</strong> <span style="color: #000;">Press <kbd style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; border: 1px solid #adb5bd; font-family: monospace; color: #000;">F12</kbd> to open Developer Tools</span></div>
                        <div style="margin-bottom: 8px;"><strong style="color: #1a73e8;">Step 2:</strong> <span style="color: #000;">Click the <strong style="color: #d32f2f;">Console</strong> tab</span></div>
                        <div style="margin-bottom: 8px;"><strong style="color: #1a73e8;">Step 3:</strong> <span style="color: #000;">Copy the script below and paste it into the console</span></div>
                        <div><strong style="color: #1a73e8;">Step 4:</strong> <span style="color: #000;">Press <kbd style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; border: 1px solid #adb5bd; font-family: monospace; color: #000;">Enter</kbd> to execute</span></div>
                    </div>
                </div>

                <div style="margin: 20px 0;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #1a73e8; font-size: 14px;">Copy this script:</label>
                    <textarea id="console-script" readonly style="width: 100%; height: 140px; font-family: 'Courier New', monospace; font-size: 11px; border: 2px solid #1a73e8; padding: 12px; border-radius: 6px; background: #f8f9fa; color: #000; resize: vertical;">${script}</textarea>
                </div>

                <div style="margin: 25px 0; text-align: center;">
                    <button id="copy-script-btn" style="background: #1a73e8; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 0 8px; font-size: 14px; font-weight: bold; box-shadow: 0 2px 8px rgba(26,115,232,0.3); transition: all 0.2s;">📋 Copy Script</button>
                    <button id="done-btn" style="background: #34a853; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 0 8px; font-size: 14px; font-weight: bold; box-shadow: 0 2px 8px rgba(52,168,83,0.3); transition: all 0.2s;">✅ Done</button>
                    <button id="cancel-btn" style="background: #ea4335; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 0 8px; font-size: 14px; font-weight: bold; box-shadow: 0 2px 8px rgba(234,67,53,0.3); transition: all 0.2s;">❌ Cancel</button>
                </div>

                <div style="background: linear-gradient(135deg, #e3f2fd, #bbdefb); padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 13px; border: 1px solid #2196f3;">
                    <strong style="color: #0d47a1;">💡 Note:</strong> <span style="color: #1565c0;">The script will automatically download the PDF once executed. Make sure all pages are loaded before running it.</span>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Add event listeners
        const scriptTextarea = modal.querySelector('#console-script');
        const copyBtn = modal.querySelector('#copy-script-btn');
        const doneBtn = modal.querySelector('#done-btn');
        const cancelBtn = modal.querySelector('#cancel-btn');
        const closeBtn = modal.querySelector('#close-btn');

        // Add hover effects to buttons
        const addHoverEffect = (btn, hoverColor) => {
            const originalColor = btn.style.background;
            btn.addEventListener('mouseenter', () => {
                btn.style.background = hoverColor;
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = originalColor;
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            });
        };

        addHoverEffect(copyBtn, '#1557b0');
        addHoverEffect(doneBtn, '#2d8f44');
        addHoverEffect(cancelBtn, '#d93025');
        addHoverEffect(closeBtn, '#d93025');

        // Close button function
        const closeModal = () => {
            document.body.removeChild(overlay);
            this.sendMessage({ type: 'log', text: 'Console execution cancelled', logType: 'error' });
            reject(new Error('User cancelled console execution'));
        };

        // Auto-select text when clicked
        scriptTextarea.addEventListener('click', () => {
            scriptTextarea.select();
        });

        // Copy script to clipboard
        copyBtn.addEventListener('click', async () => {
            try {
                scriptTextarea.select();
                await navigator.clipboard.writeText(script);
                copyBtn.innerHTML = '✅ Copied!';
                copyBtn.style.background = '#34a853';
                
                // Auto-open developer tools
                this.openDeveloperTools();
                
                setTimeout(() => {
                    copyBtn.innerHTML = '📋 Copy Script';
                    copyBtn.style.background = '#1a73e8';
                }, 2000);
            } catch (err) {
                // Fallback for older browsers
                scriptTextarea.select();
                document.execCommand('copy');
                copyBtn.innerHTML = '✅ Copied!';
                copyBtn.style.background = '#34a853';
                
                setTimeout(() => {
                    copyBtn.innerHTML = '📋 Copy Script';
                    copyBtn.style.background = '#1a73e8';
                }, 2000);
            }
        });

        // Done button
        doneBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.sendMessage({ type: 'log', text: 'Manual console execution completed', logType: 'success' });
            resolve();
        });

        // Cancel and Close buttons
        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);

        // Close on overlay click (outside modal)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Auto-copy script on modal show
        setTimeout(() => {
            copyBtn.click();
        }, 500);
    }

    openDeveloperTools() {
        try {
            // Try to programmatically open developer tools
            // This may not work due to security restrictions, but worth trying
            
            // Method 1: Use keyboard shortcut simulation
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'F12',
                keyCode: 123,
                which: 123,
                bubbles: true
            }));

            // Method 2: Try Chrome specific method
            if (window.chrome && chrome.runtime) {
                // Send message to background script to open devtools
                chrome.runtime.sendMessage({ action: 'openDevTools' });
            }

            this.sendMessage({ type: 'log', text: 'Attempting to open Developer Tools...', logType: 'info' });
            
        } catch (error) {
            console.log('Could not automatically open developer tools:', error);
        }
    }
    
    sendMessage(message) {
        try {
            chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }
    
    async waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the downloader and store reference
window.googleDrivePDFDownloaderInstance = new GoogleDrivePDFDownloader();

}
