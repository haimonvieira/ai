from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
import uuid
from datetime import datetime

from app.services.rag_service import rag_service
from app.services.llm_service import llm_service
from app.core.config import settings


router = APIRouter(prefix="/api/v1/rag", tags=["RAG"])


class DocumentUpload(BaseModel):
    document_id: str
    content: str
    metadata: Optional[Dict[str, Any]] = None


class SearchRequest(BaseModel):
    query: str
    collection_name: str
    api_key: str
    provider: str = "openai"
    k: int = 5
    filters: Optional[Dict[str, Any]] = None


class RAGChatRequest(BaseModel):
    query: str
    collection_name: str
    api_key: str
    provider: str = "openai"
    model: str = "gpt-3.5-turbo"
    system_prompt: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 2048


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    collection_name: str = Form(...),
    api_key: str = Form(...),
    provider: str = Form("openai"),
    metadata: Optional[str] = Form(None)
):
    """
    Faz upload de um documento e processa para RAG
    
    Suporta: PDF, TXT, DOCX, MD
    """
    try:
        # Validar tipo de arquivo
        allowed_types = [".pdf", ".txt", ".docx", ".md", ".json"]
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo de arquivo não suportado. Permitidos: {', '.join(allowed_types)}"
            )
        
        # Ler conteúdo do arquivo
        content = await file.read()
        
        # Extrair texto baseado no tipo
        text_content = ""
        
        if file_ext == ".txt" or file_ext == ".md" or file_ext == ".json":
            text_content = content.decode("utf-8")
        elif file_ext == ".pdf":
            # Processar PDF
            from pypdf import PdfReader
            import io
            
            pdf_reader = PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages:
                text_content += page.extract_text() + "\n\n"
        elif file_ext == ".docx":
            # Processar DOCX
            from docx import Document
            import io
            
            doc = Document(io.BytesIO(content))
            for paragraph in doc.paragraphs:
                text_content += paragraph.text + "\n"
        
        if not text_content.strip():
            raise HTTPException(status_code=400, detail="Arquivo vazio ou sem texto extraível")
        
        # Gerar ID único
        document_id = str(uuid.uuid4())
        
        # Preparar metadados
        doc_metadata = {
            "filename": file.filename,
            "file_type": file_ext,
            "file_size": len(content),
            "document_id": document_id,
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        
        if metadata:
            import json
            doc_metadata.update(json.loads(metadata))
        
        # Obter embeddings
        embeddings = llm_service.get_embeddings(provider, api_key)
        
        # Processar documento e adicionar à coleção
        chunk_ids = rag_service.process_document(
            content=text_content,
            metadata=doc_metadata,
            collection_name=collection_name,
            embedding_function=embeddings
        )
        
        return {
            "success": True,
            "document_id": document_id,
            "filename": file.filename,
            "chunks_created": len(chunk_ids),
            "collection": collection_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar documento: {str(e)}")


@router.post("/search")
async def search_documents(request: SearchRequest):
    """
    Busca documentos relevantes na base vetorial
    """
    try:
        # Obter embeddings
        embeddings = llm_service.get_embeddings(request.provider, request.api_key)
        
        # Buscar
        results = rag_service.search(
            query=request.query,
            collection_name=request.collection_name,
            embedding_function=embeddings,
            k=request.k,
            filter_metadata=request.filters
        )
        
        return {
            "query": request.query,
            "results": results,
            "count": len(results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def rag_chat(request: RAGChatRequest):
    """
    Chat com RAG - busca documentos e responde com contexto
    
    Combina busca vetorial com geração de resposta
    """
    try:
        # Obter embeddings e buscar documentos relevantes
        embeddings = llm_service.get_embeddings(request.provider, request.api_key)
        
        search_results = rag_service.search(
            query=request.query,
            collection_name=request.collection_name,
            embedding_function=embeddings,
            k=5
        )
        
        # Construir contexto dos documentos
        context_parts = []
        for i, result in enumerate(search_results, 1):
            context_parts.append(
                f"[Documento {i}] (Score: {result['score']:.2f})\n"
                f"{result['content']}\n"
            )
        
        context = "\n---\n".join(context_parts)
        
        # Construir prompt com contexto
        system_prompt = request.system_prompt or (
            "Você é um assistente útil que responde perguntas baseadas nos documentos fornecidos.\n"
            "Sempre cite as fontes quando possível.\n"
            "Se não encontrar a resposta nos documentos, informe o usuário.\n\n"
            f"CONTEXTO DOS DOCUMENTOS:\n{context}"
        )
        
        # Obter LLM
        llm = llm_service.get_llm(
            provider=request.provider,
            api_key=request.api_key,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        
        # Gerar resposta
        from langchain_core.messages import HumanMessage, SystemMessage
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.query)
        ]
        
        response = llm.invoke(messages)
        
        return {
            "query": request.query,
            "answer": response.content,
            "sources": search_results,
            "model": request.model
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collections")
async def list_collections():
    """Lista todas as coleções disponíveis"""
    try:
        collections = rag_service.list_collections()
        return {"collections": collections}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collections/{collection_name}/stats")
async def get_collection_stats(collection_name: str):
    """Obtém estatísticas de uma coleção"""
    try:
        stats = rag_service.get_collection_stats(collection_name)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/collections/{collection_name}")
async def delete_collection(collection_name: str):
    """Deleta uma coleção"""
    try:
        rag_service.delete_collection(collection_name)
        return {"success": True, "message": f"Coleção {collection_name} deletada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
