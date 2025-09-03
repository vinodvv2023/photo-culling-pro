// PhotoCull Pro - Main JavaScript Application
class PhotoCullingApp {
    constructor() {
        this.images = [];
        this.filteredImages = [];
        this.currentImageId = null;
        this.compareImages = [];
        this.currentView = 'grid';
        this.thumbnailSize = 250;
        this.processing = false;
        
        this.filters = {
            rating: 'all',
            label: 'all',
            focusThreshold: 0,
            exposureThreshold: 0
        };
        
        this.sortBy = 'filename';
        this.selectedImages = new Set();
        
        this.initializeEventListeners();
        this.loadImages();
        this.showShortcuts();
    }
    
    initializeEventListeners() {
        // File upload
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('select-files').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        document.getElementById('load-sample').addEventListener('click', () => this.loadSampleImages());
        
        // Drag and drop
        this.setupDragAndDrop();
        
        // Filters and sorting
        document.getElementById('sort-select').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.applyFiltersAndSort();
        });
        
        document.getElementById('rating-filter').addEventListener('change', (e) => {
            this.filters.rating = e.target.value;
            this.applyFiltersAndSort();
        });
        
        document.getElementById('label-filter').addEventListener('change', (e) => {
            this.filters.label = e.target.value;
            this.applyFiltersAndSort();
        });
        
        // Thresholds
        document.getElementById('focus-threshold').addEventListener('input', (e) => {
            this.filters.focusThreshold = parseInt(e.target.value);
            document.getElementById('focus-threshold-value').textContent = e.target.value;
            this.applyFiltersAndSort();
        });
        
        document.getElementById('exposure-threshold').addEventListener('input', (e) => {
            this.filters.exposureThreshold = parseInt(e.target.value);
            document.getElementById('exposure-threshold-value').textContent = e.target.value;
            this.applyFiltersAndSort();
        });
        
        // View controls
        document.getElementById('grid-view').addEventListener('click', () => this.setView('grid'));
        document.getElementById('compare-view').addEventListener('click', () => this.setView('compare'));
        
        document.getElementById('thumbnail-size').addEventListener('input', (e) => {
            this.thumbnailSize = parseInt(e.target.value);
            this.updateThumbnailSize();
        });
        
        // Batch actions
        document.getElementById('select-all').addEventListener('click', () => this.batchAction('select'));
        document.getElementById('reject-all').addEventListener('click', () => this.batchAction('reject'));
        document.getElementById('clear-all').addEventListener('click', () => this.batchAction('clear'));
        
        // Export
        document.getElementById('export-btn').addEventListener('click', () => this.showExportModal());
        document.getElementById('confirm-export').addEventListener('click', () => this.exportImages());
        
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        
        // Modal controls
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Rating buttons in modal
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rating = parseInt(e.target.getAttribute('data-rating'));
                this.updateImageRating(this.currentImageId, rating);
            });
        });
        
        // Label buttons in modal
        document.querySelectorAll('.label-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const label = e.target.getAttribute('data-label');
                this.updateImageLabel(this.currentImageId, label);
            });
        });
    }
    
    setupDragAndDrop() {
        const uploadArea = document.getElementById('upload-area');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('drag-over');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('drag-over');
            });
        });
        
        uploadArea.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files);
            this.uploadFiles(files);
        });

        // Add drag and drop for compare view
        const compareLeft = document.getElementById('compare-left');
        const compareRight = document.getElementById('compare-right');

        [compareLeft, compareRight].forEach(el => {
            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                el.classList.add('drag-over');
            });

            el.addEventListener('dragleave', (e) => {
                e.preventDefault();
                el.classList.remove('drag-over');
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.classList.remove('drag-over');
                const imageId = e.dataTransfer.getData('text/plain');
                this.renderCompareImage(parseInt(imageId), el.id);
            });
        });
    }
    
    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        await this.uploadFiles(files);
    }
    
    async uploadFiles(files) {
        if (this.processing) return;
        
        this.processing = true;
        this.showProcessingStatus(true);
        
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });
        
        console.log('Starting upload for', files.length, 'files.');

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            console.log('Received response from /api/upload');
            const result = await response.json();
            console.log('Parsed JSON response:', result);
            
            if (result.success) {
                if (result.images && result.images.length > 0) {
                    console.log('Before unshift:', this.images.length, 'images.');
                    this.images.unshift(...result.images);
                    console.log('After unshift:', this.images.length, 'images.');
                    this.applyFiltersAndSort();
                }
                if (result.processed_count > 0) {
                    this.showNotification(`Successfully processed ${result.processed_count} images`, 'success');
                }
                if (result.errors && result.errors.length > 0) {
                    let errorMsg = `Failed to process ${result.errors.length} images.`;
                    console.error('Server-side processing errors:', result.errors);
                    this.showNotification(errorMsg, 'error');
                }
            } else {
                console.error('Upload API call was not successful:', result);
                this.showNotification('Error uploading files', 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showNotification('Error uploading files', 'error');
        } finally {
            this.processing = false;
            this.showProcessingStatus(false);
        }
    }
    
    async loadImages() {
        try {
            const response = await fetch('/api/images');
            this.images = await response.json();
            this.applyFiltersAndSort();
        } catch (error) {
            console.error('Error loading images:', error);
        }
    }
    
    loadSampleImages() {
        // Create sample images for demonstration
        const sampleImages = [
            {
                id: 1,
                filename: 'sample_portrait_1.jpg',
                focus_score: 85,
                exposure_score: 92,
                quality_score: 88,
                face_count: 1,
                eyes_open: true,
                rating: 0,
                label: 'none',
                analysis_data: {
                    focus_score: 85,
                    exposure_analysis: { exposure_score: 92 },
                    face_analysis: { face_count: 1, faces_detected: true },
                    image_dimensions: { width: 1920, height: 1080 }
                }
            },
            {
                id: 2,
                filename: 'sample_landscape_1.jpg',
                focus_score: 45,
                exposure_score: 78,
                quality_score: 62,
                face_count: 0,
                eyes_open: false,
                rating: 0,
                label: 'none',
                analysis_data: {
                    focus_score: 45,
                    exposure_analysis: { exposure_score: 78 },
                    face_analysis: { face_count: 0, faces_detected: false },
                    image_dimensions: { width: 1920, height: 1080 }
                }
            },
            {
                id: 3,
                filename: 'sample_portrait_2.jpg',
                focus_score: 92,
                exposure_score: 88,
                quality_score: 90,
                face_count: 2,
                eyes_open: true,
                rating: 0,
                label: 'none',
                analysis_data: {
                    focus_score: 92,
                    exposure_analysis: { exposure_score: 88 },
                    face_analysis: { face_count: 2, faces_detected: true },
                    image_dimensions: { width: 1920, height: 1080 }
                }
            }
        ];
        
        this.images = sampleImages;
        this.applyFiltersAndSort();
        this.showNotification('Sample images loaded for demonstration', 'info');
    }
    
    applyFiltersAndSort() {
        let filtered = [...this.images];
        
        // Apply rating filter
        if (this.filters.rating !== 'all') {
            const rating = parseInt(this.filters.rating);
            filtered = filtered.filter(img => img.rating === rating);
        }
        
        // Apply label filter
        if (this.filters.label !== 'all') {
            filtered = filtered.filter(img => img.label === this.filters.label);
        }
        
        // Apply quality thresholds
        filtered = filtered.filter(img => {
            const focusOk = (img.focus_score || 0) >= this.filters.focusThreshold;
            const exposureOk = (img.exposure_score || 0) >= this.filters.exposureThreshold;
            return focusOk && exposureOk;
        });
        
        // Sort images
        filtered.sort((a, b) => {
            switch (this.sortBy) {
                case 'rating':
                    return (b.rating || 0) - (a.rating || 0);
                case 'quality_score':
                    return (b.quality_score || 0) - (a.quality_score || 0);
                case 'focus_score':
                    return (b.focus_score || 0) - (a.focus_score || 0);
                case 'upload_timestamp':
                    return new Date(b.upload_timestamp || 0) - new Date(a.upload_timestamp || 0);
                default: // filename
                    return (a.filename || '').localeCompare(b.filename || '');
            }
        });
        
        this.filteredImages = filtered;
        this.renderImages();
        this.updateStats();
    }
    
    renderImages() {
        const container = document.getElementById('image-grid');
        const welcomeMessage = document.getElementById('welcome-message');

        if (this.filteredImages.length === 0 && this.images.length === 0) {
            container.style.display = 'none';
            welcomeMessage.style.display = 'block';
        } else {
            container.style.display = 'grid';
            welcomeMessage.style.display = 'none';
        }

        container.innerHTML = ''; // Clear previous images
        
        this.filteredImages.forEach(image => {
            const card = this.createImageCard(image);
            container.appendChild(card);
        });
    }
    
    createImageCard(image) {
        const card = document.createElement('div');
        card.className = `image-card ${image.label || 'none'}`;
        card.setAttribute('data-image-id', image.id);
        card.setAttribute('draggable', 'true');
        card.style.cursor = 'pointer';
        
        const thumbnailSrc = image.thumbnail_path ? `/thumbnails/${image.thumbnail_path}` : this.generatePlaceholderImage(image);
        
        card.innerHTML = `
            <img src="${thumbnailSrc}" alt="${image.filename}" class="image-thumbnail" style="height: ${this.thumbnailSize}px;">
            <div class="image-overlay">
                <div class="image-info">
                    <div class="text-truncate">${image.filename}</div>
                    <div class="quality-indicators">
                        <span class="quality-badge ${this.getQualityClass(image.focus_score)}">
                            Focus: ${Math.round(image.focus_score || 0)}
                        </span>
                        <span class="quality-badge ${this.getQualityClass(image.exposure_score)}">
                            Exp: ${Math.round(image.exposure_score || 0)}
                        </span>
                        ${image.face_count > 0 ? `<span class="quality-badge quality-good">Faces: ${image.face_count}</span>` : ''}
                    </div>
                </div>
                <div class="image-controls">
                    <div class="rating-stars">
                        ${this.generateStars(image.rating || 0)}
                    </div>
                    <div class="control-buttons">
                        <button class="control-btn select-btn" onclick="app.quickSelect(event, ${image.id})">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="control-btn reject-btn" onclick="app.quickReject(event, ${image.id})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', image.id);
        });

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.control-btn')) {
                this.showImageModal(image);
            }
        });
        
        return card;
    }
    
    generatePlaceholderImage(image) {
        // Generate a colored placeholder based on image properties
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        // Choose color based on quality
        const quality = image.quality_score || 0;
        let color;
        if (quality > 80) color = '#198754'; // green
        else if (quality > 60) color = '#ffc107'; // yellow
        else color = '#dc3545'; // red
        
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 300, 200);
        
        // Add text
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(image.filename, 150, 90);
        ctx.fillText(`Quality: ${Math.round(quality)}`, 150, 110);
        ctx.fillText(`Focus: ${Math.round(image.focus_score || 0)}`, 150, 130);
        
        return canvas.toDataURL();
    }
    
    getQualityClass(score) {
        if (!score) return 'quality-poor';
        if (score > 80) return 'quality-good';
        if (score > 60) return 'quality-medium';
        return 'quality-poor';
    }
    
    generateStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += `<span class="star ${i <= rating ? '' : 'empty'}">★</span>`;
        }
        return stars;
    }
    
    showImageModal(image) {
        this.currentImageId = image.id;
        const modalElement = document.getElementById('imageModal');
        const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
        
        // Populate modal
        document.getElementById('modal-filename').textContent = image.filename;
        document.getElementById('modal-image').src = image.filename ? `/images/${image.filename}` : this.generatePlaceholderImage(image);
        
        this.updateModalUI(image);
        
        // Populate analysis results
        this.populateAnalysisResults(image);
        
        modal.show();
    }

    updateModalUI(image) {
        // Update rating buttons
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.getAttribute('data-rating')) === (image.rating || 0));
        });
        
        // Update label buttons
        document.querySelectorAll('.label-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-label') === (image.label || 'none'));
        });
    }
    
    populateAnalysisResults(image) {
        const container = document.getElementById('analysis-results');
        const analysis = image.analysis_data || {};
        
        container.innerHTML = `
            <div class="analysis-metric">
                <span>Focus Score:</span>
                <span class="metric-value ${this.getQualityClass(image.focus_score)}">${Math.round(image.focus_score || 0)}/100</span>
            </div>
            <div class="analysis-metric">
                <span>Exposure Score:</span>
                <span class="metric-value ${this.getQualityClass(image.exposure_score)}">${Math.round(image.exposure_score || 0)}/100</span>
            </div>
            <div class="analysis-metric">
                <span>Quality Score:</span>
                <span class="metric-value ${this.getQualityClass(image.quality_score)}">${Math.round(image.quality_score || 0)}/100</span>
            </div>
            <div class="analysis-metric">
                <span>Faces Detected:</span>
                <span class="metric-value">${image.face_count || 0}</span>
            </div>
            <div class="analysis-metric">
                <span>Eyes Open:</span>
                <span class="metric-value ${image.eyes_open ? 'metric-good' : 'metric-poor'}">${image.eyes_open ? 'Yes' : 'No'}</span>
            </div>
            <div class="analysis-metric">
                <span>Dimensions:</span>
                <span class="metric-value">${analysis.image_dimensions?.width || 0} × ${analysis.image_dimensions?.height || 0}</span>
            </div>
        `;
    }
    
    async updateImageRating(imageId, rating) {
        try {
            const response = await fetch(`/api/images/${imageId}/rating`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rating, label: this.images.find(img => img.id === imageId).label })
            });
            
            if (response.ok) {
                // Update local data
                const image = this.images.find(img => img.id === imageId);
                if (image) {
                    image.rating = rating;
                    this.applyFiltersAndSort();
                    if (this.currentImageId === imageId) {
                        this.updateModalUI(image);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating rating:', error);
        }
    }
    
    async updateImageLabel(imageId, label) {
        try {
            const response = await fetch(`/api/images/${imageId}/rating`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rating: this.images.find(img => img.id === imageId).rating, label })
            });
            
            if (response.ok) {
                // Update local data
                const image = this.images.find(img => img.id === imageId);
                if (image) {
                    image.label = label;
                    this.applyFiltersAndSort();
                    if (this.currentImageId === imageId) {
                        this.updateModalUI(image);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating label:', error);
        }
    }
    
    quickSelect(event, imageId) {
        event.stopPropagation();
        this.updateImageLabel(imageId, 'selected');
    }
    
    quickReject(event, imageId) {
        event.stopPropagation();
        this.updateImageLabel(imageId, 'rejected');
    }
    
    batchAction(action) {
        this.filteredImages.forEach(image => {
            switch (action) {
                case 'select':
                    this.updateImageLabel(image.id, 'selected');
                    break;
                case 'reject':
                    this.updateImageLabel(image.id, 'rejected');
                    break;
                case 'clear':
                    this.updateImageRating(image.id, 0);
                    this.updateImageLabel(image.id, 'none');
                    break;
            }
        });
    }
    
    setView(view) {
        this.currentView = view;
        
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-view') === view);
        });
        
        if (view === 'grid') {
            document.getElementById('image-grid').style.display = 'grid';
            document.getElementById('compare-container').style.display = 'none';
        } else {
            document.getElementById('image-grid').style.display = 'none';
            document.getElementById('compare-container').style.display = 'block';
        }
    }
    
    updateThumbnailSize() {
        document.querySelectorAll('.image-thumbnail').forEach(img => {
            img.style.height = this.thumbnailSize + 'px';
        });
        
        const grid = document.getElementById('image-grid');
        const minWidth = Math.max(150, this.thumbnailSize - 50);
        grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${minWidth}px, 1fr))`;
    }
    
    renderCompareImage(imageId, panelId) {
        const image = this.images.find(img => img.id === imageId);
        if (!image) return;

        const panel = document.getElementById(panelId);
        if (!panel) return;

        const imageSrc = image.filename ? `/images/${image.filename}` : this.generatePlaceholderImage(image);

        panel.innerHTML = `
            <div class="compare-image-container">
                <img src="${imageSrc}" alt="${image.filename}" class="img-fluid">
                <div class="compare-image-details p-2">
                    <h6>${image.filename}</h6>
                    <div class="analysis-metric">
                        <span>Focus:</span>
                        <span class="metric-value ${this.getQualityClass(image.focus_score)}">${Math.round(image.focus_score || 0)}</span>
                    </div>
                    <div class="analysis-metric">
                        <span>Exposure:</span>
                        <span class="metric-value ${this.getQualityClass(image.exposure_score)}">${Math.round(image.exposure_score || 0)}</span>
                    </div>
                    <div class="analysis-metric">
                        <span>Quality:</span>
                        <span class="metric-value ${this.getQualityClass(image.quality_score)}">${Math.round(image.quality_score || 0)}</span>
                    </div>
                </div>
            </div>
        `;
    }
    updateStats() {
        const totalCount = this.images.length;
        const selectedCount = this.images.filter(img => img.label === 'selected').length;
        const rejectedCount = this.images.filter(img => img.label === 'rejected').length;
        
        document.getElementById('total-count').textContent = totalCount;
        document.getElementById('selected-count').textContent = selectedCount;
        document.getElementById('rejected-count').textContent = rejectedCount;
    }
    
    showExportModal() {
        const selectedImages = this.images.filter(img => img.label === 'selected');
        if (selectedImages.length === 0) {
            this.showNotification('No images selected for export', 'warning');
            return;
        }
        
        const modal = new bootstrap.Modal(document.getElementById('exportModal'));
        modal.show();
    }
    
    async exportImages() {
        const selectedImages = this.images.filter(img => img.label === 'selected');
        const exportType = document.querySelector('input[name="exportType"]:checked').value;
        
        try {
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: exportType,
                    selected_ids: selectedImages.map(img => img.id)
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`Successfully exported ${result.exported_files} files`, 'success');
                bootstrap.Modal.getInstance(document.getElementById('exportModal')).hide();
            } else {
                this.showNotification('Export failed', 'error');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Export failed', 'error');
        }
    }
    
    toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const icon = document.querySelector('#theme-toggle i');
        icon.classList.toggle('fa-moon');
        icon.classList.toggle('fa-sun');
    }
    
    showProcessingStatus(show) {
        const status = document.getElementById('processing-status');
        status.style.display = show ? 'block' : 'none';
    }
    
    showShortcuts() {
        const shortcuts = document.getElementById('shortcuts-help');
        shortcuts.classList.add('show');
        
        setTimeout(() => {
            shortcuts.classList.remove('show');
        }, 5000);
    }
    
    handleKeyboard(event) {
        // Only handle keyboard shortcuts when not in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (event.key) {
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                if (this.currentImageId) {
                    this.updateImageRating(this.currentImageId, parseInt(event.key));
                }
                break;
            case 'g':
            case 'G':
                if (this.currentImageId) {
                    this.updateImageLabel(this.currentImageId, 'selected');
                }
                break;
            case 'r':
            case 'R':
                if (this.currentImageId) {
                    this.updateImageLabel(this.currentImageId, 'rejected');
                }
                break;
            case 'y':
            case 'Y':
                if (this.currentImageId) {
                    this.updateImageLabel(this.currentImageId, 'review');
                }
                break;
            case 'Escape':
                const modal = bootstrap.Modal.getInstance(document.getElementById('imageModal'));
                if (modal) modal.hide();
                break;
        }
    }
    
    showNotification(message, type = 'info') {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PhotoCullingApp();
});
