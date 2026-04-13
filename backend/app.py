from __future__ import annotations

import os

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from routes.chat import chat_bp
from routes.execute import execute_bp
from routes.history import history_bp
from routes.memory import memory_bp
from routes.model import model_bp
from services.llm_router import llm_router
from utils.helpers import ensure_storage_path, get_logger


logger = get_logger("app")


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, origins=["https://noxis-ai-alpha.vercel.app/"])


    ensure_storage_path(Config.HISTORY_PATH)
    ensure_storage_path(Config.MEMORY_PATH)

    app.register_blueprint(chat_bp)
    app.register_blueprint(history_bp)
    app.register_blueprint(memory_bp)
    app.register_blueprint(model_bp)
    app.register_blueprint(execute_bp)

    @app.get("/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "model": llm_router.get_model(),
                "metrics": llm_router.metrics(),
            }
        )

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Route not found"}), 404

    @app.errorhandler(Exception)
    def handle_error(err):
        logger.exception("Unhandled exception: %s", err)
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()


if __name__ == "__main__":
    frontend_url = os.getenv("FRONTEND_URL", "https://noxis-ai-alpha.vercel.app")
    backend_url = f"https://noxisai.onrender.com/"
    print("\nNoxis backend is starting...")
    print(f"Backend:  {backend_url}")
    print(f"Health:   {backend_url}/health")
    print(f"Frontend: {frontend_url}\n")
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.FLASK_DEBUG, threaded=True)
    
