import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import chromadb
from chromadb.utils import embedding_functions
from werkzeug.utils import secure_filename
from pypdf import PdfReader
from dotenv import load_dotenv

# Load Environment Variables from parent directory (or local .env)
# Ideally, we should source the same keys.
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
DB_FOLDER = os.path.join(os.path.dirname(__file__), 'chroma_db')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DB_FOLDER, exist_ok=True)

if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found. Please check your .env file.")

# Initialize Gemini
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-flash-latest')

# Initialize ChromaDB
chroma_client = chromadb.PersistentClient(path=DB_FOLDER)
# Use a simple default embedding function or Gemini's if available.
# For simplicity and speed, we'll strive for Gemini embeddings if supported, or a standard sentence-transformer.
# Here we use the default all-MiniLM-L6-v2 which Chroma downloads automatically.
embedding_function = embedding_functions.DefaultEmbeddingFunction()

SOCRATIC_PROMPT = """
You are a wise Socratic Tutor. Use the provided context to guide the user to the answer.
Do not give the answer directly. Ask probing questions.
If the context doesn't contain the answer, say "I don't see that in the document."

CONTEXT:
{context}

CHAT HISTORY:
{history}

USER QUERY:
{query}

YOUR RESPONSE:
"""

def extract_text_from_pdf(filepath):
    reader = PdfReader(filepath)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "socratic_rag"}), 200

@app.route('/ingest', methods=['POST'])
def ingest_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    file_hash = request.form.get('file_hash')
    
    if not file_hash:
        return jsonify({"error": "File hash required"}), 400

    collection_name = f"doc_{file_hash}"
    
    # Check if collection exists (Deduplication)
    try:
        existing_collection = chroma_client.get_collection(name=collection_name)
        if existing_collection:
             logger.info(f"Collection {collection_name} already exists. Generating summary from cache.")
             
             # Fetch a chunk for summary
             results = existing_collection.get(limit=1)
             preview_text = ""
             if results['documents'] and len(results['documents']) > 0:
                 preview_text = results['documents'][0]
             
             summary = "Summary generation failed."
             try:
                summary_prompt = f"""
                Analyze the following document excerpt and provide a brief Socratic review using the template below.
                
                Document Excerpt:
                {preview_text[:3000]}
                
                ---
                Template:
                **Title/Topic:** [Identify the main subject]
                **Key Concepts:** [List 3-5 key concepts covered]
                **Difficulty Level:** [Beginner/Intermediate/Advanced]
                **Socratic Approach:** [Briefly mention how you will help the user learn this]
                """
                sum_resp = model.generate_content(summary_prompt)
                summary = sum_resp.text
                logger.info(f"Generated Summary (Cached): {summary[:50]}...")
             except Exception as e:
                logger.error(f"Cached summary gen failed: {e}")

             return jsonify({"message": "File already indexed", "cached": True, "summary": summary}), 200
    except:
        pass # Collection doesn't exist, proceed

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        # 1. Extract Text
        content = ""
        if filename.lower().endswith('.pdf'):
            content = extract_text_from_pdf(filepath)
        elif filename.lower().endswith('.txt') or filename.lower().endswith('.md'):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
             return jsonify({"error": "Unsupported file type"}), 400

        # 2. Chunk Text
        chunk_size = 1000
        chunks = [content[i:i+chunk_size] for i in range(0, len(content), chunk_size)]
        ids = [f"{file_hash}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{"source": filename, "chunk_id": i, "file_hash": file_hash} for i in range(len(chunks))]


        # 3. Store in Chroma
        collection = chroma_client.create_collection(name=collection_name, embedding_function=embedding_function)
        collection.add(documents=chunks, ids=ids, metadatas=metadatas)

        # 4. Generate Document Review (Summary)
        summary = "No summary available."
        try:
            # Use the first 3000 chars for a quick review
            preview_text = content[:3000]
            summary_prompt = f"""
            Analyze the following document excerpt and provide a brief Socratic review using the template below.
            
            Document Excerpt:
            {preview_text}
            
            ---
            Template:
            **Title/Topic:** [Identify the main subject]
            **Key Concepts:** [List 3-5 key concepts covered]
            **Difficulty Level:** [Beginner/Intermediate/Advanced]
            **Socratic Approach:** [Briefly mention how you will help the user learn this]
            """
            
            sum_resp = model.generate_content(summary_prompt)
            summary = sum_resp.text
            logger.info(f"Generated Summary: {summary[:50]}...")
        except Exception as sum_err:
             logger.error(f"Summary generation failed: {sum_err}")
             summary = "Could not generate summary."

        return jsonify({"message": "File ingested successfully", "cached": False, "summary": summary}), 200

    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    query = data.get('query')
    file_hashes = data.get('file_hashes', [])
    # Fallback for single file backward compatibility
    if not file_hashes and data.get('file_hash'):
        file_hashes = [data.get('file_hash')]
        
    history = data.get('history', [])

    current_topic = data.get('current_topic')
    learning_level = data.get('learning_level', 'beginner')

    if not query or not file_hashes:
        return jsonify({"error": "Query and File Hash(es) are required"}), 400

    aggregated_context = ""
    
    # Query each collection
    for f_hash in file_hashes:
        try:
            collection_name = f"doc_{f_hash}"
            try:
                collection = chroma_client.get_collection(name=collection_name, embedding_function=embedding_function)
                # Retrieve top 2 from each file to keep context manageable
                results = collection.query(query_texts=[query], n_results=2)
                
                doc_context = "\n\n".join(results['documents'][0])
                if doc_context:
                    aggregated_context += f"--- Source File Hash: {f_hash} ---\n{doc_context}\n\n"
            except:
                pass # Skip missing collections
        except Exception as e:
            logger.error(f"Error querying collection {f_hash}: {e}")

    if not aggregated_context:
         return jsonify({"response": "I couldn't find relevant information in the uploaded documents.", "topic_completed": False}), 200

    try:

        # 2. Format History & Compress
        recent_history_limit = 5
        summary_text = ""
        
        if len(history) > recent_history_limit:
            # Split history
            older_history = history[:-recent_history_limit]
            recent_history = history[-recent_history_limit:]
            
            # Simple summarization prompt
            history_text_to_summarize = "\n".join([f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in older_history])
            summary_prompt = f"Summarize the key points of this conversation so far in 2-3 sentences:\n\n{history_text_to_summarize}"
            
            try:
                # Use a lightweight call (or same model)
                summary_response = model.generate_content(summary_prompt)
                summary_text = f"PREVIOUS CONVERSATION SUMMARY: {summary_response.text}\n"
            except Exception as ex:
                logger.error(f"Summarization failed: {ex}")
                # Fallback: just ignore summarization if it fails
        else:
            recent_history = history

        formatted_history = "\n".join([f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in recent_history])
        final_history_block = summary_text + formatted_history

        # 3. Generate with JSON structure
        
        system_instructions = f"""
        You are a wise Socratic Tutor. Use the provided context to guide the user to the answer.
        Current Topic: {current_topic if current_topic else 'General'}
        Learning Level: {learning_level}
        
        INSTRUCTIONS:
        1. Do not give the answer directly. Ask probing questions.
        2. If the context doesn't contain the answer, say "I don't see that in the document."
        3. Assess if the user has demonstrated understanding of the **Current Topic**.
           - If yes, set "topic_completed" to true.
           - Otherwise, false.
        
        OUTPUT FORMAT:
        Return JSON Object:
        {{
            "response": "Your Socratic response here...",
            "topic_completed": boolean
        }}
        """

        prompt = f"""
        {system_instructions}
        
        CONTEXT:
        {aggregated_context}
        
        CHAT HISTORY:
        {final_history_block}
        
        USER QUERY:
        {query}
        """

        # Use temperature=0.0 to ensure deterministic responses for the same input
        response = model.generate_content(prompt, generation_config={'response_mime_type': 'application/json', 'temperature': 0.0})
        
        try:
             import json
             resp_json = json.loads(response.text)
             return jsonify(resp_json), 200
        except:
             # Fallback if JSON fails (unlikely with response_mime_type)
             return jsonify({"response": response.text, "topic_completed": False}), 200


    except Exception as e:
        logger.error(f"Chat failed: {e}")
        error_msg = str(e)
        if "429" in error_msg or "quota" in error_msg.lower():
            return jsonify({"error": "Rate limit exceeded. Please wait a minute and try again."}), 429
        return jsonify({"error": str(e)}), 500

@app.route('/generate_plan', methods=['POST'])
def generate_plan():
    data = request.json
    file_hashes = data.get('file_hashes', [])
    learning_level = data.get('learning_level', 'beginner')

    if not file_hashes:
        return jsonify({"error": "File Hash(es) are required"}), 400

    aggregated_context = ""
    preview_limit = 5000 # Limit characters to avoid huge context

    # Aggregate context from files
    for f_hash in file_hashes:
        try:
            collection_name = f"doc_{f_hash}"
            try:
                collection = chroma_client.get_collection(name=collection_name, embedding_function=embedding_function)
                # Just get the first few chunks to understand the document structure
                results = collection.get(limit=10) # Get first 10 chunks
                if results['documents']:
                     doc_text = "\n".join(results['documents'])
                     aggregated_context += f"--- Source File Hash: {f_hash} ---\n{doc_text[:preview_limit]}\n\n"
            except:
                pass 
        except Exception as e:
            logger.error(f"Error reading collection {f_hash}: {e}")

    if not aggregated_context:
        return jsonify({"error": "No context found from files"}), 404

    try:
        prompt = f"""
        You are an expert curriculum designer. 
        Based on the following document content, create a structured study plan for a student at the **{learning_level}** level.
        
        DOCUMENT CONTENT:
        {aggregated_context}
        
        INSTRUCTIONS:
        1. Break down the content into 3-5 logical topics/modules.
        2. Ensure the difficulty matches the '{learning_level}' level.
        3. Output MUST be valid JSON with the following structure:
        {{
            "study_plan": [
                {{
                    "topic": "Topic Name",
                    "description": "Brief description of what will be learned."
                }},
                ...
            ]
        }}
        4. Do not include markdown formatting like ```json ... ```. Just the raw JSON string.
        """

        response = model.generate_content(prompt, generation_config={'response_mime_type': 'application/json'})
        
        # Clean up if model adds markdown despite instructions (common issue)
        clean_text = response.text.strip()
        if clean_text.startswith('```json'):
            clean_text = clean_text[7:]
        if clean_text.endswith('```'):
            clean_text = clean_text[:-3]
        
        import json
        plan_data = json.loads(clean_text)
        
        return jsonify(plan_data), 200

    except Exception as e:
        logger.error(f"Plan generation failed: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("SOCRATIC_PORT", 2002))
    app.run(host='0.0.0.0', port=port)
