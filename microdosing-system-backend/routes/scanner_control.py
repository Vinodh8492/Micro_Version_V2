import subprocess
from flask import Blueprint, jsonify

scanner_ctrl = Blueprint("scanner_ctrl", __name__)
scanner_process = None

@scanner_ctrl.route('/start-scanner', methods=['POST'])
def start_scanner():
    global scanner_process
    if scanner_process is None or scanner_process.poll() is not None:
        scanner_process = subprocess.Popen(["python", "listener/scanner_listener.py"])
        return jsonify({"message": "Scanner started"}), 200
    return jsonify({"message": "Scanner already running"}), 200

@scanner_ctrl.route('/stop-scanner', methods=['POST'])
def stop_scanner():
    global scanner_process
    if scanner_process and scanner_process.poll() is None:
        scanner_process.terminate()
        scanner_process = None
        return jsonify({"message": "Scanner stopped"}), 200
    return jsonify({"message": "No scanner running"}), 200
