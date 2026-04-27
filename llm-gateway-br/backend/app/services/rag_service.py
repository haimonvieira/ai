from langchain.vectorstores import Chroma
from langchain.schema import Document as LangChainDocument
from langchain.text_splitter import RecursiveCharacterTextSplitter
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
import os
import hashlib


class RAGService:
    """Serviço para RAG (Retrieval-Augmented Generation)"""
    
    def __init__(self, persist_dir: str = "./chroma_db"):
        self.persist_dir = persist_dir
        os.makedirs(persist_dir, exist_ok=True)
        
        # Cliente persistente do ChromaDB
        self.client = chromadb.PersistentClient(path=persist_dir)
        
        # Cache de coleções
        self.collections: Dict[str, Any] = {}
        
        # Text splitter padrão
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
    
    def get_or_create_collection(self, collection_name: str, embedding_function: Any):
        """
        Obtém ou cria uma coleção no ChromaDB
        
        Args:
            collection_name: Nome da coleção
            embedding_function: Função de embedding
            
        Returns:
            Coleção do ChromaDB
        """
        if collection_name not in self.collections:
            collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            self.collections[collection_name] = collection
        
        return self.collections[collection_name]
    
    def process_document(
        self,
        content: str,
        metadata: Dict[str, Any],
        collection_name: str,
        embedding_function: Any
    ) -> List[str]:
        """
        Processa um documento e adiciona à base vetorial
        
        Args:
            content: Conteúdo do documento
            metadata: Metadados do documento
            collection_name: Nome da coleção
            embedding_function: Função de embedding
            
        Returns:
            Lista de IDs dos chunks criados
        """
        # Dividir documento em chunks
        chunks = self.text_splitter.split_text(content)
        
        # Criar documentos LangChain
        documents = []
        for i, chunk in enumerate(chunks):
            doc_metadata = metadata.copy()
            doc_metadata["chunk_index"] = i
            doc_metadata["total_chunks"] = len(chunks)
            
            documents.append(
                LangChainDocument(
                    page_content=chunk,
                    metadata=doc_metadata
                )
            )
        
        # Obter ou criar coleção
        collection = self.get_or_create_collection(collection_name, embedding_function)
        
        # Gerar IDs únicos
        doc_ids = [
            f"{metadata.get('document_id', 'doc')}_{i}"
            for i in range(len(chunks))
        ]
        
        # Gerar embeddings e adicionar à coleção
        texts = [doc.page_content for doc in documents]
        metadatas = [doc.metadata for doc in documents]
        
        # Se embedding_function for do tipo LangChain
        if hasattr(embedding_function, 'embed_documents'):
            embeddings = embedding_function.embed_documents(texts)
            collection.add(
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=doc_ids
            )
        else:
            # Fallback para embeddings locais
            embeddings = embedding_function.encode(texts)
            collection.add(
                documents=texts,
                embeddings=embeddings.tolist(),
                metadatas=metadatas,
                ids=doc_ids
            )
        
        return doc_ids
    
    def search(
        self,
        query: str,
        collection_name: str,
        embedding_function: Any,
        k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Busca documentos relevantes na base vetorial
        
        Args:
            query: Query de busca
            collection_name: Nome da coleção
            embedding_function: Função de embedding
            k: Número de resultados
            filter_metadata: Filtros de metadados
            
        Returns:
            Lista de documentos relevantes com scores
        """
        collection = self.get_or_create_collection(collection_name, embedding_function)
        
        # Gerar embedding da query
        if hasattr(embedding_function, 'embed_query'):
            query_embedding = embedding_function.embed_query(query)
        else:
            query_embedding = embedding_function.encode(query).tolist()
        
        # Buscar similaridade
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            where=filter_metadata,
            include=["documents", "metadatas", "distances"]
        )
        
        # Format results
        formatted_results = []
        if results['documents'] and results['documents'][0]:
            for i, doc in enumerate(results['documents'][0]):
                result = {
                    "content": doc,
                    "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                    "score": 1 - results['distances'][0][i] if results['distances'] else 0.0,
                }
                formatted_results.append(result)
        
        return formatted_results
    
    def delete_collection(self, collection_name: str):
        """Deleta uma coleção"""
        try:
            self.client.delete_collection(collection_name)
            if collection_name in self.collections:
                del self.collections[collection_name]
        except Exception:
            pass
    
    def get_collection_stats(self, collection_name: str) -> Dict[str, Any]:
        """Obtém estatísticas de uma coleção"""
        try:
            collection = self.client.get_collection(collection_name)
            return {
                "name": collection.name,
                "count": collection.count(),
                "metadata": collection.metadata
            }
        except Exception:
            return {"error": "Coleção não encontrada"}
    
    def list_collections(self) -> List[str]:
        """Lista todas as coleções disponíveis"""
        return self.client.list_collections()


# Singleton
rag_service = RAGService()
