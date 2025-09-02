# PhotoCull Pro - Professional Photo Culling Application

A comprehensive web-based photo culling solution with AI-powered image quality analysis, face detection, duplicate detection, and professional workflow features.

## Features

### Core Capabilities
- **Intelligent Image Analysis**: Focus detection, exposure analysis, quality scoring using BRISQUE/NIQE/PIQE
- **Face Detection & Analysis**: Detect faces, eye status, and basic emotion indicators
- **Duplicate Detection**: Perceptual hashing to identify similar and duplicate images
- **Professional Workflow**: Rating system, color labels, batch operations, keyboard shortcuts
- **Export & Integration**: Organized file export, metadata CSV generation, selection management

### Technical Features
- **Real-time Processing**: Multi-threaded batch image analysis
- **Responsive Interface**: Modern Bootstrap-based UI with dark/light themes
- **Keyboard Shortcuts**: Professional-grade hotkeys for rapid culling
- **Session Management**: SQLite database for persistent sessions
- **Thumbnail Generation**: Efficient preview system with caching

## Quick Start

### Prerequisites
- Python 3.8 or higher
- OpenCV compatible system
- At least 4GB RAM (8GB recommended for large batches)

### Installation

1. **Clone or Download Project Files**:
```bash
git clone <repository-url>
cd photo-culling-pro
```

2. **Create Virtual Environment**:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install Dependencies**:
```bash
pip install -r requirements.txt
```

4. **Run the Application**:
```bash
python app.py
```

5. **Access the Web Interface**:
   - Open your browser to `http://localhost:5000`
   - Upload photos or load sample images to begin

## Usage Guide

### Getting Started

1. **Upload Photos**:
   - Drag and drop image files onto the upload area
   - Or click "Select Files" to browse
   - Supported formats: JPEG, PNG, TIFF, BMP, WebP

2. **Automatic Analysis**:
   - Images are automatically analyzed for:
     - Focus and sharpness (Laplacian, Tenengrad methods)
     - Exposure quality (over/under-exposure detection)
     - Face detection and eye status
     - Overall quality scoring
     - Duplicate detection via perceptual hashing

3. **Review and Cull**:
   - Use the grid view to see all images with quality indicators
   - Click images to open detailed preview modal
   - Rate images 1-5 stars
   - Apply color labels: Green (Select), Red (Reject), Yellow (Review)

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-5` | Rate current image (1-5 stars) |
| `G` | Mark as Selected (Green) |
| `R` | Mark as Rejected (Red) |
| `Y` | Mark for Review (Yellow) |
| `Space` | Open image preview |
| `Esc` | Close modal |
| `←/→` | Navigate between images |

### Professional Workflow

1. **Import Session**: Upload all photos from a shoot
2. **Auto-Analysis**: Let the system analyze all images for technical quality
3. **First Pass**: Use batch tools to reject obvious technical failures
4. **Detailed Review**: Use rating system and labels for final selection
5. **Export**: Export selected images with metadata report

### Advanced Features

#### Quality Thresholds
- Set minimum focus and exposure scores
- Filter images below quality thresholds
- Ideal for pre-filtering large batches

#### Duplicate Detection
- Automatically groups similar images
- Helps identify best shots in burst sequences
- Customizable similarity sensitivity

#### Batch Operations
- Select All Visible
- Reject All Visible  
- Clear All Ratings
- Export filtered selections

#### Compare Mode
- Side-by-side comparison of similar images
- Essential for choosing best shots from sequences
- Quick switching between comparison pairs

## Architecture

### Backend (Flask)
- **Image Processing**: OpenCV, PIL, scikit-image for analysis
- **AI Models**: PyIQA for quality metrics, Haar cascades for faces
- **Database**: SQLite for session persistence
- **API**: RESTful endpoints for frontend communication

### Frontend (JavaScript/Bootstrap)
- **Responsive Design**: Works on desktop, tablet, mobile
- **Real-time Updates**: AJAX communication with backend
- **Professional UI**: Grid views, modals, keyboard navigation
- **Performance**: Efficient thumbnail loading and caching

### File Structure
```
photo-culling-pro/
├── app.py                 # Main Flask application
├── config.py              # Configuration settings
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── style.css         # Custom CSS styles
│   └── app.js            # JavaScript application
├── uploads/              # Uploaded images (created automatically)
├── thumbnails/           # Generated thumbnails (created automatically)
├── exports/              # Export destination (created automatically)
└── README.md            # This file
```

## Image Analysis Details

### Focus Detection
- **Laplacian Variance**: Measures edge sharpness
- **Tenengrad**: Sobel gradient magnitude analysis  
- **Brenner**: Directional gradient measurement
- **Combined Score**: Weighted combination of all methods

### Exposure Analysis
- **Histogram Analysis**: Identifies clipping at extremes
- **Over-exposure**: Detection of blown highlights
- **Under-exposure**: Detection of blocked shadows
- **Balance Score**: Overall exposure quality metric

### Face Detection
- **OpenCV Haar Cascades**: Real-time face detection
- **Eye Detection**: Basic open/closed eye analysis
- **Face Quality**: Size, position, and clarity scoring
- **Multiple Faces**: Handles group photos and portraits

### Quality Scoring
- **BRISQUE**: No-reference image quality assessment
- **NIQE**: Natural image quality evaluator
- **PIQE**: Patch-based image quality evaluator
- **Fallback Methods**: Custom quality metrics when AI models unavailable

## Performance Optimization

### For Large Batches (1000+ Images)
- Increase `MAX_WORKERS` in config for faster processing
- Use SSD storage for uploads and thumbnails folders
- Close other applications to free RAM
- Process in smaller batches if memory limited

### Hardware Recommendations
- **Minimum**: 4GB RAM, 2-core CPU, 1GB free storage
- **Recommended**: 8GB+ RAM, 4+ core CPU, SSD storage
- **Professional**: 16GB+ RAM, 8+ core CPU, dedicated GPU

## Troubleshooting

### Common Issues

**"Module not found" errors**:
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt` again

**Images not processing**:
- Check file formats are supported
- Ensure sufficient disk space
- Check console for error messages

**Slow performance**:
- Reduce batch size in uploads
- Close other applications
- Check available RAM and storage

**Thumbnails not loading**:
- Check file permissions in thumbnails folder
- Verify images uploaded successfully
- Restart application

### Support

For technical issues:
1. Check the browser console for JavaScript errors
2. Check the Flask console for Python errors
3. Verify all dependencies are installed correctly
4. Ensure sufficient system resources available

## Professional vs Enterprise Features

### Included (Professional Level)
✅ Technical quality analysis (focus, exposure, noise)  
✅ Face detection and basic eye analysis  
✅ Duplicate detection and grouping  
✅ Professional UI with keyboard shortcuts  
✅ Rating and labeling system  
✅ Batch processing and export  
✅ Session management and persistence  
✅ Metadata extraction and reporting  

### Not Included (Enterprise Level)
❌ Advanced emotion detection  
❌ Sophisticated composition analysis  
❌ Scene type recognition (wedding/portrait/landscape)  
❌ Learning from user preferences  
❌ Cloud processing and storage  
❌ Team collaboration features  
❌ Advanced RAW format support  
❌ Lightroom/Capture One integration  

## License

This project is provided as-is for educational and professional use. Modify and distribute according to your needs.

## Contributing

Contributions welcome! Areas for improvement:
- Additional image quality metrics
- Enhanced face detection models
- Performance optimizations
- UI/UX improvements
- Documentation and tutorials

---

**PhotoCull Pro** - Professional photo culling made efficient and intelligent.
