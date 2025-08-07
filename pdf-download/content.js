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
                    // Bulk download disabled
                    this.sendMessage({ type: 'log', text: 'Bulk download temporarily disabled', logType: 'error' });
                    sendResponse({ success: false, error: 'Bulk download temporarily disabled' });
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
        // Check if in folder view - temporarily disabled
        else if (url.includes('/folders/') || url.includes('drive.google.com/drive')) {
            return 'folder_disabled';
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
            
            // Show manual script injection popup with the current filename
            this.sendMessage({ type: 'status', text: 'Manual script required for download.', statusType: 'working' });
            await this.showManualScriptPopup(fileName);
            
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
        // Find .pdf in the text and extract everything up to .pdf
        const pdfIndex = rawText.toLowerCase().indexOf('.pdf');
        if (pdfIndex === -1) {
            return 'download.pdf';
        }
        
        // Extract text up to and including .pdf
        let cleanName = rawText.substring(0, pdfIndex + 4);
        
        // Remove any leading/trailing whitespace
        cleanName = cleanName.trim();
        
        // Remove any invalid filename characters
        cleanName = cleanName.replace(/[<>:"/\\|?*]/g, '_');
        
        // Ensure it ends with .pdf
        if (!cleanName.toLowerCase().endsWith('.pdf')) {
            cleanName += '.pdf';
        }
        
        return cleanName;
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

    async startAutoScroll() {
        return new Promise((resolve) => {
            // Start auto-scroll detection
            this.selectScrollableElements();
            
            // Monitor progress and stop when complete
            const checkComplete = setInterval(() => {
                const hasActiveScrolling = this.hasActiveScrollElements();
                
                if (!hasActiveScrolling || !this.scrollExtensionRunning) {
                    clearInterval(checkComplete);
                    this.scrollExtensionRunning = false;
                    resolve();
                }
            }, 1000);
            
            // Safety timeout
            setTimeout(() => {
                clearInterval(checkComplete);
                this.scrollExtensionRunning = false;
                resolve();
            }, 60000); // 60 second max scroll time
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
            const pdfIndex = rawText.toLowerCase().indexOf('.pdf');
            if (pdfIndex === -1) {
                return 'download.pdf';
            }
            let cleanName = rawText.substring(0, pdfIndex + 4);
            cleanName = cleanName.trim();
            cleanName = cleanName.replace(/[<>:"/\\\\|?*]/g, '_');
            if (!cleanName.toLowerCase().endsWith('.pdf')) {
                cleanName += '.pdf';
            }
            return cleanName;
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
            chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the downloader and store reference
window.googleDrivePDFDownloaderInstance = new GoogleDrivePDFDownloader();

}
