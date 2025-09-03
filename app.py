import os
import cv2
import numpy as np
import json
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from PIL import Image, ExifTags
import hashlib
from datetime import datetime
import sqlite3
import threading
from pathlib import Path
import imagehash
import pyiqa
import torch
from skimage.measure import shannon_entropy
from concurrent.futures import ThreadPoolExecutor
import zipfile
import shutil
import json
import logging
import io
import csv
from flask import Response

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
app.logger.setLevel(logging.INFO)

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

app.json_encoder = NumpyEncoder

app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['THUMBNAILS_FOLDER'] = 'thumbnails'
app.config['EXPORTS_FOLDER'] = 'exports'
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Create necessary directories
for folder in [app.config['UPLOAD_FOLDER'], app.config['THUMBNAILS_FOLDER'], app.config['EXPORTS_FOLDER']]:
    os.makedirs(folder, exist_ok=True)

# Initialize IQA models
try:
    brisque_model = pyiqa.create_metric('brisque')
    niqe_model = pyiqa.create_metric('niqe')
    piqe_model = pyiqa.create_metric('piqe')
except Exception as e:
    app.logger.warning(f"Could not initialize PyIQA models: {e}. Using fallback quality metrics.")
    brisque_model = None
    niqe_model = None
    piqe_model = None

# Initialize face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

class ImageAnalyzer:
    @staticmethod
    def focus_measure_laplacian(img):
        if len(img.shape) > 2:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        return laplacian.var()
    
    @staticmethod
    def focus_measure_tenengrad(img):
        if len(img.shape) > 2:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        magnitude = np.sqrt(sobelx**2 + sobely**2)
        return np.mean(magnitude)
    
    @staticmethod
    def exposure_analysis(img):
        if len(img.shape) > 2:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img
        
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        total_pixels = np.sum(hist)
        
        overexposed = np.sum(hist[-10:]) / total_pixels
        underexposed = np.sum(hist[:10]) / total_pixels
        
        exposure_score = 100 - (overexposed * 100 + underexposed * 100)
        exposure_score = max(0, min(100, exposure_score))
        
        return {
            'exposure_score': exposure_score,
            'overexposed_percent': overexposed * 100,
            'underexposed_percent': underexposed * 100,
            'is_overexposed': bool(overexposed > 0.02),
            'is_underexposed': bool(underexposed > 0.02)
        }
    
    @staticmethod
    def analyze_faces(img):
        if len(img.shape) > 2:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img
            
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        face_analysis = {
            'face_count': len(faces),
            'faces_detected': len(faces) > 0,
            'face_details': []
        }
        
        for (x, y, w, h) in faces:
            face_roi = gray[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(face_roi, 1.1, 5)
            
            eyes_open = len(eyes) >= 2
            
            face_detail = {
                'position': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                'eyes_detected': len(eyes),
                'eyes_likely_open': bool(eyes_open),
                'face_size_ratio': (w * h) / (img.shape[0] * img.shape[1])
            }
            face_analysis['face_details'].append(face_detail)
        
        return face_analysis
    
    @staticmethod
    def comprehensive_analysis(image_path):
        try:
            img = cv2.imread(image_path)
            if img is None:
                app.logger.error(f"Failed to read image: {image_path}")
                return None
            
            focus_score = ImageAnalyzer.focus_measure_laplacian(img)
            tenengrad_score = ImageAnalyzer.focus_measure_tenengrad(img)
            exposure = ImageAnalyzer.exposure_analysis(img)
            face_analysis = ImageAnalyzer.analyze_faces(img)
            
            # Generate perceptual hash
            pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            phash = str(imagehash.dhash(pil_img))
            
            # Calculate overall quality score
            quality_score = min(100, focus_score / 2000 * 100)
            
            return {
                'focus_score': round(focus_score / 20, 2),  # Normalize to 0-100
                'tenengrad_score': round(tenengrad_score, 2),
                'exposure_analysis': exposure,
                'face_analysis': face_analysis,
                'quality_score': round(quality_score, 2),
                'perceptual_hash': phash,
                'image_dimensions': {'width': img.shape[1], 'height': img.shape[0]},
                'file_size': os.path.getsize(image_path)
            }
            
        except Exception as e:
            app.logger.error(f"Error analyzing {image_path}: {str(e)}")
            return None

class DatabaseManager:
    def __init__(self, db_path='culling_session.db'):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                original_filename TEXT,
                filepath TEXT NOT NULL,
                thumbnail_path TEXT,
                upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                rating INTEGER DEFAULT 0,
                label TEXT DEFAULT 'none',
                focus_score REAL,
                exposure_score REAL,
                quality_score REAL,
                face_count INTEGER,
                eyes_open BOOLEAN,
                perceptual_hash TEXT,
                analysis_data TEXT,
                processed BOOLEAN DEFAULT FALSE
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def add_image(self, image_data):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO images (filename, original_filename, filepath, thumbnail_path, rating, label,
                              focus_score, exposure_score, quality_score, face_count,
                              eyes_open, perceptual_hash, analysis_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            image_data['filename'],
            image_data.get('original_filename'),
            image_data['filepath'],
            image_data.get('thumbnail_path'),
            image_data.get('rating', 0),
            image_data.get('label', 'none'),
            image_data.get('focus_score'),
            image_data.get('exposure_score'),
            image_data.get('quality_score'),
            image_data.get('face_count'),
            image_data.get('eyes_open'),
            image_data.get('perceptual_hash'),
            json.dumps(image_data.get('analysis_data', {}), cls=NumpyEncoder)
        ))
        
        image_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return image_id
    
    def get_all_images(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM images ORDER BY upload_timestamp DESC')
        images = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return images
    
    def update_image_rating(self, image_id, rating, label=None):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if label:
            cursor.execute('UPDATE images SET rating = ?, label = ? WHERE id = ?',
                          (rating, label, image_id))
        else:
            cursor.execute('UPDATE images SET rating = ? WHERE id = ?',
                          (rating, image_id))
        
        conn.commit()
        conn.close()

# Initialize database
db = DatabaseManager()

def generate_thumbnail(image_path, thumbnail_path, size=(300, 300)):
    try:
        with Image.open(image_path) as img:
            img.thumbnail(size, Image.Resampling.LANCZOS)
            if img.mode in ('RGBA', 'LA'):
                # Convert to RGB and fill transparency with white
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1])
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            img.save(thumbnail_path, 'JPEG', quality=85)
        return True
    except Exception as e:
        app.logger.error(f"Error generating thumbnail for {image_path}: {str(e)}")
        return False


def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_image(filepath, filename, original_filename):
    try:
        # Generate thumbnail
        thumbnail_filename = f"thumb_{filename}"
        thumbnail_full_path = os.path.join(app.config['THUMBNAILS_FOLDER'], thumbnail_filename)
        if not generate_thumbnail(filepath, thumbnail_full_path):
            return {'error': 'Failed to generate thumbnail.'}
        
        # Perform analysis
        analysis = ImageAnalyzer.comprehensive_analysis(filepath)
        if not analysis:
            return {'error': 'Failed to analyze image.'}
        
        # Prepare image data
        image_data = {
            'filename': filename,
            'original_filename': original_filename,
            'filepath': filepath,
            'thumbnail_path': thumbnail_filename,
            'focus_score': analysis['focus_score'],
            'exposure_score': analysis['exposure_analysis']['exposure_score'],
            'quality_score': analysis['quality_score'],
            'face_count': analysis['face_analysis']['face_count'],
            'eyes_open': bool(any(f['eyes_likely_open'] for f in analysis['face_analysis']['face_details'])),
            'perceptual_hash': analysis['perceptual_hash'],
            'analysis_data': analysis
        }
        
        # Add to database
        image_id = db.add_image(image_data)
        image_data['id'] = image_id
        
        return image_data
        
    except Exception as e:
        app.logger.error(f"Error processing {filepath}: {str(e)}")
        return {'error': 'A server error occurred during processing.'}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_files():
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400
    
    files = request.files.getlist('files')
    results = []
    errors = []
    
    for file in files:
        if file.filename == '':
            continue
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_filename = f"{timestamp}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            file.save(filepath)
            
            result = process_image(filepath, unique_filename, filename)
            if result and 'error' not in result:
                results.append(result)
            else:
                error_message = result.get('error', 'Failed to process image.') if result else 'Failed to process image.'
                errors.append({'filename': filename, 'error': error_message})
        else:
            errors.append({'filename': file.filename, 'error': 'File type not allowed.'})

    return jsonify({
        'success': True,
        'processed_count': len(results),
        'images': results,
        'errors': errors
    })

@app.route('/api/images')
def get_images():
    images = db.get_all_images()
    
    for img in images:
        img['analysis_data'] = json.loads(img.get('analysis_data', '{}'))
    
    return jsonify(images)

@app.route('/api/images/<int:image_id>/rating', methods=['POST'])
def update_rating(image_id):
    data = request.get_json()
    rating = data.get('rating', 0)
    label = data.get('label', 'none')
    
    db.update_image_rating(image_id, rating, label)
    
    return jsonify({'success': True})

@app.route('/thumbnails/<filename>')
def serve_thumbnail(filename):
    return send_from_directory(app.config['THUMBNAILS_FOLDER'], filename)

@app.route('/images/<filename>')
def serve_image(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/export', methods=['POST'])
def export_csv():
    data = request.get_json()
    image_ids = data.get('image_ids', [])

    if not image_ids:
        return jsonify({'error': 'No image IDs provided'}), 400

    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()

    query = f"SELECT original_filename FROM images WHERE id IN ({','.join('?' for _ in image_ids)})"
    cursor.execute(query, image_ids)

    filenames = [row[0] for row in cursor.fetchall()]
    conn.close()

    # Generate CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['original_filename'])
    for filename in filenames:
        writer.writerow([filename])

    output.seek(0)

    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=export.csv"}
    )

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
