# Google Drive PDF Downloader Extension

A powerful Chrome extension that automatically downloads PDF files from Google Drive folders with high-quality output and intelligent processing. Features advanced OCR-based file detection, Vietnamese filename support, and robust error handling.

## 🚀 Features

### Core Functionality
- **Single File Download**: Download the currently viewed PDF file with one click
- **Bulk Download**: Download all PDF files in a Google Drive folder automatically
- **High Quality Output**: Maintains full resolution of original documents
- **Smart File Detection**: OCR-powered scanning to find all PDF files in folders
- **International Character Support**: Full Vietnamese and Unicode character support
- **Background Processing**: Downloads work in background without interrupting workflow

### Advanced Features
- **File Identifier System**: Prevents cross-file contamination during bulk downloads
- **Multi-Pass Cache Clearing**: Enhanced blob image cache management
- **Element Verification**: Prevents duplicate downloads and ensures unique file selection
- **Comprehensive Logging**: Detailed console output for debugging and monitoring
- **Dynamic Version Display**: Panel title shows current extension version from manifest
- **Responsive Positioning**: Top-right corner placement with viewport-relative positioning

### User Interface
- **Floating Toggle Button**: Easy access PDF downloader button (📄)
- **Modern Panel Interface**: Clean, Google-style panel with minimize/close controls
- **Real-time Progress**: Live status updates and download counters
- **Error Feedback**: Clear error messages and recovery suggestions

## 📦 Installation

### Load as Unpacked Extension (Developer Mode)

1. **Download/Clone** this repository
   ```bash
   git clone https://github.com/ruskicoder/pdf-download-drive.git
   cd pdf-download-drive/pdf-download
   ```
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top-right corner)
4. **Click "Load unpacked"** and select the `pdf-download` folder
5. **Pin the extension** to your toolbar for easy access

## 🎯 Usage

### Automatic Interface

When you visit Google Drive (drive.google.com), the extension automatically injects:
- **Floating button** (📄) positioned in the top-right corner
- **Smart positioning** with 7% vertical and 4% horizontal offset from viewport edges
- **Panel interface** showing "PDF Downloader v1.0.0" with current version

### Download Single File

1. **Open a PDF file** in Google Drive preview mode
2. **Click the floating button** (📄) or extension icon
3. **Click "Download Current File"** in the panel
4. PDF downloads automatically with original filename

### Download All Files in Folder

1. **Open a Google Drive folder** containing PDF files
2. **Click the floating button** (📄)
3. **Click "Download All Files in Folder"**
4. **Monitor progress** as the extension:
   - Scans entire folder for PDF files using OCR
   - Identifies unique elements to prevent duplicates
   - Opens each file preview automatically
   - Downloads with proper Vietnamese filename handling
   - Clears image cache between files
   - Shows real-time progress and status

## 🔧 How It Works

### Advanced PDF Generation Process

1. **OCR File Detection**: Intelligent scanning of Google Drive interface for PDF files
2. **Element Identification**: Unique element tagging to prevent duplicate processing
3. **Vietnamese Filename Processing**: Enhanced Unicode support for international characters
4. **Preview Management**: Automated file opening with proper timing controls
5. **Cache Management**: Multi-pass blob image cache clearing between files
6. **High-Quality Conversion**: HTML5 Canvas maintains full document resolution
7. **File Identifier System**: Prevents cross-contamination during bulk operations

### Security & Privacy

- **Local Processing**: All operations happen in your browser
- **No External Requests**: Bundled libraries avoid CSP violations
- **No Data Collection**: Zero telemetry or data transmission
- **Secure Downloads**: Direct download to browser's default folder

## 📁 File Naming System

### Smart Filename Detection
- **Vietnamese Support**: Handles diacritics (á, à, ả, ã, ạ, ă, ắ, ằ, etc.)
- **UI Element Removal**: Strips Google Drive interface text automatically
- **Unicode Preservation**: Maintains international characters correctly
- **Fallback Processing**: Multiple strategies for filename extraction

### Naming Examples
- **Vietnamese**: `Máy nén và hệ thống khí nén.pdf` ✅ (preserved correctly)
- **Single files**: `document-name.pdf`
- **Complex names**: `Kỹ thuật máy nén khí và ứng dụng.pdf`
- **With numbers**: `Bài 1 - Máy nén khí 2024.pdf`

## 🛠️ Technical Architecture

### Core Components
- **Manifest V3**: Modern Chrome extension architecture
- **Content Script**: Google Drive page interaction and OCR processing
- **Background Service**: Tab management and script injection
- **Panel Interface**: Dynamic UI with version display and controls

### Permission Requirements
```json
{
  "permissions": [
    "activeTab",    // Access current Google Drive tab
    "scripting",    // Inject PDF generation scripts
    "storage",      // Save extension settings
    "tabs",         // Create background tabs
    "downloads",    // Manage PDF downloads
    "debugger"      // Advanced debugging capabilities
  ]
}
```

### File Structure
```
pdf-download/
├── manifest.json           # Extension configuration (v1.0.0)
├── background.js           # Background service worker
├── content.js             # Main logic with Vietnamese support
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── popup.css              # Modern panel styling
├── jspdf.umd.min.js       # Local PDF generation library
└── img/                   # Extension icons
    ├── icon48.png
    └── icon128.png
```

## 🐛 Fixed Issues & Improvements

### Major Bug Fixes

✅ **Vietnamese Filename Truncation**
- **Problem**: "Máy nén và hệ thống khí nén.pdf" became "ng khí nén.pdf"
- **Solution**: Enhanced Unicode regex patterns and conservative text processing

✅ **Cache Clearing Issues**
- **Problem**: Blob cache not clearing properly between downloads
- **Solution**: Multi-pass cache clearing with comprehensive reference removal

✅ **Duplicate Downloads**
- **Problem**: Same first file downloaded repeatedly
- **Solution**: Unique element identification system

✅ **File Contamination**
- **Problem**: Downloaded files contained pages from previous files
- **Solution**: File identifier tagging system prevents cross-contamination

✅ **International Character Support**
- **Problem**: Filename verification failed for international characters
- **Solution**: Enhanced Unicode support (\\u00C0-\\u024F\\u1E00-\\u1EFF ranges)

### UI/UX Improvements

✅ **Panel Positioning**: Top-right corner with responsive viewport offsets
✅ **Version Display**: Dynamic version showing in panel title
✅ **Progress Feedback**: Real-time status updates and file counters
✅ **Error Handling**: Comprehensive error messages and recovery

## 🧪 Testing

### Vietnamese Filename Test Suite
The extension includes `vietnamese_filename_test.html` for testing:
- Vietnamese character preservation
- UI element removal accuracy
- Complex filename handling
- Unicode diacritic support

### Test Cases Covered
- Mixed Vietnamese and English text
- Complex UI prefix removal
- Number and special character handling
- Short and long filename processing

## 🔍 Troubleshooting

### Common Issues

**Downloads not starting**
- Refresh Google Drive page and try again
- Check console for error messages (F12)
- Ensure PDF files are accessible

**Vietnamese filenames corrupted**
- Extension now fully supports Vietnamese characters
- If issues persist, check console logs for filename processing details

**Extension not visible**
- Look for floating 📄 button in top-right corner
- Ensure extension is enabled in `chrome://extensions/`
- Refresh Google Drive page

### Advanced Debugging

**Console Logging**: Extension provides detailed logs:
```javascript
🔍 cleanupFileName input: [filename]
📝 Text up to .pdf: [processed text]
🧹 Removed UI prefix: [prefix]
✅ Final filename: [result]
```

**Cache Monitoring**:
```javascript
🗑️ Clearing blob image cache...
🔍 Found [X] blob images to clear
✅ Successfully cleared [X] blob images
```

## 📈 Performance

### Optimizations
- **Efficient OCR scanning** with targeted element selection
- **Background processing** doesn't interrupt user workflow
- **Memory management** with proper cache clearing
- **Error recovery** with automatic retry mechanisms

### Benchmarks
- **Single file**: ~2-5 seconds per PDF
- **Bulk download**: ~5-10 seconds per file (depending on size)
- **Memory usage**: Optimized with multi-pass cache clearing

## 🚀 Version History

### v1.0.0 (Current)
- ✅ Vietnamese filename support with full Unicode handling
- ✅ Enhanced file identifier system preventing contamination
- ✅ Multi-pass blob cache clearing
- ✅ Unique element identification for bulk downloads
- ✅ Dynamic version display in panel
- ✅ Top-right corner positioning with viewport offsets
- ✅ Comprehensive error handling and logging
- ✅ CSP compliance with local library bundling
- ✅ Background tab processing
- ✅ OCR-based file detection

## 📄 License

MIT License - Feel free to modify and distribute
