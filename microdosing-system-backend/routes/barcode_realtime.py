from flask import Blueprint, request, jsonify
from extensions import socketio

barcode_bp = Blueprint("barcode_bp", __name__)

@barcode_bp.route("/push-barcode", methods=["POST"])
def push_barcode():
    try:
        data = request.get_json(force=True)

        if not data:
            print("❌ No JSON received")
            return jsonify({"error": "No JSON body provided"}), 400

        if "barcode" not in data:
            print("❌ 'barcode' field is missing in request")
            return jsonify({"error": "'barcode' field is required"}), 400

        barcode = data["barcode"]
        print(f"📦 Broadcasting barcode: {barcode}")

        # Broadcast to all connected clients
        socketio.emit("barcode_scanned", {"barcode": barcode})

        return jsonify({"message": "Broadcasted", "barcode": barcode}), 200

    except Exception as e:
        print(f"❌ Exception in push_barcode: {e}")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
