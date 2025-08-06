# Google Drive PDF Downloader Extension

A Chrome extension that automatically downloads all PDF files from Google Drive folders with high-quality output.

## Features

- **Single File Download**: Download the currently viewed PDF file
- **Bulk Download**: Download all PDF files in a Google Drive folder
- **High Quality**: Uses full resolution of original files  
- **Smart Naming**: Files are named based on their Google Drive names
- **Folder Support**: Files from subfolders are prefixed with folder name
- **Background Processing**: Downloads work in background tabs without interrupting your workflow
- **Local PDF Generation**: Uses local jsPDF library to avoid CSP issues

## Installation

### Load as Unpacked Extension (Developer Mode)

1. **Download/Clone** this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top-right corner)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

## Usage

### Automatic Interface

When you visit Google Drive (drive.google.com), the extension automatically injects a floating button (📄) in the top-right corner.

### Download Single File

1. **Open a PDF file** in Google Drive preview mode (URL contains `/file/.../view`)
2. **Click the floating button** or extension icon
3. **Click "Download Current File"**
4. The PDF will be generated and downloaded with the original filename

### Download All Files in Folder

1. **Open a Google Drive folder** containing PDF files
2. **Click the floating button** or extension icon  
3. **Click "Download All Files"**
4. The extension will:
   - Scan all files in the current folder
   - Open each file in a background tab
   - Generate high-quality PDFs
   - Download them with proper names
   - Close background tabs automatically

## How It Works

### PDF Generation Process

1. **File Detection**: Scans Google Drive folder for PDF files
2. **Background Loading**: Opens each file in a hidden browser tab
3. **Image Extraction**: Finds all blob images (PDF pages) in the preview
4. **High-Quality Conversion**: Uses HTML5 Canvas to maintain full resolution
5. **PDF Assembly**: Creates multi-page PDFs using jsPDF library
6. **Smart Download**: Names files based on Google Drive titles

### Local Security

- **No External Requests**: Uses bundled jsPDF library to avoid CSP violations
- **No Data Collection**: All processing happens locally in your browser
- **Secure Downloads**: Files download directly to your default Downloads folder

## File Naming Convention

- **Single files**: `original-name.pdf`
- **Files from subfolders**: `subfolder-name-file.pdf` 
- **Google Drive titles**: Automatically extracted from page titles

## Technical Details

### Architecture

- **Manifest V3**: Modern Chrome extension format
- **Content Script**: Handles Google Drive page interaction
- **Background Service**: Manages tab creation and script injection
- **Popup Interface**: Provides user controls and status updates

### Permissions Required

- `activeTab`: Access current Google Drive tab
- `scripting`: Inject PDF generation scripts
- `tabs`: Create background tabs for processing
- `storage`: Save extension settings
- `downloads`: Manage PDF downloads

### Supported Formats

- PDF files in Google Drive preview mode
- Multi-page documents
- High-resolution output (maintains original quality)

## Fixed Issues

### Content Security Policy (CSP) Resolution

**Problem**: Google Drive blocks external script loading with CSP errors:
```
Refused to load the script 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' because it violates the following Content Security Policy directive
```

**Solution**: 
- **Local Library**: Bundled jsPDF library in extension files
- **Extension Resources**: Made jsPDF accessible via `chrome.runtime.getURL()`
- **Proper Loading**: Load scripts using extension's content security context
- **Background Injection**: Use Chrome's scripting API for proper script injection

### Background Tab Processing

**Problem**: Opening files in visible tabs interrupts user workflow

**Solution**:
- **Hidden Tabs**: Create tabs with `active: false`
- **Background Processing**: Process files without user seeing them
- **Automatic Cleanup**: Close tabs after successful download
- **Progress Feedback**: Show progress in popup without tab switching

## Troubleshooting

### Common Issues

**No files downloaded**
- Ensure you're in a Google Drive folder with PDF files
- Check that files are accessible (not restricted)
- Verify Chrome allows downloads from extensions

**Low quality output**
- Extension uses maximum available resolution
- Quality depends on Google Drive's preview rendering
- Try refreshing the file preview before downloading

**Extension not appearing**
- Refresh the Google Drive page
- Check extension is enabled in chrome://extensions/
- Look for the floating 📄 button in top-right corner

### Console Errors

Open Chrome DevTools (F12) to see detailed error messages:
- `No images with 'blob:' source found` - File may not be a PDF or not fully loaded
- `PDF generation failed` - Try refreshing and re-downloading
- `Download timeout` - Large files may need more time

## Development

### Project Structure

```
pdf-download/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker
├── content.js            # Google Drive page integration
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── popup.css             # Popup styling
├── jspdf.umd.min.js      # Local PDF generation library
└── img/                  # Extension icons
    ├── icon48.png
    └── icon128.png
```

### Key Features Implemented

✅ **CSP Compliance**: Local jsPDF loading avoids external script blocks  
✅ **Background Processing**: Hidden tabs don't interrupt user workflow  
✅ **Error Handling**: Robust error handling with user feedback  
✅ **High Quality**: Full resolution PDF output  
✅ **Smart Naming**: Automatic filename extraction  
✅ **Progress Tracking**: Real-time download status  

## Version History

### v1.0.0
- Initial release
- Single file download support
- Bulk folder download support  
- Local jsPDF integration
- Background tab processing
- Smart file naming
- CSP compliance fixes

## License

MIT License - Feel free to modify and distribute

## Support

For issues or feature requests, please check the console for error messages and ensure you're using the latest version of Chrome.

---

**Ready to Use**: This extension is now fully functional with local jsPDF library and proper CSP compliance for Google Drive integration.
