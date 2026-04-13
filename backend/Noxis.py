import json
import os
import datetime
import time
import webbrowser
import logging
import socket
import traceback
from dotenv import load_dotenv

load_dotenv()

# Tesseract — path built char by char to avoid any escape issues
try:
    import pytesseract
    _TESS_PATH = 'C:' + chr(92) + 'Program Files' + chr(92) + 'Tesseract-OCR' + chr(92) + 'tesseract.exe'
    pytesseract.pytesseract.tesseract_cmd = _TESS_PATH
    print('[OCR] Tesseract path:', _TESS_PATH)
except ImportError:
    pass

# ================= CONFIG =================
GROQ_KEY       = os.getenv("GROQ_KEY")
OPENROUTER_KEY = os.getenv("OPENROUTER_KEY")
GENAI_KEY      = os.getenv("GENAI_KEY")
SERP_API_KEY   = os.getenv("SERP_API_KEY")
NEWS_API_KEY   = os.getenv("NEWS_API_KEY")

if not GROQ_KEY:
    raise ValueError("GROQ_KEY missing from .env!")

# ================= LAZY CLIENTS =================
_groq_client       = None
_openrouter_client = None

def _get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_KEY)
    return _groq_client

def _get_openrouter():
    global _openrouter_client
    if _openrouter_client is None:
        from openai import OpenAI
        _openrouter_client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_KEY,
            timeout=20.0
        )
    return _openrouter_client


def generate_title(user_msg, ai_reply):
    """Generate a short smart title using Groq (fast, 3-6 words)."""
    try:
        prompt = (
            f"Given this conversation, generate a SHORT title (3-6 words max, no quotes, no punctuation at end):\n"
            f"User: {user_msg[:200]}\n"
            f"AI: {ai_reply[:200]}\n"
            f"Title:"
        )
        resp = _get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=20,
            temperature=0.7,
        )
        title = resp.choices[0].message.content.strip()
        # Clean up quotes if model added them
        title = title.strip('"\'').strip()
        return title[:50] if title else None
    except Exception as e:
        print(f"[Title] {e}")
        return None

def generate_title(user_msg, ai_reply):
    """Generate a short smart title using Groq (3-6 words)."""
    try:
        prompt = (
            "Given this conversation, generate a SHORT title "
            "(3-6 words max, no quotes, no punctuation at end).\n"
            "User: " + user_msg[:200] + "\n"
            "AI: " + ai_reply[:200] + "\n"
            "Title:"
        )
        resp = _get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=20,
            temperature=0.7,
        )
        title = resp.choices[0].message.content.strip()
        title = title.strip('"\'').strip()
        return title[:50] if title else None
    except Exception as e:
        print(f"[Title] {e}")
        return None


def warm_up_clients():
    """Pre-init clients after UI loads so first message is instant."""
    try: _get_groq()
    except Exception: pass
    try: _get_openrouter()
    except Exception: pass

# ================= GLOBALS =================
MEMORY_FILE    = "memory.json"
MAX_MEMORY     = 12
active_model   = None
personality    = "friendly"
response_style = "normal"
last_error     = ""

conversation_memory = []
_memory_dirty       = False

_last_net_check  = 0.0
_last_net_result = True
NET_CACHE_TTL    = 10

logging.basicConfig(
    filename="noxis.log",
    level=logging.ERROR,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# ================= INTENTS =================
INTENTS = {
    "coding":         ["code", "debug", "error", "python", "javascript", "function", "class", "api", "exception"],
    "explanation":    ["explain", "what is", "why", "how does", "meaning of"],
    "planning":       ["plan", "strategy", "roadmap", "steps to", "how to build"],
    "system_command": ["open", "delete", "run", "shutdown", "restart", "launch"],
}

def classify_intent(text: str) -> str:
    t = text.lower()
    for intent, keywords in INTENTS.items():
        if any(w in t for w in keywords):
            return intent
    return "casual_chat"

def route_request(intent: str) -> str:
    # Gemini quota exhausted — Groq is primary, OpenRouter is fallback
    if intent == "system_command":
        return "local_executor"
    return "groq"

# ================= MEMORY =================
def load_memory():
    global conversation_memory
    try:
        with open(MEMORY_FILE, "r") as f:
            data = json.load(f)
            conversation_memory = data if isinstance(data, list) else []
        # ⚡ If saved memory is already too large, wipe it
        total = sum(len(m.get("content","")) for m in conversation_memory)
        if total > 10000:
            print(f"[Noxis] memory.json too large ({total} chars), resetting.")
            conversation_memory = []
            save_memory()
    except (FileNotFoundError, json.JSONDecodeError):
        conversation_memory = []

def save_memory():
    global _memory_dirty
    if not _memory_dirty:
        return
    try:
        with open(MEMORY_FILE, "w") as f:
            json.dump(conversation_memory, f, indent=2)
        _memory_dirty = False
    except Exception as e:
        logging.error("SAVE MEMORY: " + str(e))

load_memory()

# ================= INTERNET =================
def internet_available() -> bool:
    global _last_net_check, _last_net_result
    now = time.monotonic()
    if now - _last_net_check < NET_CACHE_TTL:
        return _last_net_result
    # Try multiple hosts — some networks block 8.8.8.8
    hosts = [("8.8.8.8", 53), ("1.1.1.1", 53), ("9.9.9.9", 53)]
    for host, port in hosts:
        try:
            socket.create_connection((host, port), timeout=2)
            _last_net_result = True
            _last_net_check = now
            return True
        except OSError:
            continue
    _last_net_result = False
    _last_net_check = now
    return _last_net_result

# ================= TOOLS =================
def get_news() -> str:
    try:
        import requests
        url  = f"https://newsapi.org/v2/top-headlines?country=in&apiKey={NEWS_API_KEY}"
        data = requests.get(url, timeout=8).json()
        headlines = [a["title"] for a in data.get("articles", [])[:5] if a.get("title")]
        return "Headlines:\n" + "\n".join(headlines) if headlines else "No headlines."
    except Exception as e:
        return f"News fetch failed: {e}"

_tools_module = None
def handle_tool(query: str):
    global _tools_module
    if _tools_module is None:
        try:
            import tools; _tools_module = tools
        except ImportError:
            return None
    q = query.lower()
    if q.startswith("calculate"):
        return _tools_module.calculate(q.replace("calculate", "").strip())
    if q.startswith("save note"):
        return _tools_module.save_note(query.replace("save note", "").strip())
    if "read notes" in q:
        return _tools_module.read_notes()
    return None

# ================= COMMAND HANDLER =================
def handle_command(query: str):
    global personality, response_style
    q = query.lower().strip()

    if "time" in q:
        return "The time is " + datetime.datetime.now().strftime("%I:%M %p")
    if "date" in q:
        return "Today's date is " + datetime.datetime.now().strftime("%d %B %Y")

    if "search" in q:
        term = (q.replace("open chrome and","").replace("open chrome","")
                 .replace("search for","").replace("search","").strip())
        if term:
            webbrowser.open(f"https://www.google.com/search?q={term.replace(' ','+')}")
            return f"Searching for '{term}'."

    if q.startswith("open "):
        app_name = q[5:].strip()
        common = {"youtube","google","facebook","twitter","reddit",
                  "instagram","wikipedia","github","stackoverflow"}
        if app_name in common or "." in app_name:
            site = app_name if "." in app_name else app_name + ".com"
            site = site if site.startswith("http") else "https://" + site
            webbrowser.open(site); return f"Opening {app_name}."
        else:
            os.system(f"start {app_name}"); return f"Launching {app_name}."

    if "be friendly" in q:   personality="friendly";  return "Friendly mode on."
    if "be strict" in q:     personality="strict";    return "Strict mode on."
    if "answer briefly" in q or "short answers" in q:
        response_style="short";    return "Short answers mode."
    if "answer in detail" in q or "detailed answers" in q:
        response_style="detailed"; return "Detailed answers mode."
    if "news" in q: return get_news()
    return None

# ================= AI =================
def _build_system_prompt() -> str:
    return """You are Noxis, an AI assistant built by Ayush Aiwale for Unknown Universe.

IDENTITY:
- You are Noxis, built different from other AIs
- Created by Ayush Aiwale, a self-taught developer and founder of Unknown Universe
- You are NOT ChatGPT, NOT Claude, NOT Gemini. You are Noxis.

CORE PERSONALITY:
- Warm, encouraging, and genuinely knowledgeable
- Like a smart friend who actually wants to help, not just answer
- Never robotic, never overly formal, never boring

TONE ADAPTATION (crucial):
- Read how the user talks and mirror it naturally
- If user is formal -> stay clean and professional
- If user is casual -> match their energy
- If user says "bro" -> say "bro" back
- If user uses emojis -> use more emojis
- If user is short -> be concise
- If user writes long -> be detailed

FORMATTING RULES (always follow these strictly):
- Use **bold** for key terms and important points
- Use bullet points (- item) for lists, steps, comparisons
- Use numbered lists for ordered steps
- Use relevant emojis naturally throughout responses
- For code: always use markdown code blocks with language label
- Keep paragraphs short, 2-3 lines max
- End with a follow-up question or offer to go deeper

RESPONSE STRUCTURE:
- Lead with the answer immediately, no fluff intro
- Answer -> Details -> Example if needed -> Follow-up question
- Be encouraging when user is learning something new

EXAMPLE:

User: "what are the planets in solar system?"
Noxis: "Here are all 8 planets in our solar system!

**Rocky planets (inner):**
- Mercury, Venus, Earth, Mars

**Gas and Ice giants (outer):**
- Jupiter, Saturn, Uranus, Neptune

Fun fact: Pluto got demoted to a dwarf planet in 2006
Want to know more about any specific one? "

User: "bro explain recursion"
Noxis: "Recursion is basically a function calling itself bro!

Think of it like this:
- You look up a word in a dictionary
- The definition uses another word you don't know
- So you look THAT word up too
- Until you finally understand

Two rules to remember:
1. **Base case** - when to stop
2. **Recursive case** - call yourself with a smaller problem

Want me to show a real-world example? "
"""

# All available models for user selection
AVAILABLE_MODELS = [
    ("Auto (Fallback Chain)",   None,          None),
    ("Groq / LLaMA 3.3 70B",   "groq",        "llama-3.3-70b-versatile"),
    ("Groq / LLaMA 3.1 8B",    "groq",        "llama-3.1-8b-instant"),
    ("Groq / Mixtral 8x7B",    "groq",        "mixtral-8x7b-32768"),
    ("Groq / Gemma2 9B",       "groq",        "gemma2-9b-it"),
    ("OpenRouter / GPT-4o",    "openrouter",  "openai/gpt-4o"),
    ("OpenRouter / GPT-4o mini","openrouter", "openai/gpt-4o-mini"),
    ("OpenRouter / Claude 3.5","openrouter",  "anthropic/claude-3.5-sonnet"),
    ("OpenRouter / Gemini Pro","openrouter",  "google/gemini-pro"),
]

_pinned_provider = None
_pinned_model_id = None

def set_model(display_name):
    global _pinned_provider, _pinned_model_id, MODEL_CHAIN
    for name, provider, model_id in AVAILABLE_MODELS:
        if name == display_name:
            _pinned_provider = provider
            _pinned_model_id = model_id
            if provider and model_id:
                MODEL_CHAIN = [(provider, model_id)]
            else:
                MODEL_CHAIN = [
                    ("groq",       "llama-3.3-70b-versatile"),
                    ("openrouter", "openai/gpt-4o-mini"),
                ]
            return

# Model fallback chain — tries each in order until one works
MODEL_CHAIN = [
    ("groq",       "llama-3.3-70b-versatile"),
    ("openrouter", "openai/gpt-4o-mini"),
]

def ask_ai_with_model(prompt: str, model_choice: str) -> str:
    global conversation_memory, active_model, _memory_dirty, last_error

    if not isinstance(conversation_memory, list):
        conversation_memory = []

    sys_msg = {"role": "system", "content": _build_system_prompt()}
    if not conversation_memory or conversation_memory[0].get("role") != "system":
        conversation_memory.insert(0, sys_msg)
    else:
        conversation_memory[0] = sys_msg

    conversation_memory.append({"role": "user", "content": prompt})
    _memory_dirty = True

    # Aggressively trim by count
    if len(conversation_memory) > 7:
        conversation_memory = [conversation_memory[0]] + conversation_memory[-6:]

    # Trim by size — 413 fix
    total_chars = sum(len(m.get("content", "")) for m in conversation_memory)
    if total_chars > 10000:
        print(f"[Noxis] Payload too large ({total_chars} chars), trimming hard...")
        conversation_memory = [conversation_memory[0]] + conversation_memory[-2:]

    total_after = sum(len(m.get('content','')) for m in conversation_memory)
    print(f'[Noxis] Sending {len(conversation_memory)} msgs, ~{total_after} chars')

    reply = None
    errors = []

    for provider, model_id in MODEL_CHAIN:
        try:
            print(f"[Noxis] Trying {provider} / {model_id} ...")
            t = time.time()

            if provider == "groq":
                resp = _get_groq().chat.completions.create(
                    model=model_id,
                    messages=conversation_memory,
                    temperature=0.7,
                    timeout=25
                )
                reply = resp.choices[0].message.content.strip()
                active_model = f"Groq / LLaMA-3.3"

            elif provider == "openrouter":
                resp = _get_openrouter().chat.completions.create(
                    model=model_id,
                    messages=conversation_memory,
                    temperature=0.7
                )
                reply = resp.choices[0].message.content.strip()
                active_model = "OpenRouter / GPT-4o-mini"

            print(f"[Noxis] ✅ Reply in {time.time()-t:.1f}s from {active_model}")
            break  # success

        except Exception as e:
            msg = str(e)
            print(f"[Noxis] ❌ {provider} failed: {msg}")
            logging.error(f"{provider} ERROR: {msg}")
            errors.append(f"{provider}: {msg}")
            continue

    if not reply:
        err_summary = "\n".join(errors)
        last_error  = err_summary
        # Pop the user turn so memory stays clean
        if conversation_memory and conversation_memory[-1]["role"] == "user":
            conversation_memory.pop()
        return f"⚠️ All models failed:\n{err_summary}\n\nRun test_noxis.py to diagnose."

    reply = reply or "I couldn't generate a response."
    conversation_memory.append({"role": "assistant", "content": reply})
    if len(conversation_memory) > MAX_MEMORY + 1:
        conversation_memory = [conversation_memory[0]] + conversation_memory[-MAX_MEMORY:]
    save_memory()
    last_error = ""
    return reply

# ================= FILE & IMAGE PROCESSING =================
import os as _os

SUPPORTED_TEXT  = {".txt",".py",".js",".ts",".html",".css",".json",
                   ".csv",".md",".xml",".yaml",".yml",".java",".cpp",
                   ".c",".h",".rs",".go",".rb",".php",".swift",".kt"}
SUPPORTED_IMAGE = {".png",".jpg",".jpeg",".gif",".bmp",".webp"}

def _find_tesseract() -> str:
    """Return confirmed Tesseract path."""
    # Hardcoded — confirmed installed here
    hardcoded = 'C:' + chr(92) + 'Program Files' + chr(92) + 'Tesseract-OCR' + chr(92) + 'tesseract.exe'
    if _os.path.exists(hardcoded):
        return hardcoded
    # Fallback candidates
    candidates = [
        'C:' + chr(92) + 'Program Files (x86)' + chr(92) + 'Tesseract-OCR' + chr(92) + 'tesseract.exe',
        'C:' + chr(92) + 'Users' + chr(92) + 'Aayush' + chr(92) + 'AppData' + chr(92) + 'Local' + chr(92) + 'Programs' + chr(92) + 'Tesseract-OCR' + chr(92) + 'tesseract.exe',
        'C:' + chr(92) + 'tools' + chr(92) + 'Tesseract-OCR' + chr(92) + 'tesseract.exe',
    ]
    for p in candidates:
        if _os.path.exists(p):
            print(f"[OCR] Found Tesseract: {p}")
            return p
    return ""


def _get_genai_client():
    """Lazy Gemini client — only for vision fallback."""
    if not GENAI_KEY:
        print("[Vision] GENAI_KEY not set in .env")
        return None
    try:
        import google.genai as genai
        return genai.Client(api_key=GENAI_KEY)
    except Exception as e:
        print(f"[Vision] Gemini client error: {e}")
        return None

def _ocr_image(path: str) -> str:
    """
    Extract text/description from an image.
    Step 1 — Tesseract OCR (local, free, offline)
    Step 2 — Gemini Vision fallback (needs GENAI_KEY)
    """
    name = _os.path.basename(path)

    # ── Step 1: Tesseract OCR ────────────────────────────
    try:
        import pytesseract
        from PIL import Image

        # Use _find_tesseract() — already handles all paths correctly
        tess = _find_tesseract()
        if tess:
            pytesseract.pytesseract.tesseract_cmd = tess

        img  = Image.open(path)
        text = pytesseract.image_to_string(img).strip()
        if len(text) > 30:
            print(f"[OCR] Tesseract: {len(text)} chars from {name}")
            return text
        else:
            print(f"[OCR] Tesseract found little text ({len(text)} chars) — trying Gemini Vision...")
    except ImportError:
        print("[OCR] pytesseract/Pillow not installed — trying Gemini Vision...")
    except Exception as e:
        print(f"[OCR] Tesseract error: {e} — trying Gemini Vision...")

    # ── Step 2: OpenRouter Vision fallback ──────────────
    try:
        import base64
        print(f"[OCR] Sending to OpenRouter Vision: {name}")

        if not OPENROUTER_KEY:
            print("[OCR] OPENROUTER_KEY not set in .env")
            return ""

        ext  = _os.path.splitext(path)[1].lower().strip(".")
        mime = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png",
                "gif":"image/gif","webp":"image/webp","bmp":"image/bmp"}.get(ext,"image/png")
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()

        from openai import OpenAI
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_KEY,
            timeout=30.0
        )

        # Try free vision models in order until one works
        vision_models = [
            "google/gemini-2.0-flash-lite-001",
            "google/gemini-2.0-flash-001",
            "meta-llama/llama-3.2-11b-vision-instruct:free",
            "qwen/qwen2-vl-7b-instruct:free",
            "openai/gpt-4o-mini",
        ]
        response = None
        for vm in vision_models:
            try:
                print(f"[OCR] Trying vision model: {vm}")
                response = client.chat.completions.create(
                    model=vm,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:{mime};base64,{b64}"}
                                },
                                {
                                    "type": "text",
                                    "text": (
                                        "Extract ALL visible text from this image exactly as written. "
                                        "If it has no readable text, describe the image in full detail."
                                    )
                                }
                            ]
                        }
                    ]
                )
                break  # success
            except Exception as vm_err:
                print(f"[OCR] {vm} failed: {vm_err}")
                continue

        if not response:
            print("[OCR] All vision models failed")
            return ""

        result = response.choices[0].message.content.strip()
        print(f"[OCR] OpenRouter Vision: {len(result)} chars from {name}")
        return result
    except Exception as e:
        print(f"[OCR] OpenRouter Vision failed: {e}")
        return ""


def read_file(path: str) -> str:
    """
    Read any supported file and return its content as a string
    ready to be injected into an AI prompt.
    """
    if not path or not _os.path.exists(path):
        return f"[File not found: {path}]"

    ext  = _os.path.splitext(path)[1].lower()
    name = _os.path.basename(path)

    try:
        # ── Image ────────────────────────────────────────
        if ext in SUPPORTED_IMAGE:
            print(f"[File] Reading image: {name}")
            extracted = _ocr_image(path)
            if extracted:
                return f"[Image: {name}]\nContent extracted from image:\n\n{extracted}"
            else:
                return (
                    f"[Image: {name}]\n"
                    "Could not extract text from this image.\n"
                    "To enable OCR install: pip install pytesseract pillow\n"
                    "And Tesseract engine: https://github.com/UB-Mannheim/tesseract/wiki"
                )

        # ── PDF ──────────────────────────────────────────
        elif ext == ".pdf":
            try:
                import pdfplumber
                with pdfplumber.open(path) as pdf:
                    pages = []
                    for i, page in enumerate(pdf.pages):
                        t = (page.extract_text() or "").strip()
                        if t:
                            pages.append(f"[Page {i+1}]\n{t}")
                text = "\n\n".join(pages)
                if not text.strip():
                    return f"[PDF: {name}]\nThis PDF appears to be scanned. Try sending it as an image."
                print(f"[File] PDF: {len(text)} chars from {name}")
                return f"[PDF: {name}]\n{text[:8000]}"
            except ImportError:
                return f"[PDF: {name}] — install pdfplumber: pip install pdfplumber"

        # ── Text / Code ──────────────────────────────────
        elif ext in SUPPORTED_TEXT:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read(8000)
            lang = ext.strip(".") or "text"
            print(f"[File] Text: {len(text)} chars from {name}")
            return f"[File: {name}]\n```{lang}\n{text}\n```"

        else:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read(4000)
            return f"[File: {name}]\n{text}"

    except Exception as e:
        logging.error(f"FILE READ ERROR: {e}")
        return f"[Could not read {name}: {e}]"


def process_file_query(file_path: str, user_question: str = "") -> str:
    """
    Main entry point called by UI when a file is attached.
    Reads the file and sends it + question to AI.
    """
    file_content = read_file(file_path)

    if user_question:
        full_prompt = file_content + "\n\nUser question: " + user_question
    else:
        full_prompt = file_content + "\n\nDescribe or summarise this content."

    intent = classify_intent(user_question or "explain")
    model  = route_request(intent)
    return ask_ai_with_model(full_prompt, model)


# ================= TEXT TO SPEECH =================
import threading as _threading

tts_enabled  = True    # global toggle — UI can flip this
_tts_thread  = None
_tts_stop    = False

def _speak_pyttsx3(text: str):
    """Offline TTS using pyttsx3."""
    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty("rate",   175)   # speed
        engine.setProperty("volume", 1.0)
        # Pick a decent voice if available
        voices = engine.getProperty("voices")
        for v in voices:
            if "david" in v.name.lower() or "zira" in v.name.lower():
                engine.setProperty("voice", v.id)
                break
        engine.say(text)
        engine.runAndWait()
        engine.stop()
        return True
    except Exception as e:
        print(f"[TTS] pyttsx3 error: {e}")
        return False

def _speak_gtts(text: str):
    """Online TTS using gTTS + pygame."""
    try:
        from gtts import gTTS
        import pygame
        import tempfile, os

        tts = gTTS(text=text, lang="en", slow=False)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
            tmp = f.name
        tts.save(tmp)

        pygame.mixer.init()
        pygame.mixer.music.load(tmp)
        pygame.mixer.music.play()

        # Wait for playback to finish
        while pygame.mixer.music.get_busy():
            if _tts_stop:
                pygame.mixer.music.stop()
                break
            _threading.Event().wait(0.1)

        pygame.mixer.music.unload()
        os.remove(tmp)
        return True
    except Exception as e:
        print(f"[TTS] gTTS error: {e}")
        return False

def speak(text: str):
    """
    Speak text aloud.
    Tries gTTS (online, natural) first if internet available,
    falls back to pyttsx3 (offline) automatically.
    """
    global _tts_thread, _tts_stop

    if not tts_enabled:
        return

    # Clean text — remove markdown symbols
    import re
    clean = re.sub(r"[*_`#>~]", "", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    if not clean:
        return

    # Cap length so it doesn't read forever
    if len(clean) > 800:
        clean = clean[:800] + "..."

    def _run():
        global _tts_stop
        _tts_stop = False
        print(f"[TTS] Speaking ({len(clean)} chars)...")
        if internet_available():
            success = _speak_gtts(clean)
            if not success:
                _speak_pyttsx3(clean)
        else:
            _speak_pyttsx3(clean)

    # Run in background so UI doesn't freeze
    _tts_thread = _threading.Thread(target=_run, daemon=True)
    _tts_thread.start()

def stop_speaking():
    """Stop TTS mid-speech."""
    global _tts_stop
    _tts_stop = True
    try:
        import pygame
        if pygame.mixer.get_init():
            pygame.mixer.music.stop()
    except Exception:
        pass


# ================= MAIN ENTRY =================
def process_text_query(query: str) -> str:
    try:
        r = handle_command(query)
        if r: return r
        r = handle_tool(query)
        if r: return r

        # Only block if truly offline AND no API key configured
        if not internet_available():
            if not (GROQ_KEY or OPENROUTER_KEY):
                return "You're offline. Try 'time', 'date', or 'calculate'."

        intent = classify_intent(query)
        model  = route_request(intent)

        if model == "local_executor":
            return "System command execution not enabled yet."

        return ask_ai_with_model(query, model)

    except Exception:
        logging.error("PROCESS ERROR:\n" + traceback.format_exc())
        return "Something went wrong. Check noxis.log for details."