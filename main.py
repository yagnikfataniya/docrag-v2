from dotenv import load_dotenv
load_dotenv(override=True)

import os
from fastapi import FastAPI, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from packages.upload import extract_text
from packages.process import create_vectorstore


app = FastAPI()

db = None
UPLOAD_DIR = "media"
uploaded_docs = []

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def serve_index():
    return FileResponse("static/index.html")


@app.post("/upload")
async def upload(file: UploadFile):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = os.path.basename(file.filename)
    path = os.path.join(UPLOAD_DIR, filename)

    with open(path, "wb") as f:
        f.write(await file.read())

    text = extract_text(path)

    global db
    db = create_vectorstore(text)

    # Track uploaded documents
    if filename not in uploaded_docs:
        uploaded_docs.append(filename)

    return {"message": "uploaded", "filename": filename}


@app.get("/documents")
async def list_documents():
    return {"documents": uploaded_docs}


from openai import OpenAI

client = OpenAI()

import markdown


@app.post("/ask")
async def ask(question: str):
    if db is None:
        return JSONResponse(
            status_code=400,
            content={"error": "No document uploaded yet. Please upload a document first."}
        )

    docs = db.similarity_search(question, k=3)

    context = "\n".join([d.page_content for d in docs])

    response = client.responses.create(
        model="gpt-4.1-mini",
        input=f"""
Context:
{context}

Question:
{question}
"""
    )

    html = markdown.markdown(response.output_text, extensions=["tables", "fenced_code"])

    return {"answer": html, "raw": response.output_text}