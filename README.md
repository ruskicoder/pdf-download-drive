# Google Drive PDF Downloader Extension v1.0.0

A Chrome extension that automatically downloads all PDF files from Google Drive folders with high-quality output and international character support.

## Features

- **Single File Download**: Download the currently viewed PDF file
- **Bulk Download**: Download all PDF files in a Google Drive folder with anti-contamination system
- **High Quality**: Uses full resolution of original files  
- **Smart Naming**: Files are named based on their Google Drive names with international character support
- **Vietnamese Support**: Full Vietnamese character preservation including diacritics (á, à, ả, ã, ạ, ă, ắ, etc.)
- **Folder Support**: Files from subfolders are prefixed with folder name
- **Background Processing**: Downloads work in background tabs without interrupting your workflow
- **Local PDF Generation**: Uses local jsPDF library to avoid CSP issues
- **File Contamination Prevention**: Unique file identifiers prevent cross-file page mixing
- **Enhanced Cache Management**: Multi-pass blob clearing with comprehensive reference removal
- **Top-Right Panel**: Convenient floating panel positioned at top-right corner

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
3. **Click "Download All Files in Folder"**
4. The extension will:
   - Use OCR to scan the entire folder for PDF files
   - Automatically detect all filenames ending with .pdf
   - Click on each file to open its preview
   - Download each file using the same process as single file download
   - Close preview and move to next file
   - Continue until all PDF files are downloaded
   - Show progress and status for each file

## How It Works

### PDF Generation Process

1. **File Detection**: Uses OCR to scan the entire Google Drive folder interface for PDF files
2. **Smart Filename Recognition**: Detects filenames ending with .pdf from visible text elements with Vietnamese character support
3. **UI Element Filtering**: Removes Google Drive interface elements while preserving international filenames
4. **Automated Clicking**: Simulates clicks on file elements using jQuery and native JavaScript events with unique element identification
5. **Preview Loading**: Opens each file in Google Drive's preview mode
6. **File Contamination Prevention**: Assigns unique identifiers to prevent page mixing between files
7. **Image Extraction**: Finds all blob images (PDF pages) in the preview with enhanced cache management
8. **High-Quality Conversion**: Uses HTML5 Canvas to maintain full resolution
9. **PDF Assembly**: Creates multi-page PDFs using jsPDF library with file identifier verification
10. **Smart Download**: Names files based on detected filenames from OCR scan with Vietnamese character preservation
11. **Cache Cleanup**: Multi-pass blob cache clearing with comprehensive reference removal

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

### Vietnamese Filename Processing ✅

**Problem**: Vietnamese filenames like "Máy nén và hệ thống khí nén.pdf" were being truncated to "ng khí nén.pdf" due to inadequate Unicode character support and overly aggressive UI element removal.

**Solution**:
- **Enhanced Unicode Support**: Added Vietnamese character ranges `\u00C0-\u024F` and `\u1E00-\u1EFF`
- **Conservative UI Filtering**: Improved prefix removal to preserve Vietnamese diacritics
- **Robust Fallback Processing**: Word-by-word reconstruction when direct pattern matching fails
- **Comprehensive Logging**: Added detailed debugging for Vietnamese character processing

### File Contamination Prevention ✅

**Problem**: Downloaded files contained pages from previous files during bulk operations, causing cross-contamination between different PDFs.

**Solution**:
- **Unique File Identifiers**: Each file gets a unique identifier tag during processing
- **Verification System**: PDF assembly verifies pages belong to current file identifier
- **Isolated Processing**: Clear separation between file processing sessions
- **Enhanced Cache Management**: Multi-pass blob clearing with comprehensive reference removal

### Duplicate Download Prevention ✅

**Problem**: Same first file was downloaded repeatedly instead of processing different files in bulk operations.

**Solution**:
- **Unique Element Identification**: Enhanced element selection to avoid selecting same file repeatedly
- **Progress Tracking**: Better tracking of which files have been processed
- **Element State Management**: Proper cleanup of selected elements after processing

### Cache Clearing Optimization ✅

**Problem**: 
1. Cache was cleared too early, preventing page loads
2. Blob cache clearing reported 0 items cleared, indicating ineffective cleanup

**Solution**:
- **Timing Optimization**: Only clear cache after successful operations, not before
- **Multi-Pass Clearing**: Multiple attempts to clear blob cache with different strategies
- **Comprehensive Reference Removal**: Remove all blob references, temporary objects, and cached images
- **Enhanced Reporting**: Better logging of cache clearing effectiveness

### Panel Positioning Enhancement ✅

**Problem**: Panel was centered and could interfere with Google Drive interface.

**Solution**:
- **Top-Right Positioning**: Moved panel to top-right corner with 7% vertical and 4% horizontal offset
- **Viewport Units**: Used responsive `vh` and `vw` units for consistent positioning
- **Dynamic Version Display**: Added automatic version display from manifest.json

### Content Security Policy (CSP) Resolution ✅

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
├── jquery.min.js         # jQuery library for DOM manipulation and click simulation
└── img/                  # Extension icons
    ├── icon48.png
    └── icon128.png
```

### Key Features Implemented

✅ **CSP Compliance**: Local jsPDF loading avoids external script blocks  
✅ **OCR File Detection**: Intelligent scanning of Google Drive interface for PDF files  
✅ **Vietnamese Character Support**: Full Unicode support for Vietnamese filenames with diacritics  
✅ **File Contamination Prevention**: Unique identifiers prevent cross-file page mixing  
✅ **Enhanced Cache Management**: Multi-pass blob clearing with comprehensive reference removal  
✅ **Duplicate Prevention**: Smart element selection prevents same file downloading repeatedly  
✅ **Automated Clicking**: jQuery-powered file interaction and preview opening  
✅ **Error Handling**: Robust error handling with user feedback  
✅ **High Quality**: Full resolution PDF output  
✅ **Smart Naming**: Automatic filename extraction from OCR scans with international character support  
✅ **Progress Tracking**: Real-time download status and file counters  
✅ **Bulk Processing**: Sequential download of all PDF files in a folder  
✅ **Panel Positioning**: Top-right corner placement with responsive viewport positioning  
✅ **Dynamic Versioning**: Automatic version display from manifest.json  

## Version History

### v1.0.0

- Initial release with comprehensive feature set
- Single file download support
- Bulk folder download support with anti-contamination system
- Local jsPDF integration for CSP compliance
- Background tab processing for seamless workflow
- Smart file naming with international character support
- Vietnamese character preservation and processing
- File contamination prevention with unique identifiers
- Enhanced cache management with multi-pass clearing
- Duplicate download prevention system
- Top-right panel positioning with responsive design
- Dynamic version display from manifest
- CSP compliance fixes for Google Drive integration
- OCR-based file detection and processing
- High-quality PDF output with full resolution support

## License

MIT License - Feel free to modify and distribute

## Support

For issues or feature requests, please check the console for error messages and ensure you're using the latest version of Chrome.

---

**Ready to Use**: This extension is now fully functional with local jsPDF library and proper CSP compliance for Google Drive integration.
