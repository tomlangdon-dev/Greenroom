from flask import Flask, render_template
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
VIDEO_DIR = os.path.join(UPLOAD_DIR, "videos")
PPTX_DIR = os.path.join(UPLOAD_DIR, "pptx")

os.makedirs(VIDEO_DIR, exist_ok=True)
os.makedirs(PPTX_DIR, exist_ok=True)

@app.route("/")
def index():
    return render_template("index.html")
