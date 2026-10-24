"""Kids coding app engine (from 3-General.py).

One engine, many apps: every app is a folder (apps/python_adventure/, ...) with app.json (name, texts,
characters, intro video, colours, locks, server), lessons.py (LESSONS_DATA, TOPICS) and its pictures and
videos. Run one with:   python apps/run.py python_adventure
Make the next app with: python apps/new_app.py python_adventure my_next_app --name "My Next App"
"""
from pathlib import Path
import sys
import os
import io
import json
import contextlib
import traceback
import threading

def get_base_dir():
    """The app's folder: inside the .exe when built, else KIDS_APP_DIR (set by run.py), else here."""
    if hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    if os.environ.get("KIDS_APP_DIR"):
        return os.path.abspath(os.environ["KIDS_APP_DIR"])
    return os.path.abspath(".")

def resource_path(relative_path):
    return os.path.join(get_base_dir(), relative_path)

os.chdir(get_base_dir())

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import html
import urllib.request
import urllib.error
import webbrowser
from appconfig import load_config, load_lessons, data_dir
from locks import LessonLocks

CONFIG = load_config(get_base_dir())
APP_ID = CONFIG["id"]
LOGO = CONFIG["logo"]

from PyQt5.QtCore import QProcess, Qt, QUrl, QPropertyAnimation, QEasingCurve, QPoint, QObject, pyqtSlot, pyqtSignal, QTimer, QEvent
from PyQt5.QtGui import QFont, QPixmap, QColor, QIcon, QPainter, QPainterPath
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QLabel, QPushButton, QScrollArea, QFrame, QGraphicsDropShadowEffect, QStackedWidget, QLineEdit, QMessageBox, QSlider, QProgressBar, QToolButton, QMenu, QAction,
    QDialog, QCheckBox, QInputDialog, QGridLayout, QDialogButtonBox
)
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineSettings
from PyQt5.QtMultimedia import QMediaPlayer, QMediaContent
from PyQt5.QtMultimediaWidgets import QVideoWidget


class ClickableSlider(QSlider):
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            if self.orientation() == Qt.Horizontal:
                val = self.minimum() + ((self.maximum() - self.minimum()) * event.x()) / max(self.width(), 1)
            else:
                val = self.minimum() + ((self.maximum() - self.minimum()) * (self.height() - event.y())) / max(self.height(), 1)
            val = max(self.minimum(), min(self.maximum(), int(val)))
            self.setValue(val)
            self.sliderMoved.emit(val)
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if event.buttons() & Qt.LeftButton:
            if self.orientation() == Qt.Horizontal:
                val = self.minimum() + ((self.maximum() - self.minimum()) * event.x()) / max(self.width(), 1)
            else:
                val = self.minimum() + ((self.maximum() - self.minimum()) * (self.height() - event.y())) / max(self.height(), 1)
            val = max(self.minimum(), min(self.maximum(), int(val)))
            self.setValue(val)
            self.sliderMoved.emit(val)
        super().mouseMoveEvent(event)


def make_round_pixmap(image_path, size):
    pix = QPixmap(image_path)
    if pix.isNull():
        return None
    pix = pix.scaled(size, size, Qt.KeepAspectRatio, Qt.SmoothTransformation)
    rounded = QPixmap(size, size)
    rounded.fill(Qt.transparent)
    painter = QPainter(rounded)
    painter.setRenderHint(QPainter.Antialiasing)
    clip_path = QPainterPath()
    clip_path.addEllipse(0, 0, size, size)
    painter.setClipPath(clip_path)
    painter.drawPixmap(0, 0, size, size, pix)
    painter.end()
    return rounded

def close_opencv_windows():
    try:
        import cv2
        cv2.destroyAllWindows()
    except Exception:
        pass

def ensure_tom_image():
    tom_path = resource_path("tom.png")
    if not os.path.exists(tom_path):
        try:
            import numpy as np
            import cv2
            img = np.full((300, 300, 3), (230, 245, 255), dtype=np.uint8)
            cv2.circle(img, (150, 160), 90, (80, 140, 210), -1)
            cv2.ellipse(img, (80, 110), (35, 60), 30, 0, 360, (50, 100, 170), -1)
            cv2.ellipse(img, (220, 110), (35, 60), -30, 0, 360, (50, 100, 170), -1)
            cv2.circle(img, (120, 145), 14, (255, 255, 255), -1)
            cv2.circle(img, (180, 145), 14, (255, 255, 255), -1)
            cv2.circle(img, (122, 145), 7, (20, 20, 20), -1)
            cv2.circle(img, (182, 145), 7, (20, 20, 20), -1)
            cv2.ellipse(img, (150, 180), (18, 12), 0, 0, 360, (20, 20, 20), -1)
            cv2.ellipse(img, (150, 195), (25, 15), 0, 0, 180, (20, 20, 20), 4)
            cv2.ellipse(img, (150, 205), (12, 16), 0, 0, 360, (120, 120, 255), -1)
            cv2.putText(img, "Cute Puppy!", (65, 280), cv2.FONT_HERSHEY_DUPLEX, 0.8, (40, 40, 40), 2)
            cv2.imwrite(tom_path, img)
        except Exception:
            pass

ensure_tom_image()

BASE_CSS = """
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:100%; height:100%; overflow-x:hidden; overflow-y:auto; font-family:'Comic Sans MS', 'Fredoka', cursive, sans-serif; background: transparent; transition:0.5s; }

.sun { 
    position:fixed; 
    top:15px; 
    left:60px; 
    width:90px; 
    height:90px; 
    border-radius:50%; 
    background: radial-gradient(circle, #fff700, #ff8800); 
    box-shadow: 0 0 60px #ffbb00, 0 0 120px rgba(255, 170, 0, 0.8), inset 0 0 20px #ffffff; 
    opacity:1; 
    transition: opacity 0.5s ease-in-out; 
    z-index:9999; 
    pointer-events: none;
}
body.dark-mode .sun { opacity:0; }

.moon { 
    position:fixed; 
    top:15px; 
    left:60px; 
    width:90px; 
    height:90px; 
    border-radius:50%; 
    background: radial-gradient(circle at 30% 30%, #ffffff, #fde68a); 
    box-shadow: 0 0 60px rgba(255,255,255,0.95), 0 0 120px rgba(147, 197, 253, 0.7), inset 0 0 20px #ffffff; 
    opacity:0; 
    transition: opacity 0.5s ease-in-out; 
    z-index:9999; 
    pointer-events: none;
}
body.dark-mode .moon { opacity:1; }

.star { position:fixed; color:white; font-size:20px; z-index:0; opacity:0; display:none !important; text-shadow: 0 0 10px #93c5fd, 0 0 20px white; }
body.dark-mode .star { opacity:1; display:block !important; animation: twinkle 2s infinite; }
.star1 { top:5%; left:25%; } .star2 { top:8%; left:85%; } .star3 { top:78%; left:8%; } .star4 { top:70%; left:90%; } .star5 { top:20%; left:65%; }

@keyframes twinkle { 0%, 100% { opacity:0.3; transform:scale(1); } 50% { opacity:1; transform:scale(1.4); } }

.shooting-star { 
    position:fixed; 
    top:-120px; 
    right:-120px; 
    width:300px; 
    height:4px; 
    transform:rotate(135deg); 
    z-index:9998; 
    pointer-events:none;
    opacity:0; 
}
.shooting-star::before { content:""; position:absolute; right:0; top:-6px; width:18px; height:18px; border-radius:50%; background:white; box-shadow: 0 0 15px white, 0 0 30px #93c5fd, 0 0 45px white; }
.shooting-star::after { content:""; position:absolute; width:300px; height:4px; background: linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,1)); }
body.dark-mode .shooting-star.animate { animation: shootingStarAnim 6s linear 1; }

@keyframes shootingStarAnim { 
    0% { transform: translate(0,0) rotate(135deg); opacity:0; } 
    8% { opacity:1; } 
    88% { transform: translate(-1700px, 1700px) rotate(135deg); opacity:0.9; } 
    100% { transform: translate(-1900px, 1900px) rotate(135deg); opacity:0; } 
}

.header { 
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center; 
    padding-top: 6px; 
    z-index:2; 
    position:relative; 
    width: 100%;
}
h1 { 
    margin: 0 auto; 
    color: #0f172a; 
    font-size: clamp(24px, 3.2vw, 42px); 
    border: none; 
    text-shadow: none; 
    text-align: center;
}
body.dark-mode h1 { color: #ffffff !important; }
.subtitle { 
    margin: 4px auto 0 auto; 
    color: #065f46; 
    font-size: clamp(18px, 2.2vw, 24px); 
    font-weight: bold; 
    border: none; 
    text-shadow: none; 
    text-align: center;
}
body.dark-mode .subtitle { color: #d1fae5; }

.coding-box { width:96%; height:calc(100vh - 120px); min-height: 420px; margin:8px auto 0 auto; display:flex; gap:22px; overflow-y:auto; overflow-x:hidden; z-index:2; position:relative; }

.example-panel { width:40%; height:auto; min-height: 360px; margin-top:10px; border-radius:35px; padding:22px; overflow-y:auto; background: rgba(255, 255, 255, 0.55); backdrop-filter:blur(12px); border: 2px solid rgba(255, 255, 255, 0.7); box-shadow: 0 10px 25px rgba(0,0,0,0.08); position: relative; }
body.dark-mode .example-panel { background: rgba(15, 23, 42, 0.95); border-color: rgba(124, 255, 178, 0.3); box-shadow: 0 12px 30px rgba(0,0,0,0.4), 0 0 20px rgba(124, 255, 178, 0.15); }
.example-title { text-align:center; font-size:26px; color:#0f172a; font-weight:bold; margin-bottom: 16px; }
body.dark-mode .example-title { color:#d1fae5; }

.example-item { margin-bottom: 16px; }
.topic-btn { width:100%; padding:14px 18px; border:none; border-radius:18px; background: #ffffff; font-size:20px; font-weight:bold; cursor:pointer; transition:0.2s; color:#0f172a; text-align:left; box-shadow: 0 4px 12px rgba(0,0,0,0.08); white-space: normal; word-break: break-word; }
body.dark-mode .topic-btn { background: #1e293b; color: #f8fafc; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); }
.topic-btn:hover { background:#38bdf8; color:#ffffff; transform: translateY(-2px); }
body.dark-mode .topic-btn:hover { background:#38bdf8; color:#0f172a; }

.example-box { 
    display:none; 
    margin-top:10px; 
    padding:18px; 
    border-radius:18px; 
    background: rgba(255, 255, 255, 0.98); 
    font-size:32px; 
    font-weight: 700;
    font-style: normal;
    color:#0f172a; 
    line-height: 1.5; 
    border: 3.5px solid #38bdf8; 
    animation: expandDown 0.3s ease-out forwards; 
}
body.dark-mode .example-box { background: #1e293b; color: #f8fafc; border-color: #38bdf8; box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
@keyframes expandDown {
    0% { opacity: 0; transform: translateY(-10px); }
    100% { opacity: 1; transform: translateY(0); }
}

.example-box b { color: #0284c7; font-size: 26px; display: inline-block; margin-top: 4px; font-weight: 800; font-style: normal; }
body.dark-mode .example-box b { color: #38bdf8; }
.example-box span.explanation-text { font-style: normal; font-weight: 700; }
.example-box pre { 
    display:block; 
    background:#0f172a; 
    color:#7CFFB2; 
    padding:14px 18px; 
    border-radius:14px; 
    font-family:monospace; 
    margin-top:10px; 
    font-size:26px; 
    font-weight:bold; 
    font-style: normal;
    white-space: pre-wrap; 
    word-break: break-all; 
    box-shadow: inset 0 3px 12px rgba(0,0,0,0.5);
    border: 2px solid rgba(124, 255, 178, 0.3);
}

.editor-section { 
    flex:1; 
    height:auto; 
    min-height: 360px; 
    margin-top:10px; 
    background: rgba(15, 23, 42, 0.92); 
    border-radius:35px; 
    padding:20px; 
    display:flex; 
    flex-direction:column; 
    overflow-x:hidden; 
    overflow-y:auto; 
    transition:0.3s; 
    box-shadow: 0 12px 30px rgba(0,0,0,0.2), 0 0 20px rgba(124, 255, 178, 0.15); 
    border: 3px solid rgba(124, 255, 178, 0.4); 
    position: relative;
}

textarea { width:100%; height:40%; min-height:150px; max-height:48vh; border:none; outline:none; resize:none; overflow-y:auto; border-radius:20px; padding:16px; background:#0f172a; color:#7CFFB2; font-size:26px; font-family:monospace; }
textarea.error-highlight { border: 3px solid #facc15; box-shadow: 0 0 25px rgba(250, 204, 21, 0.8); }

.run-btn { 
    margin-top:18px; 
    margin-bottom:6px;
    padding:14px; 
    border:none; 
    border-radius:18px; 
    background:#ffd166; 
    font-size:22px; 
    font-weight:bold; 
    cursor:pointer; 
    transition:0.3s; 
    color:#0f172a; 
    animation: buttonGlow 2s infinite alternate;
}
.run-btn:hover { 
    transform:scale(1.03); 
    background:#ffca3a; 
}
@keyframes buttonGlow {
    0% { box-shadow: 0 0 8px rgba(255, 209, 102, 0.6), inset 0 0 5px rgba(255,255,255,0.5); }
    100% { box-shadow: 0 0 25px rgba(255, 209, 102, 1), 0 0 40px rgba(255, 170, 0, 0.8), inset 0 0 10px rgba(255,255,255,0.8); }
}

.output { margin-top:10px; background:#ffffff; border-radius:20px; padding:14px; flex:1; overflow:auto; min-height:120px; white-space:pre-wrap; font-size:22px; color:#1b4332; font-family:monospace; line-height: 1.6; }
body.dark-mode .output { background:#0f172a; color:#86efac; }

.tutorial-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.82);
    border-radius: 35px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 18px;
    z-index: 9999999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.4s ease;
    border: 4px solid #facc15 !important;
}
.tutorial-overlay.show {
    opacity: 1;
    pointer-events: auto;
}
.tom-container {
    position: relative;
    display: inline-block;
}
.tutorial-overlay img {
    width: 240px; 
    height: 280px; 
    object-fit: contain;
    opacity: 0.85;
    border: none !important;
    outline: none !important;
    background: transparent !important;
    box-shadow: none !important;
    animation: bounceCard 1s ease-in-out infinite alternate;
}
.sparkle-star {
    position: absolute;
    font-size: 34px; 
    animation: spinStar 1.5s infinite alternate ease-in-out;
    text-shadow: 0 0 15px #fde047, 0 0 25px white;
    opacity: 0.9;
}
.s1 { top: -15px; left: -25px; animation-delay: 0.1s; }
.s2 { top: -15px; right: -25px; animation-delay: 0.4s; }
.s3 { bottom: 10px; left: -35px; animation-delay: 0.3s; }
.s4 { bottom: 10px; right: -35px; animation-delay: 0.3s; }

@keyframes spinStar {
    0% { transform: scale(0.8) rotate(0deg); opacity: 0.6; }
    100% { transform: scale(1.3) rotate(25deg); opacity: 1; }
}

.tutorial-overlay h2 {
    background: rgba(255, 255, 255, 0.92);
    padding: 14px 24px;
    border-radius: 25px;
    font-size: 24px;
    font-weight: 800;
    color: #b45309;
    border: 3px solid #facc15 !important;
    text-align: center;
    box-shadow: 0 10px 25px rgba(0,0,0,0.18);
}

.giant-teddy-overlay, .giant-tom-overlay {
    position: fixed; inset: 0; display: flex; justify-content: flex-end; align-items: center;
    background: rgba(0, 0, 0, 0.4); z-index: 999999; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; padding-right: 60px;}
.giant-teddy-overlay.show, .giant-tom-overlay.show { opacity: 1; pointer-events: auto; }
.giant-teddy-card, .giant-tom-card { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 25px; animation: bounceCard 1.5s ease-in-out infinite alternate; }
.giant-teddy-card img, .giant-tom-card img { width: 380px; height: 380px; object-fit: contain; filter: drop-shadow(0 20px 50px rgba(0,0,0,0.7)); }
.giant-teddy-card h2 { background: white; padding: 18px 36px; border-radius: 30px; font-size: 36px; color: #059669; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 4px solid #34d399; }
.giant-tom-card h2 { background: white; padding: 18px 36px; border-radius: 30px; font-size: 36px; color: #b45309; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 4px solid #facc15; }

@keyframes bounceCard {
    0% { transform: translateY(0px); }
    100% { transform: translateY(-20px); }
}

.confetti { position:fixed; width:12px; height:12px; top:-20px; z-index:999999; animation: confettiFall linear forwards; }
@keyframes confettiFall { to { transform: translateY(110vh) rotate(720deg); opacity:0; } }
</style>
"""

COMMON_JS = """
<script>
let CURRENT_EXAMPLES = {};
let activeExampleKey = null;

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function speakWithKidVoice(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        let utterance = new SpeechSynthesisUtterance(text);
        utterance.pitch = 1.35;
        window.speechSynthesis.speak(utterance);
    }
}

function selectExample(key) {
    document.querySelectorAll(".example-box").forEach(box => { box.style.display = "none"; });
    activeExampleKey = key;
    let data = CURRENT_EXAMPLES[key];
    if (data) {
        let box = document.getElementById("box_" + key);
        if (box) box.style.display = "block";

        let editor = document.getElementById("code");
        if (editor) {
            editor.value = data.code;
            editor.classList.remove("error-highlight");
        }
        
        let outputEl = document.getElementById("output");
        if (outputEl) {
            outputEl.innerText = "Your output will be displayed here 😊 .";
        }
    }
}

function updateLessonData(title, subtitle, examplesObj, defaultCode) {
    document.getElementById("pageSubtitle").innerText = subtitle;
    CURRENT_EXAMPLES = Object.assign({}, examplesObj);

    let keys = Object.keys(examplesObj);
    activeExampleKey = keys.length > 0 ? keys[0] : null;

    let container = document.getElementById("exampleContainer");
    let html = '<div class="example-title">' + escapeHtml(title) + '</div>';

    for (let key in examplesObj) {
        let ex = examplesObj[key];
        html += `
            <div class="example-item">
                <button class="topic-btn" onclick="selectExample('${key}')">${escapeHtml(ex.label)}</button>
                <div class="example-box" id="box_${key}">
                    <b>Explanation:</b> <span class="explanation-text">${escapeHtml(ex.explain)}</span><br>
                    <b>Expected Answer / Output:</b><pre>${escapeHtml(ex.output)}</pre>
                </div>
            </div>
        `;
    }

    container.innerHTML = html + `
        <div class="tutorial-overlay" id="tutorialOverlay">
            <div class="tom-container">
                <span class="sparkle-star s1">⭐</span>
                <span class="sparkle-star s2">✨</span>
                <span class="sparkle-star s3">🌟</span>
                <span class="sparkle-star s4">⭐</span>
                <img src="ada.png" onerror="this.onerror=null; this.src='ada.jpg'; this.outerHTML='<div style=\\'font-size:80px;\\'>👦</div>';" />
            </div>
            <h2>Click the examples here to start ! 🚀</h2>
        </div>
    `;

    let editor = document.getElementById("code");
    if (editor && defaultCode) {
        editor.value = defaultCode;
        editor.classList.remove("error-highlight");
    }

    if (activeExampleKey) {
        selectExample(activeExampleKey);
    }
    
    let outputEl = document.getElementById("output");
    if (outputEl) {
        outputEl.innerText = "Your output will be displayed here 😊 .";
    }
    
    playTwinkleChime();
    showTutorialOverlay();
}

function showTutorialOverlay() {
    setTimeout(() => {
        let overlay = document.getElementById("tutorialOverlay");
        if (overlay) {
            overlay.classList.add("show");
            speakWithKidVoice("Click the examples here to start !");
            setTimeout(() => { overlay.classList.remove("show"); }, 4000);
        }
    }, 300);
}

function setDarkMode(enableDark) {
    if(enableDark) { document.body.classList.add("dark-mode"); } 
    else { document.body.classList.remove("dark-mode"); }
}

function createConfetti(){
    for(let i=0; i<85; i++){
        let confetti = document.createElement("div");
        confetti.classList.add("confetti");
        confetti.style.left = Math.random()*100 + "vw";
        confetti.style.background = `hsl(${Math.random()*360}, 100%, 50%)`;
        confetti.style.animationDuration = (Math.random()*2 + 2) + "s";
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 4000);
    }
}

let bgAudioContext, musicPlaying = false, musicLoop;
const magicalNotes = [523.25, 659.25, 783.99, 987.77, 1046.50];

function ensureAudioContext() {
    if(!bgAudioContext) {
        bgAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(bgAudioContext.state === "suspended") {
        bgAudioContext.resume();
    }
}

function playSuccessSound() {
    ensureAudioContext();
    const ctx = bgAudioContext;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + idx * 0.12;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.start(start);
        osc.stop(start + 0.3);
    });
}

function playErrorSound() {
    ensureAudioContext();
    const ctx = bgAudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
}

function showGiantTeddy(muteSound = false) {
    if (!muteSound) {
        playSuccessSound();
    }
    let overlay = document.getElementById("giantTeddyOverlay");
    if(overlay) {
        overlay.classList.add("show");
        speakWithKidVoice("Fantastic job! Code ran correctly!");
        createConfetti();
        setTimeout(() => {
            overlay.classList.remove("show");
        }, 3000);
    }
}

function showGiantTom(msg) {
    playErrorSound();
    let overlay = document.getElementById("giantTomOverlay");
    let titleEl = document.getElementById("giantTomTitle");
    if(overlay && titleEl) {
        titleEl.innerText = msg;
        overlay.classList.add("show");
        speakWithKidVoice(msg);
        setTimeout(() => overlay.classList.remove("show"), 6000);
    }
}

function playSoftTinkle(freq, delay = 0){
    ensureAudioContext();
    if(!bgAudioContext) return;
    const osc = bgAudioContext.createOscillator();
    const gain = bgAudioContext.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(bgAudioContext.destination);
    
    const startTime = bgAudioContext.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.02, startTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.8);
    osc.start(startTime);
    osc.stop(startTime + 1.8);
}

function playTwinkleChime() {
    ensureAudioContext();
    [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, idx) => {
        playSoftTinkle(freq, idx * 0.15);
    });
}

function playMagicalTinkles(){
    if(!musicPlaying) return;
    for(let i=0; i<8; i++){
        const note = magicalNotes[Math.floor(Math.random() * magicalNotes.length)];
        playSoftTinkle(note, Math.random() * 4);
    }
}

function toggleAudioEngine(enableAudio) {
    ensureAudioContext();
    if(!enableAudio){
        musicPlaying = false;
        clearInterval(musicLoop);
        if(bgAudioContext) bgAudioContext.suspend();
    } else {
        if(!musicPlaying) {
            musicPlaying = true;
            playMagicalTinkles();
            musicLoop = setInterval(playMagicalTinkles, 5000);
        }
    }
}

function triggerShootingStar() {
    let star = document.getElementById("shootingStar");
    if (star) {
        star.classList.remove("animate");
        star.offsetHeight;
        star.classList.add("animate");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    triggerShootingStar();
    setInterval(triggerShootingStar, 120000);
    let outputEl = document.getElementById("output");
    if (outputEl) {
        outputEl.innerText = "Your output will be displayed here 😊 .";
    }
});

function runCodeNative() {
    ensureAudioContext();
    let codeArea = document.getElementById("code");
    codeArea.classList.remove("error-highlight");
    if (window.pyqtBridge) {
        window.pyqtBridge.executePython(codeArea.value);
    }
}

function showInputLessonOutput(text, waiting, promptText) {
    const output = document.getElementById("output");
    output.innerHTML = "";

    if (text) {
        const terminal = document.createElement("span");
        terminal.style.whiteSpace = "pre-wrap";
        terminal.textContent = text;
        output.appendChild(terminal);
    }

    if (waiting === true) {
        if (promptText) {
            const promptSpan = document.createElement("span");
            promptSpan.style.whiteSpace = "pre-wrap";
            promptSpan.textContent = promptText;
            output.appendChild(promptSpan);
        }

        const input = document.createElement("input");
        input.type = "text";
        input.autocomplete = "off";
        input.placeholder = "Type  and hit enter";
        input.style.cssText =
            "display:inline-block;box-sizing:border-box;margin-left:8px;padding:4px 10px;" +
            "font-size:20px;font-family:monospace;border:2px solid #38bdf8;" +
            "border-radius:10px;background:white;color:#111;vertical-align:baseline;outline:none;";

        input.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                e.preventDefault();
                input.disabled = true;
                if (!input.value.trim()) {
                    if (window.pyqtBridge) window.pyqtBridge.notifyEmptyInput();
                } else {
                    if (window.pyqtBridge) window.pyqtBridge.submitInput(input.value);
                }
            }
        });

        output.appendChild(input);
        setTimeout(() => { input.focus(); }, 50);
    }
    output.scrollTop = output.scrollHeight;
}

function handleCodeOutput(resultText, isError, kidMsg, highlight) {
    document.getElementById("output").innerText = resultText;
    if(!isError) {
        let isWindowOpen = resultText.includes("Window Opened") || resultText.includes("cv2");
        showGiantTeddy(isWindowOpen);
    } else {
        if(highlight) document.getElementById("code").classList.add("error-highlight");
        showGiantTom(kidMsg);
    }
}
</script>
"""

MASTER_HTML_TEMPLATE = """<!DOCTYPE html><html><head>""" + BASE_CSS + """</head><body>
    <div class="sun"></div>
    <div class="moon"></div>
    <div class="star star1">⭐</div><div class="star star2">⭐</div><div class="star star3">⭐</div>
    <div class="star star4">⭐</div><div class="star star5">⭐</div>
    
    <div class="shooting-star" id="shootingStar"></div>
    
    <div class="giant-teddy-overlay" id="giantTeddyOverlay">
        <div class="giant-teddy-card">
            <img src="teddy.png" onerror="this.onerror=null; this.outerHTML='<div style=\\'font-size:160px;\\'>🧸</div>';" />
            <h2>🎉 Fantastic Job! 🌟</h2>
        </div>
    </div>

    <div class="giant-tom-overlay" id="giantTomOverlay">
        <div class="giant-tom-card">
            <img src="tom.png" onerror="this.onerror=null; this.outerHTML='<div style=\\'font-size:160px;\\'>👦</div>';" />
            <h2 id="giantTomTitle">Oopsie! 🙈</h2>
        </div>
    </div>

    <div class="header">
        <h1>PYTHON ADVENTURE 🐍✨</h1>
        <div class="subtitle" id="pageSubtitle">Learn Python with Tom, Penny & Teddy! 🚀</div>
    </div>

    <div class="coding-box">
        <div class="example-panel" id="exampleContainer">
            <div class="example-title">✨ LESSON EXAMPLES 🎈</div>
            <div class="tutorial-overlay" id="tutorialOverlay">
                <div class="tom-container">
                    <span class="sparkle-star s1">⭐</span>
                    <span class="sparkle-star s2">✨</span>
                    <span class="sparkle-star s3">🌟</span>
                    <span class="sparkle-star s4">⭐</span>
                    <img src="ada.png" onerror="this.onerror=null; this.src='ada.jpg'; this.outerHTML='<div style=\\'font-size:100px;\\'>👦</div>';" />
                </div>
                <h2>Click the examples here to start ! 🚀</h2>
            </div>
        </div>
        <div class="editor-section" id="editorSection">
            <textarea id="code"># Write code below 💻\nprint("Hello Kids! 👋")</textarea>
            <button class="run-btn" onclick="runCodeNative()">▶ RUN CODE 🚀</button>
            <div class="output" id="output">Your output will be displayed here 😊 .</div>
        </div>
    </div>
    """ + COMMON_JS + """</body></html>"""

MASTER_HTML_TEMPLATE = (
    MASTER_HTML_TEMPLATE
    .replace('src="ada.png"', 'src="%s"' % html.escape(LOGO, quote=True))
    .replace('src="teddy.png"', 'src="%s"' % html.escape(CONFIG["success_picture"], quote=True))
    .replace('src="tom.png"', 'src="%s"' % html.escape(CONFIG["oops_picture"], quote=True))
    .replace("<h1>PYTHON ADVENTURE 🐍✨</h1>", "<h1>%s</h1>" % html.escape(CONFIG["page_title"]))
    .replace(">Learn Python with Tom, Penny & Teddy! 🚀<", ">%s<" % html.escape(CONFIG["page_subtitle"]))
)

# The lessons come from the app's lessons.py (LESSONS_DATA, TOPICS): lesson 1 is TOPICS[0].
LESSONS_DATA, TOPICS = load_lessons(get_base_dir())

class InteractiveInputStdIn:
    def __init__(self, parent_window):
        self.parent_window = parent_window
    def readline(self, *args, **kwargs):
        return "Tom\n"

class CodeBridge(QObject):
    def __init__(self, web_view, parent_window):
        super().__init__()
        self.web_view = web_view
        self.parent_window = parent_window
        self.current_lesson = ""
        self.process = None
        self.code_file = None
        self.runner_file = None
        self.pending = ""
        self.terminal_output = ""
        self.waiting = False
        self.last_prompt = ""

    def set_current_lesson(self, lesson_id):
        self.current_lesson = lesson_id

    def _normal(self, result, error=False, msg=""):
        a = result.replace("\\","\\\\").replace("`","\\`").replace("\n","\\n").replace("\r","")
        b = msg.replace("\\","\\\\").replace("`","\\`").replace("\n"," ")
        self.web_view.page().runJavaScript(f"handleCodeOutput(`{a}`, {'true' if error else 'false'}, `{b}`, true);")

    def _interactive(self):
        a = self.terminal_output.replace("\\","\\\\").replace("`","\\`").replace("\r","")
        p = self.last_prompt.replace("\\","\\\\").replace("`","\\`").replace("\r","").replace("\n","")
        self.web_view.page().runJavaScript(f"showInputLessonOutput(`{a}`, {'true' if self.waiting else 'false'}, `{p}`);")

    @pyqtSlot()
    def notifyEmptyInput(self):
        msg = "You missed to type input 🙈"
        self._normal(f"❌ {msg}", True, msg)
        if self.process and self.process.state() != QProcess.NotRunning:
            self.process.kill()

    @pyqtSlot(str)
    def executePython(self, code_str):
        ensure_tom_image()
        os.chdir(get_base_dir())
        stripped = "\n".join([line for line in code_str.splitlines() if line.strip() and not line.strip().startswith("#")]).strip()
        if not stripped:
            msg = "You missed to type input 🙈"
            self._normal(f"❌ {msg}", True, msg)
            return

        if self.current_lesson == "lesson6" or "input(" in code_str:
            self._run_input(code_str)
            return

        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                old = sys.stdin
                sys.stdin = InteractiveInputStdIn(self.parent_window)
                try:
                    exec(code_str, {"__name__": "__main__"})
                finally:
                    sys.stdin = old
            self._normal(buf.getvalue() or "✅ Code Ran Successfully! 🎉")
        except SyntaxError:
            msg = "Code missing ) or string error"
            self._normal(f"❌ {msg}", True, msg)
        except NameError:
            msg = "Mistake in function name or variable 💡"
            self._normal(f"❌ {msg}", True, msg)
        except ModuleNotFoundError:
            msg = "OpenCV / Module not installed in system 💡"
            self._normal(f"❌ {msg}", True, msg)
        except Exception as e:
            err_str = str(e)
            if "was never closed" in err_str or "unexpected EOF" in err_str or "unterminated" in err_str:
                msg = "Code missing ) or string error"
            elif "not defined" in err_str:
                msg = "Mistake in function name or variable 💡"
            else:
                msg = f"{type(e).__name__}: {e} 💡"
            self._normal("❌ " + msg, True, msg)

    def _run_input(self, code):
        import tempfile
        stripped_code = "\n".join([line for line in code.splitlines() if line.strip() and not line.strip().startswith("#")]).strip()
        if not stripped_code:
            msg = "You missed to type input 🙈"
            self._normal(f"❌ {msg}", True, msg)
            return

        if self.process and self.process.state() != QProcess.NotRunning:
            self.process.kill()

        fd, code_name = tempfile.mkstemp(suffix=".py")
        os.close(fd)
        Path(code_name).write_text(code, encoding="utf-8")
        runner_name = code_name + ".runner.py"
        
        base_dir_escaped = get_base_dir().replace("\\", "/")
        runner_content = """import sys, os, builtins, runpy, traceback
os.chdir('''""" + base_dir_escaped + """''')
real = sys.stdout

class Out:
    def write(self, x):
        if x:
            real.write(x)
            real.flush()
    def flush(self):
        real.flush()

def inp(prompt=''):
    if prompt:
        real.write(str(prompt))
    real.write('\\n<<WAITING_INPUT>>\\n')
    real.flush()
    x = sys.stdin.readline()
    if x == '':
        raise EOFError('Input cancelled')
    return x.rstrip('\\r\\n')

sys.stdout = Out()
builtins.input = inp

try:
    runpy.run_path(sys.argv[1], run_name='__main__')
except Exception as e:
    tb = traceback.format_exc()
    if "SyntaxError" in tb or "IndentationError" in tb or "EOF" in tb or "unterminated" in tb:
        print("\\nCode missing ) or string error")
    elif "NameError" in tb:
        print("\\nMistake in function name or variable 💡")
    elif "ModuleNotFoundError" in tb or "No module named" in tb:
        print("\\nOpenCV / Module not installed in system 💡")
    else:
        print("\\nError: " + str(e))
"""
        Path(runner_name).write_text(runner_content, encoding="utf-8")
        self.code_file = code_name
        self.runner_file = runner_name
        self.pending = ""
        self.terminal_output = ""
        self.waiting = False
        self.last_prompt = ""
        
        self.process = QProcess(self)
        self.process.setWorkingDirectory(get_base_dir())
        self.process.readyReadStandardOutput.connect(self._read_out)
        self.process.readyReadStandardError.connect(self._read_err)
        self.process.finished.connect(self._done)
        
        py_exec = sys.executable
        if getattr(sys, 'frozen', False):
            import shutil
            py_bin = shutil.which("python3") or shutil.which("python") or sys.executable
        else:
            py_bin = py_exec

        self.process.start(py_bin, ["-u", runner_name, code_name])

    def _read_out(self):
        chunk = bytes(self.process.readAllStandardOutput()).decode("utf-8", "replace")
        if chunk:
            if "<<WAITING_INPUT>>" in chunk:
                parts = chunk.split("<<WAITING_INPUT>>")
                self.terminal_output += parts[0].rstrip("\r\n")
                self.waiting = True
                if len(parts) > 1 and parts[1]:
                    self.pending += parts[1]
            else:
                self.terminal_output += chunk
                if "Code missing" in chunk or "Mistake in function" in chunk or "Error:" in chunk or "Module not installed" in chunk:
                    self.waiting = False
        self._interactive()

    def _read_err(self):
        x = bytes(self.process.readAllStandardError()).decode("utf-8", "replace")
        if x:
            if "FileNotFoundError" in x or "No such file" in x:
                msg = "You missed to type input 🙈"
            elif "SyntaxError" in x or "EOF" in x or "unterminated" in x:
                msg = "Code missing ) or string error"
            elif "NameError" in x:
                msg = "Mistake in function name or variable 💡"
            elif "ModuleNotFoundError" in x or "No module named" in x:
                msg = "OpenCV / Module not installed in system 💡"
            else:
                msg = "Code missing ) or string error"
            self._normal(f"❌ {msg}", True, msg)
            self.waiting = False
            self.last_prompt = ""

    @pyqtSlot(str)
    def submitInput(self, value):
        if self.process and self.process.state() != QProcess.NotRunning:
            self.terminal_output += " " + value + "\n"
            self.waiting = False
            self.last_prompt = ""
            self._interactive()
            self.process.write((value + "\n").encode())

    def _done(self, *args):
        if self.process:
            chunk = bytes(self.process.readAllStandardOutput()).decode("utf-8", "replace")
            if chunk:
                clean_chunk = chunk.replace("<<WAITING_INPUT>>\n", "").replace("<<WAITING_INPUT>>", "")
                self.terminal_output += clean_chunk
        self.waiting = False
        self.last_prompt = ""
        self._interactive()
        
        if "❌" not in self.terminal_output and "Error" not in self.terminal_output and "Code missing" not in self.terminal_output:
            self.web_view.page().runJavaScript("showGiantTeddy(false);")

        for f in (self.code_file, self.runner_file):
            if f:
                try:
                    os.remove(f)
                except OSError:
                    pass
        self.code_file = self.runner_file = None


class CharacterWidget(QWidget):
    def __init__(self, name, image_file, emoji=""):
        super().__init__()
        layout = QVBoxLayout(self)
        layout.setAlignment(Qt.AlignCenter)
        layout.setContentsMargins(0, 45, 0, 0)
        self.emoji = emoji or "⭐"

        self.name = name
        self.image_file = image_file
        self.base_image_size = 480
        self.base_font_size = 30

        self.speech = QLabel(name)
        self.speech.setFont(QFont("Comic Sans MS", self.base_font_size, QFont.Bold))
        self.speech.setStyleSheet("background-color: white; color: #0f172a; padding: 12px 30px; border-radius: 25px;")
        self.speech.setAlignment(Qt.AlignCenter)

        self.img_container = QWidget()
        img_container_layout = QVBoxLayout(self.img_container)
        img_container_layout.setAlignment(Qt.AlignCenter)

        self.img_label = QLabel()
        self.img_label.setFixedSize(self.base_image_size, self.base_image_size)
        resolved_img = resource_path(image_file)
        if os.path.exists(resolved_img):
            pixmap = QPixmap(resolved_img).scaled(self.base_image_size, self.base_image_size, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            self.img_label.setPixmap(pixmap)
        else:
            self.img_label.setStyleSheet("font-size: 180px;")
            self.img_label.setAlignment(Qt.AlignCenter)
            self.img_label.setText(self.emoji)

        img_container_layout.addWidget(self.img_label)
        layout.addWidget(self.speech, alignment=Qt.AlignCenter)
        layout.addWidget(self.img_container, alignment=Qt.AlignCenter)

        self.anim = None

    def set_scale(self, scale):
        size = max(int(self.base_image_size * scale), 120)
        self.img_label.setFixedSize(size, size)
        resolved_img = resource_path(self.image_file)
        if os.path.exists(resolved_img):
            pixmap = QPixmap(resolved_img).scaled(size, size, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            self.img_label.setPixmap(pixmap)
        else:
            self.img_label.setStyleSheet("font-size: %dpx;" % int(180 * scale))
        self.speech.setFont(QFont("Comic Sans MS", max(int(self.base_font_size * scale), 12), QFont.Bold))

    def showEvent(self, event):
        super().showEvent(event)
        if not self.anim:
            self.anim = QPropertyAnimation(self.img_container, b"pos")
            self.anim.setDuration(2500)
            start_pos = self.img_container.pos()
            self.anim.setStartValue(start_pos)
            self.anim.setKeyValueAt(0.5, start_pos - QPoint(0, 20))
            self.anim.setEndValue(start_pos)
            self.anim.setEasingCurve(QEasingCurve.InOutSine)
            self.anim.setLoopCount(-1)
            self.anim.start()


class TopicItem(QWidget):
    def __init__(self, topic, on_open_callback):
        super().__init__()
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 10)

        self.topic = topic
        self.locked = False
        self.is_active = False
        self.topic_btn = QPushButton(f"{topic['emoji']}  {topic['name']}")
        self.topic_btn.setFont(QFont("Arial", 13, QFont.Normal))
        self.topic_btn.setCursor(Qt.PointingHandCursor)
        self.update_style(False)
        
        self.topic_btn.clicked.connect(lambda: on_open_callback(topic["id"]))
        layout.addWidget(self.topic_btn)

    def set_locked(self, locked):
        self.locked = bool(locked)
        lock = "🔒 " if self.locked else ""
        self.topic_btn.setText(f"{lock}{self.topic['emoji']}  {self.topic['name']}")
        self.topic_btn.setToolTip("Locked 🔒 — ask a grown-up to unlock it" if self.locked else "")
        self.update_style(self.is_active)

    def update_style(self, is_active):
        self.is_active = is_active
        if self.locked and not is_active:
            self.topic_btn.setStyleSheet("""
                QPushButton { 
                    background-color: rgba(255, 255, 255, 0.35); 
                    color: #64748b; 
                    border: 2px dashed rgba(100, 116, 139, 0.45); 
                    border-radius: 20px; 
                    padding: 14px 16px; 
                    text-align: left; 
                    font-weight: normal;
                }
                QPushButton:hover { background-color: rgba(255, 255, 255, 0.6); color: #475569; }
            """)
            return
        if is_active:
            self.topic_btn.setStyleSheet("""
                QPushButton { 
                    background-color: #38bdf8; 
                    color: #ffffff; 
                    border: 3px solid #facc15; 
                    border-radius: 20px; 
                    padding: 14px 16px; 
                    text-align: left; 
                    font-weight: bold;
                }
            """)
        else:
            self.topic_btn.setStyleSheet("""
                QPushButton { 
                    background-color: rgba(255, 255, 255, 0.7); 
                    color: #0f172a; 
                    border: none; 
                    border-radius: 20px; 
                    padding: 14px 16px; 
                    text-align: left; 
                    font-weight: normal;
                }
                QPushButton:hover { background-color: #ffffff; color: #2563eb; }
            """)


DUMMY_CREDENTIALS = {
    "email": "kid@codingfun.com",
    "password": "kid123",
    "full_name": "Alex Student",
}

DUMMY_USER = {
    "id": "usr_KIDS_1001",
    "full_name": "Alex Student",
    "email": "alex@kidscodingfun.com",
    "role": "Student",
    "avatar_url": "Default (Ada the Teacher) 🐍",
    "bio": "Young coder on a coding adventure! 🚀",
    "gender": "Not specified",
    "address": "123 Learning Lane, Kidstown 🌳",
    "auth_provider": "local",
    "is_active": True,
    "created_at": "2024-01-15T10:30:00Z",
}

DUMMY_LICENSE = {
    "license_id": "PAFK-2026-KIDS-007",
    "holder_name": "Alex Student",
    "licensed_to": "a.kidscodingfun.com",
    "plan": "Personal & Educational",
    "status": "ACTIVE ✅",
    "issued_on": "2024-01-15",
    "expires_on": "2027-01-15",
    "total_devices": 1,
}


class ApiCall(QObject):
    """Calls the Ada The Coder API in the background; `done(answer, error)` arrives on the main thread."""
    done = pyqtSignal(object, object)

    def start(self, path, payload):
        base = (CONFIG["server"].get("url") or "").rstrip("/")
        if base.endswith("/api"):
            base = base[:-4]
        url = base + "/api" + path

        def work():
            body = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json",
                                                                  "Accept": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=15) as r:
                    self.done.emit(json.loads(r.read().decode("utf-8") or "{}"), None)
            except urllib.error.HTTPError as e:
                try:
                    self.done.emit(json.loads(e.read().decode("utf-8") or "{}"), None)
                except Exception:
                    self.done.emit(None, "The server answered %s." % e.code)
            except Exception:
                self.done.emit(None, "offline")

        threading.Thread(target=work, daemon=True).start()


class IntroOverlay(QFrame):
    """Plays the app's intro video (app.json → intro_video) over the window when the app opens."""

    def __init__(self, parent, video_file, on_finished):
        super().__init__(parent)
        self.on_finished = on_finished
        self.finished = False
        self.setStyleSheet("QFrame { background: #000000; }")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        self.video = QVideoWidget()
        self.video.setStyleSheet("background: black;")
        layout.addWidget(self.video)
        self.player = QMediaPlayer(None, QMediaPlayer.VideoSurface)
        self.player.setVideoOutput(self.video)
        self.player.mediaStatusChanged.connect(self._status)
        self.player.error.connect(lambda *_: self.finish())
        self.skip_btn = QPushButton("Skip ⏭", self)
        self.skip_btn.setCursor(Qt.PointingHandCursor)
        self.skip_btn.setFont(QFont("Comic Sans MS", 13, QFont.Bold))
        self.skip_btn.setFixedSize(130, 46)
        self.skip_btn.setStyleSheet("""
            QPushButton { background: rgba(255,255,255,0.9); color: #0f172a; border: 3px solid #ffd166; border-radius: 22px; }
            QPushButton:hover { background: #ffd166; }
        """)
        self.skip_btn.clicked.connect(self.finish)
        self.player.setMedia(QMediaContent(QUrl.fromLocalFile(video_file)))

    def play(self):
        self.show()
        self.raise_()
        self.player.play()
        QTimer.singleShot(60000, self.finish)   # never keep a child waiting on a stuck video

    def _status(self, status):
        if status in (QMediaPlayer.EndOfMedia, QMediaPlayer.InvalidMedia):
            self.finish()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self.skip_btn.move(self.width() - self.skip_btn.width() - 24, self.height() - self.skip_btn.height() - 24)
        self.skip_btn.raise_()

    def finish(self):
        if self.finished:
            return
        self.finished = True
        self.player.stop()
        self.hide()
        self.on_finished()


class LessonLocksDialog(QDialog):
    """Grown-ups only (admin PIN): lock or unlock each of lessons 2..N."""

    def __init__(self, parent, locks):
        super().__init__(parent)
        self.locks = locks
        self.setWindowTitle("Lock / unlock lessons 🔐")
        self.setMinimumWidth(560)
        self.setStyleSheet("""
            QDialog { background: #ffffff; }
            QLabel { color: #0f172a; }
            QCheckBox { color: #0f172a; font-size: 14px; padding: 5px; }
            QCheckBox::indicator { width: 22px; height: 22px; }
            QPushButton { background: #e0f2fe; color: #0f172a; border: 2px solid #38bdf8; border-radius: 14px; padding: 8px 14px; font-weight: bold; }
            QPushButton:hover { background: #38bdf8; color: white; }
        """)
        layout = QVBoxLayout(self)
        title = QLabel("🔐 Which lessons are locked?")
        title.setFont(QFont("Comic Sans MS", 16, QFont.Bold))
        layout.addWidget(title)
        note = QLabel("Ticked = locked 🔒. Lesson 1 is always free. Saved on this computer.")
        note.setWordWrap(True)
        layout.addWidget(note)
        if locks.has_full_access:
            how = "a licence key (%s)" % locks.licence_key if locks.licence_key else "the parent's account"
            full = QLabel("✅ Everything is open right now because of %s; these ticks apply without it." % how)
            full.setWordWrap(True)
            full.setStyleSheet("color: #166534; background: #dcfce7; border-radius: 10px; padding: 8px;")
            layout.addWidget(full)

        grid = QGridLayout()
        self.boxes = {}
        rows = (len(TOPICS) - 1 + 1) // 2
        for i, topic in enumerate(TOPICS[1:], start=2):
            box = QCheckBox("%d. %s %s" % (i, topic["emoji"], topic["name"]))
            box.setChecked(locks.is_locked_by_setting(i))
            self.boxes[i] = box
            grid.addWidget(box, (i - 2) % rows, (i - 2) // rows)
        layout.addLayout(grid)

        row = QHBoxLayout()
        for text, fn in (("🔒 Lock all", lambda: self._tick_all(True)),
                         ("🔓 Unlock all", lambda: self._tick_all(False)),
                         ("↺ As the app came", self._defaults)):
            b = QPushButton(text)
            b.setCursor(Qt.PointingHandCursor)
            b.clicked.connect(fn)
            row.addWidget(b)
        layout.addLayout(row)

        buttons = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self._save)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _tick_all(self, locked):
        for box in self.boxes.values():
            box.setChecked(locked)

    def _defaults(self):
        for n, box in self.boxes.items():
            box.setChecked(n in self.locks.default_locked)

    def _save(self):
        self.locks.set_many([n for n, box in self.boxes.items() if box.isChecked()])
        self.accept()


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle(CONFIG["window_title"])
        self.setMinimumSize(640, 480)
        
        app_icon_path = resource_path(LOGO)
        if os.path.exists(app_icon_path):
            self.setWindowIcon(QIcon(app_icon_path))

        self.is_dark_mode = False
        self.is_music_on = False
        self.current_lesson_index = 0
        self.topic_widgets = []
        self.web_page_ready = False
        self.last_unmuted_volume = 100
        self.locks = LessonLocks(CONFIG, len(TOPICS), os.path.join(data_dir(APP_ID), "locks.json"))
        self.api = ApiCall()
        self.api.done.connect(self._api_answer)
        self._api_kind = None

        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.central_widget.setObjectName("CentralWidget")

        main_layout = QVBoxLayout(self.central_widget)
        main_layout.setContentsMargins(15, 15, 15, 15)

        top_bar = QHBoxLayout()
        logo = QLabel("")
        logo.setFont(QFont("Comic Sans MS", 22, QFont.Bold))
        logo.setStyleSheet("color: #0f172a; background: transparent; border: none;")
        
        self.home_btn = QPushButton("🏠 Home Screen 🌟")
        self.home_btn.setFont(QFont("Comic Sans MS", 14, QFont.Bold))
        self.home_btn.setCursor(Qt.PointingHandCursor)
        self.home_btn.setStyleSheet("background: rgba(255,255,255,0.85); border-radius: 25px; padding: 14px 28px; color: #0f172a; border: none;")
        self.home_btn.clicked.connect(self.show_home)

        self.theme_btn = QPushButton("☀️")
        self.theme_btn.setFont(QFont("Comic Sans MS", 14, QFont.Bold))
        self.theme_btn.setCursor(Qt.PointingHandCursor)
        self.theme_btn.setFixedSize(48, 48)
        self.theme_btn.setStyleSheet("background: rgba(255,255,255,0.85); border-radius: 24px; color: #f59e0b; border: none;")
        self.theme_btn.clicked.connect(self.toggle_app_theme)

        self.music_btn = QPushButton("🔈")
        self.music_btn.setFont(QFont("Comic Sans MS", 14, QFont.Bold))
        self.music_btn.setCursor(Qt.PointingHandCursor)
        self.music_btn.setFixedSize(48, 48)
        self.music_btn.setStyleSheet("background: rgba(255,255,255,0.85); border-radius: 24px; color: #0f172a; border: none;")
        self.music_btn.clicked.connect(self.toggle_app_music)

        self.avatar_btn = QToolButton()
        self.avatar_btn.setCursor(Qt.PointingHandCursor)
        self.avatar_btn.setFixedSize(52, 52)
        self.avatar_btn.setToolTip("Account ⭐")
        self.avatar_btn.setPopupMode(QToolButton.InstantPopup)
        self.avatar_btn.setIconSize(self.avatar_btn.size())
        self.avatar_btn.setStyleSheet("""
            QToolButton {
                background: transparent;
                border: 3px solid #ffd166;
                border-radius: 26px;
            }
            QToolButton:hover { border-color: #38bdf8; }
            QToolButton::menu-indicator { image: none; }
        """)
        round_pix = make_round_pixmap(resource_path(LOGO), 46)
        if round_pix:
            self.avatar_btn.setIcon(QIcon(round_pix))

        self.account_menu = QMenu(self)
        self.account_menu.setFont(QFont("Comic Sans MS", 12))
        self.account_menu.setStyleSheet("""
            QMenu {
                background-color: #ffffff;
                color: #0f172a;
                border: 3px solid #38bdf8;
                border-radius: 14px;
                padding: 6px;
            }
            QMenu::item {
                padding: 10px 22px;
                border-radius: 10px;
                margin: 2px 4px;
            }
            QMenu::item:selected { background: #38bdf8; color: #ffffff; }
            QMenu::separator { height: 2px; background: #e2e8f0; margin: 4px 8px; }
        """)

        self.profile_action = QAction("👤 Profile", self)
        self.profile_action.triggered.connect(self.show_profile_dialog)
        self.license_action = QAction("📜 License", self)
        self.license_action.triggered.connect(self.show_license_dialog)
        self.key_action = QAction("🔑 Enter licence key", self)
        self.key_action.triggered.connect(self.ask_licence_key)
        self.locks_action = QAction("🔐 Lock / unlock lessons (grown-ups)", self)
        self.locks_action.triggered.connect(self.show_locks_dialog)

        self.account_menu.addAction(self.profile_action)
        self.account_menu.addSeparator()
        self.account_menu.addAction(self.license_action)
        self.account_menu.addAction(self.key_action)
        self.account_menu.addAction(self.locks_action)
        self.avatar_btn.setMenu(self.account_menu)

        top_bar.addWidget(logo)
        top_bar.addStretch()
        top_bar.addWidget(self.home_btn)
        top_bar.addWidget(self.theme_btn)
        top_bar.addWidget(self.music_btn)
        top_bar.addWidget(self.avatar_btn)
        main_layout.addLayout(top_bar)

        body_layout = QHBoxLayout()
        body_layout.setSpacing(18)

        self.center_stack = QStackedWidget()
        
        self.hero_panel = QFrame()
        self.hero_layout = QVBoxLayout(self.hero_panel)
        self.hero_layout.setAlignment(Qt.AlignCenter)
        self.hero_layout.setSpacing(45)

        self.hero_title = QLabel(CONFIG["hero_title"])
        self.hero_title.setFont(QFont("Comic Sans MS", 46, QFont.Bold))
        self.hero_title.setAlignment(Qt.AlignCenter)
        self.hero_title.setWordWrap(True)

        self.hero_sub = QLabel(CONFIG["hero_subtitle"])
        self.hero_sub.setFont(QFont("Comic Sans MS", 22, QFont.Bold))
        self.hero_sub.setAlignment(Qt.AlignCenter)
        self.hero_sub.setWordWrap(True)

        self.char_container = QWidget()
        self.char_container.setStyleSheet("background: transparent;")
        self.char_layout = QHBoxLayout(self.char_container)
        self.char_layout.setAlignment(Qt.AlignCenter)
        self.char_layout.setSpacing(120)

        self.char_widgets = []
        for char in CONFIG["characters"]:
            char_widget = CharacterWidget(char.get("name", ""), char.get("image", ""), char.get("emoji", ""))
            self.char_widgets.append(char_widget)
            self.char_layout.addWidget(char_widget)

        self.hero_layout.addWidget(self.hero_title)
        self.hero_layout.addWidget(self.hero_sub)
        self.hero_layout.addWidget(self.char_container, alignment=Qt.AlignCenter)

        self.lesson_workspace = QWidget()
        lw_layout = QVBoxLayout(self.lesson_workspace)
        lw_layout.setContentsMargins(0, 0, 0, 0)

        self.play_vid_btn = QPushButton("Stop video 🛑")
        self.play_vid_btn.setFont(QFont("Comic Sans MS", 16, QFont.Bold))
        self.play_vid_btn.setCursor(Qt.PointingHandCursor)
        self.play_vid_btn.setFixedHeight(50)
        self.play_vid_btn.setStyleSheet("""
            QPushButton {
                background-color: #38bdf8;
                color: #0f172a; 
                border-radius: 25px; 
                border: 3px solid #bae6fd; 
                padding: 0 35px;
            }
            QPushButton:hover { background-color: #0284c7; color: white; }
        """)
        self.play_vid_btn.clicked.connect(self.handle_bottom_button_click)

        self.lesson_stack = QStackedWidget()
        self.lesson_stack.currentChanged.connect(self.on_stack_index_changed)
        self.lesson_stack.currentChanged.connect(self._on_lesson_stack_changed)

        self.video_container = QWidget()
        video_container_layout = QVBoxLayout(self.video_container)
        video_container_layout.setContentsMargins(0, 0, 0, 0)
        video_container_layout.setSpacing(0)

        self.video_widget = QVideoWidget()
        self.video_widget.setAspectRatioMode(Qt.IgnoreAspectRatio)
        self.video_widget.setStyleSheet("""
            QVideoWidget {
                background: black; 
                border-radius: 35px; 
                border: 6px solid #ffea79;
            }
        """)
        
        self.video_shadow = QGraphicsDropShadowEffect(self)
        self.video_shadow.setBlurRadius(30)
        self.video_shadow.setColor(QColor(255, 230, 100, 220))
        self.video_shadow.setOffset(0, 0)
        self.video_widget.setGraphicsEffect(self.video_shadow)

        self.ai_watermark = QLabel(CONFIG["video_note"], self.video_widget)
        self.ai_watermark.setStyleSheet("""
            QLabel {
                background-color: rgba(15, 23, 42, 0.65);
                color: #f8fafc;
                font-size: 10px;
                padding: 4px 8px;
                border-radius: 6px;
            }
        """)
        self.ai_watermark.move(25, 10)

        self.media_player = QMediaPlayer(None, QMediaPlayer.VideoSurface)
        self.media_player.setVideoOutput(self.video_widget)
        self.media_player.setVolume(100)
        self.media_player.stateChanged.connect(self.handle_media_state)

        self.video_timer = QTimer(self)
        self.video_timer.setInterval(500)
        self.video_timer.timeout.connect(self._tick_position)

        self._seek_dragging = False

        self.video_controls = QWidget()
        self.video_controls.setFixedHeight(64)
        self.video_controls.setStyleSheet("""
            QWidget {
                background: rgba(15, 23, 42, 0.95);
                border: 2px solid rgba(124, 255, 178, 0.35);
                border-radius: 20px;
            }
        """)
        vc_layout = QHBoxLayout(self.video_controls)
        vc_layout.setContentsMargins(14, 8, 14, 8)
        vc_layout.setSpacing(12)

        self.play_pause_btn = QPushButton("⏸ Pause")
        self.play_pause_btn.setFont(QFont("Comic Sans MS", 13, QFont.Bold))
        self.play_pause_btn.setCursor(Qt.PointingHandCursor)
        self.play_pause_btn.setFixedWidth(120)
        self.play_pause_btn.setStyleSheet("""
            QPushButton {
                background: #ffd166; color: #0f172a; border: none;
                border-radius: 18px; padding: 8px;
            }
            QPushButton:hover { background: #ffca3a; }
        """)
        self.play_pause_btn.clicked.connect(self.toggle_play_pause_media)

        slider_style = """
            QSlider:horizontal {
                min-height: 24px;
                max-height: 24px;
            }
            QSlider::groove:horizontal {
                height: 6px;
                background: #334155;
                border-radius: 3px;
            }
            QSlider::sub-page:horizontal {
                background: #38bdf8;
                border-radius: 3px;
            }
            QSlider::add-page:horizontal {
                background: #1e293b;
                border-radius: 3px;
            }
            QSlider::handle:horizontal {
                background: #ffffff;
                border: 2px solid #facc15;
                width: 16px;
                height: 16px;
                margin: -5px 0;
                border-radius: 8px;
            }
            QSlider::handle:horizontal:hover {
                background: #facc15;
                border: 2px solid #ffffff;
            }
        """

        self.seek_slider = ClickableSlider(Qt.Horizontal)
        self.seek_slider.setCursor(Qt.PointingHandCursor)
        self.seek_slider.setStyleSheet(slider_style)
        self.seek_slider.sliderPressed.connect(self._seek_pressed)
        self.seek_slider.sliderReleased.connect(self._seek_released)
        self.seek_slider.sliderMoved.connect(self._on_seek_slider_moved)

        self.time_label = QLabel("00:00")
        self.time_label.setFont(QFont("Arial", 11, QFont.Bold))
        self.time_label.setStyleSheet("color: #d1fae5; background: transparent; border: none;")

        self.duration_label = QLabel("00:00")
        self.duration_label.setFont(QFont("Arial", 11, QFont.Bold))
        self.duration_label.setStyleSheet("color: #d1fae5; background: transparent; border: none;")

        self.volume_btn = QPushButton("🔊")
        self.volume_btn.setCursor(Qt.PointingHandCursor)
        self.volume_btn.setFixedSize(36, 36)
        self.volume_btn.setToolTip("Mute / Unmute")
        self.volume_btn.setStyleSheet("""
            QPushButton {
                background: rgba(255, 255, 255, 0.9); color: #0f172a;
                border: none; border-radius: 18px;
            }
            QPushButton:hover { background: #ffffff; }
        """)
        self.volume_btn.clicked.connect(self.toggle_mute_media)

        self.volume_slider = ClickableSlider(Qt.Horizontal)
        self.volume_slider.setFixedWidth(100)
        self.volume_slider.setRange(0, 100)
        self.volume_slider.setValue(100)
        self.volume_slider.setCursor(Qt.PointingHandCursor)
        self.volume_slider.setStyleSheet(slider_style)
        self.volume_slider.valueChanged.connect(self._on_volume_slider_changed)

        vc_layout.addWidget(self.play_pause_btn)
        vc_layout.addWidget(self.time_label)
        vc_layout.addWidget(self.seek_slider, stretch=1)
        vc_layout.addWidget(self.duration_label)
        vc_layout.addWidget(self.volume_btn)
        vc_layout.addWidget(self.volume_slider)

        self.media_player.positionChanged.connect(self._on_position_changed)
        self.media_player.durationChanged.connect(self._on_duration_changed)
        self.media_player.stateChanged.connect(self._on_media_state_for_controls)

        video_container_layout.addWidget(self.video_widget, stretch=1)
        video_container_layout.addSpacing(6)
        video_container_layout.addWidget(self.video_controls)

        self.lesson_viewer = QWebEngineView()
        self.lesson_viewer.page().setBackgroundColor(QColor(0, 0, 0, 0))
        
        settings = self.lesson_viewer.settings()
        settings.setAttribute(QWebEngineSettings.PlaybackRequiresUserGesture, False)
        settings.setAttribute(QWebEngineSettings.JavascriptCanAccessClipboard, True)
        settings.setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.LocalContentCanAccessFileUrls, True)
        
        self.bridge = CodeBridge(self.lesson_viewer, self)
        from PyQt5.QtWebChannel import QWebChannel
        self.channel = QWebChannel()
        self.channel.registerObject("pyqtBridge", self.bridge)
        self.lesson_viewer.page().setWebChannel(self.channel)

        web_channel_script = """
        <script src="qrc:///qtwebchannel/qwebchannel.js"></script>
        <script>
        new QWebChannel(qt.webChannelTransport, function(channel) {
            window.pyqtBridge = channel.objects.pyqtBridge;
        });
        </script>
        """
        full_html = MASTER_HTML_TEMPLATE.replace("</head>", web_channel_script + "</head>")
        self.lesson_viewer.loadFinished.connect(self.on_web_page_loaded)
        self.lesson_viewer.setHtml(full_html, QUrl.fromLocalFile(get_base_dir() + os.path.sep))

        self.lesson_stack.addWidget(self.video_container)
        self.lesson_stack.addWidget(self.lesson_viewer)

        lw_layout.addWidget(self.lesson_stack, stretch=1)
        lw_layout.addWidget(self.play_vid_btn, alignment=Qt.AlignCenter)

        self.center_stack.addWidget(self.hero_panel)
        self.center_stack.addWidget(self.lesson_workspace)

        self.sidebar_panel = QFrame()
        self.sidebar_base_width = 350
        self.sidebar_panel.setFixedWidth(self.sidebar_base_width)
        sidebar_layout = QVBoxLayout(self.sidebar_panel)
        sidebar_layout.setContentsMargins(14, 15, 14, 15)

        self.sidebar_title = QLabel(CONFIG["sidebar_title"])
        self.sidebar_title.setFont(QFont("Arial", 15, QFont.Normal))
        self.sidebar_title.setAlignment(Qt.AlignCenter)
        sidebar_layout.addWidget(self.sidebar_title)

        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        scroll_area.setStyleSheet("background: transparent; border: none;")

        scroll_content = QWidget()
        scroll_content.setStyleSheet("background: transparent;")
        scroll_layout = QVBoxLayout(scroll_content)

        for idx, topic in enumerate(TOPICS):
            item_widget = TopicItem(topic, self.load_lesson_by_index)
            self.topic_widgets.append(item_widget)
            scroll_layout.addWidget(item_widget)
        self.refresh_locks()

        scroll_layout.addStretch()
        scroll_area.setWidget(scroll_content)
        sidebar_layout.addWidget(scroll_area)

        body_layout.addWidget(self.center_stack, stretch=1)
        body_layout.addWidget(self.sidebar_panel)
        main_layout.addLayout(body_layout)

        self.sidebar_collapsed = False
        self.sidebar_toggle = QPushButton("❮❮", self.central_widget)
        self.sidebar_toggle.setToolTip("Hide lesson list")
        self.sidebar_toggle.setFixedSize(46, 92)
        self.sidebar_toggle.setFont(QFont("Comic Sans MS", 15, QFont.Bold))
        self.sidebar_toggle.setCursor(Qt.PointingHandCursor)
        self.sidebar_toggle.setStyleSheet("""
            QPushButton {
                background: rgba(255, 255, 255, 0.92);
                color: #0f172a;
                border: 3px solid #38bdf8;
                border-radius: 20px;
            }
            QPushButton:hover { background: #38bdf8; color: white; }
        """)
        self.sidebar_toggle.clicked.connect(self.toggle_sidebar)
        self.sidebar_toggle.hide()

        self.update_app_style()
        self.create_login_screen()

        self.logout_btn = QPushButton("↩ LOGOUT 🚪", self.central_widget)
        self.logout_btn.setCursor(Qt.PointingHandCursor)
        self.logout_btn.setFont(QFont("Arial", 12, QFont.Bold))
        self.logout_btn.setFixedSize(120, 42)
        self.logout_btn.setStyleSheet("""
            QPushButton {
                background: #7dd3fc;
                color: #083344;
                border: 2px solid #38bdf8;
                border-radius: 18px;
                padding: 6px 12px;
            }
            QPushButton:hover {
                background: #38bdf8;
                color: white;
            }
        """)
        self.logout_btn.clicked.connect(self.logout)
        self.logout_btn.hide()

        self.apply_responsive_layout()

        intro = resource_path(CONFIG["intro_video"]) if CONFIG.get("intro_video") else ""
        if intro and os.path.exists(intro):
            self.login_overlay.hide()
            self.intro_overlay = IntroOverlay(self.central_widget, intro, self._after_intro)
            self.intro_overlay.setGeometry(self.central_widget.rect())
            QTimer.singleShot(300, self.intro_overlay.play)

    def _after_intro(self):
        self.login_overlay.setGeometry(self.central_widget.rect())
        self.login_overlay.show()
        self.login_overlay.raise_()
        self.email_input.setFocus()

    def on_web_page_loaded(self, success):
        self.web_page_ready = True
        if self.center_stack.currentIndex() == 1:
            self.push_active_lesson_to_ui()

    def logout(self):
        close_opencv_windows()
        self._finish_logout()

    def _finish_logout(self):
        self.user_info = {}
        self._logged_in = False
        self.locks.set_account_licences([])
        self.refresh_locks()
        round_pix = make_round_pixmap(resource_path(LOGO), 46)
        if round_pix:
            self.avatar_btn.setIcon(QIcon(round_pix))
        if hasattr(self, "show_home"):
            self.show_home()
        elif hasattr(self, "home_btn"):
            self.home_btn.click()

        self.sidebar_panel.hide()
        self.center_stack.setEnabled(True)
        self.home_btn.setEnabled(False)
        self.theme_btn.setEnabled(False)
        self.music_btn.setEnabled(False)
        self.avatar_btn.setEnabled(False)

        if not self._use_server():
            self.email_input.setText(DUMMY_CREDENTIALS["email"])
            self.password_input.setText(DUMMY_CREDENTIALS["password"])
        else:
            self.password_input.clear()
        self.name_input.clear()
        self.login_status.setText("")
        self.logout_btn.hide()
        self.sidebar_toggle.hide()

        self.login_overlay.show()
        self.login_overlay.setGeometry(self.central_widget.rect())
        self.login_overlay.raise_()
        self.email_input.setFocus()

    def create_login_screen(self):
        self.sidebar_panel.hide()
        if hasattr(self, "sidebar_toggle"):
            self.sidebar_toggle.hide()
        self.center_stack.setEnabled(True)
        self.home_btn.setEnabled(False)
        self.theme_btn.setEnabled(False)
        self.music_btn.setEnabled(False)
        self.avatar_btn.setEnabled(False)

        self.user_info = {}
        self._logged_in = False
        self.login_mode = "login"

        self.login_overlay = QFrame(self.central_widget)
        self.login_overlay.setObjectName("LoginOverlay")
        self.login_overlay.setStyleSheet("""
            QFrame#LoginOverlay {
                background-color: rgba(15, 23, 42, 0.35);
            }
        """)

        overlay_layout = QVBoxLayout(self.login_overlay)
        overlay_layout.setContentsMargins(30, 25, 30, 25)
        overlay_layout.setAlignment(Qt.AlignCenter)

        self.login_card = QFrame()
        self.login_card_base_size = (460, 600)
        self.login_card.setFixedSize(*self.login_card_base_size)
        self.login_card.setStyleSheet("""
            QFrame {
                background: rgba(255, 255, 255, 0.90);
                border: 4px solid #38bdf8;
                border-radius: 35px;
            }
            QLabel {
                border: none;
                background: transparent;
                color: #0f172a;
            }
            QLineEdit {
                background: white;
                color: #0f172a;
                border: 3px solid #7dd3fc;
                border-radius: 18px;
                padding: 12px;
                font-size: 18px;
                font-weight: bold;
            }
            QLineEdit:focus {
                border: 4px solid #facc15;
            }
        """)

        card_layout = QVBoxLayout(self.login_card)
        card_layout.setContentsMargins(28, 20, 28, 20)
        card_layout.setSpacing(8)

        img_label = QLabel()
        img_label.setAlignment(Qt.AlignCenter)
        img_label.setFixedSize(90, 90)
        resolved_logo = resource_path(LOGO)
        if os.path.exists(resolved_logo):
            pixmap = QPixmap(resolved_logo).scaled(90, 90, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            img_label.setPixmap(pixmap)
        else:
            img_label.setText("👦")
            img_label.setStyleSheet("font-size: 50px;")

        self.login_title = QLabel("WELCOME! 🎉")
        self.login_title.setAlignment(Qt.AlignCenter)
        self.login_title.setFont(QFont("Comic Sans MS", 20, QFont.Bold))

        self.login_subtitle = QLabel(CONFIG["login_subtitle"])
        self.login_subtitle.setAlignment(Qt.AlignCenter)
        self.login_subtitle.setWordWrap(True)
        self.login_subtitle.setStyleSheet("font-size: 14px; color: #065f46; font-weight: bold;")

        name_label = QLabel("FULL NAME 👤")
        name_label.setStyleSheet("font-size: 13px; font-weight: bold; color: #0284c7;")
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("e.g. Alex Student")
        self.name_input.setClearButtonEnabled(True)
        self.name_container = QWidget()
        name_l = QVBoxLayout(self.name_container)
        name_l.setContentsMargins(0, 0, 0, 0)
        name_l.setSpacing(2)
        name_l.addWidget(name_label)
        name_l.addWidget(self.name_input)
        self.name_container.hide()

        email_label = QLabel("EMAIL 📧")
        email_label.setStyleSheet("font-size: 13px; font-weight: bold; color: #0284c7;")

        self.email_input = QLineEdit()
        self.email_input.setPlaceholderText("parent@example.com" if self._use_server() else "kid@codingfun.com")
        if not self._use_server():
            self.email_input.setText(DUMMY_CREDENTIALS["email"])
        self.email_input.setClearButtonEnabled(True)

        pass_label = QLabel("PASSWORD 🔑")
        pass_label.setStyleSheet("font-size: 13px; font-weight: bold; color: #0284c7;")

        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("kid123")
        if not self._use_server():
            self.password_input.setText(DUMMY_CREDENTIALS["password"])
        self.password_input.setEchoMode(QLineEdit.Password)
        self.password_input.returnPressed.connect(self.on_submit_pressed)

        self.demo_hint = QLabel(
            "Demo login →      📧 kid@codingfun.com   🔑 kid123\n"
            "Any credentials work — no internet needed! ✨"
        )
        if self._use_server():
            self.demo_hint.setText("Log in with the parent's account from the website 🌐\n"
                                   "No internet? You can still try the free lessons ✨")
        self.demo_hint.setAlignment(Qt.AlignCenter)
        self.demo_hint.setWordWrap(True)
        self.demo_hint.setStyleSheet(
            "font-size: 12px; font-weight: bold; color: #065f46; "
            "background: #ecfdf5; border: 2px dashed #34d399; border-radius: 12px; padding: 6px;"
        )

        self.login_status = QLabel("")
        self.login_status.setAlignment(Qt.AlignCenter)
        self.login_status.setWordWrap(True)
        self.login_status.setStyleSheet("font-size: 14px; font-weight: bold; color: #dc2626;")

        self.loading_bar = QProgressBar()
        self.loading_bar.setRange(0, 0)
        self.loading_bar.setFixedHeight(16)
        self.loading_bar.setStyleSheet("""
            QProgressBar {
                border: 2px solid #38bdf8;
                border-radius: 8px;
                background: #e0f2fe;
            }
            QProgressBar::chunk {
                background: #38bdf8;
                border-radius: 6px;
            }
        """)
        self.loading_bar.hide()

        self.login_btn = QPushButton("🚀 LOGIN & START LEARNING ⭐")
        self.login_btn.setMinimumHeight(44)
        self.login_btn.setFont(QFont("Comic Sans MS", 13, QFont.Bold))
        self.login_btn.setCursor(Qt.PointingHandCursor)
        self.login_btn.setStyleSheet("""
            QPushButton {
                background: #ffd166;
                color: #0f172a;
                border: 3px solid #f59e0b;
                border-radius: 20px;
                padding: 8px;
            }
            QPushButton:hover {
                background: #38bdf8;
                color: white;
                border-color: #0284c7;
            }
        """)
        self.login_btn.clicked.connect(self.on_submit_pressed)

        self.toggle_mode_btn = QPushButton("New here? Create an account ✨")
        self.toggle_mode_btn.setMinimumHeight(36)
        self.toggle_mode_btn.setFont(QFont("Comic Sans MS", 11, QFont.Bold))
        self.toggle_mode_btn.setCursor(Qt.PointingHandCursor)
        self.toggle_mode_btn.setStyleSheet("""
            QPushButton {
                background: transparent;
                color: #0284c7;
                border: none;
                padding: 4px;
                text-decoration: underline;
            }
            QPushButton:hover { color: #0f766e; }
        """)
        self.toggle_mode_btn.clicked.connect(self.toggle_login_mode)

        card_layout.addWidget(img_label, alignment=Qt.AlignCenter)
        card_layout.addWidget(self.login_title)
        card_layout.addWidget(self.login_subtitle)
        card_layout.addWidget(self.name_container)
        card_layout.addWidget(email_label)
        card_layout.addWidget(self.email_input)
        card_layout.addWidget(pass_label)
        card_layout.addWidget(self.password_input)
        card_layout.addWidget(self.demo_hint)
        card_layout.addWidget(self.login_status)
        card_layout.addWidget(self.loading_bar)
        card_layout.addWidget(self.login_btn)
        card_layout.addWidget(self.toggle_mode_btn)

        row = QHBoxLayout()
        row.addStretch()
        row.addWidget(self.login_card)
        row.addStretch()
        overlay_layout.addLayout(row, 0)
        overlay_layout.setAlignment(row, Qt.AlignCenter)

        self.login_overlay.raise_()
        self.login_overlay.show()
        QTimer.singleShot(100, self.email_input.setFocus)

    def toggle_login_mode(self):
        if self.login_mode == "login":
            self.login_mode = "register"
            self.name_container.show()
            self.login_title.setText("CREATE ACCOUNT 🚀")
            self.login_subtitle.setText("Join the adventure — it only takes a second ✨")
            self.login_btn.setText("📝 REGISTER & START ⭐")
            self.toggle_mode_btn.setText("Already have an account? Login 🔑")
        else:
            self.login_mode = "login"
            self.name_container.hide()
            self.login_title.setText("WELCOME! 🎉")
            self.login_subtitle.setText(CONFIG["login_subtitle"])
            self.login_btn.setText("🚀 LOGIN & START LEARNING ⭐")
            self.toggle_mode_btn.setText("New here? Create an account ✨")
        self.login_status.setText("")
        self.apply_login_card_scale()

    def on_submit_pressed(self):
        if self.login_mode == "login":
            self.check_login()
        else:
            self.start_register()

    def _start_loading(self, message):
        self.login_status.setStyleSheet("font-size: 14px; font-weight: bold; color: #2563eb;")
        self.login_status.setText(message)
        self.loading_bar.show()
        self.login_btn.setEnabled(False)
        self.toggle_mode_btn.setEnabled(False)
        self.email_input.setEnabled(False)
        self.password_input.setEnabled(False)
        self.name_input.setEnabled(False)
        self.login_btn.setText("⏳ Please wait...")

    def _stop_loading(self):
        self.loading_bar.hide()
        self.login_btn.setEnabled(True)
        self.toggle_mode_btn.setEnabled(True)
        self.email_input.setEnabled(True)
        self.password_input.setEnabled(True)
        self.name_input.setEnabled(True)
        if self.login_mode == "login":
            self.login_btn.setText("🚀 LOGIN & START LEARNING ⭐")
        else:
            self.login_btn.setText("📝 REGISTER & START ⭐")

    def _show_error(self, message):
        self.login_status.setStyleSheet("font-size: 14px; font-weight: bold; color: #dc2626;")
        self.login_status.setText("❌ " + message)
        self.password_input.clear()
        self.password_input.setFocus()

    def check_login(self):
        email = self.email_input.text().strip()
        password = self.password_input.text()
        if not email or not password:
            self._show_error("Please enter both email and password.")
            return
        self._start_loading("⏳ Logging in...")
        if self._use_server():
            self._pending_email = email
            self._api_kind = "login"
            self.api.start("/v3/login", {"email": email, "password": password})
            return
        self.simulated_delay = ("login", email)
        QTimer.singleShot(900, self._complete_dummy_login)

    def _use_server(self):
        return bool((CONFIG["server"].get("url") or "").strip())

    def _api_answer(self, answer, error):
        kind, self._api_kind = self._api_kind, None
        if kind == "login":
            email = getattr(self, "_pending_email", "")
            if error == "offline":
                # No internet: let the child in; the locks stay as they are
                self.user_info = dict(DUMMY_USER, full_name="Learner", email=email)
                self.locks.set_account_licences([])
                self.refresh_locks()
                self._finish_login_success()
                self.login_status.setText("📴 No internet — the free lessons are open ✨")
                return
            if error or not answer or not answer.get("ok"):
                self._stop_loading()
                self._show_error((answer or {}).get("error") or error or "Wrong email or password.")
                return
            self.user_info = dict(DUMMY_USER, full_name=answer.get("name") or "Learner",
                                  email=answer.get("email") or email, role="Parent account",
                                  auth_provider="Ada The Coder website")
            self.locks.set_account_licences(answer.get("licences") or [])
            self.refresh_locks()
            self._finish_login_success()
        elif kind == "register":
            if error == "offline":
                self._stop_loading()
                self._show_error("No internet. Connect and try again 🌐")
                return
            if error or not answer or not answer.get("ok"):
                self._stop_loading()
                errors = (answer or {}).get("errors") or {}
                if isinstance(errors, dict):
                    errors = list(errors.values())
                msg = " ".join(str(e) for e in errors) if errors else ((answer or {}).get("error") or error or "Could not create the account.")
                self._show_error(msg)
                return
            self.simulated_register = (answer.get("name") or "", answer.get("email") or "")
            self._complete_dummy_register()

    def _complete_dummy_login(self):
        if not getattr(self, "simulated_delay", None):
            return
        _, email = self.simulated_delay
        self.simulated_delay = None
        self.user_info = dict(DUMMY_USER)
        self.user_info["email"] = email or DUMMY_USER["email"]
        self._finish_login_success()

    def _finish_login_success(self):
        self._stop_loading()
        self._logged_in = True
        display_name = (self.user_info.get("full_name") or self.user_info.get("email") or "Learner")
        self.login_status.setStyleSheet("font-size: 15px; font-weight: bold; color: #16a34a;")
        self.login_status.setText("✅ Welcome, %s! 🎉" % str(display_name))

        self.center_stack.setEnabled(True)
        self.home_btn.setEnabled(True)
        self.theme_btn.setEnabled(True)
        self.music_btn.setEnabled(True)
        self.avatar_btn.setEnabled(True)
        self.sidebar_collapsed = False
        self.refresh_locks()
        self.sidebar_panel.show()
        self.sidebar_toggle.setText("❮❮")
        self.sidebar_toggle.show()
        self._position_sidebar_toggle()
        self.logout_btn.show()
        self.logout_btn.raise_()

        QTimer.singleShot(1200, self.login_overlay.hide)

    def start_register(self):
        full_name = self.name_input.text().strip()
        email = self.email_input.text().strip()
        password = self.password_input.text()
        if not full_name:
            self._show_error("Please enter your full name.")
            return
        if not email:
            self._show_error("Please enter your email.")
            return
        if not password:
            self._show_error("Please enter a password.")
            return
        self._start_loading("⏳ Creating your account...")
        if self._use_server():
            self._api_kind = "register"
            self.api.start("/v3/register", {"name": full_name, "email": email, "password": password})
            return
        self.simulated_register = (full_name, email)
        QTimer.singleShot(900, self._complete_dummy_register)

    def _complete_dummy_register(self):
        if not getattr(self, "simulated_register", None):
            return
        full_name, email = self.simulated_register
        self.simulated_register = None
        self._stop_loading()
        self.login_status.setStyleSheet("font-size: 14px; font-weight: bold; color: #16a34a;")
        self.login_status.setText("✅ Account created! You can login now. 🎉")
        self.name_input.clear()
        self.toggle_login_mode()
        self.email_input.setText(email)
        self.password_input.clear()
        self.email_input.setFocus()

    def toggle_sidebar(self):
        if self.sidebar_collapsed:
            self.expand_sidebar()
        else:
            self.collapse_sidebar()

    def collapse_sidebar(self):
        self.sidebar_collapsed = True
        self.sidebar_panel.hide()
        self.sidebar_toggle.setText("❯❯")
        self.sidebar_toggle.setToolTip("Show lesson list")
        self._position_sidebar_toggle()

    def expand_sidebar(self):
        self.sidebar_collapsed = False
        self.sidebar_panel.show()
        self.sidebar_toggle.setText("❮❮")
        self.sidebar_toggle.setToolTip("Hide lesson list")
        self.update_sidebar_highlight()
        self._position_sidebar_toggle()

    def _position_sidebar_toggle(self):
        if not hasattr(self, "sidebar_toggle"):
            return
        cw = self.central_widget.width()
        ch = self.central_widget.height()
        y = max((ch - self.sidebar_toggle.height()) // 2, 60)
        if not self.sidebar_collapsed and self.sidebar_panel.isVisible():
            x = cw - self.sidebar_panel.width() - 26
        else:
            x = cw - self.sidebar_toggle.width() - 4
        self.sidebar_toggle.move(x, y)
        self.sidebar_toggle.raise_()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self.apply_responsive_layout()
        if hasattr(self, 'sidebar_toggle'):
            self._position_sidebar_toggle()
        if hasattr(self, 'login_overlay'):
            self.login_overlay.setGeometry(self.central_widget.rect())
            self.apply_login_card_scale()
            if self.login_overlay.isVisible():
                self.login_overlay.raise_()
        if getattr(self, 'intro_overlay', None) and not self.intro_overlay.finished:
            self.intro_overlay.setGeometry(self.central_widget.rect())
            self.intro_overlay.raise_()
        if hasattr(self, 'logout_btn'):
            self.logout_btn.move(18, 18)
            if self.logout_btn.isVisible():
                self.logout_btn.raise_()
        if hasattr(self, 'ai_watermark') and hasattr(self, 'video_widget'):
            self.ai_watermark.move(25, 10)

    def apply_login_card_scale(self):
        if not hasattr(self, "login_card"):
            return
        w = self.central_widget.width()
        h = self.central_widget.height()
        base_w, base_h = self.login_card_base_size
        scale = min(w / (base_w + 120), h / (base_h + 120))
        scale = max(min(scale, 1.0), 0.6)
        self.login_card.setFixedSize(max(int(base_w * scale), 300), max(int(base_h * scale), 360))

    def apply_responsive_layout(self):
        w = self.width()
        h = self.height()
        scale = min(w / 1180.0, h / 760.0)
        scale = max(min(scale, 1.15), 0.35)

        sidebar_w = max(160, min(self.sidebar_base_width, int(w * 0.20)))
        self.sidebar_panel.setFixedWidth(sidebar_w)

        title_font = QFont("Comic Sans MS", max(int(46 * scale), 16), QFont.Bold)
        self.hero_title.setFont(title_font)

        sub_font = QFont("Comic Sans MS", max(int(22 * scale), 11), QFont.Bold)
        self.hero_sub.setFont(sub_font)

        char_scale = max(0.25, min(1.0, scale))
        char_spacing = max(int(30 * char_scale), 6)
        self.char_layout.setSpacing(char_spacing)

        avail_w = self.char_container.width() or (w - sidebar_w - 60)
        avail_h = (self.hero_panel.height() or h) * 0.62
        per_slot = max((avail_w - 2 * char_spacing) / 3.0, 60)
        fit_scale = min(char_scale, per_slot / 360.0, avail_h / 430.0)
        fit_scale = max(fit_scale, 0.18)
        for char_widget in self.char_widgets:
            char_widget.set_scale(fit_scale)

        hero_spacing = max(int(45 * scale), 6)
        self.hero_layout.setSpacing(hero_spacing)

        if w < 700:
            self.home_btn.setText("🏠")
            self.home_btn.setFixedSize(48, 48)
        else:
            self.home_btn.setText("🏠 Home Screen 🌟")
            self.home_btn.setFixedSize(208, 48)

        self.apply_login_card_scale()

    def update_sidebar_highlight(self):
        for idx, widget in enumerate(self.topic_widgets):
            widget.update_style(idx == self.current_lesson_index)

    def load_lesson_by_index(self, lesson_id):
        close_opencv_windows()
        for idx, topic in enumerate(TOPICS):
            if topic["id"] == lesson_id:
                if self.locks.is_locked(idx + 1):
                    self.show_locked_dialog(idx)
                    return
                self.current_lesson_index = idx
                break
        self.load_lesson_active()

    # ---------- locks ----------
    def refresh_locks(self):
        for idx, widget in enumerate(self.topic_widgets):
            widget.set_locked(self.locks.is_locked(idx + 1))
        if hasattr(self, "key_action"):
            self.key_action.setVisible(bool(self.locks.secret) and not self.locks.licence_key)

    def show_locked_dialog(self, idx):
        topic = TOPICS[idx]
        box = QMessageBox(self)
        box.setWindowTitle("Locked lesson 🔒")
        box.setTextFormat(Qt.RichText)
        box.setText(
            "<div style='font-family: Comic Sans MS; font-size: 15px; color: #0f172a;'>"
            "<h2 style='color:#0284c7;'>🔒 %s %s</h2>"
            "<p>Lesson %d is locked.</p>"
            "<p>Lesson 1 is free to try. Ask a grown-up to unlock the rest ⭐</p>"
            "</div>" % (topic["emoji"], html.escape(topic["name"]), idx + 1)
        )
        pix = make_round_pixmap(resource_path(LOGO), 96)
        if pix:
            box.setIconPixmap(pix)
        box.setStyleSheet("QMessageBox { background: #ffffff; }")
        key_btn = box.addButton("🔑 Enter licence key", QMessageBox.AcceptRole) if self.locks.secret else None
        up_btn = box.addButton("⭐ Upgrade", QMessageBox.ActionRole)
        box.addButton("Not now", QMessageBox.RejectRole)
        box.exec_()
        if key_btn is not None and box.clickedButton() is key_btn:
            self.ask_licence_key()
        elif box.clickedButton() is up_btn:
            self.open_upgrade()

    def open_upgrade(self):
        url = CONFIG["locks"].get("upgrade_url")
        if url:
            webbrowser.open(url)

    def ask_licence_key(self):
        prefix = self.locks.prefix
        key, ok = QInputDialog.getText(self, "Licence key 🔑",
                                       "Type the licence key (it looks like %s-XXXX-XXXX-XXXX):" % prefix)
        if not ok or not key.strip():
            return
        if self.locks.enter_key(key):
            self.refresh_locks()
            QMessageBox.information(self, "Unlocked! 🎉", "Every lesson is open now. Have fun coding! 🚀")
        else:
            QMessageBox.warning(self, "Licence key 🔑", "That key doesn't work for this app. Check it and try again.")

    def _ask_pin(self):
        pin, ok = QInputDialog.getText(self, "Grown-ups only 🔐", "Admin PIN:", QLineEdit.Password)
        if not ok:
            return False
        if self.locks.check_pin(pin):
            return True
        QMessageBox.warning(self, "Grown-ups only 🔐", "That PIN is not right.")
        return False

    def show_locks_dialog(self):
        if not self._ask_pin():
            return
        if LessonLocksDialog(self, self.locks).exec_():
            self.refresh_locks()
            if self.locks.is_locked(self.current_lesson_index + 1) and self.center_stack.currentIndex() == 1:
                self.show_home()

    def load_lesson(self, lesson_id):
        self.load_lesson_by_index(lesson_id)

    def push_active_lesson_to_ui(self):
        topic = TOPICS[self.current_lesson_index]
        lesson_id = topic["id"]
        self.bridge.set_current_lesson(lesson_id)
        
        lesson_info = LESSONS_DATA.get(lesson_id, LESSONS_DATA["lesson1"])
        title_clean = lesson_info["title"]
        subtitle_clean = lesson_info["subtitle"]
        examples_clean = lesson_info["examples"]
        code_clean = lesson_info["default_code"]

        dark_bool = "true" if self.is_dark_mode else "false"
        music_bool = "true" if self.is_music_on else "false"

        js_cmd = f"""
        updateLessonData(
            {json.dumps(title_clean)},
            {json.dumps(subtitle_clean)},
            {json.dumps(examples_clean)},
            {json.dumps(code_clean)}
        );
        setDarkMode({dark_bool});
        toggleAudioEngine({music_bool});
        """
        self.lesson_viewer.page().runJavaScript(js_cmd)

    def load_lesson_active(self):
        close_opencv_windows()
        self.update_sidebar_highlight()
        topic = TOPICS[self.current_lesson_index]
        lesson_id = topic["id"]
        self.bridge.set_current_lesson(lesson_id)
        
        lesson_info = LESSONS_DATA.get(lesson_id, LESSONS_DATA["lesson1"])
        vid_path = lesson_info.get("video_path") or ""
        self.seek_slider.blockSignals(True)
        self.seek_slider.setRange(0, 0)
        self.seek_slider.setValue(0)
        self.seek_slider.blockSignals(False)
        self.time_label.setText("00:00")
        self.duration_label.setText("00:00")
        has_video = bool(vid_path) and os.path.exists(vid_path)
        self.play_vid_btn.setVisible(has_video)
        if not has_video:
            self.media_player.stop()
            self.media_player.setMedia(QMediaContent())
            self.center_stack.setCurrentIndex(1)
            self.lesson_stack.setCurrentIndex(1)
            self.update_app_style()
            self.push_active_lesson_to_ui()
            return
        self.media_player.setMedia(QMediaContent(QUrl.fromLocalFile(vid_path)))

        self.center_stack.setCurrentIndex(1)
        self.lesson_stack.setCurrentIndex(0)
        self.media_player.setPosition(0)
        self.media_player.play()
        self.video_timer.start()
        self.update_app_style()

        self.push_active_lesson_to_ui()

    def handle_media_state(self, state):
        if state == QMediaPlayer.StoppedState and self.lesson_stack.currentIndex() == 0:
            self.lesson_stack.setCurrentIndex(1)
            self.push_active_lesson_to_ui()
            self.lesson_viewer.page().runJavaScript("playTwinkleChime(); showTutorialOverlay();")

    def _format_time(self, ms):
        total_sec = max(int(ms / 1000), 0)
        return "%02d:%02d" % (total_sec // 60, total_sec % 60)

    def _update_time_label(self):
        self.time_label.setText(self._format_time(self.seek_slider.value()))
        dur = self.seek_slider.maximum()
        self.duration_label.setText(self._format_time(dur))

    def _on_position_changed(self, pos):
        if not self._seek_dragging:
            self.seek_slider.blockSignals(True)
            self.seek_slider.setValue(pos)
            self.seek_slider.blockSignals(False)
            self._update_time_label()

    def _tick_position(self):
        if self.lesson_stack.currentIndex() != 0:
            return
        dur = self.media_player.duration()
        if dur > 0 and self.seek_slider.maximum() != dur:
            self.seek_slider.setRange(0, dur)
        if dur <= 0:
            if self.media_player.state() == QMediaPlayer.PlayingState:
                self.time_label.setText("--:--")
                self.duration_label.setText("--:--")
            return
        pos = self.media_player.position()
        if not self._seek_dragging:
            self.seek_slider.blockSignals(True)
            self.seek_slider.setValue(pos)
            self.seek_slider.blockSignals(False)
            self.time_label.setText(self._format_time(pos))
            self.duration_label.setText(self._format_time(dur))

    def _on_lesson_stack_changed(self, index):
        if index == 0:
            self.video_timer.start()
        else:
            self.video_timer.stop()

    def _on_duration_changed(self, dur):
        self.seek_slider.setRange(0, dur)
        self._update_time_label()

    def _seek_pressed(self):
        self._seek_dragging = True

    def _on_seek_slider_moved(self, pos):
        self.time_label.setText(self._format_time(pos))

    def _seek_released(self):
        self._seek_dragging = False
        self.media_player.setPosition(self.seek_slider.value())
        self._update_time_label()

    def toggle_play_pause_media(self):
        if self.media_player.state() == QMediaPlayer.PlayingState:
            self.media_player.pause()
        else:
            self.media_player.play()

    def toggle_mute_media(self):
        muted = not self.media_player.isMuted()
        self.media_player.setMuted(muted)
        if muted:
            self.volume_btn.setText("🔇")
            self.last_unmuted_volume = self.volume_slider.value() or 100
            self.volume_slider.blockSignals(True)
            self.volume_slider.setValue(0)
            self.volume_slider.blockSignals(False)
        else:
            self.volume_btn.setText("🔊")
            self.volume_slider.blockSignals(True)
            self.volume_slider.setValue(self.last_unmuted_volume)
            self.volume_slider.blockSignals(False)
            self.media_player.setVolume(self.last_unmuted_volume)

    def _on_volume_slider_changed(self, value):
        if value > 0 and self.media_player.isMuted():
            self.media_player.setMuted(False)
        self.media_player.setVolume(value)
        if value == 0:
            self.volume_btn.setText("🔇")
        else:
            self.volume_btn.setText("🔊")
            self.last_unmuted_volume = value

    def _on_media_state_for_controls(self, state):
        if state == QMediaPlayer.PlayingState:
            self.play_pause_btn.setText("⏸ Pause")
        else:
            self.play_pause_btn.setText("▶ Play")
        self._tick_position()

    def show_profile_dialog(self):
        u = dict(DUMMY_USER)
        u.update(self.user_info or {})
        name = u.get("full_name") or "N/A"
        email = u.get("email") or "N/A"
        role = u.get("role") or "N/A"
        user_id = u.get("id") or "N/A"
        avatar = u.get("avatar_url") or "Default"
        bio = u.get("bio") or "N/A"
        gender = u.get("gender") or "N/A"
        address = u.get("address") or "N/A"
        provider = u.get("auth_provider") or "N/A"
        active = "✅ Yes" if u.get("is_active") else "❌ No"
        created = u.get("created_at") or "N/A"

        box = QMessageBox(self)
        box.setWindowTitle("Profile 👤")
        box.setTextFormat(Qt.RichText)
        box.setText(
            "<div style='font-family: Comic Sans MS; font-size: 14px; color: #0f172a;'>"
            "<h2 style='color:#0284c7;'>👤 My Profile 🌟</h2>"
            "<p style='background:#f0f9ff; border-radius:8px; padding:10px;'>"
            "<b>🆔 User ID:</b> %s<br>"
            "<b>👤 Full Name:</b> %s<br>"
            "<b>📧 Email:</b> %s<br>"
            "<b>🎓 Role:</b> %s<br>"
            "<b>🖼️ Avatar:</b> %s<br>"
            "<b>📝 Bio:</b> %s<br>"
            "<b>⚧ Gender:</b> %s<br>"
            "<b>📍 Address:</b> %s<br>"
            "<b>🔐 Auth Provider:</b> %s<br>"
            "<b>⚡ Active:</b> %s<br>"
            "<b>🗓️ Created At:</b> %s"
            "</p>"
            "<p style='font-size:12px; color:#065f46;'>✨ Demo data — no internet or server needed! 🚀</p>"
            "</div>" % (user_id, name, email, role, avatar, bio, gender, address, provider, active, created)
        )
        default_pix = make_round_pixmap(resource_path(LOGO), 120)
        if default_pix:
            box.setIconPixmap(default_pix)
        box.setStyleSheet("QMessageBox { background: #ffffff; }")
        box.setStandardButtons(QMessageBox.Ok)
        box.exec_()

    def show_license_dialog(self):
        lic = DUMMY_LICENSE
        locked = self.locks.locked_numbers()
        total = len(TOPICS)
        if self.locks.licence_key:
            status = "UNLOCKED ✅ — every lesson is open"
            key = self.locks.licence_key
        elif self.locks.account_unlocked:
            status = "UNLOCKED ✅ — by the parent's account"
            key = "(website account)"
        elif locked:
            status = "%d of %d lessons open 🔒" % (total - len(locked), total)
            key = "none yet"
        else:
            status = "Every lesson is open ✅"
            key = "none needed"
        box = QMessageBox(self)
        box.setWindowTitle("License 📜")
        box.setTextFormat(Qt.RichText)
        box.setText(
            "<div style='font-family: Comic Sans MS; font-size: 14px; color: #0f172a;'>"
            "<h2 style='color:#0284c7;'>%s</h2>"
            "<p style='background:#fef9c3; border-radius:8px; padding:10px;'>"
            "<b>🎫 License Key:</b> %s<br>"
            "<b>👤 Licensed To:</b> %s<br>"
            "<b>📧 Email:</b> %s<br>"
            "<b>🎯 Plan:</b> %s<br>"
            "<b>⚡ Status:</b> %s<br>"
            "<b>🔢 Version:</b> %s"
            "</p>"
            "<p><b>📜 License:</b> Personal &amp; educational use only.</p>"
            "<p>%s</p>"
            "<p>This software is provided \"as is\", without warranty of any kind.</p>"
            "</div>"
            % (
                html.escape(CONFIG["name"]),
                html.escape(key),
                html.escape(str(self.user_info.get("full_name") or lic["holder_name"])),
                html.escape(str(self.user_info.get("email") or DUMMY_USER["email"])),
                lic["plan"],
                status,
                html.escape(str(CONFIG["version"])),
                html.escape(CONFIG["characters_note"]),
            )
        )
        box.setStyleSheet("QMessageBox { background: #ffffff; }")
        key_btn = up_btn = None
        if not self.locks.has_full_access and locked:
            key_btn = box.addButton("🔑 Enter licence key", QMessageBox.AcceptRole) if self.locks.secret else None
            up_btn = box.addButton("⭐ Upgrade", QMessageBox.ActionRole)
        box.addButton(QMessageBox.Ok)
        box.exec_()
        if key_btn is not None and box.clickedButton() is key_btn:
            self.ask_licence_key()
        elif up_btn is not None and box.clickedButton() is up_btn:
            self.open_upgrade()

    def handle_bottom_button_click(self):
        if self.lesson_stack.currentIndex() == 0:
            self.media_player.stop()
            self.lesson_stack.setCurrentIndex(1)
            self.push_active_lesson_to_ui()
            self.lesson_viewer.page().runJavaScript("playTwinkleChime(); showTutorialOverlay();")
        else:
            self.lesson_stack.setCurrentIndex(0)
            self.media_player.setPosition(0)
            self.media_player.play()

    def on_stack_index_changed(self, index):
        if index == 0:
            self.play_vid_btn.setText("Stop video player 🛑")
        else:
            self.play_vid_btn.setText("Play Video ▶️")

    def toggle_app_theme(self):
        self.is_dark_mode = not self.is_dark_mode
        if self.is_dark_mode:
            self.theme_btn.setText("🌙")
            self.theme_btn.setStyleSheet("background: #000000; border-radius: 24px; color: #facc15; border: 2px solid #facc15;")
        else:
            self.theme_btn.setText("☀️")
            self.theme_btn.setStyleSheet("background: rgba(255, 255, 255, 0.85); border-radius: 24px; color: #f59e0b; border: none;")
            
        self.update_app_style()
        dark_bool = "true" if self.is_dark_mode else "false"
        self.lesson_viewer.page().runJavaScript(f"setDarkMode({dark_bool});")

    def toggle_app_music(self):
        self.is_music_on = not self.is_music_on
        self.music_btn.setText("🔊" if self.is_music_on else "🔈")
        music_bool = "true" if self.is_music_on else "false"
        self.lesson_viewer.page().runJavaScript(f"toggleAudioEngine({music_bool});")

    def show_home(self):
        close_opencv_windows()
        self.media_player.stop()
        self.center_stack.setCurrentIndex(0)
        self.update_app_style()

    def update_app_style(self):
        if self.is_dark_mode:
            self.central_widget.setStyleSheet("QWidget#CentralWidget { background: %s; }" % CONFIG["colors"]["background_dark"])
            self.hero_panel.setStyleSheet("QFrame { background-color: rgba(15, 23, 42, 0.75); border-radius: 40px; }")
            self.hero_title.setStyleSheet("color: white;")
            self.hero_sub.setStyleSheet("color: #d1fae5;")
            self.sidebar_panel.setStyleSheet("QFrame { background: %s; border-radius: 40px; }" % CONFIG["colors"]["sidebar_dark"])
            self.sidebar_title.setStyleSheet("color: #d1fae5;")
        else:
            self.central_widget.setStyleSheet("QWidget#CentralWidget { background: %s; }" % CONFIG["colors"]["background"])
            self.hero_panel.setStyleSheet("QFrame { background-color: rgba(255, 255, 255, 0.45); border-radius: 40px; }")
            self.hero_title.setStyleSheet("color: #0f172a;")
            self.hero_sub.setStyleSheet("color: #065f46;")
            self.sidebar_panel.setStyleSheet("QFrame { background: %s; border-radius: 40px; }" % CONFIG["colors"]["sidebar"])
            self.sidebar_title.setStyleSheet("color: #064e3b;")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setApplicationName(CONFIG["name"])
    
    icon_p = resource_path(LOGO)
    if os.path.exists(icon_p):
        app.setWindowIcon(QIcon(icon_p))
        
    window = MainWindow()
    window.showMaximized()
    sys.exit(app.exec_())
