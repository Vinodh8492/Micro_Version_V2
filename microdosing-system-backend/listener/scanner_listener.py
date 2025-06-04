# scanner_listener.py

import requests
from pynput import keyboard
from datetime import datetime
import openpyxl
import os
import winsound
import sys

barcode = ''
excel_file = 'scanned_barcodes.xlsx'

if not os.path.exists(excel_file):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Scans"
    ws.append(["Timestamp", "Barcode"])
    wb.save(excel_file)

def log_to_excel(barcode):
    wb = openpyxl.load_workbook(excel_file)
    ws = wb.active
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ws.append([timestamp, barcode])
    wb.save(excel_file)

def beep_success():
    winsound.Beep(1000, 200)

def on_press(key):
    global barcode
    if key == keyboard.Key.enter:
        print("📤 Sending barcode:", barcode)
        try:
            requests.post("http://localhost:5000/api/push-barcode", json={"barcode": barcode})
            log_to_excel(barcode)
            beep_success()
        except Exception as e:
            print("❌ Error sending barcode:", e)
        barcode = ''
    else:
        try:
            barcode += key.char
        except AttributeError:
            pass

listener = keyboard.Listener(on_press=on_press)
listener.start()
listener.join()
