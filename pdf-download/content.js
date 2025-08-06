// This function will contain the PDF generation logic.
function generatePdf() {
    const button = document.getElementById('gdrive-pdf-export-btn');
    button.disabled = true;
    button.innerText = 'Generating PDF...';

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        // This selector targets the images within the preview pane.
        const elements = Array.from(document.querySelectorAll('div[role="document"] img'));

        if (elements.length === 0) {
            console.log("No images found in the preview to create a PDF.");
            alert("Could not find any content to export to PDF.");
            return;
        }

        elements.forEach((img, index) => {
            if (index > 0) {
                pdf.addPage();
            }

            const canvasElement = document.createElement('canvas');
            const con = canvasElement.getContext("2d");

            // Use the image's natural dimensions for best quality.
            canvasElement.width = img.naturalWidth;
            canvasElement.height = img.naturalHeight;
            con.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

            const imgData = canvasElement.toDataURL("image/jpeg", 1.0);
            
            // Logic to fit and center the image on the A4 page.
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pageRatio = pageWidth / pageHeight;
            const imgRatio = canvasElement.width / canvasElement.height;
            
            let imgWidth, imgHeight, xOffset, yOffset;

            if (imgRatio > pageRatio) {
                imgWidth = pageWidth;
                imgHeight = pageWidth / imgRatio;
            } else {
                imgHeight = pageHeight;
                imgWidth = pageHeight * imgRatio;
            }

            xOffset = (pageWidth - imgWidth) / 2;
            yOffset = (pageHeight - imgHeight) / 2;

            pdf.addImage(imgData, 'JPEG', xOffset, yOffset, imgWidth, imgHeight);
        });

        // *** NEW: Get the filename from the page title ***
        let filename = "download"; // Default fallback name
        const driveSuffix = " - Google Drive";
        const originalTitle = document.title;
        
        if (originalTitle.endsWith(driveSuffix)) {
            filename = originalTitle.substring(0, originalTitle.length - driveSuffix.length);
        }

        // Remove the original file extension to replace it with .pdf
        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex > 0) {
            filename = filename.substring(0, lastDotIndex);
        }

        // *** UPDATED: Use the dynamic filename for the download ***
        pdf.save(filename + ".pdf");

    } catch (e) {
        console.error("Error generating PDF:", e);
        alert("An error occurred while generating the PDF. Check the console for details.");
    } finally {
        button.disabled = false;
        button.innerText = 'Download as PDF';
    }
}

// This function injects the jsPDF library and then runs the PDF generation.
function handleDownloadClick() {
    if (typeof window.jspdf === 'undefined') {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('jspdf.umd.min.js');
        script.onload = generatePdf;
        document.head.appendChild(script);
    } else {
        generatePdf();
    }
}


// This function creates and places our button on the toolbar.
function injectButton(toolbar) {
    const button = document.createElement('button');
    button.id = 'gdrive-pdf-export-btn';
    button.className = 'gdrive-pdf-export-button';
    button.innerText = 'Download as PDF';

    // Find a reference button to place our button next to.
    const referenceButton = toolbar.querySelector('div[aria-label="Download"]');
    if (referenceButton) {
        // Insert our button before the native download button.
        referenceButton.parentNode.insertBefore(button, referenceButton);
    } else {
        // Fallback if the download button isn't found.
        toolbar.appendChild(button);
    }

    button.addEventListener('click', handleDownloadClick);
}

// Google Drive is a single-page app, so we use a MutationObserver
// to detect when the preview UI is added to the page.
const observer = new MutationObserver((mutations, obs) => {
    // A reasonably stable selector for the preview toolbar.
    const toolbar = document.querySelector('div[role="toolbar"]');
    
    // Check if the toolbar exists and if our button hasn't been added yet.
    if (toolbar && !document.getElementById('gdrive-pdf-export-btn')) {
        injectButton(toolbar);
    }
});

// Start observing the entire document for changes.
observer.observe(document.body, {
    childList: true,
    subtree: true
});