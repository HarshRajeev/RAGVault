from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.models.schemas import DocumentIngestResponse, DocumentSummary
from app.models.tables import DocumentChunk
from app.services.embedding import EmbeddingServiceError
from app.services.ingestion import ingest_document

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentIngestResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentIngestResponse:
    try:
        return await ingest_document(db=db, user_id=user.id, upload=file)
    except EmbeddingServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("", response_model=list[DocumentSummary])
async def list_documents(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DocumentSummary]:
    result = await db.execute(
        select(
            DocumentChunk.document_name,
            func.count(func.distinct(DocumentChunk.page_number)).label("pages"),
            func.count(DocumentChunk.id).label("chunks"),
            func.min(DocumentChunk.created_at).label("created_at"),
        )
        .where(DocumentChunk.user_id == user.id)
        .group_by(DocumentChunk.document_name)
        .order_by(func.min(DocumentChunk.created_at).desc())
    )
    return [DocumentSummary(**row._mapping) for row in result.all()]


@router.delete("/{document_name}", status_code=204)
async def delete_document(
    document_name: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(
        delete(DocumentChunk).where(
            DocumentChunk.user_id == UUID(str(user.id)),
            DocumentChunk.document_name == document_name,
        )
    )
    await db.commit()
