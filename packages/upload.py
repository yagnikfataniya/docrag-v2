from fastapi import FastAPI, UploadFile
from pypdf import PdfReader
from docx import Document

app = FastAPI()

def extract_text(file_path):
    if file_path.endswith(".pdf"):
        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() for page in reader.pages)

    elif file_path.endswith(".docx"):
        doc = Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs)

    elif file_path.endswith(".txt"):
        return open(file_path).read()

    return ""