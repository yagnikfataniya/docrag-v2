from dotenv import load_dotenv
load_dotenv(override=True)

import os
from fastapi import FastAPI, UploadFile
from packages.upload import extract_text
from packages.process import create_vectorstore


app = FastAPI()

db = None
UPLOAD_DIR = "media"

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

    return {"message": "uploaded"}

from openai import OpenAI

client = OpenAI()

from fastapi.responses import HTMLResponse
import markdown

@app.post("/ask", response_class=HTMLResponse)
async def ask(question: str):

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

    html = markdown.markdown(response.output_text)

    return html