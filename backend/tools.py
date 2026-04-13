"""
Tools module for Jarvis AI Assistant
Provides calculator, note-taking, and other utility functions
"""

import os

NOTES_FILE = "notes.txt"


def calculate(expression):
    """
    Safely evaluate mathematical expressions

    Args:
        expression (str): Mathematical expression to evaluate

    Returns:
        str: Result of calculation or error message
    """
    try:
        # Remove any potential harmful characters
        allowed_chars = "0123456789+-*/().% "
        cleaned_expr = ''.join(c for c in expression if c in allowed_chars)

        if not cleaned_expr:
            return "Invalid expression"

        # Safely evaluate
        result = eval(cleaned_expr, {"__builtins__": {}}, {})
        return f"The result is {result}"

    except ZeroDivisionError:
        return "Error: Cannot divide by zero"
    except Exception as e:
        return f"Error: Could not calculate. {str(e)}"


def save_note(text):
    """
    Save a note to the notes file

    Args:
        text (str): Note text to save

    Returns:
        str: Confirmation message
    """
    try:
        if not text:
            return "No note text provided"

        with open(NOTES_FILE, "a", encoding="utf-8") as f:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"[{timestamp}] {text}\n")

        return "Note saved successfully"

    except Exception as e:
        return f"Error saving note: {str(e)}"


def read_notes():
    """
    Read all saved notes

    Returns:
        str: All notes or message if no notes exist
    """
    try:
        if not os.path.exists(NOTES_FILE):
            return "No notes found"

        with open(NOTES_FILE, "r", encoding="utf-8") as f:
            notes = f.read().strip()

        if not notes:
            return "No notes found"

        return f"Your notes:\n{notes}"

    except Exception as e:
        return f"Error reading notes: {str(e)}"


def clear_notes():
    """
    Clear all saved notes

    Returns:
        str: Confirmation message
    """
    try:
        if os.path.exists(NOTES_FILE):
            os.remove(NOTES_FILE)
            return "All notes cleared"
        else:
            return "No notes to clear"

    except Exception as e:
        return f"Error clearing notes: {str(e)}"


# Additional tool functions can be added here
def get_system_info():
    """
    Get basic system information

    Returns:
        str: System information
    """
    import platform
    return (f"System: {platform.system()} {platform.release()}\n"
            f"Python: {platform.python_version()}")